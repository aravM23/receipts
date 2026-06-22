/**
 * POST /api/admin/warm  (token-protected)
 *
 * Pre-warm ("source ahead of time") cards for a batch of expected creators
 * so they're served instantly on-site. For each handle we run the same
 * Hiker + LLM pipeline as /api/cards/generate, then persist the card as
 * `pinned: true` — pinned cards are served on their handle forever,
 * ignoring the normal 6h freshness window.
 *
 * Auth: `Authorization: Bearer <WARM_TOKEN|PRINT_WORKER_TOKEN>`.
 *
 * Body: { handles: string[], force?: boolean }
 *   - force re-warms even if a pinned card already exists.
 *
 * Designed to be called in small batches by scripts/warm-cards.mjs so each
 * request stays well under the function time limit. Handles are processed
 * sequentially to stay gentle on Hiker's rate limits; one bad handle never
 * aborts the batch.
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
export const maxDuration = 300;

type WarmStatus = "warmed" | "reused" | "invalid" | "error";
type WarmResult = {
  input: string;
  handle?: string;
  status: WarmStatus;
  slug?: string;
  ticket?: number;
  error?: string;
};

function authorized(req: Request): boolean {
  const token = process.env.WARM_TOKEN || process.env.PRINT_WORKER_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7) : "";
  const alt = req.headers.get("x-warm-token") || "";
  return bearer === token || alt === token;
}

async function warmOne(input: string, force: boolean): Promise<WarmResult> {
  const handle = normalizeHandle(input);
  if (!handle) return { input, status: "invalid", error: "unparseable handle" };

  if (!force) {
    try {
      const existing = await getCardForHandle(handle);
      if (existing?.pinned) {
        return { input, handle, status: "reused", slug: existing.slug, ticket: existing.ticket };
      }
    } catch {
      /* fall through and (re)generate */
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
      pinned: true,
    };
    await saveCard(card);
    return { input, handle, status: "warmed", slug: card.slug, ticket: card.ticket };
  } catch (e) {
    const error = e instanceof IngestError ? e.kind : e instanceof Error ? e.message : "unknown";
    return { input, handle, status: "error", error };
  }
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { handles?: unknown; force?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request", message: "Invalid JSON." }, { status: 400 });
  }

  const handles = Array.isArray(body.handles)
    ? body.handles.filter((h): h is string => typeof h === "string")
    : [];
  if (!handles.length) {
    return NextResponse.json(
      { error: "bad_request", message: "Provide a non-empty `handles` array." },
      { status: 400 },
    );
  }

  const force = Boolean(body.force);
  const results: WarmResult[] = [];
  for (const input of handles) {
    results.push(await warmOne(input, force));
  }

  const counts = results.reduce<Record<WarmStatus, number>>(
    (acc, r) => {
      acc[r.status] += 1;
      return acc;
    },
    { warmed: 0, reused: 0, invalid: 0, error: 0 },
  );

  return NextResponse.json({ counts, results });
}
