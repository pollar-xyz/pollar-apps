"use client";

import { useEffect, useRef } from "react";
import { usePollar } from "@pollar/react";
import type { WalletBalanceRecord } from "@pollar/core";

/**
 * This app charges in USDC, never XLM: showing "the first app-enabled
 * asset" (whatever that happens to be) made a brand-new wallet's native XLM
 * balance look like the balance that matters, when it is not what the pay
 * button spends. `null` means no USDC trustline/record exists at all yet -
 * the same "nothing to pay with" state as a trustline that holds "0".
 */
function usdcRecord(balances: WalletBalanceRecord[]): WalletBalanceRecord | null {
  return balances.find((b) => b.code === "USDC") ?? null;
}

/**
 * Balance of the logged-in user, auto-fetched on login. Backed by the SDK's
 * shared `walletBalance` state: every component using this hook re-renders
 * when any of them calls `refresh()`.
 */
export function useBalance(): {
  /** Decimal string (e.g. "12.5000000"), null until loaded. */
  balance: string | null;
  /** Asset code of the balance shown, e.g. "USDC" or "XLM". */
  currency: string | null;
  /** The full balance record (type, issuer, available amount…). */
  asset: WalletBalanceRecord | null;
  /**
   * `true` when there is no USDC to pay with yet: no trustline/record at
   * all, or one that holds exactly "0". `null` while still loading.
   */
  needsUsdc: boolean | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const { isAuthenticated, verified, walletBalance, refreshWalletBalance } =
    usePollar();
  const retriedAfterVerify = useRef(false);

  // Wait for `verified`: right after a reload the session is restored
  // optimistically with a possibly stale token, and fetching then earns a
  // (harmless but noisy) 401 before the SDK refreshes and retries.
  useEffect(() => {
    if (!isAuthenticated || !verified) return;
    if (walletBalance.step === "idle") {
      void refreshWalletBalance();
    } else if (walletBalance.step === "error" && !retriedAfterVerify.current) {
      // A fetch that raced the re-validation may have failed; retry once.
      retriedAfterVerify.current = true;
      void refreshWalletBalance();
    }
  }, [isAuthenticated, verified, walletBalance.step, refreshWalletBalance]);

  const asset =
    walletBalance.step === "loaded"
      ? usdcRecord(walletBalance.data.balances)
      : null;

  return {
    balance: asset?.balance ?? null,
    currency: asset?.code ?? null,
    asset,
    needsUsdc:
      walletBalance.step !== "loaded" ? null : Number(asset?.balance ?? "0") <= 0,
    isLoading:
      walletBalance.step === "loading" ||
      (isAuthenticated && walletBalance.step === "idle"),
    error: walletBalance.step === "error" ? walletBalance.message : null,
    refresh: refreshWalletBalance,
  };
}
