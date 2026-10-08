# AstanaVis shell

Keep the standard base Lobby, FeatureRegistry, one client and host navigation. PlayScreen is the
AstanaVis Hub; VIS remains in the base's ResourceCounter. XP/Level are hidden until server progress
is connected. Orb Merge's temporary button explicitly opens the existing mini-game demo, not Orb
Merge gameplay. Preserve that demo route until real modes replace it.

Cards will use Item/InventoryV2, Craft, Lootbox and Marketplace, not Collection Collectibles.
The astanavis-shell module has informational Cards/Store features only. Remove its `store`
registration before installing the standard Store module to avoid duplicate feature IDs.

Inventory, quests, invite and mailbox source and server configs remain intact, but these modules are
temporarily absent from src/modules.ts to keep exactly five main sections. Platform module changes
regenerate that file: recheck the intended active composition after installing systems in Phase 2.
The mini-game's existing completion integrations are unchanged; it does not award AstanaVis XP/VIS.
