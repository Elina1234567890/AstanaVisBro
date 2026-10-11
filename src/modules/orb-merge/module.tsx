import { defineModule, type Module } from "@idosgames/module-sdk";
import { ModeStagePanel } from "../../shared/ui/ModeStagePanel";

export const orbMergeModule: Module = defineModule({
  id: "orb-merge",
  meta: { name: "Orb Merge", type: "game", genre: "puzzle", engine: "dom" },
  setup(ctx) {
    ctx.registerRoute({ id: "orb-merge", label: "Orb Merge", icon: "🔮" });
    ctx.registerPanel({
      id: "stage",
      slot: "overlay",
      component: () => (
        <ModeStagePanel
          icon="🔮"
          title="Orb Merge"
          accent="#ff79c9"
          description="Объединяй три соприкасающихся одинаковых шарика и открывай новые тиры."
        />
      ),
    });
    ctx.exposeToAgent({ state: () => ({ ui: "dom", mode: ctx.modes.current(), implemented: false }), describeActions: {} });
  },
});
