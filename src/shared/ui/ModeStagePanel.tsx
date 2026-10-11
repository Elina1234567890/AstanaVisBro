import type { ReactNode } from "react";
import { outlined, panel, screenBackground, v } from "@idosgames/react/ui";

export function ModeStagePanel({
  icon,
  title,
  accent,
  description,
}: {
  icon: string;
  title: string;
  accent: string;
  description: string;
}): ReactNode {
  return (
    <main className="idos-scroll" style={{ position: "absolute", inset: 0, overflowY: "auto", background: screenBackground, color: v.text, fontFamily: v.font, padding: "max(72px, calc(env(safe-area-inset-top) + 58px)) 16px 28px", pointerEvents: "auto" }}>
      <section className="idos-shine" style={{ ...panel, maxWidth: 680, margin: "0 auto", padding: "clamp(22px, 5vw, 42px)", display: "grid", gap: 16, justifyItems: "center", textAlign: "center", background: `radial-gradient(circle at 50% 0%, color-mix(in srgb, ${accent} 34%, transparent), transparent 48%), ${v.panel}`, borderColor: accent }}>
        <span style={{ padding: "5px 12px", borderRadius: 999, background: `color-mix(in srgb, ${accent} 20%, transparent)`, color: accent, fontWeight: 900, letterSpacing: 0.8, textTransform: "uppercase", fontSize: 12 }}>
          В разработке
        </span>
        <div className="idos-bounce" aria-hidden="true" style={{ fontSize: "clamp(70px, 16vw, 112px)", filter: `drop-shadow(0 12px 24px color-mix(in srgb, ${accent} 55%, transparent))` }}>{icon}</div>
        <h1 style={{ ...outlined, margin: 0, fontSize: "clamp(30px, 7vw, 48px)" }}>{title}</h1>
        <p style={{ margin: 0, maxWidth: 520, color: v.textDim, lineHeight: 1.6, fontSize: 16 }}>{description}</p>
        <div style={{ width: "min(420px, 100%)", padding: 14, borderRadius: 16, background: "rgba(12, 7, 35, .32)", border: `1px solid color-mix(in srgb, ${accent} 50%, transparent)` }}>
          <strong style={{ color: accent }}>Режим пока недоступен.</strong>{" "}
          Меню и сохранение общего прогресса готовы; игровая механика появится на следующем этапе.
        </div>
      </section>
    </main>
  );
}
