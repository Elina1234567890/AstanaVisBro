import { useRef, useState, type ReactNode } from "react";
import { Button, v } from "@idosgames/react/ui";
import { GameResult } from "./GameResult";
import type { GameID, ProgressService, RoundResult, Session } from "./service";

export function makeProgressScreen(service: ProgressService) {
  return function ProgressScreen(): ReactNode {
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [game, setGame] = useState<GameID>("orb-merge");
    const [result, setResult] = useState<RoundResult | null>(null);
    const session = useRef<Session | null>(null);
    const lock = useRef(false);
    const score = 500;

    async function simulate() {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      setResult(null);
      try {
        if (!session.current) session.current = await service.begin(game);
        await new Promise<void>((resolve) => setTimeout(resolve, session.current!.minDurationMs + 100));
        const receipt = await service.complete({ gameId: session.current.gameId, sessionId: session.current.sessionId, score });
        session.current = null;
        setResult(receipt);
        await service.refreshVis();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Нет связи с сервером");
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }

    async function recover() {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      setError("");
      try {
        const recovery = await service.recover();
        if (recovery.result) setResult(recovery.result);
        await service.refreshVis();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не удалось обновить награду");
      } finally {
        lock.current = false;
        setBusy(false);
      }
    }

    return (
      <section aria-label="DEV result test" style={{ padding: "20px 0", borderBottom: `1px solid ${v.panelEdge}` }}>
        <details>
          <summary style={{ color: v.textDim, cursor: "pointer" }}>DEV · SIMULATE GAME RESULT</summary>
          <p style={{ color: v.textDim, fontSize: 12 }}>Только CloudCode сессия; выдача и лимиты проверяются сервером.</p>
          <label style={{ display: "block", marginBottom: 12 }}>Game <select aria-label="Game under test" value={game} disabled={busy || !!session.current} onChange={(e) => setGame(e.target.value as GameID)} style={{ background: v.panel, color: v.text, padding: 10, border: `1px solid ${v.textDim}`, maxWidth: "100%" }}>
            <option value="orb-merge">TOY MERGE</option><option value="color-flow">COLOR FLOW</option><option value="cake-sort">CAKE SORT</option>
          </select></label>
          <Button tone="gold" disabled={busy} onClick={() => void simulate()}>{busy ? "SENDING…" : session.current ? "RETRY SAME SESSION" : "SIMULATE GAME RESULT"}</Button>
          <Button disabled={busy} onClick={() => void recover()}>{busy ? "CHECKING…" : "REFRESH / RECOVER RESULT"}</Button>
          {error && <div role="alert" style={{ color: v.red, overflowWrap: "anywhere", marginTop: 12 }}>{error}</div>}
          {result && <GameResult result={result} onClose={() => setResult(null)} onAgain={() => void simulate()} />}
        </details>
      </section>
    );
  };
}
