import { defineModule, type Module } from "@idosgames/module-sdk";
import { ModeStagePanel } from "../../shared/ui/ModeStagePanel";

export const cakeSortModule: Module = defineModule({
  id: "cake-sort",
  meta: { name: "Cake Sort", type: "game", genre: "puzzle", engine: "dom" },
  setup(ctx) {
    ctx.registerRoute({ id: "cake-sort", label: "Cake Sort", icon: "🍰" });
    ctx.registerPanel({
      id: "stage",
      slot: "overlay",
      component: () => (
        <ModeStagePanel
          icon="🍰"
          title="Cake Sort"
          accent="#ffd166"
          description="Собирай целые торты из подходящих кусочков и освобождай место для новых десертов."
        />
      ),
    });
    ctx.exposeToAgent({ state: () => ({ ui: "dom", mode: ctx.modes.current(), implemented: false }), describeActions: {} });
  },
});
