import { Layers } from "lucide-react";
import { DECK_SIZE, fullDeckOrdered } from "../blackjack/engine";
import { cardLabel } from "../blackjack/cards";
import { SuitIcon } from "./SuitIcon";

export function DeckInventory({
  usedIds,
  remaining,
}: {
  usedIds: Set<string>;
  remaining: number;
}) {
  const all = fullDeckOrdered();
  const used = usedIds.size;

  return (
    <section className="deck-panel panel">
      <div className="deck-head">
        <h2>
          <Layers size={18} strokeWidth={2.25} aria-hidden />
          牌堆统计
        </h2>
        <p>
          标准扑克 <strong>{DECK_SIZE}</strong> 张（无大小王）· 已用{" "}
          <strong>{used}</strong> · 剩余 <strong>{remaining}</strong>
        </p>
      </div>
      <div className="deck-grid" aria-label="52 张牌一览">
        {all.map((card) => {
          const gone = usedIds.has(card.id);
          return (
            <span
              key={card.id}
              className={`deck-chip ${gone ? "used" : "left"} ${
                card.suit === "heart" || card.suit === "diamond" ? "red" : ""
              }`}
              title={`${cardLabel(card)}${gone ? " · 已发出" : " · 仍在牌堆"}`}
            >
              <SuitIcon suit={card.suit} size={10} />
              {card.rank}
            </span>
          );
        })}
      </div>
    </section>
  );
}
