export const DREAMCARD_STYLE_VERSION = "dreamcards-v1";

export function buildDreamCardStylePrompt() {
  return [
    "Transform the uploaded image into an original DreamCards narrative card illustration.",
    "Preserve the central composition and emotional idea, but redraw every visual element.",
    "Use painterly surrealism, tactile paper texture, soft cinematic light, layered depth,",
    "subtle dream logic, ambiguous storytelling details, and a premium illustrated card finish.",
    "Do not add words, captions, borders, logos, watermarks, UI, signatures, or recognizable copyrighted characters.",
    "Portrait composition, 3:4 aspect ratio, one strong focal point, readable at card size."
  ].join(" ");
}

export function buildImageModerationPrompt() {
  return [
    "Review this image for a public all-ages social storytelling card library.",
    "Reject sexual content involving minors, explicit sexual content, graphic gore, extremist propaganda,",
    "targeted hateful imagery, instructions for self-harm, or visible personal/private information.",
    "Return JSON only with status allow|review|reject, safetyScore 0..1, categories string[], and a short reason."
  ].join(" ");
}
