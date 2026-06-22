/**
 * POST /api/cards/generate
 *
 * Body: { handle: string }
 *
 * Pipeline:
 *   normalize handle
 *     → ingestByHandle (Hiker: profile + recent posts)
 *     → buildDigest (real signals)
 *     → generateReceipt (LLM: 3 insights + creator type + drink)
 *     → assign ticket number, persist
 *     → { slug }
 *
 * Re-generating an already-fresh card (<6h) for the same handle returns
 * the existing slug so the same person at the bar doesn't mint two
 * tickets by double-tapping.
 */

import { NextResponse } from "next/server";
import { normalizeHandle } from "@/lib/handle";
import { ingestByHandle, IngestError } from "@/lib/hiker";
import { buildDigest } from "@/lib/digest";
import { generateReceipt } from "@/lib/generate";
import { getCardForHandle, nextTicket, saveCard } from "@/lib/store";
import { newSlug } from "@/lib/slug";
import type { ReceiptCard } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Hiker scrape + LLM can take a while; give it room (Pro allows up to 300s).
export const maxDuration = 60;

const FRESH_MS = 6 * 60 * 60 * 1000;

const KIND_TO_STATUS: Record<IngestError["kind"], number> = {
  no_key: 503,
  not_found: 404,
  private: 403,
  no_posts: 422,
  rate_limited: 429,
  upstream: 502,
  unknown: 500,
};

const KIND_TO_MESSAGE: Record<IngestError["kind"], string> = {
  no_key: "Card service isn't configured yet (missing Hiker key).",
  not_found: "We couldn't find that Instagram handle.",
  private: "That account is private. Switch to public to get a card.",
  no_posts: "That account has no public posts to read.",
  rate_limited: "We're being rate-limited. Try again in a minute.",
  upstream: "Instagram data is temporarily unavailable. Try again.",
  unknown: "Something went wrong. Try again.",
};

export async function POST(req: Request) {
  let body: { handle?: string; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const handle = normalizeHandle(body.handle ?? "");
  if (!handle) {
    return NextResponse.json(
      { error: "bad_request", message: "Enter a valid Instagram handle." },
      { status: 400 },
    );
  }

  // Serve a ready-made card when we have one:
  //   - pinned (pre-warmed curated creator) → always reuse, ignore age
  //   - organic → reuse only if still fresh (<6h), so the same person at
  //     the bar doesn't mint two tickets by double-tapping.
  // Skipped when ?force (e.g. while tuning copy). Wrapped so a store outage
  // can't crash the request — worst case we just generate a fresh card.
  if (!body.force) {
    try {
      const existing = await getCardForHandle(handle);
      if (existing) {
        const fresh = Date.now() - new Date(existing.generated_at).getTime() <= FRESH_MS;
        if (existing.pinned || fresh) {
          return NextResponse.json({ slug: existing.slug, reused: true });
        }
      }
    } catch (e) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[generate] dedup lookup failed, continuing", e);
      }
    }
  }

  try {
    const { profile, posts } = await ingestByHandle(handle);
    const digest = buildDigest(profile, posts);
    const generated = await generateReceipt(digest);

    const card: ReceiptCard = {
      slug: newSlug(),
      ticket: await nextTicket(),
      instagram_handle: profile.handle,
      display_name: profile.display_name,
      avatar_url: profile.profile_pic_url
        ? `/api/avatar?u=${encodeURIComponent(profile.profile_pic_url)}`
        : null,
      is_verified: profile.is_verified,
      stats: {
        posts: profile.media_count,
        followers: profile.follower_count,
        following: profile.following_count,
      },
      insights: generated.insights,
      creator_type: generated.creator_type,
      drink: generated.drink,
      generated_at: new Date().toISOString(),
      data_source: "hiker",
      llm_used: generated.llm_used,
    };
    await saveCard(card);

    return NextResponse.json({ slug: card.slug });
  } catch (e) {
    if (e instanceof IngestError) {
      return NextResponse.json(
        { error: e.kind, message: KIND_TO_MESSAGE[e.kind] },
        { status: KIND_TO_STATUS[e.kind] },
      );
    }
    if (process.env.NODE_ENV !== "production") {
      console.error("[generate] unexpected error", e);
    }
    return NextResponse.json(
      { error: "unknown", message: KIND_TO_MESSAGE.unknown },
      { status: 500 },
    );
  }
}
