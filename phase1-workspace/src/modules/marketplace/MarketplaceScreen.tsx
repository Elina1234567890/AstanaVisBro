import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from "react";
import { isFail, type OperationResult, type MarketplaceDefinitions, type MarketplaceMyStateResponse, type MarketplaceOfferView } from "@idosgames/core";
import type { FeatureRegistry } from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import { Button, panel, useNow, v } from "@idosgames/react/ui";
import { availableAmount, canPay, cardPrice, isExpired, tradeCards, validAmount, type TradeCard, type TradeController } from "./barter-model";

export function makeMarketplaceScreen(features: FeatureRegistry, controller: TradeController) {
  return function MarketplaceScreen(): ReactNode { return <Marketplace features={features} controller={controller} />; };
}

function Marketplace({ features, controller }: { features: FeatureRegistry; controller: TradeController }): ReactNode {
  const client = useIDosGamesClient();
  const userState = useUserState();
  const busy = useSyncExternalStore(controller.subscribe, controller.getSnapshot);
  const now = useNow();
  const [cards, setCards] = useState<TradeCard[]>([]);
  const [defs, setDefs] = useState<MarketplaceDefinitions | null>(null);
  const [open, setOpen] = useState(false);
  const [mine, setMine] = useState<MarketplaceMyStateResponse | null>(null);
  const [offers, setOffers] = useState<MarketplaceOfferView[]>([]);
  const [loading, setLoading] = useState(true);
  const [synced, setSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [offerID, setOfferID] = useState(controller.draft);
  const [requestID, setRequestID] = useState("");
  const [amount, setAmount] = useState("1");
  const [requestedAmount, setRequestedAmount] = useState("1");
  const [kind, setKind] = useState<"Listing" | "BuyOrder">("Listing");
  const [duration, setDuration] = useState(24);
  const [view, setView] = useState<"Listing" | "BuyOrder" | "mine">("Listing");
  const [browseItem, setBrowseItem] = useState("");
  const [continuation, setContinuation] = useState<string>();
  const readLock = useRef(false);
  const alive = useRef(true);
  const userID = client.auth.context?.userID ?? "";
  const recoveryKey = "astanavis:marketplace:pending:" + client.titleID + ":" + userID;
  const [uncertain, setUncertain] = useState(() => { try { return sessionStorage.getItem(recoveryKey) !== null; } catch { return false; } });
  const inventory = userState?.InventoryV2;
  const offered = cards.find(card => card.itemID === offerID);
  const requested = cards.find(card => card.itemID === requestID);
  const owned = availableAmount(inventory, offerID);
  const myOffers = [...new Map([...(mine?.MyOffers ?? []), ...(mine?.MyBuyOrders ?? []), ...(mine?.Claimables ?? [])]
    .filter(offer => offer.OfferType === "Listing" || offer.OfferType === "BuyOrder")
    .map(offer => [offer.OfferID, offer])).values()];
  const durations = (kind === "Listing" ? defs?.Listings?.AllowedDurationsHours : defs?.BuyOrders?.AllowedDurationsHours) ?? [24, 72, 168];
  const allowedDurations = durations.length ? durations : [24, 72, 168];
  const enabledKind = kind === "Listing" ? defs?.Listings?.Enabled !== false : defs?.BuyOrders?.Enabled !== false;
  const canCreate = open && enabledKind && synced && !loading && !busy && !uncertain && offered && requested
    && offerID !== requestID && validAmount(Number(amount)) && validAmount(Number(requestedAmount))
    && Number(amount) <= owned && allowedDurations.includes(duration);

  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const refreshOwned = useCallback(async () => {
    const inventoryResult = await client.cache.ensureState(["InventoryV2"], { maxAgeMs: 0 });
    if (isFail(inventoryResult)) { if (alive.current) setSynced(false); throw new Error("Inventory refresh failed. Refresh before trading again."); }
    if (alive.current) setSynced(true);
  }, [client]);
  const refreshMine = useCallback(async () => {
    const result = await controller.call(() => client.marketplace.getMyState());
    if (isFail(result)) throw new Error(result.error || "Your offers could not be loaded.");
    if (alive.current) setMine(result.data);
    features.setBadge("marketplace", result.data.Claimables?.length ?? 0);
  }, [client, controller, features]);
  const browse = useCallback(async (item: string, type: "Listing" | "BuyOrder", token?: string) => {
    const result = await controller.call(() => type === "BuyOrder"
      ? client.marketplace.getBuyOrders(item || undefined, token, 25)
      : client.marketplace.getOffersByItem(item, "Listing", token, 25));
    if (isFail(result)) throw new Error(result.error || "Offers could not be loaded.");
    if (alive.current) {
      setOffers(previous => token ? [...new Map([...previous, ...(result.data.Offers ?? [])].map(offer => [offer.OfferID, offer])).values()] : result.data.Offers ?? []);
      setContinuation(result.data.ContinuationToken ?? undefined);
    }
  }, [client, controller]);

  useEffect(() => {
    void (async () => {
      try {
        const title = await client.title.getTitlePublicConfiguration();
        if (isFail(title)) throw new Error("Card definitions could not be loaded.");
        const catalog = tradeCards(title.data.Item);
        if (alive.current) {
          setCards(catalog);
          setOfferID(current => catalog.some(card => card.itemID === current) ? current : catalog[0]?.itemID ?? "");
          const initialOffer = catalog.some(card => card.itemID === controller.draft) ? controller.draft : catalog[0]?.itemID;
          setRequestID(catalog.find(card => card.itemID !== initialOffer)?.itemID ?? "");
          setBrowseItem(catalog[0]?.itemID ?? "");
        }
        const config = await controller.call(() => client.marketplace.getDefinitions());
        if (isFail(config)) throw new Error(config.error || "Marketplace configuration could not be loaded.");
        if (alive.current) { setDefs(config.data.Definitions ?? null); setOpen(config.data.Definitions?.Enabled === true && config.data.IsOpenNow === true && config.data.GatePassed === true); }
        await refreshOwned();
        await refreshMine();
        if (catalog[0]) await browse(catalog[0].itemID, "Listing");
      } catch (cause) { if (alive.current) setError(message(cause)); }
      finally { if (alive.current) setLoading(false); }
    })();
  }, [client, controller, refreshOwned, refreshMine, browse]);

  const reload = async (loadMore = false, nextItem = browseItem, nextView = view) => {
    if (readLock.current || busy || loading) return;
    readLock.current = true; setLoading(true); setError(null);
    try {
      await refreshOwned();
      await refreshMine();
      const config = await controller.call(() => client.marketplace.getDefinitions());
      if (isFail(config)) throw new Error(config.error || "Marketplace configuration could not be loaded.");
      setDefs(config.data.Definitions ?? null);
      setOpen(config.data.Definitions?.Enabled === true && config.data.IsOpenNow === true && config.data.GatePassed === true);
      if (nextView !== "mine") await browse(nextItem, nextView, loadMore ? continuation : undefined);
    } catch (cause) { setError(message(cause)); } finally { readLock.current = false; if (alive.current) setLoading(false); }
  };
  const run = async <T,>(action: () => Promise<OperationResult<T>>, success: string, creating = false, accepting?: MarketplaceOfferView) => {
    if (loading || !controller.acquire()) return;
    setError(null); setNotice(null);
    try {
      await refreshOwned();
      if (accepting?.OfferID) {
        const fresh = await controller.call(() => client.marketplace.getOffer(accepting.OfferID!));
        if (isFail(fresh) || !fresh.data.Offer || fresh.data.Offer.Status !== "Active" || isExpired(fresh.data.Offer)) throw new Error("This offer is no longer available.");
        const required = fresh.data.Offer.OfferType === "BuyOrder" ? cardPriceForOffer(fresh.data.Offer) : fresh.data.Offer.Price;
        if (!canPay(required, client.data.user.state?.InventoryV2)) throw new Error("Not enough available cards to accept this offer.");
      }
      if (creating) {
        if (!offered || !requested || !validAmount(Number(amount)) || !validAmount(Number(requestedAmount)) || Number(amount) > availableAmount(client.data.user.state?.InventoryV2, offerID)) throw new Error("Not enough available cards, or invalid amount.");
        try { sessionStorage.setItem(recoveryKey, JSON.stringify({ itemID: offerID, amount, requestID, requestedAmount, kind, at: new Date().toISOString() })); } catch { /* In-memory lock still prevents double submit. */ }
        if (alive.current) setUncertain(true);
      }
      const result = await controller.call(action);
      if (isFail(result)) {
        if (creating && (result.reason === "connection" || result.reason === "validation")) {
          if (alive.current) { setUncertain(true); setView("mine"); }
          throw new Error("The response was lost. Check MY OFFERS before creating another offer. This action was not retried.");
        }
        if (creating) { try { sessionStorage.removeItem(recoveryKey); } catch {} if (alive.current) setUncertain(false); }
        throw new Error(result.error || "Marketplace action failed.");
      }
      if (creating && (typeof result.data !== "object" || result.data === null || !("OfferID" in result.data) || typeof result.data.OfferID !== "string")) {
        if (alive.current) setView("mine");
        throw new Error("The server response did not identify the created offer. Check MY OFFERS before creating another offer.");
      }
      if (creating) { try { sessionStorage.removeItem(recoveryKey); } catch {} if (alive.current) setUncertain(false); }
      if (alive.current) { setNotice(success); if (creating) setView("mine"); }
    } catch (cause) { if (alive.current) setError(message(cause)); }
    finally {
      try { await refreshOwned(); await refreshMine(); if (view !== "mine") await browse(browseItem, view); }
      catch (cause) { if (alive.current) setError(message(cause)); }
      controller.release();
    }
  };
  const create = () => {
    if (!canCreate || !offered || !requested) return;
    void run(() => kind === "Listing"
      ? client.marketplace.createListing(offered.itemID, offered.catalogID, Number(amount), cardPrice(requested, Number(requestedAmount)), duration)
      // Reverse the order: the buyer escrows YOUR OFFER as payment and asks for REQUEST as goods.
      : client.marketplace.createBuyOrder(requested.itemID, requested.catalogID, Number(requestedAmount), cardPrice(offered, Number(amount)), duration),
      "Offer created. Your offered cards are now held in escrow.", true);
  };
  const accept = (offer: MarketplaceOfferView) => {
    if (!offer.OfferID || !open || offer.CreatorUserID === userID || offer.Status !== "Active" || isExpired(offer)) return;
    void run(() => offer.OfferType === "BuyOrder" ? client.marketplace.fillBuyOrder(offer.OfferID!) : client.marketplace.buy(offer.OfferID!), "Exchange completed. Inventory refreshed.", false, offer);
  };
  const label = (id?: string | null, catalogID?: string | null) => {
    const card = cards.find(card => card.itemID === id && (!catalogID || card.catalogID === catalogID));
    return card ? card.name + " · T" + card.tier : id ?? "Unknown item";
  };
  const bundleText = (offer: MarketplaceOfferView) => (offer.Price?.Entries ?? []).map(entry =>
    (entry.Amount ?? 0) + " × " + (entry.Type === "Item" ? label(entry.ItemID, entry.CatalogID) : entry.CurrencyID ?? entry.Type)).join(" + ") || "—";

  return <section style={{ ...panel, width: "100%", maxWidth: 980, margin: "0 auto", padding: "clamp(14px, 3vw, 28px)", display: "grid", gap: 18, boxSizing: "border-box" }}>
    <header style={row}><div><div style={muted}>NEKO STARS · PUBLIC CARD EXCHANGE</div><h1 style={{ margin: "4px 0", color: v.text }}>MARKETPLACE</h1></div>
      <Button tone="grey" onClick={() => features.open("cards")}>CARDS</Button></header>
    <p style={{ ...muted, margin: 0 }}>Публичный обмен карточками. Предложенные карты уходят в escrow до покупки, отмены или возврата после истечения срока. VIS не требуется.</p>
    {loading && <div role="status">Syncing marketplace…</div>}
    {error && <div role="alert" style={{ color: v.red }}>{error}</div>}
    {notice && <div role="status" style={{ color: v.green }}>{notice}</div>}
    {!open && !loading && <div role="status">Marketplace is closed. You can still cancel offers and reclaim escrow.</div>}
    {uncertain && <div role="alert" style={{ ...box, borderColor: v.gold }}>
      Проверь MY OFFERS: предыдущий запрос мог создать предложение. Повторная отправка заблокирована.
      <Button tone="grey" disabled={busy || loading || !synced || !mine} onClick={() => { try { sessionStorage.removeItem(recoveryKey); } catch {} setUncertain(false); }}>I CHECKED MY OFFERS</Button>
    </div>}
    <div style={{ ...box, display: "grid", gap: 14 }}>
      <div style={row}><h2 style={heading}>CREATE OFFER</h2>
        <label style={field}>Mechanism<select aria-label="Offer mechanism" value={kind} disabled={busy} onChange={event => { setKind(event.target.value as "Listing" | "BuyOrder"); setDuration(24); }} style={input}>
          <option value="Listing">Listing · escrow my cards</option><option value="BuyOrder">BuyOrder · escrow my payment</option>
        </select></label></div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 230px), 1fr))", gap: 16 }}>
        <div style={field}><h3 style={heading}>YOUR OFFER</h3>
          <label style={field}>Item / Tier<select aria-label="Your offer item" value={offerID} disabled={busy} onChange={event => setOfferID(event.target.value)} style={input}>
            {cards.map(card => <option key={card.itemID} value={card.itemID}>{card.name} · T{card.tier} · {availableAmount(inventory, card.itemID)} available</option>)}
          </select></label>
          <label style={field}>Amount<input aria-label="Your offer amount" type="number" min={1} max={Math.min(999, owned)} step={1} value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} style={input} /></label>
          <span style={muted}>Available: {owned} · Escrow: {mine?.MyOffers?.filter(offer => offer.GoodsItemID === offerID).reduce((sum, offer) => sum + (offer.GoodsAmount ?? 0), 0) ?? 0} in listings</span>
        </div>
        <div style={field}><h3 style={heading}>REQUEST</h3>
          <label style={field}>Item / Tier<select aria-label="Requested item" value={requestID} disabled={busy} onChange={event => setRequestID(event.target.value)} style={input}>
            {cards.map(card => <option key={card.itemID} value={card.itemID}>{card.name} · T{card.tier}</option>)}
          </select></label>
          <label style={field}>Amount<input aria-label="Requested amount" type="number" min={1} max={999} step={1} value={requestedAmount} disabled={busy} onChange={event => setRequestedAmount(event.target.value)} style={input} /></label>
          <span style={muted}>You receive the requested amount on settlement.</span>
        </div>
      </div>
      <div style={row}><label style={field}>Expiration<select aria-label="Offer duration" value={duration} disabled={busy} onChange={event => setDuration(Number(event.target.value))} style={input}>
        {allowedDurations.map(hours => <option key={hours} value={hours}>{hours} hours</option>)}
      </select></label><Button tone="red" disabled={!canCreate} busy={busy} onClick={create}>CREATE OFFER</Button></div>
      {Number(amount) > owned && <span style={{ color: v.red }}>Not enough available cards.</span>}
      {offerID === requestID && <span style={muted}>Choose a different card for REQUEST.</span>}
    </div>
    <div style={row}>
      {(["Listing", "BuyOrder", "mine"] as const).map(type => <Button key={type} tone={view === type ? "red" : "grey"} disabled={busy || loading} onClick={() => { setView(type); void reload(false, browseItem, type); }}>{type === "mine" ? "MY OFFERS / ESCROW" : type === "Listing" ? "LISTINGS" : "BUY ORDERS"}</Button>)}
      <Button tone="grey" disabled={busy || loading} onClick={() => void reload()}>REFRESH</Button>
    </div>
    {view !== "mine" && <label style={field}>Browse item<select aria-label="Browse item" value={browseItem} disabled={busy || loading} style={input} onChange={event => { setBrowseItem(event.target.value); void reload(false, event.target.value); }}>
      {cards.map(card => <option key={card.itemID} value={card.itemID}>{card.name} · T{card.tier}</option>)}
    </select></label>}
    {(view === "mine" ? myOffers : offers).map(offer => {
      const own = offer.CreatorUserID === userID;
      const expired = isExpired(offer, now);
      const goods = (offer.GoodsAmount ?? 0) + " × " + label(offer.GoodsItemID, offer.GoodsCatalogID);
      const required = offer.OfferType === "BuyOrder" ? cardPriceForOffer(offer) : offer.Price;
      const affordable = canPay(required, inventory);
      return <article key={offer.OfferID} style={{ ...box, display: "grid", gap: 9 }}>
        <div style={row}><strong>{offer.OfferType} · {expired ? "Expired" : offer.Status}</strong><span style={muted}>Seller / creator: {typeof offer.CreatorPublicData?.Username === "string" ? offer.CreatorPublicData.Username : offer.CreatorUserID ?? "—"}{own ? " · YOU" : ""}</span></div>
        <div><b>OFFER:</b> {offer.OfferType === "BuyOrder" ? bundleText(offer) : goods}</div>
        <div><b>REQUEST:</b> {offer.OfferType === "BuyOrder" ? goods : bundleText(offer)}</div>
        <div style={muted}>Expires: {offer.ExpiresAt ? new Date(offer.ExpiresAt).toLocaleString() : "—"} · {offer.OfferID}</div>
        {own ? <Button tone="grey" disabled={busy || loading || !offer.OfferID || (!expired && offer.Status !== "Active")} onClick={() => void run(() => expired
          ? client.marketplace.claimBack(offer.OfferID!)
          : offer.OfferType === "BuyOrder" ? client.marketplace.cancelBuyOrder(offer.OfferID!) : client.marketplace.cancelListing(offer.OfferID!), "Escrow returned. Inventory refreshed.")}>{expired ? "RECLAIM ESCROW" : "CANCEL OFFER"}</Button>
          : <Button tone="red" disabled={busy || loading || !synced || !open || expired || offer.Status !== "Active" || !affordable} onClick={() => accept(offer)}>ACCEPT / {offer.OfferType === "BuyOrder" ? "FILL" : "BUY"}{!affordable ? " · NOT ENOUGH CARDS" : ""}</Button>}
      </article>;
    })}
    {!(view === "mine" ? myOffers : offers).length && !loading && <p style={muted}>No offers yet.</p>}
    {view !== "mine" && continuation && <Button tone="grey" disabled={busy || loading} onClick={() => void reload(true)}>LOAD MORE</Button>}
  </section>;
}
function cardPriceForOffer(offer: MarketplaceOfferView) {
  return { Entries: [{ Type: "Item" as const, CatalogID: offer.GoodsCatalogID, ItemID: offer.GoodsItemID, Amount: offer.GoodsAmount }] };
}
function message(cause: unknown) { return cause instanceof Error ? cause.message : "Marketplace request failed."; }
const row: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" };
const muted: CSSProperties = { color: v.textDim, fontSize: 12, lineHeight: 1.5 };
const heading: CSSProperties = { margin: 0, color: v.text, fontSize: 16, letterSpacing: 1 };
const field: CSSProperties = { display: "grid", gap: 8, minWidth: 0, color: v.text, fontSize: 12 };
const input: CSSProperties = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: 10, background: v.panelDeep, color: v.text, border: "1px solid " + v.panelEdge, borderRadius: 2, font: "inherit" };
const box: CSSProperties = { border: "1px solid " + v.panelEdge, padding: 14, background: v.panelDeep, color: v.text, overflowWrap: "anywhere" };
