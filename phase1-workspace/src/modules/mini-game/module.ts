import { defineModule, type Module } from "@idosgames/module-sdk";
import { createElement } from "react";
import { OrbMerge } from "./OrbMerge";

// Orb Merge lives inside the standard lobby frame. The Hub selects its route, while the base keeps
// balances, profile and lobby navigation around the game.
export const miniGameModule: Module = defineModule({
  id: "mini-game",
  meta: {
    name: "Toy Merge",
    type: "game",
    genre: "casual",
    engine: "dom",
  },
  setup(ctx) {
    // Full-screen mode: the base hides Lobby tabs and supplies its single Back to Hub button.
    ctx.registerRoute({ id: "orb-merge", label: "Toy Merge", icon: "🧸" });
    ctx.registerPanel({
      id: "orb-merge",
      slot: "overlay",
      component: () =>
        createElement(OrbMerge, {
          navigateToHub: () => ctx.navigate("lobby"),
        }),
    });

    // The game draws to a DOM canvas and uses Matter.js for physics.
    ctx.exposeToAgent({
      state: () => ({ ui: "canvas", mode: ctx.modes.current() }),
      actions: { start: () => ctx.navigate("orb-merge"), hub: () => ctx.navigate("lobby") },
      describeActions: { start: 'start() — enter Toy Merge', hub: 'hub() — return to Hub' },
    });
  },
});
