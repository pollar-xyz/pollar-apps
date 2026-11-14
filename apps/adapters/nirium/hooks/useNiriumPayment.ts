"use client";

import { useCallback, useState } from "react";
import { usePollar } from "@pollar/react";
import { fetchNiriumMarket, type NiriumMarketResult } from "@/lib/nirium";
import { useBalance } from "@/hooks/useBalance";
import { classifyPollarError, type PollarErrorGuidance } from "@/lib/pollarErrors";

export type NiriumPaymentState =
  | { status: "idle" }
  | { status: "paying" }
  | ({ status: "success" } & NiriumMarketResult)
  | { status: "error"; message: string; guidance: PollarErrorGuidance | null };

/**
 * Pays for and fetches one market-state read from Nirium's x402 endpoint
 * through the logged-in Pollar wallet. Not wired through PayButton/SendModal:
 * x402 is a Soroban auth-entry signature (PollarClient.signAuthEntry), a
 * different SDK primitive from the classic runTx('payment', …) those
 * components use.
 */
export function useNiriumPayment(): {
  state: NiriumPaymentState;
  pay: () => Promise<void>;
} {
  const { getClient } = usePollar();
  const { refresh: refreshBalance } = useBalance();
  const [state, setState] = useState<NiriumPaymentState>({ status: "idle" });

  const pay = useCallback(async () => {
    setState({ status: "paying" });
    try {
      const result = await fetchNiriumMarket(getClient());
      setState({ status: "success", ...result });
      // The x402 payment never touches the SDK's own `tx` state machine
      // (BalanceCard's auto-refresh watches that), so refresh explicitly.
      void refreshBalance();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState({ status: "error", message, guidance: classifyPollarError(message) });
    }
  }, [getClient, refreshBalance]);

  return { state, pay };
}
