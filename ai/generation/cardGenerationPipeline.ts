import { generateFallbackClueForCard } from "../fallback/fallbackPolicy.js";
import { moderateGeneratedContent, ModerationDecision } from "../moderation/cardModeration.js";
import { buildCardGenerationPrompt, NarrativePromptMode } from "../prompts/narrativePrompts.js";

export type CardGenerationInput = {
  mode: NarrativePromptMode;
  textPrompt?: string;
  imagePrompt?: string;
};

export type GeneratedCardArtifact = {
  imageUrl: string;
  narrativeText: string;
  tags: string[];
  safetyScore: number;
  source: "provider" | "fallback" | "cache";
  moderation: ModerationDecision;
};

export type CardGenerationProvider = {
  generate(input: { prompt: string; mode: NarrativePromptMode }): Promise<{
    imageUrl: string;
    narrativeText?: string;
    tags?: string[];
    nsfwScore?: number;
  }>;
};

const cachedFallbackCards = [
  "/uploads/dream-fallback-1.svg",
  "/uploads/dream-fallback-2.svg",
  "/uploads/dream-fallback-3.svg",
  "/uploads/dream-fallback-4.svg"
];

export async function generateCard(
  input: CardGenerationInput,
  provider?: CardGenerationProvider
): Promise<GeneratedCardArtifact> {
  const prompt = buildCardGenerationPrompt(input);
  const promptDecision = moderateGeneratedContent({ prompt });
  if (promptDecision.status === "reject") return fallbackArtifact(input, promptDecision, "fallback");

  if (provider) {
    try {
      const generated = await provider.generate({ prompt, mode: input.mode });
      const moderation = moderateGeneratedContent({
        prompt,
        tags: generated.tags,
        nsfwScore: generated.nsfwScore
      });
      if (moderation.status === "allow") {
        return {
          imageUrl: generated.imageUrl,
          narrativeText: generated.narrativeText ?? "",
          tags: generated.tags ?? [],
          safetyScore: moderation.safetyScore,
          source: "provider",
          moderation
        };
      }
      return fallbackArtifact(input, moderation, "fallback");
    } catch {
      return fallbackArtifact(input, promptDecision, "cache");
    }
  }

  return fallbackArtifact(input, promptDecision, "fallback");
}

function fallbackArtifact(
  input: CardGenerationInput,
  moderation: ModerationDecision,
  source: "fallback" | "cache"
): GeneratedCardArtifact {
  const seed = `${input.mode}:${input.textPrompt ?? ""}:${input.imagePrompt ?? ""}`;
  const index = stableHash(seed) % cachedFallbackCards.length;
  const tags = tokenize(`${input.textPrompt ?? ""} ${input.imagePrompt ?? ""}`).slice(0, 6);
  const clue = generateFallbackClueForCard({ id: `generated_${index}`, tags });
  return {
    imageUrl: cachedFallbackCards[index],
    narrativeText: clue,
    tags,
    safetyScore: moderation.safetyScore,
    source,
    moderation
  };
}

function tokenize(value: string) {
  return [...new Set(value.split(/[\s,，。；;！？!?、]+/).map((item) => item.trim()).filter(Boolean))];
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
