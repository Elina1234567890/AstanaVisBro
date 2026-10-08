# Phase 6 validation — 2026-10-08

DEV title: 1ZPS8DLV-DEV. PROD data/configuration and deployment remain untouched.

- TypeScript: npm run typecheck passed.
- Build: Vite passed (existing wagmi/viem warning and large-chunk warnings remain).
- Local tests: 8 passed (quantities, barter bundle, inventory/escrow availability, expired timestamps,
  request serialization, curated Lootbox validation).
- Live SDK: npm run verify passed all 9 scenarios; details in verify.json.
- UI preview: new guest obtained Julie via the configured 100-VIS pack; TRADE prefilled Julie;
  Create Offer escrowed 1 Julie and displayed 0 available / 1 escrow; the Cards view immediately
  showed it locked; Cancel Offer restored 1 available / 0 escrow and re-enabled Create Offer.
- Staged DEV: full catalog, offer form and insufficient-card guard loaded from the real DEV API.
- Temporary Reward fixture removed and read back; all test offers closed by cancellation or buy/fill.

Escrow is server-owned. Listings debit offered cards; BuyOrders debit the payment bundle.
Settlement and inventory writes are atomic server transactions. The tests checked exact changes
to both accounts, rejection of a second buy/fill, insufficient balances, and competing operations.

MVP limitations: public offers, one offered card kind and one requested card kind, 1–999 units,
full settlement only, no arbitrary quantity DirectTrade or Collection trading. VIS is not tradable
and is not included in barter prices. Listings/BuyOrders expire after 24/72/168 hours; expired
escrow requires RECLAIM ESCROW. Live expiry was not waited out; its UI timestamp guard has local
test coverage. Lost create responses require inspecting MY OFFERS before manually unlocking a
new create; the SDK cannot accept a caller-controlled stable create idempotency key.
