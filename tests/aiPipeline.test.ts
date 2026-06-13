import assert from "node:assert/strict";
import test from "node:test";
import { generateCard } from "../ai/generation/cardGenerationPipeline.js";
import { moderateGeneratedContent } from "../ai/moderation/cardModeration.js";

test("generation pipeline returns a stable fallback without a provider", async () => {
  const result = await generateCard({ mode: "text", textPrompt: "a forgotten railway in a dream" });
  assert.equal(result.source, "fallback");
  assert.match(result.imageUrl, /^\/uploads\/dream-fallback-/);
  assert.equal(result.moderation.status, "allow");
});

test("generation pipeline degrades when the provider fails", async () => {
  const result = await generateCard(
    { mode: "hybrid", textPrompt: "moonlit memory", imagePrompt: "quiet ocean" },
    { generate: async () => Promise.reject(new Error("provider unavailable")) }
  );
  assert.equal(result.source, "cache");
  assert.ok(result.narrativeText.length > 0);
});

test("moderation rejects high-risk content and queues ambiguous content", () => {
  assert.equal(moderateGeneratedContent({ prompt: "graphic gore", nsfwScore: 0.9 }).status, "reject");
  assert.equal(moderateGeneratedContent({ prompt: "a sword beside an empty throne", tags: ["weapon"] }).status, "review");
});

test("generation pipeline accepts a safe provider artifact", async () => {
  const result = await generateCard(
    { mode: "image", imagePrompt: "surreal library under water" },
    {
      generate: async () => ({
        imageUrl: "https://example.invalid/card.webp",
        narrativeText: "沉睡的目录",
        tags: ["library", "ocean"],
        nsfwScore: 0.01
      })
    }
  );
  assert.equal(result.source, "provider");
  assert.equal(result.moderation.status, "allow");
});
