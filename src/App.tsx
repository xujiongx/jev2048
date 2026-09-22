import { useCallback, useEffect, useRef, useState } from "react";
import { askJev } from "./api/jev";
import {
  applyMove,
  continueAfterWin,
  countEmpty,
  createGame,
  getValidMoves,
  highestTile,
  type Direction,
  type GameState,
} from "./game/engine";
import type { DecisionEntry } from "./types";
import { BoardView } from "./components/BoardView";
import { DecisionLog } from "./components/DecisionLog";
import { Controls } from "./components/Controls";

const DIRECTION_KEYS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export default function App() {
  const [game, setGame] = useState<GameState>(() => createGame());
  const [autoplay, setAutoplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState(450);
  const [stopAtWin, setStopAtWin] = useState(true);
  const [log, setLog] = useState<DecisionEntry[]>([]);
  const [lastMove, setLastMove] = useState<Direction | null>(null);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  const gameRef = useRef(game);
  const autoplayRef = useRef(autoplay);
  const busyRef = useRef(busy);
  const stopAtWinRef = useRef(stopAtWin);
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
    stopAtWinRef.current = stopAtWin;
  }, [stopAtWin]);
  useEffect(() => {
    delayMsRef.current = delayMs;
  }, [delayMs]);

  const reset = useCallback(() => {
    setAutoplay(false);
    setError(null);
    setLastMove(null);
    setLastConfidence(null);
    setLog([]);
    const next = createGame();
    gameRef.current = next;
    setGame(next);
  }, []);

  const playMove = useCallback((direction: Direction) => {
    const prev = gameRef.current;
    const next = applyMove(prev, direction);
    if (next === prev) return;
    setLastMove(direction);
    gameRef.current = next;
    setGame(next);
  }, []);

  const commitGame = useCallback((next: GameState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const stepWithJev = useCallback(async (): Promise<"ok" | "stop"> => {
    const state = gameRef.current;
    if (state.status === "lost") return "stop";
    if (state.status === "won" && stopAtWinRef.current) return "stop";

    const working =
      state.status === "won" ? continueAfterWin(state) : state;

    const validMoves = getValidMoves(working.board);
    if (validMoves.length === 0) {
      commitGame({ ...working, status: "lost" });
      return "stop";
    }

    setBusy(true);
    setError(null);
    const started = performance.now();

    try {
      const decision = await askJev({
        board: working.board,
        score: working.score,
        validMoves,
        highestTile: highestTile(working.board),
        emptyCells: countEmpty(working.board),
        moveCount: working.moveCount,
      });

      const latencyMs = Math.round(performance.now() - started);
      const move = decision.move;

      setLastConfidence(decision.confidence);
      setLastMove(move);
      idRef.current += 1;
      setLog((prev) =>
        [
          {
            id: idRef.current,
            move,
            confidence: decision.confidence,
            probabilities: decision.probabilities,
            score: working.score,
            highest: highestTile(working.board),
            model: decision.model,
            latencyMs,
          },
          ...prev,
        ].slice(0, 40),
      );

      const next = applyMove(working, move);
      commitGame(next);

      if (next.status === "lost") return "stop";
      if (next.status === "won" && stopAtWinRef.current) return "stop";
      return "ok";
    } catch (err) {
      const message = err instanceof Error ? err.message : "Jev 请求失败";
      setError(message);
      return "stop";
    } finally {
      setBusy(false);
    }
  }, [commitGame]);

  useEffect(() => {
    if (!autoplay || runningRef.current) return;

    let cancelled = false;
    runningRef.current = true;

    const loop = async () => {
      while (!cancelled && autoplayRef.current) {
        const result = await stepWithJev();
        if (result === "stop" || cancelled || !autoplayRef.current) break;
        await new Promise((r) => setTimeout(r, delayMsRef.current));
      }
      setAutoplay(false);
      runningRef.current = false;
    };

    void loop();
    return () => {
      cancelled = true;
      runningRef.current = false;
    };
  }, [autoplay, stepWithJev]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (autoplayRef.current || busyRef.current) return;
      const dir = DIRECTION_KEYS[e.key] ?? DIRECTION_KEYS[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      playMove(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playMove]);

  const moveLabel: Record<string, string> = {
    up: "上",
    down: "下",
    left: "左",
    right: "右",
  };

  const statusLabel =
    game.status === "won"
      ? "已达成 2048"
      : game.status === "lost"
        ? "游戏结束"
        : autoplay
          ? "Jev 游玩中…"
          : "就绪";

  return (
    <div className="page">
      <div className="atmosphere" aria-hidden="true" />
      <header className="hero">
        <p className="eyebrow">OpenRouter · ~typesafe/jev-latest</p>
        <h1 className="brand">Jev 2048</h1>
        <p className="lede">
          每一步滑动都由结构化决策驱动。Jev 读取棋盘并选择下一步方向，直到通关——或格子被填满。
        </p>
      </header>

      <main className="layout">
        <section className="stage">
          <div className="stats">
            <div className="stat">
              <span className="stat-label">得分</span>
              <span className="stat-value">{game.score}</span>
            </div>
            <div className="stat">
              <span className="stat-label">最高块</span>
              <span className="stat-value">{highestTile(game.board)}</span>
            </div>
            <div className="stat">
              <span className="stat-label">步数</span>
              <span className="stat-value">{game.moveCount}</span>
            </div>
            <div className="stat">
              <span className="stat-label">状态</span>
              <span className="stat-value status">{statusLabel}</span>
            </div>
          </div>

          <BoardView board={game.board} highlight={lastMove} />

          <Controls
            autoplay={autoplay}
            busy={busy}
            delayMs={delayMs}
            stopAtWin={stopAtWin}
            canStep={game.status !== "lost" && !(game.status === "won" && stopAtWin)}
            onToggleAutoplay={() => setAutoplay((v) => !v)}
            onStep={() => void stepWithJev()}
            onReset={reset}
            onDelayChange={setDelayMs}
            onStopAtWinChange={setStopAtWin}
            onContinue={() => {
              const next = continueAfterWin(gameRef.current);
              gameRef.current = next;
              setGame(next);
            }}
            showContinue={game.status === "won"}
          />

          {error && <p className="error">{error}</p>}

          {lastMove && lastConfidence !== null && (
            <p className="last-call">
              上一步：<strong>{moveLabel[lastMove] ?? lastMove}</strong> · 置信度{" "}
              {(lastConfidence * 100).toFixed(0)}%
            </p>
          )}
        </section>

        <DecisionLog entries={log} />
      </main>
    </div>
  );
}
