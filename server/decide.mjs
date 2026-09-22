const MOVE_CRITERIA = {
  up: "Slide every tile upward. Prefer when it merges high tiles or consolidates toward the top edge.",
  down: "Slide every tile downward. Prefer when it merges high tiles or consolidates toward the bottom edge.",
  left: "Slide every tile leftward. Prefer when it merges high tiles or consolidates toward the left edge.",
  right: "Slide every tile rightward. Prefer when it merges high tiles or consolidates toward the right edge.",
};

/**
 * @param {object} body
 * @param {string} apiKey
 * @param {string} [siteUrl]
 */
export async function decideMove(body, apiKey, siteUrl = "https://jev2048.vercel.app") {
  if (!apiKey) {
    return {
      status: 500,
      data: {
        error:
          "未配置 OPENROUTER_API_KEY。请在本地 .env 或托管平台环境变量中填入密钥。",
      },
    };
  }

  const validMoves = (body?.validMoves ?? []).filter(
    (m) => m in MOVE_CRITERIA,
  );

  if (!body?.board || validMoves.length === 0) {
    return { status: 400, data: { error: "需要提供 board 与 validMoves" } };
  }

  const criteria = Object.fromEntries(
    validMoves.map((move) => [move, MOVE_CRITERIA[move]]),
  );

  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
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
  });

  const data = await response.json();

  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : data.error?.message ?? `OpenRouter 错误 ${response.status}`;
    return { status: response.status, data: { error: message } };
  }

  const answer = data.answers?.next_move;
  const choice = answer?.choice;
  if (!choice || !validMoves.includes(choice)) {
    return {
      status: 502,
      data: {
        error: "Jev 返回了无效或缺失的移动方向",
        raw: answer,
      },
    };
  }

  return {
    status: 200,
    data: {
      move: choice,
      confidence: answer.confidence ?? 0,
      probabilities: answer.probabilities ?? {},
      model: data.model ?? "~typesafe/jev-latest",
      usage: data.usage ?? null,
    },
  };
}
