export type StoredItemPayload = {
  type: "storedItem";
  data: {
    id: string;
    amount: number;
    fingerprint: string;
    isCraftable: boolean;
  };
};

export type StoredItemsPayload = {
  type: "storedItems";
  data: {
    id: string;
    amount: number;
    fingerprint: string;
    isCraftable: boolean;
  }[];
};

export type StoredItemEOLPayload = {
  type: "storedItemEol";
};

export type UploadLimitsPayload = {
  type: "updateLimits";
  limits: Record<string, any>;
};

export type GameChatMessagePayload = {
  type: "gameChat";
  uuid: string;
  userName: string;
  message: string;
};

export type TurtleWebsocketPayload =
  | StoredItemPayload
  | UploadLimitsPayload
  | StoredItemsPayload
  | StoredItemEOLPayload
  | GameChatMessagePayload;

export type CraftItemPayload = {
  type: "craftItem";
  itemId: string;
  modId: string;
  amount: number;
};

export type SetLimitPayload = {
  type: "setLimit";
  fingerprint: string;
  min?: number;
  max?: number;
};

export type WebChatMessagePayload = {
  type: "webChat";
  content: string;
};

export type BackendWebSocketPayload =
  | CraftItemPayload
  | SetLimitPayload
  | WebChatMessagePayload;

export type ServerToClientSocketEvents = {
  updateItems: () => void;
  updateChat: () => void;
  updateTurtleStatus: (isConnected: boolean) => void;
};

export type ClientToServerSocketEvents = {
  sendChatMessage: () => void;
};
