import type { ItemDefinitions, MarketplaceOfferView, ResourceBundle } from "@idosgames/core";

export interface TradeCard { itemID: string; catalogID: string; name: string; tier: number; }
export function tradeCards(definitions: ItemDefinitions | null | undefined): TradeCard[] {
  return Object.entries(definitions?.Catalogs ?? {}).flatMap(([catalogID, catalog]) =>
    Object.entries(catalog.Items ?? {}).flatMap(([itemID, item]) => {
      if (!item.IsStackable || !item.IsTradable || !item.Tags?.includes("astanavis-card")) return [];
      const tier = Number(item.CustomData?.Tier ?? item.Tags.find(tag => tag.startsWith("tier:"))?.slice(5));
      return Number.isSafeInteger(tier) && tier > 0
        ? [{ itemID, catalogID, tier, name: item.CustomData?.CharacterName ?? item.DisplayName ?? itemID }] : [];
    })).sort((a, b) => a.itemID.localeCompare(b.itemID));
}
export function validAmount(value: number): boolean { return Number.isSafeInteger(value) && value > 0 && value <= 999; }
export function availableAmount(inventory: { Items?: Record<string, { StackableAmount?: number } | null> | null } | null | undefined, itemID: string): number {
  const value = inventory?.Items?.[itemID]?.StackableAmount ?? 0;
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}
export function cardPrice(card: TradeCard, amount: number): ResourceBundle {
  if (!validAmount(amount)) throw new Error("Amount must be a whole number from 1 to 999.");
  return { Entries: [{ Type: "Item", CatalogID: card.catalogID, ItemID: card.itemID, Amount: amount }] };
}
export function isExpired(offer: MarketplaceOfferView, now = Date.now()): boolean {
  const expiry = Date.parse(offer.ExpiresAt ?? "");
  return offer.Status === "Expired" || !Number.isFinite(expiry) || expiry <= now;
}
export function canPay(bundle: ResourceBundle | null | undefined, inventory: Parameters<typeof availableAmount>[0]): boolean {
  if (!bundle?.Entries?.length || bundle.EventTokens?.length) return false;
  const totals = new Map<string, number>();
  for (const entry of bundle.Entries) {
    if (entry.Type !== "Item" || !entry.ItemID || !validAmount(entry.Amount ?? 0)) return false;
    totals.set(entry.ItemID, (totals.get(entry.ItemID) ?? 0) + (entry.Amount ?? 0));
  }
  return [...totals].every(([id, amount]) => availableAmount(inventory, id) >= amount);
}

/** Per-mounted module, so navigating away cannot unlock a request still in flight. */
export function createTradeController() {
  let pending = false;
  let nextCallAt = 0;
  let queue: Promise<unknown> = Promise.resolve();
  const listeners = new Set<() => void>();
  return {
    draft: "",
    getSnapshot: () => pending,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    acquire() { if (pending) return false; pending = true; listeners.forEach(fn => fn()); return true; },
    release() { pending = false; listeners.forEach(fn => fn()); },
    // MarketplaceV2 has a shared IP rate window. Serialize reads and writes; never retry writes.
    call<T>(action: () => Promise<T>): Promise<T> {
      const task = queue.then(async () => {
        const delay = Math.max(0, nextCallAt - Date.now());
        if (delay) await new Promise(resolve => setTimeout(resolve, delay));
        try { return await action(); } finally { nextCallAt = Date.now() + 650; }
      });
      queue = task.catch(() => undefined);
      return task;
    },
  };
}
export type TradeController = ReturnType<typeof createTradeController>;
