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

  const data = (await res.json()) as DecideResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `请求失败（${res.status}）`);
  }
  return data;
}
