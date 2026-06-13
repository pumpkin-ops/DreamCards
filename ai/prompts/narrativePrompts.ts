export type NarrativePromptMode = "text" | "image" | "hybrid";

export function buildCardGenerationPrompt(input: {
  mode: NarrativePromptMode;
  textPrompt?: string;
  imagePrompt?: string;
}) {
  const subject = [input.textPrompt, input.imagePrompt].filter(Boolean).join("\n");
  return [
    "Create an original, visually ambiguous narrative card for a social storytelling game.",
    "Avoid embedded words, logos, recognizable copyrighted characters, and explicit content.",
    "Prefer metaphor, emotional tension, multiple interpretations, and a clear focal image.",
    `Input mode: ${input.mode}.`,
    subject
  ]
    .filter(Boolean)
    .join("\n");
}
