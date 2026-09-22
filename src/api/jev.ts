import type { Board, Direction } from "../game/engine";

export interface DecideRequest {
  board: Board;
  score: number;
  validMoves: Direction[];
  highestTile: number;
  emptyCells: number;
  moveCount: number;
}

export interface DecideResponse {
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

export async function askJev(payload: DecideRequest): Promise<DecideResponse> {
  const res = await fetch("/api/decide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data: (DecideResponse & { error?: string }) | null = null;
  try {
    data = text ? (JSON.parse(text) as DecideResponse & { error?: string }) : null;
  } catch {
    throw new Error(
      res.status === 404
        ? "接口 /api/decide 不存在。若已部署到 Vercel，请确认已推送 api/decide.js，并在项目环境变量中配置 OPENROUTER_API_KEY。"
        : `服务器返回了非 JSON 响应（${res.status}）`,
    );
  }

  if (!res.ok) {
    throw new Error(data?.error ?? `请求失败（${res.status}）`);
  }
  if (!data?.move) {
    throw new Error("决策接口返回数据不完整");
  }
  return data;
}
