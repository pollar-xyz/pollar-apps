import { HORIZON_URL, toStroops, USDC } from "@/lib/stellar";

/**
 * Server-side payment verification against the Stellar ledger.
 *
 * The diner pays from inside this app, so `runTx` hands the client a hash —
 * but a client can claim any hash it likes. Nothing is marked as paid until
 * Horizon confirms that THIS hash is a successful payment of THIS amount, in
 * THIS asset, to THIS account, carrying THIS order's reference. Horizon is
 * public and read-only: no key, no account, no Pollar involvement.
 */

export interface PaymentExpectation {
  hash: string;
  /** The owner's account: where the money must have landed. */
  destination: string;
  /** Decimal string, e.g. "6.70". */
  amount: string;
  /** The order reference travelling as a Stellar MEMO_ID (uint64 as string). */
  memoId: string;
}

export interface Check {
  id: string;
  label: string;
  ok: boolean;
  expected: string;
  actual: string;
}

export interface VerificationResult {
  ok: boolean;
  checks: Check[];
  /** Raw Horizon payloads, kept so the spike can show what the ledger says. */
  raw?: { transaction: unknown; operations: unknown };
  error?: string;
}

interface HorizonTx {
  hash: string;
  successful: boolean;
  memo?: string;
  memo_type?: string;
  created_at: string;
  ledger: number;
}

interface HorizonOp {
  type: string;
  from?: string;
  to?: string;
  amount?: string;
  asset_type?: string;
  asset_code?: string;
  asset_issuer?: string;
}

/**
 * A transaction is not queryable the instant it is submitted: the ledger
 * closes every ~5s and Horizon indexes shortly after, so a 404 here means
 * "not yet", not "never". Retry a few times before giving up.
 */
async function fetchWithRetry(
  url: string,
  attempts = 6,
  delayMs = 1500
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { cache: "no-store" });
    if (res.status !== 404) return res;
    last = res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return last!;
}

export async function verifyPayment(
  expect: PaymentExpectation
): Promise<VerificationResult> {
  const txRes = await fetchWithRetry(
    `${HORIZON_URL}/transactions/${encodeURIComponent(expect.hash)}`
  );

  if (!txRes.ok) {
    return {
      ok: false,
      checks: [],
      error:
        txRes.status === 404
          ? "Horizon doesn't know this hash. Either the transaction never reached the network, or it hasn't been indexed yet."
          : `Horizon replied ${txRes.status}.`,
    };
  }

  const tx = (await txRes.json()) as HorizonTx;
  const opsRes = await fetch(
    `${HORIZON_URL}/transactions/${encodeURIComponent(expect.hash)}/operations`,
    { cache: "no-store" }
  );
  const opsBody = (await opsRes.json()) as { _embedded?: { records?: HorizonOp[] } };
  const ops = opsBody._embedded?.records ?? [];

  // The payment we care about, not any other operation bundled in the tx.
  const payment = ops.find(
    (op) => op.type === "payment" && op.to === expect.destination
  );

  const checks: Check[] = [
    {
      id: "successful",
      label: "The transaction succeeded on the network",
      ok: tx.successful === true,
      expected: "true",
      actual: String(tx.successful),
    },
    {
      id: "destination",
      label: "The money landed in the owner's account",
      ok: payment?.to === expect.destination,
      expected: expect.destination,
      actual: payment?.to ?? "(no payment operation to that account)",
    },
    {
      id: "amount",
      label: "The amount matches the order total",
      ok:
        payment?.amount !== undefined &&
        toStroops(payment.amount) === toStroops(expect.amount),
      expected: expect.amount,
      actual: payment?.amount ?? "(none)",
    },
    {
      id: "asset",
      label: "It was paid in the expected USDC, not another asset",
      ok:
        payment?.asset_code === USDC.code &&
        payment?.asset_issuer === USDC.issuer,
      expected: `${USDC.code} / ${USDC.issuer}`,
      actual: payment?.asset_code
        ? `${payment.asset_code} / ${payment.asset_issuer}`
        : (payment?.asset_type ?? "(none)"),
    },
    {
      id: "memo",
      label: "It carries this order's reference",
      ok: tx.memo_type === "id" && tx.memo === expect.memoId,
      expected: `id:${expect.memoId}`,
      actual: tx.memo_type ? `${tx.memo_type}:${tx.memo ?? ""}` : "(no memo)",
    },
  ];

  return {
    ok: checks.every((c) => c.ok),
    checks,
    raw: { transaction: tx, operations: ops },
  };
}
