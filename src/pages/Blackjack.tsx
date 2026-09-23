import { useCallback, useEffect, useRef, useState } from "react";
import {
  CircleStop,
  Eraser,
  Hand,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  User,
  Users,
  WandSparkles,
} from "lucide-react";
import { askJevBlackjack } from "../api/jev";
import {
  DECK_SIZE,
  MAX_PLAYERS,
  MIN_PLAYERS,
  RANKS,
  SUITS,
  activeSeat,
  createIdle,
  dealAuto,
  dealManual,
  deckStats,
  handValue,
  hit,
  makeCard,
  outcomeLabel,
  stand,
  type BlackjackState,
  type Card,
  type Rank,
  type Suit,
} from "../blackjack/engine";
import { cardLabel } from "../blackjack/cards";
import { PlayingCard } from "../components/PlayingCard";
import { DeckInventory } from "../components/DeckInventory";
import { BackNav } from "../components/BackNav";
import { SuitIcon } from "../components/SuitIcon";
import "./blackjack.css";

type Mode = "auto" | "manual";
type PickTarget = "player" | "dealer" | "hit";

type BjLog = {
  id: number;
  playerName: string;
  action: string;
  confidence: number;
  probabilities: Record<string, number>;
  playerTotal: number;
  dealerUp: string;
  latencyMs: number;
};

const ACTION_LABEL: Record<string, string> = {
  hit: "要牌",
  stand: "停牌",
};

export default function Blackjack() {
  const [mode, setMode] = useState<Mode>("auto");
  const [playerCount, setPlayerCount] = useState(2);
  const [game, setGame] = useState<BlackjackState>(() => createIdle(2));
  const [busy, setBusy] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<BjLog[]>([]);
  const [lastAdvice, setLastAdvice] = useState<{
    action: string;
    confidence: number;
    playerName: string;
  } | null>(null);

  const [draftPlayers, setDraftPlayers] = useState<Card[][]>([[], []]);
  const [draftDealer, setDraftDealer] = useState<Card[]>([]);
  const [pickTarget, setPickTarget] = useState<PickTarget>("player");
  const [pickPlayerIndex, setPickPlayerIndex] = useState(0);
  const [manualHit, setManualHit] = useState(false);

  const gameRef = useRef(game);
  const autoplayRef = useRef(autoplay);
  const runningRef = useRef(false);
  const idRef = useRef(0);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);

  useEffect(() => {
    if (game.phase !== "idle") return;
    setGame(createIdle(playerCount));
    setDraftPlayers(Array.from({ length: playerCount }, () => []));
    setDraftDealer([]);
    setPickPlayerIndex(0);
  }, [playerCount, game.phase]);

  const usedInDraft = new Set(
    [...draftPlayers.flat(), ...draftDealer].map((c) => c.id),
  );

  const stats =
    game.phase === "idle"
      ? { total: DECK_SIZE, remaining: DECK_SIZE - usedInDraft.size, used: usedInDraft.size }
      : deckStats(game);

  const inventoryUsed =
    game.phase === "idle" ? usedInDraft : game.usedIds;

  const resetAll = () => {
    setAutoplay(false);
    setError(null);
    setLastAdvice(null);
    setLog([]);
    setDraftPlayers(Array.from({ length: playerCount }, () => []));
    setDraftDealer([]);
    setManualHit(false);
    setPickTarget("player");
    setPickPlayerIndex(0);
    setGame(createIdle(playerCount));
  };

  const startAuto = () => {
    setError(null);
    setLastAdvice(null);
    setManualHit(false);
    setGame(dealAuto(playerCount));
  };

  const startManual = () => {
    try {
      setError(null);
      setLastAdvice(null);
      setManualHit(false);
      setGame(dealManual(draftPlayers, draftDealer));
    } catch (err) {
      setError(err instanceof Error ? err.message : "无法开局");
    }
  };

  const addDraftCard = (suit: Suit, rank: Rank) => {
    const card = makeCard(suit, rank);
    if (usedInDraft.has(card.id)) return;
    if (pickTarget === "dealer") {
      setDraftDealer((d) => [...d, card]);
      return;
    }
    setDraftPlayers((prev) =>
      prev.map((hand, i) =>
        i === pickPlayerIndex ? [...hand, card] : hand,
      ),
    );
  };

  const askAndApply = useCallback(async (): Promise<"ok" | "stop"> => {
    const state = gameRef.current;
    if (state.phase !== "player") return "stop";
    const seat = activeSeat(state);
    if (!seat) return "stop";

    const { total, soft } = handValue(seat.hand);
    const upcard = state.dealer[0];
    if (!upcard) return "stop";

    setBusy(true);
    setError(null);
    const started = performance.now();

    try {
      const decision = await askJevBlackjack({
        playerName: seat.name,
        playerCards: seat.hand.map((c) => ({ suit: c.suit, rank: c.rank })),
        dealerUpcard: { suit: upcard.suit, rank: upcard.rank },
        playerTotal: total,
        playerIsSoft: soft,
        otherPlayers: state.players
          .filter((p) => p.id !== seat.id)
          .map((p) => ({
            name: p.name,
            total: handValue(p.hand).total,
            status: p.status,
          })),
        remainingCards: state.deck.length,
        validActions: ["hit", "stand"],
      });

      const latencyMs = Math.round(performance.now() - started);
      setLastAdvice({
        action: decision.action,
        confidence: decision.confidence,
        playerName: seat.name,
      });
      idRef.current += 1;
      setLog((prev) =>
        [
          {
            id: idRef.current,
            playerName: seat.name,
            action: decision.action,
            confidence: decision.confidence,
            probabilities: decision.probabilities,
            playerTotal: total,
            dealerUp: cardLabel(upcard),
            latencyMs,
          },
          ...prev,
        ].slice(0, 40),
      );

      if (decision.action === "stand") {
        const next = stand(state);
        gameRef.current = next;
        setGame(next);
        return next.phase === "player" ? "ok" : "stop";
      }

      if (manualHit) {
        setPickTarget("hit");
        setBusy(false);
        return "stop";
      }

      const next = hit(state);
      gameRef.current = next;
      setGame(next);
      return next.phase === "player" ? "ok" : "stop";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Jev 请求失败");
      return "stop";
    } finally {
      setBusy(false);
    }
  }, [manualHit]);

  useEffect(() => {
    if (!autoplay || runningRef.current) return;
    let cancelled = false;
    runningRef.current = true;

    const loop = async () => {
      while (!cancelled && autoplayRef.current) {
        if (gameRef.current.phase !== "player") break;
        const result = await askAndApply();
        if (result === "stop" || cancelled || !autoplayRef.current) break;
        await new Promise((r) => setTimeout(r, 450));
      }
      setAutoplay(false);
      runningRef.current = false;
    };

    void loop();
    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [autoplay, askAndApply]);

  const onPickHitCard = (suit: Suit, rank: Rank) => {
    try {
      const card = makeCard(suit, rank);
      const next = hit(game, card);
      gameRef.current = next;
      setGame(next);
      setPickTarget("player");
    } catch (err) {
      setError(err instanceof Error ? err.message : "发牌失败");
    }
  };

  const dealerShown =
    game.phase === "player"
      ? handValue(game.dealer.slice(0, 1))
      : handValue(game.dealer);

  const canStartManual =
    draftPlayers.every((h) => h.length >= 2) && draftDealer.length >= 1;

  return (
    <div className="page page-bj">
      <div className="atmosphere atmosphere-bj" aria-hidden="true" />
      <BackNav />

      <header className="hero">
        <p className="eyebrow">OpenRouter · ~typesafe/jev-latest</p>
        <h1 className="brand brand-bj">21 点决策</h1>
        <p className="lede">
          一副 {DECK_SIZE} 张标准扑克（去掉大小王）。支持最多 {MAX_PLAYERS}{" "}
          位玩家轮流行动，Jev 为当前玩家选择要牌或停牌。
        </p>
      </header>

      <div className="bj-toolbar">
        <div className="bj-mode">
          <button
            type="button"
            className={`btn ${mode === "auto" ? "primary" : ""}`}
            onClick={() => setMode("auto")}
            disabled={game.phase !== "idle"}
          >
            <Sparkles size={16} strokeWidth={2.25} aria-hidden />
            自动发牌
          </button>
          <button
            type="button"
            className={`btn ${mode === "manual" ? "primary" : ""}`}
            onClick={() => setMode("manual")}
            disabled={game.phase !== "idle"}
          >
            <Hand size={16} strokeWidth={2.25} aria-hidden />
            手动指定牌
          </button>
        </div>

        <label className="bj-players-control">
          <Users size={16} strokeWidth={2.25} aria-hidden />
          <span>玩家人数</span>
          <select
            value={playerCount}
            disabled={game.phase !== "idle"}
            onChange={(e) => setPlayerCount(Number(e.target.value))}
          >
            {Array.from(
              { length: MAX_PLAYERS - MIN_PLAYERS + 1 },
              (_, i) => MIN_PLAYERS + i,
            ).map((n) => (
              <option key={n} value={n}>
                {n} 人
              </option>
            ))}
          </select>
        </label>
      </div>

      <DeckInventory usedIds={inventoryUsed} remaining={stats.remaining} />

      {mode === "manual" && game.phase === "idle" && (
        <section className="bj-manual panel">
          <div className="bj-manual-targets">
            {draftPlayers.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`btn ghost ${
                  pickTarget === "player" && pickPlayerIndex === i
                    ? "active-target"
                    : ""
                }`}
                onClick={() => {
                  setPickTarget("player");
                  setPickPlayerIndex(i);
                }}
              >
                玩家 {i + 1}（{draftPlayers[i].length}）
              </button>
            ))}
            <button
              type="button"
              className={`btn ghost ${pickTarget === "dealer" ? "active-target" : ""}`}
              onClick={() => setPickTarget("dealer")}
            >
              庄家（{draftDealer.length}）
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => {
                setDraftPlayers(Array.from({ length: playerCount }, () => []));
                setDraftDealer([]);
              }}
            >
              <Eraser size={16} strokeWidth={2.25} aria-hidden />
              清空
            </button>
          </div>

          <div className="bj-draft-hands multi">
            {draftPlayers.map((hand, i) => (
              <div key={i}>
                <h3>玩家 {i + 1}</h3>
                <div className="hand-row">
                  {hand.map((c) => (
                    <PlayingCard key={c.id} card={c} small />
                  ))}
                </div>
              </div>
            ))}
            <div>
              <h3>庄家</h3>
              <div className="hand-row">
                {draftDealer.map((c) => (
                  <PlayingCard key={c.id} card={c} small />
                ))}
              </div>
            </div>
          </div>

          <CardPicker disabledIds={usedInDraft} onPick={addDraftCard} />

          <label className="check">
            <input
              type="checkbox"
              checked={manualHit}
              onChange={(e) => setManualHit(e.target.checked)}
            />
            要牌时也手动指定下一张牌
          </label>

          <button
            type="button"
            className="btn primary"
            disabled={!canStartManual}
            onClick={startManual}
          >
            用这些牌开局
          </button>
        </section>
      )}

      <main className="bj-layout">
        <section className="bj-table panel">
          <div className="bj-seat">
            <div className="seat-meta">
              <span>庄家</span>
              <strong>
                {game.dealer.length === 0
                  ? "—"
                  : game.phase === "player"
                    ? `${dealerShown.total}+?`
                    : dealerShown.total}
              </strong>
            </div>
            <div className="hand-row">
              {game.dealer.map((card, i) => (
                <PlayingCard
                  key={`${card.id}-${i}`}
                  card={card}
                  faceDown={game.phase === "player" && i > 0}
                />
              ))}
            </div>
          </div>

          <p className="bj-message">{game.message}</p>

          <div className="bj-players">
            {game.players.map((seat, i) => {
              const hv = handValue(seat.hand);
              const isActive =
                game.phase === "player" && game.activePlayerIndex === i;
              return (
                <div
                  key={seat.id}
                  className={`bj-seat player-seat ${isActive ? "active" : ""}`}
                >
                  <div className="seat-meta">
                    <span className="seat-name">
                      <User size={14} strokeWidth={2.25} aria-hidden />
                      {seat.name}
                      {isActive ? " · 行动中" : ""}
                    </span>
                    <strong>
                      {seat.hand.length === 0
                        ? "—"
                        : `${hv.total}${hv.soft ? "（软）" : ""}`}
                    </strong>
                    {seat.outcome && (
                      <em className={`outcome outcome-${seat.outcome}`}>
                        {outcomeLabel(seat.outcome)}
                      </em>
                    )}
                    {!seat.outcome && seat.status === "bust" && (
                      <em className="outcome outcome-lose">爆</em>
                    )}
                  </div>
                  <div className="hand-row">
                    {seat.hand.map((card, ci) => (
                      <PlayingCard key={`${card.id}-${ci}`} card={card} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bj-actions">
            {mode === "auto" && game.phase === "idle" && (
              <button type="button" className="btn primary" onClick={startAuto}>
                <Play size={16} strokeWidth={2.25} aria-hidden />
                发牌开局（{playerCount} 人）
              </button>
            )}
            {game.phase === "player" && (
              <>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy || autoplay}
                  onClick={() => void askAndApply()}
                >
                  <WandSparkles size={16} strokeWidth={2.25} aria-hidden />
                  {busy ? "Jev 思考中…" : "让 Jev 决策一步"}
                </button>
                <button
                  type="button"
                  className={`btn ${autoplay ? "primary active" : ""}`}
                  disabled={busy && !autoplay}
                  onClick={() => setAutoplay((v) => !v)}
                >
                  {autoplay ? (
                    <>
                      <Pause size={16} strokeWidth={2.25} aria-hidden />
                      停止自动
                    </>
                  ) : (
                    <>
                      <Play size={16} strokeWidth={2.25} aria-hidden />
                      自动打完所有玩家
                    </>
                  )}
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || autoplay}
                  onClick={() => {
                    const next = hit(game);
                    gameRef.current = next;
                    setGame(next);
                  }}
                >
                  <Hand size={16} strokeWidth={2.25} aria-hidden />
                  手动要牌
                </button>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy || autoplay}
                  onClick={() => {
                    const next = stand(game);
                    gameRef.current = next;
                    setGame(next);
                  }}
                >
                  <CircleStop size={16} strokeWidth={2.25} aria-hidden />
                  手动停牌
                </button>
              </>
            )}
            {game.phase !== "idle" && (
              <button type="button" className="btn ghost" onClick={resetAll}>
                <RotateCcw size={16} strokeWidth={2.25} aria-hidden />
                新一局
              </button>
            )}
          </div>

          {pickTarget === "hit" && game.phase === "player" && (
            <div className="bj-hit-picker">
              <h3>为 {activeSeat(game)?.name ?? "当前玩家"} 选择下一张牌</h3>
              <CardPicker disabledIds={game.usedIds} onPick={onPickHitCard} />
            </div>
          )}

          {lastAdvice && (
            <p className="last-call">
              {lastAdvice.playerName} · Jev 建议：
              <strong>
                {ACTION_LABEL[lastAdvice.action] ?? lastAdvice.action}
              </strong>
              · 置信度 {(lastAdvice.confidence * 100).toFixed(0)}%
            </p>
          )}

          {error && <p className="error">{error}</p>}

          <p className="bj-credit">
            牌面使用{" "}
            <a
              href="https://cardmeister.github.io/"
              target="_blank"
              rel="noreferrer"
            >
              CardMeister
            </a>
            （Unlicense · 基于 Adrian Kennard 设计），本地托管 full 版宫廷牌面。
          </p>
        </section>

        <aside className="log-panel bj-log">
          <div className="log-head">
            <h2>Jev 决策记录</h2>
            <p>按玩家轮次记录「要牌 / 停牌」及概率。</p>
          </div>
          {log.length === 0 ? (
            <p className="log-empty">开局后点「让 Jev 决策」即可看到记录。</p>
          ) : (
            <ul className="log-list">
              {log.map((entry) => (
                <li key={entry.id} className="log-item">
                  <div className="log-row">
                    <span className="move-pill">
                      {ACTION_LABEL[entry.action] ?? entry.action}
                    </span>
                    <span className="conf">
                      {(entry.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="meta">
                      {entry.playerName} · {entry.playerTotal}点 · 庄
                      {entry.dealerUp} · {entry.latencyMs}ms
                    </span>
                  </div>
                  <div className="prob-bars">
                    {Object.entries(entry.probabilities)
                      .sort((a, b) => b[1] - a[1])
                      .map(([label, p]) => (
                        <div key={label} className="prob">
                          <span>{ACTION_LABEL[label] ?? label}</span>
                          <div className="bar">
                            <i style={{ width: `${Math.max(2, p * 100)}%` }} />
                          </div>
                          <span>{(p * 100).toFixed(0)}%</span>
                        </div>
                      ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </main>
    </div>
  );
}

function CardPicker({
  disabledIds,
  onPick,
}: {
  disabledIds: Set<string>;
  onPick: (suit: Suit, rank: Rank) => void;
}) {
  return (
    <div className="card-picker">
      {SUITS.map((suit) => (
        <div key={suit} className="picker-suit">
          <span className="picker-suit-label">
            <SuitIcon suit={suit} size={16} />
          </span>
          <div className="picker-ranks">
            {RANKS.map((rank) => {
              const id = `${suit}_${rank}`;
              const disabled = disabledIds.has(id);
              return (
                <button
                  key={id}
                  type="button"
                  className={`picker-chip ${
                    suit === "heart" || suit === "diamond" ? "red" : ""
                  }`}
                  disabled={disabled}
                  onClick={() => onPick(suit, rank)}
                >
                  {rank}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
