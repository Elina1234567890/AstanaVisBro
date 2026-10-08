import type { PointerEvent, ReactNode } from "react";
import type { CardRarity } from "./cards-model";
import "./card-detail-visual.css";

interface CardDetailVisualProps {
  name: string;
  rarity: CardRarity;
  imagePath: string | null;
  locked: boolean;
  tilt: { x: number; y: number };
  sensorTiltEnabled: boolean;
  onTilt: (tilt: { x: number; y: number }) => void;
}

const layers = {
  sun: -0.18,
  block: -0.07,
  dotsLeft: -0.24,
  dotsRight: -0.2,
  banner: 0.38,
  sticker: 0.34,
  spark: 0.38,
  heart: 0.44,
  character: 1.06,
  badge: 0.72,
  nameplate: 1.18,
} as const;

export function CardDetailVisual({ name, rarity, imagePath, locked, tilt, sensorTiltEnabled, onTilt }: CardDetailVisualProps): ReactNode {
  const move = (event: PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && sensorTiltEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const clamp = (value: number) => Math.max(-1, Math.min(1, value));
    onTilt({
      x: clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2),
      y: clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2),
    });
  };

  const parallax = (depth: number) => ({ translate: `${tilt.x * 18 * depth}px ${tilt.y * 16 * depth}px` });
  const legendary = rarity === "legendary";

  return (
    <div
      className={`av-card-scene${legendary ? " av-card-scene--legendary" : ""}`}
      onPointerMove={move}
      onPointerLeave={() => { if (!sensorTiltEnabled) onTilt({ x: 0, y: 0 }); }}
      style={{ transform: `rotateX(${-tilt.y * 7.5}deg) rotateY(${tilt.x * 9.5}deg)` }}
      aria-label={`${name}, ${rarityLabel(rarity)} card`}
    >
      <div className="av-card-back-shadow" />
      <div className="av-card-frame">
        <div className="av-card-sun av-card-layer" style={parallax(layers.sun)} />
        {legendary ? <div className="av-card-aura av-card-layer" style={parallax(0.08)} /> : null}
        <div className="av-card-pink-block av-card-layer" style={parallax(layers.block)} />
        <div className="av-card-dots av-card-dots--left av-card-layer" style={parallax(layers.dotsLeft)} />
        <div className="av-card-dots av-card-dots--right av-card-layer" style={parallax(layers.dotsRight)} />

        <div className="av-card-banner av-card-layer" style={parallax(layers.banner)}>
          <div className="av-card-slashes">///</div>
          <div className="av-card-headline">ASTANAVIS,<br /><span>BRO</span><i>+</i></div>
          <div className="av-card-subline">COLLECTIBLE CARD · NO CAP. JUST GAMES.</div>
        </div>

        <div className="av-card-bro-sticker av-card-layer" style={parallax(layers.sticker)}>
          <span>BRO.</span>
          <div className="av-card-mini-caption">NO CAP. JUST GAMES.</div>
        </div>

        <span className="av-card-spark av-card-spark--a av-card-layer" style={parallax(layers.spark)}>✦</span>
        <span className="av-card-spark av-card-spark--b av-card-layer" style={parallax(0.34)}>✦</span>
        <span className="av-card-spark av-card-spark--c av-card-layer" style={parallax(0.32)}>✦</span>
        <span className="av-card-spark av-card-spark--d av-card-layer" style={parallax(0.3)}>✦</span>
        <span className="av-card-heart av-card-heart--left av-card-layer" style={parallax(0.36)}>♥</span>
        <span className="av-card-heart av-card-heart--mid av-card-layer" style={parallax(layers.heart)}>♥</span>
        <span className="av-card-heart av-card-heart--right av-card-layer" style={parallax(0.48)}>♥</span>

        {legendary ? <>
          <div className="av-card-rarity-shine av-card-layer" />
          <span className="av-card-particle av-card-particle--one av-card-layer" style={parallax(0.6)} />
          <span className="av-card-particle av-card-particle--two av-card-layer" style={parallax(0.55)} />
          <span className="av-card-particle av-card-particle--three av-card-layer" style={parallax(0.52)} />
          <span className="av-card-particle av-card-particle--four av-card-layer" style={parallax(0.58)} />
          <span className="av-card-particle av-card-particle--five av-card-layer" style={parallax(0.62)} />
          <div className="av-card-legend-badge av-card-layer" style={parallax(layers.badge)}>ЛЕГЕНДАРНАЯ</div>
        </> : null}

      <div className="av-card-character-window av-card-layer" style={parallax(layers.character)}>
          {locked ? <div className="av-card-character-placeholder">?</div> : imagePath ? <img className="av-card-character" src={imagePath} alt="" /> : <div className="av-card-character-placeholder">?</div>}
        </div>

        <span className="av-card-plus av-card-plus--top av-card-layer" style={parallax(0.42)}>+</span>
        <span className="av-card-plus av-card-plus--bottom av-card-layer" style={parallax(0.46)}>+</span>
        <div className="av-card-gloss" />
      </div>

      <div className="av-card-nameplate av-card-layer" style={parallax(layers.nameplate)}>
        <div className="av-card-name">{name}</div>
        <div className="av-card-meta">{rarityLabel(rarity)} КАРТОЧКА</div>
      </div>
    </div>
  );
}

function rarityLabel(rarity: CardRarity): string {
  if (rarity === "common") return "ОБЫЧНАЯ";
  if (rarity === "rare") return "РЕДКАЯ";
  if (rarity === "epic") return "ЭПИЧЕСКАЯ";
  return "ЛЕГЕНДАРНАЯ";
}
