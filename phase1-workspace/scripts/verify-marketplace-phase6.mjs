import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createIDosGamesClient } from "@idosgames/core";

const titleID = process.env.IDOS_TITLE_ID ?? "1ZPS8DLV-DEV";
if (!titleID.endsWith("-DEV")) throw new Error("Verification requires a DEV title.");
const fixture = process.env.IDOS_PHASE6_FIXTURE;
const steps = [];
const created = [];
let lastMarket = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function market(action) {
  await pause(Math.max(0, lastMarket + 750 - Date.now()));
  try { return await action(); } finally { lastMarket = Date.now(); }
}
function ok(result, label) { if (!result.ok) throw new Error(label + ": " + result.reason + " " + result.error); return result.data; }
async function player(seed = true) {
  const client = createIDosGamesClient({ titleID, throttleMs: 0, loginViews: "none" });
  client.auth.setRememberSession(false);
  ok(await client.auth.loginWithDeviceID(), "login");
  if (seed) {
    if (!fixture) throw new Error("Set IDOS_PHASE6_FIXTURE to a temporary DEV fixture before verification.");
    ok(await client.reward.claimReward(fixture), "seed fixture");
  }
  return client;
}
async function inventory(client) { ok(await client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 }), "inventory"); return client.data.user.state.InventoryV2; }
const count = (inventory, item) => inventory.Items?.[item]?.StackableAmount ?? 0;
const price = (id, amount) => ({ Entries: [{ Type: "Item", CatalogID: "Item", ItemID: id, Amount: amount }] });
async function listing(client, amount = 3) {
  const data = ok(await market(() => client.marketplace.createListing("neko-01-t1", "Item", amount, price("neko-02-t1", 2), 24)), "create listing");
  assert.ok(data.OfferID); created.push({ client, id: data.OfferID }); return data.OfferID;
}
async function step(name, action) {
  await action(); steps.push({ name, passed: true }); console.log(JSON.stringify({ step: name, passed: true }));
}
async function reject(result, label) {
  assert.equal(result.ok, false, label);
  assert.ok(["server", "throttled"].includes(result.reason), label + " must be rejected by the server");
}
try {
  const a = await player(), b = await player(), empty = await player(false);
  assert.notEqual(a.auth.context.userID, b.auth.context.userID);
  let id;
  await step("DEV configuration allows Item barter with zero commission, VIS unchanged", async () => {
    const defs = ok(await market(() => a.marketplace.getDefinitions()), "definitions");
    assert.equal(defs.Definitions.Enabled, true);
    assert.equal(defs.IsOpenNow, true); assert.equal(defs.GatePassed, true);
    assert.equal(defs.Definitions.Commission.Percent, 0);
    assert.equal(defs.Definitions.PricePolicy.AllowVirtualCurrency, false);
    assert.equal(a.data.config.currencyDefinitions?.VirtualCurrencies?.VIS?.Permissions?.IsTradable, false);
  });
  await step("offering more than owned is rejected without an escrow debit", async () => {
    const before = await inventory(a);
    await reject(await market(() => a.marketplace.createListing("neko-01-t1", "Item", 8, price("neko-02-t1", 2), 24)), "oversell");
    assert.equal(count(await inventory(a), "neko-01-t1"), count(before, "neko-01-t1"));
  });
  await step("create 3 Mia for 2 Akira immediately escrows the exact stack quantity", async () => {
    id = await listing(a);
    assert.equal(count(await inventory(a), "neko-01-t1"), 4);
    const offer = ok(await market(() => b.marketplace.getOffer(id)), "read offer").Offer;
    assert.equal(offer.GoodsAmount, 3);
    assert.equal(offer.Price.Entries[0].ItemID, "neko-02-t1");
    assert.equal(offer.Price.Entries[0].Amount, 2);
    const page = ok(await market(() => b.marketplace.getOffersByItem("neko-01-t1", "Listing")), "browse");
    assert.ok(page.Offers.some(offer => offer.OfferID === id));
  });
  await step("escrowed copies cannot be used in Craft or a second overselling listing", async () => {
    await reject(await a.craft.craft("merge-neko-01-t1-t2", Array(5).fill("neko-01-t1")), "craft escrow");
    await reject(await market(() => a.marketplace.createListing("neko-01-t1", "Item", 5, price("neko-02-t1", 2), 24)), "resell escrow");
    assert.equal(count(await inventory(a), "neko-01-t1"), 4);
  });
  await step("buyer with no requested cards cannot accept; cancel returns all escrow", async () => {
    await reject(await market(() => empty.marketplace.buy(id)), "insufficient buyer");
    ok(await market(() => a.marketplace.cancelListing(id)), "cancel");
    assert.equal(count(await inventory(a), "neko-01-t1"), 7);
    await reject(await market(() => a.marketplace.cancelListing(id)), "double cancel");
    assert.equal(count(await inventory(a), "neko-01-t1"), 7);
  });
  await step("barter settles both accounts exactly once, no VIS charge", async () => {
    id = await listing(a);
    const visA = a.data.user.getVirtualCurrencyAmount("VIS"), visB = b.data.user.getVirtualCurrencyAmount("VIS");
    ok(await market(() => b.marketplace.buy(id)), "buy");
    const ai = await inventory(a), bi = await inventory(b);
    assert.equal(count(ai, "neko-01-t1"), 4); assert.equal(count(ai, "neko-02-t1"), 10);
    assert.equal(count(bi, "neko-01-t1"), 10); assert.equal(count(bi, "neko-02-t1"), 6);
    assert.equal(a.data.user.getVirtualCurrencyAmount("VIS"), visA);
    assert.equal(b.data.user.getVirtualCurrencyAmount("VIS"), visB);
    await reject(await market(() => b.marketplace.buy(id)), "double buy");
    assert.equal(count(await inventory(b), "neko-01-t1"), 10);
    assert.equal(count(await inventory(b), "neko-02-t1"), 6);
  });
  await step("BuyOrder escrows payment; cancellation restores it; full fill settles atomically", async () => {
    const makeOrder = async () => {
      const data = ok(await market(() => a.marketplace.createBuyOrder("neko-02-t1", "Item", 2, price("neko-01-t1", 3), 24)), "create order");
      created.push({ client: a, id: data.OfferID }); return data.OfferID;
    };
    const order = await makeOrder();
    assert.equal(count(await inventory(a), "neko-01-t1"), 1);
    const browse = ok(await market(() => b.marketplace.getBuyOrders("neko-02-t1")), "browse orders");
    assert.ok(browse.Offers.some(offer => offer.OfferID === order));
    ok(await market(() => a.marketplace.cancelBuyOrder(order)), "cancel order");
    assert.equal(count(await inventory(a), "neko-01-t1"), 4);
    const fill = await makeOrder();
    ok(await market(() => b.marketplace.fillBuyOrder(fill)), "fill order");
    assert.equal(count(await inventory(a), "neko-01-t1"), 1);
    assert.equal(count(await inventory(a), "neko-02-t1"), 12);
    assert.equal(count(await inventory(b), "neko-01-t1"), 13);
    assert.equal(count(await inventory(b), "neko-02-t1"), 4);
    await reject(await market(() => b.marketplace.fillBuyOrder(fill)), "double fill");
    assert.equal(count(await inventory(b), "neko-01-t1"), 13);
  });
  await step("concurrent Craft and escrow cannot consume the same copies", async () => {
    const race = await player();
    await pause(800);
    const results = await Promise.all([
      race.marketplace.createListing("neko-01-t1", "Item", 3, price("neko-02-t1", 2), 24),
      race.craft.craft("merge-neko-01-t1-t2", Array(5).fill("neko-01-t1")),
    ]);
    assert.equal(results.filter(result => result.ok).length, 1);
    const state = await inventory(race);
    if (results[0].ok) { created.push({ client: race, id: results[0].data.OfferID }); assert.equal(count(state, "neko-01-t1"), 4); assert.equal(count(state, "neko-01-t2"), 0); }
    else { assert.equal(count(state, "neko-01-t1"), 2); assert.equal(count(state, "neko-01-t2"), 1); }
  });
  await step("two buyers racing for one listing receive at most one grant", async () => {
    const seller = await player(), buyer = await player(), other = await player();
    const offer = await listing(seller);
    await pause(800);
    const results = await Promise.all([buyer.marketplace.buy(offer), other.marketplace.buy(offer)]);
    assert.equal(results.filter(result => result.ok).length, 1);
    const si = await inventory(seller), bi = await inventory(buyer), oi = await inventory(other);
    assert.equal(count(si, "neko-01-t1") + count(bi, "neko-01-t1") + count(oi, "neko-01-t1"), 21);
    assert.equal(count(si, "neko-02-t1") + count(bi, "neko-02-t1") + count(oi, "neko-02-t1"), 24);
  });
  await mkdir("artifacts/phase6", { recursive: true });
  await writeFile("artifacts/phase6/verify.json", JSON.stringify({ titleID, success: true, steps, verifiedAt: new Date().toISOString() }, null, 2));
  console.log(JSON.stringify({ success: true, passed: steps.length, titleID }));
} catch (error) {
  console.error(JSON.stringify({ success: false, error: error.message, passed: steps.length }));
  process.exitCode = 1;
} finally {
  for (const { client, id } of created) {
    const read = await market(() => client.marketplace.getOffer(id));
    if (read.ok && read.data.Offer?.Status === "Active") {
      const result = await market(() => read.data.Offer.OfferType === "BuyOrder" ? client.marketplace.cancelBuyOrder(id) : client.marketplace.cancelListing(id));
      if (!result.ok) console.error("Cleanup failed for test offer " + id);
    }
  }
  process.exit(process.exitCode ?? 0);
}
