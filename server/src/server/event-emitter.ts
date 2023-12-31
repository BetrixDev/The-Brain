import { Emitter } from "strict-event-emitter";

type Events = {
  sendCraftItem: [itemId: string, modId: string, amount: number];
  updateLimits: [fingerprint: string, { min?: number; max?: number }];
};

export const events = new Emitter<Events>();
