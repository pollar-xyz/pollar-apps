"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { OrderStatus } from "@/db/schema";
import type { OrderWithLines } from "@/lib/queries";
import { Money, formatMoney } from "@/components/Money";
import { explorerTxUrl } from "@/lib/stellar";
import { formatTime } from "@/lib/time";

/** How often the board looks for payments the browser never reported. */
const POLL_MS = 8000;

const NEXT_LABEL: Partial<Record<OrderStatus, { next: OrderStatus; label: string }>> = {
  paid: { next: "preparing", label: "Empezar a preparar" },
  preparing: { next: "delivered", label: "Marcar entregado" },
};

/** DB values stay English; what the cook reads does not. */
const STATUS_LABEL: Record<string, string> = {
  paid: "Pagado",
  preparing: "En preparación",
  delivered: "Entregado",
};

const TONE: Record<string, string> = {
  paid: "border-success-border bg-success-light text-success",
  preparing: "border-warning-border bg-warning-light text-warning",
  delivered: "border-border bg-surface text-muted",
};

export function Board({ orders }: { orders: OrderWithLines[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Two jobs on one timer: ask Horizon for stragglers, then re-read the
  // board from the server. Both are cheap when nothing changed.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        await fetch("/api/admin/reconcile", { method: "POST" });
      } catch {
        // Offline or Horizon hiccup: the next tick tries again.
      }
      if (alive) startTransition(() => router.refresh());
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [router]);

  async function advance(id: string, status: OrderStatus) {
    setError(null);
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "No se pudo.");
      return;
    }
    startTransition(() => router.refresh());
  }

  const live = orders.filter((order) => order.status !== "delivered");
  const done = orders.filter((order) => order.status === "delivered");

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {error}
        </p>
      )}

      {live.length === 0 ? (
        <EmptyState
          title="No hay nada en la cocina"
          description="Los pedidos pagados caen acá solos, con la mesa y lo que pidieron."
        />
      ) : (
        live.map((order) => (
          <OrderCard key={order.id} order={order} onAdvance={advance} />
        ))
      )}

      {done.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            Entregados hoy ({done.length})
          </h2>
          {done.map((order) => (
            <OrderCard key={order.id} order={order} onAdvance={advance} />
          ))}
        </section>
      )}
    </div>
  );
}

function OrderCard({
  order,
  onAdvance,
}: {
  order: OrderWithLines;
  onAdvance: (id: string, status: OrderStatus) => void;
}) {
  const action = NEXT_LABEL[order.status];

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* The number is what gets shouted across a kitchen, so it leads. */}
          <p className="text-lg font-bold">
            Pedido #{order.number}{" "}
            <span className="font-normal text-muted">· {order.tableLabel}</span>
          </p>
          <p className="text-sm text-muted">
            {order.paidAt ? formatTime(order.paidAt) : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
              TONE[order.status] ?? TONE.delivered
            }`}
          >
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
          <Money amount={order.total} className="text-xl font-semibold" />
        </div>
      </div>

      <ul className="mt-3 flex flex-col gap-1 border-t border-border pt-3">
        {order.lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3 text-sm">
            <span>
              <span className="font-mono font-semibold">{line.quantity}×</span>{" "}
              {line.name}
            </span>
            <span className="font-mono text-muted">{formatMoney(line.price)}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {order.txHash ? (
          <a
            href={explorerTxUrl(order.txHash)}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-muted underline transition-colors hover:text-primary"
          >
            Ver comprobante ↗
          </a>
        ) : (
          <span />
        )}
        {action && (
          <Button onClick={() => onAdvance(order.id, action.next)}>
            {action.label}
          </Button>
        )}
      </div>
    </Card>
  );
}
