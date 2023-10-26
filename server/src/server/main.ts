import express from "express";
import viteExpress from "vite-express";
import * as trpcExpress from "@trpc/server/adapters/express";
import { appRouter } from "./trpc";
import { WebSocketServer } from "ws";
import {
  db,
  itemAssets,
  storedItems as storedItemsTable,
  itemLimits,
  chatMessages,
} from "./db";
import { eq } from "drizzle-orm";
import cors from "cors";
import { config } from "dotenv";
import { fuse } from "./fuse";
import type {
  CraftItemPayload,
  SetLimitPayload,
  TurtleWebsocketPayload,
  UploadLimitsPayload,
} from "typings";
import { io } from "./io";
import { events } from "./event-emitter";
import { stdout } from "process";

config();

const app = express();

app.use(cors());

app.use(
  "/trpc",
  trpcExpress.createExpressMiddleware({
    router: appRouter,
  })
);

io.listen(3001);

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

let processedItems: Record<string, string> = {};
let updatedItems: Record<string, string> = {};

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

  events.on("updateLimits", (itemId, modId, { min, max }) => {
    ws.send(
      JSON.stringify({
        type: "setLimit",
        itemId,
        modId,
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
    console.time("processed");
    const payload: TurtleWebsocketPayload = JSON.parse(data.toString());

    if (payload.type === "storedItem") {
      const data = payload.data;

      const [modId, itemId] = payload.data.id.split(":");

      await db.transaction<any>(async (tx) => {
        const [existingData] = await tx
          .select()
          .from(storedItemsTable)
          .where(eq(storedItemsTable.fingerprint, data.fingerprint))
          .limit(1)
          .execute();

        if (existingData !== undefined) {
          if (
            existingData.amount !== data.amount ||
            existingData.isCraftable !== data.isCraftable
          ) {
            updatedItems[data.fingerprint] = data.fingerprint;

            await tx
              .update(storedItemsTable)
              .set({ amount: data.amount, lastModified: Date.now() })
              .where(eq(storedItemsTable.fingerprint, data.fingerprint))
              .execute();
          }
        } else {
          updatedItems[data.fingerprint] = data.fingerprint;

          await tx
            .insert(storedItemsTable)
            .values({
              fingerprint: data.fingerprint,
              amount: data.amount,
              itemId: itemId,
              modId: modId,
              isCraftable: data.isCraftable,
              lastModified: Date.now(),
            })
            .onConflictDoUpdate({
              set: { amount: data.amount },
              target: storedItemsTable.fingerprint,
            })
            .execute();
        }

        processedItems[data.fingerprint] = data.fingerprint;
      });
    } else if (payload.type === "storedItemEol") {
      await db.transaction(async (tx) => {
        const storedItemFingerprints = await tx
          .select({ fingerprint: storedItemsTable.fingerprint })
          .from(storedItemsTable)
          .execute();

        for (const { fingerprint } of storedItemFingerprints) {
          if (processedItems[fingerprint] === undefined) {
            // item no longer exists in storage system
            await tx
              .delete(storedItemsTable)
              .where(eq(storedItemsTable.fingerprint, fingerprint))
              .execute();

            updatedItems[fingerprint] = fingerprint;
          }
        }
      });

      if (Object.keys(updatedItems).length > 0) {
        io.emit("updateItems");
      }

      updatedItems = {};
      processedItems = {};
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

    console.timeEnd("processed");
    // const payload: TurtleWebsocketPayload = JSON.parse(data.toString());
    // console.log(payload.type);
    // if (payload.type === "storedItems") {
    //   const storedItems = payload.storedItems.map((item) => ({
    //     ...item,
    //     id: item.id.split(":")[1],
    //   }));
    //   const oldItems: {
    //     fingerprint: string;
    //     oldAmount: number;
    //     newAmount: number;
    //     oldIsCraftable: boolean;
    //     newIsCraftable: boolean;
    //   }[] = [];
    //   const newItems: { id: string; amount: number; fingerprint: string }[] =
    //     [];
    //   await db.transaction(async (tx) => {
    //     for (const storedItem of storedItems) {
    //       const selectedItem = await tx
    //         .select({
    //           id: storedItemsTable.id,
    //           oldAmount: storedItemsTable.amount,
    //           oldIsCraftable: storedItemsTable.isCraftable,
    //         })
    //         .from(storedItemsTable)
    //         .where(eq(storedItemsTable.id, storedItem.id))
    //         .execute();
    //       if (selectedItem.at(0) !== undefined) {
    //         oldItems.push({
    //           ...selectedItem[0],
    //           newAmount: storedItem.amount,
    //           fingerprint: storedItem.fingerprint,
    //           newIsCraftable: storedItem.isCraftable,
    //         });
    //       } else {
    //         newItems.push(storedItem);
    //       }
    //     }
    //     const changedItems: { fingerprint: string; newAmount: number }[] = [];
    //     for (const newItem of newItems) {
    //       const [newItemAssetData] = await tx
    //         .select()
    //         .from(itemAssets)
    //         .where(eq(itemAssets.id, newItem.id))
    //         .limit(1)
    //         .execute();
    //       console.log(newItemAssetData, newItem);
    //       fuse.add({
    //         id: newItem.id,
    //         displayName: newItemAssetData.displayName,
    //         modId: newItemAssetData.modId,
    //       });
    //       changedItems.push({
    //         fingerprint: newItem.fingerprint,
    //         newAmount: newItem.amount,
    //       });
    //       await tx
    //         .insert(storedItemsTable)
    //         .values({ ...newItem, lastModified: Date.now() })
    //         .execute();
    //     }
    //     for (const oldItem of oldItems) {
    //       if (
    //         oldItem.oldAmount !== oldItem.newAmount ||
    //         oldItem.oldIsCraftable !== oldItem.newIsCraftable
    //       ) {
    //         changedItems.push({
    //           fingerprint: oldItem.fingerprint,
    //           newAmount: oldItem.newAmount,
    //         });
    //         await tx
    //           .update(storedItemsTable)
    //           .set({ amount: oldItem.newAmount, lastModified: Date.now() })
    //           .where(eq(storedItemsTable.fingerprint, oldItem.fingerprint))
    //           .execute();
    //       }
    //     }
    //     if (changedItems.length > 0) {
    //       io.emit("updateItems");
    //     }
    //   });
    // } else if (payload.type === "updateLimits") {
    // }
  });
});
