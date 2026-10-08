import {
  useCallback,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import type { IDosGamesClient } from "@idosgames/core";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { useIDosGamesClient } from "@idosgames/react";
import {
  Button,
  Icon,
  configSection,
  errorText,
  formatAmount,
  outlined,
  panel,
  screenBackground,
  useCatalog,
  useGameLayout,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import { MiniGame } from "./MiniGame";
import {
  GAMES_PLAYED_METRIC,
  PLAY_ROUND_ACTION,
  ROUND_STATUS,
  eventsCountingRounds,
  pickLeaderboard,
  questsCountGames,
  seasonChainsForRounds,
  type LeaderboardSection,
  type QuestSection,
  type SeasonSection,
  type TimedEventSection,
} from "./model";
import { t } from "./i18n";

// The mini-game's mode — the whole screen while it is on (the lobby's "Play" starts it, the base's
// round button top-left returns to the lobby). A round submits its score to the title's leaderboard,
// reports itself to quests that count rounds, and feeds the events and seasons that pay for a round;
// the table itself is the leaderboard module's screen ("Leaderboard" opens it through ctx.features).

export function makeMiniGamePanel(features: FeatureRegistry): ComponentType {
  return function MiniGamePanel(): ReactNode {
    return (
      <div
        className="idos-scroll"
        style={{
          position: "absolute",
          inset: 0,
          overflowY: "auto",
          background: screenBackground,
          fontFamily: v.font,
          color: v.text,
          // Room for the base's "To the lobby" button in the top-left corner.
          padding: "64px 14px 24px",
          pointerEvents: "auto",
        }}
      >
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <Round features={features} />
        </div>
      </div>
    );
  };
}

function Round({ features }: { features: FeatureRegistry }): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const kit = useUiKit();
  const layout = useGameLayout();
  const [playing, setPlaying] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [bonus, setBonus] = useState<string[]>([]);
  const catalog = useCatalog();
  const board = pickLeaderboard(
    configSection<LeaderboardSection>(client, "Leaderboard"),
  );

  const finish = useCallback(
    async (score: number) => {
      setPlaying(false);
      setResult(score);
      kit.play(score > 0 ? "levelUp" : "notify");
      if (board && score > 0) {
        const res = await client.leaderboard.submitScore(
          board.LeaderboardID,
          score,
        );
        if (!res.ok) toast(errorText(res.error), "error");
      }
      // One round played — only if a quest counts rounds (otherwise the server refuses the metric).
      if (questsCountGames(configSection<QuestSection>(client, "Quest")))
        await client.quest.addQuestProgress(GAMES_PLAYED_METRIC, 1);
      if (score > 0) setBonus(await rewardRound(client, catalog.localize));
    },
    [client, board, toast, kit, catalog],
  );

  if (playing)
    return (
      <MiniGame
        height={layout === "desktop" ? 560 : layout === "tablet" ? 480 : 380}
        onFinish={(s) => void finish(s)}
        onCancel={() => setPlaying(false)}
      />
    );

  return (
    <div
      className="idos-shine"
      style={{
        ...panel,
        padding: 20,
        display: "grid",
        gap: 12,
        justifyItems: "center",
        background: `linear-gradient(180deg, color-mix(in srgb, ${v.blue} 30%, ${v.panel}) 0%, ${v.panelDeep} 100%)`,
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <div className="idos-bounce">
        <Icon glyph="star" size={72} />
      </div>
      <div
        style={{
          ...outlined,
          fontSize: 15,
          textAlign: "center",
          color: v.textDim,
        }}
      >
        {t("best")}
      </div>
      {result !== null ? (
        <div
          style={{
            ...outlined,
            fontSize: 18,
            color: v.gold,
            animation: `idos-pop-in ${v.slow} ease-out both`,
          }}
        >
          {t("yourScore")}: {formatAmount(result)}
          {result > 0 && board ? (
            <div
              style={{ fontSize: 13, color: v.textDim, textAlign: "center" }}
            >
              {t("submitted")}
            </div>
          ) : null}
          {bonus.map((line) => (
            <div
              key={line}
              style={{ fontSize: 14, color: v.green, textAlign: "center" }}
            >
              {line}
            </div>
          ))}
        </div>
      ) : null}
      <Button
        attract
        size="lg"
        style={{ minWidth: 180 }}
        onClick={() => {
          setResult(null);
          setBonus([]);
          setPlaying(true);
        }}
        data-tutorial-anchor="play:start"
      >
        ▶ {result === null ? t("play") : t("playAgain")}
      </Button>
      {board && features.get("leaderboard")?.available ? (
        <Button
          tone="blue"
          size="sm"
          onClick={() =>
            features.open("leaderboard", {
              leaderboardID: board.LeaderboardID,
            })
          }
        >
          <Icon glyph="trophy" size={18} /> {t("toTable")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * A round's share of the title's live-ops: tokens of every active event that pays for a round (a
 * client-safe CustomAction, capped per day by the event) and status in every season chain open to
 * clients. Returns what was granted, for the result card. Best-effort: a refusal (a cap reached,
 * no active season) just grants nothing.
 */
async function rewardRound(
  client: IDosGamesClient,
  localize: (text: string | null | undefined) => string,
): Promise<string[]> {
  const lines: string[] = [];
  const eventIDs = eventsCountingRounds(
    configSection<TimedEventSection>(client, "TimedEvent"),
  );
  if (eventIDs.length > 0) {
    const active = await client.timedEvent.getActiveEvents();
    for (const e of active.ok ? (active.data.ActiveEvents ?? []) : []) {
      if (
        !e.TimedEventID ||
        !eventIDs.includes(e.TimedEventID) ||
        e.CanEarn === false ||
        !e.Type
      )
        continue;
      const res = await client.timedEvent.grantTokens(
        e.Type,
        e.TimedEventID,
        "CustomAction",
        undefined,
        undefined,
        { ActionName: PLAY_ROUND_ACTION },
      );
      const op = res.ok
        ? (res.data.Grant?.Standard?.EventTokens?.[0] as
            { Applied?: number; Amount?: number } | undefined)
        : undefined;
      const amount = Number(op?.Applied ?? op?.Amount ?? 0);
      if (amount > 0)
        lines.push(
          `+${formatAmount(amount)} ${localize(e.Content?.Token?.DisplayName ?? e.Content?.DisplayName ?? e.TimedEventID)}`,
        );
    }
  }
  for (const chain of seasonChainsForRounds(
    configSection<SeasonSection>(client, "Season"),
  )) {
    const res = await client.season.grantStatusTokens(chain, ROUND_STATUS);
    if (res.ok && Number(res.data.AmountGranted ?? 0) > 0)
      lines.push(
        `+${formatAmount(Number(res.data.AmountGranted))} ${t("seasonStatus")}`,
      );
  }
  return lines;
}
