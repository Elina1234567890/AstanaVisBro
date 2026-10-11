import { defineModule, type Module } from "@idosgames/module-sdk";
import { configSection } from "@idosgames/react/ui";
import { CollectionsScreen, makeCollectionsWatcher } from "./CollectionsScreen";
import { hasTitleData, type CollectionSection } from "./model";
import { t } from "./i18n";

// Collections as a feature of the game: the album, packs and chests, trades with friends. The
// watcher keeps the badge (set rewards and the grand prize waiting) — only on a title with a
// collection.
export const collectionsModule: Module = defineModule({
  id: "collections",
  meta: { name: "Collections", type: "app", engine: "dom" },
  setup(ctx) {
    ctx.features.register({
      id: "collections",
      label: t("title"),
      icon: "star",
      group: "events",
      order: 45,
      available: false,
      Screen: CollectionsScreen,
    });
    const enabled = hasTitleData(
      configSection<CollectionSection>(ctx.client, "Collection"),
    );
    ctx.features.setAvailable(
      "collections",
      enabled,
      "no collection on the title (Collection)",
    );
    if (enabled)
      ctx.registerPanel({
        id: "badge",
        slot: "modal",
        activeOnly: false,
        component: makeCollectionsWatcher(ctx.features),
      });
    ctx.exposeToAgent({
      state: () => ({ ui: "dom", feature: "collections" }),
      describeActions: {},
    });
  },
});

