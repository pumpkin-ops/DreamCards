export const DEFAULT_SCORE_LIMIT = 30;

export type RoundSubmission<PlayerId extends string = string, CardId extends string | number = string> = {
  playerId: PlayerId;
  cardId: CardId;
  isStoryCard: boolean;
};

export type RoundVote<PlayerId extends string = string, CardId extends string | number = string> = {
  voterId: PlayerId;
  cardId: CardId;
};

export type ScoreEvent<PlayerId extends string = string> = {
  playerId: PlayerId;
  points: number;
  reason: "all_correct" | "none_correct" | "storyteller_partial" | "correct_vote" | "decoy_vote";
};

export type RoundScoreResult<PlayerId extends string = string> = {
  outcome: "all_correct" | "none_correct" | "partial_correct";
  correctVoteCount: number;
  events: ScoreEvent<PlayerId>[];
};

export function scoreRound<PlayerId extends string, CardId extends string | number>(input: {
  playerIds: PlayerId[];
  storytellerId: PlayerId;
  submissions: RoundSubmission<PlayerId, CardId>[];
  votes: RoundVote<PlayerId, CardId>[];
}): RoundScoreResult<PlayerId> {
  const story = input.submissions.find((submission) => submission.isStoryCard);
  if (!story) throw new Error("story_card_missing");

  const nonStorytellers = input.playerIds.filter((playerId) => playerId !== input.storytellerId);
  const correctVotes = input.votes.filter((vote) => vote.cardId === story.cardId);
  const allCorrect = correctVotes.length === nonStorytellers.length;
  const noneCorrect = correctVotes.length === 0;
  const events: ScoreEvent<PlayerId>[] = [];

  if (allCorrect || noneCorrect) {
    nonStorytellers.forEach((playerId) => {
      events.push({
        playerId,
        points: 2,
        reason: allCorrect ? "all_correct" : "none_correct"
      });
    });
  } else {
    events.push({ playerId: input.storytellerId, points: 3, reason: "storyteller_partial" });
    correctVotes.forEach((vote) => {
      events.push({ playerId: vote.voterId, points: 3, reason: "correct_vote" });
    });
  }

  input.votes.forEach((vote) => {
    const submission = input.submissions.find((candidate) => candidate.cardId === vote.cardId);
    if (submission && !submission.isStoryCard) {
      events.push({ playerId: submission.playerId, points: 1, reason: "decoy_vote" });
    }
  });

  return {
    outcome: allCorrect ? "all_correct" : noneCorrect ? "none_correct" : "partial_correct",
    correctVoteCount: correctVotes.length,
    events
  };
}

export function applyScoreEvents<PlayerId extends string>(
  scores: Record<PlayerId, number>,
  events: ScoreEvent<PlayerId>[]
) {
  const nextScores = { ...scores };
  events.forEach((event) => {
    nextScores[event.playerId] = (nextScores[event.playerId] ?? 0) + event.points;
  });
  return nextScores;
}

export function resolveWinners<PlayerId extends string>(
  playerIds: PlayerId[],
  scores: Record<PlayerId, number>,
  scoreLimit = DEFAULT_SCORE_LIMIT
) {
  const highestScore = Math.max(...playerIds.map((playerId) => scores[playerId] ?? 0));
  return {
    gameOver: highestScore >= scoreLimit,
    winnerIds:
      highestScore >= scoreLimit
        ? playerIds.filter((playerId) => (scores[playerId] ?? 0) === highestScore)
        : []
  };
}
