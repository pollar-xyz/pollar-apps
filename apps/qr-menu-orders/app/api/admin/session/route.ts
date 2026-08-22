import {
  clearAdminCookie,
  findByToken,
  publicRestaurant,
  setAdminCookie,
} from "@/lib/admin-auth";

/** Restore access on another device by pasting the admin token. */
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Pedido mal formado." }, { status: 400 });
  }

  const token = body.token?.trim();
  if (!token) {
    return Response.json({ error: "Pegá tu clave de admin." }, { status: 400 });
  }

  const found = await findByToken(token);
  if (!found) {
    return Response.json({ error: "Esa clave no coincide con ningún local." }, { status: 401 });
  }

  await setAdminCookie(token);
  return Response.json({ restaurant: publicRestaurant(found) });
}

export async function DELETE() {
  await clearAdminCookie();
  return Response.json({ ok: true });
}
