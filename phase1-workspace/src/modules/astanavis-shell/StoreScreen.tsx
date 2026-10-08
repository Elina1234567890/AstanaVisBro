import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { isFail, type LootboxDefinitions } from "@idosgames/core";
import { useIDosGamesClient } from "@idosgames/react";
import { Button, Icon, panel, useBalances, useGameLayout, v } from "@idosgames/react/ui";
import { cardDefinitionsFromItems, createPendingLock, type AstanaVisCardDefinition, type CardRarity } from "./cards-model";
import {
  NEKO_PACK_ID,
  NEKO_PACK_OPTION_ID,
  NEKO_PACK_PRICE,
  configuredNekoPackCards,
  nekoPackSnapshot,
  nekoRewardPool,
  reconciledReward,
  rewardItemFromResponse,
  validateNekoPack,
} from "./neko-pack-model";

type LootboxDefinition = NonNullable<NonNullable<LootboxDefinitions["Definitions"]>[string]>;

type RevealStage = "pack" | "shake" | "glow" | "open" | "card-back" | "flip" | "reveal";
interface RevealedCard {
  id: number;
  name: string;
  itemID: string;
  rarity: CardRarity;
  imagePath: string | null;
}

const TIMELINE: Array<{ stage: RevealStage; duration: number }> = [
  { stage: "pack", duration: 220 },
  { stage: "shake", duration: 460 },
  { stage: "glow", duration: 420 },
  { stage: "open", duration: 320 },
  { stage: "card-back", duration: 280 },
  { stage: "flip", duration: 620 },
  { stage: "reveal", duration: 0 },
];

export function makeStoreScreen() {
  return function StoreScreen(): ReactNode {
    return <Store />;
  };
}

function Store(): ReactNode {
  const client = useIDosGamesClient();
  const balances = useBalances();
  const layout = useGameLayout();
  const [cards, setCards] = useState<AstanaVisCardDefinition[]>([]);
  const [serverDefinition, setServerDefinition] = useState<LootboxDefinition>();
  const pool = useMemo(() => nekoRewardPool(configuredNekoPackCards(cards, serverDefinition)), [cards, serverDefinition]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealedCard | null>(null);
  const [stage, setStage] = useState<RevealStage | null>(null);
  const openLock = useRef(createPendingLock());
  const revealID = useRef(0);
  const vis = balances.find(([currencyID]) => currencyID === "VIS")?.[1] ?? 0;
  const allowedItemIDs = useMemo(() => new Set(pool.map((item) => item.itemID)), [pool]);
  const configError = validateNekoPack(serverDefinition, pool);
  const ready = !loading && !loadError && !configError;

  useEffect(() => {
    let active = true;
    void (async () => {
      const [inventory, titleConfig] = await Promise.all([
        client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 }),
        client.title.getTitlePublicConfiguration(),
      ]);
      if (!active) return;
      if (isFail(inventory)) setLoadError("Could not refresh VIS and InventoryV2. Reopen Store and try again.");
      if (isFail(titleConfig)) setLoadError("NEKO PACK configuration could not be loaded.");
      else {
        setServerDefinition(titleConfig.data.Lootbox?.Definitions?.[NEKO_PACK_ID]);
        setCards(cardDefinitionsFromItems(titleConfig.data.Item?.Catalogs?.Item?.Items));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [client]);

  useEffect(() => {
    if (!reveal) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    void (async () => {
      for (const step of TIMELINE) {
        if (cancelled) return;
        setStage(step.stage);
        if (step.duration) await new Promise<void>((resolve) => { timer = setTimeout(resolve, step.duration); });
      }
    })();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [reveal?.id]);

  const showCard = (itemID: string) => {
    const item = pool.find((candidate) => candidate.itemID === itemID);
    if (!item) {
      setError("The server granted a card outside the NEKO PACK reward pool. Inventory was updated; check Cards.");
      return;
    }
    setReveal({ id: ++revealID.current, itemID, name: item.name, rarity: item.rarity, imagePath: item.imagePath });
  };

  const openPack = async () => {
    if (!ready || vis < NEKO_PACK_PRICE || stage || !openLock.current.tryAcquire(NEKO_PACK_ID)) return;
    setOpening(true);
    setError(null);
    const before = nekoPackSnapshot(client.data.user.state, allowedItemIDs);
    try {
      const result = await client.lootbox.open(NEKO_PACK_ID, 1, NEKO_PACK_OPTION_ID);
      if (isFail(result)) {
        if (result.reason === "connection") {
          const refresh = await client.user.getClientState();
          if (isFail(refresh)) {
            throw new Error("Connection was lost. The server result is uncertain; reopen Store after reconnecting before opening again.");
          }
          const recoveredID = reconciledReward(before, nekoPackSnapshot(client.data.user.state, allowedItemIDs));
          if (recoveredID) {
            showCard(recoveredID);
            return;
          }
          const after = nekoPackSnapshot(client.data.user.state, allowedItemIDs);
          if (before.vis !== null && after.vis === before.vis) {
            throw new Error("No VIS was charged. The pack did not open; you can try again.");
          }
          throw new Error("The open may have completed, but its reward could not be identified. Inventory was refreshed; check Cards before opening again.");
        }
        const detail = result.error ?? "";
        if (/insufficient|not enough|balance/i.test(detail)) throw new Error("Not enough VIS. NEKO PACK costs 100 VIS.");
        throw new Error(detail || `NEKO PACK failed (${result.reason}).`);
      }

      const itemID = rewardItemFromResponse(result.data, allowedItemIDs);
      if (!itemID) {
        const refresh = await client.user.getClientState();
        if (isFail(refresh)) throw new Error("Pack opened, but its reward could not be confirmed. Reopen Cards after reconnecting.");
        throw new Error("Pack opened, but the response did not contain exactly one Tier 1 card. Inventory was refreshed; check Cards.");
      }
      showCard(itemID);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "NEKO PACK could not be opened.");
    } finally {
      openLock.current.release(NEKO_PACK_ID);
      setOpening(false);
    }
  };

  const rarityColor = (rarity: CardRarity) => ({ common: v.green, rare: v.blue, epic: v.red, legendary: v.gold })[rarity];
  const card = reveal;

  return (
    <section style={{ ...panel, width: "100%", maxWidth: 820, margin: "0 auto", padding: "clamp(16px, 4vw, 32px)", display: "grid", gap: 20, boxSizing: "border-box" }}>
      <style>{ANIMATION_CSS}</style>
      <header style={{ display: "flex", alignItems: "end", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ color: v.gold, fontSize: 11, fontWeight: 900, letterSpacing: 2.5 }}>NEKO STARS · SHOP</div>
          <h1 style={{ margin: "5px 0 0", color: v.text, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1.05 }}>STORE</h1>
        </div>
        <div aria-live="polite" style={{ color: v.textDim, fontSize: 13, fontWeight: 800 }}>YOUR VIS <strong style={{ color: v.gold }}>{Math.floor(vis)}</strong></div>
      </header>

      {loading ? <div role="status" style={messageStyle}>Loading pack and balance…</div> : null}
      {loadError ? <div role="alert" style={{ ...messageStyle, color: v.red }}>{loadError}</div> : null}
      {configError && !loading ? <div role="alert" style={{ ...messageStyle, color: v.red }}>{configError}</div> : null}
      {error ? <div role="alert" style={{ ...messageStyle, color: v.red }}>{error}</div> : null}

      <article style={{ ...panel, width: "100%", maxWidth: 480, justifySelf: "center", padding: "clamp(16px, 5vw, 28px)", display: "grid", justifyItems: "center", gap: 16, boxSizing: "border-box" }}>
        <div aria-hidden="true" style={{ width: "min(100%, 310px)", minHeight: 150, border: `2px solid ${v.gold}`, background: "#222", boxShadow: `6px 6px 0 ${v.shadow}`, display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
          <div className={opening ? "neko-pack-shake" : ""} style={{ display: "grid", placeItems: "center", gap: 4, color: v.gold }}>
            <Icon glyph="gift" size={74} />
            <strong style={{ color: v.text, fontSize: 16, letterSpacing: 2 }}>NEKO PACK</strong>
          </div>
          <span style={{ position: "absolute", inset: "auto 10px 9px", height: 2, background: v.gold }} />
        </div>
        <div style={{ textAlign: "center", display: "grid", gap: 5 }}>
          <h2 style={{ margin: 0, color: v.text, fontSize: 22, letterSpacing: 1.2 }}>NEKO PACK</h2>
          <div style={{ color: v.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>1 RANDOM NEKO CARD · TIER 1</div>
          <div style={{ color: v.gold, fontSize: 17, fontWeight: 900, marginTop: 4 }}>100 VIS</div>
        </div>
        {vis < NEKO_PACK_PRICE && !loading ? <div style={{ color: v.red, fontSize: 12, fontWeight: 700 }}>Not enough VIS. You need 100 VIS.</div> : null}
        <Button
          tone="gold"
          size={layout === "phone" ? "lg" : "md"}
          disabled={!ready || vis < NEKO_PACK_PRICE || opening || stage !== null}
          busy={opening}
          onClick={() => void openPack()}
          style={{ width: "100%", maxWidth: 250 }}
          title="Open one NEKO PACK for 100 VIS"
        >
          {opening ? "OPENING…" : "OPEN"}
        </Button>
      </article>

      {card && stage ? (
        <div role="dialog" aria-modal="true" aria-label="NEKO PACK reward" style={{ position: "fixed", inset: 0, zIndex: 10000, background: "#000e", display: "grid", placeItems: "center", padding: 16, boxSizing: "border-box" }}>
          <div style={{ width: "min(100%, 420px)", display: "grid", justifyItems: "center", gap: 16, textAlign: "center" }}>
            <div style={{ color: v.gold, fontSize: 12, fontWeight: 900, letterSpacing: 3 }}>NEKO PACK</div>
            {stage === "pack" || stage === "shake" || stage === "glow" || stage === "open" ? (
              <div className={`neko-reveal-${stage}`} style={{ width: "min(70vw, 270px)", height: "min(70vw, 270px)", maxWidth: 270, maxHeight: 270, border: `3px solid ${stage === "glow" ? rarityColor(card.rarity) : v.gold}`, background: "#222", display: "grid", placeItems: "center", alignContent: "center", gap: 10, color: v.gold, boxShadow: stage === "glow" ? `0 0 ${card.rarity === "epic" || card.rarity === "legendary" ? 48 : 22}px ${rarityColor(card.rarity)}` : `6px 6px 0 ${v.shadow}`, transition: "box-shadow 350ms ease" }}>
                <Icon glyph="gift" size={stage === "open" ? 96 : 82} />
                <strong style={{ color: v.text, letterSpacing: 2 }}>NEKO PACK</strong>
              </div>
            ) : (
              <div className={`neko-reveal-${stage}`} style={{ width: "min(70vw, 270px)", height: "min(70vw, 270px)", maxWidth: 270, maxHeight: 270, position: "relative", perspective: 900, boxShadow: stage === "flip" || stage === "reveal" ? `0 0 ${card.rarity === "epic" || card.rarity === "legendary" ? 48 : 22}px ${rarityColor(card.rarity)}` : "none", transition: "box-shadow 350ms ease" }}>
                <div className={`neko-card-flip ${stage === "flip" || stage === "reveal" ? "is-flipped" : ""}`} style={{ width: "100%", height: "100%", position: "relative", transformStyle: "preserve-3d", transition: "transform 620ms cubic-bezier(.2,.75,.2,1)" }}>
                  <div style={cardFace(v.gold, "#252525")}><span style={{ fontSize: 60, fontWeight: 900 }}>N</span><span style={{ fontSize: 12, fontWeight: 900, letterSpacing: 2 }}>NEKO STARS</span></div>
                  <div style={{ ...cardFace(rarityColor(card.rarity), "#1d1d1d"), transform: "rotateY(180deg)" }}>
                    {card.imagePath ? <img src={card.imagePath} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon glyph="user" size={96} />}
                    <span style={{ position: "absolute", inset: "auto 0 0", background: "#101010ee", padding: 8, fontSize: 13, fontWeight: 900 }}>TIER 1</span>
                  </div>
                </div>
              </div>
            )}
            {stage === "reveal" ? (
              <div style={{ display: "grid", justifyItems: "center", gap: 8 }}>
                <h2 style={{ margin: 0, color: v.text, fontSize: "clamp(22px, 6vw, 30px)" }}>{card.name}</h2>
                <div style={{ color: rarityColor(card.rarity), fontSize: 13, fontWeight: 900, letterSpacing: 1.6, textTransform: "uppercase" }}>{card.rarity}</div>
                <div style={{ color: v.textDim, fontSize: 13, fontWeight: 900, letterSpacing: 1.4 }}>TIER 1 · +1 CARD</div>
                <Button tone="gold" size="lg" onClick={() => { setReveal(null); setStage(null); setError(null); }}>CONTINUE</Button>
              </div>
            ) : <div aria-live="polite" style={{ color: v.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{animationLabel(stage)}</div>}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function cardFace(border: string, background: string): CSSProperties {
  return {
    position: "absolute", inset: 0, backfaceVisibility: "hidden", border: `3px solid ${border}`,
    background, boxShadow: `6px 6px 0 ${v.shadow}`, display: "grid", placeItems: "center",
    alignContent: "center", gap: 12, overflow: "hidden", color: border,
  };
}

function animationLabel(stage: RevealStage): string {
  if (stage === "shake") return "SHAKING…";
  if (stage === "glow") return "A RARE ONE?";
  if (stage === "open") return "OPENING…";
  if (stage === "card-back") return "YOUR CARD";
  if (stage === "flip") return "REVEAL…";
  return "NEKO PACK";
}

const messageStyle = { color: v.textDim, fontSize: 12, fontWeight: 700 } as const;

const ANIMATION_CSS = `
@keyframes nekoShake { 0%,100% { transform: translateX(0) rotate(0); } 20% { transform: translateX(-7px) rotate(-3deg); } 40% { transform: translateX(7px) rotate(3deg); } 60% { transform: translateX(-5px) rotate(-2deg); } 80% { transform: translateX(5px) rotate(2deg); } }
.neko-pack-shake { animation: nekoShake .46s ease-in-out both; }
.neko-reveal-shake { animation: nekoShake .46s ease-in-out both; }
.neko-reveal-open { animation: nekoPop .32s ease-out both; }
@keyframes nekoPop { 0% { transform: scale(1); } 60% { transform: scale(1.1); } 100% { transform: scale(.96); } }
.neko-card-flip.is-flipped { transform: rotateY(180deg); }
@media (prefers-reduced-motion: reduce) { .neko-pack-shake, .neko-reveal-open { animation-duration: .01ms; } }
`;
