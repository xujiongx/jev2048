export type Suit = "spade" | "heart" | "diamond" | "club";
export type Rank =
  | "A"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8"
  | "9"
  | "10"
  | "J"
  | "Q"
  | "K";

export interface Card {
  suit: Suit;
  rank: Rank;
  id: string;
}

export type Phase = "idle" | "player" | "dealer" | "done";
export type Outcome = "win" | "lose" | "push" | "blackjack" | null;
export type SeatStatus =
  | "waiting"
  | "playing"
  | "stood"
  | "bust"
  | "blackjack"
  | "done";

export interface PlayerSeat {
  id: string;
  name: string;
  hand: Card[];
  status: SeatStatus;
  outcome: Outcome;
}

export interface BlackjackState {
  deck: Card[];
  players: PlayerSeat[];
  dealer: Card[];
  activePlayerIndex: number;
  phase: Phase;
  message: string;
  usedIds: Set<string>;
}

/** Standard 52-card deck, no jokers. */
export const DECK_SIZE = 52;

export const SUITS: Suit[] = ["spade", "heart", "diamond", "club"];
export const RANKS: Rank[] = [
  "A",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
];

export const MIN_PLAYERS = 1;
export const MAX_PLAYERS = 5;

function cardId(suit: Suit, rank: Rank): string {
  return `${suit}_${rank}`;
}

export function makeCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, id: cardId(suit, rank) };
}

/** Ordered full deck (no shuffle) for inventory UI. */
export function fullDeckOrdered(): Card[] {
  const deck: Card[] = [];
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      deck.push(makeCard(suit, rank));
    }
  }
  return deck;
}

export function buildDeck(): Card[] {
  return shuffle(fullDeckOrdered());
}

function shuffle<T>(arr: T[]): T[] {
  const next = [...arr];
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function draw(deck: Card[]): { card: Card; deck: Card[] } {
  if (deck.length === 0) throw new Error("牌堆已空（52 张已用完）");
  const [card, ...rest] = deck;
  return { card, deck: rest };
}

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    if (card.rank === "A") {
      aces += 1;
      total += 11;
    } else if (card.rank === "J" || card.rank === "Q" || card.rank === "K") {
      total += 10;
    } else {
      total += Number(card.rank);
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && handValue(cards).total === 21;
}

export function deckStats(state: Pick<BlackjackState, "deck" | "usedIds">): {
  total: number;
  remaining: number;
  used: number;
} {
  const remaining = state.deck.length;
  const used = state.usedIds.size;
  return { total: DECK_SIZE, remaining, used };
}

function settleOne(
  player: Card[],
  dealer: Card[],
  already: SeatStatus,
): { outcome: Outcome; status: SeatStatus } {
  if (already === "bust") return { outcome: "lose", status: "done" };
  if (already === "blackjack") {
    if (isBlackjack(dealer)) return { outcome: "push", status: "done" };
    return { outcome: "blackjack", status: "done" };
  }

  const p = handValue(player).total;
  const d = handValue(dealer).total;
  if (p > 21) return { outcome: "lose", status: "done" };
  if (isBlackjack(dealer) && player.length === 2 && p === 21) {
    return { outcome: "push", status: "done" };
  }
  if (d > 21) return { outcome: "win", status: "done" };
  if (p > d) return { outcome: "win", status: "done" };
  if (p < d) return { outcome: "lose", status: "done" };
  return { outcome: "push", status: "done" };
}

function makePlayers(count: number): PlayerSeat[] {
  const n = Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count));
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `玩家 ${i + 1}`,
    hand: [],
    status: "waiting" as SeatStatus,
    outcome: null,
  }));
}

export function createIdle(playerCount = 1): BlackjackState {
  return {
    deck: [],
    players: makePlayers(playerCount),
    dealer: [],
    activePlayerIndex: 0,
    phase: "idle",
    message: `一副牌 ${DECK_SIZE} 张（无大小王）。可设 ${MIN_PLAYERS}–${MAX_PLAYERS} 位玩家。`,
    usedIds: new Set(),
  };
}

function collectUsed(players: PlayerSeat[], dealer: Card[]): Set<string> {
  const ids = new Set<string>();
  for (const p of players) {
    for (const c of p.hand) ids.add(c.id);
  }
  for (const c of dealer) ids.add(c.id);
  return ids;
}

function findFirstActive(players: PlayerSeat[]): number {
  return players.findIndex((p) => p.status === "playing");
}

function summarizeOutcomes(players: PlayerSeat[]): string {
  const parts = players.map((p) => {
    const label =
      p.outcome === "blackjack"
        ? "BJ"
        : p.outcome === "win"
          ? "胜"
          : p.outcome === "lose"
            ? "负"
            : p.outcome === "push"
              ? "平"
              : "—";
    return `${p.name}${label}`;
  });
  return parts.join(" · ");
}

function afterNaturalDeal(
  deck: Card[],
  players: PlayerSeat[],
  dealer: Card[],
): BlackjackState {
  const usedIds = collectUsed(players, dealer);
  const dealerBj = isBlackjack(dealer);

  const nextPlayers = players.map((p) => {
    if (isBlackjack(p.hand)) {
      if (dealerBj) {
        return { ...p, status: "done" as SeatStatus, outcome: "push" as Outcome };
      }
      return {
        ...p,
        status: "blackjack" as SeatStatus,
        outcome: "blackjack" as Outcome,
      };
    }
    if (dealerBj) {
      return { ...p, status: "done" as SeatStatus, outcome: "lose" as Outcome };
    }
    return { ...p, status: "playing" as SeatStatus, outcome: null };
  });

  if (dealerBj || nextPlayers.every((p) => p.status !== "playing")) {
    const settled = nextPlayers.map((p) => {
      if (p.status === "playing") return p;
      if (p.status === "blackjack" && !dealerBj) {
        return { ...p, status: "done" as SeatStatus };
      }
      return { ...p, status: "done" as SeatStatus };
    });
    return {
      deck,
      players: settled,
      dealer,
      activePlayerIndex: 0,
      phase: "done",
      message: dealerBj
        ? `庄家 Blackjack。${summarizeOutcomes(settled)}`
        : summarizeOutcomes(settled),
      usedIds,
    };
  }

  const active = findFirstActive(nextPlayers);
  return {
    deck,
    players: nextPlayers,
    dealer,
    activePlayerIndex: active,
    phase: "player",
    message: `轮到 ${nextPlayers[active].name}：要牌或停牌`,
    usedIds,
  };
}

export function dealAuto(playerCount: number): BlackjackState {
  const players = makePlayers(playerCount);
  let deck = buildDeck();
  const dealer: Card[] = [];

  // Deal round-robin: player1, p2, … dealer, then again
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < players.length; i++) {
      const drawn = draw(deck);
      players[i] = { ...players[i], hand: [...players[i].hand, drawn.card] };
      deck = drawn.deck;
    }
    const drawn = draw(deck);
    dealer.push(drawn.card);
    deck = drawn.deck;
  }

  return afterNaturalDeal(deck, players, dealer);
}

export function dealManual(
  playerHands: Card[][],
  dealer: Card[],
  names?: string[],
): BlackjackState {
  if (playerHands.length < MIN_PLAYERS || playerHands.length > MAX_PLAYERS) {
    throw new Error(`玩家人数需在 ${MIN_PLAYERS}–${MAX_PLAYERS} 之间`);
  }
  if (dealer.length < 1) {
    throw new Error("庄家至少需要 1 张明牌");
  }
  for (let i = 0; i < playerHands.length; i++) {
    if (playerHands[i].length < 2) {
      throw new Error(`${names?.[i] ?? `玩家 ${i + 1}`} 至少需要 2 张牌`);
    }
  }

  const allCards = [...playerHands.flat(), ...dealer];
  const usedIds = new Set(allCards.map((c) => c.id));
  if (usedIds.size !== allCards.length) {
    throw new Error("牌面不能重复（整副共 52 张，无大小王）");
  }

  const deck = buildDeck().filter((c) => !usedIds.has(c.id));
  const players: PlayerSeat[] = playerHands.map((hand, i) => ({
    id: `p${i + 1}`,
    name: names?.[i] ?? `玩家 ${i + 1}`,
    hand,
    status: "waiting",
    outcome: null,
  }));

  // Pre-bust check
  const withBust = players.map((p) => {
    if (handValue(p.hand).total > 21) {
      return { ...p, status: "bust" as SeatStatus, outcome: "lose" as Outcome };
    }
    return p;
  });

  return afterNaturalDeal(deck, withBust, dealer);
}

function advanceOrDealer(state: BlackjackState): BlackjackState {
  const nextActive = findFirstActive(state.players);
  if (nextActive === -1) {
    return playDealer(state);
  }
  return {
    ...state,
    activePlayerIndex: nextActive,
    phase: "player",
    message: `轮到 ${state.players[nextActive].name}：要牌或停牌`,
  };
}

export function hit(state: BlackjackState, forced?: Card): BlackjackState {
  if (state.phase !== "player") return state;
  const idx = state.activePlayerIndex;
  const seat = state.players[idx];
  if (!seat || seat.status !== "playing") return state;

  let deck = state.deck;
  let card: Card;
  if (forced) {
    if (state.usedIds.has(forced.id)) {
      throw new Error("这张牌已经出现过");
    }
    card = forced;
    deck = deck.filter((c) => c.id !== card.id);
  } else {
    const drawn = draw(deck);
    card = drawn.card;
    deck = drawn.deck;
  }

  const hand = [...seat.hand, card];
  const usedIds = new Set(state.usedIds);
  usedIds.add(card.id);
  const { total } = handValue(hand);

  let players = [...state.players];
  if (total > 21) {
    players[idx] = {
      ...seat,
      hand,
      status: "bust",
      outcome: "lose",
    };
    return advanceOrDealer({
      ...state,
      deck,
      players,
      usedIds,
      message: `${seat.name} ${total} 点爆牌`,
    });
  }

  players[idx] = { ...seat, hand };
  return {
    ...state,
    deck,
    players,
    usedIds,
    message: `${seat.name} 要牌 → ${total} 点`,
  };
}

export function stand(state: BlackjackState): BlackjackState {
  if (state.phase !== "player") return state;
  const idx = state.activePlayerIndex;
  const seat = state.players[idx];
  if (!seat || seat.status !== "playing") return state;

  const players = [...state.players];
  players[idx] = { ...seat, status: "stood" };

  return advanceOrDealer({
    ...state,
    players,
    message: `${seat.name} 停牌`,
  });
}

function playDealer(state: BlackjackState): BlackjackState {
  let deck = state.deck;
  let dealer = [...state.dealer];

  const anyoneAlive = state.players.some(
    (p) => p.status === "stood" || p.status === "blackjack",
  );

  if (anyoneAlive) {
    while (true) {
      const { total, soft } = handValue(dealer);
      if (total > 17) break;
      if (total === 17 && !soft) break;
      if (deck.length === 0) break;
      const drawn = draw(deck);
      dealer = [...dealer, drawn.card];
      deck = drawn.deck;
    }
  }

  const usedIds = collectUsed(state.players, dealer);
  const players = state.players.map((p) => {
    const settled = settleOne(p.hand, dealer, p.status);
    return { ...p, outcome: settled.outcome, status: settled.status };
  });

  return {
    ...state,
    deck,
    dealer,
    players,
    usedIds,
    phase: "done",
    activePlayerIndex: 0,
    message: `庄家 ${handValue(dealer).total} 点。${summarizeOutcomes(players)}`,
  };
}

export function activeSeat(state: BlackjackState): PlayerSeat | null {
  if (state.phase !== "player") return null;
  return state.players[state.activePlayerIndex] ?? null;
}

export function outcomeLabel(outcome: Outcome): string {
  switch (outcome) {
    case "win":
      return "胜";
    case "lose":
      return "负";
    case "push":
      return "平";
    case "blackjack":
      return "BJ";
    default:
      return "—";
  }
}
