export type User = {
  id: number;
  username: string;
  avatar: string;
  createdAt?: string;
};

export type AuthUser = Required<Pick<User, "id" | "username" | "avatar">> & {
  createdAt: string;
};

export type Card = {
  id: number;
  cardId: string;
  imageUrl: string;
  creatorId: number;
  creatorName: string;
  creatorSequence: number;
  createdAt: string;
  timesPlayed: number;
  timesCollected: number;
  timesDiscovered: number;
  sourceType: "official" | "user-ai-restyled" | "ai-generated";
  moderationStatus: "approved" | "review" | "rejected";
  generationSource: "none" | "image-model" | "local-style-fallback";
  styleVersion: string;
  discoveredAt?: string;
  collectedAt?: string;
};

export type CardPipelineStage = {
  id: "preflight" | "source_review" | "style_generation" | "result_review" | "published";
  status: "passed" | "fallback" | "rejected";
  detail: string;
};

export type CardUploadResult = {
  ok: boolean;
  card: Card;
  pipeline: {
    imageUrl: string;
    generationSource: "image-model" | "local-style-fallback";
    moderationStatus: "approved";
    styleVersion: string;
    stages: CardPipelineStage[];
  };
};

export type Deck = {
  id: number;
  ownerId: number;
  ownerName: string;
  name: string;
  description: string;
  createdAt: string;
  timesCollected: number;
  cards: Card[];
};

export type Profile = {
  user: User;
  createdCount: number;
  collectedCount: number;
  topCard?: Card;
};

export type Bootstrap = {
  users: User[];
  activeUserId: number;
  cards: Card[];
  collections: Card[];
  collectionIds: number[];
  discoveries: Card[];
  discoveryIds: number[];
  decks: Deck[];
  roomDecks: Deck[];
  profile: Profile;
  codex: {
    discovered: number;
    total: number;
    recent: Card[];
  };
};

export type RoomPlayer = {
  id: "A" | "B" | "C" | "D";
  userId: number;
  deckId: number;
};

export type GameSubmission = {
  playerId: RoomPlayer["id"];
  card: Card;
  isStoryCard: boolean;
};

export type GameVote = {
  voterId: RoomPlayer["id"];
  submissionIndex: number;
};

export type GameRound = {
  storytellerId: RoomPlayer["id"];
  clue: string;
  submissions: GameSubmission[];
  anonymousCards: GameSubmission[];
  votes: GameVote[];
  revealed: boolean;
  discoveredCards: Card[];
};

export type SinglePlayerId = "you" | "AI_Alice" | "AI_Bob" | "AI_Carol";

export type SinglePlayerCard = {
  id: string;
  cardId?: string;
  dbId: number;
  creatorName: string;
  creatorSequence?: number;
  imageUrl: string;
  createdAt?: string;
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
  deckProgress: {
    handCount: number;
    drawPileCount: number;
    discardPileCount: number;
    recycleCount: number;
  };
  submissions: SinglePlayerSubmission[];
  anonymousCards: SinglePlayerSubmission[];
  votes: SinglePlayerVote[];
  voteStatus: SinglePlayerId[];
  scoreEvents: SinglePlayerScoreEvent[];
  aiClue?: {
    clue: string;
    reason: string;
    source: "model" | "fallback";
  };
  result: null | {
    storyCardId?: string;
    scoreEvents: SinglePlayerScoreEvent[];
    scores: Record<SinglePlayerId, number>;
    correctVotes: number;
    gameOver: boolean;
    winnerIds: SinglePlayerId[];
    scoreLimit: number;
  };
};

export type MultiplayerPlayer = {
  id: string;
  userId: number;
  username: string;
  avatar: string;
  deckId: number;
  deckName: string;
  score: number;
  submitted: boolean;
  voted: boolean;
};

export type MultiplayerRoom = {
  id: string;
  phase: "awaiting_clue" | "awaiting_cards" | "awaiting_vote" | "revealed";
  roundNumber: number;
  storytellerId: string;
  clue: string;
  players: MultiplayerPlayer[];
  hand: Card[];
  submittedCardId?: number;
  anonymousCards: Array<{
    card: Card;
    playerId?: string;
    isStoryCard?: boolean;
  }>;
  votes: Array<{ voterId: string; cardId: number }>;
  gameOver: boolean;
  winnerIds: string[];
  scoreLimit: number;
  deckProgress: {
    drawPileCount: number;
    discardPileCount: number;
    recycleCount: number;
  };
};

export type MatchmakingState =
  | {
      status: "idle";
      queueSize: number;
      players: Array<{ id: number; username: string; avatar: string }>;
    }
  | {
      status: "searching";
      queueSize: number;
      players: Array<{ id: number; username: string; avatar: string }>;
    }
  | {
      status: "matched";
      room: MultiplayerRoom;
    };
