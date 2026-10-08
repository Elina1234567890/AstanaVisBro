import { useSyncExternalStore, type ComponentType, type CSSProperties, type ReactNode } from "react";
import type { FeatureRegistry, FeatureScreenProps, ModeRegistry, MultiplayerRegistry } from "@idosgames/module-sdk";
import { Button, makeT, usePlayerPrefs, useUiKit, v } from "@idosgames/react/ui";

const EN = {
  welcome: "THE GAMES FROM THE ADS, BRO", intro: "Here are the games from the ads you wanted, bro. Catgirls included, bro.",
  choose: "PICK ONE, BRO", chooseHint: "Three games. No extra noise.",
  orb: "Smash matching orbs together. Go bigger.",
  flow: "Sort the colors. Control the chaos.",
  cake: "Sort the slices. Keep your head straight.",
  prototype: "Temporary entry: opens the existing tap-the-stars demo.",
  soon: "In development, bro.",
  footer: "GAMES. CATGIRLS. BRO.",
} as const;
const t = makeT<keyof typeof EN>(EN, {
  welcome: "ТЕ САМЫЕ ИГРЫ ИЗ РЕКЛАМЫ, БРО", intro: "Держи те игры из рекламы, которые ты так хотел, бро. Кошкодевочки впридачу, бро.",
  choose: "ВЫБИРАЙ, БРО", chooseHint: "Три игры. Без лишнего.",
  orb: "Сливай одинаковые сферы. Собирай больше.",
  flow: "Разложи цвета. Укрощай хаос.",
  cake: "Сортируй кусочки. Не потеряй голову.",
  prototype: "Временный вход: открывает существующее демо «Поймай звёзды».",
  soon: "В разработке, бро.",
  footer: "ИГРЫ. КОШКОДЕВОЧКИ. БРО.",
});

const games = [
  { id: "orb-merge", name: "ORB MERGE", description: "orb", tone: "blue", number: "01" },
  { id: "color-flow", name: "COLOR FLOW", description: "flow", tone: "green", number: "02" },
  { id: "cake-sort", name: "CAKE SORT", description: "cake", tone: "red", number: "03" },
] as const;

// Keep the base's factory contract: Lobby and FeatureRegistry still own the Play tab.
// VIS stays in LobbyHeader. No provisional XP/Level or second balance is rendered here.
export function makePlayScreen(
  modes: ModeRegistry,
  navigate: (modeId: string) => void,
  _online: MultiplayerRegistry,
  _features: FeatureRegistry,
): ComponentType<FeatureScreenProps> {
  return function PlayScreen(): ReactNode {
    const routes = useSyncExternalStore(modes.subscribe, modes.list, modes.list);
    const prototype = routes.some((route) => route.id === "mini-game" && route.moduleType === "game");
    const kit = useUiKit();
    const [prefs] = usePlayerPrefs();
    return (
      <section className="av-hub" data-reduced-motion={prefs.reducedMotion}>
        <style>{hubStyles}</style>
        <header className="av-hero">
          <div className="av-hero-copy">
            <p className="av-eyebrow">// {t("welcome")}</p>
            <h1>ASTANAVIS,<br /><span>BRO<span className="av-title-star" aria-hidden="true">+</span></span></h1>
            <p className="av-intro">{t("intro")}</p>
          </div>
          <div className="av-hero-art" aria-hidden="true"><span className="av-smile">BRO.</span><span className="av-mini-star">+</span><span className="av-hero-pill">NO CAP. JUST GAMES.</span></div>
        </header>
        <div className="av-section-heading"><div><h2>{t("choose")}</h2><p>{t("chooseHint")}</p></div><span aria-hidden="true">///</span></div>
        <div className="av-games">
          {games.map((game) => {
            const playable = game.id === "orb-merge" && prototype;
            return (
              <article key={game.id} className={`av-game av-${game.id}`} style={{ "--av-tone": v[game.tone] } as CSSProperties}>
                <div className="av-art" aria-hidden="true">
                  <span className="av-game-number">{game.number}</span><span className="av-spark">✧</span>
                  <GameArt game={game.id} />
                  <span className="av-art-caption">{game.id === "orb-merge" ? "GO BIGGER" : game.id === "color-flow" ? "CONTROL THE CHAOS" : "CAKE. NO CAP."}</span>
                </div>
                <div className="av-card-copy">
                  <span className="av-status">{playable ? "PROTOTYPE" : "COMING SOON"}</span>
                  <h3>{game.name}</h3>
                  <p className="av-description">{t(game.description)}</p>
                  <Button tone={game.tone} size="lg" disabled={!playable} style={{ width: "100%", minHeight: 52 }}
                    onClick={() => { if (playable) { kit.play("open"); navigate("mini-game"); } }}
                    aria-describedby={`av-note-${game.id}`} data-tutorial-anchor={`play:${game.id}`}>
                    {playable ? "PLAY / PROTOTYPE →" : "COMING SOON"}
                  </Button>
                  <p className="av-note" id={`av-note-${game.id}`}>{t(playable ? "prototype" : "soon")}</p>
                </div>
              </article>
            );
          })}
        </div>
        <p className="av-footer">// {t("footer")}</p>
      </section>
    );
  };
}

function GameArt({ game }: { game: string }): ReactNode {
  if (game === "orb-merge") return <div className="av-orbs">{[v.red, v.green, v.gold, v.blue, v.red].map((color, i) => <div key={i} className={`av-orb av-orb-${i}`} style={{ "--av-orb": color } as CSSProperties}><span>✦</span></div>)}</div>;
  if (game === "color-flow") return <div className="av-tubes">{[0, 1, 2].map((i) => <div className={`av-tube av-tube-${i}`} key={i}><div className="av-liquid"><i /><i /><i /></div></div>)}</div>;
  return <div className="av-cakes">{[v.red, v.gold, v.blue].map((color, i) => <div className={`av-cake av-cake-${i}`} key={i} style={{ "--av-cake": color } as CSSProperties}><div className="av-frosting" /><div className="av-cherry" /><div className="av-cake-layer" /><div className="av-cake-stripe" /></div>)}</div>;
}

const hubStyles = `
.av-hub{container-type:inline-size;color:var(--idos-ui-text);padding:20px 0 4px}
.av-hub *{box-sizing:border-box}
.av-hero{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:42px 0 36px;border-bottom:1px solid var(--idos-ui-panel-edge)}
.av-hero-copy{max-width:670px}
.av-eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:var(--idos-ui-text-dim);margin:0 0 22px}
.av-hero h1{font-size:clamp(40px,7.6cqw,88px);font-weight:900;letter-spacing:-3px;line-height:.98;margin:0}
.av-hero h1>span{color:var(--idos-ui-gold)}
.av-title-star{display:inline-block;color:var(--idos-ui-red);margin-left:18px;font-size:.7em}
.av-intro{font-size:17px;font-weight:500;line-height:1.65;color:var(--idos-ui-text);margin:25px 0 0;max-width:610px}
.av-hero-art{position:relative;flex:0 0 220px;height:190px;display:grid;place-items:center}
.av-smile{display:grid;place-items:center;width:180px;height:140px;border:2px solid var(--idos-ui-bg-bottom);transform:rotate(-9deg);font-size:42px;font-weight:900;letter-spacing:-2px;color:var(--idos-ui-bg-bottom);background:var(--idos-ui-gold);box-shadow:9px 9px 0 var(--idos-ui-blue)}
.av-mini-star{position:absolute;right:-2px;top:-7px;font-size:60px;color:var(--idos-ui-red)}
.av-hero-pill{position:absolute;bottom:1px;left:5px;padding:12px;border:1px solid var(--idos-ui-text);background:var(--idos-ui-bg-bottom);color:var(--idos-ui-text);font-size:9px;letter-spacing:1.5px;font-weight:800;transform:rotate(3deg)}
.av-section-heading{display:flex;justify-content:space-between;align-items:center;padding:32px 0 22px;gap:12px}
.av-section-heading h2{font-size:26px;letter-spacing:-.8px;margin:0 0 8px;font-weight:850}
.av-section-heading p{margin:0;color:var(--idos-ui-text-dim);font-size:13px}
.av-section-heading>span{color:var(--idos-ui-gold);font-size:32px;font-weight:900}
.av-games{display:grid;grid-template-columns:minmax(0,1fr);gap:24px;padding-right:5px}
.av-game{min-width:0;border:1px solid var(--idos-ui-text);background:var(--idos-ui-panel);box-shadow:5px 5px 0 var(--idos-ui-text);transition:transform .16s ease}
.av-art{height:240px;position:relative;overflow:hidden;display:grid;place-items:center;background:var(--av-tone);border-bottom:1px solid var(--idos-ui-text);color:var(--idos-ui-bg-bottom)}
.av-game-number{position:absolute;top:16px;left:18px;font-size:13px;font-weight:800;letter-spacing:2px}
.av-spark{position:absolute;top:15px;right:18px;font-size:32px}
.av-art-caption{position:absolute;bottom:15px;left:0;right:0;text-align:center;font-size:10px;font-weight:850;letter-spacing:2px}
.av-card-copy{padding:24px;display:flex;flex-direction:column}
.av-status{align-self:flex-start;padding:5px 8px;border:1px solid var(--idos-ui-text-dim);font-size:9px;font-weight:800;letter-spacing:1px}
.av-card-copy h3{font-size:26px;letter-spacing:-1px;margin:18px 0 10px;font-weight:850}
.av-description{font-size:13px;line-height:1.7;color:var(--idos-ui-text-dim);margin:0 0 25px;min-height:44px}
.av-note{color:var(--idos-ui-text-dim);font-size:10px;line-height:1.6;margin:15px 0 0;min-height:32px}
.av-footer{text-align:center;color:var(--idos-ui-bg-bottom);background:var(--idos-ui-gold);font-size:12px;font-weight:800;letter-spacing:2px;padding:16px 10px;margin-top:32px}
.av-orbs{position:relative;width:230px;height:170px;transform:rotate(-8deg)}
.av-orb{position:absolute;width:78px;height:78px;border-radius:50%;border:2px solid var(--idos-ui-bg-bottom);display:grid;place-items:center;color:var(--idos-ui-bg-bottom);font-size:29px;background:var(--av-orb);box-shadow:4px 4px 0 var(--idos-ui-bg-bottom)}
.av-orb-0{left:16px;top:62px}.av-orb-1{left:94px;top:72px}.av-orb-2{left:65px;top:0;width:88px;height:88px;z-index:2}.av-orb-3{left:148px;top:15px;width:66px;height:66px}.av-orb-4{left:178px;top:96px;width:45px;height:45px;font-size:18px}
.av-tubes{display:flex;gap:18px;align-items:center;transform:rotate(-7deg);padding-bottom:6px}
.av-tube{position:relative;width:52px;height:152px;border:2px solid var(--idos-ui-bg-bottom);border-radius:3px 3px 24px 24px;padding:5px;box-shadow:4px 4px 0 var(--idos-ui-bg-bottom);background:var(--idos-ui-text)}
.av-tube:before{content:"";position:absolute;top:-5px;left:-4px;right:-4px;height:7px;border-radius:2px;background:var(--idos-ui-bg-bottom);z-index:2}
.av-liquid{height:100%;border-radius:0 0 19px 19px;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end}
.av-liquid i{display:block;height:27%;background:var(--idos-ui-gold)}.av-liquid i:nth-child(2){background:var(--idos-ui-red)}.av-liquid i:nth-child(3){background:var(--idos-ui-blue)}
.av-tube-1{transform:translateY(-14px) rotate(10deg)}.av-tube-1 i:first-child{background:var(--idos-ui-red)}.av-tube-1 i:nth-child(2){background:var(--idos-ui-blue)}.av-tube-1 i:nth-child(3){background:var(--idos-ui-green)}
.av-tube-2 i:first-child{background:var(--idos-ui-blue)}.av-tube-2 i:nth-child(2){background:var(--idos-ui-green)}.av-tube-2 i:nth-child(3){background:var(--idos-ui-gold)}
.av-cakes{position:relative;width:230px;height:156px}
.av-cake{position:absolute;width:102px;height:76px;border:2px solid var(--idos-ui-bg-bottom);border-radius:48% 48% 10px 10px;background:var(--av-cake);box-shadow:4px 4px 0 var(--idos-ui-bg-bottom);transform:rotate(-8deg)}
.av-frosting{position:absolute;left:-2px;right:-2px;top:-7px;height:38px;border-radius:50%;background:var(--idos-ui-text);border:2px solid var(--idos-ui-bg-bottom);z-index:2}
.av-cherry{position:absolute;width:18px;height:18px;border-radius:50%;border:2px solid var(--idos-ui-bg-bottom);top:-19px;left:43px;background:var(--idos-ui-red);z-index:3}
.av-cherry:before{content:"";position:absolute;top:-8px;left:10px;width:2px;height:8px;transform:rotate(28deg);background:var(--idos-ui-bg-bottom)}
.av-cake-0{left:12px;top:60px;z-index:2}.av-cake-1{right:12px;top:57px;transform:rotate(10deg);z-index:3}.av-cake-2{left:66px;top:0;transform:rotate(3deg)}
.av-cake-stripe{position:absolute;left:0;right:0;bottom:16px;height:9px;background:var(--idos-ui-text);border-top:1px solid var(--idos-ui-bg-bottom);border-bottom:1px solid var(--idos-ui-bg-bottom)}
.av-cake-layer{display:none}
.av-hub[data-reduced-motion="true"] .av-game{transition:none}
@media(hover:hover){.av-hub:not([data-reduced-motion="true"]) .av-game:hover{transform:translate(-2px,-2px)}}
@container(max-width:580px){.av-hero-art{display:none}.av-hero{padding:24px 0}.av-eyebrow{font-size:9px;letter-spacing:1px}.av-hero h1{font-size:clamp(36px,12cqw,60px);letter-spacing:-2px}.av-intro{font-size:15px}.av-section-heading>span{display:none}.av-art{height:220px}}
@container(min-width:820px){.av-games{grid-template-columns:repeat(3,minmax(0,1fr))}.av-card-copy{padding:22px}.av-card-copy h3{font-size:24px}}
@media(prefers-reduced-motion:reduce){.av-game{transition:none}.av-game:hover{transform:none!important}}
`;
