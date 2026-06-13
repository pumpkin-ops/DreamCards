export type RoundPhase =
  | "awaiting_clue"
  | "awaiting_player_card"
  | "awaiting_cards"
  | "awaiting_vote"
  | "revealed";

const transitions: Record<RoundPhase, RoundPhase[]> = {
  awaiting_clue: ["awaiting_cards", "awaiting_player_card"],
  awaiting_player_card: ["awaiting_cards"],
  awaiting_cards: ["awaiting_vote"],
  awaiting_vote: ["revealed"],
  revealed: ["awaiting_clue", "awaiting_player_card"]
};

export function canTransition(from: RoundPhase, to: RoundPhase) {
  return transitions[from].includes(to);
}

export function transitionRound<To extends RoundPhase>(from: RoundPhase, to: To): To {
  if (!canTransition(from, to)) {
    throw new Error(`invalid_round_transition:${from}->${to}`);
  }
  return to;
}

export function assertRoundPhase(actual: RoundPhase, expected: RoundPhase) {
  if (actual !== expected) throw new Error(`invalid_round_phase:expected_${expected}:received_${actual}`);
}
