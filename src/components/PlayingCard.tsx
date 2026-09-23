import type { Card } from "../blackjack/engine";
import { CARD_BACK_CID, cardLabel, cardmeisterCid } from "../blackjack/cards";

export function PlayingCard({
  card,
  faceDown = false,
  small = false,
}: {
  card?: Card | null;
  faceDown?: boolean;
  small?: boolean;
}) {
  const showBack = faceDown || !card;
  const label = showBack ? "牌背" : cardLabel(card!);
  const cid = showBack ? CARD_BACK_CID : cardmeisterCid(card!);

  return (
    <div
      className={`playing-card ${small ? "small" : ""} ${showBack ? "back" : ""}`}
      title={label}
      role="img"
      aria-label={label}
    >
      {/* CardMeister Web Component — https://cardmeister.github.io/ */}
      <playing-card className="cardmeister" cid={cid} />
    </div>
  );
}
