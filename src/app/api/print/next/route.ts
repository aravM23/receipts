/**
 * GET /api/print/next — the print worker claims the oldest queued job.
 * Returns { job, card } or { job: null }. Requires the worker token.
 */

import { NextResponse } from "next/server";
import { claimNextPrintJob, getCard } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request): boolean {
  const expected = process.env.PRINT_WORKER_TOKEN;
  if (!expected) return true; // no token configured → open (dev)
  return req.headers.get("x-print-token") === expected;
}

export async function GET(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const job = await claimNextPrintJob();
  if (!job) return NextResponse.json({ job: null });
  const card = await getCard(job.slug);
  return NextResponse.json({ job, card });
}
