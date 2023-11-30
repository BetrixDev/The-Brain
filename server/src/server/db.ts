import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { drizzle, BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { env } from "src/env";
import { desc, eq, or, asc, sql } from "drizzle-orm";
import { fuse } from "./fuse";

const SORTING_FUNC = {
  desc,
  asc,
} as const;

const sqlite = new Database(env.DATABASE_LOCATION);

export const db: BetterSQLite3Database = drizzle(sqlite);

export const storedItems = sqliteTable(
  "stored_items",
  {
    fingerprint: text("fingerprint").primaryKey(),
    itemId: text("item_id").notNull(),
    modId: text("mod_id").notNull(),
    amount: integer("amount").notNull(),
    lastModified: integer("last_modified")
      .$defaultFn(() => Date.now())
      .notNull(),
    isCraftable: integer("is_craftable", { mode: "boolean" })
      .default(false)
      .notNull(),
  },
  (table) => {
    return {
      fingerprintIdx: uniqueIndex("fingerprint_index").on(table.fingerprint),
    };
  }
);

export const itemAssets = sqliteTable("item_assets", {
  itemId: text("item_id").primaryKey(),
  displayName: text("display_name").notNull(),
  modId: text("mod_id")
    .notNull()
    .references(() => modAssets.modId),
  texture64: text("texture_64"),
});

export const modAssets = sqliteTable("mod_assets", {
  modId: text("mod_id").primaryKey(),
  displayName: text("display_name"),
  texture64: text("texture_64"),
  jarFile: text("jar_file").notNull(),
});

export const chatMessages = sqliteTable("chat_messages", {
  _id: integer("_id").primaryKey({ autoIncrement: true }),
  datePosted: integer("date_posted")
    .notNull()
    .$defaultFn(() => Date.now()),
  source: text("source").notNull().$type<"web" | "mc">(),
  uuid: text("uuid"),
  displayName: text("display_name").notNull(),
  content: text("content").notNull(),
});

export const itemLimits = sqliteTable("item_limits", {
  fingerprint: text("fingerprint").primaryKey(),
  min: integer("min"),
  max: integer("max"),
  dateCreated: integer("date_created")
    .notNull()
    .$defaultFn(() => Date.now()),
});

export async function getStoredItems({
  limit = 25,
  cursor = 1,
  searchQuery,
  sortingVariable = "amount",
  sortingDirection = "desc",
}: {
  limit: number;
  cursor: number;
  searchQuery?: string;
  sortingVariable?: "amount" | "lastModified";
  sortingDirection: "desc" | "asc";
}) {
  if (searchQuery === undefined) {
    const [meta] = await db
      .select({ totalRowCount: sql<number>`count(*)` })
      .from(storedItems)
      .execute();

    const results = await db
      .select({
        fingerprint: storedItems.fingerprint,
        itemId: storedItems.itemId,
        amount: storedItems.amount,
        lastModified: storedItems.lastModified,
        displayName: itemAssets.displayName,
        isCraftable: storedItems.isCraftable,
        mod: {
          id: modAssets.modId,
          displayName: modAssets.displayName,
        },
      })
      .from(storedItems)
      .innerJoin(itemAssets, eq(storedItems.itemId, itemAssets.itemId))
      .innerJoin(modAssets, eq(itemAssets.modId, modAssets.modId))
      .orderBy(SORTING_FUNC[sortingDirection](storedItems[sortingVariable]))
      .offset((cursor - 1) * limit)
      .limit(limit)
      .execute();

    const data = await Promise.all(
      results.map(async (result) => {
        const limits = await db
          .select({
            min: itemLimits.min,
            max: itemLimits.max,
          })
          .from(itemLimits)
          .where(eq(itemLimits.fingerprint, result.fingerprint));

        return {
          ...result,
          limits: limits.at(0),
        };
      })
    );

    return {
      data,
      meta,
    };
  } else {
    const searchResults = fuse.search(searchQuery);

    const results = await db
      .select({
        fingerprint: storedItems.fingerprint,
        itemId: storedItems.itemId,
        amount: storedItems.amount,
        lastModified: storedItems.lastModified,
        displayName: itemAssets.displayName,
        isCraftable: storedItems.isCraftable,
        mod: {
          id: modAssets.modId,
          displayName: modAssets.displayName,
        },
      })
      .from(storedItems)
      .where(
        or(
          ...searchResults
            .slice(0, 25)
            .map(({ item }) => eq(storedItems.itemId, item.itemId))
        )
      )
      .innerJoin(itemAssets, eq(storedItems.itemId, itemAssets.itemId))
      .innerJoin(modAssets, eq(itemAssets.modId, modAssets.modId))
      .orderBy(SORTING_FUNC[sortingDirection](storedItems[sortingVariable]))
      .offset((cursor - 1) * limit)
      .limit(limit);

    const data = await Promise.all(
      results.map(async (result) => {
        const limits = await db
          .select({
            min: itemLimits.min,
            max: itemLimits.max,
          })
          .from(itemLimits)
          .where(eq(itemLimits.fingerprint, result.fingerprint));

        return {
          ...result,
          limits: limits.at(0),
        };
      })
    );

    return {
      data,
      meta: {
        totalRowCount: searchResults.length,
      },
    };
  }
}
