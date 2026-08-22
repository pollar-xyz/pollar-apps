import { redirect } from "next/navigation";
import { Money } from "@/components/Money";
import { Card } from "@/components/ui/Card";
import { currentRestaurant } from "@/lib/admin-auth";
import { getBoardOrders, getTodaySummary } from "@/lib/queries";
import { formatTime, startOfToday } from "@/lib/time";

export default async function SummaryPage() {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const [today, orders] = await Promise.all([
    getTodaySummary(restaurant.id),
    getBoardOrders(restaurant.id),
  ]);

  const paid = orders.filter((order) => order.paidAt);
  const dishes = new Map<string, number>();
  for (const order of paid) {
    for (const line of order.lines) {
      dishes.set(line.name, (dishes.get(line.name) ?? 0) + line.quantity);
    }
  }
  const top = [...dishes.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Hoy</h1>
        <p className="mt-1 text-sm text-muted">
          Tus ventas de hoy, contadas desde las {formatTime(startOfToday())}
          en hora de Bolivia.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Cobrado
          </p>
          <Money amount={today.total} withCoin className="mt-1 text-3xl font-semibold" />
          <p className="text-sm text-muted">en ventas</p>
        </div>
        <div className="rounded-2xl border border-border bg-surface px-4 py-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">
            Pedidos
          </p>
          <p className="mt-1 font-mono text-3xl font-semibold tabular-nums">
            {today.count}
          </p>
          <p className="text-sm text-muted">pagados hoy</p>
        </div>
      </div>

      <Card>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Lo más pedido hoy
        </h2>
        {top.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Todavía no vendiste nada hoy.</p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {top.map(([name, quantity]) => (
              <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                <span className="truncate">{name}</span>
                <span className="font-mono font-semibold tabular-nums">
                  {quantity}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
