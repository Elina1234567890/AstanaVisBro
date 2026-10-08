import { defineModule, defineTopic, shape, type Module } from "@idosgames/module-sdk";
import { makeMarketplaceScreen } from "./MarketplaceScreen";
import { createTradeController } from "./barter-model";

// Copy of the emitter's typed topic; no import from astanavis-shell.
const cardTrade = defineTopic("astanavis-shell:trade-card@1", shape({ itemID: "string" }));
const marketBusy = defineTopic("marketplace:busy@1", shape({ busy: "boolean" }));
const craftBusy = defineTopic("astanavis-shell:craft-busy@1", shape({ busy: "boolean" }));
export const marketplaceModule: Module = defineModule({
  id: "marketplace",
  meta: { name: "Marketplace", type: "app", engine: "dom" },
  setup(ctx) {
    const controller = createTradeController();
    controller.subscribe(() => ctx.events.emit(marketBusy, { busy: controller.getSnapshot() }));
    ctx.events.on(cardTrade, ({ itemID }) => { controller.draft = itemID; });
    // The same controller locks market actions while Craft is in flight, across navigation.
    ctx.events.on(craftBusy, ({ busy }) => { if (busy) controller.acquire(); else controller.release(); });
    ctx.features.register({
      id: "marketplace", label: "Обмен", icon: "market", group: "economy", order: 70,
      Screen: makeMarketplaceScreen(ctx.features, controller),
    });
    ctx.exposeToAgent({ state: () => ({ ui: "dom", feature: "marketplace", pending: controller.getSnapshot() }), describeActions: {} });
  },
});
