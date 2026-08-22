/**
 * Stellar/Horizon constants for this app. Nothing here is secret: Horizon is
 * a public read-only API and the issuer is public information, so none of it
 * belongs in `.env` (the app must run with only the Pollar key configured).
 */

/** Public Horizon instance for testnet. No API key, no auth. */
export const HORIZON_URL = "https://horizon-testnet.stellar.org";

/**
 * Circle's USDC on Stellar testnet — the asset enabled for this app in the
 * Pollar dashboard (Treasury → Tokens & Trustlines).
 */
export const USDC = {
  code: "USDC",
  issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
} as const;

/**
 * Owner account for the spike (the diner pays here). The real app reads the
 * owner's address from the database, per restaurant; this constant only
 * exists so the spike can run before there is a database.
 */
export const SPIKE_OWNER_ADDRESS =
  "GCSD2R2WJIANOEOF4Z474ZX4LAOH6JKOX7IM6UKTM3W6H3LJW3BAJ3SG";

export function explorerTxUrl(hash: string): string {
  return `https://stellar.expert/explorer/testnet/tx/${hash}`;
}

/**
 * Decimal string → integer in Stellar's 7-decimal precision. Amounts must be
 * compared as integers: Horizon returns "3.5000000" where the app has "3.50",
 * and float arithmetic on money is how rounding bugs get in.
 */
export function toStroops(value: string): bigint {
  const [whole, frac = ""] = value.trim().split(".");
  return BigInt(`${whole}${(frac + "0000000").slice(0, 7)}`);
}
