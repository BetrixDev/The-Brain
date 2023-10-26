import Fuse from "fuse.js";

type FuseDocument = {
  itemId: string;
  displayName: string;
  modId: string;
};

export const fuse = new Fuse<FuseDocument>([], {
  keys: ["itemId", "displayName", "modId"],
});
