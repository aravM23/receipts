/**
 * Print queue.
 *
 *   POST /api/print            { slug }            → enqueue a print job
 *   GET  /api/print/next                            → worker claims next job
 *   POST /api/print/complete   { id, status, error }→ worker reports result
 *
 * The worker auth uses the PRINT_WORKER_TOKEN shared secret (header
 * `x-print-token`). Enqueue is open (it's a kiosk/staff action).
 */

import { NextResponse } from "next/server";
import { enqueuePrintJob, getCard } from "@/lib/store";
import { newSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: { slug?: string; image?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const slug = body.slug;
  if (!slug || !(await getCard(slug))) {
    return NextResponse.json({ error: "not_found", message: "No such card." }, { status: 404 });
  }
  // Only accept a PNG data URL so a label printer can render the exact
  // on-screen receipt; anything else is ignored (ESC/POS path still works).
  const image =
    typeof body.image === "string" && body.image.startsWith("data:image/png;base64,")
      ? body.image
      : undefined;
  const job = await enqueuePrintJob(slug, newSlug(), image);
  // Don't echo the (large) image back to the kiosk.
  return NextResponse.json({ job: { ...job, image: undefined } });
}
