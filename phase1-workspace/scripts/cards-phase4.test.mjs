import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canCombineTierOne, cardDefinitions, createPendingLock, groupCards } from "../src/modules/astanavis-shell/cards-model.ts";

const cards = [
  { itemID: "neko-01-t1", characterId: "neko-01", characterName: "NEKO 01", name: "NEKO 01 · T1", imagePath: null, tier: 1, rarity: "common", collectionId: "cards-neko-01", craftRarityId: "astanavis-tier-1" },
  { itemID: "neko-01-t2", characterId: "neko-01", characterName: "NEKO 01", name: "NEKO 01 · T2", imagePath: null, tier: 2, rarity: "common", collectionId: "cards-neko-01", craftRarityId: "astanavis-tier-2" },
];

test("InventoryV2 cases 0, 1, 4, 5 and 7 drive combine availability", () => {
  for (const count of [0, 1, 4, 5, 7]) {
    const [group] = groupCards(cards, { Items: { "neko-01-t1": { StackableAmount: count } } });
    assert.equal(group.tierOneAmount, count);
    assert.equal(canCombineTierOne(group.tierOneAmount), count >= 5);
  }
});

test("Tier 2 count and locked placeholders come from server inventory", () => {
  const [group] = groupCards(cards, { Items: { "neko-01-t1": { StackableAmount: 2 }, "neko-01-t2": { StackableAmount: 3 } } });
  assert.equal(group.tierOneAmount, 2);
  assert.equal(group.tierTwoAmount, 3);
  assert.equal(group.cards[0].isLocked, false);
  assert.equal(group.cards[1].isLocked, false);
});

test("a fresh InventoryV2 snapshot replaces previous amounts", () => {
  const before = groupCards(cards, { Items: { "neko-01-t1": { StackableAmount: 7 } } });
  const after = groupCards(cards, { Items: { "neko-01-t1": { StackableAmount: 2 }, "neko-01-t2": { StackableAmount: 1 } } });
  assert.equal(before[0].tierOneAmount, 7);
  assert.equal(after[0].tierOneAmount, 2);
  assert.equal(after[0].tierTwoAmount, 1);
});

test("concurrent clicks on one character are blocked while different characters remain independent", () => {
  const lock = createPendingLock();
  assert.equal(lock.tryAcquire("neko-01"), true);
  assert.equal(lock.tryAcquire("neko-01"), false);
  assert.equal(lock.tryAcquire("neko-02"), true);
  lock.release("neko-01");
  assert.equal(lock.tryAcquire("neko-01"), true);
});

test("all configured recipes accept only their character's T1 and have one T2 output", async () => {
  for (const env of ["dev", "prod"]) {
    const config = JSON.parse(await readFile(new URL(`../title-configuration/${env}.json`, import.meta.url), "utf8"));
    const items = config.Item.Catalogs.Item.Items;
    const definitions = cardDefinitions(new Map(Object.entries(items)));
    assert.equal(definitions.length, 12);
    for (let index = 1; index <= 6; index += 1) {
      const characterId = `neko-${String(index).padStart(2, "0")}`;
      const collectionId = `astanavis-card-${characterId}`;
      const recipe = config.Craft.Definitions[`merge-${characterId}-t1-t2`];
      assert.equal(recipe.RequiredItemCount, 5);
      assert.equal(recipe.Type, "TradeUpCollection");
      assert.equal(recipe.CollectionID, collectionId);
      const pool = Object.values(items).filter((item) => item.Metadata.CollectionID === collectionId);
      const inputs = pool.filter((item) => item.Metadata.RarityID === recipe.InputRarityID);
      const outputs = pool.filter((item) => item.Metadata.RarityID === recipe.OutputRarityID && item.Weight > 0);
      assert.deepEqual(inputs.map((item) => item.ItemID), [`${characterId}-t1`]);
      assert.deepEqual(outputs.map((item) => item.ItemID), [`${characterId}-t2`]);
      assert.ok(pool.every((item) => item.IsStackable === true && item.IsTradable === true));
      if (characterId === "neko-04") {
        assert.equal(items[`${characterId}-t1`].Metadata.CardRarity, "common");
        assert.equal(items[`${characterId}-t2`].Metadata.CardRarity, "legendary");
      }
    }
  }
});
