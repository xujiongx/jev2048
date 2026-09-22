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

function tileClass(value: number): string {
  if (value >= 4096) return "t4096";
  return TILE_CLASS[value] ?? "t0";
}

export function BoardView({
  board,
  highlight,
}: {
  board: Board;
  highlight: Direction | null;
}) {
  return (
    <div className={`board-wrap ${highlight ? `flash-${highlight}` : ""}`}>
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
