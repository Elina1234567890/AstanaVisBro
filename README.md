# AstanaVis Bro

[![CI](https://github.com/Elina1234567890/AstanaVisBro/actions/workflows/ci.yml/badge.svg)](https://github.com/Elina1234567890/AstanaVisBro/actions/workflows/ci.yml)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![iDos Games](https://img.shields.io/badge/Built%20with-iDos%20Games-ff83cf)](https://idosgames.com/)

> A bright, anime-inspired casual game hub where three puzzle modes share one player profile,
> progression loop, VIS economy, store and collectible-card album.

[Product](docs/product.md) · [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md)

## Project status

AstanaVis Bro is currently an early playable shell exported from the iDos Games platform. Sign-in,
responsive navigation, the lobby, profile, store and collections are integrated. Orb Merge, Color
Flow and Cake Sort are registered as separate routes with polished stage screens; their gameplay
loops are the next development milestone.

The repository intentionally describes the current implementation rather than presenting planned
features as finished.

## Problem and solution

Casual puzzle games often split a player's progress across isolated apps and short-lived sessions.
AstanaVis Bro brings several familiar puzzle loops into one identity:

- one profile and level across every mode;
- one VIS balance and shared reward economy;
- one collectible-card album and store;
- a modular host where a new game can be added without duplicating account, wallet or navigation
  code.

## Game modes

| Mode | Core idea | Current state |
| --- | --- | --- |
| Orb Merge | Merge three touching equal-tier orbs to discover higher tiers | Route and stage UI ready; gameplay planned |
| Color Flow | Sort coloured liquid until every flask contains one colour | Route and stage UI ready; gameplay planned |
| Cake Sort | Assemble complete cakes from matching pieces | Route and stage UI ready; gameplay planned |

## Platform features

- iDos Games authentication and session restoration
- responsive lobby and mode navigation
- shared player level, XP and VIS presentation
- server-backed store and collectible-card album
- profile, language, sound, motion and logout settings
- wallet sign-in integration points
- reusable modular composition through `@idosgames/module-sdk`

## Tech stack

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, responsive DOM components |
| Build | Vite 8 |
| Game platform | iDos Games Core, React UI, App Shell and Module SDK |
| Wallet support | Reown AppKit, Wagmi and Solana Web3.js |
| Quality gates | TypeScript strict mode and GitHub Actions |

## Architecture

```text
Browser
  └─ mountHost()
       ├─ Base module
       │    ├─ Sign-in / access
       │    └─ Lobby / shared navigation
       ├─ Platform modules
       │    ├─ Profile
       │    ├─ Store
       │    └─ Collections
       ├─ Game routes
       │    ├─ Orb Merge
       │    ├─ Color Flow
       │    └─ Cake Sort
       └─ One IDosGamesClient
            └─ iDos Games API and Title configuration
```

The host creates exactly one SDK client. Modules communicate through platform features, routes and
events instead of importing one another. See [the architecture guide](docs/architecture.md) for the
full breakdown.

## Quick start

### Prerequisites

- Node.js `20.19+` or `22.12+`
- npm

### Run locally

```bash
git clone https://github.com/Elina1234567890/AstanaVisBro.git
cd AstanaVisBro
npm ci
npm run dev
```

The production Title identity is already generated in `src/idos.title.ts`. Optional local overrides
can be copied from `.env.example` into `.env.local`.

### Validate a change

```bash
npm run typecheck
npm run build
```

## Repository layout

```text
src/
  base/                 sign-in, lobby and shared host UI
  modules/              platform features and game modes
  shared/               code used by more than one module
  app.config.ts         start route and lobby order
  ui.config.ts          global theme, motion and sound
  modules.ts            active module composition
docs/
  architecture.md
  product.md
  roadmap.md
  feature-history/      durable implementation decisions
```

Generated build output, dependencies and platform export archives are deliberately excluded from
version control.

## Roadmap

- [x] iDos Games host, sign-in and responsive lobby
- [x] Shared profile, VIS presentation, store and collections
- [x] Three independently registered puzzle routes
- [ ] Implement the Orb Merge core loop and scoring
- [ ] Implement Color Flow levels and win detection
- [ ] Implement Cake Sort levels and win detection
- [ ] Connect game results to shared progression and rewards
- [ ] Add automated gameplay tests and a public demo

The milestone breakdown lives in [docs/roadmap.md](docs/roadmap.md).

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and the project-specific agent guide in
[IDOS.md](IDOS.md) before making structural changes.

## License

No open-source license has been granted yet. The source is public for review, but reuse requires
permission from the repository owner.
