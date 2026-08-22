import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * Where the database lives.
 *
 * Unset (a fresh clone) means a local SQLite file, so `pnpm install && pnpm
 * dev` works with nothing configured but the Pollar key — an acceptance
 * criterion of the bounty. A deploy sets DATABASE_URL to a libSQL/Turso URL
 * instead, because a serverless filesystem is ephemeral.
 */
export const DATABASE_URL = process.env.DATABASE_URL ?? "file:./data/qr-menu.db";
export const DATABASE_AUTH_TOKEN = process.env.DATABASE_AUTH_TOKEN;

/** A local file DB can be migrated on boot; a remote one is migrated on deploy. */
export const IS_LOCAL_FILE_DB = DATABASE_URL.startsWith("file:");

/**
 * libSQL opens a file: URL but won't create the directory holding it, and a
 * missing directory surfaces as a bare "code 14". Both the app and
 * drizzle-kit call this before connecting.
 */
export function ensureLocalDbDir(): void {
  if (!IS_LOCAL_FILE_DB) return;
  mkdirSync(dirname(DATABASE_URL.replace(/^file:/, "")), { recursive: true });
}
