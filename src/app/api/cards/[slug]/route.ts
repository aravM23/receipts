/**
 * GET /api/cards/[slug] — public fetch of a receipt by slug.
 * Used by the print worker (and any client) to get the full payload.
 */

import { NextResponse } from "next/server";
import { getCard } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const card = await getCard(slug);
  if (!card) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ card });
}
