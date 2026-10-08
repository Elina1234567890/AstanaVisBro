import { defineUiConfig } from "@idosgames/react/ui";
import "./base/lobby/flat.css";

export default defineUiConfig({
  theme: {
    bgTop: "#151515", bgBottom: "#151515",
    panel: "#151515", panelDeep: "#151515", panelEdge: "#eeeeee",
    text: "#f5f5f5", textDim: "#bdbdbd",
    blue: "#e6a0df", blueDeep: "#e6a0df",
    green: "#88cba5", greenDeep: "#88cba5",
    gold: "#ffe174", goldDeep: "#ffe174",
    red: "#ee8e85", redDeep: "#ee8e85",
    shadow: "#000000", backdrop: "#000000bb",
    radius: 4, buttonRadius: 2,
    font: "Arial, Helvetica, system-ui, sans-serif",
  },
  motion: { enabled: true, intensity: 0, respectReducedMotion: true },
});
