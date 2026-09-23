export type Dir = "up" | "down" | "left" | "right";

export type Point = { r: number; c: number };

export type SnakeState = {
  width: number;
  height: number;
  snake: Point[]; // head = snake[0]
  dir: Dir;
  food: Point;
  score: number;
  steps: number;
  status: "playing" | "won" | "dead";
};

const DELTA: Record<Dir, Point> = {
  up: { r: -1, c: 0 },
  down: { r: 1, c: 0 },
  left: { r: 0, c: -1 },
  right: { r: 0, c: 1 },
};

const OPPOSITE: Record<Dir, Dir> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

export const ALL_DIRS: Dir[] = ["up", "down", "left", "right"];

export const DIR_LABEL: Record<Dir, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右",
};

function key(p: Point) {
  return `${p.r},${p.c}`;
}

function same(a: Point, b: Point) {
  return a.r === b.r && a.c === b.c;
}

function randomEmpty(width: number, height: number, occupied: Set<string>): Point {
  const free: Point[] = [];
  for (let r = 0; r < height; r++) {
    for (let c = 0; c < width; c++) {
      if (!occupied.has(`${r},${c}`)) free.push({ r, c });
    }
  }
  if (free.length === 0) return { r: 0, c: 0 };
  return free[Math.floor(Math.random() * free.length)]!;
}

export function createSnake(width = 12, height = 12): SnakeState {
  const midR = Math.floor(height / 2);
  const midC = Math.floor(width / 2);
  const snake: Point[] = [
    { r: midR, c: midC },
    { r: midR, c: midC - 1 },
    { r: midR, c: midC - 2 },
  ];
  const occupied = new Set(snake.map(key));
  return {
    width,
    height,
    snake,
    dir: "right",
    food: randomEmpty(width, height, occupied),
    score: 0,
    steps: 0,
    status: "playing",
  };
}

function nextHead(head: Point, dir: Dir): Point {
  const d = DELTA[dir];
  return { r: head.r + d.r, c: head.c + d.c };
}

function hitsWall(p: Point, width: number, height: number) {
  return p.r < 0 || p.c < 0 || p.r >= height || p.c >= width;
}

function hitsBody(p: Point, snake: Point[], grow: boolean) {
  // Tail vacates unless growing this step.
  const body = grow ? snake : snake.slice(0, -1);
  return body.some((s) => same(s, p));
}

export function isSafeStep(state: SnakeState, dir: Dir): boolean {
  if (dir === OPPOSITE[state.dir] && state.snake.length > 1) return false;
  const head = nextHead(state.snake[0]!, dir);
  if (hitsWall(head, state.width, state.height)) return false;
  const grow = same(head, state.food);
  if (hitsBody(head, state.snake, grow)) return false;
  return true;
}

/** Prefer safe turns; if trapped, still return non-reverse dirs for a last gasp. */
export function validSnakeMoves(state: SnakeState): Dir[] {
  if (state.status !== "playing") return [];
  const candidates = ALL_DIRS.filter(
    (d) => !(d === OPPOSITE[state.dir] && state.snake.length > 1),
  );
  const safe = candidates.filter((d) => isSafeStep(state, d));
  return safe.length > 0 ? safe : candidates;
}

export function stepSnake(state: SnakeState, dir?: Dir): SnakeState {
  if (state.status !== "playing") return state;
  const nextDir =
    dir && !(dir === OPPOSITE[state.dir] && state.snake.length > 1)
      ? dir
      : state.dir;

  const head = nextHead(state.snake[0]!, nextDir);
  if (hitsWall(head, state.width, state.height)) {
    return { ...state, dir: nextDir, status: "dead", steps: state.steps + 1 };
  }

  const eating = same(head, state.food);
  if (hitsBody(head, state.snake, eating)) {
    return { ...state, dir: nextDir, status: "dead", steps: state.steps + 1 };
  }

  const snake = [head, ...state.snake];
  if (!eating) snake.pop();

  const occupied = new Set(snake.map(key));
  const won = occupied.size >= state.width * state.height;
  const food = eating
    ? won
      ? head
      : randomEmpty(state.width, state.height, occupied)
    : state.food;

  return {
    ...state,
    snake,
    dir: nextDir,
    food,
    score: state.score + (eating ? 1 : 0),
    steps: state.steps + 1,
    status: won ? "won" : "playing",
  };
}

/** Compact board for the model: H=head, S=body, F=food, .=empty */
export function snakeBoardView(state: SnakeState): string[][] {
  const grid = Array.from({ length: state.height }, () =>
    Array.from({ length: state.width }, () => "."),
  );
  for (let i = state.snake.length - 1; i >= 0; i--) {
    const p = state.snake[i]!;
    grid[p.r][p.c] = i === 0 ? "H" : "S";
  }
  if (state.status !== "won") {
    grid[state.food.r][state.food.c] = "F";
  }
  return grid;
}

export { OPPOSITE, DELTA };
