# Phase 6 — card barter

The catalog Marketplace module is installed and customized for stackable AstanaVis cards, with
Listing and BuyOrder only. Do not restore the template's currency-priced selling or DirectTrade UI:
the current SDK has no arbitrary offered stackable quantity on its targeted DirectTrade method.
Friends stays installed. A future quantity DirectTrade must get its own confirmed SDK adapter;
it must not be emulated by a public listing or a fabricated endpoint.

TRADE on card details emits astanavis-shell:trade-card@1 before opening the marketplace feature.
The Marketplace module owns the selected draft and a controller that survives screen navigation.
marketplace:busy@1 and astanavis-shell:craft-busy@1 prevent simultaneous UI mutations in this app.
Cross-tab/player correctness still belongs to server inventory transactions, not those UI locks.

Listing escrows YOUR OFFER as GoodsAmount; its price bundle is REQUEST. BuyOrder reverses these:
REQUEST becomes goods, YOUR OFFER becomes the escrowed price bundle. Both settle in full only.
All quantities come from InventoryV2.Items[itemID].StackableAmount. Never add local ownership or
subtract escrow manually. Read fresh InventoryV2 before a mutation and after every result, including
failures, and getMyState after settlement/cancellation. Seller inventory refresh is explicit; no
real-time push is assumed. Cancel active offers; claimBack expired ones (expiry is lazy).

DEV Marketplace uses a card whitelist, Item prices, zero commission/fees, and 24/72/168-hour
durations. VIS remains IsTradable=false. PROD configuration is untouched. Server configuration must
always be read–merge–write per section, then read back. Card IDs must be discovered from actual
server Item definitions, never a local title-configuration JSON.

MarketplaceV2 has a shared IP rate window: controller.call serializes its requests with 650 ms
spacing. Mutations are never automatically retried. The SDK generates a new create key each call;
it exposes no stable caller-supplied key in createListing/createBuyOrder. Lost/invalid create responses
leave a sessionStorage recovery marker scoped by title/user. MY OFFERS must be inspected before
explicitly unlocking another create; it is a recovery hint, never trusted ownership state.

Verification: node --test scripts/marketplace-phase6.test.mjs checks quantities and the controller.
npm run verify runs actual SDK operations against a DEV title with fresh guest accounts; provision
a short-lived, temporary Reward claim granting 7 neko-01-t1 and 8 neko-02-t1 and pass its ID through
IDOS_PHASE6_FIXTURE. Remove only that fixture after the run with a fresh read–merge–write. Never
reset the DEV title or change the Neko Pack pool for this test. Test offers are cancelled in cleanup.
artifacts/phase6/verify.json records the result. Expiry return is implemented but is not covered by
the live 24-hour tests; invalid/elapsed timestamps are covered by local tests.

Preview exposed a pre-existing Store validation mismatch: uploading artwork for more characters
does not automatically add them to the curated server Lootbox pool. Store now selects the candidate
cards by the actual configured Item reward IDs before validating price, slot count and weights.
Do not expand the server pack pool just to match newly uploaded artwork.
