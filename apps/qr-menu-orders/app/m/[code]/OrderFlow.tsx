"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { usePollar } from "@pollar/react";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Spinner } from "@/components/ui/Spinner";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { Money, formatMoney } from "@/components/Money";
import { fromCents, multiply, sum, toCents } from "@/lib/money";
import type { CategoryWithItems } from "@/lib/queries";
import { explorerTxUrl, USDC } from "@/lib/stellar";
import {
  clearTracked,
  parseTracked,
  readTracked,
  subscribeTracked,
  writeTracked,
} from "@/lib/tracked-order";
import { OrderTimeline, useOrderStatus } from "./OrderStatus";

interface Props {
  restaurantName: string;
  tableLabel: string;
  tableCode: string;
  menu: CategoryWithItems[];
}

interface PlacedLine {
  name: string;
  price: string;
  quantity: number;
}

type Stage =
  | { step: "browsing" }
  | { step: "placing" }
  | { step: "paying"; total: string }
  | { step: "verifying"; total: string }
  | {
      step: "done";
      orderId: string;
      total: string;
      hash: string;
      number: number;
      lines: PlacedLine[];
    }
  | { step: "error"; message: string };

export function OrderFlow({ restaurantName, tableLabel, tableCode, menu }: Props) {
  const { user, verified } = usePollarAuth();
  const { asset, balance, refresh } = useBalance();
  const { runTx, openReceiveModal } = usePollar();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [stage, setStage] = useState<Stage>({ step: "browsing" });

  const storageKey = `qr-menu:order:${tableCode}`;

  /**
   * A phone locks, a browser gets closed, someone reopens the camera. The
   * order shouldn't vanish with the tab, so the last one for this table is
   * remembered locally — enough to keep showing how it's going.
   */
  const rawTracked = useSyncExternalStore(
    subscribeTracked,
    () => readTracked(storageKey),
    () => null
  );
  const tracked = useMemo(() => parseTracked(rawTracked), [rawTracked]);

  const activeOrderId =
    stage.step === "done" ? stage.orderId : (tracked?.id ?? null);
  const liveStatus = useOrderStatus(activeOrderId);

  // Once it's on the table there is nothing left to follow.
  useEffect(() => {
    if (liveStatus === "delivered") clearTracked(storageKey);
  }, [liveStatus, storageKey]);

  const lines = useMemo(
    () =>
      menu
        .flatMap((category) => category.items)
        .map((item) => ({ item, quantity: qty[item.id] ?? 0 }))
        .filter((line) => line.quantity > 0),
    [menu, qty]
  );

  const total = lines.length
    ? sum(lines.map((line) => multiply(line.item.price, line.quantity)))
    : "0.00";
  const count = lines.reduce((acc, line) => acc + line.quantity, 0);

  // useBalance() falls back to native XLM before the app asset loads. Paying
  // an order in XLM instead of USDC would be silent and unrecoverable, so a
  // payment is only allowed once the real USDC record is in hand.
  const usdcReady = asset?.code === USDC.code && asset?.issuer === USDC.issuer;
  const shortOnFunds =
    usdcReady && balance !== null && Number(balance) < Number(total);

  /**
   * While the diner is short, keep checking. Somebody at the table sends them
   * the difference and the pay button turns itself on — no "I already sent
   * it, refresh" back and forth across the table.
   */
  useEffect(() => {
    if (!shortOnFunds) return;
    const timer = setInterval(() => void refresh(), 8000);
    return () => clearInterval(timer);
  }, [shortOnFunds, refresh]);


  async function placeAndPay() {
    setStage({ step: "placing" });
    try {
      const createRes = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableCode,
          items: lines.map((line) => ({
            itemId: line.item.id,
            quantity: line.quantity,
          })),
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) {
        throw new Error(created.error ?? "No pudimos tomar tu pedido.");
      }

      const order = created.order as {
        id: string;
        number: number;
        memoId: number;
        total: string;
        payToAddress: string;
      };

      setStage({ step: "paying", total: order.total });

      // The order reference rides along as a Stellar MEMO_ID, which is what
      // ties this payment to this order on the ledger.
      const outcome = await runTx(
        "payment",
        {
          destination: order.payToAddress,
          amount: order.total,
          asset: { type: "credit_alphanum4", code: USDC.code, issuer: USDC.issuer },
        },
        { memo: { type: "id", value: String(order.memoId) } }
      );

      if (outcome.status === "error" || !outcome.hash) {
        throw new Error(
          outcome.status === "error"
            ? (outcome.message ??
              outcome.details ??
              "El pago no se pudo hacer. Revisá tu saldo y probá de nuevo.")
            : "El pago no devolvió comprobante. Revisá tu cuenta antes de volver a intentar."
        );
      }

      setStage({ step: "verifying", total: order.total });

      const confirmRes = await fetch(`/api/orders/${order.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: outcome.hash }),
      });
      const confirmed = await confirmRes.json();
      if (!confirmRes.ok) {
        throw new Error(
          confirmed.error ?? "No pudimos confirmar el pago. Avisale al local."
        );
      }

      writeTracked(storageKey, { id: order.id, number: order.number });

      setStage({
        step: "done",
        orderId: order.id,
        total: order.total,
        hash: outcome.hash,
        number: order.number,
        // Snapshot for the receipt: the cart is cleared right after.
        lines: lines.map((line) => ({
          name: line.item.name,
          price: line.item.price,
          quantity: line.quantity,
        })),
      });
      setQty({});
    } catch (err) {
      setStage({
        step: "error",
        message: err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.",
      });
    }
  }

  if (stage.step === "done") {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-success-light text-3xl text-success">
            ✓
          </span>
          <h1 className="text-2xl font-bold tracking-tight">¡Listo, ya pagaste!</h1>
          <p className="text-muted">
            Tu pedido salió para la cocina y va a llegar a {tableLabel}. No hace
            falta que llames a nadie.
          </p>
        </div>

        <OrderTimeline status={liveStatus} />

        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              Tu comprobante
            </p>
            <p className="font-mono text-sm font-semibold">Pedido #{stage.number}</p>
          </div>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {stage.lines.map((line) => (
              <li
                key={line.name}
                className="flex items-baseline justify-between gap-3 py-2 text-sm"
              >
                <span>
                  <span className="font-mono font-semibold">{line.quantity}×</span>{" "}
                  {line.name}
                </span>
                <span className="font-mono text-muted">
                  {formatMoney(multiply(line.price, line.quantity))}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-semibold">Total pagado</span>
            <Money amount={stage.total} withCoin className="text-xl font-bold" />
          </div>
          <a
            href={explorerTxUrl(stage.hash)}
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm transition-colors hover:bg-surface-hover"
          >
            <span>
              <span className="font-medium">Ver comprobante del pago</span>
              <span className="block text-xs text-muted">
                Queda registrado y cualquiera puede verificarlo
              </span>
            </span>
            <span aria-hidden="true" className="text-muted">↗</span>
          </a>
        </Card>

        <Button
          variant="secondary"
          onClick={() => setStage({ step: "browsing" })}
          className="w-full py-3"
        >
          Pedir algo más
        </Button>
      </main>
    );
  }

  const working =
    stage.step === "placing" || stage.step === "paying" || stage.step === "verifying";

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5 pb-32">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">
            {restaurantName}
          </h1>
          <p className="text-sm text-muted">{tableLabel}</p>
        </div>
        <LoginButton />
      </header>

      {/* Money on hand, before anything is chosen. A diner deciding what to
          order needs to know what they can afford; leaving it to the moment
          of payment turns a normal decision into a rejection. */}
      {user && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface px-4 py-3">
          <span className="text-sm text-muted">Tenés para gastar</span>
          {usdcReady ? (
            <Money
              amount={balance ?? "0"}
              withCoin
              className="text-lg font-semibold"
            />
          ) : (
            <span className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> abriendo tu cuenta…
            </span>
          )}
        </div>
      )}

      {tracked && stage.step === "browsing" && (
        /* Came back to the menu with an order still going: tell them where it
           is before they wonder whether it went through at all. */
        <Card>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-semibold">Tu pedido #{tracked.number}</p>
            <p className="text-sm text-muted">{tableLabel}</p>
          </div>
          <div className="mt-3">
            <OrderTimeline status={liveStatus} />
          </div>
        </Card>
      )}

      {menu.length > 0 && (
        /* A diner who has never used this doesn't know what "Pagar" will do —
           whether a waiter comes, whether a card is needed. Saying it up front
           removes the hesitation. */
        <p className="rounded-2xl border border-border bg-surface px-4 py-3 text-sm leading-6 text-muted">
          Elegí lo que quieras y pagá desde tu celular con tu cuenta Pollar. El
          pedido llega a la cocina ya pagado, no hace falta llamar a nadie.
        </p>
      )}

      {menu.length === 0 ? (
        <EmptyState
          title="Hoy no hay nada cargado"
          description="El menú de este local todavía no tiene platos disponibles."
        />
      ) : (
        menu.map((category) => (
          <Card key={category.id}>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
              {category.name}
            </h2>
            <div className="mt-1 flex flex-col divide-y divide-border">
              {category.items.map((item) => (
                <div key={item.id} className="flex items-center gap-3 py-3">
                  {item.photoUrl && (
                    /* Plain img on purpose: the URL is whatever the owner
                       pasted, so there is no host list to optimize against. */
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.photoUrl}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl border border-border object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    {item.description && (
                      <p className="line-clamp-2 text-sm text-muted">
                        {item.description}
                      </p>
                    )}
                    <p className="font-mono text-sm text-muted">
                      {formatMoney(item.price)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      variant="secondary"
                      className="h-10 w-10 justify-center p-0 text-lg"
                      aria-label={`Quitar uno de ${item.name}`}
                      onClick={() =>
                        setQty((q) => ({
                          ...q,
                          [item.id]: Math.max(0, (q[item.id] ?? 0) - 1),
                        }))
                      }
                    >
                      −
                    </Button>
                    <span className="w-5 text-center font-mono tabular-nums">
                      {qty[item.id] ?? 0}
                    </span>
                    <Button
                      variant="secondary"
                      className="h-10 w-10 justify-center p-0 text-lg"
                      aria-label={`Agregar uno de ${item.name}`}
                      onClick={() =>
                        setQty((q) => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))
                      }
                    >
                      +
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      {stage.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {stage.message}
        </p>
      )}

      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 p-4 backdrop-blur">
          <div className="mx-auto flex w-full max-w-md flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted">
                {count} {count === 1 ? "plato" : "platos"}
                {user && usdcReady && (
                  <>
                    {" · te quedan "}
                    <span className="font-mono">{formatMoney(balance ?? "0")}</span>
                  </>
                )}
              </span>
              <Money amount={total} withCoin className="text-2xl font-semibold" />
            </div>

            {!user ? (
              <LoginButton />
            ) : !usdcReady ? (
              <p className="flex items-center justify-center gap-2 rounded-xl border border-warning-border bg-warning-light px-3 py-2.5 text-sm text-warning">
                <Spinner /> Preparando tu cuenta…
              </p>
            ) : shortOnFunds ? (
              /* At a table, the realistic fix isn't a bank transfer — it's the
                 person sitting across from you. Receiving is a plain payment,
                 so this works the same on any network. */
              <div className="flex flex-col gap-2">
                <p className="rounded-xl border border-warning-border bg-warning-light px-3 py-2.5 text-center text-sm text-warning">
                  Te faltan{" "}
                  <span className="font-mono">
                    {formatMoney(fromCents(toCents(total) - toCents(balance ?? "0")))}
                  </span>{" "}
                  para este pedido.
                </p>
                <Button
                  variant="secondary"
                  onClick={openReceiveModal}
                  className="w-full py-3"
                >
                  Que alguien te mande la diferencia
                </Button>
                <p className="text-center text-xs text-muted-light">
                  Mostrale tu código a quien te va a pagar. Apenas llegue, el
                  botón se habilita solo.
                </p>
              </div>
            ) : (
              <Button
                onClick={() => void placeAndPay()}
                disabled={working || !verified}
                loading={working}
                className="w-full py-3.5 text-base"
              >
                {stage.step === "placing"
                  ? "Armando el pedido…"
                  : stage.step === "paying"
                    ? "Pagando…"
                    : stage.step === "verifying"
                      ? "Confirmando en la red…"
                      : `Pagar ${formatMoney(total)}`}
              </Button>
            )}
            {/* The one person who most needs to know this is the one about to
                tap Pay, and they arrive straight here from the QR — they
                never see the landing page where it also says so. */}
            {user && (
              <p className="text-center text-xs text-muted-light">
                Modo de prueba · no se cobra dinero real
              </p>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
