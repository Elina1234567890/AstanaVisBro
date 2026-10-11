import {
  useSyncExternalStore,
  type ComponentType,
  type ReactNode,
} from "react";
import type {
  FeatureRegistry,
  FeatureScreenProps,
  ModeEntry,
  ModeRegistry,
  MultiplayerRegistry,
} from "@idosgames/module-sdk";
import { useUserState } from "@idosgames/react";
import {
  Button,
  Icon,
  outlined,
  panel,
  useGameLayout,
  useStagger,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import { gameModes } from "./model";
import { t } from "./i18n";

interface ModePresentation {
  icon: string;
  eyebrow: string;
  description: string;
  accent: string;
}

const MODE_PRESENTATION: Record<string, ModePresentation> = {
  "orb-merge": {
    icon: "🔮",
    eyebrow: "MERGE PUZZLE",
    description: "Объединяй три одинаковых шарика и открывай новые тиры.",
    accent: "#ff79c9",
  },
  "color-flow": {
    icon: "🧪",
    eyebrow: "LIQUID SORT",
    description: "Разлей цветную жидкость по отдельным колбам.",
    accent: "#62e6b1",
  },
  "cake-sort": {
    icon: "🍰",
    eyebrow: "SWEET PUZZLE",
    description: "Собирай целые торты из подходящих кусочков.",
    accent: "#ffd166",
  },
};

interface PlayerProgress {
  level: number;
  xp: number;
  xpToNext: number;
}

function playerProgress(value?: string | null): PlayerProgress {
  const fallback = { level: 1, xp: 0, xpToNext: 100 };
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as Partial<PlayerProgress>;
    const level = Math.max(1, Math.floor(Number(parsed.level ?? 1)));
    const xpToNext = Math.max(1, Math.floor(Number(parsed.xpToNext ?? 100)));
    const xp = Math.max(0, Math.min(xpToNext, Math.floor(Number(parsed.xp ?? 0))));
    return { level, xp, xpToNext };
  } catch {
    return fallback;
  }
}

// The Play screen is the responsive game hub. The modes are navigable so their scope can be
// reviewed, but every card and destination states clearly that gameplay is not implemented yet.
export function makePlayScreen(
  modes: ModeRegistry,
  navigate: (modeId: string) => void,
  online: MultiplayerRegistry,
  features: FeatureRegistry,
): ComponentType<FeatureScreenProps> {
  return function PlayScreen(): ReactNode {
    const list = useSyncExternalStore(modes.subscribe, modes.list, modes.list);
    const onlineGames = useSyncExternalStore(
      online.subscribe,
      online.listGames,
      online.listGames,
    );
    const rooms = useSyncExternalStore(
      features.subscribe,
      () => features.get("multiplayer")?.available === true,
      () => false,
    );
    const state = useUserState();
    const layout = useGameLayout();
    const games = gameModes(list);
    const stagger = useStagger();
    const kit = useUiKit();
    const progress = playerProgress(
      state?.CustomData?.ReadOnly?.["astanavis-progress"]?.Value,
    );
    const vis = Math.max(
      0,
      Number(state?.InventoryV2?.VirtualCurrencies?.VIS?.Amount ?? 0),
    );
    const xpPercent = Math.min(100, (progress.xp / progress.xpToNext) * 100);
    const phone = layout === "phone";

    const start = (mode: ModeEntry): void => {
      kit.play("open");
      navigate(mode.id);
    };

    return (
      <div style={{ display: "grid", gap: phone ? 14 : 20, paddingBottom: 8 }}>
        <section
          className="idos-shine"
          style={{
            ...panel,
            position: "relative",
            overflow: "hidden",
            padding: phone ? 18 : 26,
            display: "grid",
            gap: 16,
            background:
              "radial-gradient(circle at 90% 0%, rgba(255,121,201,.36), transparent 38%), radial-gradient(circle at 12% 105%, rgba(98,230,177,.24), transparent 38%), linear-gradient(135deg, #543087 0%, #2a1756 100%)",
          }}
        >
          <div style={{ position: "relative", display: "grid", gap: 8 }}>
            <span style={{ color: v.gold, fontSize: 12, fontWeight: 900, letterSpacing: 1.4 }}>
              ТРИ ИГРЫ · ОДИН ПРОГРЕСС
            </span>
            <h1 style={{ ...outlined, margin: 0, fontSize: phone ? 30 : 42, lineHeight: 1 }}>
              AstanaVis Bro
            </h1>
            <p style={{ margin: 0, maxWidth: 680, color: v.textDim, fontSize: phone ? 14 : 16, lineHeight: 1.5, fontWeight: 700 }}>
              Залипательные головоломки, общая валюта VIS и коллекция анимешных
              кошкодевочек.
            </p>
          </div>

          <div
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: phone ? "1fr" : "minmax(0, 1fr) auto auto",
              gap: 10,
              alignItems: "center",
            }}
          >
            <div style={{ padding: "10px 12px", borderRadius: 16, background: "rgba(12, 7, 35, .38)", border: "1px solid rgba(255,255,255,.13)", display: "grid", gap: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, ...outlined, fontSize: 13 }}>
                <span>Уровень {progress.level}</span>
                <span style={{ color: v.textDim }}>{progress.xp} / {progress.xpToNext} XP</span>
              </div>
              <div style={{ height: 10, borderRadius: 999, overflow: "hidden", background: "rgba(255,255,255,.12)", boxShadow: "inset 0 1px 3px rgba(0,0,0,.35)" }}>
                <div style={{ width: `${xpPercent}%`, height: "100%", borderRadius: 999, background: "linear-gradient(90deg, #62e6b1, #7be8ff)", transition: "width .35s ease" }} />
              </div>
            </div>
            <StatChip icon="✦" label="VIS" value={Math.round(vis).toLocaleString("ru-RU")} accent="#ffd166" />
            <StatChip icon="♡" label="Карточки" value="Коллекция" accent="#ff79c9" />
          </div>
        </section>

        <div
          style={{
            display: "grid",
            gap: 14,
            gridTemplateColumns: phone
              ? "minmax(0, 1fr)"
              : "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {games.map((game, i) => {
            const view = MODE_PRESENTATION[game.id] ?? {
              icon: game.icon ?? "✨",
              eyebrow: "MINI GAME",
              description: "Новый игровой режим AstanaVis Bro.",
              accent: v.blue,
            };
            return (
              <article
                key={game.id}
                className="idos-shine"
                style={{
                  ...panel,
                  ...stagger(i),
                  position: "relative",
                  overflow: "hidden",
                  padding: phone ? 18 : 20,
                  minHeight: phone ? 214 : 300,
                  display: "grid",
                  alignContent: "space-between",
                  gap: 16,
                  borderColor: view.accent,
                  background: `radial-gradient(circle at 80% 0%, color-mix(in srgb, ${view.accent} 32%, transparent), transparent 42%), linear-gradient(180deg, color-mix(in srgb, ${view.accent} 12%, ${v.panel}) 0%, ${v.panel} 100%)`,
                }}
              >
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <span className="idos-bounce" aria-hidden="true" style={{ fontSize: phone ? 54 : 68, filter: `drop-shadow(0 9px 18px color-mix(in srgb, ${view.accent} 55%, transparent))` }}>
                      {view.icon}
                    </span>
                    <span style={{ padding: "5px 9px", borderRadius: 999, background: `color-mix(in srgb, ${view.accent} 20%, transparent)`, color: view.accent, fontWeight: 900, fontSize: 11, letterSpacing: 0.7 }}>
                      СКОРО
                    </span>
                  </div>
                  <div>
                    <div style={{ color: view.accent, fontSize: 10, fontWeight: 900, letterSpacing: 1.2 }}>{view.eyebrow}</div>
                    <h2 style={{ ...outlined, margin: "5px 0 7px", fontSize: 24 }}>{game.label}</h2>
                    <p style={{ margin: 0, color: v.textDim, lineHeight: 1.45, fontSize: 14 }}>{view.description}</p>
                  </div>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  <Button tone="blue" size="lg" onClick={() => start(game)} data-tutorial-anchor={`play:${game.id}`}>
                    Подробнее · недоступно
                  </Button>
                  {rooms && onlineGames.some((g) => g.mode === game.id) ? (
                    <Button tone="blue" onClick={() => features.open("multiplayer", { mode: game.id })}>
                      <Icon glyph="friends" size={18} /> С друзьями
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        {games.length === 0 ? (
          <div style={{ ...outlined, color: v.textDim, textAlign: "center" }}>
            {t("noFeatures")}
          </div>
        ) : null}
      </div>
    );
  };
}

function StatChip({
  icon,
  label,
  value,
  accent,
}: {
  icon: string;
  label: string;
  value: string;
  accent: string;
}): ReactNode {
  return (
    <div style={{ minWidth: 126, padding: "9px 12px", borderRadius: 16, background: "rgba(12, 7, 35, .38)", border: "1px solid rgba(255,255,255,.13)", display: "flex", alignItems: "center", gap: 9 }}>
      <span aria-hidden="true" style={{ color: accent, fontSize: 22 }}>{icon}</span>
      <span style={{ display: "grid", lineHeight: 1.1 }}>
        <small style={{ color: v.textDim, fontWeight: 800 }}>{label}</small>
        <strong style={{ ...outlined, fontSize: 14 }}>{value}</strong>
      </span>
    </div>
  );
}
