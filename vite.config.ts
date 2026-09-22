import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import type { IncomingMessage, ServerResponse } from "node:http";

type Direction = "up" | "down" | "left" | "right";

const MOVE_CRITERIA: Record<Direction, string> = {
  up: "Slide every tile upward. Prefer when it merges high tiles or consolidates toward the top edge.",
  down: "Slide every tile downward. Prefer when it merges high tiles or consolidates toward the bottom edge.",
  left: "Slide every tile leftward. Prefer when it merges high tiles or consolidates toward the left edge.",
  right: "Slide every tile rightward. Prefer when it merges high tiles or consolidates toward the right edge.",
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(data));
}

function jevApiPlugin(apiKey: string): Plugin {
  return {
    name: "jev-decisions-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.method !== "POST" || req.url !== "/api/decide") {
          next();
          return;
        }

        if (!apiKey) {
          sendJson(res, 500, {
            error:
              "未配置 OPENROUTER_API_KEY。请复制 .env.example 为 .env 并填入密钥。",
          });
          return;
        }

        try {
          const raw = await readBody(req);
          const body = JSON.parse(raw) as {
            board?: number[][];
            score?: number;
            validMoves?: Direction[];
            highestTile?: number;
            emptyCells?: number;
            moveCount?: number;
          };

          const validMoves = (body.validMoves ?? []).filter(
            (m): m is Direction => m in MOVE_CRITERIA,
          );

          if (!body.board || validMoves.length === 0) {
            sendJson(res, 400, { error: "需要提供 board 与 validMoves" });
            return;
          }

          const criteria = Object.fromEntries(
            validMoves.map((move) => [move, MOVE_CRITERIA[move]]),
          );

          const response = await fetch(
            "https://openrouter.ai/api/alpha/decisions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "http://localhost:5173",
                "X-OpenRouter-Title": "Jev 2048 Autoplay",
              },
              body: JSON.stringify({
                model: "~typesafe/jev-latest",
                state: {
                  game: "2048",
                  board: body.board,
                  score: body.score ?? 0,
                  highest_tile: body.highestTile ?? 0,
                  empty_cells: body.emptyCells ?? 0,
                  move_count: body.moveCount ?? 0,
                  valid_moves: validMoves,
                  strategy:
                    "Keep the highest tiles in one corner (preferably bottom-right). Maintain a monotonic snake pattern. Merge equal tiles when safe. Avoid moves that trap the high tile or fill the board.",
                },
                questions: {
                  next_move: {
                    type: "choice",
                    instructions:
                      "Pick the single best next swipe for this 2048 board among valid_moves only. Optimize for long-term score and reaching 2048+, not just the immediate merge.",
                    criteria,
                  },
                },
              }),
            },
          );

          const data = (await response.json()) as {
            error?: { message?: string } | string;
            answers?: {
              next_move?: {
                type?: string;
                choice?: string;
                confidence?: number;
                probabilities?: Record<string, number>;
              };
            };
            usage?: {
              input_tokens?: number;
              output_tokens?: number;
              cost?: number;
            };
            model?: string;
          };

          if (!response.ok) {
            const message =
              typeof data.error === "string"
                ? data.error
                : data.error?.message ?? `OpenRouter error ${response.status}`;
            sendJson(res, response.status, { error: message });
            return;
          }

          const answer = data.answers?.next_move;
          const choice = answer?.choice;
          if (!choice || !validMoves.includes(choice as Direction)) {
            sendJson(res, 502, {
              error: "Jev 返回了无效或缺失的移动方向",
              raw: answer,
            });
            return;
          }

          sendJson(res, 200, {
            move: choice,
            confidence: answer.confidence ?? 0,
            probabilities: answer.probabilities ?? {},
            model: data.model ?? "~typesafe/jev-latest",
            usage: data.usage ?? null,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : "未知错误";
          sendJson(res, 500, { error: message });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiKey = env.OPENROUTER_API_KEY ?? "";

  return {
    plugins: [react(), jevApiPlugin(apiKey)],
    server: {
      port: 5173,
    },
  };
});
