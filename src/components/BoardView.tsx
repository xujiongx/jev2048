import { useCallback, useRef } from "react";
import type { Board, Direction } from "../game/engine";

const TILE_CLASS: Record<number, string> = {
  0: "t0",
  2: "t2",
  4: "t4",
  8: "t8",
  16: "t16",
  32: "t32",
  64: "t64",
  128: "t128",
  256: "t256",
  512: "t512",
  1024: "t1024",
  2048: "t2048",
};

const SWIPE_MIN = 28;

function tileClass(value: number): string {
  if (value >= 4096) return "t4096";
  return TILE_CLASS[value] ?? "t0";
}

function directionFromDelta(dx: number, dy: number): Direction | null {
  if (Math.abs(dx) < SWIPE_MIN && Math.abs(dy) < SWIPE_MIN) return null;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? "right" : "left";
  }
  return dy > 0 ? "down" : "up";
}

export function BoardView({
  board,
  highlight,
  swipeEnabled = true,
  onSwipe,
}: {
  board: Board;
  highlight: Direction | null;
  swipeEnabled?: boolean;
  onSwipe?: (direction: Direction) => void;
}) {
  const startRef = useRef<{ x: number; y: number } | null>(null);

  const finishSwipe = useCallback(
    (x: number, y: number) => {
      const start = startRef.current;
      startRef.current = null;
      if (!start || !swipeEnabled || !onSwipe) return;
      const dir = directionFromDelta(x - start.x, y - start.y);
      if (dir) onSwipe(dir);
    },
    [onSwipe, swipeEnabled],
  );

  return (
    <div
      className={`board-wrap ${highlight ? `flash-${highlight}` : ""}`}
      onTouchStart={(e) => {
        if (!swipeEnabled || e.touches.length !== 1) return;
        const t = e.touches[0];
        startRef.current = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        if (!startRef.current) return;
        const t = e.changedTouches[0];
        finishSwipe(t.clientX, t.clientY);
      }}
      onTouchCancel={() => {
        startRef.current = null;
      }}
      onPointerDown={(e) => {
        if (!swipeEnabled || e.pointerType === "touch") return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        startRef.current = { x: e.clientX, y: e.clientY };
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      }}
      onPointerUp={(e) => {
        if (e.pointerType === "touch") return;
        if (!startRef.current) return;
        finishSwipe(e.clientX, e.clientY);
      }}
      onPointerCancel={() => {
        startRef.current = null;
      }}
    >
      <div className="board" role="grid" aria-label="2048 棋盘">
        {board.map((row, r) =>
          row.map((value, c) => (
            <div
              key={`${r}-${c}`}
              className={`tile ${tileClass(value)} ${value ? "filled" : ""}`}
              role="gridcell"
            >
              {value || ""}
            </div>
          )),
        )}
      </div>
    </div>
  );
}
