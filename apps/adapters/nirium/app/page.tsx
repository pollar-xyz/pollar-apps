"use client";

import { BalanceCard } from "@/components/BalanceCard";
import { LoginButton } from "@/components/LoginButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { BrandHeader } from "@/components/ui/BrandHeader";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { middleTruncate } from "@/lib/format";
import { NIRIUM_TESTNET_ENDPOINT } from "@/lib/nirium";
import { useLanguage } from "@/lib/i18n";
import { usePollarAuth } from "@/hooks/usePollarAuth";
import { useNiriumPayment } from "@/hooks/useNiriumPayment";

/**
 * Nirium pays for its own API calls per-request over x402 (HTTP 402):
 * every call to this endpoint costs $0.05 USDC, settled on Stellar testnet
 * before the response is returned. This screen pays for and shows one call,
 * with a logged-in Pollar wallet doing the signing — no XLM needed, the
 * facilitator sponsors the network fee and Pollar sponsors the trustline.
 */
export default function Home() {
  const { user } = usePollarAuth();
  const { state, pay } = useNiriumPayment();
  const { t } = useLanguage();

  if (!user) {
    return (
      <main className="relative flex flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
        <div className="absolute right-4 top-4 flex items-center gap-2 sm:right-6 sm:top-6">
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="flex flex-col items-center gap-5 text-center">
          <BrandHeader size={64} />
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            {t("hero.title")}
            <span className="block text-primary">{t("hero.subtitle")}</span>
          </h1>
          <p className="max-w-sm text-lg leading-8 text-muted">
            {t("hero.body")}
          </p>
        </div>
        <LoginButton />
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-6 lg:max-w-lg lg:py-10">
      {/* flex-1 + justify-center: on a wide/tall viewport this block was
          anchored to the top with a large empty area below it (the one part
          of the page that read as "not centered") while the footer stayed
          pinned. Centering just this group, not <main> itself, keeps the
          footer where it belongs without an auto-margin fighting it. */}
      <div className="flex flex-1 flex-col justify-center gap-4">
        <header className="flex items-center justify-between gap-3 py-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <BrandHeader size={30} />
            <h1 className="hidden min-w-0 truncate text-xl font-bold tracking-tight sm:block">
              {t("header.title")}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
            <LoginButton />
          </div>
        </header>

        <BalanceCard />

        <Card className="flex flex-col gap-4">
          <div>
            <h2 className="font-semibold">{t("card.title")}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {t("card.body")}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-light">
              GET {NIRIUM_TESTNET_ENDPOINT}
            </p>
          </div>

          <Button
            onClick={() => void pay()}
            loading={state.status === "paying"}
          >
            {state.status === "paying" ? t("card.paying") : t("card.payLabel")}
          </Button>

          {state.status === "error" && (
            <div className="rounded-xl border border-error-border bg-error-light px-4 py-3 text-sm text-error">
              {state.guidance ? (
                <>
                  <p className="font-semibold">{state.guidance.code}</p>
                  <p className="mt-1 leading-6">{state.guidance.cause}</p>
                  <p className="mt-1 leading-6">{state.guidance.fix}</p>
                </>
              ) : (
                <>
                  <p className="font-semibold">{t("error.genericTitle")}</p>
                  <p className="mt-1 leading-6">{state.message}</p>
                </>
              )}
            </div>
          )}

          {state.status === "success" && (
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
              <div>
                <span className="text-sm font-medium text-muted">
                  {t("result.title")}
                </span>
                <p className="mt-1 text-sm leading-6">
                  {t("result.body")}
                </p>
              </div>

              {state.txHash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${state.txHash}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                >
                  {middleTruncate(state.txHash, 10, 8)} ↗
                </a>
              )}

              {state.cid && (
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-muted">{t("result.anchoredLabel")}</span>
                  <a
                    href={`https://nirium.xyz/verify?cid=${encodeURIComponent(state.cid)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    {t("result.verifyLink")} ↗
                  </a>
                </div>
              )}

              <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-xs leading-5">
                {JSON.stringify(state.data, null, 2)}
              </pre>
            </div>
          )}
        </Card>
      </div>

      <p className="pt-4 text-center text-xs text-muted-light">
        {t("footer.poweredBy")}{" "}
        <a
          href="https://www.npmjs.com/package/nirium-pollar-adapter"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          nirium-pollar-adapter
        </a>
        . {t("footer.disclaimer")}
      </p>
    </main>
  );
}
