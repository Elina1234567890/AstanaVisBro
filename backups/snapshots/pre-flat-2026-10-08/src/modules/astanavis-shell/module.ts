import { defineModule, type Module } from "@idosgames/module-sdk";
import { makePlaceholderScreen, t } from "./PlaceholderScreen";

// Navigation only: remove the Store registration before installing the real Store module.
export const astanavisShellModule: Module = defineModule({
  id: "astanavis-shell",
  meta: { name: "AstanaVis", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "cards", label: t("cards"), icon: "bag", group: "economy",
      Screen: makePlaceholderScreen("cards"),
    });
    ctx.features.register({
      id: "store", label: t("store"), icon: "shop", group: "economy",
      Screen: makePlaceholderScreen("store"),
    });
  },
});
