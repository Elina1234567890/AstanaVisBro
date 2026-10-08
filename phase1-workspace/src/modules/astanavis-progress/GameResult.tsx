import type { ReactNode } from "react";
import { Button, Popup, v } from "@idosgames/react/ui";
import type { RoundResult } from "./service";

export function GameResult({
  result,
  title = "GAME OVER",
  bestScore,
  onAgain,
  onClose,
}: {
  result: RoundResult;
  title?: string;
  bestScore?: number;
  onAgain: () => void;
  onClose: () => void;
}): ReactNode {
  return (
    <Popup title={title} onClose={onClose} width={420}>
      <div style={{ display: "grid", gap: 18, textAlign: "center" }}>
        <div>
          <p style={{ color: v.textDim, margin: "0 0 6px" }}>SCORE</p>
          <p style={{ fontSize: 44, fontWeight: 900, margin: 0 }}>{result.score.toLocaleString("ru-RU")}</p>
        </div>
        {bestScore !== undefined && <div style={{ color: v.textDim }}>BEST · <strong style={{ color: v.text }}>{bestScore.toLocaleString("ru-RU")}</strong></div>}
        <div>
          <p style={{ color: v.textDim, margin: "0 0 6px" }}>VIS EARNED</p>
          <p style={{ color: v.gold, fontSize: 26, fontWeight: 900, margin: 0 }}>+{result.rewards.vis} VIS</p>
        </div>
        {result.alreadyProcessed && <p style={{ color: v.textDim, margin: 0 }}>Этот результат уже учтён. Повторной награды нет.</p>}
        <div style={{ display: "grid", gap: 12 }}>
          <Button tone="gold" onClick={onAgain}>PLAY AGAIN</Button>
          <Button onClick={onClose}>BACK TO HUB</Button>
        </div>
      </div>
    </Popup>
  );
}
