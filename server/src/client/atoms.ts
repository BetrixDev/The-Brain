import { atom } from "jotai";

export const selectedItemAtom = atom<
  { id: string; fingerprint: string; modId: string } | undefined
>(undefined);

export const selectedItemToCraftAtom = atom<
  { id: string; fingerprint: string; modId: string } | undefined
>(undefined);

export const sortingDirectionAtom = atom<"asc" | "desc">("desc");

export const sortingVariableAtom = atom<"amount" | "lastModified">("amount");

export const storedItemsSearchQueryAtom = atom<string | undefined>(undefined);
