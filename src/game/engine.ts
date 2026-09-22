export type Direction = "up" | "down" | "left" | "right";
export type Board = number[][];

export type GameStatus = "playing" | "won" | "lost";

export interface GameState {
  board: Board;
  score: number;
  status: GameStatus;
  moveCount: number;
  wonOnce: boolean;
}

const SIZE = 4;

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function boardsEqual(a: Board, b: Board): boolean {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (a[r][c] !== b[r][c]) return false;
    }
  }
  return true;
}

function emptyCells(board: Board): Array<[number, number]> {
  const cells: Array<[number, number]> = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function spawnTile(board: Board): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const next = cloneBoard(board);
  const [r, c] = cells[Math.floor(Math.random() * cells.length)];
  next[r][c] = Math.random() < 0.9 ? 2 : 4;
  return next;
}

function slideLine(line: number[]): { line: number[]; gained: number } {
  const filtered = line.filter((n) => n !== 0);
  const merged: number[] = [];
  let gained = 0;
  let i = 0;
  while (i < filtered.length) {
    if (i + 1 < filtered.length && filtered[i] === filtered[i + 1]) {
      const value = filtered[i] * 2;
      merged.push(value);
      gained += value;
      i += 2;
    } else {
      merged.push(filtered[i]);
      i += 1;
    }
  }
  while (merged.length < SIZE) merged.push(0);
  return { line: merged, gained };
}

function getLine(board: Board, dir: Direction, index: number): number[] {
  const line: number[] = [];
  for (let i = 0; i < SIZE; i++) {
    switch (dir) {
      case "left":
        line.push(board[index][i]);
        break;
      case "right":
        line.push(board[index][SIZE - 1 - i]);
        break;
      case "up":
        line.push(board[i][index]);
        break;
      case "down":
        line.push(board[SIZE - 1 - i][index]);
        break;
    }
  }
  return line;
}

function setLine(board: Board, dir: Direction, index: number, line: number[]) {
  for (let i = 0; i < SIZE; i++) {
    const value = line[i];
    switch (dir) {
      case "left":
        board[index][i] = value;
        break;
      case "right":
        board[index][SIZE - 1 - i] = value;
        break;
      case "up":
        board[i][index] = value;
        break;
      case "down":
        board[SIZE - 1 - i][index] = value;
        break;
    }
  }
}

export function moveBoard(
  board: Board,
  direction: Direction,
): { board: Board; gained: number; moved: boolean } {
  const next = cloneBoard(board);
  let gained = 0;
  for (let i = 0; i < SIZE; i++) {
    const { line, gained: lineGain } = slideLine(getLine(next, direction, i));
    setLine(next, direction, i, line);
    gained += lineGain;
  }
  return { board: next, gained, moved: !boardsEqual(board, next) };
}

export function getValidMoves(board: Board): Direction[] {
  const dirs: Direction[] = ["up", "down", "left", "right"];
  return dirs.filter((dir) => moveBoard(board, dir).moved);
}

export function highestTile(board: Board): number {
  let max = 0;
  for (const row of board) {
    for (const cell of row) {
      if (cell > max) max = cell;
    }
  }
  return max;
}

export function countEmpty(board: Board): number {
  return emptyCells(board).length;
}

export function createGame(): GameState {
  let board = emptyBoard();
  board = spawnTile(board);
  board = spawnTile(board);
  return {
    board,
    score: 0,
    status: "playing",
    moveCount: 0,
    wonOnce: false,
  };
}

export function applyMove(state: GameState, direction: Direction): GameState {
  if (state.status === "lost") return state;

  const { board, gained, moved } = moveBoard(state.board, direction);
  if (!moved) return state;

  const withSpawn = spawnTile(board);
  const max = highestTile(withSpawn);
  const wonOnce = state.wonOnce || max >= 2048;
  const valid = getValidMoves(withSpawn);
  const status: GameStatus =
    valid.length === 0 ? "lost" : wonOnce && !state.wonOnce ? "won" : "playing";

  return {
    board: withSpawn,
    score: state.score + gained,
    status: status === "won" && state.wonOnce ? "playing" : status,
    moveCount: state.moveCount + 1,
    wonOnce,
  };
}

export function continueAfterWin(state: GameState): GameState {
  if (state.status !== "won") return state;
  return { ...state, status: "playing" };
}

export function formatBoard(board: Board): string {
  return board.map((row) => row.map((n) => String(n).padStart(4, " ")).join(" ")).join("\n");
}
