import assert from "node:assert/strict";
import test from "node:test";
import { canTransition, transitionRound } from "../core/index.js";

test("round state machine permits the normal human storyteller flow", () => {
  assert.equal(canTransition("awaiting_clue", "awaiting_cards"), true);
  assert.equal(canTransition("awaiting_cards", "awaiting_vote"), true);
  assert.equal(canTransition("awaiting_vote", "revealed"), true);
});

test("round state machine rejects reveal before voting", () => {
  assert.throws(() => transitionRound("awaiting_cards", "revealed"), /invalid_round_transition/);
});

test("AI storyteller flow waits for the human card", () => {
  assert.equal(transitionRound("revealed", "awaiting_player_card"), "awaiting_player_card");
  assert.equal(transitionRound("awaiting_player_card", "awaiting_cards"), "awaiting_cards");
});
