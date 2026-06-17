/**
 * Hiker-only Instagram ingestion, keyed by username.
 *
 * No OAuth, no Graph API — the bar activation just asks for a handle
 * and we scrape the public profile + recent posts via HikerAPI.
 *
 * Endpoints used (see https://hiker-doc.readthedocs.io):
 *   GET /v1/user/by/username?username=<handle>   → User object
 *   GET /v1/user/medias/chunk?user_id=<pk>[&end_cursor=] → [ [media...], cursor ]
 *
 * Auth: `x-access-key` header. Key from HIKER_API_KEY or LAMADAVA_API_KEY.
 *
 * Everything normalizes into the small RawProfile / RawPost shapes the
 * digest + LLM consume. Failures throw a labelled IngestError so the API
 * route can map each to a friendly status + message.
 */

const BASE_URL = "https://api.hikerapi.com";
const TIMEOUT_MS = 20_000;
/** How many recent posts to pull (one chunk is ~12; we page a couple). */
const MAX_POSTS = 36;
const MAX_PAGES = 3;

export type RawProfile = {
  pk: string;
  handle: string;
  display_name: string | null;
  biography: string | null;
  category: string | null;
  follower_count: number | null;
  following_count: number | null;
  media_count: number | null;
  is_verified: boolean;
  is_private: boolean;
  profile_pic_url: string | null;
};

export type RawPost = {
  shortcode: string;
  url: string;
  caption: string | null;
  post_type: "reel" | "carousel" | "image";
  posted_at: string; // ISO
  views: number; // play_count for reels; likes*8 heuristic otherwise
  likes: number;
  comments: number;
  thumbnail_url: string | null;
};

export type IngestResult = {
  profile: RawProfile;
  posts: RawPost[];
};

export type IngestErrorKind =
  | "no_key"
  | "not_found"
  | "private"
  | "no_posts"
  | "rate_limited"
  | "upstream"
  | "unknown";

export class IngestError extends Error {
  readonly kind: IngestErrorKind;
  readonly handle: string;
  readonly upstreamStatus?: number;
  constructor(
    kind: IngestErrorKind,
    handle: string,
    message: string,
    upstreamStatus?: number,
  ) {
    super(message);
    this.name = "IngestError";
    this.kind = kind;
    this.handle = handle;
    this.upstreamStatus = upstreamStatus;
  }
}

function apiKey(): string | null {
  return process.env.HIKER_API_KEY || process.env.LAMADAVA_API_KEY || null;
}

async function hikerGet(
  path: string,
  params: Record<string, string>,
  key: string,
  handle: string,
): Promise<unknown> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "GET",
      headers: { "x-access-key": key, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } catch (e) {
    throw new IngestError(
      "upstream",
      handle,
      `Network error calling Hiker: ${e instanceof Error ? e.message : String(e)}`,
    );
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 404) {
    throw new IngestError("not_found", handle, `Hiker: user not found (404).`, 404);
  }
  if (res.status === 429) {
    throw new IngestError("rate_limited", handle, `Hiker rate-limited (429).`, 429);
  }
  if (res.status === 401 || res.status === 403) {
    throw new IngestError("no_key", handle, `Hiker rejected the key (${res.status}).`, res.status);
  }
  if (!res.ok) {
    throw new IngestError("upstream", handle, `Hiker HTTP ${res.status}.`, res.status);
  }
  try {
    return await res.json();
  } catch {
    throw new IngestError("upstream", handle, `Hiker returned non-JSON.`);
  }
}

/** Hiker User object — only the fields we read. */
type HikerUser = {
  pk?: string | number;
  username?: string;
  full_name?: string;
  biography?: string;
  follower_count?: number;
  following_count?: number;
  media_count?: number;
  is_verified?: boolean;
  is_private?: boolean;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  category_name?: string | null;
  category?: string | null;
};

/** Hiker Media object — only the fields we read. */
type HikerMedia = {
  pk?: string | number;
  code?: string;
  taken_at?: string;
  taken_at_ts?: number;
  media_type?: number; // 1 image, 2 video/reel, 8 carousel
  product_type?: string;
  thumbnail_url?: string | null;
  like_count?: number;
  comment_count?: number;
  play_count?: number;
  view_count?: number;
  caption_text?: string | null;
};

export async function ingestByHandle(handleRaw: string): Promise<IngestResult> {
  const handle = handleRaw.toLowerCase();
  const key = apiKey();
  if (!key) {
    throw new IngestError("no_key", handle, "HIKER_API_KEY is not set.");
  }

  const userBody = (await hikerGet(
    "/v1/user/by/username",
    { username: handle },
    key,
    handle,
  )) as HikerUser | null;

  if (!userBody || !userBody.pk) {
    throw new IngestError("not_found", handle, "Hiker returned no user object.");
  }

  const profile: RawProfile = {
    pk: String(userBody.pk),
    handle: userBody.username ?? handle,
    display_name: userBody.full_name?.trim() || null,
    biography: userBody.biography?.trim() || null,
    category: userBody.category_name ?? userBody.category ?? null,
    follower_count: numOrNull(userBody.follower_count),
    following_count: numOrNull(userBody.following_count),
    media_count: numOrNull(userBody.media_count),
    is_verified: !!userBody.is_verified,
    is_private: !!userBody.is_private,
    profile_pic_url:
      userBody.profile_pic_url_hd || userBody.profile_pic_url || null,
  };

  if (profile.is_private) {
    throw new IngestError(
      "private",
      handle,
      "This account is private. Stanley can only read public profiles.",
    );
  }

  const posts = await fetchMedias(profile.pk, key, handle);
  if (posts.length === 0) {
    throw new IngestError(
      "no_posts",
      handle,
      "This account has no public posts to read.",
    );
  }

  return { profile, posts };
}

async function fetchMedias(
  userPk: string,
  key: string,
  handle: string,
): Promise<RawPost[]> {
  const out: RawPost[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < MAX_PAGES && out.length < MAX_POSTS; page++) {
    const params: Record<string, string> = { user_id: userPk };
    if (cursor) params.end_cursor = cursor;

    const body = await hikerGet("/v1/user/medias/chunk", params, key, handle);

    // Shape is `[ [media, media, ...], end_cursor ]`.
    if (!Array.isArray(body)) break;
    const items = Array.isArray(body[0]) ? (body[0] as HikerMedia[]) : [];
    cursor = typeof body[1] === "string" ? (body[1] as string) : undefined;

    for (const m of items) {
      const post = normalizeMedia(m);
      if (post) out.push(post);
      if (out.length >= MAX_POSTS) break;
    }
    if (!cursor || items.length === 0) break;
  }

  return out;
}

function normalizeMedia(m: HikerMedia): RawPost | null {
  if (!m.code) return null;
  const postedAt = isoFromMedia(m);
  if (!postedAt) return null;

  const post_type: RawPost["post_type"] =
    m.media_type === 8 ? "carousel" : m.media_type === 2 ? "reel" : "image";

  const likes = num(m.like_count);
  const comments = num(m.comment_count);
  // Reels report play_count/view_count; static posts have none, so we
  // estimate reach from likes (same heuristic the legacy app used) just
  // so distribution math has a usable number. The LLM is told static
  // "views" are estimated and must not be quoted as a hard number.
  const plays = num(m.play_count) || num(m.view_count);
  const views = post_type === "reel" ? plays || likes * 8 : likes * 8;

  return {
    shortcode: m.code,
    url: `https://www.instagram.com/p/${m.code}/`,
    caption: m.caption_text?.trim() || null,
    post_type,
    posted_at: postedAt,
    views,
    likes,
    comments,
    thumbnail_url: m.thumbnail_url ?? null,
  };
}

function isoFromMedia(m: HikerMedia): string | null {
  if (m.taken_at && /\d{4}-\d{2}-\d{2}/.test(m.taken_at)) return m.taken_at;
  if (typeof m.taken_at_ts === "number") {
    return new Date(m.taken_at_ts * 1000).toISOString();
  }
  return null;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}
function numOrNull(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
