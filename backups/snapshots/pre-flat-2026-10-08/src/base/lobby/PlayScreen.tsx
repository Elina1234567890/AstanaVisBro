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
          <div className="av-hero-art" aria-hidden="true"><span className="av-smile">ϟ</span><span className="av-mini-star">+</span><span className="av-hero-pill">NO CAP. JUST GAMES.</span></div>
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
  if (game === "color-flow") return <div className="av-tubes">{[0, 1, 2].map((i) => <div className={`av-tube av-tube-${i}`} key={i}><div className="av-liquid" /></div>)}</div>;
  return <div className="av-cakes">{[v.red, v.gold, v.blue].map((color, i) => <div className={`av-cake av-cake-${i}`} key={i} style={{ "--av-cake": color } as CSSProperties}><div className="av-frosting" /><div className="av-cherry" /><div className="av-cake-layer" /></div>)}</div>;
}

const hubStyles = `
.av-hub{container-type:inline-size;color:${v.text};padding:18px 0 4px}
.av-hub *{box-sizing:border-box}
.av-hero{position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:clamp(24px,5cqw,48px);border-radius:30px;overflow:hidden;background:radial-gradient(ellipse at 90% 25%,color-mix(in srgb,${v.red} 26%,transparent),transparent 60%),linear-gradient(115deg,${v.panel},color-mix(in srgb,${v.blue} 16%,${v.panel}));border:1px solid ${v.panelEdge}}
.av-hero-copy{z-index:1;max-width:570px}
.av-eyebrow{font-size:10px;letter-spacing:2px;font-weight:850;color:${v.textDim};margin:0 0 20px;line-height:1.6}
.av-hero h1{font-size:clamp(32px,6.8cqw,70px);font-weight:950;letter-spacing:-2px;line-height:1.04;margin:0}
.av-hero h1>span{color:${v.blue};text-shadow:0 0 34px color-mix(in srgb,${v.blue} 25%,transparent)}
.av-title-star{display:inline-block;color:${v.green};margin-left:12px;font-size:.8em}
.av-intro{font-size:16px;font-weight:650;line-height:1.65;color:${v.textDim};margin:20px 0 0;max-width:560px}
.av-hero-art{position:relative;flex:0 0 210px;height:200px;display:grid;place-items:center}
.av-smile{display:grid;place-items:center;width:142px;height:142px;border-radius:45px;transform:rotate(-12deg);font-size:88px;color:${v.panel};background:linear-gradient(145deg,${v.blue},${v.blueDeep});box-shadow:12px 15px 0 color-mix(in srgb,${v.blue} 18%,transparent),inset 0 4px 0 color-mix(in srgb,${v.panel} 35%,transparent)}
.av-mini-star{position:absolute;right:-2px;top:5px;font-size:60px;color:${v.redDeep}}
.av-hero-pill{position:absolute;bottom:3px;left:6px;padding:12px 16px;border-radius:16px;background:${v.panel};color:${v.textDim};font-size:10px;letter-spacing:1.5px;font-weight:800;transform:rotate(5deg);box-shadow:0 5px 18px color-mix(in srgb,${v.shadow} 35%,transparent)}
.av-section-heading{display:flex;justify-content:space-between;align-items:center;padding:30px 4px 20px;gap:12px}
.av-section-heading h2{font-size:24px;letter-spacing:-.6px;margin:0 0 6px;font-weight:850}
.av-section-heading p{margin:0;color:${v.textDim};font-size:13px;line-height:1.5}
.av-section-heading>span{color:${v.green};font-size:23px;white-space:nowrap;font-weight:950}
.av-games{display:grid;grid-template-columns:minmax(0,1fr);gap:20px}
.av-game{min-width:0;border-radius:24px;overflow:hidden;background:${v.panel};border:1px solid color-mix(in srgb,var(--av-tone) 24%,${v.panelEdge});box-shadow:0 0 24px color-mix(in srgb,var(--av-tone) 6%,transparent);transition:transform .22s ease,box-shadow .22s ease}
.av-art{height:240px;position:relative;overflow:hidden;display:grid;place-items:center;background:radial-gradient(ellipse at 50% 55%,color-mix(in srgb,var(--av-tone) 40%,${v.panel}),color-mix(in srgb,var(--av-tone) 16%,${v.panel}));border-bottom:1px solid color-mix(in srgb,var(--av-tone) 30%,${v.panel})}
.av-game-number{position:absolute;top:18px;left:20px;font-size:11px;font-weight:800;color:${v.textDim};letter-spacing:2px}
.av-spark{position:absolute;top:21px;right:22px;font-size:36px;color:${v.panel}}
.av-art-caption{position:absolute;bottom:18px;left:0;right:0;text-align:center;font-size:9px;font-weight:850;letter-spacing:2.5px;color:${v.textDim}}
.av-card-copy{padding:24px;display:flex;flex-direction:column}
.av-status{align-self:flex-start;padding:6px 9px;border-radius:8px;background:color-mix(in srgb,var(--av-tone) 19%,${v.panel});color:${v.text};font-size:9px;font-weight:850;letter-spacing:1.3px}
.av-card-copy h3{font-size:24px;letter-spacing:-.8px;margin:16px 0 8px;font-weight:950}
.av-description{font-size:13px;line-height:1.65;color:${v.textDim};margin:0 0 22px;min-height:44px}
.av-note{color:${v.textDim};font-size:10px;line-height:1.6;margin:14px 0 0;min-height:32px}
.av-footer{text-align:center;color:${v.textDim};font-size:11px;letter-spacing:.4px;padding:22px 8px 8px}
.av-orbs{position:relative;width:230px;height:170px;transform:rotate(-8deg)}
.av-orb{position:absolute;width:78px;height:78px;border-radius:50%;display:grid;place-items:center;color:${v.panel};font-size:29px;background:radial-gradient(circle at 28% 22%,color-mix(in srgb,var(--av-orb) 40%,${v.text}),var(--av-orb) 42%,color-mix(in srgb,var(--av-orb) 78%,${v.text}));box-shadow:0 9px 12px color-mix(in srgb,${v.text} 9%,transparent),inset 0 -4px 8px color-mix(in srgb,${v.text} 12%,transparent)}
.av-orb-0{left:16px;top:62px}.av-orb-1{left:94px;top:72px}.av-orb-2{left:65px;top:0;width:88px;height:88px;z-index:2}.av-orb-3{left:148px;top:15px;width:66px;height:66px}.av-orb-4{left:178px;top:96px;width:45px;height:45px;font-size:18px}
.av-tubes{display:flex;gap:18px;align-items:center;transform:rotate(-7deg);padding-bottom:6px}
.av-tube{position:relative;width:52px;height:152px;border:3px solid color-mix(in srgb,${v.panel} 85%,var(--av-tone));border-radius:10px 10px 27px 27px;padding:5px;box-shadow:0 10px 18px color-mix(in srgb,${v.text} 9%,transparent);background:color-mix(in srgb,${v.panel} 36%,transparent)}
.av-tube:before{content:"";position:absolute;top:-5px;left:-5px;right:-5px;height:9px;border-radius:5px;background:${v.panel};z-index:2}
.av-liquid{height:100%;border-radius:4px 4px 22px 22px;background:linear-gradient(to top,${v.blue} 0 27%,${v.red} 27% 54%,${v.gold} 54% 81%,transparent 81%);box-shadow:inset 5px 0 0 color-mix(in srgb,${v.panel} 30%,transparent)}
.av-tube-1{transform:translateY(-14px) rotate(10deg)}.av-tube-1 .av-liquid{background:linear-gradient(to top,${v.green} 0 27%,${v.blue} 27% 54%,${v.red} 54% 81%,transparent 81%)}
.av-tube-2 .av-liquid{background:linear-gradient(to top,${v.gold} 0 27%,${v.green} 27% 54%,${v.blue} 54% 81%,transparent 81%)}
.av-cakes{position:relative;width:230px;height:156px}
.av-cake{position:absolute;width:102px;height:76px;border-radius:48% 48% 16px 16px;background:linear-gradient(to bottom,var(--av-cake) 0 37%,${v.panel} 37% 46%,var(--av-cake) 46% 68%,${v.panel} 68% 77%,color-mix(in srgb,var(--av-cake) 80%,${v.gold}));box-shadow:0 10px 12px color-mix(in srgb,${v.text} 10%,transparent);transform:rotate(-8deg)}
.av-frosting{position:absolute;left:0;right:0;top:-7px;height:38px;border-radius:50%;background:color-mix(in srgb,var(--av-cake) 28%,${v.panel});border-bottom:7px solid ${v.panel}}
.av-cherry{position:absolute;width:18px;height:18px;border-radius:50%;top:-19px;left:43px;background:${v.redDeep};box-shadow:inset 4px 2px 0 ${v.red}}
.av-cherry:before{content:"";position:absolute;top:-8px;left:10px;width:3px;height:10px;transform:rotate(28deg);background:${v.greenDeep};border-radius:3px}
.av-cake-0{left:12px;top:60px;z-index:2}.av-cake-1{right:12px;top:57px;transform:rotate(10deg);z-index:3}.av-cake-2{left:66px;top:0;transform:rotate(3deg)}
.av-cake-layer{position:absolute;left:12px;right:12px;bottom:-9px;height:9px;border-radius:50%;background:color-mix(in srgb,${v.panel} 80%,var(--av-cake));z-index:-1}
.av-hub[data-reduced-motion="true"] .av-game{transition:none}
@media(hover:hover){.av-hub:not([data-reduced-motion="true"]) .av-game:hover{transform:translateY(-5px);box-shadow:0 14px 30px color-mix(in srgb,${v.shadow} 40%,transparent)}}
@container(max-width:580px){.av-hero-art{display:none}.av-hero{padding:28px 24px}.av-eyebrow{font-size:9px;letter-spacing:1.2px}.av-hero h1{font-size:clamp(32px,10cqw,52px)}.av-section-heading>span{display:none}.av-art{height:220px}}
@container(min-width:820px){.av-games{grid-template-columns:repeat(3,minmax(0,1fr))}.av-card-copy{padding:22px}.av-card-copy h3{font-size:23px}}
@media(prefers-reduced-motion:reduce){.av-game{transition:none}.av-game:hover{transform:none!important}}
`;
