// Pure helpers of the collections screen — covered by model.test.ts. The server rolls packs and
// decides what is complete; these only decide what the screen draws.

import type { ResourceGrant } from "@idosgames/core";
import { costLines, grantLines, type ResourceLine } from "@idosgames/react/ui";

// ── Configuration (the fields this screen reads) ─────────────────────────────────────────────

export interface CollectibleView {
  CollectibleID?: string | null;
  DisplayName?: string | null;
  AssetPaths?: Record<string, string> | null;
  Rarity?: number | null;
  SortOrder?: number | null;
}

export interface SetView {
  SetID?: string | null;
  DisplayName?: string | null;
  SortOrder?: number | null;
  Collectibles?: CollectibleView[] | null;
  SetCompletionReward?: ResourceGrant | null;
}

export interface CollectionView {
  CollectionID?: string | null;
  DisplayName?: string | null;
  Description?: string | null;
  Sets?: SetView[] | null;
  GrandPrize?: ResourceGrant | null;
}

export interface PackTypeView {
  PackTypeID?: string | null;
  DisplayName?: string | null;
  AssetPaths?: Record<string, string> | null;
  CollectibleCount?: number | null;
  MaxOpenCount?: number | null;
  PriceOptions?: Record<
    string,
    { OptionID?: string | null; Cost?: unknown } | null
  > | null;
}

export interface CollectionChestView {
  CollectionChestID?: string | null;
  DisplayName?: string | null;
  AssetPaths?: Record<string, string> | null;
  CollectionCurrencyCost?: number | null;
  MinCollectibleCount?: number | null;
  MaxCollectibleCount?: number | null;
}

/** The title's Collection section, as far as the screen cares. */
export interface CollectionSection {
  Collections?: Record<string, CollectionView | null> | null;
  PackTypes?: Record<string, PackTypeView | null> | null;
  CollectionChests?: Array<CollectionChestView | null> | null;
  Settings?: { MaxPackOpenCount?: number | null } | null;
}

/** The player's collection state (UserState.Collection). */
export interface CollectionStateView {
  CollectionID?: string;
  CollectionCurrencyBalance?: number;
  OwnedCollectibles?: Record<string, number>;
  OwnedSpecialCollectibles?: Record<string, number>;
  ClaimedSetRewards?: string[];
  IsCollectionCompleted?: boolean;
  GrandPrizeClaimed?: boolean;
}

// ── Album ────────────────────────────────────────────────────────────────────────────────────

/** The collection the player collects: the one in their state, else the title's first. */
export function currentCollection(
  section: CollectionSection | null | undefined,
  state: CollectionStateView | null | undefined,
): (CollectionView & { CollectionID: string }) | null {
  const all = Object.entries(section?.Collections ?? {})
    .filter(([, c]) => c)
    .map(([id, c]) => ({ ...c!, CollectionID: c!.CollectionID || id }))
    .sort((a, b) => a.CollectionID.localeCompare(b.CollectionID));
  return (
    all.find((c) => c.CollectionID === state?.CollectionID) ?? all[0] ?? null
  );
}

export interface CardRow {
  id: string;
  name: string;
  icon: string;
  rarity: number;
  /** How many the player holds (0 — a gap in the album). */
  count: number;
  /** Duplicates the player can give away in a trade. */
  spare: number;
}

export interface SetRow {
  setID: string;
  name: string;
  cards: CardRow[];
  owned: number;
  total: number;
  reward: ResourceLine[];
  state: "claimed" | "ready" | "collecting";
}

/** The album: sets in order, their cards with what the player holds, and each set's reward state. */
export function albumSets(
  collection: CollectionView | null | undefined,
  state: CollectionStateView | null | undefined,
): SetRow[] {
  const owned = state?.OwnedCollectibles ?? {};
  const claimed = state?.ClaimedSetRewards ?? [];
  return [...(collection?.Sets ?? [])]
    .filter((s): s is SetView => !!s)
    .sort(
      (a, b) =>
        Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0) ||
        (a.SetID ?? "").localeCompare(b.SetID ?? ""),
    )
    .map((s) => {
      const setID = s.SetID ?? "";
      const cards = [...(s.Collectibles ?? [])]
        .filter((c): c is CollectibleView => !!c?.CollectibleID)
        .sort(
          (a, b) =>
            Number(a.SortOrder ?? 0) - Number(b.SortOrder ?? 0) ||
            a.CollectibleID!.localeCompare(b.CollectibleID!),
        )
        .map((c) => {
          const count = Number(owned[c.CollectibleID!] ?? 0);
          return {
            id: c.CollectibleID!,
            name: c.DisplayName || c.CollectibleID!,
            icon: c.AssetPaths?.icon ?? "star",
            rarity: Number(c.Rarity ?? 1),
            count,
            spare: Math.max(0, count - 1),
          };
        });
      const have = cards.filter((c) => c.count > 0).length;
      return {
        setID,
        name: s.DisplayName || setID,
        cards,
        owned: have,
        total: cards.length,
        reward: grantLines(s.SetCompletionReward),
        state: claimed.includes(setID)
          ? "claimed"
          : cards.length > 0 && have === cards.length
            ? "ready"
            : "collecting",
      };
    });
}

/** The grand prize: claimable once every set is complete ("none" — the collection has no prize). */
export function grandPrizeState(
  collection: CollectionView | null | undefined,
  sets: SetRow[],
  state: CollectionStateView | null | undefined,
): "none" | "claimed" | "ready" | "locked" {
  if (grantLines(collection?.GrandPrize).length === 0) return "none";
  if (state?.GrandPrizeClaimed) return "claimed";
  return sets.length > 0 && sets.every((s) => s.state !== "collecting")
    ? "ready"
    : "locked";
}

// ── Packs and chests ─────────────────────────────────────────────────────────────────────────

export interface PackOption {
  packTypeID: string;
  optionID: string | null;
  name: string;
  icon: string;
  cards: number;
  price: ResourceLine[];
  maxOpen: number;
}

/** Every way to open every pack type (one entry per price option; free packs have one entry). */
export function packOptions(
  section: CollectionSection | null | undefined,
): PackOption[] {
  const out: PackOption[] = [];
  for (const [id, p] of Object.entries(section?.PackTypes ?? {})) {
    if (!p) continue;
    const maxOpen = Number(
      p.MaxOpenCount ?? section?.Settings?.MaxPackOpenCount ?? 100,
    );
    if (maxOpen <= 0) continue;
    const base = {
      packTypeID: p.PackTypeID || id,
      name: p.DisplayName || p.PackTypeID || id,
      icon: p.AssetPaths?.icon ?? "ticket",
      cards: Number(p.CollectibleCount ?? 1),
      maxOpen,
    };
    const options = Object.entries(p.PriceOptions ?? {}).filter(([, o]) => o);
    if (options.length === 0) out.push({ ...base, optionID: null, price: [] });
    for (const [oid, o] of options)
      out.push({
        ...base,
        optionID: o?.OptionID || oid,
        price: costLines(o?.Cost as never).filter((l) => l.kind !== "other"),
      });
  }
  return out.sort(
    (a, b) =>
      a.packTypeID.localeCompare(b.packTypeID) ||
      (a.optionID ?? "").localeCompare(b.optionID ?? ""),
  );
}

export interface ChestRow {
  chestID: string;
  name: string;
  icon: string;
  cost: number;
  cards: string;
}

/** Collection chests: bought with the collection's own currency (what duplicates turn into). */
export function chestRows(
  section: CollectionSection | null | undefined,
): ChestRow[] {
  return (section?.CollectionChests ?? [])
    .filter((c): c is CollectionChestView => !!c?.CollectionChestID)
    .map((c) => {
      const min = Number(c.MinCollectibleCount ?? 1);
      const max = Number(c.MaxCollectibleCount ?? min);
      return {
        chestID: c.CollectionChestID!,
        name: c.DisplayName || c.CollectionChestID!,
        icon: c.AssetPaths?.icon ?? "chest",
        cost: Number(c.CollectionCurrencyCost ?? 0),
        cards: max > min ? `${min}–${max}` : `${min}`,
      };
    });
}

/** Badge: set rewards and the grand prize waiting. */
export function collectionsBadge(
  collection: CollectionView | null | undefined,
  sets: SetRow[],
  state: CollectionStateView | null | undefined,
): number {
  return (
    sets.filter((s) => s.state === "ready").length +
    (grandPrizeState(collection, sets, state) === "ready" ? 1 : 0)
  );
}

/** Whether the title has a collection — until it does, the lobby hides the tab. */
export function hasTitleData(section: CollectionSection | undefined): boolean {
  return Object.values(section?.Collections ?? {}).some(Boolean);
}

