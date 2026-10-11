import { defineUiConfig } from "@idosgames/react/ui";

// The game's interface in ONE place: colours, animations and sounds of every module built on
// @idosgames/react/ui (shop, inventory, heroes, rewards, marketplace, …). Change them here — never in
// a module: an edited catalog module is marked "customized" and stops getting catalog updates.
//
// Everything is optional; what you leave out keeps its default. Uncomment and edit.
export default defineUiConfig({
  theme: {
    bgTop: "#44216f",
    bgBottom: "#160c36",
    panel: "#4b2b78",
    panelEdge: "#ff83cf",
    gold: "#ffd166",
    green: "#62e6b1",
    radius: 22,
    buttonRadius: 16,
    font: "'Nunito', 'Segoe UI', system-ui, sans-serif",
    // rarity: { Mythic: "#ff3df5" },   // frame colour of a rarity id (adds to Common…Legendary)
  },
  motion: {
    enabled: true,
    speed: 1,
    intensity: 1.12,
    rewardFlight: true,
    particles: true,
    stagger: true,
    respectReducedMotion: true,
  },
  sound: {
    // enabled: true,             // false — a silent interface
    // volume: 0.6,               // master volume 0..1 (the player's own volume multiplies it)
    events: {
      // Built-in sounds are synthesized in code (no files). Per event:
      //   "coin"                         — the built-in sound of another event
      //   { url: "https://…/click.mp3" } — your own file (optional volume: 0..1)
      //   { synth: { notes: [{ freq: 880, dur: 0.08, wave: "triangle" }] } } — your own synth
      //   false                          — silence
      // Events: click, tab, open, close, reward, coin, purchase, claim, error, notify, lootbox,
      // levelUp, countTick.
      // click: "tab",
      // countTick: false,
    },
  },
});
