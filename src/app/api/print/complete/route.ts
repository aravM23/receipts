/**
 * POST /api/print/complete — the print worker reports a job result.
 * Body: { id, status: "done" | "error", error? }. Requires worker token.
 */

import { NextResponse } from "next/server";
import { updatePrintJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authed(req: Request): boolean {
  const expected = process.env.PRINT_WORKER_TOKEN;
  if (!expected) return true;
  return req.headers.get("x-print-token") === expected;
}

export async function POST(req: Request) {
  if (!authed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { id?: string; status?: "done" | "error"; error?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id || (body.status !== "done" && body.status !== "error")) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const job = await updatePrintJob(body.id, body.status, body.error);
  if (!job) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ job });
}
