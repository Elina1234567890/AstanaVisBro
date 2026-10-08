# SCORE / VIS verification — 8 October 2026

Implemented locally; no deployment or publication was performed.

## Changed existing files
- src/modules/mini-game/OrbMerge.tsx
- src/modules/mini-game/orbConfig.ts
- src/modules/mini-game/orbBalance.ts
- src/modules/mini-game/orbMerge.css
- src/modules/astanavis-progress/server/handlers.js
- src/modules/astanavis-progress/GameResult.tsx
- docs/feature-history/orb-merge.md
- docs/feature-history/README.md
- .phase2-unit.mjs
- .phase2-recovery.mjs
- .phase2-validation.mjs

## New files
- src/modules/mini-game/orbBalance.ts
- src/modules/mini-game/orbScore.ts
- src/modules/mini-game/orbMotion.ts
- src/modules/astanavis-progress/server/balance.js
- scripts/build-cloudcode.mjs
- scripts/orb-score.test.mjs
- scripts/orb-assets.test.mjs
- scripts/orb-motion.test.mjs
- scripts/optimize-orb-toys.py
- public/assets/orb-merge/tier-1.webp through tier-10.webp

Generated: artifacts/astanavis-cloudcode.js, this report, desktop/mobile screenshots and astanavis-orb-merge-score-vis.zip.

## Actual constants
- Created T2/T3/T4/T5/T6/T7/T8/T9/T10 SCORE: 10 / 25 / 60 / 140 / 300 / 650 / 1400 / 3000 / 6500.
- First T4/T5/T6/T7/T8 bonus: 50 / 150 / 400 / 1000 / 2500 SCORE.
- Combo window: 1500 ms inclusive; multipliers: 1 / 1.2 / 1.4 / 1.6 / 1.8 / 2, max 2.
- Chain multipliers: 1 / 1.25 / 1.5 / 1.75 / 2, max 2.
- Final multiplier cap: 3; Math.round per merge. Milestones are added without multiplication.
- VIS: baseVisReward 20, scorePerVisStep 200, visPerStep 5, maxScoreBonusVis 100, maxSessionVis 120.
- Server accepts nonnegative safe-integer SCORE up to Number.MAX_SAFE_INTEGER; minimum session duration 2000 ms, maximum 3600000 ms.
- T9 gets 3000 and the newly configured final T10 gets 6500 SCORE; no extra milestone is introduced for either.
- Ten supplied PNG toys map by filename to T1–T10. Optimized WebP textures total 163,024 bytes versus 945,035 source bytes.
- Wall spring duration 360 ms, maximum squash 0.22, wall spin factor 0.018, launch spin 0.075, angular velocity cap 0.2.

## Passed
- npm run typecheck
- npm run build (existing wallet dependency export warning and large-chunk warning)
- node scripts/orb-score.test.mjs
- node scripts/orb-assets.test.mjs
- node scripts/orb-motion.test.mjs
- node .phase3-merge.mjs (including real simultaneous Matter.js contacts)
- node .phase2-unit.mjs
- node .phase2-recovery.mjs
- node .phase2-validation.mjs
- Browser preview: DEV guest login, Hub → Orb Merge; desktop 1440×900, mobile 390×844 and compact mobile 360×640. No horizontal overflow at 360 px. The canvas and controls fit the tested viewports; error feedback remains readable.

## Blocked live checks
The current DEV title reports: CloudCode is disabled for this title. A live game cannot start, so live scoring, game over, VIS receipt and leaderboard completion cannot be certified. The new server bundle has not been installed. Enable CloudCode in DEV and install artifacts/astanavis-cloudcode.js as one source bundle before these checks. Preview runs locally at http://127.0.0.1:5182/.

Server reward tests are contract simulations. Settled results are protected by server state; pending recovery/concurrency additionally relies on the existing ApplyResourceOperation Reason deduplication contract. Verify that primitive on the actual DEV server before release; mocks cannot prove it.

Score integrity remains limited: the server validates identity, ownership, elapsed time, safe-integer score, allowed fields and reward bounds, but does not replay or verify merges. BEST is a local convenience with the existing leaderboard submission integration when configured. No leaderboard is configured or created by this change. Leaderboard failure is separate from VIS settlement.

## Archive
The ZIP contains current source, configuration, documentation, scripts and the server bundle. It excludes node_modules, generated dist, local environment secrets and other existing ZIP files. It is a local snapshot, not a deployment.
