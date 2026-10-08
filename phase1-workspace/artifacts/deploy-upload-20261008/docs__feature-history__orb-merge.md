# Orb Merge SCORE and VIS — 2026-10-08

Three connected equal-tier orbs produce one next-tier orb. The physics resolver reserves every input ID before removing inputs and creating results. Drops, contacts and elapsed time grant no points and no VIS.

Gameplay balance lives in `src/modules/mini-game/orbBalance.ts`; appearance and physics remain in `orbConfig.ts`. `OrbScore` owns session score, the monotonic combo clock and once-per-session milestones. Starting again creates a fresh scoring instance. SCORE has no artificial 100,000 cap.

Created Tier → base SCORE: T2 10, T3 25, T4 60, T5 140, T6 300, T7 650, T8 1400, T9 3000, T10 6500. T9 and T10 continue the requested data-driven curve.
Milestones: T4 +50, T5 +150, T6 +400, T7 +1000, T8 +2500.
Combo window: inclusive 1500 ms; multipliers 1, 1.2, 1.4, 1.6, 1.8, 2 (cap 2).
Chain depth multipliers: 1, 1.25, 1.5, 1.75, 2 (cap 2).
Final multiplier: min(combo × chain, 3). Each merge rounds independently before adding the unmultiplied milestone.

Every successful shot increments an action ID. Merge results inherit that action ID and one plus the maximum depth among consumed descendants of this shot. Old-shot ancestry resets to depth 1 when consumed after a new shot. Independent branches in one frame share their generation depth; they do not increment each other's chain bonus. A moving descendant can continue its chain in later physics frames. This ancestry model does not attempt to infer indirect momentum causality through unrelated orbs.

SCORE updates immediately, canvas popups show merge points and separate NEW TIER bonuses. HUD shows combo and chain; the shared game-over popup shows grouped SCORE, BEST, server-confirmed VIS and the two navigation actions. Best remains a local convenience when no title leaderboard exists. When a title leaderboard is enabled, completed SCORE is submitted through the existing SDK/pickLeaderboard mechanism. No second leaderboard is created. A failed leaderboard submission does not invalidate the settled VIS receipt.

Server economy lives in `src/modules/astanavis-progress/server/balance.js`: baseVisReward 20, scorePerVisStep 200, visPerStep 5, maxScoreBonusVis 100, maxSessionVis 120. The shared game-result pipeline applies min(120, 20 + min(floor(score / 200) × 5, 100)). Its three game IDs use this shared economy. Client submits gameId, score and the server-issued sessionId, never a reward amount.

Run `node scripts/build-cloudcode.mjs` to concatenate server balance and handlers into `artifacts/astanavis-cloudcode.js`. Deploy that bundle together, not handlers.js alone. This change is local and is NOT deployed or published. Existing remote handlers keep their old economy until separately updated.

Protection uses the existing server-owned session, unique result ID and stable per-user/session ApplyResourceOperation Reason. Ownership, score consistency, allowed input fields and server duration are checked. Retry of a settled result does not grant again. Failure after grant is recovered with the same operation key. Tests simulate the platform's documented project contract that repeated Reasons deduplicate grants; they do not establish the behavior of an undeployed live server. That primitive must be verified in DEV before release, especially for concurrent requests and failure after grant. LocalStorage is used only for convenient BEST, never VIS authorization.

Limitation: score is client-reported, not replay-verified. Safe-integer validation, server-issued sessions, elapsed time, ownership, field validation and the 120 VIS cap do not prove honest gameplay. No XP, Level or card-tier coupling is added.

The visual tier set uses the supplied toy art in filename order, `1.PNG` through `10.PNG`. Optimized transparent WebP textures live in `public/assets/orb-merge/` and total about 163 KB, down from about 945 KB of source PNG data. Transparent padding is cropped, only oversized inputs are downscaled for the game's two-device-pixel render target, and all ten images are asynchronously decoded once and reused from an in-memory cache. Gameplay keeps deterministic circular Matter.js colliders; the transparent art is contained inside the matching collider and rotates with its body. Shots receive a capped initial spin, merges retain damped average spin, and wall contacts add capped tangential spin. Wall bounces use a 360 ms directional squash/overshoot envelope: side walls compress X, horizontal walls compress Y, then the texture springs back without changing its collider. `scripts/optimize-orb-toys.py` reproducibly rebuilds the textures without changing the source files.

Validation: TypeScript and production build pass. `scripts/orb-score.test.mjs` covers all score tiers, group sizes, duplicate contacts, combo boundaries/reset/cap, ancestry/new-shot chain, combined cap, milestones, rounding, restart state, all requested reward boundaries, large score, replay/ownership/mismatch/injection, failure-after-grant recovery and result/leaderboard wiring. `.phase3-merge.mjs` also tests simultaneous contacts in Matter.js. Live client, mobile/desktop and deployment validation status is recorded in the accompanying verification report.
