"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type Lang = "en" | "es";

const STORAGE_KEY = "nirium-demo-lang";

const dict = {
  en: {
    "hero.title": "Nirium x402 adapter",
    "hero.subtitle": "pay-per-call, live",
    "hero.body":
      "Log in with Pollar, then pay $0.05 USDC for one real API call to Nirium: no XLM, no wallet setup, no seed phrase.",
    "header.title": "Nirium x402 adapter",
    "card.title": "Pay for live market state",
    "card.body":
      "One request to Nirium's public x402 endpoint. $0.05 USDC, settled before the response comes back.",
    "card.payLabel": "Pay $0.05 & fetch",
    "card.paying": "Paying…",
    "result.title": "What just happened",
    "result.body":
      "Pollar signed a Soroban auth entry authorizing $0.05 USDC. Nirium's facilitator verified and settled it, then returned the market state below. Reference rates are attributed to their source, not investment advice.",
    "result.anchoredLabel": "Audit anchor",
    "result.verifyLink": "Verify independently",
    "footer.poweredBy": "Powered by",
    "footer.disclaimer": "Testnet: payments are real and verifiable, the money is not.",
    "login.connecting": "Connecting…",
    "login.button": "Log in with Pollar",
    "login.accountLabel": "Account",
    "balance.label": "Balance",
    "balance.refresh": "Refresh",
    "balance.fundCta": "Get testnet USDC",
    "balance.noXlmNeeded": "You don't need XLM to pay: Nirium's facilitator sponsors the network fee.",
    "account.title": "Account",
    "account.email": "Email",
    "account.wallet": "Wallet",
    "account.copied": "Copied ✓",
    "account.logout": "Log out",
    "error.genericTitle": "Payment failed",
  },
  es: {
    "hero.title": "Adaptador x402 de Nirium",
    "hero.subtitle": "pago por llamada, en vivo",
    "hero.body":
      "Inicia sesión con Pollar y paga $0.05 USDC por una llamada real a la API de Nirium: sin XLM, sin configurar wallet, sin frase semilla.",
    "header.title": "Adaptador x402 de Nirium",
    "card.title": "Paga por el estado del mercado en vivo",
    "card.body":
      "Una petición al endpoint público x402 de Nirium. $0.05 USDC, liquidados antes de recibir la respuesta.",
    "card.payLabel": "Pagar $0.05 y consultar",
    "card.paying": "Pagando…",
    "result.title": "Qué acaba de pasar",
    "result.body":
      "Pollar firmó una autorización Soroban por $0.05 USDC. El facilitador de Nirium la verificó y liquidó, y devolvió el estado del mercado de abajo. Las tasas de referencia están atribuidas a su fuente, no es asesoría de inversión.",
    "result.anchoredLabel": "Anclaje de auditoría",
    "result.verifyLink": "Verificar de forma independiente",
    "footer.poweredBy": "Con tecnología de",
    "footer.disclaimer": "Testnet: los pagos son reales y verificables, el dinero no.",
    "login.connecting": "Conectando…",
    "login.button": "Iniciar sesión con Pollar",
    "login.accountLabel": "Cuenta",
    "balance.label": "Saldo",
    "balance.refresh": "Actualizar",
    "balance.fundCta": "Conseguir USDC de testnet",
    "balance.noXlmNeeded": "No necesitas XLM para pagar: el facilitador de Nirium patrocina el fee de red.",
    "account.title": "Cuenta",
    "account.email": "Correo",
    "account.wallet": "Wallet",
    "account.copied": "Copiado ✓",
    "account.logout": "Cerrar sesión",
    "error.genericTitle": "El pago falló",
  },
} as const;

export type TranslationKey = keyof (typeof dict)["en"];

const LanguageContext = createContext<{
  lang: Lang;
  t: (key: TranslationKey) => string;
  toggle: () => void;
} | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Server-rendered default is always "en" to avoid a hydration mismatch;
  // the effect below syncs to the visitor's stored/browser preference
  // right after mount, same tradeoff Nirium's own site's LanguageContext
  // makes (a brief English flash beats a hydration error).
  const [lang, setLang] = useState<Lang>("en");

  useEffect(() => {
    // One-time sync from localStorage/navigator into React state right after
    // mount — there's no SSR-safe way to read either before the client
    // exists, so this single post-mount setState is the tradeoff, not an
    // accidental cascade (eslint-disable is intentional, not a workaround).
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "en" || stored === "es") {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLang(stored);
        return;
      }
    } catch {
      // Private browsing / storage disabled — fall through to browser language.
    }
    if (navigator.language?.toLowerCase().startsWith("es")) {
      setLang("es");
    }
  }, []);

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "en" ? "es" : "en";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Private browsing / storage disabled — choice just won't persist.
      }
      return next;
    });
  }, []);

  const t = useCallback((key: TranslationKey) => dict[lang][key], [lang]);

  return (
    <LanguageContext.Provider value={{ lang, t, toggle }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
