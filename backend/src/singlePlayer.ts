import { Card, Deck, getCard, getCards, getDeck, getDecks, incrementPlayed, markDiscovered } from "./db.js";
import {
  AiCard,
  AiPlayerId,
  chooseCardByClue,
  generateFallbackClue,
  getAiModelProfiles,
  voteCardByClue
} from "../services/aiService.js";
import {
  applyScoreEvents,
  DEFAULT_SCORE_LIMIT,
  resolveWinners,
  scoreRound,
  transitionRound,
  validateVote
} from "../../core/index.js";

export type SinglePlayerId = "you" | "AI_Alice" | "AI_Bob" | "AI_Carol";
export const singlePlayerScoreLimit = DEFAULT_SCORE_LIMIT;

export type SinglePlayerCard = AiCard & {
  dbId: number;
};

export type SinglePlayerSubmission = {
  playerId: SinglePlayerId;
  card: SinglePlayerCard;
  isStoryCard: boolean;
  reason: string;
  source: "model" | "fallback" | "human";
};

export type SinglePlayerVote = {
  voterId: SinglePlayerId;
  votedCardId: string;
  reason: string;
  source: "model" | "fallback" | "human";
};

export type SinglePlayerScoreEvent = {
  playerId: SinglePlayerId;
  points: number;
  reason: string;
};

export type SinglePlayerSession = {
  id: string;
  phase: "awaiting_clue" | "awaiting_player_card" | "awaiting_cards" | "awaiting_vote" | "revealed";
  activeUserId: number;
  roundNumber: number;
  players: Array<{
    id: SinglePlayerId;
    name: string;
    isAI: boolean;
    deckName: string;
    aiProvider?: string;
    aiModel?: string;
    aiModelLabel?: string;
    aiConfigured?: boolean;
    vision?: boolean;
  }>;
  storytellerId: SinglePlayerId;
  clue: string;
  scores: Record<SinglePlayerId, number>;
  gameOver: boolean;
  winnerIds: SinglePlayerId[];
  playerHand: SinglePlayerCard[];
  playerDrawPile: SinglePlayerCard[];
  playerDiscardPile: SinglePlayerCard[];
  playerRecycleCount: number;
  aiHands: Record<Exclude<SinglePlayerId, "you">, SinglePlayerCard[]>;
  aiDrawPiles: Record<Exclude<SinglePlayerId, "you">, SinglePlayerCard[]>;
  aiDiscardPiles: Record<Exclude<SinglePlayerId, "you">, SinglePlayerCard[]>;
  aiRecycleCounts: Record<Exclude<SinglePlayerId, "you">, number>;
  submissions: SinglePlayerSubmission[];
  anonymousCards: SinglePlayerSubmission[];
  votes: SinglePlayerVote[];
  scoreEvents: SinglePlayerScoreEvent[];
  aiClue?: {
    clue: string;
    reason: string;
    source: "model" | "fallback";
  };
};

const playerOrder: SinglePlayerId[] = ["you", "AI_Alice", "AI_Bob", "AI_Carol"];
const aiIds: Array<Exclude<SinglePlayerId, "you">> = ["AI_Alice", "AI_Bob", "AI_Carol"];
const sessions = new Map<string, SinglePlayerSession>();
const pendingAiCards = new Map<string, Set<Exclude<SinglePlayerId, "you">>>();
const pendingAiVotes = new Map<string, Set<Exclude<SinglePlayerId, "you">>>();

export function getSinglePlayerSession(sessionId: string) {
  return sessions.get(sessionId);
}

export async function startSinglePlayerGame(activeUserId: number, deckId?: number) {
  const humanDeck = pickHumanDeck(activeUserId, deckId);
  const aiDecks = pickAiDecks();
  const uniqueDeckCards = allocateUniqueDeckCards(humanDeck, aiDecks);
  const humanCards = shuffle(toSingleCards(uniqueDeckCards.you));
  const aliceCards = shuffle(toSingleCards(uniqueDeckCards.AI_Alice));
  const bobCards = shuffle(toSingleCards(uniqueDeckCards.AI_Bob));
  const carolCards = shuffle(toSingleCards(uniqueDeckCards.AI_Carol));
  const profiles = Object.fromEntries(getAiModelProfiles().map((profile) => [profile.playerId, profile])) as Record<
    AiPlayerId,
    ReturnType<typeof getAiModelProfiles>[number]
  >;
  const session: SinglePlayerSession = {
    id: `single_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    phase: "awaiting_clue",
    activeUserId,
    roundNumber: 1,
    players: [
      { id: "you", name: "你", isAI: false, deckName: humanDeck.name },
      aiPlayer("AI_Alice", aiDecks.AI_Alice.name, profiles.AI_Alice),
      aiPlayer("AI_Bob", aiDecks.AI_Bob.name, profiles.AI_Bob),
      aiPlayer("AI_Carol", aiDecks.AI_Carol.name, profiles.AI_Carol)
    ],
    storytellerId: "you",
    clue: "",
    scores: { you: 0, AI_Alice: 0, AI_Bob: 0, AI_Carol: 0 },
    gameOver: false,
    winnerIds: [],
    playerHand: humanCards.slice(0, 6),
    playerDrawPile: humanCards.slice(6),
    playerDiscardPile: [],
    playerRecycleCount: 0,
    aiHands: {
      AI_Alice: aliceCards.slice(0, 6),
      AI_Bob: bobCards.slice(0, 6),
      AI_Carol: carolCards.slice(0, 6)
    },
    aiDrawPiles: {
      AI_Alice: aliceCards.slice(6),
      AI_Bob: bobCards.slice(6),
      AI_Carol: carolCards.slice(6)
    },
    aiDiscardPiles: {
      AI_Alice: [],
      AI_Bob: [],
      AI_Carol: []
    },
    aiRecycleCounts: {
      AI_Alice: 0,
      AI_Bob: 0,
      AI_Carol: 0
    },
    submissions: [],
    anonymousCards: [],
    votes: [],
    scoreEvents: []
  };

  sessions.set(session.id, session);
  return publicSession(session);
}

export async function submitSinglePlayerClue(sessionId: string, clue: string, cardId: string) {
  const session = requireSession(sessionId);
  if (session.storytellerId !== "you" || session.phase !== "awaiting_clue") {
    throw new Error("当前说书人不是玩家，请先提交玩家跟牌。");
  }
  const storyCard = session.playerHand.find((card) => card.id === cardId) ?? session.playerHand[0];
  if (!storyCard) throw new Error("没有可用手牌。");
  const submission: SinglePlayerSubmission = {
    playerId: "you",
    card: storyCard,
    isStoryCard: true,
    reason: "玩家选择的说书人卡牌。",
    source: "human"
  };

  session.phase = transitionRound(session.phase, "awaiting_cards");
  session.clue = clue;
  session.submissions = [submission];
  session.anonymousCards = [];
  session.votes = [];
  session.scoreEvents = [];
  consumeSubmission(session, submission);
  sessions.set(session.id, session);
  primeAiCards(session);
  return publicSession(session);
}

export async function submitSinglePlayerPlayerCard(sessionId: string, cardId: string) {
  const session = requireSession(sessionId);
  if (session.storytellerId === "you" || session.phase !== "awaiting_player_card") {
    throw new Error("玩家是说书人时不需要跟牌。");
  }
  const card = session.playerHand.find((item) => item.id === cardId) ?? session.playerHand[0];
  if (!card) throw new Error("没有可用手牌。");
  const submission: SinglePlayerSubmission = {
    playerId: "you",
    card,
    isStoryCard: false,
    reason: "玩家根据 AI 说书人的提示选择了这张牌。",
    source: "human"
  };

  session.phase = transitionRound(session.phase, "awaiting_cards");
  session.submissions = [...session.submissions, submission];
  session.anonymousCards = [];
  session.votes = [];
  session.scoreEvents = [];
  consumeSubmission(session, submission);
  sessions.set(session.id, session);
  primeAiCards(session);
  return publicSession(session);
}

function primeAiCards(session: SinglePlayerSession) {
  const activePlayers = new Set(
    aiIds.filter(
      (aiId) =>
        aiId !== session.storytellerId &&
        !session.submissions.some((submission) => submission.playerId === aiId)
    )
  );
  pendingAiCards.set(session.id, activePlayers);
  activePlayers.forEach((aiId) => {
    void createAiCard(session, aiId);
  });
}

async function createAiCard(session: SinglePlayerSession, aiId: Exclude<SinglePlayerId, "you">) {
  const hand = session.aiHands[aiId];
  const choice = await chooseCardByClue(session.clue, hand, aiId);
  if (session.phase !== "awaiting_cards") return;

  const card = hand.find((item) => item.id === choice.cardId) ?? hand[Math.floor(Math.random() * hand.length)];
  if (!card || session.submissions.some((submission) => submission.playerId === aiId)) return;

  const submission: SinglePlayerSubmission = {
    playerId: aiId,
    card,
    isStoryCard: false,
    reason: choice.reason,
    source: choice.source
  };
  session.submissions.push(submission);
  consumeSubmission(session, submission);
  pendingAiCards.get(session.id)?.delete(aiId);
  finalizeCardsIfReady(session);
}

function finalizeCardsIfReady(session: SinglePlayerSession) {
  if (session.phase !== "awaiting_cards" || session.submissions.length !== playerOrder.length) return;
  pendingAiCards.delete(session.id);
  session.phase = transitionRound(session.phase, "awaiting_vote");
  session.anonymousCards = shuffle(session.submissions);
  session.votes = [];
  sessions.set(session.id, session);
  primeAiVotes(session);
}

export async function submitSinglePlayerVote(sessionId: string, votedCardId: string) {
  const session = requireSession(sessionId);

  if (session.storytellerId !== "you") {
    if (session.votes.some((vote) => vote.voterId === "you")) {
      return publicSession(session);
    }
    const validation = validateVote({
      voterId: "you",
      storytellerId: session.storytellerId,
      targetCardId: votedCardId,
      submissions: session.anonymousCards.map((submission) => ({
        playerId: submission.playerId,
        cardId: submission.card.id
      })),
      existingVoterIds: session.votes.map((vote) => vote.voterId)
    });
    if (!validation.valid) throw new Error("玩家不能投自己的牌，也不能投不存在的牌。");
    session.votes.push({
      voterId: "you",
      votedCardId,
      reason: "玩家投票。",
      source: "human"
    });
  }

  finalizeVotesIfReady(session);
  return publicSession(session);
}

function primeAiVotes(session: SinglePlayerSession) {
  const activeVoters = new Set(aiIds.filter((aiId) => aiId !== session.storytellerId));
  pendingAiVotes.set(session.id, activeVoters);

  activeVoters.forEach((aiId) => {
    void createAiVote(session, aiId);
  });
}

async function createAiVote(session: SinglePlayerSession, aiId: Exclude<SinglePlayerId, "you">) {
  const ownSubmission = session.submissions.find((submission) => submission.playerId === aiId);
  const vote = await voteCardByClue(
    session.clue,
    session.anonymousCards.map((submission) => submission.card),
    ownSubmission?.card.id ?? "",
    aiId
  );

  if (session.phase !== "awaiting_vote") return;
  if (!session.votes.some((item) => item.voterId === aiId)) {
    session.votes.push({
      voterId: aiId,
      votedCardId: vote.votedCardId,
      reason: vote.reason,
      source: vote.source
    });
  }
  pendingAiVotes.get(session.id)?.delete(aiId);
  finalizeVotesIfReady(session);
}

function finalizeVotesIfReady(session: SinglePlayerSession) {
  if (session.phase !== "awaiting_vote") return;
  const requiredVoters = playerOrder.filter((playerId) => playerId !== session.storytellerId);
  if (!requiredVoters.every((playerId) => session.votes.some((vote) => vote.voterId === playerId))) return;

  pendingAiVotes.delete(session.id);
  session.phase = transitionRound(session.phase, "revealed");
  applyScore(session);
  updateGameOutcome(session);
  const playedIds = session.submissions
    .map((submission) => submission.card.dbId)
    .filter((id) => Boolean(getCard(id)));
  incrementPlayed(playedIds);
  playedIds.forEach((id) => markDiscovered(session.activeUserId, id));
  sessions.set(session.id, session);
}

export async function nextSinglePlayerRound(sessionId: string) {
  const session = requireSession(sessionId);
  if (session.phase !== "revealed") {
    throw new Error("当前回合尚未结算，不能进入下一轮。");
  }
  if (session.gameOver) {
    throw new Error("本局已经结束，不能进入下一轮。");
  }
  const nextStorytellerId = playerOrder[(playerOrder.indexOf(session.storytellerId) + 1) % playerOrder.length];

  refillHands(session);
  session.roundNumber += 1;
  session.storytellerId = nextStorytellerId;
  session.clue = "";
  session.submissions = [];
  session.anonymousCards = [];
  session.votes = [];
  session.scoreEvents = [];
  session.aiClue = undefined;
  pendingAiCards.delete(session.id);
  pendingAiVotes.delete(session.id);

  if (nextStorytellerId === "you") {
    session.phase = transitionRound(session.phase, "awaiting_clue");
  } else {
    const hand = session.aiHands[nextStorytellerId];
    const storyCard = hand[Math.floor(Math.random() * hand.length)];
    if (!storyCard) throw new Error("AI 说书人没有可用手牌。");

    const localClue = generateFallbackClue(storyCard);
    session.phase = transitionRound(session.phase, "awaiting_player_card");
    session.clue = localClue.clue;
    session.aiClue = localClue;
    session.submissions = [
      {
        playerId: nextStorytellerId,
        card: storyCard,
        isStoryCard: true,
        reason: localClue.reason,
        source: localClue.source
      }
    ];
    consumeSubmission(session, session.submissions[0]);
  }

  sessions.set(session.id, session);
  return publicSession(session);
}

export function publicSession(session: SinglePlayerSession) {
  const storyCardId = session.submissions.find((submission) => submission.isStoryCard)?.card.id;
  return {
    ...session,
    aiHands: undefined,
    aiDrawPiles: undefined,
    aiDiscardPiles: undefined,
    aiRecycleCounts: undefined,
    playerDrawPile: undefined,
    playerDiscardPile: undefined,
    playerRecycleCount: undefined,
    playerHand: session.playerHand.map(publicSingleCard),
    deckProgress: {
      handCount: session.playerHand.length,
      drawPileCount: session.playerDrawPile.length,
      discardPileCount: session.playerDiscardPile.length,
      recycleCount: session.playerRecycleCount
    },
    submissions: session.submissions.map(publicSubmission),
    anonymousCards: session.anonymousCards.map(publicSubmission),
    votes: session.phase === "revealed" ? session.votes : [],
    voteStatus: session.votes.map((vote) => vote.voterId),
    result:
      session.phase === "revealed"
        ? {
            storyCardId,
            scoreEvents: session.scoreEvents,
            scores: session.scores,
            correctVotes: session.votes.filter((vote) => vote.votedCardId === storyCardId).length,
            gameOver: session.gameOver,
            winnerIds: session.winnerIds,
            scoreLimit: singlePlayerScoreLimit
          }
        : null
  };
}

function publicSubmission(submission: SinglePlayerSubmission) {
  return {
    ...submission,
    card: publicSingleCard(submission.card)
  };
}

function publicSingleCard(card: SinglePlayerCard) {
  const { tags: _tags, ...visibleCard } = card;
  return visibleCard;
}

function applyScore(session: SinglePlayerSession) {
  const result = scoreRound({
    playerIds: playerOrder,
    storytellerId: session.storytellerId,
    submissions: session.submissions.map((submission) => ({
      playerId: submission.playerId,
      cardId: submission.card.id,
      isStoryCard: submission.isStoryCard
    })),
    votes: session.votes.map((vote) => ({ voterId: vote.voterId, cardId: vote.votedCardId }))
  });
  session.scores = applyScoreEvents(session.scores, result.events);
  const reasons = {
    all_correct: "所有非说书人都猜中",
    none_correct: "无人猜中说书人的牌",
    storyteller_partial: "部分玩家猜中，说书人得分",
    correct_vote: "猜中说书人的牌",
    decoy_vote: "自己的牌获得一票"
  };
  session.scoreEvents = result.events.map((event) => ({ ...event, reason: reasons[event.reason] }));
}

function updateGameOutcome(session: SinglePlayerSession) {
  const outcome = resolveWinners(playerOrder, session.scores, singlePlayerScoreLimit);
  session.gameOver = outcome.gameOver;
  session.winnerIds = outcome.winnerIds;
}

function requireSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("对局会话已失效，请重新开始一局。");
  return session;
}

function consumeSubmission(session: SinglePlayerSession, submission: SinglePlayerSubmission) {
  if (submission.playerId === "you") {
    session.playerHand = session.playerHand.filter((card) => card.id !== submission.card.id);
    if (!session.playerDiscardPile.some((card) => card.id === submission.card.id)) {
      session.playerDiscardPile.push(submission.card);
    }
    return;
  }

  session.aiHands[submission.playerId] = session.aiHands[submission.playerId].filter(
    (card) => card.id !== submission.card.id
  );
  if (!session.aiDiscardPiles[submission.playerId].some((card) => card.id === submission.card.id)) {
    session.aiDiscardPiles[submission.playerId].push(submission.card);
  }
}

function refillHands(session: SinglePlayerSession) {
  session.playerRecycleCount += refillHand(
    session.playerHand,
    session.playerDrawPile,
    session.playerDiscardPile
  );

  for (const aiId of aiIds) {
    session.aiRecycleCounts[aiId] += refillHand(
      session.aiHands[aiId],
      session.aiDrawPiles[aiId],
      session.aiDiscardPiles[aiId]
    );
  }
}

function refillHand(
  hand: SinglePlayerCard[],
  drawPile: SinglePlayerCard[],
  discardPile: SinglePlayerCard[]
) {
  let recycleCount = 0;

  while (hand.length < 6) {
    if (drawPile.length === 0) {
      if (discardPile.length === 0) break;
      drawPile.push(...shuffle(discardPile));
      discardPile.length = 0;
      recycleCount += 1;
    }

    const nextCard = drawPile.shift();
    if (!nextCard) break;
    hand.push(nextCard);
  }

  return recycleCount;
}

function pickHumanDeck(activeUserId: number, deckId?: number): Deck {
  const explicit = deckId ? getDeck(deckId) : undefined;
  if (explicit && explicit.cards.length >= 6) return explicit;
  const owned = getDecks(activeUserId).find((deck) => deck.cards.length >= 6);
  if (owned) return owned;
  return { id: 0, ownerId: activeUserId, ownerName: "你", name: "默认梦境集", description: "", createdAt: new Date().toISOString(), timesCollected: 0, cards: ensureCards().slice(0, 10) };
}

function aiPlayer(
  id: AiPlayerId,
  deckName: string,
  profile: ReturnType<typeof getAiModelProfiles>[number]
) {
  return {
    id,
    name: id,
    isAI: true,
    deckName,
    aiProvider: profile.provider,
    aiModel: profile.model,
    aiModelLabel: profile.label,
    aiConfigured: profile.configured,
    vision: profile.vision
  };
}

function pickAiDecks() {
  const decks = getDecks().filter((deck) => deck.cards.length >= 6);
  const cards = ensureCards();
  return {
    AI_Alice: decks.find((deck) => deck.ownerId === 2) ?? { id: 0, ownerId: 2, ownerName: "AI_Alice", name: "Alice 的梦境集", description: "", createdAt: new Date().toISOString(), timesCollected: 0, cards: cards.slice(10, 20) },
    AI_Bob: decks.find((deck) => deck.ownerId === 3) ?? { id: 0, ownerId: 3, ownerName: "AI_Bob", name: "Bob 的梦境集", description: "", createdAt: new Date().toISOString(), timesCollected: 0, cards: cards.slice(20, 30) },
    AI_Carol: decks.find((deck) => deck.ownerId === 4) ?? { id: 0, ownerId: 4, ownerName: "AI_Carol", name: "Carol 的梦境集", description: "", createdAt: new Date().toISOString(), timesCollected: 0, cards: cards.slice(30, 40) }
  };
}

function allocateUniqueDeckCards(
  humanDeck: Deck,
  aiDecks: ReturnType<typeof pickAiDecks>
): Record<SinglePlayerId, Card[]> {
  const library = uniqueCardsByArtwork([...ensureCards(), ...mockCards(0)]);
  const usedCardIds = new Set<string>();
  const usedImages = new Set<string>();

  const allocate = (preferred: Card[]) => {
    const selected: Card[] = [];
    const candidates = uniqueCardsByArtwork([...preferred, ...library]);

    for (const card of candidates) {
      const imageKey = normalizeArtworkKey(card.imageUrl);
      if (usedCardIds.has(card.cardId) || usedImages.has(imageKey)) continue;
      selected.push(card);
      usedCardIds.add(card.cardId);
      usedImages.add(imageKey);
      if (selected.length === 10) break;
    }

    if (selected.length < 10) {
      throw new Error("可用的不重复卡牌不足 40 张，请补充梦境库。");
    }
    return selected;
  };

  return {
    you: allocate(humanDeck.cards),
    AI_Alice: allocate(aiDecks.AI_Alice.cards),
    AI_Bob: allocate(aiDecks.AI_Bob.cards),
    AI_Carol: allocate(aiDecks.AI_Carol.cards)
  };
}

function uniqueCardsByArtwork(cards: Card[]) {
  const cardIds = new Set<string>();
  const images = new Set<string>();
  return cards.filter((card) => {
    const imageKey = normalizeArtworkKey(card.imageUrl);
    if (cardIds.has(card.cardId) || images.has(imageKey)) return false;
    cardIds.add(card.cardId);
    images.add(imageKey);
    return true;
  });
}

function normalizeArtworkKey(imageUrl: string) {
  return imageUrl.trim().toLowerCase().replace(/\\/g, "/");
}

function ensureCards() {
  const cards = getCards();
  if (cards.length >= 40) return cards;
  return [...cards, ...mockCards(cards.length)];
}

function toSingleCards(cards: Card[]): SinglePlayerCard[] {
  return cards.map((card) => ({
    id: card.cardId,
    cardId: card.cardId,
    dbId: card.id,
    tags: card.tags,
    creatorName: card.creatorName,
    creatorSequence: card.creatorSequence,
    imageUrl: card.imageUrl,
    createdAt: card.createdAt
  }));
}

function mockCards(offset: number): Card[] {
  const fallbackImages = [
    "/uploads/dream-fallback-1.svg",
    "/uploads/dream-fallback-2.svg",
    "/uploads/dream-fallback-3.svg",
    "/uploads/dream-fallback-4.svg"
  ];
  return Array.from({ length: Math.max(0, 40 - offset) }, (_, index) => {
    const sequence = offset + index + 1;
    const imageUrl = sequence <= 36
      ? `/uploads/dream-${String(sequence).padStart(2, "0")}.webp`
      : fallbackImages[sequence - 37];
    return {
    id: 10000 + offset + index,
    cardId: `mock_${sequence}`,
    imageUrl,
    creatorId: 1,
    creatorName: "MockCreator",
    creatorSequence: offset + index + 1,
    createdAt: "2026-06-04",
    timesPlayed: 0,
    timesCollected: 0,
    timesDiscovered: 0,
    tags: ["梦境", "幻想"],
    sourceType: "official",
    moderationStatus: "approved",
    generationSource: "none",
    styleVersion: ""
  };
  });
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}
