import { eq } from "drizzle-orm";
import { db, dbReady } from "@/db/client";
import { restaurant } from "@/db/schema";
import {
  generateAdminToken,
  hashToken,
  publicRestaurant,
  setAdminCookie,
} from "@/lib/admin-auth";
import { slugify, tableCode } from "@/lib/ids";
import { looksLikeAddress } from "@/lib/payments";

/**
 * Creates a restaurant and issues its admin token.
 *
 * The token is returned exactly once, in this response — only its hash is
 * stored. The owner saves it; losing it means losing write access, which is
 * the trade for not being able to verify a Pollar session server-side.
 */
export async function POST(request: Request) {
  await dbReady();

  let body: { name?: string; ownerAddress?: string; ownerEmail?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido mal formado." }, { status: 400 });
  }

  const name = body.name?.trim();
  const ownerAddress = body.ownerAddress?.trim();

  if (!name) {
    return Response.json({ error: "El local necesita un nombre." }, { status: 400 });
  }
  if (!ownerAddress || !looksLikeAddress(ownerAddress)) {
    return Response.json(
      { error: "Hace falta una dirección Pollar válida (G…) para recibir los pagos." },
      { status: 400 }
    );
  }

  const slug = await freeSlug(slugify(name) || "restaurante");
  const token = generateAdminToken();

  const [created] = await db
    .insert(restaurant)
    .values({
      name,
      slug,
      ownerAddress,
      ownerEmail: body.ownerEmail?.trim() || null,
      adminTokenHash: hashToken(token),
    })
    .returning();

  await setAdminCookie(token);

  return Response.json(
    { restaurant: publicRestaurant(created), token },
    { status: 201 }
  );
}

/** Slugs are unique; a second "Doña Mary" becomes dona-mary-K7QP. */
async function freeSlug(base: string): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${tableCode(4)}`;
    const [taken] = await db
      .select({ id: restaurant.id })
      .from(restaurant)
      .where(eq(restaurant.slug, candidate))
      .limit(1);
    if (!taken) return candidate;
  }
  return `${base}-${tableCode(8)}`;
}
