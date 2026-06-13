import "dotenv/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import OpenAI from "openai";
import sharp from "sharp";
import { DREAMCARD_STYLE_VERSION, buildDreamCardStylePrompt, buildImageModerationPrompt } from "../../ai/prompts/dreamCardStyle.js";
import { ModerationStatus } from "../../ai/moderation/cardModeration.js";

export type ImageReviewResult = {
  status: ModerationStatus;
  safetyScore: number;
  categories: string[];
  reason: string;
  source: "vision-model" | "local-preflight";
};

export type CardIngestionStage = {
  id: "preflight" | "source_review" | "style_generation" | "result_review" | "published";
  status: "passed" | "fallback" | "rejected";
  detail: string;
};

export type CardIngestionResult = {
  imageUrl: string;
  sourceType: "user-ai-restyled";
  styleVersion: string;
  generationSource: "image-model" | "local-style-fallback";
  moderationStatus: "approved";
  sourceReview: ImageReviewResult;
  resultReview: ImageReviewResult;
  stages: CardIngestionStage[];
};

type IngestInput = {
  sourcePath: string;
  mimeType: string;
  uploadDir: string;
};

const visionClient = process.env.GITHUB_MODELS_TOKEN
  ? new OpenAI({
      apiKey: process.env.GITHUB_MODELS_TOKEN,
      baseURL: process.env.GITHUB_MODELS_BASE_URL ?? "https://models.github.ai/inference"
    })
  : null;

const visionModel = process.env.IMAGE_REVIEW_MODEL ?? process.env.AI_ALICE_MODEL ?? "openai/gpt-4.1-mini";
const imageApiKey = process.env.IMAGE_API_KEY;
const imageBaseUrl = (process.env.IMAGE_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
const imageModel = process.env.IMAGE_MODEL ?? "gpt-image-1";
const imageTimeoutMs = Number(process.env.IMAGE_TIMEOUT_MS ?? 45000);
const allowLocalReview = process.env.IMAGE_ALLOW_LOCAL_REVIEW === "true";

export async function ingestDreamCardImage(input: IngestInput): Promise<CardIngestionResult> {
  const stages: CardIngestionStage[] = [
    { id: "preflight", status: "passed", detail: "文件格式与体积检查通过" }
  ];
  const sourceBuffer = await readFile(input.sourcePath);

  try {
    const sourceReview = await reviewImage(sourceBuffer, input.mimeType);
    if (sourceReview.status !== "allow") {
      stages.push({ id: "source_review", status: "rejected", detail: sourceReview.reason });
      throw new CardIngestionRejectedError("原图未通过内容审核", sourceReview, stages);
    }
    stages.push({
      id: "source_review",
      status: sourceReview.source === "vision-model" ? "passed" : "fallback",
      detail: sourceReview.reason
    });

    const generated = await restyleImage(sourceBuffer, input.mimeType);
    stages.push({
      id: "style_generation",
      status: generated.source === "image-model" ? "passed" : "fallback",
      detail: generated.source === "image-model" ? "已完成 DreamCards AI 重绘" : "图生图服务不可用，已使用本地风格化"
    });

    const resultReview = await reviewImage(generated.buffer, "image/webp");
    if (resultReview.status !== "allow") {
      stages.push({ id: "result_review", status: "rejected", detail: resultReview.reason });
      throw new CardIngestionRejectedError("重绘结果未通过二次审核", resultReview, stages);
    }
    stages.push({
      id: "result_review",
      status: resultReview.source === "vision-model" ? "passed" : "fallback",
      detail: resultReview.reason
    });

    await mkdir(input.uploadDir, { recursive: true });
    const fileName = `dreamcard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
    await writeFile(join(input.uploadDir, fileName), generated.buffer);
    stages.push({ id: "published", status: "passed", detail: "审核成品已写入梦境库" });

    return {
      imageUrl: `/uploads/${fileName}`,
      sourceType: "user-ai-restyled",
      styleVersion: DREAMCARD_STYLE_VERSION,
      generationSource: generated.source,
      moderationStatus: "approved",
      sourceReview,
      resultReview,
      stages
    };
  } finally {
    await rm(input.sourcePath, { force: true });
  }
}

export class CardIngestionRejectedError extends Error {
  constructor(
    message: string,
    public readonly review: ImageReviewResult,
    public readonly stages: CardIngestionStage[]
  ) {
    super(message);
  }
}

async function reviewImage(buffer: Buffer, mimeType: string): Promise<ImageReviewResult> {
  if (!visionClient) return localImageReview(buffer);

  try {
    const normalized = await sharp(buffer)
      .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    const response = await withTimeout(
      visionClient.chat.completions.create({
        model: visionModel,
        temperature: 0,
        max_tokens: 180,
        messages: [
          { role: "system", content: "You are a conservative image safety reviewer. Output valid JSON only." },
          {
            role: "user",
            content: [
              { type: "text", text: buildImageModerationPrompt() },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${normalized.toString("base64")}`, detail: "low" }
              }
            ]
          }
        ]
      }),
      Math.min(imageTimeoutMs, 12000)
    );
    const parsed = parseJsonLoose(response.choices[0]?.message?.content ?? "");
    const status = normalizeStatus(parsed.status);
    const safetyScore = normalizeSafetyScore(status, Number(parsed.safetyScore ?? 0.5));
    return {
      status,
      safetyScore,
      categories: Array.isArray(parsed.categories) ? parsed.categories.map(String).slice(0, 8) : [],
      reason: String(parsed.reason ?? (status === "allow" ? "视觉内容审核通过" : "视觉内容需要复核")),
      source: "vision-model"
    };
  } catch {
    return localImageReview(buffer);
  }
}

async function localImageReview(buffer: Buffer): Promise<ImageReviewResult> {
  const metadata = await sharp(buffer).metadata();
  const validDimensions = (metadata.width ?? 0) >= 256 && (metadata.height ?? 0) >= 256;
  const status: ModerationStatus = !validDimensions ? "reject" : allowLocalReview ? "allow" : "review";
  return {
    status,
    safetyScore: status === "allow" ? 0.55 : 0,
    categories: validDimensions ? ["automated_visual_review_unavailable"] : ["image_too_small"],
    reason: validDimensions
      ? allowLocalReview
        ? "视觉模型不可用，已按开发环境设置通过基础图像完整性审核"
        : "视觉审核服务不可用，作品已暂停发布"
      : "图片尺寸过小，至少需要 256×256",
    source: "local-preflight"
  };
}

async function restyleImage(buffer: Buffer, mimeType: string) {
  if (imageApiKey) {
    try {
      const form = new FormData();
      form.set("model", imageModel);
      form.set("prompt", buildDreamCardStylePrompt());
      form.set("size", "1024x1536");
      form.set("image", new Blob([Uint8Array.from(buffer)], { type: mimeType }), `source${extnameForMime(mimeType)}`);
      const response = await withTimeout(
        fetch(`${imageBaseUrl}/images/edits`, {
          method: "POST",
          headers: { Authorization: `Bearer ${imageApiKey}` },
          body: form
        }),
        imageTimeoutMs
      );
      if (!response.ok) throw new Error(`image_edit_failed:${response.status}`);
      const payload = (await response.json()) as {
        data?: Array<{ b64_json?: string; url?: string }>;
      };
      const item = payload.data?.[0];
      if (item?.b64_json) {
        return { buffer: await normalizeGeneratedImage(Buffer.from(item.b64_json, "base64")), source: "image-model" as const };
      }
      if (item?.url) {
        const imageResponse = await fetch(item.url);
        if (!imageResponse.ok) throw new Error(`generated_image_download_failed:${imageResponse.status}`);
        return {
          buffer: await normalizeGeneratedImage(Buffer.from(await imageResponse.arrayBuffer())),
          source: "image-model" as const
        };
      }
      throw new Error("image_edit_missing_output");
    } catch {
      // Fall through to the deterministic local presentation fallback.
    }
  }

  return { buffer: await localDreamCardStyle(buffer), source: "local-style-fallback" as const };
}

export async function localDreamCardStyle(buffer: Buffer) {
  const base = await sharp(buffer)
    .rotate()
    .resize(768, 1024, { fit: "cover", position: "attention" })
    .modulate({ saturation: 1.12, brightness: 0.94 })
    .sharpen({ sigma: 0.7 })
    .webp({ quality: 88 })
    .toBuffer();
  const overlay = Buffer.from(
    `<svg width="768" height="1024">
      <defs>
        <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f4d7a1" stop-opacity=".08"/>
          <stop offset=".55" stop-color="#291d46" stop-opacity=".04"/>
          <stop offset="1" stop-color="#080711" stop-opacity=".34"/>
        </linearGradient>
        <radialGradient id="g">
          <stop offset=".45" stop-color="#fff" stop-opacity="0"/>
          <stop offset="1" stop-color="#070612" stop-opacity=".3"/>
        </radialGradient>
      </defs>
      <rect width="768" height="1024" fill="url(#v)"/>
      <rect width="768" height="1024" fill="url(#g)"/>
    </svg>`
  );
  return sharp(base).composite([{ input: overlay, blend: "soft-light" }]).webp({ quality: 88 }).toBuffer();
}

async function normalizeGeneratedImage(buffer: Buffer) {
  return sharp(buffer).rotate().resize(768, 1024, { fit: "cover", position: "attention" }).webp({ quality: 88 }).toBuffer();
}

function parseJsonLoose(content: string) {
  const match = content.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("invalid_review_json");
  return JSON.parse(match[0]) as Record<string, unknown>;
}

function normalizeStatus(value: unknown): ModerationStatus {
  return value === "reject" || value === "review" ? value : "allow";
}

function clampScore(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function normalizeSafetyScore(status: ModerationStatus, value: number) {
  const score = clampScore(value);
  if (status === "allow") return score < 0.5 ? Number((1 - score).toFixed(3)) : score;
  if (status === "reject") return score > 0.5 ? Number((1 - score).toFixed(3)) : score;
  return Math.min(0.75, Math.max(0.25, score));
}

function extnameForMime(mimeType: string) {
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  return ".jpg";
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
