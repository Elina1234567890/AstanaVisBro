import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Button, Icon, panel, useGameLayout, v } from "@idosgames/react/ui";
import { isFail } from "@idosgames/core";
import {
  CARD_MERGE_COUNT,
  canCombineTierOne,
  cardDefinitionsFromItems,
  createPendingLock,
  groupCards,
  type CardsInventory,
  type AstanaVisCardDefinition,
  type CardCharacterGroup,
} from "./cards-model";
import { CardDetailVisual } from "./CardDetailVisual";

interface CardsOptions {
  onTrade: (itemID: string) => void;
  onMarketplace: () => void;
  getBusy: () => boolean;
  subscribe: (listener: () => void) => () => void;
  beginCraft: () => boolean;
  endCraft: () => void;
}

export function makeCardsScreen(options: CardsOptions) {
  return function CardsScreen(): ReactNode {
    return <Cards options={options} />;
  };
}

function Cards({ options }: { options: CardsOptions }): ReactNode {
  const economyBusy = useSyncExternalStore(options.subscribe, options.getBusy);
  const client = useIDosGamesClient();
  const userState = useUserState();
  const layout = useGameLayout();
  const [definitions, setDefinitions] = useState<AstanaVisCardDefinition[]>([]);
  const [refreshing, setRefreshing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingCharacters, setPendingCharacters] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedCardID, setSelectedCardID] = useState<string | null>(null);
  const [cardTilt, setCardTilt] = useState({ x: 0, y: 0 });
  const [sensorTiltEnabled, setSensorTiltEnabled] = useState(false);
  const pendingRef = useRef(createPendingLock());

  const openCard = (itemID: string) => {
    setSelectedCardID(itemID);
    setSensorTiltEnabled(false);
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    const orientation = window.DeviceOrientationEvent as typeof DeviceOrientationEvent & { requestPermission?: () => Promise<"granted" | "denied"> };
    if (orientation.requestPermission) {
      void orientation.requestPermission().then((permission) => setSensorTiltEnabled(permission === "granted")).catch(() => setSensorTiltEnabled(false));
    } else {
      setSensorTiltEnabled(true);
    }
  };

  useEffect(() => {
    if (!selectedCardID || !sensorTiltEnabled) return;
    const onOrientation = (event: DeviceOrientationEvent) => {
      if (event.gamma === null || event.beta === null) return;
      setCardTilt({ x: Math.max(-1, Math.min(1, event.gamma / 30)), y: Math.max(-1, Math.min(1, (event.beta - 35) / 45)) });
    };
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [selectedCardID, sensorTiltEnabled]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      const [inventoryResult, craftResult, titleConfigResult] = await Promise.all([
        client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 }),
        client.craft.getDefinitions(),
        client.title.getTitlePublicConfiguration(),
      ]);
      if (!mounted) return;
      setRefreshing(false);
      if (isFail(inventoryResult)) setError("Inventory could not be refreshed. Try reopening Cards.");
      if (isFail(craftResult)) setError("Craft recipes could not be loaded. Try reopening Cards.");
      if (isFail(titleConfigResult)) setError("Card definitions could not be loaded from the Title configuration.");
      else setDefinitions(cardDefinitionsFromItems(titleConfigResult.data.Item?.Catalogs?.Item?.Items));
    })();
    return () => { mounted = false; };
  }, [client]);

  const groups = groupCards(definitions, userState?.InventoryV2 as CardsInventory | undefined);
  const selectedCard = definitions.find((card) => card.itemID === selectedCardID);
  const selectedGroup = selectedCard ? groups.find((group) => group.characterId === selectedCard.characterId) : undefined;

  const combine = async (group: CardCharacterGroup) => {
    if (!canCombineTierOne(group.tierOneAmount)) return;
    const source = group.cards.find((card) => card.tier === 1);
    const target = group.cards.find((card) => card.tier === 2);
    if (!source || !target || !source.collectionId || !source.craftRarityId || !target.craftRarityId) {
      setError("This card has no valid server recipe configuration.");
      return;
    }
    if (!pendingRef.current.tryAcquire(group.characterId)) return;
    if (!options.beginCraft()) { pendingRef.current.release(group.characterId); return; }

    // One request consumes five stackable T1 copies. The server validates the isolated
    // CollectionID + craft RarityID pool and atomically applies the InventoryV2 delta.
    setPendingCharacters(pendingRef.current.snapshot());
    setError(null);
    setNotice(null);
    try {
      const freshInventory = await client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 });
      if (isFail(freshInventory)) throw new Error("Inventory could not be checked before combining.");
      const available = client.data.user.state?.InventoryV2?.Items?.[source.itemID]?.StackableAmount ?? 0;
      if (!canCombineTierOne(available)) throw new Error("Not enough available cards. Cards in escrow cannot be combined.");
      const definitionsResult = await client.craft.getDefinitions();
      if (isFail(definitionsResult)) throw new Error("Craft recipes could not be loaded.");
      const recipe = definitionsResult.data.CraftDefinitions?.Definitions?.[`merge-${group.characterId}-t1-t2`];
      if (
        recipe?.Type !== "TradeUpCollection" ||
        recipe.CollectionID !== source.collectionId ||
        recipe.InputRarityID !== source.craftRarityId ||
        recipe.OutputRarityID !== target.craftRarityId ||
        recipe.RequiredItemCount !== CARD_MERGE_COUNT
      ) throw new Error("The server recipe does not match this card. No cards were consumed.");

      const result = await client.craft.craft(
        recipe.CraftID ?? `merge-${group.characterId}-t1-t2`,
        Array.from({ length: CARD_MERGE_COUNT }, () => source.itemID),
      );
      if (isFail(result)) {
        if (result.reason === "connection") {
          const inventoryRefresh = await client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 });
          if (isFail(inventoryRefresh)) {
            throw new Error("Network response was lost and inventory could not be checked. Reopen Cards before trying again.");
          }
          throw new Error("Network response was lost. Inventory was refreshed; check the counts before combining again.");
        }
        throw new Error(result.error || `Craft failed (${result.reason}).`);
      }
      const outputID = result.data.Results?.[0]?.Output?.ItemID;
      if (outputID !== target.itemID) {
        setNotice(`Combine completed. Server returned ${outputID ?? "an output"}; refresh Cards to confirm.`);
      } else {
        setNotice(`${group.characterName} · T1 → T2 complete`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Combine failed. Try again.");
    } finally {
      options.endCraft();
      pendingRef.current.release(group.characterId);
      setPendingCharacters(pendingRef.current.snapshot());
    }
  };

  return (
    <section style={{ ...panel, width: "100%", maxWidth: 980, margin: "0 auto", padding: "clamp(16px, 3vw, 28px)", display: "grid", gap: 18, boxSizing: "border-box" }}>
      <header style={{ display: "flex", alignItems: "end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ color: v.red, fontSize: 11, fontWeight: 900, letterSpacing: 2.5 }}>NEKO STARS · COLLECTION</div>
          <h1 style={{ margin: "5px 0 0", color: v.text, fontSize: "clamp(24px, 5vw, 36px)", lineHeight: 1.05 }}>CARDS</h1>
        </div>
        <Button tone="grey" disabled={economyBusy} onClick={options.onMarketplace}>MARKETPLACE</Button>
      </header>

      {refreshing ? <div role="status" style={muted}>Syncing InventoryV2…</div> : null}
      {error ? <div role="alert" style={{ ...muted, color: v.red }}>{error}</div> : null}
      {notice ? <div role="status" style={{ ...muted, color: v.green }}>{notice}</div> : null}

      {groups.length === 0 ? (
        <div style={{ ...panel, padding: 24, color: v.textDim, textAlign: "center" }}>
          Card definitions are not loaded yet. Add the AstanaVis card Items to the Title configuration.
        </div>
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {groups.map((group) => (
            <article key={group.characterId} style={{ ...panel, padding: "clamp(12px, 2.5vw, 20px)", display: "grid", gridTemplateColumns: layout === "phone" ? "minmax(0, 1fr)" : "minmax(0, 1fr) auto", alignItems: "center", gap: 14 }}>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ color: v.text, margin: "0 0 10px", fontSize: 16, letterSpacing: 1.3 }}>{group.characterName}</h2>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {group.cards.map((card) => (
                    <button key={card.itemID} type="button" onClick={() => openCard(card.itemID)} aria-label={`Open ${card.isLocked ? `locked ${cardRarityLabel(card.rarity)}` : `${card.name} ${cardRarityLabel(card.rarity)}`} card`} style={{ all: "unset", cursor: "pointer", borderRadius: 3 }}>
                    <CardTile amount={card.amount} name={card.name} imagePath={card.imagePath} rarity={card.rarity} locked={card.isLocked} />
                    </button>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {selectedCard && selectedGroup ? (
        <div role="dialog" aria-modal="true" aria-label={`${selectedCard.name} card details`} onClick={() => setSelectedCardID(null)} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: "16px 16px 80px", background: "#000d", boxSizing: "border-box" }}>
          <article onClick={(event) => event.stopPropagation()} style={{ ...panel, width: "min(92vw, 440px)", maxHeight: "calc(100dvh - 112px)", overflowY: "auto", padding: "clamp(12px, 4vw, 24px)", display: "grid", justifyItems: "center", gap: 12, boxSizing: "border-box" }}>
            <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: v.gold, fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>ASTANAVIS · {cardRarityLabel(selectedCard.rarity)}</span>
              <Button tone="grey" size="sm" onClick={() => setSelectedCardID(null)}>CLOSE</Button>
            </div>
            <CardDetailVisual name={selectedCard.name.toUpperCase()} rarity={selectedCard.rarity} imagePath={selectedCard.imagePath} locked={selectedGroup.cards.find((card) => card.itemID === selectedCard.itemID)?.isLocked ?? true} tilt={cardTilt} sensorTiltEnabled={sensorTiltEnabled} onTilt={setCardTilt} />
            <div style={{ color: v.textDim, fontSize: 12, fontWeight: 800, letterSpacing: 1 }}>{selectedGroup.cards.find((card) => card.itemID === selectedCard.itemID)?.isLocked ? "NOT COLLECTED" : `OWNED ×${selectedGroup.cards.find((card) => card.itemID === selectedCard.itemID)?.amount ?? 0}`}</div>
            <Button tone="grey" size="md" disabled={economyBusy || refreshing || !(selectedGroup.cards.find(card => card.itemID === selectedCard.itemID)?.amount)} onClick={() => { setSelectedCardID(null); options.onTrade(selectedCard.itemID); }} style={{ width: "100%" }}>TRADE</Button>
            {selectedCard.tier === 1 ? <Button tone="red" size="md" disabled={!canCombineTierOne(selectedGroup.tierOneAmount) || economyBusy || refreshing} busy={pendingCharacters.has(selectedGroup.characterId)} onClick={() => void combine(selectedGroup)} style={{ width: "100%" }}>COMBINE {CARD_MERGE_COUNT} · {selectedGroup.tierOneAmount}/{CARD_MERGE_COUNT}</Button> : null}
            {notice ? <div role="status" style={{ ...muted, color: v.green }}>{notice}</div> : null}
            {error ? <div role="alert" style={{ ...muted, color: v.red }}>{error}</div> : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function CardTile({ amount, name, imagePath, rarity, locked }: { amount: number; name: string; imagePath: string | null; rarity: string; locked: boolean }): ReactNode {
  return (
    <div aria-label={locked ? "Locked card" : `${name}, ${cardRarityLabel(rarity)}, ${amount} owned`} style={{ width: "clamp(94px, 26vw, 132px)", minHeight: 130, boxSizing: "border-box", border: `1px solid ${locked ? v.panelEdge : v.red}`, background: v.panelDeep, padding: 8, display: "grid", gridTemplateRows: "1fr auto auto", gap: 5, textAlign: "center", transition: "transform 140ms ease, box-shadow 140ms ease" }}>
      <div style={{ position: "relative", minHeight: 74, display: "grid", placeItems: "center", background: locked ? "#242424" : "#351f20", color: locked ? v.textDim : v.gold, overflow: "hidden" }}>
        {locked ? <span aria-hidden="true" style={{ fontSize: 46, fontWeight: 900, filter: "blur(1px)", opacity: 0.7 }}>?</span> : imagePath ? <img src={imagePath} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Icon glyph="user" size={40} />}
        <span style={{ position: "absolute", left: 5, top: 4, color: v.text, fontSize: 9, fontWeight: 900 }}>{locked ? "???" : cardRarityLabel(rarity)}</span>
      </div>
      <strong style={{ color: locked ? v.textDim : v.text, fontSize: 11, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{locked ? "???" : name}</strong>
      <span style={{ color: v.textDim, fontSize: 10, textTransform: "uppercase", letterSpacing: 0.6 }}>{locked ? "LOCKED" : `${cardRarityLabel(rarity)} · x${amount}`}</span>
    </div>
  );
}

const muted = { color: v.textDim, fontSize: 12, fontWeight: 700 } as const;

function cardRarityLabel(rarity: string): string {
  if (rarity === "common") return "ОБЫЧНАЯ";
  if (rarity === "rare") return "РЕДКАЯ";
  if (rarity === "epic") return "ЭПИЧЕСКАЯ";
  if (rarity === "legendary") return "ЛЕГЕНДАРНАЯ";
  return rarity.toUpperCase();
}
