import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db.ts",
  out: "./drizzle",
  driver: "better-sqlite",
  dbCredentials: { url: "fake.db" },
} satisfies Config;
