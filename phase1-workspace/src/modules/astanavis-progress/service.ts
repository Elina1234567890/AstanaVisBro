import type { IDosGamesClient } from "@idosgames/core";

export type GameID = "orb-merge" | "color-flow" | "cake-sort";
export interface Session { sessionId: string; gameId: GameID; startedAt: number; minDurationMs: number }
export interface GameResult { gameId: GameID; sessionId: string; score: number; duration?: number }
export interface RoundResult { gameId: GameID; sessionId: string; score: number; rewards: { vis: number }; alreadyProcessed: boolean }

export function createProgressService(client: IDosGamesClient) {
  async function rpc<T>(name: string, args: Record<string, string | number> = {}): Promise<T> {
    const result = await client.cloudCode.execute(name, args);
    if (!result.ok) throw new Error(result.error);
    if (result.data.Error) throw new Error(JSON.stringify(result.data.Error));
    return result.data.FunctionResult as T;
  }

  return {
    isDev: client.titleID.endsWith("-DEV"),
    recover: () => rpc<{ recovered: number; result: RoundResult | null }>("astanavisRecoverPendingResults"),
    begin: (gameId: GameID) => rpc<Session>("astanavisBeginSession", { gameId }),
    complete: (result: GameResult) => rpc<RoundResult>("astanavisCompleteSession", {
      gameId: result.gameId,
      sessionId: result.sessionId,
      score: result.score,
      ...(result.duration === undefined ? {} : { duration: result.duration }),
    }),
    async refreshVis() {
      const result = await client.user.getUserInventory();
      if (!result.ok) throw new Error(result.error);
    },
  };
}

export type ProgressService = ReturnType<typeof createProgressService>;
