import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { restaurant } from "@/db/schema";

/**
 * Authorization for the owner's screens.
 *
 * A Pollar session can't be verified server-side: the SDK exposes no
 * verifiable session token, so a `user.address` arriving in a request body
 * proves nothing — anyone could POST someone else's address and edit their
 * menu. So the app issues its own credential: a random token, shown once when
 * the restaurant is created, stored only as a SHA-256 hash.
 *
 * The Pollar address is still the payout account; it just isn't what grants
 * write access.
 */

const COOKIE = "qr_admin";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function generateAdminToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time compare, so a wrong token can't be found byte by byte. */
export function tokensMatch(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export type Restaurant = typeof restaurant.$inferSelect;

/** The restaurant as the client may see it: never the credential hash. */
export type PublicRestaurant = Omit<Restaurant, "adminTokenHash">;

export function publicRestaurant(row: Restaurant): PublicRestaurant {
  const rest: Partial<Restaurant> = { ...row };
  delete rest.adminTokenHash;
  return rest as PublicRestaurant;
}

export async function findByToken(token: string): Promise<Restaurant | null> {
  await dbReady();
  const hash = hashToken(token);
  const [row] = await db
    .select()
    .from(restaurant)
    .where(eq(restaurant.adminTokenHash, hash))
    .limit(1);
  // The lookup is already by hash; the extra compare keeps the check explicit
  // and constant-time even if the query ever becomes a scan.
  return row && tokensMatch(row.adminTokenHash, hash) ? row : null;
}

export async function setAdminCookie(token: string): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
}

export async function clearAdminCookie(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

/** The restaurant this browser is signed in to, or null. */
export async function currentRestaurant(): Promise<Restaurant | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? findByToken(token) : null;
}

export class Unauthorized extends Error {}

/** Use in route handlers: throws Unauthorized, caught by `adminRoute`. */
export async function requireRestaurant(): Promise<Restaurant> {
  const found = await currentRestaurant();
  if (!found) throw new Unauthorized("Not signed in to a restaurant.");
  return found;
}

/**
 * Wraps a route handler: resolves the restaurant, turns Unauthorized into a
 * 401 and anything unexpected into a 500 without leaking internals.
 */
export function adminRoute<T>(
  handler: (restaurant: Restaurant, request: Request, ctx: T) => Promise<Response>
) {
  return async (request: Request, ctx: T): Promise<Response> => {
    try {
      const found = await requireRestaurant();
      return await handler(found, request, ctx);
    } catch (err) {
      if (err instanceof Unauthorized) {
        return Response.json({ error: err.message }, { status: 401 });
      }
      console.error("[admin route]", err);
      return Response.json({ error: "Algo salió mal." }, { status: 500 });
    }
  };
}
