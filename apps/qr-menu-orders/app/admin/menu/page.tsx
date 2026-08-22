import { redirect } from "next/navigation";
import { currentRestaurant } from "@/lib/admin-auth";
import { getMenu } from "@/lib/queries";
import { MenuEditor } from "./MenuEditor";

export default async function MenuPage() {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const menu = await getMenu(restaurant.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Menú</h1>
        <p className="mt-1 text-sm text-muted">
          Apagá un plato y desaparece al instante del menú de los comensales.
          Ese es el botón de &ldquo;se acabó&rdquo;.
        </p>
      </div>
      <MenuEditor initialMenu={menu} />
    </main>
  );
}
