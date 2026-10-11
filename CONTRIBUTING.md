# Contributing to AstanaVis Bro

Thanks for helping improve the project.

## Before you start

1. Read `IDOS.md`; it is the source of truth for project structure and iDos Games conventions.
2. Check `docs/feature-history/` for decisions about the feature you are changing.
3. Open an issue or discussion before a large change so that gameplay and platform work stay aligned.

## Development workflow

```bash
npm ci
npm run dev
```

Before opening a pull request, run:

```bash
npm run typecheck
npm run build
```

## Project rules

- Keep platform features and game modes in `src/modules/<module-id>/`.
- Do not import one module from another. Use registered features, routes or typed events.
- Put code in `src/shared/` only when at least two modules need it.
- Do not edit platform-generated `src/idos.title.ts` or platform-owned `src/config.ts`.
- Do not commit `.env.local`, build output, dependencies or export archives.
- Never place secrets, private keys or access tokens in client code.
- Record durable, non-obvious feature decisions in `docs/feature-history/`.

## Pull requests

Keep each pull request focused. Describe what changed, how it was tested and whether the change
requires a Title configuration update in the iDos Games platform.
