import { headers } from "next/headers";

/**
 * The origin this request came in on, derived from the request itself rather
 * than an env var — a QR printed from the Vercel deploy has to encode the
 * Vercel URL, and one printed from localhost the local one, with no
 * configuration either way. Keeping this out of `.env` is also what lets the
 * app run from a fresh clone with only the Pollar key set.
 */
export async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export function menuUrl(origin: string, code: string): string {
  return `${origin}/m/${code}`;
}
