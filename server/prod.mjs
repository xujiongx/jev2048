import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import dotenv from "dotenv";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const apiKey = process.env.OPENROUTER_API_KEY ?? "";
const port = Number(process.env.PORT ?? 4173);

const MOVE_CRITERIA = {
  up: "Slide every tile upward. Prefer when it merges high tiles or consolidates toward the top edge.",
  down: "Slide every tile downward. Prefer when it merges high tiles or consolidates toward the bottom edge.",
  left: "Slide every tile leftward. Prefer when it merges high tiles or consolidates toward the left edge.",
  right: "Slide every tile rightward. Prefer when it merges high tiles or consolidates toward the right edge.",
};

const app = express();
app.use(express.json({ limit: "32kb" }));

app.post("/api/decide", async (req, res) => {
  if (!apiKey) {
    res.status(500).json({
      error:
        "未配置 OPENROUTER_API_KEY。请复制 .env.example 为 .env 并填入密钥。",
    });
    return;
  }

  const { board, score, validMoves, highestTile, emptyCells, moveCount } =
    req.body ?? {};

  const moves = (validMoves ?? []).filter((m) => m in MOVE_CRITERIA);
  if (!board || moves.length === 0) {
    res.status(400).json({ error: "需要提供 board 与 validMoves" });
    return;
  }

  const criteria = Object.fromEntries(
    moves.map((move) => [move, MOVE_CRITERIA[move]]),
  );

  try {
    const response = await fetch(
      "https://openrouter.ai/api/alpha/decisions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": `http://localhost:${port}`,
          "X-OpenRouter-Title": "Jev 2048 Autoplay",
        },
        body: JSON.stringify({
          model: "~typesafe/jev-latest",
          state: {
            game: "2048",
            board,
            score: score ?? 0,
            highest_tile: highestTile ?? 0,
            empty_cells: emptyCells ?? 0,
            move_count: moveCount ?? 0,
            valid_moves: moves,
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

    const data = await response.json();
    if (!response.ok) {
      const message =
        typeof data.error === "string"
          ? data.error
          : data.error?.message ?? `OpenRouter error ${response.status}`;
      res.status(response.status).json({ error: message });
      return;
    }

    const answer = data.answers?.next_move;
    const choice = answer?.choice;
    if (!choice || !moves.includes(choice)) {
      res.status(502).json({
        error: "Jev 返回了无效或缺失的移动方向",
        raw: answer,
      });
      return;
    }

    res.json({
      move: choice,
      confidence: answer.confidence ?? 0,
      probabilities: answer.probabilities ?? {},
      model: data.model ?? "~typesafe/jev-latest",
      usage: data.usage ?? null,
    });
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : "未知错误",
    });
  }
});

app.use(express.static(dist));
app.get("*", (_req, res) => {
  res.sendFile(path.join(dist, "index.html"));
});

app.listen(port, () => {
  console.log(`Jev 2048 running at http://localhost:${port}`);
});
