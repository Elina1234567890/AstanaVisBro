import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type PointerEvent,
  type ReactNode,
} from "react";

import { Button, Icon, panel, useGameLayout, v } from "@idosgames/react/ui";

import {
  CARD_MERGE_COUNT,
  createPendingLock,
  groupCards,
  type CardsInventory,
  type CardCharacterGroup,
} from "./cards-model";

import { ASTANAVIS_CARDS } from "./card-catalog";
import { CardDetailVisual } from "./CardDetailVisual";

interface CardsOptions {
  onTrade: (itemID: string) => void;
  onMarketplace: () => void;
  getBusy: () => boolean;
  subscribe: (listener: () => void) => () => void;
  beginCraft: () => boolean;
  endCraft: () => void;
}

type CardCounts = Record<string, number>;

const STORAGE_KEY = "astanavis-card-counts-v1";

/**
 * Для теста можно временно поставить кому-нибудь 5 обычных карточек.
 *
 * Например:
 *
 * "akira-ordinary": 5
 *
 * После проверки можешь снова поставить 0.
 */
const DEFAULT_COUNTS: CardCounts = {
  "akira-ordinary": 0,
  "akira-legendary": 0,

  "annabel-ordinary": 0,
  "annabel-legendary": 0,

  "ella-ordinary": 0,
  "ella-legendary": 0,

  "hana-ordinary": 0,
  "hana-legendary": 0,

  "julia-ordinary": 0,
  "julia-legendary": 0,

  "lily-ordinary": 0,
  "lily-legendary": 0,

  "lisa-ordinary": 0,
  "lisa-legendary": 0,

  "mia-ordinary": 0,
  "mia-legendary": 0,

  "rin-ordinary": 0,
  "rin-legendary": 0,

  "sakura-ordinary": 0,
  "sakura-legendary": 0,
};

export function makeCardsScreen(options: CardsOptions) {
  return function CardsScreen(): ReactNode {
    return <Cards options={options} />;
  };
}

function loadCounts(): CardCounts {
  if (typeof window === "undefined") {
    return { ...DEFAULT_COUNTS };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return { ...DEFAULT_COUNTS };
    }

    const parsed = JSON.parse(raw) as Record<string, unknown>;

    const result: CardCounts = {
      ...DEFAULT_COUNTS,
    };

    for (const card of ASTANAVIS_CARDS) {
      const value = Number(parsed[card.itemID] ?? 0);

      result[card.itemID] =
        Number.isFinite(value) && value > 0
          ? Math.floor(value)
          : 0;
    }

    return result;
  } catch {
    return { ...DEFAULT_COUNTS };
  }
}

function saveCounts(counts: CardCounts): void {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(counts),
  );
}

function countsToInventory(counts: CardCounts): CardsInventory {
  const items: NonNullable<CardsInventory["Items"]> = {};

  for (const card of ASTANAVIS_CARDS) {
    items[card.itemID] = {
      StackableAmount: counts[card.itemID] ?? 0,
      TotalAmount: counts[card.itemID] ?? 0,
    };
  }

  return {
    Items: items,
  };
}

function Cards({
  options,
}: {
  options: CardsOptions;
}): ReactNode {
  const economyBusy = useSyncExternalStore(
    options.subscribe,
    options.getBusy,
  );

  const layout = useGameLayout();

  const [counts, setCounts] = useState<CardCounts>(() =>
    loadCounts()
  );

  const [error, setError] = useState<string | null>(null);

  const [notice, setNotice] = useState<string | null>(null);

  const [selectedCardID, setSelectedCardID] =
    useState<string | null>(null);

  const [cardTilt, setCardTilt] = useState({
    x: 0,
    y: 0,
  });

  const [sensorTiltEnabled, setSensorTiltEnabled] =
    useState(false);

  const [pendingCharacters, setPendingCharacters] =
    useState<Set<string>>(() => new Set());

  const pendingRef = useRef(createPendingLock());

  useEffect(() => {
    saveCounts(counts);
  }, [counts]);

  const inventory = countsToInventory(counts);

  const groups = groupCards(
    ASTANAVIS_CARDS,
    inventory,
  );

  const selectedCard = ASTANAVIS_CARDS.find(
    (card) => card.itemID === selectedCardID,
  );

  const selectedGroup = selectedCard
    ? groups.find(
        (group) =>
          group.characterId === selectedCard.characterId,
      )
    : undefined;

  const openCard = (itemID: string) => {
    setSelectedCardID(itemID);

    setSensorTiltEnabled(false);

    setCardTilt({
      x: 0,
      y: 0,
    });

    if (
      typeof window === "undefined" ||
      !("DeviceOrientationEvent" in window)
    ) {
      return;
    }

    const orientation =
      window.DeviceOrientationEvent as typeof DeviceOrientationEvent & {
        requestPermission?: () => Promise<
          "granted" | "denied"
        >;
      };

    if (orientation.requestPermission) {
      void orientation
        .requestPermission()
        .then((permission) => {
          setSensorTiltEnabled(
            permission === "granted",
          );
        })
        .catch(() => {
          setSensorTiltEnabled(false);
        });
    } else {
      setSensorTiltEnabled(true);
    }
  };

  useEffect(() => {
    if (!selectedCardID || !sensorTiltEnabled) {
      return;
    }

    const onOrientation = (
      event: DeviceOrientationEvent,
    ) => {
      if (
        event.gamma === null ||
        event.beta === null
      ) {
        return;
      }

      setCardTilt({
        x: Math.max(
          -1,
          Math.min(1, event.gamma / 30),
        ),
        y: Math.max(
          -1,
          Math.min(
            1,
            (event.beta - 35) / 45,
          ),
        ),
      });
    };

    window.addEventListener(
      "deviceorientation",
      onOrientation,
    );

    return () => {
      window.removeEventListener(
        "deviceorientation",
        onOrientation,
      );
    };
  }, [selectedCardID, sensorTiltEnabled]);

  const combine = async (
    group: CardCharacterGroup,
  ) => {
    const ordinary = group.cards.find(
      (card) => card.tier === 1,
    );

    const legendary = group.cards.find(
      (card) => card.tier === 2,
    );

    if (!ordinary || !legendary) {
      setError(
        "Для этого персонажа не найдена обычная или легендарная карточка.",
      );
      return;
    }

    const ordinaryCount =
      counts[ordinary.itemID] ?? 0;

    if (ordinaryCount < CARD_MERGE_COUNT) {
      setError(
        `Нужно ${CARD_MERGE_COUNT} обычных карточек.`,
      );
      return;
    }

    if (
      !pendingRef.current.tryAcquire(
        group.characterId,
      )
    ) {
      return;
    }

    if (!options.beginCraft()) {
      pendingRef.current.release(
        group.characterId,
      );
      return;
    }

    setPendingCharacters(
      pendingRef.current.snapshot(),
    );

    setError(null);
    setNotice(null);

    try {
      setCounts((current) => {
        const available =
          current[ordinary.itemID] ?? 0;

        if (available < CARD_MERGE_COUNT) {
          return current;
        }

        return {
          ...current,

          [ordinary.itemID]:
            available - CARD_MERGE_COUNT,

          [legendary.itemID]:
            (current[legendary.itemID] ?? 0) +
            1,
        };
      });

      setNotice(
        `${group.characterName}: 5 обычных карточек объединены в 1 легендарную.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Не удалось объединить карточки.",
      );
    } finally {
      options.endCraft();

      pendingRef.current.release(
        group.characterId,
      );

      setPendingCharacters(
        pendingRef.current.snapshot(),
      );
    }
  };

  /**
   * ВРЕМЕННАЯ кнопка для тестирования.
   *
   * Она добавляет 5 обычных карточек выбранного
   * персонажа.
   *
   * Когда закончишь тестировать — можешь удалить
   * кнопку DEV ADD 5 ниже.
   */
  const addFiveForTesting = (
    group: CardCharacterGroup,
  ) => {
    const ordinary = group.cards.find(
      (card) => card.tier === 1,
    );

    if (!ordinary) return;

    setCounts((current) => ({
      ...current,

      [ordinary.itemID]:
        (current[ordinary.itemID] ?? 0) + 5,
    }));

    setNotice(
      `${group.characterName}: добавлено 5 обычных карточек для теста.`,
    );
  };

  return (
    <section
      style={{
        ...panel,

        width: "100%",

        maxWidth: 980,

        margin: "0 auto",

        padding: "clamp(16px, 3vw, 28px)",

        display: "grid",

        gap: 18,

        boxSizing: "border-box",
      }}
    >
      <header
        style={{
          display: "flex",

          alignItems: "end",

          justifyContent: "space-between",

          gap: 12,

          flexWrap: "wrap",
        }}
      >
        <div>
          <div
            style={{
              color: v.red,

              fontSize: 11,

              fontWeight: 900,

              letterSpacing: 2.5,
            }}
          >
            NEKO STARS · COLLECTION
          </div>

          <h1
            style={{
              margin: "5px 0 0",

              color: v.text,

              fontSize:
                "clamp(24px, 5vw, 36px)",

              lineHeight: 1.05,
            }}
          >
            CARDS
          </h1>
        </div>

        <Button
          tone="grey"
          disabled={economyBusy}
          onClick={options.onMarketplace}
        >
          MARKETPLACE
        </Button>
      </header>

      {error ? (
        <div
          role="alert"
          style={{
            ...muted,
            color: v.red,
          }}
        >
          {error}
        </div>
      ) : null}

      {notice ? (
        <div
          role="status"
          style={{
            ...muted,
            color: v.green,
          }}
        >
          {notice}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: 14,
        }}
      >
        {groups.map((group) => (
          <article
            key={group.characterId}
            style={{
              ...panel,

              padding:
                "clamp(12px, 2.5vw, 20px)",

              display: "grid",

              gridTemplateColumns:
                layout === "phone"
                  ? "minmax(0, 1fr)"
                  : "minmax(0, 1fr) auto",

              alignItems: "center",

              gap: 14,
            }}
          >
            <div
              style={{
                minWidth: 0,
              }}
            >
              <h2
                style={{
                  color: v.text,

                  margin: "0 0 10px",

                  fontSize: 16,

                  letterSpacing: 1.3,
                }}
              >
                {group.characterName}
              </h2>

              <div
                style={{
                  display: "flex",

                  gap: 10,

                  flexWrap: "wrap",
                }}
              >
                {group.cards.map((card) => (
                  <button
                    key={card.itemID}
                    type="button"
                    onClick={() =>
                      openCard(card.itemID)
                    }
                    aria-label={`Open ${card.name} ${cardRarityLabel(
                      card.rarity,
                    )} card`}
                    style={{
                      all: "unset",

                      cursor: "pointer",

                      borderRadius: 3,
                    }}
                  >
                    <CardTile
                      amount={card.amount}
                      name={card.name}
                      imagePath={card.imagePath}
                      rarity={card.rarity}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div
              style={{
                display: "grid",

                gap: 8,

                minWidth: 160,
              }}
            >
              <Button
                tone="red"
                size="sm"
                disabled={
                  group.tierOneAmount <
                    CARD_MERGE_COUNT ||
                  economyBusy
                }
                busy={pendingCharacters.has(
                  group.characterId,
                )}
                onClick={() =>
                  void combine(group)
                }
              >
                COMBINE {CARD_MERGE_COUNT} ·{" "}
                {group.tierOneAmount}/
                {CARD_MERGE_COUNT}
              </Button>

              <Button
                tone="grey"
                size="sm"
                onClick={() =>
                  addFiveForTesting(group)
                }
              >
                DEV ADD 5
              </Button>
            </div>
          </article>
        ))}
      </div>

      {selectedCard && selectedGroup ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${selectedCard.name} card details`}
          onClick={() =>
            setSelectedCardID(null)
          }
          style={{
            position: "fixed",

            inset: 0,

            zIndex: 10000,

            display: "grid",

            placeItems: "center",

            padding: "16px 16px 80px",

            background: "#000d",

            boxSizing: "border-box",
          }}
        >
          <article
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              ...panel,

              width: "min(92vw, 440px)",

              maxHeight:
                "calc(100dvh - 112px)",

              overflowY: "auto",

              padding:
                "clamp(12px, 4vw, 24px)",

              display: "grid",

              justifyItems: "center",

              gap: 12,

              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                width: "100%",

                display: "flex",

                justifyContent:
                  "space-between",

                alignItems: "center",
              }}
            >
              <span
                style={{
                  color: v.gold,

                  fontSize: 11,

                  fontWeight: 900,

                  letterSpacing: 2,
                }}
              >
                ASTANAVIS ·{" "}
                {cardRarityLabel(
                  selectedCard.rarity,
                )}
              </span>

              <Button
                tone="grey"
                size="sm"
                onClick={() =>
                  setSelectedCardID(null)
                }
              >
                CLOSE
              </Button>
            </div>

            <CardDetailVisual
              name={selectedCard.name.toUpperCase()}
              rarity={selectedCard.rarity}
              imagePath={selectedCard.imagePath}
              locked={false}
              tilt={cardTilt}
              sensorTiltEnabled={
                sensorTiltEnabled
              }
              onTilt={setCardTilt}
            />

            <div
              style={{
                color: v.textDim,

                fontSize: 12,

                fontWeight: 800,

                letterSpacing: 1,
              }}
            >
              OWNED ×
              {counts[selectedCard.itemID] ?? 0}
            </div>

            {selectedCard.tier === 1 ? (
              <Button
                tone="red"
                size="md"
                disabled={
                  selectedGroup.tierOneAmount <
                    CARD_MERGE_COUNT ||
                  economyBusy
                }
                busy={pendingCharacters.has(
                  selectedGroup.characterId,
                )}
                onClick={() =>
                  void combine(selectedGroup)
                }
                style={{
                  width: "100%",
                }}
              >
                COMBINE {CARD_MERGE_COUNT} ·{" "}
                {selectedGroup.tierOneAmount}/
                {CARD_MERGE_COUNT}
              </Button>
            ) : null}

            <Button
              tone="grey"
              size="md"
              disabled
              style={{
                width: "100%",
              }}
            >
              TRADE · COMING SOON
            </Button>

            {notice ? (
              <div
                role="status"
                style={{
                  ...muted,
                  color: v.green,
                }}
              >
                {notice}
              </div>
            ) : null}

            {error ? (
              <div
                role="alert"
                style={{
                  ...muted,
                  color: v.red,
                }}
              >
                {error}
              </div>
            ) : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}

function CardTile({
  amount,
  name,
  imagePath,
  rarity,
}: {
  amount: number;
  name: string;
  imagePath: string | null;
  rarity: string;
}): ReactNode {
  return (
    <div
      aria-label={`${name}, ${cardRarityLabel(
        rarity,
      )}, ${amount} owned`}
      style={{
        width: "clamp(94px, 26vw, 132px)",

        minHeight: 130,

        boxSizing: "border-box",

        border: `1px solid ${v.red}`,

        background: v.panelDeep,

        padding: 8,

        display: "grid",

        gridTemplateRows: "1fr auto auto",

        gap: 5,

        textAlign: "center",

        transition:
          "transform 140ms ease, box-shadow 140ms ease",
      }}
    >
      <div
        style={{
          position: "relative",

          minHeight: 74,

          display: "grid",

          placeItems: "center",

          background: "#351f20",

          color: v.gold,

          overflow: "hidden",
        }}
      >
        {imagePath ? (
          <img
            src={imagePath}
            alt=""
            style={{
              width: "100%",

              height: "100%",

              objectFit: "cover",
            }}
          />
        ) : (
          <Icon
            glyph="user"
            size={40}
          />
        )}

        <span
          style={{
            position: "absolute",

            left: 5,

            top: 4,

            color: v.text,

            fontSize: 9,

            fontWeight: 900,
          }}
        >
          {cardRarityLabel(rarity)}
        </span>
      </div>

      <strong
        style={{
          color: v.text,

          fontSize: 11,

          overflow: "hidden",

          textOverflow: "ellipsis",

          whiteSpace: "nowrap",
        }}
      >
        {name}
      </strong>

      <span
        style={{
          color: v.textDim,

          fontSize: 10,

          textTransform: "uppercase",

          letterSpacing: 0.6,
        }}
      >
        {cardRarityLabel(rarity)} · x{amount}
      </span>
    </div>
  );
}

const muted = {
  color: v.textDim,
  fontSize: 12,
  fontWeight: 700,
} as const;

function cardRarityLabel(
  rarity: string,
): string {
  if (rarity === "common") {
    return "ОБЫЧНАЯ";
  }

  if (rarity === "rare") {
    return "РЕДКАЯ";
  }

  if (rarity === "epic") {
    return "ЭПИЧЕСКАЯ";
  }

  if (rarity === "legendary") {
    return "ЛЕГЕНДАРНАЯ";
  }

  return rarity.toUpperCase();
}
