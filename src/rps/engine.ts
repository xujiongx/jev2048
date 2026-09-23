export type RpsThrow = "rock" | "paper" | "scissors";
export type OpponentStyle =
  | "random"
  | "copycat"
  | "cycler"
  | "bias-rock"
  | "bias-paper"
  | "counter";

export type RpsRound = {
  you: RpsThrow;
  opponent: RpsThrow;
  result: "win" | "lose" | "draw";
};

export type RpsState = {
  style: OpponentStyle;
  round: number;
  yourScore: number;
  opponentScore: number;
  streak: number;
  history: RpsRound[];
  lastYou: RpsThrow | null;
  cycleIndex: number;
};

const THROWS: RpsThrow[] = ["rock", "paper", "scissors"];

const BEATS: Record<RpsThrow, RpsThrow> = {
  rock: "scissors",
  paper: "rock",
  scissors: "paper",
};

const COUNTERS: Record<RpsThrow, RpsThrow> = {
  rock: "paper",
  paper: "scissors",
  scissors: "rock",
};

export const THROW_LABEL: Record<RpsThrow, string> = {
  rock: "石头",
  paper: "布",
  scissors: "剪刀",
};

export const STYLE_LABEL: Record<OpponentStyle, string> = {
  random: "纯随机",
  copycat: "模仿你上一手",
  cycler: "循环出拳",
  "bias-rock": "爱出石头",
  "bias-paper": "爱出布",
  counter: "克制你上一手",
};

export const STYLE_HINT: Record<OpponentStyle, string> = {
  random: "Opponent throws uniformly at random.",
  copycat: "Opponent often copies your previous throw.",
  cycler: "Opponent cycles rock → paper → scissors.",
  "bias-rock": "Opponent frequently plays rock.",
  "bias-paper": "Opponent frequently plays paper.",
  counter: "Opponent often plays the counter to your previous throw.",
};

export function createRps(style: OpponentStyle = "copycat"): RpsState {
  return {
    style,
    round: 1,
    yourScore: 0,
    opponentScore: 0,
    streak: 0,
    history: [],
    lastYou: null,
    cycleIndex: 0,
  };
}

export function outcome(you: RpsThrow, opponent: RpsThrow): "win" | "lose" | "draw" {
  if (you === opponent) return "draw";
  return BEATS[you] === opponent ? "win" : "lose";
}

export function opponentThrow(state: RpsState): RpsThrow {
  switch (state.style) {
    case "copycat":
      return state.lastYou ?? THROWS[Math.floor(Math.random() * 3)]!;
    case "cycler":
      return THROWS[state.cycleIndex % 3]!;
    case "bias-rock":
      return Math.random() < 0.55
        ? "rock"
        : THROWS[Math.floor(Math.random() * 3)]!;
    case "bias-paper":
      return Math.random() < 0.55
        ? "paper"
        : THROWS[Math.floor(Math.random() * 3)]!;
    case "counter":
      return state.lastYou
        ? COUNTERS[state.lastYou]
        : THROWS[Math.floor(Math.random() * 3)]!;
    case "random":
    default:
      return THROWS[Math.floor(Math.random() * 3)]!;
  }
}

export function playRound(state: RpsState, you: RpsThrow): RpsState {
  const opp = opponentThrow(state);
  const result = outcome(you, opp);
  let streak = state.streak;
  if (result === "win") streak = streak > 0 ? streak + 1 : 1;
  else if (result === "lose") streak = streak < 0 ? streak - 1 : -1;
  else streak = 0;

  return {
    ...state,
    round: state.round + 1,
    yourScore: state.yourScore + (result === "win" ? 1 : 0),
    opponentScore: state.opponentScore + (result === "lose" ? 1 : 0),
    streak,
    lastYou: you,
    cycleIndex: state.cycleIndex + 1,
    history: [...state.history, { you, opponent: opp, result }].slice(-12),
  };
}

export function opponentFreq(history: RpsRound[]): Record<RpsThrow, number> {
  const counts: Record<RpsThrow, number> = {
    rock: 0,
    paper: 0,
    scissors: 0,
  };
  for (const h of history) counts[h.opponent] += 1;
  const total = history.length || 1;
  return {
    rock: counts.rock / total,
    paper: counts.paper / total,
    scissors: counts.scissors / total,
  };
}

export { THROWS, COUNTERS };
