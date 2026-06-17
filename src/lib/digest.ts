/**
 * Distill a creator's public data into deterministic, signal-rich
 * "facts" the LLM can ground insights in. The model does its best work
 * when the interesting numbers are already computed — that's what keeps
 * the receipt's three reads honest (real-numbers-only).
 */

import type { RawPost, RawProfile } from "./hiker";

const WINDOW_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const DOW = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export type CreatorDigest = {
  profile: {
    handle: string;
    display_name: string | null;
    biography: string | null;
    category: string | null;
    follower_count: number | null;
    media_count: number | null;
    is_verified: boolean;
  };
  cadence: {
    posts_analyzed: number;
    window_days: number;
    posts_per_week: number;
    longest_streak_days: number;
    last_posted_days_ago: number | null;
  };
  engagement: {
    median_likes: number;
    median_comments: number;
    avg_likes: number;
    total_likes_window: number;
  };
  format_mix: {
    reel_pct: number;
    carousel_pct: number;
    image_pct: number;
    dominant: "reel" | "carousel" | "image" | "mixed";
  };
  top_post: {
    caption_excerpt: string | null;
    post_type: "reel" | "carousel" | "image";
    likes: number;
    comments: number;
    day_of_week: string;
    posted_at_iso: string;
  } | null;
  time_patterns: {
    most_active_day: string | null;
    most_active_hour_local: number | null;
    night_owl_post_count: number; // posts 9pm–4am
  };
  vocabulary: {
    top_hashtags: Array<{ tag: string; count: number }>;
    top_emojis: Array<{ emoji: string; count: number }>;
    signature_words: string[];
  };
  /**
   * Verbatim, lightly-cleaned snippets of what they actually post about.
   * This is the richest signal for making insights feel like *this* person,
   * so it's surfaced to the LLM separately from the numeric facts.
   */
  caption_excerpts: string[];
  /** Pre-baked, real-number English facts the LLM can paraphrase. */
  facts: string[];
};

const EMOJI_RE =
  /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "this", "that", "have", "from", "your", "you",
  "are", "but", "not", "all", "they", "their", "out", "just", "what", "when",
  "more", "like", "than", "into", "some", "about", "been", "will", "would",
  "could", "should", "very", "much", "after", "before", "over", "down", "while",
  "where", "there", "here", "back", "every", "also", "then", "those", "these",
  "them", "off", "still", "even", "many", "most", "was", "were", "being",
  "because", "any", "yet", "ever", "really", "well", "make", "made", "get",
  "got", "now", "today", "day", "days", "one", "new",
]);

export function buildDigest(profile: RawProfile, posts: RawPost[]): CreatorDigest {
  const sorted = [...posts].sort(
    (a, b) => new Date(b.posted_at).getTime() - new Date(a.posted_at).getTime(),
  );
  const anchorMs = sorted[0] ? new Date(sorted[0].posted_at).getTime() : Date.now();
  const cutoff = anchorMs - WINDOW_DAYS * MS_PER_DAY;
  const windowed = sorted.filter((p) => new Date(p.posted_at).getTime() >= cutoff);
  const sample = windowed.length > 0 ? windowed : sorted;

  // Cadence
  const days = uniqueDays(sample);
  const longest_streak_days = longestStreak(days);
  const spanDays = Math.max(
    1,
    Math.round((new Date(sample[0].posted_at).getTime() -
      new Date(sample[sample.length - 1].posted_at).getTime()) / MS_PER_DAY),
  );
  const posts_per_week = round1((sample.length * 7) / Math.max(spanDays, WINDOW_DAYS / 3));
  const lastMs = new Date(sample[0].posted_at).getTime();
  const last_posted_days_ago = Math.max(0, Math.floor((Date.now() - lastMs) / MS_PER_DAY));

  // Engagement
  const likesArr = sample.map((p) => p.likes).sort((a, b) => a - b);
  const commentsArr = sample.map((p) => p.comments).sort((a, b) => a - b);
  const median_likes = median(likesArr);
  const median_comments = median(commentsArr);
  const total_likes_window = sample.reduce((s, p) => s + p.likes, 0);
  const avg_likes = Math.round(total_likes_window / sample.length);

  // Format mix (by count)
  const counts = { reel: 0, carousel: 0, image: 0 };
  for (const p of sample) counts[p.post_type] += 1;
  const total = sample.length;
  const reel_pct = pct(counts.reel, total);
  const carousel_pct = pct(counts.carousel, total);
  const image_pct = pct(counts.image, total);
  const dominant = dominantFormat(reel_pct, carousel_pct, image_pct);

  // Top post (by likes — the number Hiker gives us reliably for all types)
  const topRaw = [...sample].sort((a, b) => b.likes - a.likes)[0] ?? null;
  const top_post = topRaw
    ? {
        caption_excerpt: topRaw.caption ? topRaw.caption.slice(0, 160) : null,
        post_type: topRaw.post_type,
        likes: topRaw.likes,
        comments: topRaw.comments,
        day_of_week: DOW[new Date(topRaw.posted_at).getDay()],
        posted_at_iso: topRaw.posted_at,
      }
    : null;

  // Time patterns
  const hourCounts = new Map<number, number>();
  const dowCounts = new Map<string, number>();
  let night_owl_post_count = 0;
  for (const p of sample) {
    const d = new Date(p.posted_at);
    const h = d.getHours();
    hourCounts.set(h, (hourCounts.get(h) ?? 0) + 1);
    const dow = DOW[d.getDay()];
    dowCounts.set(dow, (dowCounts.get(dow) ?? 0) + 1);
    if (h >= 21 || h < 4) night_owl_post_count += 1;
  }
  const most_active_day = topKey(dowCounts);
  const most_active_hour_local = topKey(hourCounts);

  // Vocabulary
  const captions = sample.map((p) => p.caption ?? "").filter(Boolean);
  const top_hashtags = countTop(
    captions.flatMap((c) => (c.match(/#[\p{L}0-9_]+/gu) ?? []).map((s) => s.toLowerCase())),
    5,
  ).map(([tag, count]) => ({ tag, count }));
  const top_emojis = countTop(
    captions.flatMap((c) => c.match(EMOJI_RE) ?? []),
    5,
  ).map(([emoji, count]) => ({ emoji, count }));
  const signature_words = signatureWords(captions);
  const caption_excerpts = pickCaptionExcerpts(sample);

  const facts = buildFacts({
    profile,
    cadence: { posts_analyzed: sample.length, posts_per_week, longest_streak_days, last_posted_days_ago },
    median_likes,
    median_comments,
    top_post,
    dominant,
    reel_pct,
    carousel_pct,
    image_pct,
    most_active_day,
    most_active_hour_local,
    night_owl_post_count,
    top_hashtags,
    top_emojis,
    signature_words,
  });

  return {
    profile: {
      handle: profile.handle,
      display_name: profile.display_name,
      biography: profile.biography,
      category: profile.category,
      follower_count: profile.follower_count,
      media_count: profile.media_count,
      is_verified: profile.is_verified,
    },
    cadence: {
      posts_analyzed: sample.length,
      window_days: WINDOW_DAYS,
      posts_per_week,
      longest_streak_days,
      last_posted_days_ago,
    },
    engagement: { median_likes, median_comments, avg_likes, total_likes_window },
    format_mix: { reel_pct, carousel_pct, image_pct, dominant },
    top_post,
    time_patterns: {
      most_active_day,
      most_active_hour_local: typeof most_active_hour_local === "number" ? most_active_hour_local : null,
      night_owl_post_count,
    },
    vocabulary: { top_hashtags, top_emojis, signature_words },
    caption_excerpts,
    facts,
  };
}

// ---------------------------------------------------------------------------

function buildFacts(a: {
  profile: RawProfile;
  cadence: { posts_analyzed: number; posts_per_week: number; longest_streak_days: number; last_posted_days_ago: number | null };
  median_likes: number;
  median_comments: number;
  top_post: CreatorDigest["top_post"];
  dominant: CreatorDigest["format_mix"]["dominant"];
  reel_pct: number;
  carousel_pct: number;
  image_pct: number;
  most_active_day: string | null;
  most_active_hour_local: number | null;
  night_owl_post_count: number;
  top_hashtags: Array<{ tag: string; count: number }>;
  top_emojis: Array<{ emoji: string; count: number }>;
  signature_words: string[];
}): string[] {
  const f: string[] = [];
  if (a.profile.follower_count != null) {
    f.push(`has ${a.profile.follower_count.toLocaleString()} followers`);
  }
  if (a.profile.media_count != null) {
    f.push(`has posted ${a.profile.media_count.toLocaleString()} times all-time`);
  }
  f.push(`posts about ${a.cadence.posts_per_week} times per week (based on ${a.cadence.posts_analyzed} recent posts)`);
  if (a.cadence.longest_streak_days >= 2) {
    f.push(`once posted ${a.cadence.longest_streak_days} days in a row`);
  }
  if (a.cadence.last_posted_days_ago != null) {
    f.push(`last posted ${a.cadence.last_posted_days_ago} day(s) ago`);
  }
  f.push(`typical post gets about ${a.median_likes.toLocaleString()} likes and ${a.median_comments.toLocaleString()} comments`);
  if (a.dominant !== "mixed") {
    f.push(`mostly posts ${a.dominant}s (${a.reel_pct}% reels, ${a.carousel_pct}% carousels, ${a.image_pct}% photos)`);
  } else {
    f.push(`mixes formats (${a.reel_pct}% reels, ${a.carousel_pct}% carousels, ${a.image_pct}% photos)`);
  }
  if (a.top_post) {
    const cap = a.top_post.caption_excerpt ? ` captioned "${a.top_post.caption_excerpt}"` : "";
    f.push(`their best recent post is a ${a.top_post.post_type} with ${a.top_post.likes.toLocaleString()} likes${cap}`);
  }
  if (a.most_active_day) f.push(`posts most often on ${a.most_active_day}s`);
  if (a.most_active_hour_local != null) {
    f.push(`posts most often around ${formatHour(a.most_active_hour_local)}`);
  }
  if (a.night_owl_post_count > 0) {
    f.push(`${a.night_owl_post_count} recent posts went up late at night (9pm–4am)`);
  }
  if (a.top_hashtags.length) {
    f.push(`recurring hashtags: ${a.top_hashtags.map((h) => h.tag).join(", ")}`);
  }
  if (a.top_emojis.length) {
    f.push(`most-used emojis in captions: ${a.top_emojis.map((e) => e.emoji).join(" ")}`);
  }
  if (a.signature_words.length) {
    f.push(`words they reach for a lot: ${a.signature_words.join(", ")}`);
  }
  if (a.profile.biography) f.push(`their bio reads: "${a.profile.biography}"`);
  if (a.profile.category) f.push(`Instagram category: ${a.profile.category}`);
  return f;
}

// ---- small helpers ----

function uniqueDays(posts: RawPost[]): string[] {
  return Array.from(
    new Set(posts.map((p) => p.posted_at.slice(0, 10))),
  ).sort();
}

function longestStreak(daysIso: string[]): number {
  if (!daysIso.length) return 0;
  let longest = 1;
  let run = 1;
  for (let i = 1; i < daysIso.length; i++) {
    const a = new Date(daysIso[i - 1]).getTime();
    const b = new Date(daysIso[i]).getTime();
    if (b - a === MS_PER_DAY) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }
  return longest;
}

function median(sortedAsc: number[]): number {
  if (!sortedAsc.length) return 0;
  const mid = Math.floor(sortedAsc.length / 2);
  return sortedAsc.length % 2 ? sortedAsc[mid] : Math.round((sortedAsc[mid - 1] + sortedAsc[mid]) / 2);
}

function pct(n: number, total: number): number {
  return total > 0 ? Math.round((n / total) * 100) : 0;
}

function dominantFormat(reel: number, carousel: number, image: number): CreatorDigest["format_mix"]["dominant"] {
  const max = Math.max(reel, carousel, image);
  if (max < 45) return "mixed";
  if (max === reel) return "reel";
  if (max === carousel) return "carousel";
  return "image";
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function topKey<K>(counts: Map<K, number>): K | null {
  let best: K | null = null;
  let bestV = -Infinity;
  for (const [k, v] of counts) {
    if (v > bestV) {
      bestV = v;
      best = k;
    }
  }
  return best;
}

function countTop<T extends string>(items: T[], n: number): Array<[T, number]> {
  const counts = new Map<T, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

/**
 * Pull a handful of representative caption snippets — the concrete subject
 * matter the model reads to make insights feel personal. We prefer the
 * higher-engagement posts (most "them"), strip the noise (links, hashtag
 * walls, emoji), and keep short verbatim excerpts.
 */
function pickCaptionExcerpts(posts: RawPost[]): string[] {
  const byEngagement = [...posts].sort(
    (a, b) => b.likes + b.comments - (a.likes + a.comments),
  );
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of byEngagement) {
    const cleaned = cleanCaption(p.caption);
    if (!cleaned || cleaned.length < 12) continue;
    const dedupeKey = cleaned.slice(0, 40).toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push(cleaned);
    if (out.length >= 12) break;
  }
  return out;
}

function cleanCaption(raw: string | null): string | null {
  if (!raw) return null;
  let s = raw
    .replace(/https?:\/\/\S+/g, "")
    .replace(/#[\p{L}0-9_]+/gu, "")
    .replace(/@[\p{L}0-9_.]+/gu, "")
    .replace(EMOJI_RE, "")
    .replace(/\s+/g, " ")
    .trim();
  if (s.length > 180) s = `${s.slice(0, 180).trimEnd()}…`;
  return s.length ? s : null;
}

function signatureWords(captions: string[]): string[] {
  const docFreq = new Map<string, number>();
  for (const c of captions) {
    const seen = new Set<string>();
    for (const raw of c.toLowerCase().split(/[^a-z']+/)) {
      const w = raw.trim();
      if (w.length < 4 || STOPWORDS.has(w)) continue;
      seen.add(w);
    }
    for (const w of seen) docFreq.set(w, (docFreq.get(w) ?? 0) + 1);
  }
  return Array.from(docFreq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([w]) => w);
}

function formatHour(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${am ? "am" : "pm"}`;
}
