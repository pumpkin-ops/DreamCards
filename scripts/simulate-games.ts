import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

type PlayerId = "you" | "AI_Alice" | "AI_Bob" | "AI_Carol";

type CardSnapshot = {
  card_id: string;
  image_url: string;
  creator_name: string;
  creator_sequence?: number;
  tags: string[];
};

type PlayerRoundRecord = {
  player_id: PlayerId;
  hand_cards: CardSnapshot[];
  submitted_card: CardSnapshot;
  vote_target: string | null;
  vote_correct: boolean | null;
  storyteller_score: number;
  player_score: number;
  total_score: number;
  winner: boolean;
};

type RoundRecord = {
  game_id: string;
  round_id: string;
  round_number: number;
  storyteller_id: PlayerId;
  storyteller_card: CardSnapshot;
  clue: string;
  clue_length: number;
  outcome: "all_correct" | "none_correct" | "partial_correct";
  vote_concentration: number;
  players: PlayerRoundRecord[];
};

type GameRecord = {
  game_id: string;
  rounds: RoundRecord[];
  final_scores: Record<PlayerId, number>;
  winners: PlayerId[];
};

const playerOrder: PlayerId[] = ["you", "AI_Alice", "AI_Bob", "AI_Carol"];
const gameCount = Number(process.env.SIM_GAME_COUNT ?? 10);
const maxRoundsPerGame = Number(process.env.SIM_MAX_ROUNDS ?? 100);
const outputDir = join(process.cwd(), "docs", "portfolio", "playtest-data");

process.env.GITHUB_MODELS_TOKEN = "";
process.env.AI_TIMEOUT_MS = "100";
const simulationRunId = Date.now().toString(36);
process.env.DREAMCARDS_DB_PATH = ":memory:";
process.env.DREAMCARDS_UPLOAD_DIR = join(outputDir, `simulation-uploads-${simulationRunId}`);

async function main() {
  await mkdir(outputDir, { recursive: true });
  const dbModule = await import("../server/src/db.js");
  const gameModule = await import("../server/src/singlePlayer.js");
  const aiModule = await import("../server/services/aiService.js");

  dbModule.initDatabase();
  const activeUserId = 1;
  const deckId = dbModule.getDecks(activeUserId).find((deck) => deck.cards.length >= 6)?.id;
  const games: GameRecord[] = [];

  for (let gameIndex = 1; gameIndex <= gameCount; gameIndex += 1) {
    const publicSession = await gameModule.startSinglePlayerGame(activeUserId, deckId);
    const sessionId = publicSession.id;
    const rounds: RoundRecord[] = [];

    for (let roundIndex = 1; roundIndex <= maxRoundsPerGame; roundIndex += 1) {
      let session = requireSession(gameModule.getSinglePlayerSession(sessionId));
      const hands = snapshotHands(session);

      if (session.storytellerId === "you") {
        const storyCard = randomItem(session.playerHand);
        const generated = aiModule.generateFallbackClue(storyCard);
        await gameModule.submitSinglePlayerClue(sessionId, generated.clue, storyCard.id);
      } else {
        const choice = await aiModule.chooseCardByClue(session.clue, session.playerHand, "AI_Alice");
        await gameModule.submitSinglePlayerPlayerCard(sessionId, choice.cardId);
      }

      session = await waitForPhase(gameModule.getSinglePlayerSession, sessionId, ["awaiting_vote", "revealed"]);

      if (session.phase === "awaiting_vote" && session.storytellerId !== "you") {
        const ownCardId = session.submissions.find((submission) => submission.playerId === "you")?.card.id ?? "";
        const vote = await aiModule.voteCardByClue(
          session.clue,
          session.anonymousCards.map((submission) => submission.card),
          ownCardId,
          "AI_Alice"
        );
        await gameModule.submitSinglePlayerVote(sessionId, vote.votedCardId);
      }

      session = await waitForPhase(gameModule.getSinglePlayerSession, sessionId, ["revealed"]);
      rounds.push(buildRoundRecord(gameIndex, roundIndex, session, hands));

      if (session.gameOver) break;
      await gameModule.nextSinglePlayerRound(sessionId);
    }

    const finalSession = requireSession(gameModule.getSinglePlayerSession(sessionId));
    if (!finalSession.gameOver) {
      throw new Error(`${makeGameId(gameIndex)} did not reach 30 points within ${maxRoundsPerGame} rounds`);
    }
    let nextRoundWasBlocked = false;
    try {
      await gameModule.nextSinglePlayerRound(sessionId);
    } catch {
      nextRoundWasBlocked = true;
    }
    if (!nextRoundWasBlocked) {
      throw new Error(`${makeGameId(gameIndex)} allowed a new round after game over`);
    }
    const highestScore = Math.max(...Object.values(finalSession.scores) as number[]);
    const winners = [...finalSession.winnerIds];
    rounds.forEach((round) => {
      round.players.forEach((player) => {
        player.winner = winners.includes(player.player_id);
      });
    });
    games.push({
      game_id: makeGameId(gameIndex),
      rounds,
      final_scores: { ...finalSession.scores },
      winners
    });
    console.log(`Completed ${gameIndex}/${gameCount}: ${winners.join(", ")} (${highestScore})`);
  }

  const rounds = games.flatMap((game) => game.rounds);
  const summary = buildSummary(games, rounds);
  await Promise.all([
    writeFile(join(outputDir, "ten-games-detailed.json"), JSON.stringify(games, null, 2), "utf8"),
    writeFile(join(outputDir, "ten-games-rounds.json"), JSON.stringify(rounds, null, 2), "utf8"),
    writeFile(join(outputDir, "ten-games-player-actions.csv"), playerActionsCsv(rounds), "utf8"),
    writeFile(join(outputDir, "ten-games-summary-cn.json"), JSON.stringify(summary, null, 2), "utf8"),
    writeFile(join(outputDir, "TEN_GAMES_SUMMARY_CN.md"), summaryMarkdown(summary), "utf8")
  ]);

  console.log(`Saved simulation data to ${outputDir}`);
}

function buildRoundRecord(
  gameIndex: number,
  roundIndex: number,
  session: any,
  hands: Record<PlayerId, CardSnapshot[]>
): RoundRecord {
  const storySubmission = session.submissions.find((submission: any) => submission.isStoryCard);
  if (!storySubmission) throw new Error("Missing storyteller submission");
  const correctVotes = session.votes.filter((vote: any) => vote.votedCardId === storySubmission.card.id).length;
  const outcome = correctVotes === 3 ? "all_correct" : correctVotes === 0 ? "none_correct" : "partial_correct";
  const voteCounts = new Map<string, number>();
  session.votes.forEach((vote: any) => {
    voteCounts.set(vote.votedCardId, (voteCounts.get(vote.votedCardId) ?? 0) + 1);
  });
  const voteConcentration = session.votes.length
    ? Math.max(...voteCounts.values()) / session.votes.length
    : 0;

  return {
    game_id: makeGameId(gameIndex),
    round_id: `${makeGameId(gameIndex)}_round_${String(roundIndex).padStart(2, "0")}`,
    round_number: roundIndex,
    storyteller_id: session.storytellerId,
    storyteller_card: snapshotCard(storySubmission.card),
    clue: session.clue,
    clue_length: [...session.clue.trim()].length,
    outcome,
    vote_concentration: roundNumber(voteConcentration),
    players: playerOrder.map((playerId) => {
      const submission = session.submissions.find((item: any) => item.playerId === playerId);
      const vote = session.votes.find((item: any) => item.voterId === playerId);
      const playerScore = session.scoreEvents
        .filter((event: any) => event.playerId === playerId)
        .reduce((sum: number, event: any) => sum + event.points, 0);
      return {
        player_id: playerId,
        hand_cards: hands[playerId],
        submitted_card: snapshotCard(submission.card),
        vote_target: vote?.votedCardId ?? null,
        vote_correct: playerId === session.storytellerId ? null : vote?.votedCardId === storySubmission.card.id,
        storyteller_score: playerId === session.storytellerId ? playerScore : 0,
        player_score: playerScore,
        total_score: session.scores[playerId],
        winner: false
      };
    })
  };
}

function snapshotHands(session: any): Record<PlayerId, CardSnapshot[]> {
  const storytellerSubmission = session.submissions.find((submission: any) => submission.isStoryCard);
  const handFor = (playerId: PlayerId) => {
    const cards = playerId === "you" ? [...session.playerHand] : [...session.aiHands[playerId]];
    if (
      storytellerSubmission?.playerId === playerId &&
      !cards.some((card: any) => card.id === storytellerSubmission.card.id)
    ) {
      cards.push(storytellerSubmission.card);
    }
    return cards.map(snapshotCard);
  };
  return {
    you: handFor("you"),
    AI_Alice: handFor("AI_Alice"),
    AI_Bob: handFor("AI_Bob"),
    AI_Carol: handFor("AI_Carol")
  };
}

function snapshotCard(card: any): CardSnapshot {
  return {
    card_id: card.id,
    image_url: card.imageUrl,
    creator_name: card.creatorName,
    creator_sequence: card.creatorSequence,
    tags: [...(card.tags ?? [])]
  };
}

function buildSummary(games: GameRecord[], rounds: RoundRecord[]) {
  const outcomeCount = (outcome: RoundRecord["outcome"]) => rounds.filter((round) => round.outcome === outcome).length;
  const allCorrect = outcomeCount("all_correct");
  const noneCorrect = outcomeCount("none_correct");
  const partialCorrect = outcomeCount("partial_correct");
  const playerStats = Object.fromEntries(
    playerOrder.map((playerId) => {
      const records = rounds.flatMap((round) => round.players).filter((player) => player.player_id === playerId);
      const voteRecords = records.filter((player) => player.vote_correct !== null);
      return [
        playerId,
        {
          胜局数: games.filter((game) => game.winners.includes(playerId)).length,
          平均每回合得分: roundNumber(average(records.map((record) => record.player_score))),
          投票正确率: roundNumber(
            voteRecords.length
              ? voteRecords.filter((record) => record.vote_correct).length / voteRecords.length
              : 0
          ),
          平均终局总分: roundNumber(average(games.map((game) => game.final_scores[playerId])))
        }
      ];
    })
  );

  return {
    模拟局数: games.length,
    总回合数: rounds.length,
    平均每局回合数: roundNumber(average(games.map((game) => game.rounds.length))),
    最短对局回合数: Math.min(...games.map((game) => game.rounds.length)),
    最长对局回合数: Math.max(...games.map((game) => game.rounds.length)),
    获胜分数线: 30,
    全员猜中回合数: allCorrect,
    无人猜中回合数: noneCorrect,
    部分猜中回合数: partialCorrect,
    全员猜中率: roundNumber(allCorrect / rounds.length),
    无人猜中率: roundNumber(noneCorrect / rounds.length),
    部分猜中率: roundNumber(partialCorrect / rounds.length),
    票数集中度: roundNumber(average(rounds.map((round) => round.vote_concentration))),
    提示词长度: roundNumber(average(rounds.map((round) => round.clue_length))),
    玩家汇总: playerStats,
    单局胜者: games.map((game) => ({ 游戏编号: game.game_id, 胜者: game.winners, 最终分数: game.final_scores }))
  };
}

function playerActionsCsv(rounds: RoundRecord[]) {
  const headers = [
    "游戏编号",
    "回合编号",
    "说书人编号",
    "说书人卡牌",
    "提示词",
    "提示词长度",
    "回合结果",
    "票数集中度",
    "玩家编号",
    "手牌",
    "提交卡牌",
    "投票目标",
    "是否猜中",
    "说书人得分",
    "本回合得分",
    "累计总分",
    "是否获胜"
  ];
  const rows = rounds.flatMap((round) =>
    round.players.map((player) => [
      round.game_id,
      round.round_id,
      round.storyteller_id,
      round.storyteller_card.card_id,
      round.clue,
      round.clue_length,
      outcomeLabel(round.outcome),
      round.vote_concentration,
      player.player_id,
      player.hand_cards.map((card) => card.card_id).join("|"),
      player.submitted_card.card_id,
      player.vote_target ?? "",
      player.vote_correct === null ? "" : booleanLabel(player.vote_correct),
      player.storyteller_score,
      player.player_score,
      player.total_score,
      booleanLabel(player.winner)
    ])
  );
  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
}

function summaryMarkdown(summary: ReturnType<typeof buildSummary>) {
  const winners = summary.单局胜者
    .map((game) => `| ${game.游戏编号} | ${game.胜者.join("、")} | ${formatScores(game.最终分数)} |`)
    .join("\n");
  const players = Object.entries(summary.玩家汇总)
    .map(
      ([playerId, stats]) =>
        `| ${playerId} | ${stats.胜局数} | ${percent(stats.投票正确率)} | ${stats.平均每回合得分} | ${stats.平均终局总分} |`
    )
    .join("\n");

  return `# DreamCards 十局模拟汇总

## 样本范围

- 模拟局数：${summary.模拟局数}
- 总回合数：${summary.总回合数}
- 获胜分数线：${summary.获胜分数线}
- 平均每局回合数：${summary.平均每局回合数}
- 对局长度范围：${summary.最短对局回合数}–${summary.最长对局回合数} 回合
- AI模式：本地 fallback 策略（不消耗外部模型额度）

## 核心指标

| 中文指标 | 字段 | 结果 |
|---|---|---:|
| 全员猜中率 | all_correct_rate | ${percent(summary.全员猜中率)} |
| 无人猜中率 | none_correct_rate | ${percent(summary.无人猜中率)} |
| 部分猜中率 | partial_correct_rate | ${percent(summary.部分猜中率)} |
| 平均票数集中度 | vote_concentration | ${percent(summary.票数集中度)} |
| 平均提示词长度 | clue_length | ${summary.提示词长度} 字 |

回合分布：全员猜中 ${summary.全员猜中回合数} 回合，无人猜中 ${summary.无人猜中回合数} 回合，部分猜中 ${summary.部分猜中回合数} 回合。

## 玩家汇总

| 玩家 | 胜局数 | 投票正确率 | 平均每回合得分 | 平均终局总分 |
|---|---:|---:|---:|---:|
${players}

## 单局胜者

| 游戏编号 | 胜者 | 最终分数 |
|---|---|---|
${winners}

## 数据口径

- 对局持续轮换说书人，直到回合结算后最高分达到 30 分。
- 票数集中度 = 单张牌最高得票数 / 本回合总票数。
- 提示词长度按 Unicode 字符数统计，不包含首尾空白。
- 说书人不投票；其 vote_target 与 vote_correct 记录为 null。
- winner 表示该玩家是否并列或独占本局最高总分。
`;
}

async function waitForPhase(
  getSession: (sessionId: string) => any,
  sessionId: string,
  phases: string[],
  timeoutMs = 30000
) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const session = requireSession(getSession(sessionId));
    if (phases.includes(session.phase)) return session;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for ${phases.join(" or ")} in ${sessionId}`);
}

function requireSession<T>(session: T | undefined): T {
  if (!session) throw new Error("Session not found");
  return session;
}

function randomItem<T>(items: T[]): T {
  if (!items.length) throw new Error("Cannot choose from an empty list");
  return items[Math.floor(Math.random() * items.length)];
}

function makeGameId(index: number) {
  return `game_${String(index).padStart(2, "0")}`;
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function roundNumber(value: number) {
  return Number(value.toFixed(4));
}

function percent(value: number) {
  return `${(value * 100).toFixed(2)}%`;
}

function outcomeLabel(outcome: RoundRecord["outcome"]) {
  if (outcome === "all_correct") return "全员猜中";
  if (outcome === "none_correct") return "无人猜中";
  return "部分猜中";
}

function booleanLabel(value: boolean) {
  return value ? "是" : "否";
}

function formatScores(scores: Record<PlayerId, number>) {
  return playerOrder.map((playerId) => `${playerId} ${scores[playerId]}`).join("；");
}

function csvCell(value: unknown) {
  const text = String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
