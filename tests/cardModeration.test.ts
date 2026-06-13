import assert from "node:assert/strict";
import test from "node:test";
import { MAX_CARD_IMAGE_BYTES, moderateCardUpload } from "../ai/moderation/cardModeration.js";

test("moderation allows a valid image upload", () => {
  const decision = moderateCardUpload({
    mimeType: "image/webp",
    size: 512_000,
    tags: ["dream", "ocean"]
  });
  assert.equal(decision.status, "allow");
  assert.deepEqual(decision.reasons, []);
});

test("moderation rejects unsupported media", () => {
  const decision = moderateCardUpload({
    mimeType: "image/svg+xml",
    size: 512_000
  });
  assert.equal(decision.status, "reject");
  assert.ok(decision.reasons.includes("unsupported_image_type"));
});

test("moderation rejects oversized uploads", () => {
  const decision = moderateCardUpload({
    mimeType: "image/png",
    size: MAX_CARD_IMAGE_BYTES + 1
  });
  assert.equal(decision.status, "reject");
  assert.ok(decision.reasons.includes("invalid_image_size"));
});
