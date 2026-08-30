"use client";

import type { PollarClient } from "@pollar/core";
import { authMessage, POLLAR_PROOF_HEADER } from "./auth-message.ts";

type CachedProof = { address: string; exp: number; signature: string };

const cache = new Map<string, CachedProof>();
const PROOF_TTL_MS = 4 * 60 * 1000; // under the server's 10-minute MAX_TTL_MS

async function proofFor(client: PollarClient, address: string): Promise<CachedProof> {
  const hit = cache.get(address);
  if (hit && hit.exp - 30_000 > Date.now()) return hit;

  const exp = Date.now() + PROOF_TTL_MS;
  const message = authMessage(address, exp);
  const signed = await client.stellar.sep53.signMessage(message);
  if (signed.status !== "signed") {
    throw new Error(signed.details ?? "No se pudo firmar la sesión Pollar");
  }

  const proof: CachedProof = { address: signed.signerAddress || address, exp, signature: signed.signature };
  cache.set(address, proof);
  return proof;
}

/** `fetch()` that attaches a SEP-53 proof of the logged-in Pollar address for our own API routes. */
export async function pollarFetch(
  client: PollarClient,
  address: string,
  input: string,
  init: RequestInit = {}
): Promise<Response> {
  const proof = await proofFor(client, address);
  const headers = new Headers(init.headers);
  headers.set(POLLAR_PROOF_HEADER, JSON.stringify(proof));
  headers.set("Content-Type", "application/json");
  return fetch(input, { ...init, headers });
}
