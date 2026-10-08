// @idosgames/mod-mini-game — "Star catch", the smallest complete game module: a 15-second tap round
// launched from the lobby's Play button, with a leaderboard score.
//
// Primary export is the module manifest; the pieces are exported too, so a project can reuse the
// round inside its own game after copying this into src/modules/.

export { miniGameModule } from "./module";
export { makeMiniGamePanel } from "./MiniGamePanel";
export { MiniGame } from "./MiniGame";
export * from "./model";
