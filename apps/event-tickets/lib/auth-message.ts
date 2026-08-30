/** Shared between client (signs) and server (verifies) — no server-only or browser-only imports here. */

export const POLLAR_PROOF_HEADER = "x-pollar-proof";

export function authMessage(address: string, exp: number): string {
  return `pollarpass-auth:${address}:${exp}`;
}
