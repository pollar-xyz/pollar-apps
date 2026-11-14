/**
 * Maps a thrown payment error to the guidance from Pollar's own
 * troubleshooting table (docs.pollar.xyz/docs/guides/x402-payments and
 * docs.pollar.xyz/docs/sdk-reference/error-codes).
 *
 * The installed SDK (@pollar/core 0.12.0) does not expose a stable `.code`
 * for a signAuthEntry rejection on the custodial path: `PollarClient`
 * extracts only the server's human `details` string before returning
 * `{status: 'error', details}` (nirium-pollar-adapter then wraps that into
 * a plain `Error`), so matching has to go by message content. Each pattern
 * below is the literal cause text from Pollar's table (or, for
 * SDK_CONFIRMATION_UNAVAILABLE, the exact string `@pollar/core` hardcodes
 * for it) — not a guess at wording.
 */

export interface PollarErrorGuidance {
  code: string;
  cause: string;
  fix: string;
}

const PATTERNS: { test: RegExp; code: string; cause: string; fix: string }[] = [
  {
    test: /no signing rules|signing rules rows/i,
    code: "SOROBAN_AUTH_NO_POLICY",
    cause: "The Pollar application has no Signing rules row for this asset yet.",
    fix: "Add a USDC row in dashboard.pollar.xyz, and check the API key belongs to the right application.",
  },
  {
    test: /does not name|function not allowed/i,
    code: "SOROBAN_AUTH_FUNCTION_NOT_ALLOWED",
    cause: "The Signing rules row does not name \"transfer\".",
    fix: "In dashboard.pollar.xyz, set the allowed function to \"transfer\" (lowercase).",
  },
  {
    test: /contract.*not allowed/i,
    code: "SOROBAN_AUTH_CONTRACT_NOT_ALLOWED",
    cause: "The asset contract does not match the server's 402 requirements.",
    fix: "Check the asset/contract configured in the Signing rules row against what the server asked for.",
  },
  {
    test: /mount PollarProvider|nothing shows the prompt|confirmation is 'prompt'/i,
    code: "SDK_CONFIRMATION_UNAVAILABLE",
    cause: "The application asks before every signature, and nothing is listening for the prompt.",
    fix: "Mount PollarProvider, subscribe with onConfirmationRequest, or set confirmation to \"Never ask\" or \"Ask, then remember for a while\".",
  },
  {
    test: /declined the payment|user declined/i,
    code: "SDK_CONFIRMATION_DECLINED",
    cause: "You declined the payment in the confirmation prompt.",
    fix: "Nothing was signed or charged - try again when ready.",
  },
  {
    test: /recovery/i,
    code: "SDK_WALLET_RECOVERY_REQUIRED",
    cause: "This wallet needs recovery set up before it can sign.",
    fix: "Set up wallet recovery first, then retry the payment.",
  },
];

export function classifyPollarError(message: string): PollarErrorGuidance | null {
  for (const p of PATTERNS) {
    if (p.test.test(message)) return { code: p.code, cause: p.cause, fix: p.fix };
  }
  return null;
}
