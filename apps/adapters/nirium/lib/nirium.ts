import type { PollarClient } from "@pollar/core";
import { createNiriumAdapter, createPollarSigner } from "nirium-pollar-adapter";
import { decodePaymentResponseHeader } from "@x402/core/http";

/**
 * Nirium's x402 endpoints are a Soroban `transfer` invocation authorized by a
 * signed auth entry (SEP-43) — not a classic Stellar payment. There is no
 * `runTx('payment', …)` equivalent for this: `PollarClient.signAuthEntry()`
 * (the same SDK method createPollarSigner wraps here) is Pollar's own
 * first-class primitive for exactly this shape of request, so this is not a
 * hand-rolled submission path around the SDK.
 *
 * /premium/market over /premium/signals deliberately: /signals only has data
 * when Nirium's autonomous loop is running, which it isn't on the mainnet
 * box — that endpoint 501s there before charging anything, by design. This
 * one is a live external-data read (Etherfuse/Blend/Stellar fee market),
 * independent of the loop, so the exact same call works unmodified against
 * the mainnet agent later. Its response is also the one already reworked to
 * carry attributed reference rates instead of profit/yield-ranking framing.
 */
const TESTNET_ENDPOINT = "https://nirium-agent.fly.dev/api/v1/premium/market";

/** One adapter per PollarClient, same one-instance-per-key discipline as lib/pollar.tsx. */
const globalNirium = globalThis as {
  __niriumAdapter?: ReturnType<typeof createNiriumAdapter>;
};

function getNiriumAdapter(pollar: PollarClient) {
  globalNirium.__niriumAdapter ??= createNiriumAdapter({
    signer: createPollarSigner(pollar),
    network: "stellar:testnet",
  });
  return globalNirium.__niriumAdapter;
}

export interface NiriumMarketResult {
  /** Raw JSON body Nirium's endpoint returned once payment settled. */
  data: unknown;
  /** Settlement tx hash, read off the payment receipt header set by the facilitator. */
  txHash: string | null;
  /**
   * IPFS CID of the audit-trail receipt anchored for this payment, or `null`
   * when anchoring failed. Anchoring is best-effort and never blocks the
   * payment result: the $0.05 already settled regardless of whether the
   * receipt gets anchored, so a failure here must not read as a failed
   * payment.
   */
  cid: string | null;
}

/**
 * Pays $0.05 USDC (testnet, sponsored network fee) for one read of Nirium's
 * public x402 market-state endpoint, and returns the response plus the
 * settlement hash if the facilitator exposed one.
 */
export async function fetchNiriumMarket(
  pollar: PollarClient
): Promise<NiriumMarketResult> {
  const nirium = getNiriumAdapter(pollar);
  const res = await nirium.x402Fetch(TESTNET_ENDPOINT);
  if (!res.ok) {
    throw new Error(`Nirium request failed: ${res.status} ${res.statusText}`);
  }
  const data = await res.json();
  // @x402/fetch exposes the settlement receipt as a base64 header — the
  // facilitator's own SettleResponse, not a custom field Nirium invented.
  // CORS-exposed under both cases (@x402/core sets Access-Control-Expose-Headers
  // to the mixed-case form; plain fetch normalizes header names to lowercase).
  const responseHeader =
    res.headers.get("PAYMENT-RESPONSE") ?? res.headers.get("X-PAYMENT-RESPONSE");
  const txHash = responseHeader
    ? decodePaymentResponseHeader(responseHeader).transaction
    : null;

  let cid: string | null = null;
  try {
    const anchored = await nirium.anchorAuditRecord({
      txHash: txHash ?? undefined,
      tag: "pollar-demo-payment",
      record: { route: "/api/v1/premium/market", amountUsdc: "0.05" },
    });
    cid = anchored.cid;
  } catch {
    // Anchoring is evidence on top of a payment that already settled -
    // never surface this as a payment failure.
  }

  return { data, txHash, cid };
}

export const NIRIUM_TESTNET_ENDPOINT = TESTNET_ENDPOINT;
