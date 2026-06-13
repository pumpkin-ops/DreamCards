import { Card, getCards, getDeck, incrementPlayed, markDiscovered, User } from "./db.js";

type PlayerId = string;
type MatchPhase = "awaiting_clue" | "awaiting_cards" | "awaiting_vote" | "revealed";

type QueueEntry = {
  user: User;
  deckId: number;
  joinedAt: number;
};

type Submission = {
  playerId: PlayerId;
  card: Card;
  isStoryCard: boolean;
};

type Vote = {
  voterId: PlayerId;
  cardId: number;
};

type MatchRoom = {
  id: string;
  players: Array<{
    id: PlayerId;
    userId: number;
    username: string;
    avatar: string;
    deckId: number;
    deckName: string;
  }>;
  phase: MatchPhase;
  roundNumber: number;
  storytellerIndex: number;
  clue: string;
  scores: Record<PlayerId, number>;
  gameOver: boolean;
  winnerIds: PlayerId[];
  hands: Record<PlayerId, Card[]>;
  drawPile: Card[];
  discardPile: Card[];
  recycleCount: number;
  submissions: Submission[];
  anonymousCards: Submission[];
  votes: Vote[];
};

const queue = new Map<number, QueueEntry>();
const rooms = new Map<string, MatchRoom>();
const playerRooms = new Map<number, string>();
const scoreLimit = 30;

export function joinMatchmaking(user: User, deckId: number) {
  if (playerRooms.has(user.id)) {
    return { status: "matched" as const, room: publicRoom(requirePlayerRoom(user.id), user.id) };
  }

  const deck = getDeck(deckId);
  if (!deck || deck.ownerId !== user.id) throw new Error("请选择自己的梦境集");
  if (deck.cards.length !== 10) throw new Error("参与匹配的梦境集需要正好 10 张作品");

  queue.set(user.id, { user, deckId, joinedAt: Date.now() });
  makeRooms();
  return getMatchmakingState(user.id);
}

export function leaveMatchmaking(userId: number) {
  if (playerRooms.has(userId)) throw new Error("对局已经开始，不能退出匹配队列");
  queue.delete(userId);
  return getMatchmakingState(userId);
}

export function getMatchmakingState(userId: number) {
  const roomId = playerRooms.get(userId);
  if (roomId) return { status: "matched" as const, room: publicRoom(requireRoom(roomId), userId) };

  const entries = [...queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  return {
    status: queue.has(userId) ? ("searching" as const) : ("idle" as const),
    queueSize: entries.length,
    players: entries.map((entry) => ({
      id: entry.user.id,
      username: entry.user.username,
      avatar: entry.user.avatar
    }))
  };
}

export function submitMultiplayerClue(userId: number, clueInput: string, cardId: number) {
  const room = requirePlayerRoom(userId);
  const playerId = String(userId);
  if (room.phase !== "awaiting_clue") throw new Error("当前不能提交提示");
  if (storytellerId(room) !== playerId) throw new Error("当前玩家不是说书人");

  const clue = clueInput.trim();
  if (!clue) throw new Error("提示词不能为空");
  const card = requireHandCard(room, playerId, cardId);
  consumeCard(room, playerId, card);
  room.clue = clue;
  room.submissions = [{ playerId, card, isStoryCard: true }];
  room.phase = "awaiting_cards";
  return publicRoom(room, userId);
}

export function submitMultiplayerCard(userId: number, cardId: number) {
  const room = requirePlayerRoom(userId);
  const playerId = String(userId);
  if (room.phase !== "awaiting_cards") throw new Error("当前不能提交作品");
  if (storytellerId(room) === playerId) throw new Error("说书人已经提交作品");
  if (room.submissions.some((submission) => submission.playerId === playerId)) {
    throw new Error("本轮已经提交过作品");
  }

  const card = requireHandCard(room, playerId, cardId);
  consumeCard(room, playerId, card);
  room.submissions.push({ playerId, card, isStoryCard: false });
  if (room.submissions.length === room.players.length) {
    room.anonymousCards = shuffle(room.submissions);
    room.phase = "awaiting_vote";
  }
  return publicRoom(room, userId);
}

export function submitMultiplayerVote(userId: number, cardId: number) {
  const room = requirePlayerRoom(userId);
  const playerId = String(userId);
  if (room.phase !== "awaiting_vote") throw new Error("当前不能投票");
  if (storytellerId(room) === playerId) throw new Error("说书人不参与投票");
  if (room.votes.some((vote) => vote.voterId === playerId)) throw new Error("本轮已经投过票");

  const target = room.anonymousCards.find((submission) => submission.card.id === cardId);
  if (!target) throw new Error("目标作品不存在");
  if (target.playerId === playerId) throw new Error("不能投自己的作品");

  room.votes.push({ voterId: playerId, cardId });
  if (room.votes.length === room.players.length - 1) revealRoom(room);
  return publicRoom(room, userId);
}

export function nextMultiplayerRound(userId: number) {
  const room = requirePlayerRoom(userId);
  if (room.phase !== "revealed") throw new Error("本轮尚未结算");
  if (room.gameOver) throw new Error("本局已经结束，不能开启下一轮");
  if (storytellerId(room) !== String(userId)) throw new Error("由本轮说书人开启下一轮");

  refillHands(room);
  room.roundNumber += 1;
  room.storytellerIndex = (room.storytellerIndex + 1) % room.players.length;
  room.phase = "awaiting_clue";
  room.clue = "";
  room.submissions = [];
  room.anonymousCards = [];
  room.votes = [];
  return publicRoom(room, userId);
}

function makeRooms() {
  const entries = [...queue.values()].sort((a, b) => a.joinedAt - b.joinedAt);
  while (entries.length >= 4) {
    const matched = entries.splice(0, 4);
    matched.forEach((entry) => queue.delete(entry.user.id));
    const decks = matched.map((entry) => getDeck(entry.deckId)!);
    const selectedCards = decks.flatMap((deck) => deck.cards);
    const uniqueCards = new Map(selectedCards.map((card) => [card.id, card]));
    getCards().forEach((card) => {
      if (uniqueCards.size < 40 && !uniqueCards.has(card.id)) uniqueCards.set(card.id, card);
    });
    if (uniqueCards.size < 24) throw new Error("作品库不足，至少需要 24 张不同作品才能开始对局");
    const pool = shuffle([...uniqueCards.values()].slice(0, 40));
    const players = matched.map((entry, index) => ({
      id: String(entry.user.id),
      userId: entry.user.id,
      username: entry.user.username,
      avatar: entry.user.avatar,
      deckId: entry.deckId,
      deckName: decks[index].name
    }));
    const hands: Record<string, Card[]> = {};
    players.forEach((player) => {
      hands[player.id] = pool.splice(0, 6);
    });

    const room: MatchRoom = {
      id: `match_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      players,
      phase: "awaiting_clue",
      roundNumber: 1,
      storytellerIndex: 0,
      clue: "",
      scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      gameOver: false,
      winnerIds: [],
      hands,
      drawPile: pool,
      discardPile: [],
      recycleCount: 0,
      submissions: [],
      anonymousCards: [],
      votes: []
    };
    rooms.set(room.id, room);
    players.forEach((player) => playerRooms.set(player.userId, room.id));
  }
}

function revealRoom(room: MatchRoom) {
  const story = room.submissions.find((submission) => submission.isStoryCard);
  if (!story) throw new Error("说书人的作品不存在");

  const correct = room.votes.filter((vote) => vote.cardId === story.card.id);
  const nonStorytellers = room.players
    .map((player) => player.id)
    .filter((id) => id !== storytellerId(room));

  if (correct.length === 0 || correct.length === nonStorytellers.length) {
    nonStorytellers.forEach((id) => {
      room.scores[id] += 2;
    });
  } else {
    room.scores[storytellerId(room)] += 3;
    correct.forEach((vote) => {
      room.scores[vote.voterId] += 3;
    });
  }

  room.votes.forEach((vote) => {
    const submission = room.submissions.find((item) => item.card.id === vote.cardId);
    if (submission && !submission.isStoryCard) room.scores[submission.playerId] += 1;
  });

  room.phase = "revealed";
  const highestScore = Math.max(...Object.values(room.scores));
  room.gameOver = highestScore >= scoreLimit;
  room.winnerIds = room.gameOver
    ? room.players.filter((player) => room.scores[player.id] === highestScore).map((player) => player.id)
    : [];
  incrementPlayed(room.submissions.map((submission) => submission.card.id));
  room.players.forEach((player) => {
    room.submissions.forEach((submission) => markDiscovered(player.userId, submission.card.id));
  });
}

function refillHands(room: MatchRoom) {
  room.players.forEach((player) => {
    while (room.hands[player.id].length < 6) {
      if (room.drawPile.length === 0) {
        if (room.discardPile.length === 0) break;
        room.drawPile = shuffle(room.discardPile);
        room.discardPile = [];
        room.recycleCount += 1;
      }
      const card = room.drawPile.shift();
      if (!card) break;
      room.hands[player.id].push(card);
    }
  });
}

function consumeCard(room: MatchRoom, playerId: string, card: Card) {
  room.hands[playerId] = room.hands[playerId].filter((item) => item.id !== card.id);
  room.discardPile.push(card);
}

function publicRoom(room: MatchRoom, userId: number) {
  const viewerId = String(userId);
  const revealed = room.phase === "revealed";
  const ownSubmission = room.submissions.find((submission) => submission.playerId === viewerId);
  return {
    id: room.id,
    phase: room.phase,
    roundNumber: room.roundNumber,
    storytellerId: storytellerId(room),
    clue: room.clue,
    players: room.players.map((player) => ({
      ...player,
      score: room.scores[player.id],
      submitted: room.submissions.some((submission) => submission.playerId === player.id),
      voted: room.votes.some((vote) => vote.voterId === player.id)
    })),
    hand: room.hands[viewerId].map(publicCard),
    submittedCardId: ownSubmission?.card.id,
    anonymousCards: room.anonymousCards.map((submission) => ({
      card: publicCard(submission.card),
      ...(revealed ? { playerId: submission.playerId, isStoryCard: submission.isStoryCard } : {})
    })),
    votes: revealed ? room.votes : [],
    gameOver: room.gameOver,
    winnerIds: room.winnerIds,
    scoreLimit,
    deckProgress: {
      drawPileCount: room.drawPile.length,
      discardPileCount: room.discardPile.length,
      recycleCount: room.recycleCount
    }
  };
}

function publicCard(card: Card) {
  const { tags: _tags, ...visible } = card;
  return visible;
}

function storytellerId(room: MatchRoom) {
  return room.players[room.storytellerIndex].id;
}

function requireHandCard(room: MatchRoom, playerId: string, cardId: number) {
  const card = room.hands[playerId]?.find((item) => item.id === cardId);
  if (!card) throw new Error("这张作品不在当前手牌中");
  return card;
}

function requirePlayerRoom(userId: number) {
  const roomId = playerRooms.get(userId);
  if (!roomId) throw new Error("尚未进入匹配房间");
  return requireRoom(roomId);
}

function requireRoom(roomId: string) {
  const room = rooms.get(roomId);
  if (!room) throw new Error("匹配房间不存在");
  return room;
}

function shuffle<T>(items: T[]) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}
