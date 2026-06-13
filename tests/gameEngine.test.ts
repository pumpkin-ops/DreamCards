import assert from "node:assert/strict";
import test from "node:test";
import { applyScoreEvents, resolveWinners, scoreRound, validateVote } from "../core/index.js";

const submissions = [
  { playerId: "a", cardId: "story", isStoryCard: true },
  { playerId: "b", cardId: "b-card", isStoryCard: false },
  { playerId: "c", cardId: "c-card", isStoryCard: false },
  { playerId: "d", cardId: "d-card", isStoryCard: false }
];

test("partial correct rewards storyteller, correct voter, and successful decoy", () => {
  const result = scoreRound({
    playerIds: ["a", "b", "c", "d"],
    storytellerId: "a",
    submissions,
    votes: [
      { voterId: "b", cardId: "story" },
      { voterId: "c", cardId: "b-card" },
      { voterId: "d", cardId: "c-card" }
    ]
  });
  const scores = applyScoreEvents({ a: 0, b: 0, c: 0, d: 0 }, result.events);
  assert.equal(result.outcome, "partial_correct");
  assert.deepEqual(scores, { a: 3, b: 4, c: 1, d: 0 });
});

test("all correct gives two points only to non-storytellers", () => {
  const result = scoreRound({
    playerIds: ["a", "b", "c", "d"],
    storytellerId: "a",
    submissions,
    votes: ["b", "c", "d"].map((voterId) => ({ voterId, cardId: "story" }))
  });
  assert.equal(result.outcome, "all_correct");
  assert.deepEqual(applyScoreEvents({ a: 0, b: 0, c: 0, d: 0 }, result.events), {
    a: 0,
    b: 2,
    c: 2,
    d: 2
  });
});

test("none correct gives two points to non-storytellers plus decoy bonuses", () => {
  const result = scoreRound({
    playerIds: ["a", "b", "c", "d"],
    storytellerId: "a",
    submissions,
    votes: [
      { voterId: "b", cardId: "c-card" },
      { voterId: "c", cardId: "b-card" },
      { voterId: "d", cardId: "b-card" }
    ]
  });
  assert.equal(result.outcome, "none_correct");
  assert.deepEqual(applyScoreEvents({ a: 0, b: 0, c: 0, d: 0 }, result.events), {
    a: 0,
    b: 4,
    c: 3,
    d: 2
  });
});

test("vote validation blocks storyteller, duplicate, and self votes", () => {
  assert.equal(
    validateVote({ voterId: "a", storytellerId: "a", targetCardId: "b-card", submissions }).reason,
    "storyteller_cannot_vote"
  );
  assert.equal(
    validateVote({
      voterId: "b",
      storytellerId: "a",
      targetCardId: "story",
      submissions,
      existingVoterIds: ["b"]
    }).reason,
    "duplicate_vote"
  );
  assert.equal(
    validateVote({ voterId: "b", storytellerId: "a", targetCardId: "b-card", submissions }).reason,
    "self_vote"
  );
});

test("winner resolution supports tied winners at the score limit", () => {
  assert.deepEqual(resolveWinners(["a", "b", "c"], { a: 30, b: 30, c: 12 }), {
    gameOver: true,
    winnerIds: ["a", "b"]
  });
});

test("winner resolution keeps the match active below the limit", () => {
  assert.deepEqual(resolveWinners(["a", "b"], { a: 29, b: 18 }), {
    gameOver: false,
    winnerIds: []
  });
});

test("vote validation accepts an unused opponent card", () => {
  assert.deepEqual(
    validateVote({ voterId: "b", storytellerId: "a", targetCardId: "story", submissions }),
    { valid: true }
  );
});
