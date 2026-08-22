import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import {
  DATABASE_AUTH_TOKEN,
  DATABASE_URL,
  ensureLocalDbDir,
  IS_LOCAL_FILE_DB,
} from "./url";

/**
 * One database handle for the process, kept on globalThis so Next's dev
 * hot-reload doesn't open a new connection on every edit.
 */
const globalDb = globalThis as {
  __db?: ReturnType<typeof drizzle<typeof schema>>;
  __dbReady?: Promise<void>;
};

function create() {
  ensureLocalDbDir();
  const client = createClient({
    url: DATABASE_URL,
    authToken: DATABASE_AUTH_TOKEN,
  });
  return drizzle(client, { schema });
}

export const db = (globalDb.__db ??= create());

/**
 * Applies pending migrations. Awaited by every route that touches the
 * database, so a fresh clone needs no setup step: the file and its tables
 * appear on the first request.
 *
 * A remote database is migrated at deploy time (`pnpm db:migrate`) instead —
 * running migrations from a serverless request would race across instances.
 */
export function dbReady(): Promise<void> {
  if (!IS_LOCAL_FILE_DB) return Promise.resolve();

  // A serverless filesystem is read-only and ephemeral, so a file: URL there
  // fails deep inside the driver with an opaque code. Checked here rather
  // than at import time: `next build` also runs with NODE_ENV=production,
  // and the database is a runtime concern, not a build-time one.
  if (process.env.NODE_ENV === "production") {
    return Promise.reject(
      new Error(
        "DATABASE_URL is not set, so the app fell back to a local SQLite file — " +
          "which cannot work in production, where the filesystem is read-only. " +
          "Set DATABASE_URL (and DATABASE_AUTH_TOKEN) to a libSQL/Turso database."
      )
    );
  }

  return (globalDb.__dbReady ??= migrate(db, {
    migrationsFolder: "./db/migrations",
  }));
}

export { schema };
