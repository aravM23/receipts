import { headers } from "next/headers";

/**
 * Resolve the public origin for building absolute links (the QR target).
 * Prefers NEXT_PUBLIC_SITE_URL, else infers from the incoming request
 * headers so it "just works" on localhost and on a LAN IP at the event.
 */
export async function getOrigin(): Promise<string> {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
