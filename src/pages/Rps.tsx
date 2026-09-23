import { useCallback, useEffect, useRef, useState } from "react";
import { Hand, Play, RotateCcw } from "lucide-react";
import { askJevRps } from "../api/jev";
import { BackNav } from "../components/BackNav";
import { DecisionLog } from "../components/DecisionLog";
import {
  STYLE_HINT,
  STYLE_LABEL,
  THROW_LABEL,
  THROWS,
  createRps,
  opponentFreq,
  playRound,
  type OpponentStyle,
  type RpsState,
  type RpsThrow,
} from "../rps/engine";
import type { DecisionEntry } from "../types";
import "./rps.css";

const STYLES: OpponentStyle[] = [
  "copycat",
  "cycler",
  "bias-rock",
  "bias-paper",
  "counter",
  "random",
];

export default function Rps() {
  const [style, setStyle] = useState<OpponentStyle>("copycat");
  const [game, setGame] = useState<RpsState>(() => createRps("copycat"));
  const [autoplay, setAutoplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState(600);
  const [log, setLog] = useState<DecisionEntry[]>([]);
  const [lastYou, setLastYou] = useState<RpsThrow | null>(null);
  const [lastOpp, setLastOpp] = useState<RpsThrow | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  const gameRef = useRef(game);
  const autoplayRef = useRef(autoplay);
  const delayMsRef = useRef(delayMs);
  const runningRef = useRef(false);
  const idRef = useRef(0);

  useEffect(() => {
    gameRef.current = game;
  }, [game]);
  useEffect(() => {
    autoplayRef.current = autoplay;
  }, [autoplay]);
  useEffect(() => {
    delayMsRef.current = delayMs;
  }, [delayMs]);

  const commit = useCallback((next: RpsState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const reset = useCallback(
    (nextStyle: OpponentStyle = style) => {
      setAutoplay(false);
      setError(null);
      setLastYou(null);
      setLastOpp(null);
      setLastConfidence(null);
      setLog([]);
      commit(createRps(nextStyle));
    },
    [commit, style],
  );

  const playManual = (you: RpsThrow) => {
    if (busy || autoplay) return;
    const next = playRound(gameRef.current, you);
    const last = next.history[next.history.length - 1]!;
    setLastYou(you);
    setLastOpp(last.opponent);
    commit(next);
  };

  const stepWithJev = useCallback(async (): Promise<"ok" | "stop"> => {
    const state = gameRef.current;
    setBusy(true);
    setError(null);
    const started = performance.now();
    try {
      const decision = await askJevRps({
        validMoves: [...THROWS],
        round: state.round,
        yourScore: state.yourScore,
        opponentScore: state.opponentScore,
        streak: state.streak,
        history: state.history,
        opponentStyleHint: STYLE_HINT[state.style],
        opponentFreq: opponentFreq(state.history),
      });
      const latencyMs = Math.round(performance.now() - started);
      const next = playRound(state, decision.move);
      const last = next.history[next.history.length - 1]!;
      setLastYou(decision.move);
      setLastOpp(last.opponent);
      setLastConfidence(decision.confidence);
      idRef.current += 1;
      setLog((entries) =>
        [
          {
            id: idRef.current,
            move: decision.move,
            confidence: decision.confidence,
            probabilities: decision.probabilities,
            score: next.yourScore,
            highest: next.opponentScore,
            model: decision.model,
            latencyMs,
          },
          ...entries,
        ].slice(0, 40),
      );
      commit(next);
      setBusy(false);
      return "ok";
    } catch (err) {
      setBusy(false);
      setAutoplay(false);
      setError(err instanceof Error ? err.message : "决策失败");
      return "stop";
    }
  }, [commit]);

  useEffect(() => {
    if (!autoplay || runningRef.current) return;
    runningRef.current = true;
    (async () => {
      while (autoplayRef.current) {
        const result = await stepWithJev();
        if (result === "stop" || !autoplayRef.current) break;
        await new Promise((r) => window.setTimeout(r, delayMsRef.current));
      }
      runningRef.current = false;
      setAutoplay(false);
    })();
  }, [autoplay, stepWithJev]);

  const lastResult = game.history[game.history.length - 1]?.result;

  return (
    <div className="page rps-page">
      <div className="atmosphere atmosphere-rps" aria-hidden />
      <BackNav />
      <header className="hero">
        <p className="eyebrow">choice · 石头剪刀布</p>
        <h1 className="brand">猜拳策略</h1>
        <p className="lede">
          对手有固定套路（模仿、循环、偏科…）。把历史交给 Jev，看它如何猜下一手并连击得分。
        </p>
      </header>

      <div className="layout">
        <section className="stage">
          <div className="stats">
            <div className="stat">
              <span className="stat-label">比分</span>
              <span className="stat-value">
                {game.yourScore} : {game.opponentScore}
              </span>
            </div>
            <div className="stat">
              <span className="stat-label">回合</span>
              <span className="stat-value">{game.round}</span>
            </div>
            <div className="stat">
              <span className="stat-label">连胜/连败</span>
              <span className="stat-value">{game.streak}</span>
            </div>
            <div className="stat">
              <span className="stat-label">置信度</span>
              <span className="stat-value">
                {lastConfidence == null
                  ? "—"
                  : `${(lastConfidence * 100).toFixed(0)}%`}
              </span>
            </div>
          </div>

          <label className="style-pick">
            对手套路
            <select
              value={style}
              disabled={busy || autoplay}
              onChange={(e) => {
                const next = e.target.value as OpponentStyle;
                setStyle(next);
                reset(next);
              }}
            >
              {STYLES.map((s) => (
                <option key={s} value={s}>
                  {STYLE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <div className="rps-arena" aria-live="polite">
            <div className="rps-hand you">
              <span className="rps-role">你 / Jev</span>
              <strong>{lastYou ? THROW_LABEL[lastYou] : "？"}</strong>
            </div>
            <div className="rps-vs">VS</div>
            <div className="rps-hand opp">
              <span className="rps-role">对手</span>
              <strong>{lastOpp ? THROW_LABEL[lastOpp] : "？"}</strong>
            </div>
          </div>

          {lastResult ? (
            <p className={`rps-result result-${lastResult}`}>
              {lastResult === "win"
                ? "你赢了这手"
                : lastResult === "lose"
                  ? "这手输了"
                  : "平手"}
            </p>
          ) : (
            <p className="rps-result muted">出拳或让 Jev 先猜一手</p>
          )}

          <div className="rps-throws">
            {THROWS.map((t) => (
              <button
                key={t}
                type="button"
                className="btn rps-throw"
                disabled={busy || autoplay}
                onClick={() => playManual(t)}
              >
                <Hand size={16} aria-hidden />
                {THROW_LABEL[t]}
              </button>
            ))}
          </div>

          <div className="controls">
            <button
              type="button"
              className={`btn primary ${autoplay ? "active" : ""}`}
              onClick={() => setAutoplay((v) => !v)}
            >
              <Play size={16} aria-hidden />
              {autoplay ? "停止" : "Jev 连打"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || autoplay}
              onClick={() => void stepWithJev()}
            >
              Jev 出一拳
            </button>
            <button type="button" className="btn ghost" onClick={() => reset()}>
              <RotateCcw size={16} aria-hidden />
              重开
            </button>
            <label className="delay">
              间隔
              <input
                type="range"
                min={250}
                max={1400}
                step={50}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
              />
              <span>{delayMs}ms</span>
            </label>
          </div>
          <p className="hint">
            API 会收到对手风格提示与近期频率，方便观察 Jev 是否学到模式。
          </p>
          {error ? <p className="error-banner">{error}</p> : null}

          {game.history.length > 0 ? (
            <ol className="rps-history">
              {[...game.history].reverse().map((h, i) => (
                <li key={`${game.history.length}-${i}-${h.you}-${h.opponent}`}>
                  <span>{THROW_LABEL[h.you]}</span>
                  <span className="vs">vs</span>
                  <span>{THROW_LABEL[h.opponent]}</span>
                  <span className={`tag ${h.result}`}>
                    {h.result === "win" ? "胜" : h.result === "lose" ? "负" : "平"}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
        </section>
        <DecisionLog entries={log} />
      </div>
    </div>
  );
}
