import type { Card } from "../blackjack/engine";
import { CARD_BACK_CID, cardLabel, cardmeisterCid } from "../blackjack/cards";

/** CardMeister embeds SVG in <img>; give a large intrinsic size so retina phones stay sharp. */
function cardSvgSize(small: boolean): string {
  // ~3× typical CSS display size (5.4rem / 3.6rem)
  const w = small ? 420 : 640;
  const h = Math.round(w * (334 / 240));
  return `width='${w}' height='${h}'`;
}

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
      <playing-card className="cardmeister" cid={cid} svg={cardSvgSize(small)} />
    </div>
  );
}
