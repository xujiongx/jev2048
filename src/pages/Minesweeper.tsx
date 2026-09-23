import { useCallback, useEffect, useRef, useState } from "react";
import { Bomb, Flag, Play, RotateCcw } from "lucide-react";
import { askJevMinesweeper } from "../api/jev";
import { BackNav } from "../components/BackNav";
import { DecisionLog } from "../components/DecisionLog";
import {
  applyMsMove,
  createMinesweeper,
  flagCount,
  openCell,
  toggleFlag,
  validMsMoves,
  viewBoard,
  type MinesweeperState,
} from "../minesweeper/engine";
import type { DecisionEntry } from "../types";
import "./minesweeper.css";

export default function Minesweeper() {
  const [game, setGame] = useState<MinesweeperState>(() => createMinesweeper());
  const [flagMode, setFlagMode] = useState(false);
  const [autoplay, setAutoplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState(550);
  const [log, setLog] = useState<DecisionEntry[]>([]);
  const [lastMove, setLastMove] = useState<string | null>(null);
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

  const commit = useCallback((next: MinesweeperState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const reset = useCallback(() => {
    setAutoplay(false);
    setError(null);
    setLastMove(null);
    setLastConfidence(null);
    setLog([]);
    commit(createMinesweeper());
  }, [commit]);

  const onCell = (r: number, c: number) => {
    if (busy || autoplay) return;
    const state = gameRef.current;
    if (state.status === "won" || state.status === "lost") return;
    commit(flagMode ? toggleFlag(state, r, c) : openCell(state, r, c));
  };

  const stepWithJev = useCallback(async (): Promise<"ok" | "stop"> => {
    const state = gameRef.current;
    if (state.status === "won" || state.status === "lost") return "stop";

    const moves = validMsMoves(state);
    if (moves.length === 0) return "stop";

    setBusy(true);
    setError(null);
    const started = performance.now();

    try {
      const decision = await askJevMinesweeper({
        board: viewBoard(state),
        width: state.width,
        height: state.height,
        mines: state.mines,
        remainingMines: state.mines - flagCount(state),
        validMoves: moves,
      });

      const latencyMs = Math.round(performance.now() - started);
      idRef.current += 1;
      setLastMove(decision.move);
      setLastConfidence(decision.confidence);
      setLog((prev) =>
        [
          {
            id: idRef.current,
            move: decision.move,
            confidence: decision.confidence,
            probabilities: decision.probabilities,
            score: state.opened,
            highest: state.mines - flagCount(state),
            model: decision.model,
            latencyMs,
          },
          ...prev,
        ].slice(0, 40),
      );

      const next = applyMsMove(state, decision.move);
      commit(next);
      setBusy(false);
      return next.status === "playing" || next.status === "ready" ? "ok" : "stop";
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

  const remaining = game.mines - flagCount(game);
  const statusText =
    game.status === "won"
      ? "扫清！"
      : game.status === "lost"
        ? "踩雷"
        : game.status === "ready"
          ? "待开局"
          : "进行中";

  return (
    <div className="page ms-page">
      <div className="atmosphere atmosphere-ms" aria-hidden />
      <BackNav />
      <header className="hero">
        <p className="eyebrow">choice · 点开 / 插旗</p>
        <h1 className="brand">扫雷推理</h1>
        <p className="lede">
          把可见数字盘面交给 Jev，让它在「确定安全 / 确定是雷 / 最低风险」之间做下一步。
        </p>
      </header>

      <div className="layout">
        <section className="stage">
          <div className="stats">
            <div className="stat">
              <span className="stat-label">状态</span>
              <span className="stat-value status">{statusText}</span>
            </div>
            <div className="stat">
              <span className="stat-label">剩余雷</span>
              <span className="stat-value">{remaining}</span>
            </div>
            <div className="stat">
              <span className="stat-label">上次动作</span>
              <span className="stat-value">{lastMove ?? "—"}</span>
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

          <div
            className="ms-board"
            style={{
              gridTemplateColumns: `repeat(${game.width}, minmax(0, 1fr))`,
            }}
            role="grid"
            aria-label="扫雷"
          >
            {Array.from({ length: game.height }, (_, r) =>
              Array.from({ length: game.width }, (_, c) => {
                const open = game.revealed[r][c];
                const flagged = game.flagged[r][c];
                const val = game.grid?.[r][c];
                const boom =
                  game.exploded?.r === r && game.exploded?.c === c;
                const showMine =
                  game.status === "lost" && val === -1 && (open || boom);
                let cls = "ms-cell";
                if (open) cls += " open";
                if (flagged) cls += " flagged";
                if (boom) cls += " boom";
                if (open && val && val > 0) cls += ` n${val}`;

                return (
                  <button
                    key={`${r}-${c}`}
                    type="button"
                    className={cls}
                    disabled={busy || autoplay || game.status === "won"}
                    onClick={() => onCell(r, c)}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      if (!busy && !autoplay) {
                        commit(toggleFlag(gameRef.current, r, c));
                      }
                    }}
                  >
                    {flagged && !open ? (
                      <Flag size={14} strokeWidth={2.4} />
                    ) : showMine || boom ? (
                      <Bomb size={14} strokeWidth={2.4} />
                    ) : open && val && val > 0 ? (
                      val
                    ) : null}
                  </button>
                );
              }),
            )}
          </div>

          <div className="controls">
            <button
              type="button"
              className={`btn primary ${autoplay ? "active" : ""}`}
              onClick={() => setAutoplay((v) => !v)}
            >
              <Play size={16} aria-hidden />
              {autoplay ? "停止" : "Jev 自动扫"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || autoplay || game.status === "won" || game.status === "lost"}
              onClick={() => void stepWithJev()}
            >
              单步
            </button>
            <button
              type="button"
              className={`btn ${flagMode ? "active-target" : "ghost"}`}
              onClick={() => setFlagMode((v) => !v)}
            >
              <Flag size={16} aria-hidden />
              {flagMode ? "插旗模式" : "点开模式"}
            </button>
            <button type="button" className="btn ghost" onClick={reset}>
              <RotateCcw size={16} aria-hidden />
              重开
            </button>
            <label className="delay">
              间隔
              <input
                type="range"
                min={200}
                max={1200}
                step={50}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
              />
              <span>{delayMs}ms</span>
            </label>
          </div>
          <p className="hint">
            8×8 · 10 雷。右键也可插旗。有把握的步会先推给 Jev；只有不得不猜时才会点风险格。
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
        </section>
        <DecisionLog entries={log} />
      </div>
    </div>
  );
}
