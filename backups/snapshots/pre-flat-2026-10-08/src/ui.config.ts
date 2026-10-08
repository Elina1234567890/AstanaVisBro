import { defineUiConfig } from "@idosgames/react/ui";

export default defineUiConfig({
  theme: {
    bgTop: "#07070b", bgBottom: "#07070b",
    panel: "#14131e", panelDeep: "#0d0c13", panelEdge: "#302a42",
    text: "#f3f1ff", textDim: "#aaa0bb",
    blue: "#995cff", blueDeep: "#6a30d8",
    green: "#42f5ac", greenDeep: "#0cba78",
    gold: "#eeff55", goldDeep: "#c0d02c",
    red: "#ff408f", redDeep: "#c41b63",
    shadow: "#000000", backdrop: "#000000bb",
    radius: 24, buttonRadius: 14,
    font: "'Nunito', system-ui, sans-serif",
  },
  motion: { enabled: true, intensity: 0.45, respectReducedMotion: true },
});
