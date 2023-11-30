import WebSocket from "ws";
import type { BackendWebSocketPayload, StoredItemsPayload } from "typings";
import { schedule } from "node-cron";
import { db, fakeStoredItems, itemLimits, items } from "./db";
import { faker } from "@faker-js/faker";
import { sql, eq, lte } from "drizzle-orm";
import ReconnectingWebSocket from "reconnecting-websocket";

const ws = new ReconnectingWebSocket("ws://localhost:1001", [], {
  minReconnectionDelay: 250,
  maxReconnectionDelay: 500,
  WebSocket,
});

ws.addEventListener("message", (event) => {
  const payload = JSON.parse(event.data) as BackendWebSocketPayload;

  if (payload.type === "setLimit") {
    db.transaction(async (tx) => {
      const [existingLimit] = await tx
        .select()
        .from(itemLimits)
        .where(eq(itemLimits.fingerprint, payload.fingerprint))
        .execute();

      if (existingLimit !== undefined) {
        await tx
          .update(itemLimits)
          .set({ max: payload.max, min: payload.min })
          .where(eq(itemLimits.fingerprint, payload.fingerprint))
          .execute();
      } else {
        await tx.insert(itemLimits).values({
          fingerprint: payload.fingerprint,
          max: payload.max,
          min: payload.min,
        });
      }
    });
  } else if (payload.type === "craftItem") {
    db.update(fakeStoredItems)
      .set({
        amount: sql`${fakeStoredItems.amount} + ${payload.amount}`,
      })
      .where(eq(fakeStoredItems.id, `${payload.modId}:${payload.itemId}`))
      .execute();
  }
});

schedule("*/1 * * * * *", async () => {
  const storedItems = await db.select().from(fakeStoredItems).execute();

  ws.send(
    JSON.stringify({
      type: "storedItems",
      data: storedItems,
    } satisfies StoredItemsPayload)
  );
});

schedule("*/2 * * * * *", async () => {
  const [{ totalPossibleItems }] = await db
    .select({ totalPossibleItems: sql<number>`count(*)` })
    .from(items)
    .execute();

  const [{ totalFakeStoredItems }] = await db
    .select({ totalFakeStoredItems: sql<number>`count(*)` })
    .from(fakeStoredItems)
    .execute();

  const numberOfItemsToChange = faker.number.int({
    min: 10,
    max: Math.max(Math.round(totalPossibleItems / 500), 15),
  });

  const shouldAddMoreItems = totalFakeStoredItems < 500;

  for (let i = 0; i < numberOfItemsToChange; i++) {
    const itemOffset = faker.number.int({
      min: 0,
      max: shouldAddMoreItems ? totalPossibleItems : totalFakeStoredItems,
    });

    if (shouldAddMoreItems) {
      await db.transaction(async (tx) => {
        const [newItem] = await tx
          .select()
          .from(items)
          .offset(itemOffset)
          .limit(1)
          .execute();

        await tx.insert(fakeStoredItems).values({
          amount: getNewAmount(1),
          id: `${newItem.modId}:${newItem.id}`,
          isCraftable: faker.datatype.boolean({ probability: 0.9 }),
        });

        return;
      });
    } else {
      await db.transaction(async (tx) => {
        const [item] = await tx
          .select()
          .from(fakeStoredItems)
          .offset(itemOffset)
          .limit(1)
          .execute();

        await tx
          .update(fakeStoredItems)
          .set({
            ...item,
            amount: getNewAmount(item.amount),
            isCraftable: faker.datatype.boolean({
              probability: Math.min(0.1 * (item.amount / 100), 1),
            }),
          })
          .where(eq(fakeStoredItems.fingerprint, item.fingerprint))
          .execute();

        return;
      });
    }
  }

  // Delete any items from the db that are 0, just like how the storage systems would handle it
  await db.delete(fakeStoredItems).where(lte(fakeStoredItems.amount, 0));

  const limits = await db
    .select({
      min: itemLimits.min,
      max: itemLimits.max,
      fingerprint: fakeStoredItems.fingerprint,
    })
    .from(itemLimits)
    .innerJoin(
      fakeStoredItems,
      eq(itemLimits.fingerprint, fakeStoredItems.fingerprint)
    );

  for (const itemLimit of limits) {
    await db.transaction(async (tx) => {
      const [storedItem] = await tx
        .select()
        .from(fakeStoredItems)
        .where(eq(fakeStoredItems.fingerprint, itemLimit.fingerprint))
        .execute();

      if (storedItem !== undefined) {
        if (itemLimit.max !== null && storedItem.amount > itemLimit.max) {
          const over = storedItem.amount - itemLimit.max;

          await tx
            .update(fakeStoredItems)
            .set({ amount: sql`${fakeStoredItems.amount} - ${over}` })
            .where(eq(fakeStoredItems.fingerprint, itemLimit.fingerprint));
        } else if (
          itemLimit.min !== null &&
          storedItem.amount < itemLimit.min &&
          storedItem.isCraftable
        ) {
          const under = storedItem.amount - itemLimit.min;

          await tx
            .update(fakeStoredItems)
            .set({ amount: sql`${fakeStoredItems.amount} + ${under}` })
            .where(eq(fakeStoredItems.fingerprint, itemLimit.fingerprint));
        }
      }
    });
  }
});

// Reset the fake items every hour
schedule("0 */1 * * *", () => {
  db.transaction(async () => {
    await db.delete(fakeStoredItems).execute();
    await db.delete(itemLimits).execute();
  });
});

function getNewAmount(oldAmount: number) {
  const operationType = faker.datatype.boolean() ? "+" : "*";

  let factor: number;

  if (operationType === "+") {
    factor = faker.number.int({
      min: 0,
      max: 10000,
    });
  } else {
    factor = faker.number.float({ min: 0, max: 4, precision: 0.01 });
  }

  return Math.round(eval(`${oldAmount} ${operationType} ${factor}`) as number);
}
