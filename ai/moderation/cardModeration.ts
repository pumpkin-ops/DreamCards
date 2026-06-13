export const MAX_CARD_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BLOCKED_TAG_TERMS = [
  "sexual minor",
  "child sexual",
  "non-consensual",
  "graphic gore",
  "terrorist propaganda"
];
const REVIEW_TERMS = ["weapon", "blood", "self harm", "hate symbol", "extremism"];
const BLOCKED_PROMPT_TERMS = [...BLOCKED_TAG_TERMS, "sexualized child", "non consensual"];

export type ModerationStatus = "allow" | "review" | "reject";

export type CardModerationInput = {
  mimeType: string;
  size: number;
  tags?: string[];
};

export type CardModerationDecision = {
  status: ModerationStatus;
  reasons: string[];
  checks: {
    supportedImageType: boolean;
    withinSizeLimit: boolean;
    blockedMetadata: boolean;
  };
};

export type ModerationDecision = {
  status: ModerationStatus;
  safetyScore: number;
  reasons: string[];
  policyVersion: "2026-06-13";
};

export function moderateCardUpload(input: CardModerationInput): CardModerationDecision {
  const normalizedTags = (input.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter(Boolean);
  const supportedImageType = ALLOWED_IMAGE_TYPES.has(input.mimeType.toLowerCase());
  const withinSizeLimit = Number.isFinite(input.size) && input.size > 0 && input.size <= MAX_CARD_IMAGE_BYTES;
  const blockedMetadata = normalizedTags.some((tag) =>
    BLOCKED_TAG_TERMS.some((blockedTerm) => tag.includes(blockedTerm))
  );

  const reasons: string[] = [];
  if (!supportedImageType) reasons.push("unsupported_image_type");
  if (!withinSizeLimit) reasons.push("invalid_image_size");
  if (blockedMetadata) reasons.push("blocked_metadata");

  return {
    status: reasons.length > 0 ? "reject" : "allow",
    reasons,
    checks: {
      supportedImageType,
      withinSizeLimit,
      blockedMetadata
    }
  };
}

export function shouldQueueForModelReview(decision: CardModerationDecision) {
  return decision.status === "review";
}

export function moderateGeneratedContent(input: {
  prompt?: string;
  tags?: string[];
  nsfwScore?: number;
}): ModerationDecision {
  const normalizedText = `${input.prompt ?? ""} ${(input.tags ?? []).join(" ")}`.trim().toLowerCase();
  const nsfwScore = clampScore(input.nsfwScore ?? 0);
  const reasons: string[] = [];

  if (BLOCKED_PROMPT_TERMS.some((term) => normalizedText.includes(term))) reasons.push("blocked_prompt");
  if (nsfwScore >= 0.85) reasons.push("high_nsfw_risk");

  const requiresReview =
    nsfwScore >= 0.45 || REVIEW_TERMS.some((term) => normalizedText.includes(term));
  if (requiresReview && reasons.length === 0) reasons.push("manual_review_required");
  const rejected = reasons.some((reason) => reason === "blocked_prompt" || reason === "high_nsfw_risk");

  return {
    status: rejected ? "reject" : requiresReview ? "review" : "allow",
    safetyScore: rejected ? 0 : Number((1 - nsfwScore).toFixed(3)),
    reasons,
    policyVersion: "2026-06-13"
  };
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 1;
  return Math.min(1, Math.max(0, score));
}
