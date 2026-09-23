import type { Card, Rank, Suit } from "./engine";

const SUIT_SYMBOL: Record<Suit, string> = {
  spade: "♠",
  heart: "♥",
  diamond: "♦",
  club: "♣",
};

/** CardMeister cid: As, Kh, Td, 2c … ; 00 = back */
const SUIT_CID: Record<Suit, string> = {
  spade: "s",
  heart: "h",
  diamond: "d",
  club: "c",
};

const RANK_CID: Record<Rank, string> = {
  A: "A",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "10": "T",
  J: "J",
  Q: "Q",
  K: "K",
};

export function cardmeisterCid(card: Card): string {
  return `${RANK_CID[card.rank]}${SUIT_CID[card.suit]}`;
}

export const CARD_BACK_CID = "00";

export function cardLabel(card: Card): string {
  return `${card.rank}${SUIT_SYMBOL[card.suit]}`;
}

export function isRedSuit(suit: Suit): boolean {
  return suit === "heart" || suit === "diamond";
}

export function suitSymbol(suit: Suit): string {
  return SUIT_SYMBOL[suit];
}
