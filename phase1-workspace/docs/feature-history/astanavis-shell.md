# AstanaVis shell and Phase 2 game results

Keep the standard base Lobby, FeatureRegistry, one client and host navigation. PlayScreen is the
AstanaVis Hub; VIS remains in the base ResourceCounter. There is no XP or Level in AstanaVis Bro.
Orb Merge is a Matter.js physics game registered as an `inLobby` route. The common Play screen stays
the Hub; selecting its Orb Merge card opens the route inside the base GameFrame, and the in-game Back
button returns to the Hub.

All three stable game IDs (`orb-merge`, `color-flow`, `cake-sort`) use the shared
`astanavis-progress` CloudCode session/result pipeline. The server creates sessions, validates
ownership and elapsed time, caps score bonus, records a result receipt, then grants VIS with a
stable per-user/session `ApplyResourceOperation` Reason for idempotent retries. CloudCode source in
`src/modules/astanavis-progress/server/handlers.js` must be deployed to DEV separately; client code
alone cannot install server handlers. The repo's title configurations do not declare a CloudCode
deployment guard, so deploy these handlers to DEV only until a server-side environment guard or
separate PROD rollout is explicitly configured. Hiding the test panel in the PROD client is not a
server security boundary.

Orb Merge score and best score are separate from VIS. Best score is a local convenience; every round
uses the shared server session/result handlers for VIS.
Cards will use Item/InventoryV2, Craft, Lootbox and Marketplace, not Collection Collectibles.
The astanavis-shell module registers the Cards collection and NEKO PACK Store. Remove its `store`
registration before installing the standard Store module to avoid duplicate feature IDs.

Phase 4 adds Neko card Items (`neko-01-t1`…`neko-06-t2`) as stackable, tradable InventoryV2
resources. The Cards screen groups both tiers by character and reads counts from `InventoryV2`;
Marketplace listing creation escrows items out of that balance. Tier-combine recipes use
`TradeUpCollection` only as a per-character Craft pool filter, never for ownership. Because
CraftService selects by `RarityID` + `CollectionID`, internal `RarityID` values route T1→T2 while
the player's independent display rarity lives in `Metadata.CardRarity` and `rarity:*` tags. The six
recipes are `merge-neko-01-t1-t2`…`merge-neko-06-t1-t2`; each consumes five T1 and has exactly
one positive-weight T2 output. The SDK applies Craft inventory changes atomically, but exposes a
fresh operation key per call rather than a caller-supplied idempotency key; the UI prevents in-flight
double-submit and the server rejects stale/insufficient inventory.

Phase 5 adds `neko-pack` through LootboxService and a dedicated Store screen. The Lootbox definition
charges 100 VIS, caps opens at one, has exactly one slot with one roll, and grants one stackable T1
Item. Its integer weights total 2000: Common 1400 (70%), Rare 500 (25%), Epic 100 (5%); legendary
cards are not in this initial pool. There are no pity rules, reward multipliers, presets, or amount
ranges. The server chooses the reward and applies VIS debit + InventoryV2 grant atomically. The UI
reveals only after a valid server response; on a lost response it refreshes user state and reveals
only when one VIS debit and one T1 stack increase can be reconciled. LootboxService generates an
operation key per call, so the client prevents concurrent submits and never auto-retries a network
failure. The legacy Collection pack config is left untouched and is not used by the Store screen.

Inventory, quests, invite and mailbox source and server configs remain intact, but these modules are
temporarily absent from src/modules.ts to keep exactly five main sections. Platform module changes
regenerate that file: recheck the intended active composition after installing systems in Phase 2.
