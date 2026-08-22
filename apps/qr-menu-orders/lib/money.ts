/**
 * Money as decimal strings with two places, handled through integer cents.
 *
 * Never floats: 0.1 + 0.2 is 0.30000000000000004, and an order total that is
 * off by a fraction of a cent fails the amount check against the ledger. All
 * arithmetic here goes through bigint cents and comes back as a string.
 */

const CENTS = /^\d+(\.\d{1,2})?$/;

/** "3,5" → "3.50". Returns null when it isn't a usable positive amount. */
export function normalizeAmount(input: string): string | null {
  const raw = input.trim().replace(",", ".");
  if (!CENTS.test(raw)) return null;
  const cents = toCents(raw);
  if (cents <= 0n) return null;
  return fromCents(cents);
}

export function toCents(amount: string): bigint {
  const [whole, frac = ""] = amount.trim().replace(",", ".").split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export function fromCents(cents: bigint): string {
  const sign = cents < 0n ? "-" : "";
  const abs = cents < 0n ? -cents : cents;
  return `${sign}${abs / 100n}.${String(abs % 100n).padStart(2, "0")}`;
}

export function multiply(amount: string, quantity: number): string {
  return fromCents(toCents(amount) * BigInt(quantity));
}

export function sum(amounts: string[]): string {
  return fromCents(amounts.reduce((acc, a) => acc + toCents(a), 0n));
}
