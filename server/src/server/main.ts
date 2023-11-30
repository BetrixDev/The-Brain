import express from "express";
import viteExpress from "vite-express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc";
import { WebSocketServer } from "ws";
import {
  db,
  itemAssets,
  storedItems as storedItemsTable,
  chatMessages,
} from "./db";
import { eq } from "drizzle-orm";
import cors from "cors";
import { fuse } from "./fuse";
import type {
  CraftItemPayload,
  SetLimitPayload,
  TurtleWebsocketPayload,
} from "typings";
import { io } from "./io";
import { events } from "./event-emitter";

const app = express();

app.use(cors());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

io.listen(3003);

viteExpress.listen(app, 3000, async () => {
  const storedItemsCollection = await db
    .select({
      itemId: storedItemsTable.itemId,
      displayName: itemAssets.displayName,
      modId: itemAssets.modId,
    })
    .from(storedItemsTable)
    .innerJoin(itemAssets, eq(storedItemsTable.itemId, itemAssets.itemId));

  fuse.setCollection(storedItemsCollection);

  console.log("Server is listening on port 3000...");
});

const wss = new WebSocketServer({ port: 1001 });

wss.on("connection", (ws) => {
  console.log("Connected to turtle");
  io.emit("updateTurtleStatus", true);

  events.on("sendCraftItem", (itemId, modId, amount) => {
    ws.send(
      JSON.stringify({
        type: "craftItem",
        modId,
        amount,
        itemId,
      } satisfies CraftItemPayload)
    );
  });

  events.on("updateLimits", (fingerprint, { min, max }) => {
    ws.send(
      JSON.stringify({
        type: "setLimit",
        fingerprint,
        max,
        min,
      } satisfies SetLimitPayload)
    );
  });

  ws.on("close", () => {
    console.log("Lost connection to cc computer");
    io.emit("updateTurtleStatus", false);
    events.removeAllListeners("sendCraftItem");
  });

  ws.on("message", async (data) => {
    const payload: TurtleWebsocketPayload = JSON.parse(data.toString());

    if (payload.type === "storedItems") {
      const storedItemsPayload = payload.data;

      const processedItems: Record<string, string> = {};
      let didUpdateItems = false;

      await db.transaction(async (tx) => {
        for (const item of storedItemsPayload) {
          processedItems[item.fingerprint] = item.fingerprint;

          const [existingItem] = await tx
            .select()
            .from(storedItemsTable)
            .where(eq(storedItemsTable.fingerprint, item.fingerprint))
            .limit(1)
            .execute();

          if (existingItem === undefined) {
            const [modId, itemId] = item.id.split(":");

            await tx.insert(storedItemsTable).values({
              amount: item.amount,
              fingerprint: item.fingerprint,
              itemId,
              modId,
              isCraftable: item.isCraftable,
            });
          }

          if (
            existingItem?.amount !== item.amount ||
            existingItem?.isCraftable !== item.isCraftable
          ) {
            await tx
              .update(storedItemsTable)
              .set({ amount: item.amount })
              .where(eq(storedItemsTable.fingerprint, item.fingerprint))
              .execute();

            didUpdateItems = true;
          }
        }

        const newStoredItems = await tx
          .select()
          .from(storedItemsTable)
          .execute();

        for (const storedItem of newStoredItems) {
          if (processedItems[storedItem.fingerprint] === undefined) {
            await tx
              .delete(storedItemsTable)
              .where(eq(storedItemsTable.fingerprint, storedItem.fingerprint))
              .execute();
          }
        }
      });

      if (didUpdateItems) {
        io.emit("updateItems");
      }
    } else if (payload.type === "gameChat") {
      await db.insert(chatMessages).values({
        source: "mc",
        content: payload.message,
        displayName: payload.userName,
        uuid: payload.uuid,
        datePosted: Date.now(),
      });

      io.emit("updateChat");
    }
  });
});
