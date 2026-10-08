import type { ItemDefinitionView } from "@idosgames/react/ui";

export const CARD_TAG = "astanavis-card";
export const CARD_MERGE_COUNT = 5;

export type CardRarity = "common" | "rare" | "epic" | "legendary";

export interface AstanaVisCardDefinition {
  itemID: string;
  characterId: string;
  characterName: string;
  name: string;
  imagePath: string | null;
  tier: number;
  rarity: CardRarity;
  collectionId: string;
  craftRarityId: string;
}

interface CardMetadata {
  CharacterID?: string;
  CharacterName?: string;
  Tier?: number | string;
  CardRarity?: string;
  ImagePath?: string | null;
  CollectionID?: string;
  RarityID?: string;
}

interface CardCustomData {
  CharacterID?: string;
  CharacterName?: string;
  Tier?: string;
  CardRarity?: string;
  ImagePath?: string;
  CollectionID?: string;
  RarityID?: string;
}

interface InventoryItemTotals {
  StackableAmount?: number;
  TotalAmount?: number;
}

export interface CardsInventory {
  Items?: Record<string, InventoryItemTotals | null> | null;
}

export interface AstanaVisCard extends AstanaVisCardDefinition {
  amount: number;
  isLocked: boolean;
}

export interface CardCharacterGroup {
  characterId: string;
  characterName: string;
  cards: AstanaVisCard[];
  tierOneAmount: number;
  tierTwoAmount: number;
}

export function createPendingLock() {
  const keys = new Set<string>();
  return {
    tryAcquire(key: string): boolean {
      if (keys.has(key)) return false;
      keys.add(key);
      return true;
    },
    release(key: string): void {
      keys.delete(key);
    },
    has(key: string): boolean {
      return keys.has(key);
    },
    snapshot(): Set<string> {
      return new Set(keys);
    },
  };
}

export function cardDefinitions(items: Map<string, ItemDefinitionView>): AstanaVisCardDefinition[] {
  const cards: AstanaVisCardDefinition[] = [];
  for (const [itemID, rawDefinition] of items) {
    const definition = rawDefinition as ItemDefinitionView & { Metadata?: CardMetadata; CustomData?: CardCustomData };
    const tags = definition.Tags ?? [];
    if (!tags.includes(CARD_TAG)) continue;
    const metadata = definition.Metadata ?? {};
    const custom = definition.CustomData ?? {};
    const tagValue = (prefix: string) => tags.find((tag) => tag.startsWith(prefix))?.slice(prefix.length);
    const characterId = metadata.CharacterID ?? custom.CharacterID ?? tagValue("character:");
    const tier = Number(metadata.Tier ?? custom.Tier ?? tagValue("tier:"));
    if (!characterId || !Number.isFinite(tier) || tier < 1) continue;
    const characterName = metadata.CharacterName ?? custom.CharacterName ?? characterId.toUpperCase().replace("NEKO-", "NEKO ");
    cards.push({
      itemID,
      characterId,
      characterName,
      name: custom.CharacterName ?? metadata.CharacterName ?? definition.DisplayName ?? itemID,
      imagePath: metadata.ImagePath ?? custom.ImagePath ?? definition.ImagePath ?? null,
      tier,
      rarity: normalizeRarity(metadata.CardRarity ?? custom.CardRarity ?? tagValue("rarity:")),
      collectionId: metadata.CollectionID ?? custom.CollectionID ?? `astanavis-card-${characterId}`,
      craftRarityId: metadata.RarityID ?? custom.RarityID ?? `astanavis-tier-${tier}`,
    });
  }
  return cards.sort((a, b) => a.characterId.localeCompare(b.characterId) || a.tier - b.tier);
}

/** Build card definitions from the authoritative Title Item catalog response. */
export function cardDefinitionsFromItems(items: Record<string, unknown> | null | undefined): AstanaVisCardDefinition[] {
  return cardDefinitions(new Map(Object.entries(items ?? {})) as Map<string, ItemDefinitionView>);
}

export function groupCards(
  definitions: AstanaVisCardDefinition[],
  inventory: CardsInventory | null | undefined,
): CardCharacterGroup[] {
  const groups = new Map<string, CardCharacterGroup>();
  for (const definition of definitions) {
    let group = groups.get(definition.characterId);
    if (!group) {
      group = {
        characterId: definition.characterId,
        characterName: definition.characterName,
        cards: [],
        tierOneAmount: 0,
        tierTwoAmount: 0,
      };
      groups.set(definition.characterId, group);
    }

    // StackableAmount is the available stack quantity in InventoryV2. Marketplace escrow is
    // removed from inventory when the server creates an offer, so escrowed copies cannot combine.
    const amount = Math.max(0, Math.floor(Number(inventory?.Items?.[definition.itemID]?.StackableAmount ?? 0)));
    group.cards.push({ ...definition, amount, isLocked: amount === 0 });
    if (definition.tier === 1) group.tierOneAmount += amount;
    if (definition.tier === 2) group.tierTwoAmount += amount;
  }
  return [...groups.values()].sort((a, b) => a.characterId.localeCompare(b.characterId));
}

export function canCombineTierOne(amount: number): boolean {
  return Number.isFinite(amount) && amount >= CARD_MERGE_COUNT;
}

function normalizeRarity(value: string | undefined): CardRarity {
  const rarity = value?.toLowerCase();
  return rarity === "rare" || rarity === "epic" || rarity === "legendary" ? rarity : "common";
}
