import { defineModule, defineTopic, shape, type Module } from "@idosgames/module-sdk";
import { t } from "./i18n";
import { makeCardsScreen } from "./CardsScreen";
import { makeStoreScreen } from "./StoreScreen";

const cardTrade = defineTopic("astanavis-shell:trade-card@1", shape({ itemID: "string" }));
const craftBusy = defineTopic("astanavis-shell:craft-busy@1", shape({ busy: "boolean" }));
const marketBusy = defineTopic("marketplace:busy@1", shape({ busy: "boolean" }));

// Navigation only: remove the Store registration before installing the real Store module.
export const astanavisShellModule: Module = defineModule({
  id: "astanavis-shell",
  meta: { name: "AstanaVis", type: "app", engine: "dom" },
  setup(ctx) {
    let trading = false;
    let crafting = false;
    const listeners = new Set<() => void>();
    ctx.events.on(marketBusy, ({ busy }) => { trading = busy; listeners.forEach(listener => listener()); });
    const options = {
      onTrade: (itemID: string) => { ctx.events.emit(cardTrade, { itemID }); ctx.features.open("marketplace"); },
      onMarketplace: () => ctx.features.open("marketplace"),
      getBusy: () => trading || crafting,
      subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
      beginCraft: () => { if (trading || crafting) return false; crafting = true; ctx.events.emit(craftBusy, { busy: true }); listeners.forEach(listener => listener()); return true; },
      endCraft: () => { crafting = false; ctx.events.emit(craftBusy, { busy: false }); listeners.forEach(listener => listener()); },
    };
    ctx.features.register({
      id: "cards", label: t("cards"), icon: "bag", group: "economy",
      Screen: makeCardsScreen(options),
    });
    ctx.features.register({
      id: "store", label: t("store"), icon: "shop", group: "economy",
      Screen: makeStoreScreen(),
    });
  },
});
