import { defineModule, type Module } from "@idosgames/module-sdk";
import { makeMiniGamePanel } from "./MiniGamePanel";
import { t } from "./i18n";

// The smallest complete game module: a mode of its own (a route + one full-screen panel, no scene)
// that the base's lobby offers as "Play". It is what a new title gets when no other game fits the idea
// — the placeholder the real game replaces, with the same contract: register a route, draw the mode,
// and leave the lobby, balances and wallet to the base.
export const miniGameModule: Module = defineModule({
  id: "mini-game",
  meta: {
    name: "Mini-game",
    type: "game",
    genre: "casual",
    engine: "dom",
  },
  setup(ctx) {
    ctx.registerRoute({ id: "mini-game", label: t("title"), icon: "⭐" });
    ctx.registerPanel({
      id: "round",
      slot: "overlay",
      component: makeMiniGamePanel(ctx.features),
    });

    // The round is ordinary React in the DOM: an agent reads it and presses its buttons like a person.
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", mode: ctx.modes.current() }),
      describeActions: {},
    });
  },
});
