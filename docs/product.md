# Product overview

## Vision

AstanaVis Bro is a casual puzzle hub with a vivid anime-inspired identity. Instead of asking players
to rebuild progress in every mini-game, the project gives all modes a shared home: one account, one
VIS economy, one level and one collectible-card album.

## Audience

- mobile and desktop players who enjoy short puzzle sessions;
- collectors motivated by unlocks, sets and visible progression;
- players who prefer switching modes without leaving the same account or economy.

## Core loop

1. Sign in and enter the shared lobby.
2. Choose Orb Merge, Color Flow or Cake Sort.
3. Complete a run or level.
4. Earn shared progression and rewards.
5. Spend VIS, improve the collection and return to any mode.

Steps 1 and the shared shell are implemented. The individual gameplay and result-to-reward loop are
the next milestones.

## Design principles

- **One identity:** progression follows the player across modes.
- **Short sessions:** each game should be understandable quickly and satisfying in a few minutes.
- **Honest state:** unfinished modes are labelled as such rather than simulated with fake data.
- **Modular growth:** a new game joins through the module contract without rewriting the lobby.
- **Accessible motion:** animation respects reduced-motion preferences.

## Current scope

The current build contains the sign-in flow, lobby, profile, store, collections and route/stage UI
for all three games. Gameplay engines, levels, scoring and reward submission are planned work.
