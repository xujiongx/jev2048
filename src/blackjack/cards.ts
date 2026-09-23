import type { Card, Rank, Suit } from "./engine";

/** Wikimedia Commons SVG playing cards (public domain / free media). */
const FILE_PATH = "https://commons.wikimedia.org/wiki/Special:FilePath";

export const CARD_BACK_URL = `${FILE_PATH}/Card_back_01.svg`;

export function cardSvgUrl(card: Card): string {
  return `${FILE_PATH}/Playing_card_${card.suit}_${card.rank}.svg`;
}

export function cardLabel(card: Card): string {
  const suitSymbol: Record<Suit, string> = {
    spade: "♠",
    heart: "♥",
    diamond: "♦",
    club: "♣",
  };
  return `${card.rank}${suitSymbol[card.suit]}`;
}

export function parseCardKey(key: string): { suit: Suit; rank: Rank } | null {
  const [suit, rank] = key.split("_") as [Suit, Rank];
  if (!suit || !rank) return null;
  return { suit, rank };
}
