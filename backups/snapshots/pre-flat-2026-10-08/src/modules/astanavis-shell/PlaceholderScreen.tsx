import type { ComponentType, ReactNode } from "react";
import type { FeatureScreenProps } from "@idosgames/module-sdk";
import { Icon, makeT, panel, v } from "@idosgames/react/ui";

const EN = {
  cards: "Cards", store: "Store", soon: "Coming soon",
  cardsTitle: "Catgirls included, bro.",
  cardsText: "Neko Stars cards will be here. Collect characters and merge their tiers. In development, bro.",
  storeTitle: "Packs are coming, bro.",
  storeText: "New packs will be here. The store is in development, bro.",
} as const;
export const t = makeT<keyof typeof EN>(EN, {
  cards: "Карты", store: "Магазин", soon: "Скоро",
  cardsTitle: "Кошкодевочки впридачу, бро.",
  cardsText: "Здесь будут карты Neko Stars. Собирай персонажей и объединяй их Tier. Пока в разработке, бро.",
  storeTitle: "Наборы в пути, бро.",
  storeText: "Здесь будут новые наборы. Магазин пока в разработке, бро.",
});

export function makePlaceholderScreen(kind: "cards" | "store"): ComponentType<FeatureScreenProps> {
  return function PlaceholderScreen(): ReactNode {
    return (
      <section style={{ ...panel, padding: "clamp(24px, 5vw, 56px)", maxWidth: 760, margin: "24px auto", textAlign: "center" }}>
        <div aria-hidden="true" style={{ display: "grid", placeItems: "center", minHeight: 160, borderRadius: 24, background: `radial-gradient(ellipse, color-mix(in srgb, ${kind === "cards" ? v.red : v.gold} 35%, ${v.panel}), ${v.panel})` }}>
          <Icon glyph={kind === "cards" ? "bag" : "gift"} size={86} />
        </div>
        <p style={{ color: v.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase" }}>NEKO STARS · {t("soon")}</p>
        <h1 style={{ fontSize: "clamp(25px, 4vw, 38px)", lineHeight: 1.15, color: v.text }}>{t(kind === "cards" ? "cardsTitle" : "storeTitle")}</h1>
        <p style={{ color: v.textDim, lineHeight: 1.75, maxWidth: 470, margin: "18px auto 0" }}>{t(kind === "cards" ? "cardsText" : "storeText")}</p>
      </section>
    );
  };
}
