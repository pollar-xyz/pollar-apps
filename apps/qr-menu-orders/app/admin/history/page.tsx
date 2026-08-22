import { redirect } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { currentRestaurant } from "@/lib/admin-auth";
import { getHistory } from "@/lib/queries";
import { Money } from "@/components/Money";
import { explorerTxUrl } from "@/lib/stellar";
import { formatDateTime } from "@/lib/time";

export default async function HistoryPage() {
  const restaurant = await currentRestaurant();
  if (!restaurant) redirect("/admin");

  const orders = await getHistory(restaurant.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historial</h1>
        <p className="mt-1 text-sm text-muted">
          Todo lo que vendiste, con su comprobante. Cada uno queda registrado
          y cualquiera puede verificarlo — vos, tu contador o el cliente.
        </p>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="Todavía no vendiste nada"
          description="Cuando alguien escanee el QR de una mesa y pague, la venta queda registrada acá para siempre."
        />
      ) : (
        orders.map((order) => (
          <Card key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-semibold">
                  Pedido #{order.number}{" "}
                  <span className="font-normal text-muted">
                    · {order.tableLabel}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {order.paidAt ? formatDateTime(order.paidAt) : "—"}
                </p>
              </div>
              <Money amount={order.total} className="text-lg font-semibold" />
            </div>

            <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
              {order.lines.map((line) => (
                <li key={line.id}>
                  <span className="font-mono">{line.quantity}×</span> {line.name}
                </li>
              ))}
            </ul>

            {order.txHash && (
              <a
                href={explorerTxUrl(order.txHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-3 inline-block text-sm text-primary underline"
              >
                Ver comprobante ↗
              </a>
            )}
          </Card>
        ))
      )}
    </main>
  );
}
