const MOVE_CRITERIA = {
  up: "Slide every tile upward. Prefer when it merges high tiles or consolidates toward the top edge.",
  down: "Slide every tile downward. Prefer when it merges high tiles or consolidates toward the bottom edge.",
  left: "Slide every tile leftward. Prefer when it merges high tiles or consolidates toward the left edge.",
  right: "Slide every tile rightward. Prefer when it merges high tiles or consolidates toward the right edge.",
};

const BJ_CRITERIA = {
  hit: "Take another card. Prefer when the player total is low, or soft hands that can still improve safely.",
  stand: "Stop taking cards. Prefer when the player total is strong enough versus the dealer upcard, or when hitting risks busting.",
};

/**
 * @param {string} apiKey
 * @param {string} siteUrl
 * @param {object} payload
 */
async function callJev(apiKey, siteUrl, payload) {
  const response = await fetch("https://openrouter.ai/api/alpha/decisions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": siteUrl,
      "X-OpenRouter-Title": "Jev Dev Tools",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (!response.ok) {
    const message =
      typeof data.error === "string"
        ? data.error
        : data.error?.message ?? `OpenRouter 错误 ${response.status}`;
    return { status: response.status, data: { error: message } };
  }
  return { status: 200, data };
}

async function decide2048(body, apiKey, siteUrl) {
  const validMoves = (body?.validMoves ?? []).filter((m) => m in MOVE_CRITERIA);
  if (!body?.board || validMoves.length === 0) {
    return { status: 400, data: { error: "需要提供 board 与 validMoves" } };
  }

  const criteria = Object.fromEntries(
    validMoves.map((move) => [move, MOVE_CRITERIA[move]]),
  );

  const result = await callJev(apiKey, siteUrl, {
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
  });

  if (result.status !== 200) return result;

  const answer = result.data.answers?.next_move;
  const choice = answer?.choice;
  if (!choice || !validMoves.includes(choice)) {
    return {
      status: 502,
      data: { error: "Jev 返回了无效或缺失的移动方向", raw: answer },
    };
  }

  return {
    status: 200,
    data: {
      game: "2048",
      move: choice,
      confidence: answer.confidence ?? 0,
      probabilities: answer.probabilities ?? {},
      model: result.data.model ?? "~typesafe/jev-latest",
      usage: result.data.usage ?? null,
    },
  };
}

async function decideBlackjack(body, apiKey, siteUrl) {
  const actions = (body?.validActions ?? ["hit", "stand"]).filter(
    (a) => a in BJ_CRITERIA,
  );
  if (actions.length === 0) {
    return { status: 400, data: { error: "需要提供 validActions" } };
  }

  const criteria = Object.fromEntries(
    actions.map((action) => [action, BJ_CRITERIA[action]]),
  );

  const result = await callJev(apiKey, siteUrl, {
    model: "~typesafe/jev-latest",
    state: {
      game: "blackjack",
      rules:
        "Standard blackjack with a single 52-card deck (no jokers). Dealer hits soft 17. Multiple players share one deck. Only hit or stand for the active player.",
      player_name: body.playerName ?? "player",
      player_cards: body.playerCards ?? [],
      dealer_upcard: body.dealerUpcard ?? null,
      player_total: body.playerTotal ?? null,
      player_is_soft: body.playerIsSoft ?? false,
      other_players: body.otherPlayers ?? [],
      remaining_cards_in_deck: body.remainingCards ?? null,
      basic_strategy_hint:
        "Favor stand on hard 17+. Hit hard 11 or less. On hard 12-16, hit vs dealer 7+ else stand. Soft 17 or less usually hits; soft 18 stands vs 2,7,8 else hits vs strong upcards.",
    },
    questions: {
      action: {
        type: "choice",
        instructions:
          "Given the player hand and dealer upcard, choose the best blackjack action among validActions only. Optimize for expected value, not entertainment.",
        criteria,
      },
    },
  });

  if (result.status !== 200) return result;

  const answer = result.data.answers?.action;
  const choice = answer?.choice;
  if (!choice || !actions.includes(choice)) {
    return {
      status: 502,
      data: { error: "Jev 返回了无效或缺失的动作", raw: answer },
    };
  }

  return {
    status: 200,
    data: {
      game: "blackjack",
      action: choice,
      confidence: answer.confidence ?? 0,
      probabilities: answer.probabilities ?? {},
      model: result.data.model ?? "~typesafe/jev-latest",
      usage: result.data.usage ?? null,
    },
  };
}

/**
 * @param {object} body
 * @param {string} apiKey
 * @param {string} [siteUrl]
 */
export async function decideMove(
  body,
  apiKey,
  siteUrl = "https://jev2048.vercel.app",
) {
  if (!apiKey) {
    return {
      status: 500,
      data: {
        error:
          "未配置 OPENROUTER_API_KEY。请在本地 .env 或托管平台环境变量中填入密钥。",
      },
    };
  }

  if (body?.game === "blackjack") {
    return decideBlackjack(body, apiKey, siteUrl);
  }

  return decide2048(body, apiKey, siteUrl);
}
