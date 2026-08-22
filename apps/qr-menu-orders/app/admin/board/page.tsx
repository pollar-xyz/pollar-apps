import { redirect } from "next/navigation";
import { currentRestaurant } from "@/lib/admin-auth";
import { formatMoney } from "@/components/Money";
import { getBoardOrders, getTodaySummary } from "@/lib/queries";
import { Board } from "./Board";

export default async function BoardPage() {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const [orders, today] = await Promise.all([
    getBoardOrders(restaurant.id),
    getTodaySummary(restaurant.id),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pedidos</h1>
          <p className="mt-1 text-sm text-muted">
            Los pedidos entran solos y ya vienen pagados. Tocá para marcarlos
          cuando los empieces y cuando los entregues.
          </p>
        </div>
        <p className="font-mono text-sm text-muted">
          {today.count} pedidos · {formatMoney(today.total)} hoy
        </p>
      </div>
      <Board orders={orders} />
    </main>
  );
}
