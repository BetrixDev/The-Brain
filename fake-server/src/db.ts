import Database from "better-sqlite3";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { env } from "./env";
import { randomUUID } from "crypto";
import { BetterSQLite3Database, drizzle } from "drizzle-orm/better-sqlite3";

const sqlite = new Database(env.DATABASE_LOCATION);

export const db: BetterSQLite3Database = drizzle(sqlite);

export const items = sqliteTable("items", {
  id: text("id").notNull(),
  modId: text("mod_id").notNull(),
});

export const craftingQueue = sqliteTable("crafting_queue", {
  fingerprint: text("fingerprint").primaryKey(),
  amount: integer("amount").notNull(),
});

export const fakeStoredItems = sqliteTable("fake_stored_items", {
  id: text("id").notNull(),
  amount: integer("amount").notNull(),
  fingerprint: text("fingerprint")
    .primaryKey()
    .$defaultFn(() => randomUUID()),
  isCraftable: integer("is_craftable", { mode: "boolean" }).notNull(),
});

export const itemLimits = sqliteTable("item_limits", {
  fingerprint: text("fingerprint")
    .primaryKey()
    .references(() => fakeStoredItems.fingerprint),
  min: integer("min"),
  max: integer("max"),
});
