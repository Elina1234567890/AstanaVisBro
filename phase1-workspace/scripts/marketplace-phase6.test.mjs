import assert from "node:assert/strict";
import test from "node:test";
import { availableAmount, canPay, cardPrice, createTradeController, isExpired, tradeCards, validAmount } from "../src/modules/marketplace/barter-model.ts";

const mia = { itemID: "neko-01-t1", catalogID: "Item", name: "Mia", tier: 1 };
test("quantities are bounded safe positive integers; inventory never uses TotalAmount", () => {
  for (const amount of [0, -1, 1.5, NaN, Infinity, 1000, Number.MAX_SAFE_INTEGER + 1]) assert.equal(validAmount(amount), false);
  for (const amount of [1, 3, 999]) assert.equal(validAmount(amount), true);
  assert.equal(availableAmount({ Items: { [mia.itemID]: { StackableAmount: 4, TotalAmount: 7 } } }, mia.itemID), 4);
  assert.equal(availableAmount({ Items: { [mia.itemID]: { StackableAmount: NaN } } }, mia.itemID), 0);
});
test("barter price has exact item and amount, never VIS or an instance identity", () => {
  assert.deepEqual(cardPrice(mia, 3), { Entries: [{ Type: "Item", CatalogID: "Item", ItemID: "neko-01-t1", Amount: 3 }] });
  assert.throws(() => cardPrice(mia, 0));
});
test("only tagged stackable tradable cards enter the selector", () => {
  const item = { IsStackable: true, IsTradable: true, Tags: ["astanavis-card", "tier:1"], DisplayName: "Mia" };
  const defs = { Catalogs: { Item: { Items: { mia: item, nontradable: { ...item, IsTradable: false }, instance: { ...item, IsStackable: false }, potion: { ...item, Tags: [] } } } } };
  assert.deepEqual(tradeCards(defs).map(card => card.itemID), ["mia"]);
});
test("escrowed quantities cannot fund a payment; repeated price positions sum", () => {
  const inventory = { Items: { [mia.itemID]: { StackableAmount: 4 } } };
  assert.equal(canPay(cardPrice(mia, 4), inventory), true);
  assert.equal(canPay(cardPrice(mia, 5), inventory), false);
  assert.equal(canPay({ Entries: [...cardPrice(mia, 3).Entries, ...cardPrice(mia, 2).Entries] }, inventory), false);
  assert.equal(canPay({ Entries: [{ Type: "VirtualCurrency", CurrencyID: "VIS", Amount: 1 }] }, inventory), false);
});
test("expiration fails closed, including invalid or missing timestamps", () => {
  assert.equal(isExpired({ Status: "Active", ExpiresAt: "2030-01-01T00:00:00Z" }, 0), false);
  assert.equal(isExpired({ Status: "Expired", ExpiresAt: "2030-01-01T00:00:00Z" }, 0), true);
  assert.equal(isExpired({ ExpiresAt: "invalid" }), true);
  assert.equal(isExpired({}), true);
});
test("controller holds a synchronous lock across navigation and serializes requests", async () => {
  const controller = createTradeController();
  assert.equal(controller.acquire(), true);
  assert.equal(controller.acquire(), false);
  let release;
  const barrier = new Promise(resolve => { release = resolve; });
  const calls = [];
  const first = controller.call(async () => { calls.push("first"); await barrier; return 1; });
  const second = controller.call(async () => { calls.push("second"); return 2; });
  await Promise.resolve(); await Promise.resolve();
  assert.deepEqual(calls, ["first"]);
  release();
  assert.deepEqual(await Promise.all([first, second]), [1, 2]);
  controller.release();
  assert.equal(controller.acquire(), true);
});
