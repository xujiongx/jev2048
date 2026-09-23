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
        : (data.error?.message ?? `OpenRouter 错误 ${response.status}`);
    return { status: response.status, data: { error: message } };
  }
  return { status: 200, data };
}

function wrapChoice(result, questionKey, valid, mapChoice) {
  if (result.status !== 200) return result;
  const answer = result.data.answers?.[questionKey];
  const choice = answer?.choice;
  if (!choice || !valid.includes(choice)) {
    return {
      status: 502,
      data: { error: "Jev 返回了无效或缺失的选项", raw: answer },
    };
  }
  return {
    status: 200,
    data: {
      ...mapChoice(choice),
      confidence: answer.confidence ?? 0,
      probabilities: answer.probabilities ?? {},
      model: result.data.model ?? "~typesafe/jev-latest",
      usage: result.data.usage ?? null,
    },
  };
}

const MOVE_CRITERIA = {
  up: "Slide every tile upward. Prefer when it merges high tiles or consolidates toward the top edge.",
  down: "Slide every tile downward. Prefer when it merges high tiles or consolidates toward the bottom edge.",
  left: "Slide every tile leftward. Prefer when it merges high tiles or consolidates toward the left edge.",
  right: "Slide every tile rightward. Prefer when it merges high tiles or consolidates toward the right edge.",
};

const BJ_CRITERIA = {
  hit: "Take another card. Prefer when the player total is low, or soft hands that can still improve safely.",
  stand:
    "Stop taking cards. Prefer when the player total is strong enough versus the dealer upcard, or when hitting risks busting.",
};

const RPS_CRITERIA = {
  rock: "Play rock. Beats scissors, loses to paper.",
  paper: "Play paper. Beats rock, loses to scissors.",
  scissors: "Play scissors. Beats paper, loses to rock.",
};

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

  return wrapChoice(result, "next_move", validMoves, (choice) => ({
    game: "2048",
    move: choice,
  }));
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

  return wrapChoice(result, "action", actions, (choice) => ({
    game: "blackjack",
    action: choice,
  }));
}

async function decideLines(body, apiKey, siteUrl) {
  const mode = body?.mode === "connect4" ? "connect4" : "tictactoe";
  const validMoves = Array.isArray(body?.validMoves)
    ? body.validMoves.map(String)
    : [];
  if (validMoves.length === 0) {
    return { status: 400, data: { error: "需要提供 validMoves" } };
  }

  const criteria = Object.fromEntries(
    validMoves.map((move) => [
      move,
      mode === "connect4"
        ? `Drop a disc in column ${move}. Prefer winning moves, then blocks, then center control.`
        : `Place your mark in cell ${move} (row-major 0-8). Prefer winning moves, then blocks, then center/corners.`,
    ]),
  );

  const result = await callJev(apiKey, siteUrl, {
    model: "~typesafe/jev-latest",
    state: {
      game: mode,
      board: body.board ?? null,
      you_are: body.youAre ?? "X",
      opponent: body.opponent ?? "O",
      valid_moves: validMoves,
      move_count: body.moveCount ?? 0,
      strategy:
        mode === "connect4"
          ? "Connect Four on a 6x7 grid. Win with 4 in a row. Prefer immediate wins, then block opponent wins, then occupy center columns, avoid giving opponent a winning reply."
          : "Tic-tac-toe 3x3. Win with 3 in a row. Prefer immediate wins, then block, then center, then corners, then edges.",
    },
    questions: {
      next_move: {
        type: "choice",
        instructions:
          "Pick the single best legal move among valid_moves only. Play optimally to win; if draw is best, force it.",
        criteria,
      },
    },
  });

  return wrapChoice(result, "next_move", validMoves, (choice) => ({
    game: mode,
    move: choice,
  }));
}

async function decideMinesweeper(body, apiKey, siteUrl) {
  const validMoves = Array.isArray(body?.validMoves)
    ? body.validMoves.map(String)
    : [];
  if (validMoves.length === 0 || !body?.board) {
    return { status: 400, data: { error: "需要提供 board 与 validMoves" } };
  }

  const criteria = Object.fromEntries(
    validMoves.map((move) => {
      const [action, cell] = move.split(":");
      if (action === "flag") {
        return [
          move,
          `Flag cell ${cell} as a mine. Prefer when adjacent numbers are satisfied only if this cell is a mine.`,
        ];
      }
      return [
        move,
        `Open cell ${cell}. Prefer cells that are safe by constraint counting; avoid 50/50 traps when a safer inference exists.`,
      ];
    }),
  );

  const result = await callJev(apiKey, siteUrl, {
    model: "~typesafe/jev-latest",
    state: {
      game: "minesweeper",
      width: body.width ?? 8,
      height: body.height ?? 8,
      mines: body.mines ?? 10,
      remaining_mines: body.remainingMines ?? null,
      board: body.board,
      valid_moves: validMoves,
      notes:
        "Board cells: hidden='.', flagged='F', opened number='0'-'8'. valid_moves are already filtered: either proven-safe opens, proven mine flags, or lowest-risk frontier opens when guessing is unavoidable.",
    },
    questions: {
      next_move: {
        type: "choice",
        instructions:
          "Pick one action from valid_moves. If they are open:* proven-safe cells, any is fine (prefer expanding zeros). If flag:*, flag a proven mine. If only risky opens remain, pick the least dangerous.",
        criteria,
      },
    },
  });

  return wrapChoice(result, "next_move", validMoves, (choice) => ({
    game: "minesweeper",
    move: choice,
  }));
}

async function decideRps(body, apiKey, siteUrl) {
  const validMoves = (body?.validMoves ?? ["rock", "paper", "scissors"]).filter(
    (m) => m in RPS_CRITERIA,
  );
  if (validMoves.length === 0) {
    return { status: 400, data: { error: "需要提供 validMoves" } };
  }

  const criteria = Object.fromEntries(
    validMoves.map((move) => [move, RPS_CRITERIA[move]]),
  );

  const result = await callJev(apiKey, siteUrl, {
    model: "~typesafe/jev-latest",
    state: {
      game: "rps",
      round: body.round ?? 1,
      your_score: body.yourScore ?? 0,
      opponent_score: body.opponentScore ?? 0,
      streak: body.streak ?? 0,
      history: body.history ?? [],
      opponent_style_hint: body.opponentStyleHint ?? "unknown",
      observed_opponent_freq: body.opponentFreq ?? null,
      strategy:
        "Rock-paper-scissors. Infer the opponent's pattern from history (copycat, cycler, biased throw, random) and play the counter. If uncertain, prefer the counter to their most frequent recent throw.",
    },
    questions: {
      next_move: {
        type: "choice",
        instructions:
          "Pick rock, paper, or scissors to maximize win chance this round against the inferred opponent pattern.",
        criteria,
      },
    },
  });

  return wrapChoice(result, "next_move", validMoves, (choice) => ({
    game: "rps",
    move: choice,
  }));
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

  switch (body?.game) {
    case "blackjack":
      return decideBlackjack(body, apiKey, siteUrl);
    case "tictactoe":
    case "connect4":
    case "lines":
      return decideLines(
        { ...body, mode: body.game === "lines" ? body.mode : body.game },
        apiKey,
        siteUrl,
      );
    case "minesweeper":
      return decideMinesweeper(body, apiKey, siteUrl);
    case "rps":
      return decideRps(body, apiKey, siteUrl);
    case "2048":
    default:
      return decide2048(body, apiKey, siteUrl);
  }
}
