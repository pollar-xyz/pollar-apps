"use client";

import { useEffect } from "react";
import { usePollar } from "@pollar/react";
import { PollarLogo } from "@/components/ui/PollarLogo";
import { useBalance } from "@/hooks/useBalance";
import { formatAmount } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";

const CIRCLE_TESTNET_FAUCET = "https://faucet.circle.com";

/**
 * The wallet card: the app's USDC balance on a branded Pollar-blue card -
 * this app charges in USDC, never XLM, so that is the number that matters
 * here. When there is nothing to pay with yet (no trustline, or "0"), the
 * only unblocking step is Circle's testnet faucet: Nirium's facilitator
 * sponsors the network fee, so XLM is never the thing missing.
 */
export function BalanceCard() {
  const { balance, isLoading, error, needsUsdc, refresh } = useBalance();
  const { isAuthenticated, wallet, tx } = usePollar();
  const { t } = useLanguage();

  // `tx` is the SDK's global transaction state machine, so this catches every
  // payment made anywhere in the app (PayButton, Pollar's send modal, …).
  // 'submitted' covers payments the network accepted but hasn't confirmed yet.
  useEffect(() => {
    if (tx.step === "success" || tx.step === "submitted") {
      void refresh();
    }
  }, [tx.step, refresh]);

  if (!isAuthenticated) return null;

  return (
    <section className="relative w-full overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-md">
      {/* subtle brand watermark */}
      <div className="pointer-events-none absolute -right-4 -bottom-6">
        <PollarLogo size={120} colorClass="bg-primary-foreground/10" />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-primary-foreground/75">
          {t("balance.label")}
        </span>
        <button
          onClick={() => void refresh()}
          disabled={isLoading}
          className="text-sm font-semibold text-primary-foreground/75 transition-colors hover:text-primary-foreground disabled:opacity-50"
        >
          {t("balance.refresh")}
        </button>
      </div>

      {error ? (
        <p className="mt-3 max-w-[85%] text-sm leading-6 text-primary-foreground/90">
          {error}
        </p>
      ) : isLoading && balance === null ? (
        <div className="mt-3 h-11 w-40 animate-pulse rounded-xl bg-primary-foreground/20" />
      ) : (
        <>
          <p
            className="mt-2 font-mono text-5xl font-semibold tabular-nums tracking-tight"
            title={balance ?? undefined}
          >
            {formatAmount(balance ?? "0")}
            <span className="ml-2 text-lg font-normal text-primary-foreground/75">
              USDC
            </span>
          </p>

          {needsUsdc && (
            <div className="relative mt-4 flex flex-col items-start gap-2">
              <a
                href={CIRCLE_TESTNET_FAUCET}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-primary-foreground px-4 py-2 text-sm font-semibold text-primary transition-opacity hover:opacity-90"
              >
                {t("balance.fundCta")}
              </a>
              <p className="max-w-full text-xs leading-5 text-primary-foreground/80">
                {t("balance.noXlmNeeded")}
                {wallet?.address && (
                  <span className="mt-1 block break-all font-mono">{wallet.address}</span>
                )}
              </p>
            </div>
          )}
        </>
      )}
    </section>
  );
}
