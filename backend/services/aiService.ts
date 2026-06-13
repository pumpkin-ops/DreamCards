import "dotenv/config";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import { chooseFallbackCard, generateFallbackClueForCard } from "../../ai/fallback/fallbackPolicy.js";

export type AiPlayerId = "AI_Alice" | "AI_Bob" | "AI_Carol";

export type AiCard = {
  id: string;
  cardId?: string;
  tags?: string[];
  creatorName: string;
  creatorSequence?: number;
  imageUrl: string;
  createdAt?: string;
};

export type ChooseCardResult = {
  cardId: string;
  reason: string;
  source: "model" | "fallback";
};

export type GenerateClueResult = {
  clue: string;
  reason: string;
  source: "model" | "fallback";
};

export type VoteCardResult = {
  votedCardId: string;
  reason: string;
  source: "model" | "fallback";
};

export type AiModelProfile = {
  playerId: AiPlayerId;
  provider: "GitHub Models";
  model: string;
  label: string;
  configured: boolean;
  vision: true;
};

type VisualContent = OpenAI.Chat.Completions.ChatCompletionContentPart;

const githubToken = process.env.GITHUB_MODELS_TOKEN;
const githubBaseUrl = process.env.GITHUB_MODELS_BASE_URL ?? "https://models.github.ai/inference";
const modelTimeoutMs = Number(process.env.AI_TIMEOUT_MS ?? 9000);
const imageDataCache = new Map<string, Promise<string>>();

const modelProfiles: Record<AiPlayerId, Omit<AiModelProfile, "configured">> = {
  AI_Alice: {
    playerId: "AI_Alice",
    provider: "GitHub Models",
    model: process.env.AI_ALICE_MODEL ?? "openai/gpt-4.1-mini",
    label: "GPT-4.1 mini Vision",
    vision: true
  },
  AI_Bob: {
    playerId: "AI_Bob",
    provider: "GitHub Models",
    model: process.env.AI_BOB_MODEL ?? "mistral-ai/mistral-small-2503",
    label: "Mistral Small 3.1 Vision",
    vision: true
  },
  AI_Carol: {
    playerId: "AI_Carol",
    provider: "GitHub Models",
    model: process.env.AI_CAROL_MODEL ?? "microsoft/phi-4-multimodal-instruct",
    label: "Phi-4 Multimodal",
    vision: true
  }
};

const githubClient = githubToken
  ? new OpenAI({
      apiKey: githubToken,
      baseURL: githubBaseUrl,
      defaultHeaders: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2026-03-10"
      }
    })
  : null;

export function getAiModelProfiles(): AiModelProfile[] {
  return Object.values(modelProfiles).map((profile) => ({
    ...profile,
    configured: Boolean(githubClient)
  }));
}

export async function chooseCardByClue(
  clue: string,
  handCards: AiCard[],
  playerId: AiPlayerId = "AI_Alice"
): Promise<ChooseCardResult> {
  if (handCards.length === 0) {
    return { cardId: "", reason: "没有可选手牌。", source: "fallback" };
  }

  const fallback = () => {
    const card = chooseFallbackCard(clue, handCards) ?? handCards[0];
    return {
      cardId: card.id,
      reason: `本地策略：选择与“${clue}”具有适度联想的图片。`,
      source: "fallback" as const
    };
  };

  try {
    const content: VisualContent[] = [
      {
        type: "text",
        text:
          `提示词是“${clue}”。下面是你的手牌。根据图片内容选择一张最适合但不要过于明显的牌。` +
          `只返回 JSON：{"cardId":"xxx","reason":"一句简短原因"}。`
      },
      ...(await cardsAsVisualContent(handCards))
    ];
    const parsed = await askJson<Partial<ChooseCardResult>>(playerId, [
      {
        role: "system",
        content: "你是联想叙事桌游中的玩家。图片是唯一判断依据，不要使用创作者、编号或后台标签。"
      },
      { role: "user", content }
    ]);
    const cardId = normalizeId(parsed.cardId);
    if (!isValidCardId(cardId, handCards)) return fallback();
    return { cardId, reason: String(parsed.reason ?? "根据图片与提示的联想选择。"), source: "model" };
  } catch {
    return fallback();
  }
}

export async function generateClue(
  storytellerCard: AiCard,
  playerId: AiPlayerId = "AI_Alice"
): Promise<GenerateClueResult> {
  const safeCard = storytellerCard ?? {
    id: "fallback_card",
    cardId: "fallback_card",
    tags: ["梦境"],
    creatorName: "System",
    imageUrl: ""
  };
  const fallback = () => generateFallbackClue(safeCard);

  try {
    const image = await imageContent(safeCard);
    const parsed = await askJson<Partial<GenerateClueResult>>(playerId, [
      {
        role: "system",
        content:
          "你是联想叙事桌游中的说书人。你的目标不是让所有人立刻猜中，而是让三名猜测者中大约一到两人猜中。" +
          "只根据图片构思提示，不要提及图片编号、创作者或后台标签。"
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              "为这张图片生成一句中等模糊度、有联想空间的中文提示。" +
              "不要直接说出画面中的主体、物体、人物、动物、地点、颜色、数量或明显动作；" +
              "不要复述画面。优先从情绪、记忆、隐喻、反差、时间感或一句像诗的短语切入。" +
              "提示应与图片存在可解释的联系，但也能合理联想到其他图片，长度控制在2到10个汉字。" +
              '只返回 JSON：{"clue":"孤独的回声","reason":"一句简短原因"}。'
          },
          image
        ]
      }
    ]);
    const clue = String(parsed.clue ?? "").trim();
    if (!clue) return fallback();
    return { clue, reason: String(parsed.reason ?? "根据图片氛围生成提示。"), source: "model" };
  } catch {
    return fallback();
  }
}

export function generateFallbackClue(storytellerCard: AiCard): GenerateClueResult {
  return {
    clue: generateFallbackClueForCard(storytellerCard),
    reason: "本地策略：立即生成一个保留联想空间的短提示。",
    source: "fallback"
  };
}

export async function voteCardByClue(
  clue: string,
  candidateCards: AiCard[],
  ownCardId: string,
  playerId: AiPlayerId = "AI_Alice"
): Promise<VoteCardResult> {
  const validCards = candidateCards.filter((card) => card.id !== ownCardId);
  if (validCards.length === 0) {
    return { votedCardId: "", reason: "没有可投票候选牌。", source: "fallback" };
  }

  const fallback = () => {
    const card = chooseFallbackCard(clue, validCards, [ownCardId]) ?? validCards[0];
    return {
      votedCardId: card.id,
      reason: `本地策略：排除自己的牌后，选择与“${clue}”最接近的图片。`,
      source: "fallback" as const
    };
  };

  try {
    const content: VisualContent[] = [
      {
        type: "text",
        text:
          `提示词是“${clue}”。从下面的匿名图片中猜出说书人的牌。自己的 cardId 是 ${ownCardId}，禁止投它。` +
          `只返回 JSON：{"votedCardId":"xxx","reason":"一句简短原因"}。`
      },
      ...(await cardsAsVisualContent(validCards))
    ];
    const parsed = await askJson<Partial<VoteCardResult>>(playerId, [
      {
        role: "system",
        content: "你是联想叙事桌游中的投票玩家。只根据图片和提示判断，不要使用后台标签。"
      },
      { role: "user", content }
    ]);
    const votedCardId = normalizeId(parsed.votedCardId);
    if (!isValidCardId(votedCardId, validCards)) return fallback();
    return { votedCardId, reason: String(parsed.reason ?? "根据图片与提示的关联投票。"), source: "model" };
  } catch {
    return fallback();
  }
}

async function askJson<T>(
  playerId: AiPlayerId,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]
): Promise<T> {
  if (!githubClient) throw new Error("GitHub Models token is not configured");
  const response = await withTimeout(
    githubClient.chat.completions.create({
      model: modelProfiles[playerId].model,
      messages,
      temperature: 0.65,
      max_tokens: 120
    }),
    modelTimeoutMs,
    `${playerId} model request timed out`
  );
  const content = response.choices[0]?.message?.content ?? "";
  return parseJsonLoose<T>(content);
}

async function cardsAsVisualContent(cards: AiCard[]): Promise<VisualContent[]> {
  const cardParts = await Promise.all(
    cards.map(async (card) => [
      { type: "text", text: `cardId: ${card.id}` } as VisualContent,
      await imageContent(card)
    ])
  );
  return cardParts.flat();
}

async function imageContent(card: AiCard): Promise<OpenAI.Chat.Completions.ChatCompletionContentPartImage> {
  return {
    type: "image_url",
    image_url: {
      url: await imageAsDataUrl(card.imageUrl),
      detail: "low"
    }
  };
}

async function imageAsDataUrl(imageUrl: string) {
  const cached = imageDataCache.get(imageUrl);
  if (cached) return cached;

  const encoded = (async () => {
    const buffer = await readImage(imageUrl);
    const jpeg = await sharp(buffer)
      .resize({ width: 640, height: 640, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  })();
  imageDataCache.set(imageUrl, encoded);
  try {
    return await encoded;
  } catch (error) {
    imageDataCache.delete(imageUrl);
    throw error;
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(message)), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function readImage(imageUrl: string) {
  if (imageUrl.startsWith("data:")) {
    const encoded = imageUrl.split(",", 2)[1] ?? "";
    return Buffer.from(encoded, "base64");
  }
  if (/^https?:\/\//i.test(imageUrl)) {
    const response = await fetch(imageUrl);
    if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  }
  const relative = imageUrl.replace(/^\/+/, "");
  const localPath = relative.startsWith("uploads/")
    ? join(process.cwd(), "backend", relative)
    : join(process.cwd(), relative);
  return readFile(localPath);
}

function parseJsonLoose<T>(content: string): T {
  const trimmed = content.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("No JSON object found");
    return JSON.parse(match[0]) as T;
  }
}

function normalizeId(value: unknown) {
  return String(value ?? "").trim();
}

function isValidCardId(cardId: string, cards: AiCard[]) {
  return cards.some((card) => card.id === cardId);
}
