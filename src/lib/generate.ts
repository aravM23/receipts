/**
 * Turn a creator's digest into the receipt's payload:
 *   - exactly 3 polished, sentence-case insights ("STANLEY'S READ")
 *   - 1 open-ended creator type ("Story Collector")
 *   - 1 drink recommendation ("Spicy Margarita")
 *
 * The model is told to ONLY use numbers that appear in the digest's
 * facts (real-numbers-only), and to keep the voice warm + observational
 * like a thoughtful friend reading your feed — not a stats dashboard.
 *
 * Best-effort: if there's no OPENAI_API_KEY or the call fails, we fall
 * back to a deterministic rule-based version so a receipt always prints.
 */

import OpenAI from "openai";
import type { CreatorDigest } from "./digest";
import type { Insight } from "./types";

const DEFAULT_MODEL = "gpt-4o";
const REQUEST_TIMEOUT_MS = 40_000;

/** The only drinks the bar is serving — every card resolves to one of these. */
const ALLOWED_DRINKS = ["Aperol Spritz", "Margarita", "French 75", "Wine", "Beer"] as const;

export type GeneratedReceipt = {
  insights: Insight[];
  creator_type: string;
  drink: string;
  llm_used: boolean;
};

const SYSTEM_PROMPT = `You write the "STANLEY+" receipt — a playful, premium little character read of an Instagram creator that gets printed at a bar. The whole magic is the person reading it thinking "wait... that's actually me." Generic horoscope lines kill that feeling.

You are given (1) verbatim CAPTION SNIPPETS of what this person actually posts, and (2) numeric FACTS about their behavior. READ THE CAPTIONS FIRST — they tell you what this person genuinely cares about and talks about.

Produce a JSON object with EXACTLY these keys:

{
  "insights": ["...", "...", "..."],   // exactly 3
  "creator_type": "Two Words",          // 2 words, title case, sounds like a nickname/identity
  "drink": "<ONE drink copied verbatim from the allowed list>"
}

THE BAR FOR INSIGHTS (most important):
- Each insight MUST be anchored to concrete evidence: a specific subject they clearly post about (from the captions), a habit the numbers reveal, or a tone that's obvious in their own words. If you can't point to the evidence, don't write the line.
- BAN vague, could-be-anyone lines like "You find beauty in tech", "You embrace late-night creativity", "You lean into urban rhythms". These are filler. Be concrete and a little specific instead.
- Prefer naming the actual thing: what they shoot, where they go, who they talk to, the recurring subject. Specific > poetic.
- Write 3 DIFFERENT angles: (1) what they actually make/post about, (2) something true about their character that the content reveals, (3) a quirk, tension, or tendency.

VOICE:
- Sentence-case observations that start with "You". 5 to 11 words each. End each with a period. No emoji. Warm and perceptive, like a sharp friend who's been following them, not a stats dashboard.
- Never use em dashes or en dashes (— or –). Use commas, periods, or plain words instead.

HARD RULES:
- REAL NUMBERS ONLY: reference a number ONLY if it appears verbatim in the FACTS. Never invent counts, dates, or stats.
- Don't quote captions verbatim; infer from them.
- creator_type: a fresh, flattering 2-word identity that fits THEIR actual niche (e.g. "Street Archivist", "Studio Tinkerer", "Late-Night Builder"). Title case. Not a sentence.
- drink: choose EXACTLY ONE from this list, copied verbatim — "Aperol Spritz", "Margarita", "French 75", "Wine", "Beer". Match it to THIS person's specific personality from their captions. Do NOT default to Aperol Spritz; genuinely vary the pick across different creators. Use this vibe guide:
  * Aperol Spritz - bright, social, aesthetic, sunny, travel/brunch/lifestyle energy.
  * Margarita - bold, playful, high-energy, party, funny, extroverted.
  * French 75 - elegant, polished, fashion, luxury, refined, sophisticated.
  * Wine - thoughtful, cozy, intimate, writerly, warm, romantic, slow-living.
  * Beer - down-to-earth, casual, sporty, relatable, no-frills, everyman.
  Do not invent any other drink.
- Output ONLY the JSON object. No markdown, no commentary.`;

function resolveClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({
    apiKey: key,
    baseURL: process.env.OPENAI_BASE_URL,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 1,
  });
}

export async function generateReceipt(digest: CreatorDigest): Promise<GeneratedReceipt> {
  const client = resolveClient();
  if (!client) return fallback(digest);

  const userMessage = buildUserMessage(digest);

  try {
    const resp = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL ?? DEFAULT_MODEL,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
    });
    const raw = resp.choices[0]?.message?.content;
    if (!raw) return fallback(digest);
    const parsed = parseAndValidate(raw);
    if (!parsed) return fallback(digest);
    // Force the drink into the bar's actual menu regardless of what the model said.
    return { ...parsed, drink: coerceDrink(parsed.drink, digest), llm_used: true };
  } catch (e) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[generate] LLM failed, using fallback: ${e instanceof Error ? e.message : String(e)}`);
    }
    return fallback(digest);
  }
}

function buildUserMessage(digest: CreatorDigest): string {
  const lines: string[] = [];
  lines.push(`Creator: @${digest.profile.handle}${digest.profile.display_name ? ` (${digest.profile.display_name})` : ""}`);
  if (digest.profile.biography) lines.push(`Bio: "${digest.profile.biography}"`);
  lines.push("");

  if (digest.caption_excerpts.length) {
    lines.push("WHAT THEY ACTUALLY POST (verbatim caption snippets — read these to understand them):");
    for (const cap of digest.caption_excerpts) lines.push(`- "${cap}"`);
    lines.push("");
  }

  lines.push("FACTS (behavior + stats; only cite numbers that appear here):");
  for (const fact of digest.facts) lines.push(`- ${fact}`);
  return lines.join("\n");
}

function parseAndValidate(raw: string): Omit<GeneratedReceipt, "llm_used"> | null {
  let obj: unknown;
  try {
    obj = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;

  const insightsRaw = Array.isArray(o.insights) ? o.insights : [];
  const insights: Insight[] = insightsRaw
    .filter((x): x is string => typeof x === "string")
    .map((t) => ({ text: cleanLine(t) }))
    .filter((i) => i.text.length > 0 && i.text.length <= 80)
    .slice(0, 3);

  const creator_type = typeof o.creator_type === "string" ? titleCase(cleanLine(o.creator_type)) : "";
  const drink = typeof o.drink === "string" ? titleCase(cleanLine(o.drink)) : "";

  if (insights.length < 3 || !creator_type || !drink) return null;
  return { insights, creator_type, drink };
}

// ---- deterministic fallback ----

function fallback(digest: CreatorDigest): GeneratedReceipt {
  const insights: Insight[] = [];

  // 1 — habit
  if (digest.cadence.posts_per_week >= 5) {
    insights.push({ text: "You show up almost every single day.", source: `posts_per_week=${digest.cadence.posts_per_week}` });
  } else if (digest.time_patterns.night_owl_post_count > 0) {
    insights.push({ text: "Your best ideas arrive after midnight.", source: `night_owl=${digest.time_patterns.night_owl_post_count}` });
  } else {
    insights.push({ text: "You post only when it actually matters.", source: `posts_per_week=${digest.cadence.posts_per_week}` });
  }

  // 2 — character
  if (digest.engagement.median_comments >= digest.engagement.median_likes * 0.05) {
    insights.push({ text: "You make people want to reply.", source: "comment ratio" });
  } else {
    insights.push({ text: "You care more than you let on.", source: "tone" });
  }

  // 3 — quirk
  if (digest.format_mix.dominant === "carousel") {
    insights.push({ text: "You never tell a story in one frame.", source: "carousel-dominant" });
  } else if (digest.format_mix.dominant === "reel") {
    insights.push({ text: "You think in motion, not stills.", source: "reel-dominant" });
  } else if (digest.vocabulary.top_emojis[0]) {
    insights.push({ text: "You romanticize the ordinary moments.", source: "emoji/tone" });
  } else {
    insights.push({ text: "You leave a little mystery on purpose.", source: "tone" });
  }

  const creator_type = fallbackType(digest);
  const drink = fallbackDrink(digest);
  return { insights: insights.slice(0, 3), creator_type, drink, llm_used: false };
}

function fallbackType(d: CreatorDigest): string {
  if (d.format_mix.dominant === "carousel") return "Story Collector";
  if (d.format_mix.dominant === "reel") return "Motion Maker";
  if (d.time_patterns.night_owl_post_count > 0) return "Midnight Diarist";
  if ((d.profile.follower_count ?? 0) > 100_000) return "Quiet Magnet";
  return "Everyday Romantic";
}

function fallbackDrink(d: CreatorDigest): string {
  if (d.format_mix.dominant === "reel") return "French 75";
  if (d.time_patterns.night_owl_post_count > 0) return "Margarita";
  if (d.format_mix.dominant === "carousel") return "Aperol Spritz";
  if ((d.profile.follower_count ?? 0) > 100_000) return "Wine";
  return "Beer";
}

/** Map whatever the model returned to one of the allowed menu drinks. */
function coerceDrink(raw: string, digest: CreatorDigest): string {
  const norm = raw.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
  const aliases: Record<string, (typeof ALLOWED_DRINKS)[number]> = {
    "aperol spritz": "Aperol Spritz",
    aperol: "Aperol Spritz",
    spritz: "Aperol Spritz",
    margarita: "Margarita",
    margherita: "Margarita",
    "spicy margarita": "Margarita",
    "french 75": "French 75",
    french75: "French 75",
    "french 75 cocktail": "French 75",
    wine: "Wine",
    "red wine": "Wine",
    "white wine": "Wine",
    rose: "Wine",
    prosecco: "Wine",
    champagne: "Wine",
    beer: "Beer",
    lager: "Beer",
    ipa: "Beer",
    pilsner: "Beer",
  };
  if (aliases[norm]) return aliases[norm];
  for (const [key, value] of Object.entries(aliases)) {
    if (norm.includes(key)) return value;
  }
  return fallbackDrink(digest);
}

// ---- string utils ----

function stripFences(s: string): string {
  return s.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
}

function cleanLine(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim();
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}
