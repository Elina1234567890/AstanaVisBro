import { defineModule, type Module } from "@idosgames/module-sdk";
import { createProgressService } from "./service";
import { makeProgressScreen } from "./ProgressScreen";
export const astanavisProgressModule: Module = defineModule({
  id: "astanavis-progress",
  meta: { name: "AstanaVis Progress", type: "app", engine: "dom" },
  setup(ctx) { ctx.features.register({ id: "astanavis-progress", label: "Game Results", available: false, Screen: makeProgressScreen(createProgressService(ctx.client)) }); },
});
