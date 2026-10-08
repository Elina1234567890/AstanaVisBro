import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cardDefinitions, createPendingLock } from "../src/modules/astanavis-shell/cards-model.ts";
import { NEKO_PACK_ID, NEKO_PACK_PRICE, nekoPackSnapshot, nekoRewardPool, reconciledReward, rewardItemFromResponse, validateNekoPack } from "../src/modules/astanavis-shell/neko-pack-model.ts";

test("NEKO PACK uses one server weighted roll for exactly one T1 card", async () => {
  for (const env of ["dev", "prod"]) {
    const config = JSON.parse(await readFile(new URL(`../title-configuration/${env}.json`, import.meta.url), "utf8"));
    const cards = cardDefinitions(new Map(Object.entries(config.Item.Catalogs.Item.Items)));
    const expected = nekoRewardPool(cards);
    const definition = config.Lootbox.Definitions[NEKO_PACK_ID];
    assert.equal(validateNekoPack(definition, expected), null);
    assert.equal(definition.MaxOpenCount, 1);
    assert.equal(definition.RewardSlots.length, 1);
    assert.equal(definition.RewardSlots[0].MinRolls, 1);
    assert.equal(definition.RewardSlots[0].MaxRolls, 1);
    assert.equal(definition.PityRules, undefined);
    assert.equal(definition.RewardMultiplier, undefined);
    assert.equal(definition.RewardSlots[0].Pool.reduce((sum, roll) => sum + roll.Weight, 0), 2000);
    const probabilities = new Map();
    for (const roll of definition.RewardSlots[0].Pool) {
      const item = roll.Reward.Standard.Entries[0];
      assert.equal(roll.Reward.Standard.Entries.length, 1);
      assert.equal(item.Type, "Item");
      assert.equal(item.Amount, 1);
      const rarity = config.Item.Catalogs.Item.Items[item.ItemID].Metadata.CardRarity;
      probabilities.set(rarity, (probabilities.get(rarity) ?? 0) + roll.Weight);
    }
    assert.deepEqual(Object.fromEntries([...probabilities].sort()), { common: 2000 });
    assert.deepEqual(definition.RewardSlots[0].Pool.map((roll) => roll.Reward.Standard.Entries[0].ItemID), ["neko-04-t1"]);
    assert.equal(config.Item.Catalogs.Item.Items["neko-04-t1"].CustomData.CharacterName, "Julie");
    assert.equal(config.Item.Catalogs.Item.Items["neko-04-t1"].Metadata.ImagePath, "./julie-common.png");
    assert.deepEqual(definition.PriceOptions.vis.Cost.Standard.Entries, [{ Type: "VirtualCurrency", CurrencyID: "VIS", Amount: NEKO_PACK_PRICE }]);
  }
});

test("server result parser accepts only a single allowed T1 item", () => {
  const allowed = new Set(["neko-01-t1", "neko-02-t1"]);
  const response = { LootboxID: NEKO_PACK_ID, OpenedCount: 1, Results: [{ Grant: { Standard: { Entries: [{ Type: "Item", CatalogID: "Item", ItemID: "neko-01-t1", Amount: 1 }] } } }] };
  assert.equal(rewardItemFromResponse(response, allowed), "neko-01-t1");
  assert.equal(rewardItemFromResponse({ ...response, OpenedCount: 2 }, allowed), null);
  assert.equal(rewardItemFromResponse({ ...response, Results: [{ Grant: { Standard: { Entries: [{ Type: "Item", CatalogID: "Item", ItemID: "neko-01-t1", Amount: 2 }] } } }] }, allowed), null);
  assert.equal(rewardItemFromResponse({ ...response, Results: [{ Grant: { Standard: { Entries: [...response.Results[0].Grant.Standard.Entries, { Type: "VirtualCurrency", CurrencyID: "VIS", Amount: 1 }] } } }] }, allowed), null);
});

test("lost response can be reconciled only for one 100 VIS debit and one T1 stack increase", () => {
  const ids = new Set(["neko-01-t1", "neko-02-t1"]);
  const before = nekoPackSnapshot({ InventoryV2: { VirtualCurrencies: { VIS: { Amount: 500 } }, Items: { "neko-01-t1": { StackableAmount: 2 }, "neko-02-t1": { StackableAmount: 0 } } } }, ids);
  const after = nekoPackSnapshot({ InventoryV2: { VirtualCurrencies: { VIS: { Amount: 400 } }, Items: { "neko-01-t1": { StackableAmount: 2 }, "neko-02-t1": { StackableAmount: 1 } } } }, ids);
  assert.equal(reconciledReward(before, after), "neko-02-t1");
  assert.equal(reconciledReward(before, { ...after, vis: 300 }), null);
  assert.equal(reconciledReward(before, { vis: 400, t1Amounts: { "neko-01-t1": 3, "neko-02-t1": 1 } }), null);
});

test("a repeated open click is blocked until the in-flight call releases its lock", () => {
  const lock = createPendingLock();
  assert.equal(lock.tryAcquire(NEKO_PACK_ID), true);
  assert.equal(lock.tryAcquire(NEKO_PACK_ID), false);
  lock.release(NEKO_PACK_ID);
  assert.equal(lock.tryAcquire(NEKO_PACK_ID), true);
});
