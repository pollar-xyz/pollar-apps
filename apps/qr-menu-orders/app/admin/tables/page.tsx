import { redirect } from "next/navigation";
import { currentRestaurant } from "@/lib/admin-auth";
import { appOrigin, menuUrl } from "@/lib/origin";
import { qrSvg } from "@/lib/qr";
import { getTables } from "@/lib/queries";
import { TablesManager } from "./TablesManager";

export default async function TablesPage() {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const [tables, origin] = await Promise.all([
    getTables(restaurant.id),
    appOrigin(),
  ]);

  // Rendered on the server so the list needs no client-side QR library.
  const withQr = await Promise.all(
    tables.map(async (table) => ({
      ...table,
      url: menuUrl(origin, table.code),
      svg: await qrSvg(menuUrl(origin, table.code), 160),
    }))
  );

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mesas</h1>
        <p className="mt-1 text-sm text-muted">
          Un QR por mesa. El cliente lo escanea, ve tu menú de hoy y pide desde
          su celular — y el pedido te llega sabiendo a qué mesa va.
        </p>
      </div>
      <TablesManager tables={withQr} />
    </main>
  );
}
