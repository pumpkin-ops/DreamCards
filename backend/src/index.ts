import express from "express";
import cors from "cors";
import multer from "multer";
import { mkdirSync, rmSync } from "node:fs";
import { extname, join } from "node:path";
import {
  addCardToDeck,
  Card,
  collectCard,
  createCard,
  Deck,
  createDeck,
  db,
  getCard,
  getCards,
  getCollections,
  getDeck,
  getDecks,
  getDiscoveries,
  getUserProfile,
  getUsers,
  incrementPlayed,
  initDatabase,
  markDiscovered,
  removeCardFromDeck,
  renameDeck,
  uncollectCard
} from "./db.js";
import {
  authenticateToken,
  extractBearerToken,
  loginDemoUser,
  loginLocalUser,
  registerLocalUser,
  revokeToken
} from "./auth.js";
import { chooseCardByClue, generateClue, getAiModelProfiles, voteCardByClue } from "../services/aiService.js";
import {
  getSinglePlayerSession,
  nextSinglePlayerRound,
  publicSession as publicSinglePlayerSession,
  startSinglePlayerGame,
  submitSinglePlayerClue,
  submitSinglePlayerPlayerCard,
  submitSinglePlayerVote
} from "./singlePlayer.js";
import {
  getMatchmakingState,
  joinMatchmaking,
  leaveMatchmaking,
  nextMultiplayerRound,
  submitMultiplayerCard,
  submitMultiplayerClue,
  submitMultiplayerVote
} from "./multiplayer.js";
import { generateCard } from "../../ai/generation/cardGenerationPipeline.js";
import {
  MAX_CARD_IMAGE_BYTES,
  moderateCardUpload,
  moderateGeneratedContent
} from "../../ai/moderation/cardModeration.js";
import { chooseFallbackCard } from "../../ai/fallback/fallbackPolicy.js";
import {
  CardIngestionRejectedError,
  ingestDreamCardImage
} from "../services/cardIngestionService.js";

export const app = express();
const port = Number(process.env.PORT ?? 4000);
const isServerless = Boolean(
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT
);
const uploadDir = isServerless ? "/tmp/dreamcards/uploads" : join(process.cwd(), "backend", "uploads");
const quarantineDir = isServerless ? "/tmp/dreamcards/quarantine" : join(process.cwd(), "backend", "quarantine");
mkdirSync(uploadDir, { recursive: true });
mkdirSync(quarantineDir, { recursive: true });

const storage = multer.diskStorage({
  destination: quarantineDir,
  filename: (_request, file, callback) => {
    const safeExt = extname(file.originalname).toLowerCase() || ".png";
    callback(null, `card-${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`);
  }
});
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_CARD_IMAGE_BYTES,
    files: 1
  },
  fileFilter: (_request, file, callback) => {
    const decision = moderateCardUpload({ mimeType: file.mimetype, size: 1 });
    if (decision.status === "allow") {
      callback(null, true);
      return;
    }
    callback(new Error("Unsupported image type"));
  }
});

initDatabase();

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(uploadDir));

app.get("/api/health", (_request, response) => {
  response.json({
    ok: true,
    aiConfigured: getAiModelProfiles().every((profile) => profile.configured)
  });
});

app.post("/api/auth/register", (request, response, next) => {
  try {
    response.status(201).json({
      ok: true,
      ...registerLocalUser(String(request.body.username ?? ""), String(request.body.password ?? ""))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/login", (request, response, next) => {
  try {
    response.json({
      ok: true,
      ...loginLocalUser(
        String(request.body.username ?? ""),
        String(request.body.password ?? ""),
        String(request.body.accountCredential ?? "")
      )
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/demo", (_request, response, next) => {
  try {
    response.json({
      ok: true,
      ...loginDemoUser()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/session", (request, response, next) => {
  try {
    response.json({ ok: true, user: requireAuthenticatedUser(request) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/auth/logout", (request, response) => {
  revokeToken(extractBearerToken(request.headers.authorization));
  response.json({ ok: true });
});

app.get("/api/bootstrap", (request, response) => {
  const activeUser = requireAuthenticatedUser(request);
  response.json(makeBootstrap(activeUser.id));
});

app.get("/api/cards/:id", (request, response) => {
  const card = getCard(Number(request.params.id));
  if (!card) {
    response.status(404).json({ error: "Card not found" });
    return;
  }
  response.json(publicCard(card));
});

app.post("/api/cards", upload.single("image"), async (request, response, next) => {
  try {
    const creatorId = requireAuthenticatedUser(request).id;
    if (!request.file) throw new Error("Image file is required");
    const tags = parseTagsInput(request.body.tags);
    const moderation = moderateCardUpload({
      mimeType: request.file.mimetype,
      size: request.file.size,
      tags
    });
    if (moderation.status !== "allow") {
      rmSync(request.file.path, { force: true });
      response.status(422).json({
        error: "Card upload rejected by moderation preflight",
        moderation
      });
      return;
    }

    const ingestion = await ingestDreamCardImage({
      sourcePath: request.file.path,
      mimeType: request.file.mimetype,
      uploadDir
    });
    const card = createCard(ingestion.imageUrl, creatorId, tags, {
      sourceType: ingestion.sourceType,
      moderationStatus: ingestion.moderationStatus,
      generationSource: ingestion.generationSource,
      styleVersion: ingestion.styleVersion
    });
    response.status(201).json({
      ok: true,
      card: publicCard(card),
      pipeline: ingestion
    });
  } catch (error) {
    if (request.file) rmSync(request.file.path, { force: true });
    if (error instanceof CardIngestionRejectedError) {
      response.status(422).json({
        error: error.message,
        review: error.review,
        stages: error.stages
      });
      return;
    }
    next(error);
  }
});

app.post("/api/collections", (request, response, next) => {
  try {
    const userId = requireAuthenticatedUser(request).id;
    const cardId = Number(request.body.cardId);
    collectCard(userId, cardId);
    response.json(makeBootstrap(userId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/collections", (request, response, next) => {
  try {
    const userId = requireAuthenticatedUser(request).id;
    const cardId = Number(request.body.cardId);
    uncollectCard(userId, cardId);
    response.json(makeBootstrap(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/discoveries", (request, response, next) => {
  try {
    const userId = requireAuthenticatedUser(request).id;
    const cardIds = (request.body.cardIds ?? []) as number[];
    cardIds.forEach((cardId) => markDiscovered(userId, Number(cardId)));
    response.json(makeBootstrap(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/decks", (request, response, next) => {
  try {
    const ownerId = requireAuthenticatedUser(request).id;
    const name = String(request.body.name ?? "未命名牌组").trim();
    createDeck(ownerId, name);
    response.status(201).json(makeBootstrap(ownerId));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/decks/:deckId", (request, response, next) => {
  try {
    const deckId = Number(request.params.deckId);
    const ownerId = requireAuthenticatedUser(request).id;
    requireDeckOwner(deckId, ownerId);
    const name = String(request.body.name ?? "未命名牌组").trim();
    const description = String(request.body.description ?? "").trim();
    renameDeck(deckId, name || "未命名梦境集", description);
    response.json(makeBootstrap(ownerId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/decks/:deckId/cards", (request, response, next) => {
  try {
    const deckId = Number(request.params.deckId);
    const ownerId = requireAuthenticatedUser(request).id;
    requireDeckOwner(deckId, ownerId);
    const cardId = Number(request.body.cardId);
    addCardToDeck(deckId, cardId);
    response.json(makeBootstrap(ownerId));
  } catch (error) {
    next(error);
  }
});

app.delete("/api/decks/:deckId/cards/:cardId", (request, response, next) => {
  try {
    const deckId = Number(request.params.deckId);
    const cardId = Number(request.params.cardId);
    const ownerId = requireAuthenticatedUser(request).id;
    requireDeckOwner(deckId, ownerId);
    removeCardFromDeck(deckId, cardId);
    response.json(makeBootstrap(ownerId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/game/played", (request, response, next) => {
  try {
    const userId = requireAuthenticatedUser(request).id;
    const cardIds = (request.body.cardIds ?? []) as number[];
    incrementPlayed(cardIds.map(Number));
    cardIds.forEach((cardId) => markDiscovered(userId, Number(cardId)));
    response.json(makeBootstrap(userId));
  } catch (error) {
    next(error);
  }
});

app.post("/api/ai/choose-card", async (request, response) => {
  const result = await chooseCardByClue(String(request.body.clue ?? ""), request.body.handCards ?? []);
  response.json({ ok: true, ...result });
});

app.post("/api/ai/generate-clue", async (request, response) => {
  const result = await generateClue(request.body.storytellerCard);
  response.json({ ok: true, ...result });
});

app.post("/api/ai/vote-card", async (request, response) => {
  const result = await voteCardByClue(
    String(request.body.clue ?? ""),
    request.body.candidateCards ?? [],
    String(request.body.ownCardId ?? "")
  );
  response.json({ ok: true, ...result });
});

app.post("/api/ai/generate-card", async (request, response) => {
  const mode = ["text", "image", "hybrid"].includes(String(request.body.mode))
    ? (request.body.mode as "text" | "image" | "hybrid")
    : "text";
  const artifact = await generateCard({
    mode,
    textPrompt: String(request.body.textPrompt ?? ""),
    imagePrompt: String(request.body.imagePrompt ?? "")
  });
  response
    .status(artifact.moderation.status === "reject" ? 422 : 200)
    .json({ ok: artifact.moderation.status !== "reject", artifact });
});

app.post("/api/ai/moderate", (request, response) => {
  const moderation = moderateGeneratedContent({
    prompt: String(request.body.prompt ?? ""),
    tags: Array.isArray(request.body.tags) ? request.body.tags.map(String) : [],
    nsfwScore: Number(request.body.nsfwScore ?? 0)
  });
  response.status(moderation.status === "reject" ? 422 : 200).json({ ok: moderation.status !== "reject", moderation });
});

app.post("/api/ai/fallback", (request, response) => {
  const cards = Array.isArray(request.body.cards) ? request.body.cards : [];
  const selected = chooseFallbackCard(
    String(request.body.clue ?? ""),
    cards,
    Array.isArray(request.body.excludedCardIds) ? request.body.excludedCardIds.map(String) : []
  );
  response.json({
    ok: true,
    cardId: selected?.id ?? "",
    source: "fallback"
  });
});

app.post("/api/single-player/start", async (request, response, next) => {
  try {
    const activeUserId = requireAuthenticatedUser(request).id;
    const deckId = request.body.deckId ? Number(request.body.deckId) : undefined;
    response.json({ ok: true, session: await startSinglePlayerGame(activeUserId, deckId) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/single-player/:sessionId", (request, response, next) => {
  try {
    requireSinglePlayerOwner(request, request.params.sessionId);
    const session = getSinglePlayerSession(request.params.sessionId);
    response.json({ ok: true, session: publicSinglePlayerSession(session!) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/single-player/submit-clue", async (request, response, next) => {
  try {
    requireSinglePlayerOwner(request, String(request.body.sessionId));
    response.json({
      ok: true,
      session: await submitSinglePlayerClue(
        String(request.body.sessionId),
        String(request.body.clue ?? ""),
        String(request.body.cardId ?? "")
      )
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/single-player/submit-vote", async (request, response, next) => {
  try {
    requireSinglePlayerOwner(request, String(request.body.sessionId));
    response.json({
      ok: true,
      session: await submitSinglePlayerVote(String(request.body.sessionId), String(request.body.votedCardId ?? ""))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/single-player/submit-player-card", async (request, response, next) => {
  try {
    requireSinglePlayerOwner(request, String(request.body.sessionId));
    response.json({
      ok: true,
      session: await submitSinglePlayerPlayerCard(String(request.body.sessionId), String(request.body.cardId ?? ""))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/single-player/next-round", async (request, response, next) => {
  try {
    requireSinglePlayerOwner(request, String(request.body.sessionId));
    response.json({
      ok: true,
      session: await nextSinglePlayerRound(String(request.body.sessionId))
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/matchmaking/status", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, state: getMatchmakingState(user.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/matchmaking/join", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, state: joinMatchmaking(user, Number(request.body.deckId)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/matchmaking/leave", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, state: leaveMatchmaking(user.id) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/multiplayer/clue", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({
      ok: true,
      room: submitMultiplayerClue(user.id, String(request.body.clue ?? ""), Number(request.body.cardId))
    });
  } catch (error) {
    next(error);
  }
});

app.post("/api/multiplayer/card", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, room: submitMultiplayerCard(user.id, Number(request.body.cardId)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/multiplayer/vote", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, room: submitMultiplayerVote(user.id, Number(request.body.cardId)) });
  } catch (error) {
    next(error);
  }
});

app.post("/api/multiplayer/next-round", (request, response, next) => {
  try {
    const user = requireAuthenticatedUser(request);
    response.json({ ok: true, room: nextMultiplayerRound(user.id) });
  } catch (error) {
    next(error);
  }
});

app.use((error: Error & { status?: number }, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  response.status(error.status ?? 400).json({ error: error.message });
});

if (!isServerless) {
  app.listen(port, () => {
    console.log(`DreamCards API listening at http://localhost:${port}`);
  });
}

export default app;

function makeBootstrap(activeUserId: number) {
  const cards = getCards();
  const discoveries = getDiscoveries(activeUserId);
  const collections = getCollections(activeUserId);
  const collectionIds = collections.map((card) => card.id);
  const discoveryIds = discoveries.map((card) => card.id);
  const totalCards = (db.prepare("select count(*) as count from cards").get() as { count: number }).count;

  return {
    users: getUsers(),
    activeUserId,
    cards: cards.map(publicCard),
    collections: collections.map(publicCard),
    collectionIds,
    discoveries: discoveries.map(publicCard),
    discoveryIds,
    decks: getDecks(activeUserId).map(publicDeck),
    roomDecks: getDecks().map(publicDeck),
    profile: publicProfile(getUserProfile(activeUserId)),
    codex: {
      discovered: discoveryIds.length,
      total: Math.max(totalCards, 10000),
      recent: discoveries.slice(0, 6).map(publicCard)
    }
  };
}

function requireAuthenticatedUser(request: express.Request) {
  const user = authenticateToken(extractBearerToken(request.headers.authorization));
  if (!user) throw Object.assign(new Error("请先登录"), { status: 401 });
  return user;
}

function requireDeckOwner(deckId: number, userId: number) {
  const deck = getDeck(deckId);
  if (!deck || deck.ownerId !== userId) {
    throw Object.assign(new Error("不能修改其他玩家的牌组"), { status: 403 });
  }
}

function requireSinglePlayerOwner(request: express.Request, sessionId: string) {
  const user = requireAuthenticatedUser(request);
  const session = getSinglePlayerSession(sessionId);
  if (!session || session.activeUserId !== user.id) {
    throw Object.assign(new Error("对局不存在或不属于当前用户"), { status: 403 });
  }
}

function publicCard(card: Card) {
  const { tags: _tags, ...visibleCard } = card;
  return visibleCard;
}

function publicDeck(deck: Deck) {
  return {
    ...deck,
    cards: deck.cards.map(publicCard)
  };
}

function publicProfile(profile: ReturnType<typeof getUserProfile>) {
  return {
    ...profile,
    topCard: profile.topCard ? publicCard(profile.topCard) : undefined
  };
}

function parseTagsInput(value: unknown) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map(String);
  return String(value)
    .split(/[,，。\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}

