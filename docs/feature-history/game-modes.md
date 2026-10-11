# Game modes

Stage one registers three independent game routes in the shared iDos Games hub. Gameplay is not
implemented yet and the route screens say so explicitly.

- `orb-merge`: Orb Merge. Its future merge rule is three touching equal-tier orbs, never two.
- `color-flow`: Color Flow. Sort coloured liquid between flasks.
- `cake-sort`: Cake Sort. Assemble complete cakes from matching pieces.

All three routes are intentionally marked unavailable until their gameplay specifications are
implemented. The lobby, shared VIS balance, level/XP presentation, collection, store and settings
remain available across modes.

All modes share the one SDK client, so the configured VIS balance, inventory, collection and store
are common across them without cross-module imports.
