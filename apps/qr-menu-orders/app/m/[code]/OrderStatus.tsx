"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import type { OrderStatus as Status } from "@/db/schema";

/**
 * What happens to the order after paying.
 *
 * Without this the diner pays and the app goes quiet: no way to tell whether
 * the kitchen even saw it. That's an anxiety the paper version doesn't have —
 * there you watch the waiter walk away with the ticket — so the order has to
 * report back on its own.
 */

const STEPS: { status: Status; label: string; detail: string }[] = [
  { status: "paid", label: "Pedido recibido", detail: "La cocina ya lo tiene" },
  { status: "preparing", label: "En preparación", detail: "Lo están cocinando" },
  { status: "delivered", label: "Entregado", detail: "¡Que aproveche!" },
];

/** Polite enough not to hammer the server, quick enough to feel live. */
const POLL_MS = 6000;

export function useOrderStatus(orderId: string | null, initial: Status = "paid") {
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => {
    if (!orderId) return;
    let alive = true;

    const check = async () => {
      try {
        const res = await fetch(`/api/orders/${orderId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data.order?.status) setStatus(data.order.status);
      } catch {
        // Signal drops at a table. The next tick tries again.
      }
    };

    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [orderId]);

  return status;
}

export function OrderTimeline({ status }: { status: Status }) {
  const current = STEPS.findIndex((step) => step.status === status);

  return (
    <Card>
      <ol className="flex flex-col">
        {STEPS.map((step, index) => {
          const done = index < current;
          const active = index === current;
          const last = index === STEPS.length - 1;

          return (
            <li key={step.status} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                    done
                      ? "bg-success-light text-success"
                      : active
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface text-muted-light"
                  }`}
                >
                  {done ? "✓" : index + 1}
                </span>
                {!last && (
                  <span
                    className={`w-0.5 flex-1 ${done ? "bg-success" : "bg-border"}`}
                  />
                )}
              </div>
              <div className={last ? "" : "pb-5"}>
                <p
                  className={`font-medium ${
                    active ? "" : done ? "text-muted" : "text-muted-light"
                  }`}
                >
                  {step.label}
                </p>
                {(active || done) && (
                  <p className="text-sm text-muted">{step.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
