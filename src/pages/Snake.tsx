import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Play,
  RotateCcw,
} from "lucide-react";
import { askJevSnake } from "../api/jev";
import { BackNav } from "../components/BackNav";
import { DecisionLog } from "../components/DecisionLog";
import {
  ALL_DIRS,
  DIR_LABEL,
  createSnake,
  snakeBoardView,
  stepSnake,
  validSnakeMoves,
  type Dir,
  type SnakeState,
} from "../snake/engine";
import type { DecisionEntry } from "../types";
import "./snake.css";

const DIR_ICON = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
} as const;

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  w: "up",
  s: "down",
  a: "left",
  d: "right",
};

export default function Snake() {
  const [game, setGame] = useState<SnakeState>(() => createSnake());
  const [autoplay, setAutoplay] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delayMs, setDelayMs] = useState(280);
  const [log, setLog] = useState<DecisionEntry[]>([]);
  const [lastMove, setLastMove] = useState<Dir | null>(null);
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

  const commit = useCallback((next: SnakeState) => {
    gameRef.current = next;
    setGame(next);
  }, []);

  const reset = useCallback(() => {
    setAutoplay(false);
    setError(null);
    setLastMove(null);
    setLastConfidence(null);
    setLog([]);
    commit(createSnake());
  }, [commit]);

  const turn = useCallback(
    (dir: Dir) => {
      if (busyRef.current || autoplayRef.current) return;
      const state = gameRef.current;
      if (state.status !== "playing") return;
      const next = stepSnake(state, dir);
      setLastMove(dir);
      commit(next);
    },
    [commit],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const dir = KEY_DIR[e.key] ?? KEY_DIR[e.key.toLowerCase()];
      if (!dir) return;
      e.preventDefault();
      turn(dir);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [turn]);

  const stepWithJev = useCallback(async (): Promise<"ok" | "stop"> => {
    const state = gameRef.current;
    if (state.status !== "playing") return "stop";

    const validMoves = validSnakeMoves(state);
    if (validMoves.length === 0) {
      commit({ ...state, status: "dead" });
      return "stop";
    }

    setBusy(true);
    setError(null);
    const started = performance.now();

    try {
      const decision = await askJevSnake({
        board: snakeBoardView(state),
        width: state.width,
        height: state.height,
        snake: state.snake,
        food: state.food,
        dir: state.dir,
        score: state.score,
        steps: state.steps,
        validMoves,
      });

      const latencyMs = Math.round(performance.now() - started);
      const move = decision.move;
      idRef.current += 1;
      setLastMove(move);
      setLastConfidence(decision.confidence);
      setLog((prev) =>
        [
          {
            id: idRef.current,
            move,
            confidence: decision.confidence,
            probabilities: decision.probabilities,
            score: state.score,
            highest: state.snake.length,
            model: decision.model,
            latencyMs,
          },
          ...prev,
        ].slice(0, 40),
      );

      const next = stepSnake(state, move);
      commit(next);
      setBusy(false);
      return next.status === "playing" ? "ok" : "stop";
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

  const statusText =
    game.status === "dead"
      ? "撞死了"
      : game.status === "won"
        ? "通关！"
        : "进行中";

  return (
    <div className="page snake-page">
      <div className="atmosphere atmosphere-snake" aria-hidden />
      <BackNav />
      <header className="hero">
        <p className="eyebrow">choice · 四向移动</p>
        <h1 className="brand">贪吃蛇</h1>
        <p className="lede">
          把蛇身、食物与安全方向交给 Jev，每一步选转向；自动游走时轨迹很适合演示。
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
              <span className="stat-label">得分</span>
              <span className="stat-value">{game.score}</span>
            </div>
            <div className="stat">
              <span className="stat-label">长度</span>
              <span className="stat-value">{game.snake.length}</span>
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
            className="snake-board"
            style={{
              gridTemplateColumns: `repeat(${game.width}, minmax(0, 1fr))`,
            }}
            role="img"
            aria-label="贪吃蛇棋盘"
          >
            {Array.from({ length: game.height }, (_, r) =>
              Array.from({ length: game.width }, (_, c) => {
                const head = game.snake[0];
                const isHead = head && head.r === r && head.c === c;
                const isBody = game.snake.some(
                  (p, i) => i > 0 && p.r === r && p.c === c,
                );
                const isFood =
                  game.food.r === r && game.food.c === c && game.status !== "won";
                let cls = "snake-cell";
                if (isHead) cls += " head";
                else if (isBody) cls += " body";
                if (isFood) cls += " food";
                return <div key={`${r}-${c}`} className={cls} />;
              }),
            )}
          </div>

          <div className="snake-pad" aria-label="方向键">
            <span />
            <button
              type="button"
              className={`btn pad ${lastMove === "up" ? "active-target" : ""}`}
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => turn("up")}
            >
              <ArrowUp size={18} />
            </button>
            <span />
            <button
              type="button"
              className={`btn pad ${lastMove === "left" ? "active-target" : ""}`}
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => turn("left")}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              className={`btn pad ${lastMove === "down" ? "active-target" : ""}`}
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => turn("down")}
            >
              <ArrowDown size={18} />
            </button>
            <button
              type="button"
              className={`btn pad ${lastMove === "right" ? "active-target" : ""}`}
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => turn("right")}
            >
              <ArrowRight size={18} />
            </button>
          </div>

          <div className="controls">
            <button
              type="button"
              className={`btn primary ${autoplay ? "active" : ""}`}
              onClick={() => setAutoplay((v) => !v)}
            >
              <Play size={16} aria-hidden />
              {autoplay ? "停止" : "Jev 自动玩"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={busy || autoplay || game.status !== "playing"}
              onClick={() => void stepWithJev()}
            >
              单步
            </button>
            <button type="button" className="btn ghost" onClick={reset}>
              <RotateCcw size={16} aria-hidden />
              重开
            </button>
            <label className="delay">
              间隔
              <input
                type="range"
                min={120}
                max={800}
                step={20}
                value={delayMs}
                onChange={(e) => setDelayMs(Number(e.target.value))}
              />
              <span>{delayMs}ms</span>
            </label>
          </div>

          {lastMove ? (
            <p className="snake-last">
              上次方向：
              {(() => {
                const Icon = DIR_ICON[lastMove];
                return (
                  <>
                    <Icon size={14} aria-hidden /> {DIR_LABEL[lastMove]}
                  </>
                );
              })()}
              {" · "}可选 {validSnakeMoves(game).length || "—"} 向
              {" · "}
              {ALL_DIRS.map((d) => DIR_LABEL[d]).join("/")}
            </p>
          ) : (
            <p className="hint">键盘 WASD / 方向键也可控制；撞墙或撞到自己会结束。</p>
          )}
          {error ? <p className="error-banner">{error}</p> : null}
        </section>
        <DecisionLog entries={log} />
      </div>
    </div>
  );
}
