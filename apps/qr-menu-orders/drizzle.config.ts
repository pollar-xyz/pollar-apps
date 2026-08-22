import type { Config } from "drizzle-kit";
import { DATABASE_AUTH_TOKEN, DATABASE_URL, ensureLocalDbDir } from "./db/url";

ensureLocalDbDir();

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "turso",
  dbCredentials: { url: DATABASE_URL, authToken: DATABASE_AUTH_TOKEN },
} satisfies Config;
