import { makeT } from "@idosgames/react/ui";

const EN = { cards: "Cards", store: "Store" } as const;
export const t = makeT<keyof typeof EN>(EN, {
  cards: "Карты",
  store: "Магазин",
});
