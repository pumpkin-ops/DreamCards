import { Card, Deck, GameRound, GameSubmission, GameVote, RoomPlayer } from "./types";

export function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

export function buildPool(players: RoomPlayer[], decks: Deck[]) {
  return players.flatMap((player) => decks.find((deck) => deck.id === player.deckId)?.cards ?? []);
}

export function createEmptyRound(storytellerId: RoomPlayer["id"]): GameRound {
  return {
    storytellerId,
    clue: "",
    submissions: [],
    anonymousCards: [],
    votes: [],
    revealed: false,
    discoveredCards: []
  };
}

export function submitCard(round: GameRound, playerId: RoomPlayer["id"], card: Card) {
  const nextSubmission: GameSubmission = {
    playerId,
    card,
    isStoryCard: playerId === round.storytellerId
  };
  const submissions = [...round.submissions.filter((submission) => submission.playerId !== playerId), nextSubmission];
  return {
    ...round,
    submissions
  };
}

export function anonymize(round: GameRound) {
  return {
    ...round,
    anonymousCards: shuffle(round.submissions)
  };
}

export function castVote(round: GameRound, vote: GameVote) {
  if (vote.voterId === round.storytellerId) {
    return round;
  }

  const submission = round.anonymousCards[vote.submissionIndex];
  if (!submission || submission.playerId === vote.voterId) {
    return round;
  }

  return {
    ...round,
    votes: [...round.votes.filter((item) => item.voterId !== vote.voterId), vote]
  };
}

export function revealRound(round: GameRound) {
  return {
    ...round,
    revealed: true,
    discoveredCards: round.anonymousCards.map((submission) => submission.card)
  };
}
