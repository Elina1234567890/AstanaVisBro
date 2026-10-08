import assert from "node:assert/strict";
import test from "node:test";
import { configuredNekoPackCards, nekoRewardPool, validateNekoPack } from "../src/modules/astanavis-shell/neko-pack-model.ts";
const cards = [
  { itemID: "neko-01-t1", tier: 1, rarity: "common", imagePath: "./mia.png" },
  { itemID: "neko-04-t1", tier: 1, rarity: "common", imagePath: "./julie.png" },
];
const pack = {
  LootboxID: "neko-pack", MaxOpenCount: 1,
  PriceOptions: { vis: { OptionID: "vis", Cost: { Standard: { Entries: [{ Type: "VirtualCurrency", CurrencyID: "VIS", Amount: 100 }] } } } },
  RewardSlots: [{ MinRolls: 1, MaxRolls: 1, Pool: [{ Weight: 2000, Reward: { Standard: { Entries: [{ Type: "Item", CatalogID: "Item", ItemID: "neko-04-t1", Amount: 1 }] } } }] }],
};
test("a curated Julie-only pack remains valid when more card art is uploaded", () => {
  const pool = nekoRewardPool(configuredNekoPackCards(cards, pack));
  assert.deepEqual(pool.map(item => item.itemID), ["neko-04-t1"]);
  assert.equal(validateNekoPack(pack, pool), null);
});
test("curated filtering does not admit unknown cards or extra rewards", () => {
  const unknown = structuredClone(pack);
  unknown.RewardSlots[0].Pool[0].Reward.Standard.Entries[0].ItemID = "missing-card";
  assert.notEqual(validateNekoPack(unknown, nekoRewardPool(configuredNekoPackCards(cards, unknown))), null);
  const extra = structuredClone(pack);
  extra.RewardSlots[0].Pool[0].Reward.Standard.Entries[0].Amount = 2;
  assert.notEqual(validateNekoPack(extra, nekoRewardPool(configuredNekoPackCards(cards, extra))), null);
});
