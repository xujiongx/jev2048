export type MsCellView =
  | "."
  | "F"
  | "0"
  | "1"
  | "2"
  | "3"
  | "4"
  | "5"
  | "6"
  | "7"
  | "8";

export type MinesweeperState = {
  width: number;
  height: number;
  mines: number;
  /** -1 mine, else adjacent count. Only meaningful after first open places mines. */
  grid: number[][] | null;
  revealed: boolean[][];
  flagged: boolean[][];
  status: "ready" | "playing" | "won" | "lost";
  opened: number;
  moveCount: number;
  exploded: { r: number; c: number } | null;
};

const DIRS = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
] as const;

export function createMinesweeper(
  width = 8,
  height = 8,
  mines = 10,
): MinesweeperState {
  return {
    width,
    height,
    mines,
    grid: null,
    revealed: Array.from({ length: height }, () => Array(width).fill(false)),
    flagged: Array.from({ length: height }, () => Array(width).fill(false)),
    status: "ready",
    opened: 0,
    moveCount: 0,
    exploded: null,
  };
}

function inBounds(state: MinesweeperState, r: number, c: number) {
  return r >= 0 && c >= 0 && r < state.height && c < state.width;
}

function neighbors(state: MinesweeperState, r: number, c: number) {
  const out: Array<[number, number]> = [];
  for (const [dr, dc] of DIRS) {
    const rr = r + dr;
    const cc = c + dc;
    if (inBounds(state, rr, cc)) out.push([rr, cc]);
  }
  return out;
}

function placeMines(
  state: MinesweeperState,
  safeR: number,
  safeC: number,
): number[][] {
  const { width, height, mines } = state;
  const grid = Array.from({ length: height }, () => Array(width).fill(0));
  const forbidden = new Set<string>();
  forbidden.add(`${safeR},${safeC}`);
  for (const [rr, cc] of neighbors(state, safeR, safeC)) {
    forbidden.add(`${rr},${cc}`);
  }

  const spots: Array<[number, number]> = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!forbidden.has(`${r},${c}`)) spots.push([r, c]);
    }
  }
  for (let i = spots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [spots[i], spots[j]] = [spots[j], spots[i]];
  }
  const mineCount = Math.min(mines, spots.length);
  for (let i = 0; i < mineCount; i++) {
    const [r, c] = spots[i]!;
    grid[r][c] = -1;
  }
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (grid[r][c] === -1) continue;
      let n = 0;
      for (const [rr, cc] of neighbors(state, r, c)) {
        if (grid[rr][cc] === -1) n += 1;
      }
      grid[r][c] = n;
    }
  }
  return grid;
}

function floodOpen(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  const grid = state.grid!;
  const revealed = state.revealed.map((row) => row.slice());
  const flagged = state.flagged.map((row) => row.slice());
  let opened = state.opened;
  const stack: Array<[number, number]> = [[r, c]];

  while (stack.length) {
    const [cr, cc] = stack.pop()!;
    if (!inBounds(state, cr, cc) || revealed[cr][cc] || flagged[cr][cc]) {
      continue;
    }
    revealed[cr][cc] = true;
    opened += 1;
    if (grid[cr][cc] !== 0) continue;
    for (const [rr, cc2] of neighbors(state, cr, cc)) {
      stack.push([rr, cc2]);
    }
  }

  const safeCells = state.width * state.height - state.mines;
  const won = opened >= safeCells;
  return {
    ...state,
    revealed,
    flagged,
    opened,
    status: won ? "won" : "playing",
    exploded: null,
  };
}

export function openCell(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  if (state.status === "won" || state.status === "lost") return state;
  if (!inBounds(state, r, c) || state.revealed[r][c] || state.flagged[r][c]) {
    return state;
  }

  let next = state;
  let grid = state.grid;
  if (!grid) {
    grid = placeMines(state, r, c);
    next = { ...state, grid, status: "playing" };
  }

  if (grid[r][c] === -1) {
    const revealed = next.revealed.map((row) => row.slice());
    revealed[r][c] = true;
    return {
      ...next,
      revealed,
      status: "lost",
      moveCount: next.moveCount + 1,
      exploded: { r, c },
    };
  }

  const opened = floodOpen({ ...next, grid }, r, c);
  return { ...opened, grid, moveCount: next.moveCount + 1 };
}

export function toggleFlag(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  if (state.status === "won" || state.status === "lost") return state;
  if (!inBounds(state, r, c) || state.revealed[r][c]) return state;
  const flagged = state.flagged.map((row) => row.slice());
  flagged[r][c] = !flagged[r][c];
  return {
    ...state,
    flagged,
    moveCount: state.moveCount + 1,
    status: state.grid ? "playing" : state.status,
  };
}

/** Only place a flag (no toggle-off) — used by autoplay deductions. */
export function setFlag(
  state: MinesweeperState,
  r: number,
  c: number,
): MinesweeperState {
  if (state.status === "won" || state.status === "lost") return state;
  if (!inBounds(state, r, c) || state.revealed[r][c] || state.flagged[r][c]) {
    return state;
  }
  const flagged = state.flagged.map((row) => row.slice());
  flagged[r][c] = true;
  return {
    ...state,
    flagged,
    moveCount: state.moveCount + 1,
    status: state.grid ? "playing" : state.status,
  };
}

export function applyMsMove(
  state: MinesweeperState,
  move: string,
): MinesweeperState {
  const [action, cell] = move.split(":");
  const [rs, cs] = (cell ?? "").split(",");
  const r = Number(rs);
  const c = Number(cs);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return state;
  if (action === "flag") return setFlag(state, r, c);
  if (action === "open") return openCell(state, r, c);
  return state;
}

export function flagCount(state: MinesweeperState): number {
  let n = 0;
  for (const row of state.flagged) for (const f of row) if (f) n += 1;
  return n;
}

/** Visible board for the model / UI. */
export function viewBoard(state: MinesweeperState): MsCellView[][] {
  return state.revealed.map((row, r) =>
    row.map((open, c) => {
      if (state.flagged[r][c]) return "F";
      if (!open) return ".";
      if (state.grid && state.grid[r][c] === -1) return ".";
      const n = state.grid?.[r][c] ?? 0;
      return String(n) as MsCellView;
    }),
  );
}

/**
 * Classic single-cell minesweeper deductions:
 * - if flags == number → remaining neighbors are safe
 * - if unknowns == mines left on that number → all unknowns are mines
 */
export function deduce(state: MinesweeperState): {
  safe: Array<[number, number]>;
  mines: Array<[number, number]>;
} {
  const safe = new Set<string>();
  const mines = new Set<string>();
  if (!state.grid) return { safe: [], mines: [] };

  for (let r = 0; r < state.height; r++) {
    for (let c = 0; c < state.width; c++) {
      if (!state.revealed[r][c]) continue;
      const n = state.grid[r][c];
      if (n < 0) continue;

      const unknown: Array<[number, number]> = [];
      let flags = 0;
      for (const [rr, cc] of neighbors(state, r, c)) {
        if (state.flagged[rr][cc]) {
          flags += 1;
          continue;
        }
        if (!state.revealed[rr][cc]) unknown.push([rr, cc]);
      }

      if (unknown.length === 0) continue;

      if (flags === n) {
        for (const [rr, cc] of unknown) safe.add(`${rr},${cc}`);
      }
      if (flags + unknown.length === n) {
        for (const [rr, cc] of unknown) mines.add(`${rr},${cc}`);
      }
    }
  }

  // A cell cannot be both; prefer mine if conflict (shouldn't happen with correct flags).
  for (const key of mines) safe.delete(key);

  const parse = (key: string): [number, number] => {
    const [a, b] = key.split(",");
    return [Number(a), Number(b)];
  };

  return {
    safe: [...safe].map(parse),
    mines: [...mines].map(parse),
  };
}

function frontierCells(state: MinesweeperState): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = 0; r < state.height; r++) {
    for (let c = 0; c < state.width; c++) {
      if (state.revealed[r][c] || state.flagged[r][c]) continue;
      // Before first open, everything is a candidate.
      if (!state.grid) {
        out.push([r, c]);
        continue;
      }
      const touching = neighbors(state, r, c).some(
        ([rr, cc]) => state.revealed[rr][cc],
      );
      if (touching) out.push([r, c]);
    }
  }
  return out;
}

/**
 * Candidate actions for Jev:
 * 1) If deterministic safe opens exist → only those
 * 2) Else if deterministic mines exist → only flag those
 * 3) Else frontier opens only (never speculative flags — wrong flags ruin the board)
 */
export function validMsMoves(state: MinesweeperState, limit = 16): string[] {
  if (!state.grid) {
    const preferred = [
      [0, 0],
      [0, state.width - 1],
      [state.height - 1, 0],
      [state.height - 1, state.width - 1],
      [Math.floor(state.height / 2), Math.floor(state.width / 2)],
    ] as const;
    return preferred.map(([r, c]) => `open:${r},${c}`);
  }

  const { safe, mines } = deduce(state);

  if (safe.length > 0) {
    return safe.slice(0, limit).map(([r, c]) => `open:${r},${c}`);
  }

  if (mines.length > 0) {
    return mines
      .filter(([r, c]) => !state.flagged[r][c])
      .slice(0, limit)
      .map(([r, c]) => `flag:${r},${c}`);
  }

  // Guessing phase: only opens on frontier (or any hidden if no frontier).
  let cells = frontierCells(state);
  if (cells.length === 0) {
    for (let r = 0; r < state.height; r++) {
      for (let c = 0; c < state.width; c++) {
        if (!state.revealed[r][c] && !state.flagged[r][c]) cells.push([r, c]);
      }
    }
  }

  // Prefer cells next to lower numbers (slightly safer heuristic ordering for the choice set).
  cells = cells
    .map(([r, c]) => {
      let risk = 0;
      let touch = 0;
      for (const [rr, cc] of neighbors(state, r, c)) {
        if (!state.revealed[rr][cc]) continue;
        const n = state.grid![rr][cc];
        if (n > 0) {
          risk += n;
          touch += 1;
        }
      }
      return { r, c, score: touch === 0 ? 99 : risk / touch };
    })
    .sort((a, b) => a.score - b.score)
    .map(({ r, c }) => [r, c] as [number, number]);

  return cells.slice(0, limit).map(([r, c]) => `open:${r},${c}`);
}
