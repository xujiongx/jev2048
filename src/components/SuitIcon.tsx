import {
  Club,
  Diamond,
  Heart,
  Spade,
  type LucideIcon,
} from "lucide-react";
import type { Suit } from "../blackjack/engine";

const SUIT_ICON: Record<Suit, LucideIcon> = {
  spade: Spade,
  heart: Heart,
  diamond: Diamond,
  club: Club,
};

export function SuitIcon({
  suit,
  size = 16,
}: {
  suit: Suit;
  size?: number;
}) {
  const Icon = SUIT_ICON[suit];
  const red = suit === "heart" || suit === "diamond";
  return (
    <Icon
      size={size}
      strokeWidth={2.2}
      className={red ? "suit-icon red" : "suit-icon"}
      aria-hidden
    />
  );
}
