import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Button,
  Icon,
  outlined,
  panel,
  useSound,
  v,
} from "@idosgames/react/ui";
import { t } from "./i18n";

// "Tap the stars": a 15-second round that produces a score for the leaderboard. Deliberately tiny —
// the placeholder a project replaces with its real game, keeping the same contract: play, then hand
// the score to onFinish (the play screen submits it and reports the round to quests).

const ROUND_MS = 15_000;
const SPAWN_MS = 520;
const LIFE_MS = 1_150;

interface Star {
  id: number;
  x: number;
  y: number;
  golden: boolean;
  bornAt: number;
}

export function MiniGame({
  onFinish,
  onCancel,
  height = 380,
}: {
  onFinish: (score: number) => void;
  onCancel: () => void;
  height?: number;
}): ReactNode {
  const play = useSound();
  const [stars, setStars] = useState<Star[]>([]);
  const [score, setScore] = useState(0);
  const [leftMs, setLeftMs] = useState(ROUND_MS);
  const [pops, setPops] = useState<
    Array<{ id: number; x: number; y: number; value: number }>
  >([]);
  const scoreRef = useRef(0);
  const nextId = useRef(1);
  const finished = useRef(false);
  // Latest callback without restarting the round when the parent re-renders.
  const finish = useRef(onFinish);
  finish.current = onFinish;

  useEffect(() => {
    const started = performance.now();
    const spawn = setInterval(() => {
      const now = performance.now();
      setStars((list) => [
        ...list.filter((s) => now - s.bornAt < LIFE_MS),
        {
          id: nextId.current++,
          x: 8 + Math.random() * 78,
          y: 10 + Math.random() * 72,
          golden: Math.random() < 0.15,
          bornAt: now,
        },
      ]);
    }, SPAWN_MS);
    const clock = setInterval(() => {
      const left = Math.max(0, ROUND_MS - (performance.now() - started));
      setLeftMs(left);
      if (left === 0 && !finished.current) {
        finished.current = true;
        clearInterval(spawn);
        clearInterval(clock);
        finish.current(scoreRef.current);
      }
    }, 100);
    return () => {
      clearInterval(spawn);
      clearInterval(clock);
    };
  }, []);

  const hit = (star: Star) => {
    const value = star.golden ? 3 : 1;
    play(star.golden ? "coin" : "countTick");
    scoreRef.current += value;
    setScore(scoreRef.current);
    setStars((list) => list.filter((s) => s.id !== star.id));
    const popID = nextId.current++;
    setPops((list) => [...list, { id: popID, x: star.x, y: star.y, value }]);
    setTimeout(
      () => setPops((list) => list.filter((p) => p.id !== popID)),
      600,
    );
  };

  return (
    <div
      style={{
        ...panel,
        position: "relative",
        height: `min(${height}px, 70vh)`,
        minHeight: 300,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 50% 30%, #3b47b8 0%, #151a52 75%)",
        touchAction: "manipulation",
        userSelect: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 10,
          left: 12,
          right: 12,
          display: "flex",
          justifyContent: "space-between",
          zIndex: 2,
        }}
      >
        <span style={{ ...outlined, fontSize: 18 }}>
          {t("score")}: {score}
        </span>
        <span
          style={{
            ...outlined,
            fontSize: 18,
            color: leftMs < 4000 ? v.red : v.text,
          }}
        >
          {t("timeLeft")}: {Math.ceil(leftMs / 1000)}
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 0,
          right: 0,
          textAlign: "center",
          ...outlined,
          fontSize: 14,
          color: v.textDim,
          opacity: score === 0 ? 1 : 0,
          transition: "opacity .4s",
        }}
      >
        {t("tapStars")}
      </div>
      {stars.map((s) => (
        <button
          key={s.id}
          type="button"
          aria-label="star"
          onPointerDown={() => hit(s)}
          style={{
            position: "absolute",
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: 56,
            height: 56,
            marginLeft: -28,
            marginTop: -28,
            border: "none",
            background: "none",
            padding: 0,
            cursor: "pointer",
            animation: `idos-star ${v.normal} ease-out`,
          }}
        >
          <Icon
            glyph="star"
            size={s.golden ? 56 : 44}
            color={s.golden ? "#ffe066" : "#fff27a"}
          />
        </button>
      ))}
      {pops.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.x}%`,
            top: `${p.y}%`,
            ...outlined,
            fontSize: 22,
            color: v.gold,
            pointerEvents: "none",
            animation: "idos-rise-in .6s ease reverse",
          }}
        >
          +{p.value}
        </span>
      ))}
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Button tone="grey" size="sm" onClick={onCancel}>
          ✕
        </Button>
      </div>
    </div>
  );
}
