// Pure helpers of the mini-game — covered by model.test.ts.

/** Metric the mini-game reports once per finished round. A quest counts it only if it asks for it. */
export const GAMES_PLAYED_METRIC = "games_played";

/** Leaderboard the mini-game submits to when the title has it; otherwise the first enabled one. */
export const PREFERRED_LEADERBOARD = "weekly_score";

export interface LeaderboardSection {
  Definitions?: Record<
    string,
    {
      LeaderboardID?: string;
      DisplayName?: string | null;
      IsEnabled?: boolean | null;
      ScoreSources?: unknown[] | null;
    } | null
  > | null;
}

/**
 * The leaderboard the mini-game plays for: the preferred id if enabled, else the first enabled one.
 * A board fed by its own sources (invites, purchases…) is not a score table — the server fills it
 * and refuses a submitted score, so the mini-game never picks it.
 */
export function pickLeaderboard(
  section: LeaderboardSection | undefined,
): { LeaderboardID: string; DisplayName?: string | null } | null {
  const defs = Object.entries(section?.Definitions ?? {})
    .map(([id, def]) =>
      def ? { ...def, LeaderboardID: def.LeaderboardID ?? id } : null,
    )
    .filter(
      (
        d,
      ): d is {
        LeaderboardID: string;
        DisplayName?: string | null;
        IsEnabled?: boolean | null;
      } => d !== null && d.IsEnabled !== false,
    )
    .filter(
      (d) =>
        ((d as { ScoreSources?: unknown[] | null }).ScoreSources ?? [])
          .length === 0,
    );
  return (
    defs.find((d) => d.LeaderboardID === PREFERRED_LEADERBOARD) ??
    defs.sort((a, b) => a.LeaderboardID.localeCompare(b.LeaderboardID))[0] ??
    null
  );
}

export interface QuestSection {
  Quests?: Record<
    string,
    {
      Objectives?: Record<
        string,
        { MetricID?: string | null; Source?: string } | null
      > | null;
    } | null
  > | null;
}

/** Whether some quest counts the mini-game's rounds — only then is the metric worth reporting. */
export function questsCountGames(section: QuestSection | undefined): boolean {
  return Object.values(section?.Quests ?? {}).some((q) =>
    Object.values(q?.Objectives ?? {}).some(
      (o) =>
        o?.MetricID === GAMES_PLAYED_METRIC &&
        (o.Source ?? "ClientApi") === "ClientApi",
    ),
  );
}

// ── A round feeds the title's events and seasons ─────────────────────────────────────────────
// Found in the config, so the mini-game needs neither the events nor the season module installed.

/** The CustomAction a round of the mini-game reports to timed events. */
export const PLAY_ROUND_ACTION = "play_round";
/** Status a round grants to every season chain open to clients. */
export const ROUND_STATUS = 10;

export interface TimedEventSection {
  Definitions?: Record<
    string,
    {
      Content?: EventContentView | null;
      Events?: Array<{ Content?: EventContentView | null } | null> | null;
    } | null
  > | null;
}
type EventContentView = {
  TokenSources?: Array<{
    SourceType?: string | null;
    Params?: Record<string, string> | null;
  } | null> | null;
};

function countsRounds(content: EventContentView | null | undefined): boolean {
  return (content?.TokenSources ?? []).some(
    (s) =>
      s?.SourceType === "CustomAction" &&
      s.Params?.ActionName === PLAY_ROUND_ACTION,
  );
}

/** Events (by id) whose token sources pay for a round — own content or any phase of a chain. */
export function eventsCountingRounds(
  section: TimedEventSection | undefined,
): string[] {
  return Object.entries(section?.Definitions ?? {})
    .filter(
      ([, d]) =>
        d &&
        (countsRounds(d.Content) ||
          (d.Events ?? []).some((p) => countsRounds(p?.Content))),
    )
    .map(([id]) => id);
}

export interface SeasonSection {
  Chains?: Record<
    string,
    { GrantTokensAccessMode?: string | null } | null
  > | null;
}

/**
 * Season chains the client may grant status to. Only an explicit "Both" / "ClientOnly" opens a
 * chain: the engine's default is ServerOnly, so a missing field means "server only" too.
 */
export function seasonChainsForRounds(
  section: SeasonSection | undefined,
): string[] {
  return Object.entries(section?.Chains ?? {})
    .filter(
      ([, c]) =>
        c?.GrantTokensAccessMode === "Both" ||
        c?.GrantTokensAccessMode === "ClientOnly",
    )
    .map(([id]) => id);
}
