import { toCents, fromCents } from "@/lib/money";

/**
 * Money, the way a customer reads it.
 *
 * Amounts are settled in USDC, but nobody at a table thinks in tokens: they
 * think in dollars. So the number carries a `$`, and the coin mark says which
 * dollar it is — shown where the currency itself matters (a balance, a total,
 * a receipt) and left off the menu rows, where repeating it on every dish is
 * just noise.
 */

export function formatMoney(amount: string): string {
  return `$${fromCents(toCents(amount))}`;
}

/** The coin, as inline SVG: no image request, scales with the text. */
export function CoinMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
      style={{ width: "1em", height: "1em" }}
    >
      <circle cx="12" cy="12" r="11" fill="var(--usdc)" />
      <path
        d="M12 5.4v1.1m0 11v1.1M12 6.5c-2 0-3.2.9-3.2 2.3 0 1.3 1 1.9 2.6 2.3l1.2.3c1.6.4 2.6 1 2.6 2.3 0 1.4-1.2 2.3-3.2 2.3s-3.2-.9-3.3-2.2m6.5-5.1c-.1-1.3-1.3-2.2-3.3-2.2"
        stroke="#ffffff"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** An amount with its currency: `◎ $3.50`. */
export function Money({
  amount,
  withCoin = false,
  className = "",
}: {
  amount: string;
  withCoin?: boolean;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-baseline gap-1.5 font-mono tabular-nums ${className}`}>
      {withCoin && <CoinMark className="self-center" />}
      {formatMoney(amount)}
    </span>
  );
}
