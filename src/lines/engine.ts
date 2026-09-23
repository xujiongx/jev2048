export type Cell = "X" | "O" | null;
export type LinesStatus = "playing" | "won" | "draw";

export type TttState = {
  mode: "tictactoe";
  board: Cell[]; // length 9
  current: "X" | "O";
  status: LinesStatus;
  winner: "X" | "O" | null;
  moveCount: number;
};

export type C4State = {
  mode: "connect4";
  board: Cell[][]; // 6 rows x 7 cols, row 0 = top
  current: "X" | "O";
  status: LinesStatus;
  winner: "X" | "O" | null;
  moveCount: number;
};

export type LinesState = TttState | C4State;

const TTT_WINS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

export function createTtt(): TttState {
  return {
    mode: "tictactoe",
    board: Array(9).fill(null),
    current: "X",
    status: "playing",
    winner: null,
    moveCount: 0,
  };
}

export function createConnect4(): C4State {
  return {
    mode: "connect4",
    board: Array.from({ length: 6 }, () => Array<Cell>(7).fill(null)),
    current: "X",
    status: "playing",
    winner: null,
    moveCount: 0,
  };
}

export function tttValidMoves(board: Cell[]): string[] {
  return board
    .map((c, i) => (c == null ? String(i) : null))
    .filter((x): x is string => x != null);
}

export function c4ValidMoves(board: Cell[][]): string[] {
  const moves: string[] = [];
  for (let col = 0; col < 7; col++) {
    if (board[0][col] == null) moves.push(String(col));
  }
  return moves;
}

export function validMoves(state: LinesState): string[] {
  if (state.status !== "playing") return [];
  return state.mode === "tictactoe"
    ? tttValidMoves(state.board)
    : c4ValidMoves(state.board);
}

function tttWinner(board: Cell[]): "X" | "O" | null {
  for (const [a, b, c] of TTT_WINS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

function c4Winner(board: Cell[][]): "X" | "O" | null {
  const rows = 6;
  const cols = 7;
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ] as const;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = board[r][c];
      if (!cell) continue;
      for (const [dr, dc] of dirs) {
        let ok = true;
        for (let k = 1; k < 4; k++) {
          const rr = r + dr * k;
          const cc = c + dc * k;
          if (rr < 0 || rr >= rows || cc < 0 || cc >= cols || board[rr][cc] !== cell) {
            ok = false;
            break;
          }
        }
        if (ok) return cell;
      }
    }
  }
  return null;
}

export function applyTttMove(state: TttState, move: string): TttState {
  if (state.status !== "playing") return state;
  const idx = Number(move);
  if (!Number.isInteger(idx) || idx < 0 || idx > 8 || state.board[idx] != null) {
    return state;
  }
  const board = state.board.slice();
  board[idx] = state.current;
  const winner = tttWinner(board);
  const full = board.every((c) => c != null);
  return {
    ...state,
    board,
    current: state.current === "X" ? "O" : "X",
    moveCount: state.moveCount + 1,
    winner,
    status: winner ? "won" : full ? "draw" : "playing",
  };
}

export function applyC4Move(state: C4State, move: string): C4State {
  if (state.status !== "playing") return state;
  const col = Number(move);
  if (!Number.isInteger(col) || col < 0 || col > 6 || state.board[0][col] != null) {
    return state;
  }
  const board = state.board.map((row) => row.slice());
  let row = 5;
  while (row >= 0 && board[row][col] != null) row -= 1;
  if (row < 0) return state;
  board[row][col] = state.current;
  const winner = c4Winner(board);
  const full = board.every((r) => r.every((c) => c != null));
  return {
    ...state,
    board,
    current: state.current === "X" ? "O" : "X",
    moveCount: state.moveCount + 1,
    winner,
    status: winner ? "won" : full ? "draw" : "playing",
  };
}

export function applyMove(state: LinesState, move: string): LinesState {
  return state.mode === "tictactoe"
    ? applyTttMove(state, move)
    : applyC4Move(state, move);
}

/** Weak but legal opponent: win > block > random. */
export function opponentMove(state: LinesState): string | null {
  const moves = validMoves(state);
  if (moves.length === 0) return null;

  for (const m of moves) {
    const next = applyMove(state, m);
    if (next.status === "won" && next.winner === state.current) return m;
  }

  const foe: "X" | "O" = state.current === "X" ? "O" : "X";
  for (const m of moves) {
    const asFoe =
      state.mode === "tictactoe"
        ? applyTttMove({ ...state, current: foe }, m)
        : applyC4Move({ ...state, current: foe }, m);
    if (asFoe.status === "won" && asFoe.winner === foe) return m;
  }

  if (state.mode === "tictactoe" && moves.includes("4")) return "4";
  if (state.mode === "connect4") {
    const center = ["3", "2", "4", "1", "5", "0", "6"].find((c) =>
      moves.includes(c),
    );
    if (center) return center;
  }

  return moves[Math.floor(Math.random() * moves.length)]!;
}

export function boardForApi(state: LinesState): unknown {
  if (state.mode === "tictactoe") {
    return state.board.map((c) => c ?? ".");
  }
  return state.board.map((row) => row.map((c) => c ?? "."));
}
