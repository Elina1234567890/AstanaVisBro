import { defineModule, type Module } from "@idosgames/module-sdk";
import { ModeStagePanel } from "../../shared/ui/ModeStagePanel";

export const colorFlowModule: Module = defineModule({
  id: "color-flow",
  meta: { name: "Color Flow", type: "game", genre: "puzzle", engine: "dom" },
  setup(ctx) {
    ctx.registerRoute({ id: "color-flow", label: "Color Flow", icon: "🧪" });
    ctx.registerPanel({
      id: "stage",
      slot: "overlay",
      component: () => (
        <ModeStagePanel
          icon="🧪"
          title="Color Flow"
          accent="#62e6b1"
          description="Сортируй цветную жидкость по колбам, пока каждый цвет не окажется отдельно."
        />
      ),
    });
    ctx.exposeToAgent({ state: () => ({ ui: "dom", mode: ctx.modes.current(), implemented: false }), describeActions: {} });
  },
});
