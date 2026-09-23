import { useState } from "react";
import { CARD_BACK_URL, cardLabel, cardSvgUrl } from "../blackjack/cards";
import type { Card } from "../blackjack/engine";

export function PlayingCard({
  card,
  faceDown = false,
  small = false,
}: {
  card?: Card | null;
  faceDown?: boolean;
  small?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showBack = faceDown || !card;
  const src = showBack ? CARD_BACK_URL : cardSvgUrl(card);
  const label = showBack ? "牌背" : cardLabel(card);

  return (
    <div
      className={`playing-card ${small ? "small" : ""} ${showBack ? "back" : ""}`}
      title={label}
    >
      {!failed ? (
        <img
          src={src}
          alt={label}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className={`card-fallback ${card && (card.suit === "heart" || card.suit === "diamond") ? "red" : ""}`}>
          {showBack ? "🂠" : label}
        </div>
      )}
    </div>
  );
}
