import { useCallback, useEffect, useRef, useState } from "react";
import { Circle, Hash, Play, RotateCcw, Square, X } from "lucide-react";
import { askJevLines } from "../api/jev";
import { BackNav } from "../components/BackNav";
import { DecisionLog } from "../components/DecisionLog";
import {
  applyMove,
  boardForApi,
  createConnect4,
  createTtt,
  opponentMove,
  validMoves,
  type LinesState,
} from "../lines/engine";
import type { DecisionEntry } from "../types";
import "./lines.css";

type Mode = "tictactoe" | "connect4";

function fresh(mode: Mode): LinesState {
  return mode === "tictactoe" ? createTtt() : createConnect4();
}

function statusLabel(state: LinesState): string {
  if (state.status === "won") return `${state.winner} 获胜`;
  if (state.status === "draw") return "平局";
  return `轮到 ${state.current}`;
}

export default function Lines() {
  const [mode, setMode] = useState<Mode>("tictactoe");
  const [game, setGame] = useState<LinesState>(() => createTtt());
  const [autoplay, setAutoplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState(500);
  const [log, setLog] = useState<DecisionEntry[]>([]);
  const [lastMove, setLastMove] = useState<string | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  const gameRef = useRef(game);
  const autoplayRef = useRef(autoplay);
  const busyRef = useRef(busy);
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
    busyRef.current = busy;
  }, [busy]);
  useEffect(() => {
    delayMsRef.current = delayMs;
  }, [delayMs]);

  const commit = useCallback((next: LinesState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const reset = useCallback(
    (nextMode: Mode = mode) => {
      setAutoplay(false);
      setError(null);
      setLastMove(null);
      setLastConfidence(null);
      setLog([]);
      const next = fresh(nextMode);
      commit(next);
    },
    [commit, mode],
  );

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    reset(nextMode);
  };

  const playHuman = (move: string) => {
    if (busyRef.current || autoplayRef.current) return;
    const state = gameRef.current;
    if (state.mode !== "connect4" && state.mode !== "tictactoe") return;
    if (state.status !== "playing") return;
    // 手动模式始终执 X；若轮到 O 说明对手尚未下完
    if (state.current !== "X") return;
    if (!validMoves(state).includes(move)) return;

    const afterYou = applyMove(state, move);
    // apply 未改变（非法步）时不要继续
    if (afterYou === state || afterYou.moveCount === state.moveCount) return;

    setLastMove(move);
    commit(afterYou);
    if (afterYou.status !== "playing") return;

    const opp = opponentMove(afterYou);
    if (opp == null) return;

    window.setTimeout(() => {
      const cur = gameRef.current;
      if (cur.status !== "playing" || cur.current !== "O") return;
      if (!validMoves(cur).includes(opp)) return;
      commit(applyMove(cur, opp));
    }, 280);
  };

  const stepWithJev = useCallback(async (): Promise<"ok" | "stop"> => {
    let state = gameRef.current;
    if (state.status !== "playing") return "stop";

    // Jev always plays as current side when stepping / autoplay.
    setBusy(true);
    setError(null);
    const started = performance.now();
    const moves = validMoves(state);
    if (moves.length === 0) {
      setBusy(false);
      return "stop";
    }

    try {
      const youAre = state.current;
      const decision = await askJevLines({
        game: state.mode,
        board: boardForApi(state),
        validMoves: moves,
        youAre,
        opponent: youAre === "X" ? "O" : "X",
        moveCount: state.moveCount,
      });

      const latencyMs = Math.round(performance.now() - started);
      idRef.current += 1;
      setLastMove(decision.move);
      setLastConfidence(decision.confidence);
      setLog((prev) => [
        {
          id: idRef.current,
          move: decision.move,
          confidence: decision.confidence,
          probabilities: decision.probabilities,
          score: state.moveCount + 1,
          highest: moves.length,
          model: decision.model,
          latencyMs,
        },
        ...prev,
      ].slice(0, 40));

      state = applyMove(state, decision.move);
      commit(state);
      setBusy(false);

      if (state.status !== "playing") return "stop";

      // Opponent reply in autoplay / single-step pairs.
      const opp = opponentMove(state);
      if (opp == null) return "stop";
      await new Promise((r) => window.setTimeout(r, 220));
      state = applyMove(gameRef.current, opp);
      commit(state);
      return state.status === "playing" ? "ok" : "stop";
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
        await new Promise((r) =>
          window.setTimeout(r, delayMsRef.current),
        );
      }
      runningRef.current = false;
      setAutoplay(false);
    })();
  }, [autoplay, stepWithJev]);

  return (
    <div className="page lines-page">
      <div className="atmosphere atmosphere-lines" aria-hidden />
      <BackNav />
      <header className="hero">
        <p className="eyebrow">choice · 落子点</p>
        <h1 className="brand">连棋决策</h1>
        <p className="lede">
          井字棋或四子棋：把合法落子交给 Jev，看它如何优先「自己赢 → 堵对手 → 占中心」。
        </p>
      </header>

      <div className="mode-toggle" role="tablist" aria-label="棋种">
        <button
          type="button"
          className={`btn ${mode === "tictactoe" ? "primary" : "ghost"}`}
          onClick={() => switchMode("tictactoe")}
        >
          <Hash size={16} aria-hidden />
          井字棋
        </button>
        <button
          type="button"
          className={`btn ${mode === "connect4" ? "primary" : "ghost"}`}
          onClick={() => switchMode("connect4")}
        >
          <Square size={16} aria-hidden />
          四子棋
        </button>
      </div>

      <div className="layout">
        <section className="stage">
          <div className="stats">
            <div className="stat">
              <span className="stat-label">状态</span>
              <span className="stat-value status">{statusLabel(game)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">步数</span>
              <span className="stat-value">{game.moveCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">上次落子</span>
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

          {mode === "tictactoe" && game.mode === "tictactoe" ? (
            <div className="ttt-board" role="grid" aria-label="井字棋">
              {game.board.map((cell, i) => (
                <button
                  key={i}
                  type="button"
                  className={`ttt-cell ${cell ? `mark-${cell}` : ""}`}
                  disabled={Boolean(cell) || game.status !== "playing" || busy}
                  onClick={() => playHuman(String(i))}
                  aria-label={`格子 ${i}`}
                >
                  {cell === "X" ? (
                    <X size={36} strokeWidth={2.5} />
                  ) : cell === "O" ? (
                    <Circle size={34} strokeWidth={2.4} />
                  ) : null}
                </button>
              ))}
            </div>
          ) : game.mode === "connect4" ? (
            <div className="c4-wrap">
              <div className="c4-board" role="grid" aria-label="四子棋">
                {Array.from({ length: 7 }, (_, col) => {
                  const full = game.board[0][col] != null;
                  const disabled =
                    game.status !== "playing" || busy || autoplay || full;
                  return (
                    <button
                      key={col}
                      type="button"
                      className={`c4-col ${full ? "full" : ""}`}
                      disabled={disabled}
                      onClick={() => playHuman(String(col))}
                      aria-label={`第 ${col + 1} 列落子`}
                    >
                      {game.board.map((row, r) => {
                        const cell = row[col];
                        return (
                          <span
                            key={r}
                            className={`c4-cell ${cell ? `disc-${cell}` : ""}`}
                          />
                        );
                      })}
                    </button>
                  );
                })}
              </div>
              <p className="c4-tip">点击任意一列即可落子</p>
            </div>
          ) : null}

          <div className="controls">
            <button
              type="button"
              className={`btn primary ${autoplay ? "active" : ""}`}
              disabled={busy && !autoplay}
              onClick={() => setAutoplay((v) => !v)}
            >
              <Play size={16} aria-hidden />
              {autoplay ? "停止自动" : "Jev 自动对弈"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => void stepWithJev()}
            >
              单步（Jev + 对手）
            </button>
            <button type="button" className="btn ghost" onClick={() => reset()}>
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
            手动时你执 X，对手用简易启发落子；自动模式由 Jev 执当前方，对手用同一启发回应。
          </p>
          {error ? <p className="error-banner">{error}</p> : null}
        </section>
        <DecisionLog entries={log} />
      </div>
    </div>
  );
}
