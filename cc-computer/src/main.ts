import type { BackendWebSocketPayload, TurtleWebsocketPayload } from "typings";
import { initDB } from "./db";
import {
  Direction,
  MEBridge,
  RSBridge,
} from "advanced-peripheral-types/peripherals";

const WS_URL = "ws://localhost:1001";
const TIMER_DELAY = 1;

const [ws, message] = http.websocket(WS_URL);

if (ws === false) {
  // TODO: Implement retry function
  throw new Error(message);
}

let bridge: MEBridge | RSBridge = peripheral.find("meBridge")!;
const chatBox = peripheral.find("chatBox");

if (bridge === null) {
  bridge = peripheral.find("rsBridge")!;

  if (bridge === null) {
    throw new Error("Computer is not connected to a Bridge");
  }
}

if (chatBox === null) {
  throw new Error("Computer is not connected to a chat box");
}

function sendWsMessage(payload: TurtleWebsocketPayload) {
  (ws as WebSocket).send(textutils.serializeJSON(payload));
}

let timerId = os.startTimer(TIMER_DELAY);

const itemLimitsDb = initDB<{ min?: number; max?: number }>("limits", {
  onChange: (newData) => {
    sendWsMessage({
      type: "updateLimits",
      limits: newData,
    });
  },
});

const configDb = initDB<{ trashDirection: Direction }, true>("config", {
  defaultValue: {
    trashDirection: "south",
  },
});

function handleTimerEvent() {
  const storedItems = bridge.listItems();

  storedItems.forEach((item) => {
    sendWsMessage({
      type: "storedItem",
      data: {
        amount: item.amount,
        fingerprint: item.fingerprint!,
        id: item.name,
        isCraftable: item.isCraftable,
        isCrafting: false,
      },
    });
  });

  sendWsMessage({ type: "storedItemEol" });
}

function handleChatEvent(userName: string, message: string, uuid: string) {
  sendWsMessage({ type: "gameChat", message, userName, uuid });
}

function handleWebsocketMessage(payload: BackendWebSocketPayload) {
  if (payload.type === "craftItem") {
    bridge?.craftItem(
      {
        name: `${payload.modId}:${payload.itemId}`,
        count: payload.amount,
      } as any,
      payload.amount
    );
  } else if (payload.type === "setLimit") {
    itemLimitsDb.set(`${payload.modId}:${payload.itemId}`, {
      max: payload.max,
      min: payload.min,
    });
  }
}

while (true) {
  const eventData = os.pullEvent();
  const eventName = eventData[0];

  if (eventName === "timer" && eventData[1] == timerId) {
    handleTimerEvent();
    timerId = os.startTimer(TIMER_DELAY);
  } else if (eventName === "websocket_message") {
    const payload = textutils.unserializeJSON(eventData[2]);

    handleWebsocketMessage(payload);
  } else if (eventName === "websocket_success") {
  } else if (eventName === "websocket_failure") {
  } else if (eventName === "websocket_closed") {
  } else if (eventName === "chat") {
    const [, userName, message, uuid] = eventData;
    handleChatEvent(userName, message, uuid);
  }
}
