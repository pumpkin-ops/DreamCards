import assert from "node:assert/strict";
import test from "node:test";
import { chooseFallbackCard, generateFallbackClueForCard } from "../ai/fallback/fallbackPolicy.js";

const cards = [
  { id: "ocean", tags: ["ocean", "lonely"] },
  { id: "forest", tags: ["forest", "memory"] },
  { id: "city", tags: ["city", "machine"] }
];

test("fallback card choice prefers a semantic tag match", () => {
  assert.equal(chooseFallbackCard("lonely ocean", cards)?.id, "ocean");
});

test("fallback card choice excludes the AI player's own card", () => {
  assert.notEqual(chooseFallbackCard("lonely ocean", cards, ["ocean"])?.id, "ocean");
});

test("fallback clue generation is deterministic", () => {
  const first = generateFallbackClueForCard(cards[0]);
  const second = generateFallbackClueForCard(cards[0]);
  assert.equal(first, second);
  assert.ok(first.length > 0);
});
