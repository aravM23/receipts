/**
 * GET /api/avatar?u=<encoded IG CDN url>
 *
 * Proxies an Instagram profile picture through our own origin so:
 *   - html-to-image can inline it without tainting the canvas (CORS)
 *   - the print worker can fetch the bytes from a stable URL
 *
 * Only proxies Instagram/FB CDN hosts. Caches aggressively — these CDN
 * URLs are immutable for their (short) lifetime.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;

export async function GET(req: Request) {
  const u = new URL(req.url).searchParams.get("u");
  if (!u) return new NextResponse("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse("bad url", { status: 400 });
  }
  if (!ALLOWED_HOST.test(target.hostname)) {
    return new NextResponse("host not allowed", { status: 400 });
  }

  try {
    const upstream = await fetch(target.toString(), { cache: "no-store" });
    if (!upstream.ok || !upstream.body) {
      return new NextResponse("upstream error", { status: 502 });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await upstream.arrayBuffer());
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch {
    return new NextResponse("fetch failed", { status: 502 });
  }
}
