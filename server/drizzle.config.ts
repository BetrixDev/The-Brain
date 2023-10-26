import type { Config } from "drizzle-kit";

export default {
  schema: "./src/server/db.ts",
  out: "./drizzle",
  driver: "better-sqlite",
  dbCredentials: { url: "brain.sqlite" },
} satisfies Config;
