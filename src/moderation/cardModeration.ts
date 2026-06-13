export const MAX_CARD_IMAGE_BYTES = 8 * 1024 * 1024;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BLOCKED_TAG_TERMS = [
  "sexual minor",
  "child sexual",
  "non-consensual",
  "graphic gore",
  "terrorist propaganda"
];

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
