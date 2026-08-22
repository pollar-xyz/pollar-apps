"use client";

import { useState } from "react";
import { usePollar } from "@pollar/react";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import { useBalance } from "@/hooks/useBalance";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { formatAmount, middleTruncate } from "@/lib/format";
import type { VerificationResult } from "@/lib/horizon";
import { explorerTxUrl, SPIKE_OWNER_ADDRESS, USDC } from "@/lib/stellar";

/**
 * Spike: validates the ordering loop end to end on testnet before the real
 * app is built. Pick items → pay with the order reference attached as a
 * Stellar MEMO_ID → the server verifies the payment against Horizon.
 *
 * Throwaway diagnostics page. It dumps raw SDK and Horizon payloads on
 * purpose: the point is to learn what the SDK actually returns, not to look
 * pretty.
 */

const MENU = [
  { id: "silpancho", name: "Silpancho", price: "3.50" },
  { id: "sopa-mani", name: "Sopa de maní", price: "2.00" },
  { id: "api-pastel", name: "Api con pastel", price: "1.20" },
];

/** MEMO_ID is a uint64, so the order reference is a number, not a short code. */
function newOrderRef(): string {
  return String(Date.now());
}

function sumTotal(qty: Record<string, number>): string {
  const cents = MENU.reduce(
    (acc, item) =>
      acc + Math.round(Number(item.price) * 100) * (qty[item.id] ?? 0),
    0
  );
  return (cents / 100).toFixed(2);
}

type PayState =
  | { step: "idle" }
  | { step: "paying" }
  | { step: "verifying"; hash: string }
  | { step: "done"; hash: string; result: VerificationResult }
  | { step: "error"; message: string };

export default function SpikePage() {
  const { user } = usePollarAuth();
  const { asset, balance, refresh } = useBalance();
  const { runTx, txHistory, getClient } = usePollar();

  const [qty, setQty] = useState<Record<string, number>>({});
  const [state, setState] = useState<PayState>({ step: "idle" });
  const [rawOutcome, setRawOutcome] = useState<unknown>(null);

  const total = sumTotal(qty);
  const itemCount = Object.values(qty).reduce((a, b) => a + b, 0);

  // Guard: useBalance() falls back to native XLM when the app asset isn't
  // loaded, and paying an order in XLM instead of USDC would be a silent
  // disaster. No USDC record, no payment.
  const usdcReady =
    asset?.code === USDC.code && asset?.issuer === USDC.issuer;

  async function payAndVerify() {
    const memoId = newOrderRef();
    setState({ step: "paying" });
    setRawOutcome(null);
    try {
      const outcome = await runTx(
        "payment",
        {
          destination: SPIKE_OWNER_ADDRESS,
          amount: total,
          asset: { type: "credit_alphanum4", code: USDC.code, issuer: USDC.issuer },
        },
        { memo: { type: "id", value: memoId } }
      );
      setRawOutcome(outcome);

      if (outcome.status === "error" || !outcome.hash) {
        setState({
          step: "error",
          message: outcome.status === "error"
            ? (outcome.message ?? outcome.details ?? "The payment failed.")
            : "The payment returned no hash.",
        });
        return;
      }

      setState({ step: "verifying", hash: outcome.hash });
      const res = await fetch("/api/spike/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hash: outcome.hash, amount: total, memoId }),
      });
      const result = (await res.json()) as VerificationResult;
      setState({ step: "done", hash: outcome.hash, result });
      void refresh();
    } catch (err) {
      setState({
        step: "error",
        message: err instanceof Error ? err.message : "Unexpected failure.",
      });
    }
  }

  if (!user) {
    return (
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
        <h1 className="text-2xl font-bold">Spike · log in as the diner</h1>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight">Spike · order &amp; pay</h1>
        <LoginButton />
      </header>

      <Card>
        <div className="flex flex-col gap-1 text-sm">
          <Row label="You (diner)" value={middleTruncate(user.address, 6, 6)} />
          <Row label="Owner (recipient)" value={middleTruncate(SPIKE_OWNER_ADDRESS, 6, 6)} />
          <Row
            label="Your balance"
            value={`${formatAmount(balance)} ${asset?.code ?? "—"}`}
          />
        </div>
        {!usdcReady && (
          <p className="mt-3 rounded-xl border border-warning-border bg-warning-light px-3 py-2 text-sm text-warning">
            No USDC balance record yet. Payment is blocked so the order can&apos;t
            be charged in XLM by accident.
          </p>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
          Menu
        </h2>
        <div className="flex flex-col divide-y divide-border">
          {MENU.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{item.name}</p>
                <p className="font-mono text-sm text-muted">
                  {item.price} {USDC.code}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="h-9 w-9 justify-center p-0"
                  onClick={() =>
                    setQty((q) => ({ ...q, [item.id]: Math.max(0, (q[item.id] ?? 0) - 1) }))
                  }
                >
                  −
                </Button>
                <span className="w-6 text-center font-mono tabular-nums">
                  {qty[item.id] ?? 0}
                </span>
                <Button
                  variant="secondary"
                  className="h-9 w-9 justify-center p-0"
                  onClick={() => setQty((q) => ({ ...q, [item.id]: (q[item.id] ?? 0) + 1 }))}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
          <span className="text-sm text-muted">Total ({itemCount} items)</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">
            {total} {USDC.code}
          </span>
        </div>
      </Card>

      <Button
        onClick={() => void payAndVerify()}
        disabled={
          itemCount < 2 ||
          !usdcReady ||
          state.step === "paying" ||
          state.step === "verifying"
        }
        loading={state.step === "paying" || state.step === "verifying"}
        className="w-full py-3"
      >
        {state.step === "paying"
          ? "Paying…"
          : state.step === "verifying"
            ? "Verifying on Horizon…"
            : itemCount < 2
              ? "Pick at least 2 items"
              : `Pay ${total} ${USDC.code}`}
      </Button>

      {state.step === "error" && (
        <p className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
          {state.message}
        </p>
      )}

      {(state.step === "verifying" || state.step === "done") && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            Verification
          </h2>
          <p className="mb-3 break-all font-mono text-xs">
            <a
              href={explorerTxUrl(state.hash)}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              {state.hash}
            </a>
          </p>
          {state.step === "verifying" ? (
            <div className="flex items-center gap-2 text-sm text-muted">
              <Spinner /> Asking Horizon…
            </div>
          ) : (
            <VerificationView result={state.result} />
          )}
        </Card>
      )}

      <Card>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
            SDK tx history (raw)
          </h2>
          <Button
            variant="secondary"
            className="px-3 py-1.5 text-sm"
            onClick={() => void getClient().fetchTxHistory({ limit: 5 })}
          >
            Fetch
          </Button>
        </div>
        <p className="mb-2 text-xs text-muted">
          Checking whether the untyped <code className="font-mono">details</code>{" "}
          bag carries amount, destination or memo — that decides if SDK history
          is usable as a second detection path.
        </p>
        <Dump
          value={
            txHistory.step === "loaded" ? txHistory.data.records : txHistory.step
          }
        />
      </Card>

      {rawOutcome !== null && (
        <Card>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
            runTx outcome (raw)
          </h2>
          <Dump value={rawOutcome} />
        </Card>
      )}
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function VerificationView({ result }: { result: VerificationResult }) {
  if (result.error) {
    return (
      <p className="rounded-xl border border-error-border bg-error-light px-3 py-2 text-sm text-error">
        {result.error}
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <p
        className={`rounded-xl border px-3 py-2 text-sm font-medium ${
          result.ok
            ? "border-success-border bg-success-light text-success"
            : "border-error-border bg-error-light text-error"
        }`}
      >
        {result.ok
          ? "✓ Verified on the ledger — this order is really paid"
          : "✗ Not verified — see which check failed"}
      </p>
      <div className="flex flex-col divide-y divide-border">
        {result.checks.map((c) => (
          <div key={c.id} className="flex flex-col gap-1 py-2 text-sm">
            <div className="flex items-start gap-2">
              <span className={c.ok ? "text-success" : "text-error"}>
                {c.ok ? "✓" : "✗"}
              </span>
              <span className="flex-1">{c.label}</span>
            </div>
            {!c.ok && (
              <div className="ml-6 flex flex-col gap-0.5 break-all font-mono text-xs text-muted">
                <span>expected: {c.expected}</span>
                <span>actual: {c.actual}</span>
              </div>
            )}
          </div>
        ))}
      </div>
      <Dump value={result.raw} />
    </div>
  );
}

function Dump({ value }: { value: unknown }) {
  return (
    <pre className="max-h-64 overflow-auto rounded-xl border border-border bg-surface p-3 font-mono text-xs leading-relaxed text-muted">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}
