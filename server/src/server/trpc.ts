import { TRPCError, initTRPC } from "@trpc/server";
import {
  db,
  getStoredItems,
  itemAssets,
  itemLimits,
  modAssets,
  storedItems,
} from "./db";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { io } from "./io";
import { events } from "./event-emitter";

const t = initTRPC.create();

export const appRouter = t.router({
  storedItems: t.procedure
    .input(
      z
        .object({
          searchQuery: z.string().optional(),
          limit: z.number().default(25),
          sortingVariable: z
            .union([z.literal("amount"), z.literal("lastModified")])
            .default("amount"),
          sortingDirection: z
            .union([z.literal("asc"), z.literal("desc")])
            .default("desc"),
          cursor: z.number().default(1),
        })
        .default({})
    )
    .query(async ({ input }) => {
      return getStoredItems(input);
    }),
  totalUniqueStoredItems: t.procedure.query(async () => {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(storedItems)
      .execute();

    if (result.length === 0) return null;

    return result[0].count;
  }),
  totalStoredItems: t.procedure.query(async () => {
    const result = await db
      .select({ sum: sql<number>`sum(${storedItems.amount})` })
      .from(storedItems);

    if (result.length === 0) return null;

    return result[0].sum;
  }),
  individualItemData: t.procedure
    .input(z.object({ itemId: z.string(), modId: z.string() }))
    .query(async ({ input }) => {
      const result = await db
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
          limits: {
            min: itemLimits.min,
            max: itemLimits.max,
          },
        })
        .from(storedItems)
        .where(
          and(
            eq(storedItems.itemId, input.itemId),
            eq(storedItems.modId, input.modId)
          )
        )
        .leftJoin(
          itemLimits,
          eq(storedItems.fingerprint, itemLimits.fingerprint)
        )
        .innerJoin(itemAssets, eq(storedItems.itemId, itemAssets.itemId))
        .innerJoin(modAssets, eq(itemAssets.modId, modAssets.modId))
        .limit(1)
        .execute();

      return result[0];
    }),
  tryCraftItem: t.procedure
    .input(
      z.object({
        itemId: z.string(),
        modId: z.string(),
        amount: z.number().default(1),
      })
    )
    .mutation(({ input }) => {
      events.emit("sendCraftItem", input.itemId, input.modId, input.amount);
    }),
  updateItemLimits: t.procedure
    .input(
      z.object({
        fingerprint: z.string(),
        min: z.number().optional(),
        max: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      console.log(input);

      let error: string | undefined;

      if (input.min !== undefined && input.max !== undefined) {
        if (input.max < input.min) {
          error = "Max limit must not be less than the min limit";
        } else if (input.max === input.min) {
          error = "Max limit must not equal the min limit";
        }
      }

      if (error !== undefined) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error });
      }

      const existingLimit = await db
        .select()
        .from(itemLimits)
        .where(eq(itemLimits.fingerprint, input.fingerprint))
        .limit(1)
        .execute();

      if (existingLimit.at(0) === undefined) {
        if (input.min === undefined && input.max === undefined) {
          await db
            .delete(itemLimits)
            .where(eq(itemLimits.fingerprint, input.fingerprint));
        } else {
          await db.insert(itemLimits).values({
            fingerprint: input.fingerprint,
            min: input.min,
            max: input.max,
          });
        }
      } else {
        await db
          .update(itemLimits)
          .set({ min: input.min, max: input.max })
          .where(eq(itemLimits.fingerprint, input.fingerprint))
          .execute();
      }

      io.emit("updateItems");

      events.emit("updateLimits", input.fingerprint, {
        max: input.max,
        min: input.min,
      });

      return true;
    }),
  resetItemLimit: t.procedure
    .input(z.object({ fingerprint: z.string() }))
    .mutation(async ({ input }) => {
      await db
        .delete(itemLimits)
        .where(eq(itemLimits.fingerprint, input.fingerprint))
        .execute();

      io.emit("updateItems");
    }),
});

export type AppRouter = typeof appRouter;
