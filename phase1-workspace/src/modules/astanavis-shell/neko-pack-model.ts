import type { LootboxDefinitions, LootboxOpenResponse, UserState } from "@idosgames/core";
import type { AstanaVisCardDefinition, CardRarity } from "./cards-model";

export const NEKO_PACK_ID = "neko-pack";
export const NEKO_PACK_PRICE = 100;
export const NEKO_PACK_OPTION_ID = "vis";
export const NEKO_PACK_TOTAL_WEIGHT = 2000;
export const NEKO_PACK_RARITY_WEIGHTS: Partial<Record<CardRarity, number>> = { common: 2000 };
type LootboxDefinition = NonNullable<NonNullable<LootboxDefinitions["Definitions"]>[string]>;

export interface NekoRewardItem {
  itemID: string;
  name: string;
  rarity: CardRarity;
  imagePath: string | null;
  weight: number;
}

/** Artwork availability does not imply membership in the server's curated pack. */
export function configuredNekoPackCards(cards: AstanaVisCardDefinition[], definition: LootboxDefinition | undefined): AstanaVisCardDefinition[] {
  const ids = new Set((definition?.RewardSlots?.[0]?.Pool ?? []).flatMap(roll =>
    (roll.Reward?.Standard?.Entries ?? []).filter(entry => entry.Type === "Item" && entry.CatalogID === "Item").map(entry => entry.ItemID)));
  return cards.filter(card => ids.has(card.itemID));
}

export function nekoRewardPool(cards: AstanaVisCardDefinition[]): NekoRewardItem[] {
  // Only art-backed T1 cards can enter the pack. Unuploaded characters stay out of
  // the weighted pool until their artwork is supplied.
  const candidates = cards.filter((card) => card.tier === 1 && Boolean(card.imagePath));
  const counts = new Map<CardRarity, number>();
  for (const card of candidates) counts.set(card.rarity, (counts.get(card.rarity) ?? 0) + 1);

  const groupWeight = NEKO_PACK_RARITY_WEIGHTS;
  return candidates.map((card) => {
    const count = counts.get(card.rarity) ?? 0;
    const totalWeight = groupWeight[card.rarity] ?? 0;
    return {
      itemID: card.itemID,
      name: card.name,
      rarity: card.rarity,
      imagePath: card.imagePath,
      weight: count > 0 && totalWeight % count === 0 ? totalWeight / count : 0,
    };
  });
}

/** Fail closed unless the server config guarantees a single T1 item and a 100 VIS debit. */
export function validateNekoPack(definition: LootboxDefinition | undefined, expected: NekoRewardItem[]): string | null {
  if (!definition || definition.LootboxID !== NEKO_PACK_ID) return "NEKO PACK is not configured on the server.";
  if (definition.MaxOpenCount !== 1) return "NEKO PACK must be limited to one open at a time.";
  if (definition.RewardMultiplier || definition.PityRules?.length || definition.Presets?.RewardSlots || definition.Presets?.PityRules) {
    return "NEKO PACK has a bonus configuration; opening is paused for safety.";
  }
  if (definition.RewardSlots?.length !== 1) return "NEKO PACK must have exactly one reward slot.";
  const slot = definition.RewardSlots[0];
  if (!slot) return "NEKO PACK must have exactly one reward slot.";
  if (slot.MinRolls !== 1 || slot.MaxRolls !== 1 || slot.Pool?.length !== expected.length) {
    return "NEKO PACK must roll exactly one configured card.";
  }

  const expectedByID = new Map(expected.map((item) => [item.itemID, item.weight]));
  let totalWeight = 0;
  for (const roll of slot.Pool ?? []) {
    const entries = roll.Reward?.Standard?.Entries ?? [];
    const entry = entries[0];
    if (!entry) return "NEKO PACK reward pool must contain one item per roll.";
    if (
      entries.length !== 1 ||
      entry.Type !== "Item" ||
      entry.CatalogID !== "Item" ||
      !entry.ItemID ||
      entry.Amount !== 1 ||
      roll.AmountRange ||
      roll.Reward?.PremiumBonuses?.length ||
      roll.Reward?.PremiumTiers?.length
    ) return "NEKO PACK reward pool must contain one item per roll.";
    const expectedWeight = expectedByID.get(entry.ItemID);
    if (expectedWeight === undefined || roll.Weight !== expectedWeight) {
      return "NEKO PACK reward pool does not match the configured T1 cards.";
    }
    expectedByID.delete(entry.ItemID);
    totalWeight += roll.Weight ?? 0;
  }
  if (expectedByID.size || totalWeight !== NEKO_PACK_TOTAL_WEIGHT) {
    return "NEKO PACK reward weights are incomplete or invalid.";
  }

  const options = Object.entries(definition.PriceOptions ?? {});
  const price = options.length === 1 ? options[0] : undefined;
  const [optionID, option] = price ?? [];
  const cost = option?.Cost?.Standard?.Entries ?? [];
  if (
    optionID !== NEKO_PACK_OPTION_ID ||
    option?.OptionID !== NEKO_PACK_OPTION_ID ||
    cost.length !== 1 ||
    cost[0]?.Type !== "VirtualCurrency" ||
    cost[0]?.CurrencyID !== "VIS" ||
    cost[0]?.Amount !== NEKO_PACK_PRICE ||
    option?.Cost?.Standard?.EventTokens?.length ||
    option?.Cost?.PremiumDiscounts?.length ||
    option?.Cost?.PremiumTiers?.length
  ) return "NEKO PACK price must be exactly 100 VIS.";

  return null;
}

export function rewardItemFromResponse(
  response: LootboxOpenResponse,
  allowedItemIDs: ReadonlySet<string>,
): string | null {
  if (response.LootboxID !== NEKO_PACK_ID || response.OpenedCount !== 1 || response.Results?.length !== 1) return null;
  const entries = response.Results?.[0]?.Grant?.Standard?.Entries ?? [];
  if (entries.length !== 1) return null;
  const [entry] = entries;
  if (!entry) return null;
  return entry.Type === "Item" && entry.CatalogID === "Item" && entry.Amount === 1 && entry.ItemID && allowedItemIDs.has(entry.ItemID)
    ? entry.ItemID
    : null;
}

export interface NekoPackSnapshot {
  vis: number | null;
  t1Amounts: Record<string, number>;
}

export function nekoPackSnapshot(state: UserState | null | undefined, allowedItemIDs: ReadonlySet<string>): NekoPackSnapshot {
  const inventory = state?.InventoryV2;
  const visAmount = inventory?.VirtualCurrencies?.VIS?.Amount;
  const t1Amounts: Record<string, number> = {};
  for (const itemID of allowedItemIDs) {
    t1Amounts[itemID] = Number(inventory?.Items?.[itemID]?.StackableAmount ?? 0);
  }
  return { vis: Number.isFinite(visAmount) ? Number(visAmount) : null, t1Amounts };
}

/** Used only after a lost response: infer the reward only if exactly one T1 stack rose by one. */
export function reconciledReward(
  before: NekoPackSnapshot,
  after: NekoPackSnapshot,
): string | null {
  if (before.vis === null || after.vis !== before.vis - NEKO_PACK_PRICE) return null;
  const increased = Object.entries(after.t1Amounts).filter(([itemID, amount]) => amount === (before.t1Amounts[itemID] ?? 0) + 1);
  const changed = Object.entries(after.t1Amounts).filter(([itemID, amount]) => amount !== (before.t1Amounts[itemID] ?? 0));
  return increased.length === 1 && changed.length === 1 ? increased[0]?.[0] ?? null : null;
}

