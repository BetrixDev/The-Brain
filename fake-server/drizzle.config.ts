import type { Config } from "drizzle-kit";
import { env } from "./src/env";

export default {
  schema: "./src/db.ts",
  out: "./drizzle",
  driver: "better-sqlite",
  dbCredentials: { url: env.DATABASE_LOCATION },
} satisfies Config;
