import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  CollectionTradeOfferDocument,
  FriendPublicProfile,
} from "@idosgames/core";
import type {
  FeatureRegistry,
  FeatureScreenProps,
} from "@idosgames/module-sdk";
import { useIDosGamesClient, useUserState } from "@idosgames/react";
import {
  Button,
  Card,
  Center,
  EmptyState,
  Icon,
  Popup,
  ProgressBar,
  ResourceList,
  SectionTitle,
  Spinner,
  Tabs,
  canAfford,
  configSection,
  errorText,
  grantLines,
  grantedBy,
  outlined,
  panel,
  useCatalog,
  useCelebrate,
  usePopupClose,
  useStagger,
  useToast,
  useUiKit,
  v,
} from "@idosgames/react/ui";
import {
  albumSets,
  chestRows,
  collectionsBadge,
  currentCollection,
  grandPrizeState,
  packOptions,
  type CardRow,
  type ChestRow,
  type CollectionSection,
  type CollectionStateView,
  type PackOption,
  type SetRow,
} from "./model";
import { t } from "./i18n";

// Collections (engine Collection): an album of sets — every card the player holds or still misses,
// a reward per completed set and a grand prize for the whole album; packs of cards (currencies) and
// collection chests (the currency duplicates turn into); and trading a spare card with a friend.

type Tab = "album" | "packs" | "trades";

export function CollectionsScreen(_: FeatureScreenProps): ReactNode {
  const client = useIDosGamesClient();
  const state = useUserState();
  const [tab, setTab] = useState<Tab>("album");
  const section = configSection<CollectionSection>(client, "Collection");
  const mine = (state?.Collection ?? null) as CollectionStateView | null;
  const collection = currentCollection(section, mine);

  // The album is in the login state and every reply keeps it fresh; opening the screen re-checks it
  // through the central cache (a trade a friend accepted, the active collection changing).
  const reload = useCallback(async () => {
    await client.cache.ensureState(["Collection"], { maxAgeMs: 60_000 });
  }, [client]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (!collection) return <EmptyState glyph="star" text={t("noCollection")} />;
  const sets = albumSets(collection, mine);
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Tabs
        tabs={[
          {
            id: "album",
            label: t("album"),
            badge: collectionsBadge(collection, sets, mine),
          },
          { id: "packs", label: t("packs") },
          { id: "trades", label: t("trades") },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === "album" ? (
        <Album
          collectionID={collection.CollectionID}
          name={collection.DisplayName ?? collection.CollectionID}
          grandPrize={grantLines(collection.GrandPrize)}
          prize={grandPrizeState(collection, sets, mine)}
          sets={sets}
          onChanged={reload}
        />
      ) : tab === "packs" ? (
        <Packs
          collectionID={collection.CollectionID}
          section={section}
          balance={Number(mine?.CollectionCurrencyBalance ?? 0)}
          onChanged={reload}
        />
      ) : (
        <Trades collectionID={collection.CollectionID} sets={sets} />
      )}
    </div>
  );
}

// ── Album ────────────────────────────────────────────────────────────────────────────────────

function Album({
  collectionID,
  name,
  grandPrize,
  prize,
  sets,
  onChanged,
}: {
  collectionID: string;
  name: string;
  grandPrize: ReturnType<typeof grantLines>;
  prize: ReturnType<typeof grandPrizeState>;
  sets: SetRow[];
  onChanged: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const stagger = useStagger();
  const [busy, setBusy] = useState<string | null>(null);
  const owned = sets.reduce((s, x) => s + x.owned, 0);
  const total = sets.reduce((s, x) => s + x.total, 0);

  const claimSet = async (setID: string) => {
    setBusy(setID);
    const res = await client.collection.claimSetReward(collectionID, setID);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(grantedBy(res.data));
    await onChanged();
  };
  const claimPrize = async () => {
    setBusy("grand");
    const res = await client.collection.claimGrandPrize(collectionID);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    celebrate(grantedBy(res.data), { sound: "levelUp" });
    await onChanged();
  };

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ ...panel, padding: 12, display: "grid", gap: 8 }}>
        <div style={{ ...outlined, fontSize: 16 }}>
          {catalog.localize(name)}
        </div>
        <ProgressBar value={owned} max={Math.max(1, total)} tone="gold" />
        {grandPrize.length > 0 ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span style={{ ...outlined, fontSize: 13, color: v.textDim }}>
              {t("grandPrize")}
            </span>
            <ResourceList lines={grandPrize} size={20} />
            {prize === "ready" ? (
              <Button
                tone="gold"
                size="sm"
                attract
                busy={busy === "grand"}
                onClick={() => void claimPrize()}
              >
                {t("claim")}
              </Button>
            ) : prize === "claimed" ? (
              <Icon glyph="check" size={22} />
            ) : null}
          </div>
        ) : null}
      </div>
      {sets.map((s, i) => (
        <Card key={s.setID} highlight={s.state === "ready"} style={stagger(i)}>
          <div style={{ display: "grid", gap: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span style={{ ...outlined, fontSize: 15 }}>
                {catalog.localize(s.name)}
              </span>
              <span style={{ ...outlined, fontSize: 13, color: v.gold }}>
                {s.owned} / {s.total}
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
                gap: 8,
              }}
            >
              {s.cards.map((c) => (
                <CardTile key={c.id} card={c} />
              ))}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <ResourceList lines={s.reward} size={18} />
              {s.state === "ready" ? (
                <Button
                  tone="gold"
                  size="sm"
                  attract
                  busy={busy === s.setID}
                  onClick={() => void claimSet(s.setID)}
                  data-tutorial-anchor={`collection:set:${s.setID}`}
                >
                  {t("claim")}
                </Button>
              ) : s.state === "claimed" ? (
                <Icon glyph="check" size={20} />
              ) : null}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function CardTile({ card }: { card: CardRow }): ReactNode {
  const catalog = useCatalog();
  const has = card.count > 0;
  return (
    <div
      title={catalog.localize(card.name)}
      style={{
        position: "relative",
        aspectRatio: "3 / 4",
        borderRadius: 10,
        display: "grid",
        placeItems: "center",
        background: has ? v.panelDeep : v.well,
        border: `2px solid ${has ? catalog.rarityColor(String(card.rarity)) : v.line}`,
        opacity: has ? 1 : 0.45,
      }}
    >
      <Icon glyph={has ? card.icon : "lock"} size={30} />
      {card.count > 1 ? (
        <span
          style={{
            position: "absolute",
            right: 4,
            bottom: 2,
            ...outlined,
            fontSize: 12,
          }}
        >
          ×{card.count}
        </span>
      ) : null}
    </div>
  );
}

// ── Packs and chests ─────────────────────────────────────────────────────────────────────────

function Packs({
  collectionID,
  section,
  balance,
  onChanged,
}: {
  collectionID: string;
  section: CollectionSection | undefined;
  balance: number;
  onChanged: () => Promise<void>;
}): ReactNode {
  const state = useUserState();
  const stagger = useStagger();
  const [opening, setOpening] = useState<
    | { kind: "pack"; pack: PackOption; count: number }
    | { kind: "chest"; chest: ChestRow }
    | null
  >(null);
  const packs = packOptions(section);
  const chests = chestRows(section);
  const balances = state?.InventoryV2?.VirtualCurrencies as
    Record<string, { Amount?: number }> | undefined;
  if (packs.length === 0 && chests.length === 0)
    return <EmptyState glyph="ticket" text={t("noPacks")} />;
  const bulkOf = (p: PackOption) =>
    p.maxOpen >= 10 &&
    canAfford(
      p.price.map((l) => ({ ...l, amount: l.amount * 10 })),
      balances,
    );
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {packs.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {packs.map((p, i) => {
            const affordable = canAfford(p.price, balances);
            return (
              <Card
                key={`${p.packTypeID}:${p.optionID ?? ""}`}
                style={{
                  display: "grid",
                  gap: 8,
                  justifyItems: "center",
                  ...stagger(i),
                }}
              >
                <div style={{ ...outlined, fontSize: 15, textAlign: "center" }}>
                  {p.name}
                </div>
                <div className="idos-bounce">
                  <Icon glyph={p.icon} size={56} />
                </div>
                <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                  {p.cards} {t("cards")}
                </div>
                <Button
                  tone={p.price.length === 0 ? "green" : "gold"}
                  disabled={!affordable}
                  onClick={() =>
                    setOpening({ kind: "pack", pack: p, count: 1 })
                  }
                  style={{ width: "100%" }}
                  data-tutorial-anchor={`collection:pack:${p.packTypeID}`}
                >
                  {p.price.length === 0 ? (
                    t("open")
                  ) : (
                    <ResourceList lines={p.price} size={18} />
                  )}
                </Button>
                {bulkOf(p) ? (
                  <Button
                    tone="blue"
                    size="sm"
                    onClick={() =>
                      setOpening({ kind: "pack", pack: p, count: 10 })
                    }
                    style={{ width: "100%" }}
                  >
                    {t("open")} ×10
                  </Button>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
      {chests.length > 0 ? (
        <div style={{ display: "grid", gap: 8 }}>
          <SectionTitle
            right={
              <span style={{ ...outlined, fontSize: 13, color: v.gold }}>
                {t("points")}: {balance}
              </span>
            }
          >
            {t("chests")}
          </SectionTitle>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 10,
            }}
          >
            {chests.map((c) => (
              <Card
                key={c.chestID}
                style={{ display: "grid", gap: 8, justifyItems: "center" }}
              >
                <div style={{ ...outlined, fontSize: 15, textAlign: "center" }}>
                  {c.name}
                </div>
                <Icon glyph={c.icon} size={56} />
                <div style={{ ...outlined, fontSize: 12, color: v.textDim }}>
                  {c.cards} {t("cards")}
                </div>
                <Button
                  tone="gold"
                  disabled={balance < c.cost}
                  onClick={() => setOpening({ kind: "chest", chest: c })}
                  style={{ width: "100%" }}
                >
                  {c.cost} {t("points")}
                </Button>
              </Card>
            ))}
          </div>
        </div>
      ) : null}
      {opening ? (
        <OpenPopup
          collectionID={collectionID}
          opening={opening}
          onClose={() => setOpening(null)}
          onOpened={onChanged}
        />
      ) : null}
    </div>
  );
}

function OpenPopup({
  collectionID,
  opening,
  onClose,
  onOpened,
}: {
  collectionID: string;
  opening:
    | { kind: "pack"; pack: PackOption; count: number }
    | { kind: "chest"; chest: ChestRow };
  onClose: () => void;
  onOpened: () => Promise<void>;
}): ReactNode {
  const name = opening.kind === "pack" ? opening.pack.name : opening.chest.name;
  const count = opening.kind === "pack" ? opening.count : 1;
  return (
    <Popup
      title={count > 1 ? `${name} ×${count}` : name}
      onClose={onClose}
      variant="center"
    >
      <OpenBody
        collectionID={collectionID}
        opening={opening}
        onOpened={onOpened}
      />
    </Popup>
  );
}

function OpenBody({
  collectionID,
  opening,
  onOpened,
}: {
  collectionID: string;
  opening:
    | { kind: "pack"; pack: PackOption; count: number }
    | { kind: "chest"; chest: ChestRow };
  onOpened: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const celebrate = useCelebrate();
  const toast = useToast();
  const kit = useUiKit();
  const close = usePopupClose();
  const boxRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [got, setGot] = useState<Array<{ id: string; dup: boolean }> | null>(
    null,
  );

  const open = async () => {
    setBusy(true);
    const started = Date.now();
    const res =
      opening.kind === "pack"
        ? await client.collection.openPack(
            collectionID,
            opening.pack.packTypeID,
            opening.count,
            opening.pack.optionID
              ? { selectedOptionID: opening.pack.optionID }
              : undefined,
          )
        : await client.collection.openCollectionChest(
            collectionID,
            opening.chest.chestID,
          );
    await new Promise((r) =>
      setTimeout(
        r,
        Math.max(0, (kit.motion.on ? 700 : 0) - (Date.now() - started)),
      ),
    );
    setBusy(false);
    if (!res.ok) return toast(errorText(res.error), "error");
    kit.play("lootbox");
    kit.fx.burst(boxRef.current);
    setGot([
      ...(res.data.GrantedCollectibles ?? []).map((c) => ({
        id: c.CollectibleID,
        dup: false,
      })),
      ...(res.data.DuplicateCollectibles ?? []).map((c) => ({
        id: c.CollectibleID,
        dup: true,
      })),
    ]);
    const bonus = grantedBy(res.data);
    if (bonus.length > 0) celebrate(bonus);
    await onOpened();
  };

  if (got)
    return (
      <div style={{ display: "grid", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
            gap: 8,
          }}
        >
          {got.map((c, i) => (
            <div
              key={`${c.id}:${i}`}
              style={{
                ...panel,
                padding: 6,
                display: "grid",
                justifyItems: "center",
                gap: 4,
                opacity: c.dup ? 0.6 : 1,
              }}
            >
              <Icon glyph="star" size={28} />
              <span style={{ ...outlined, fontSize: 11, textAlign: "center" }}>
                {catalog.localize(c.id)}
              </span>
              <span
                style={{
                  ...outlined,
                  fontSize: 10,
                  color: c.dup ? v.textDim : v.green,
                }}
              >
                {c.dup ? t("duplicate") : t("new")}
              </span>
            </div>
          ))}
        </div>
        <Button tone="blue" onClick={close}>
          {t("great")}
        </Button>
      </div>
    );
  return (
    <div style={{ display: "grid", gap: 12, justifyItems: "center" }}>
      <div
        ref={boxRef}
        style={{
          animation: busy
            ? "idos-shake .35s ease-in-out infinite"
            : "idos-bounce 1.2s ease-in-out infinite",
        }}
      >
        <Icon
          glyph={
            opening.kind === "pack" ? opening.pack.icon : opening.chest.icon
          }
          size={110}
        />
      </div>
      <Button
        tone="gold"
        size="lg"
        attract
        busy={busy}
        onClick={() => void open()}
      >
        {busy ? t("opening") : t("open")}
      </Button>
    </div>
  );
}

// ── Trades ───────────────────────────────────────────────────────────────────────────────────

function Trades({
  collectionID,
  sets,
}: {
  collectionID: string;
  sets: SetRow[];
}): ReactNode {
  const client = useIDosGamesClient();
  const catalog = useCatalog();
  const toast = useToast();
  const [incoming, setIncoming] = useState<
    CollectionTradeOfferDocument[] | null
  >(null);
  const [mine, setMine] = useState<CollectionTradeOfferDocument[]>([]);
  const [giving, setGiving] = useState<CardRow | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const spare = sets.flatMap((s) => s.cards).filter((c) => c.spare > 0);

  const load = useCallback(async () => {
    const [inc, my] = await Promise.all([
      client.collection.getIncomingTradeOffers(collectionID),
      client.collection.getMyTradeOffers(collectionID),
    ]);
    setIncoming(inc.ok ? (inc.data.Offers ?? []) : []);
    setMine(my.ok ? (my.data.Offers ?? []) : []);
  }, [client, collectionID]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (
    offerID: string,
    action: "accept" | "decline" | "cancel",
  ) => {
    setBusy(offerID);
    const res =
      action === "accept"
        ? await client.collection.acceptTradeOffer(offerID)
        : action === "decline"
          ? await client.collection.declineTradeOffer(offerID)
          : await client.collection.cancelTradeOffer(offerID);
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    if (action === "accept") {
      toast(t("traded"), "success");
      void client.collection.getUserState();
    }
    await load();
  };

  if (!incoming)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  const pending = (o: CollectionTradeOfferDocument) =>
    !o.Status || o.Status === "Pending";
  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <SectionTitle>{t("incoming")}</SectionTitle>
        {incoming.filter(pending).length === 0 ? (
          <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
            {t("noIncoming")}
          </div>
        ) : (
          incoming.filter(pending).map((o) => (
            <Card key={o.OfferID} style={{ display: "grid", gap: 8 }}>
              <div style={{ ...outlined, fontSize: 14 }}>
                {o.SenderPublicData?.Username ?? t("player")} ·{" "}
                {catalog.localize(o.OfferedCollectibleID ?? "")}
                {o.RequestedCollectibleID
                  ? ` ⇄ ${catalog.localize(o.RequestedCollectibleID)}`
                  : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Button
                  tone="green"
                  size="sm"
                  busy={busy === o.OfferID}
                  onClick={() => void act(o.OfferID, "accept")}
                >
                  {t("accept")}
                </Button>
                <Button
                  tone="grey"
                  size="sm"
                  onClick={() => void act(o.OfferID, "decline")}
                >
                  {t("decline")}
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <SectionTitle>{t("sent")}</SectionTitle>
        {mine.filter(pending).map((o) => (
          <Card
            key={o.OfferID}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ ...outlined, fontSize: 14 }}>
              {catalog.localize(o.OfferedCollectibleID ?? "")}
            </span>
            <Button
              tone="grey"
              size="sm"
              busy={busy === o.OfferID}
              onClick={() => void act(o.OfferID, "cancel")}
            >
              {t("cancel")}
            </Button>
          </Card>
        ))}
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <SectionTitle>{t("giveSpare")}</SectionTitle>
        {spare.length === 0 ? (
          <div style={{ ...outlined, fontSize: 13, color: v.textDim }}>
            {t("noSpare")}
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
              gap: 8,
            }}
          >
            {spare.map((c) => (
              <button
                key={c.id}
                type="button"
                className="idos-press"
                onClick={() => setGiving(c)}
                style={{ border: "none", background: "none", padding: 0 }}
              >
                <CardTile card={c} />
              </button>
            ))}
          </div>
        )}
      </div>
      {giving ? (
        <GivePopup
          collectionID={collectionID}
          card={giving}
          onClose={() => setGiving(null)}
          onSent={load}
        />
      ) : null}
    </div>
  );
}

function GivePopup({
  collectionID,
  card,
  onClose,
  onSent,
}: {
  collectionID: string;
  card: CardRow;
  onClose: () => void;
  onSent: () => Promise<void>;
}): ReactNode {
  const catalog = useCatalog();
  return (
    <Popup
      title={`${t("offerTo")}: ${catalog.localize(card.name)}`}
      onClose={onClose}
      width={420}
    >
      <FriendPicker collectionID={collectionID} card={card} onSent={onSent} />
    </Popup>
  );
}

function FriendPicker({
  collectionID,
  card,
  onSent,
}: {
  collectionID: string;
  card: CardRow;
  onSent: () => Promise<void>;
}): ReactNode {
  const client = useIDosGamesClient();
  const toast = useToast();
  const close = usePopupClose();
  const [friends, setFriends] = useState<FriendPublicProfile[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  useEffect(() => {
    void client.social
      .getFriendsList()
      .then((r) => setFriends(r.ok ? (r.data.Friends ?? []) : []));
  }, [client]);
  if (!friends)
    return (
      <Center>
        <Spinner />
      </Center>
    );
  if (friends.length === 0)
    return <EmptyState glyph="friends" text={t("noFriends")} />;
  const send = async (userID: string) => {
    setBusy(userID);
    const res = await client.collection.sendTradeOffer(
      collectionID,
      card.id,
      false,
      userID,
    );
    setBusy(null);
    if (!res.ok) return toast(errorText(res.error), "error");
    toast(t("offerSent"), "success");
    close();
    await onSent();
  };
  return (
    <div style={{ display: "grid", gap: 8 }}>
      {friends.map((f) => (
        <Card
          key={f.UserID}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span style={{ ...outlined, fontSize: 14 }}>
            {f.PublicData?.Username ?? t("player")}
          </span>
          <Button
            tone="green"
            size="sm"
            busy={busy === f.UserID}
            onClick={() => void send(f.UserID)}
          >
            {t("give")}
          </Button>
        </Card>
      ))}
    </div>
  );
}

// ── Always-on: the badge ─────────────────────────────────────────────────────────────────────

/** Badge: set rewards and the grand prize waiting — only on a title with a collection. */
export function makeCollectionsWatcher(features: FeatureRegistry) {
  return function CollectionsBadge(): ReactNode {
    const client = useIDosGamesClient();
    useEffect(() => {
      // Subscribed directly, not keyed on the state object: the cache may patch it in place, and an
      // effect that does not re-run leaves the badge lit after the reward is taken.
      const update = () => {
        const mine = (client.data.user.state?.Collection ??
          null) as CollectionStateView | null;
        const collection = currentCollection(
          configSection<CollectionSection>(client, "Collection"),
          mine,
        );
        features.setBadge(
          "collections",
          collectionsBadge(collection, albumSets(collection, mine), mine),
        );
      };
      update();
      const off = client.on("user:anyUpdated", update);
      // From the login state; the server only when the active collection may have changed.
      void client.cache.ensureState(["Collection"]);
      return off;
    }, [client]);
    return null;
  };
}

