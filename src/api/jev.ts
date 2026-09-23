import type { Board, Direction } from "../game/engine";

export interface Decide2048Request {
  board: Board;
  score: number;
  validMoves: Direction[];
  highestTile: number;
  emptyCells: number;
  moveCount: number;
}

export interface Decide2048Response {
  move: Direction;
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cost?: number;
  } | null;
}

export interface DecideBlackjackRequest {
  playerName?: string;
  playerCards: Array<{ suit: string; rank: string }>;
  dealerUpcard: { suit: string; rank: string };
  playerTotal: number;
  playerIsSoft: boolean;
  otherPlayers?: Array<{ name: string; total: number; status: string }>;
  remainingCards?: number;
  validActions: Array<"hit" | "stand">;
}


export interface DecideBlackjackResponse {
  action: "hit" | "stand";
  confidence: number;
  probabilities: Record<string, number>;
  model: string;
  usage: {
    input_tokens?: number;
    output_tokens?: number;
    cost?: number;
  } | null;
}

async function postDecide<T>(body: unknown): Promise<T> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let data: (T & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as T & { error?: string }) : null;
  } catch {
    throw new Error(
      res.status === 404
        ? "接口 /api/decide 不存在。若已部署到 Vercel，请确认已推送 api/decide.js，并配置 OPENROUTER_API_KEY。"
        : `服务器返回了非 JSON 响应（${res.status}）`,
    );
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `请求失败（${res.status}）`);
  }
  if (!data) {
    throw new Error("决策接口返回数据不完整");
  }
  return data;
}

export function askJev2048(
  payload: Decide2048Request,
): Promise<Decide2048Response> {
  return postDecide({ game: "2048", ...payload });
}

export function askJevBlackjack(
  payload: DecideBlackjackRequest,
): Promise<DecideBlackjackResponse> {
  return postDecide({ game: "blackjack", ...payload });
}
