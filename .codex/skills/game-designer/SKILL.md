---
name: game-designer
description: Review DreamCards gameplay from the perspective of rules, balance, information leakage, player agency, storyteller incentives, voting integrity, hand economy, AI behavior, round pacing, replay value, and social discussion. Use when changing or evaluating game rules, scoring, phases, card consumption, clue creation, voting, AI decisions, inspiration visibility, replay, end conditions, or whether a feature improves the game rather than merely adding UI.
---

# Game Designer

Protect the experience of interpreting images together. Treat score as structure, not the product center.

## Required Context

Read:

- `.codex/GOAL.md`
- `.codex/TODO.md`
- `.codex/UI_RULES.md`

Use `dreamcards-game-state`, `dreamcards-card-visibility`, and `dreamcards-ai-fallback` for implementation-level rules.

## Review Lenses

### Rules Integrity

- Storyteller submits but does not vote.
- Players cannot vote for their own card.
- Each player submits and votes at most once.
- Played cards leave hands and replacement draws come from personal piles.
- Scoring covers all-correct, none-correct, and partial-correct outcomes.

### Information Integrity

- Gameplay exposes images, public clue, player state, and permitted vote/result information only.
- Tags, creator metadata, private inspirations, notes, and hidden AI reasoning do not leak.
- Anonymous submissions remain anonymous until reveal.

### Player Agency

- Players can inspect cards and prewrite inspirations at any time.
- Committing a card is intentional and recoverable before submission.
- The storyteller can choose between existing inspiration and a new clue.
- AI actions do not make the human feel like a spectator.

### Pacing

- Each phase has one clear decision.
- Waiting states are short or visibly active.
- Results explain what happened visually and move naturally to the next round.
- Replay adds discussion value without interrupting every round.

### Balance and Incentives

- Clues reward ambiguity between obvious and impossible.
- Decoy players benefit from attracting votes.
- No visible metadata biases interpretation.
- AI fallback remains valid without becoming perfectly predictable.

## Output Format

Lead with rule defects and exploit risks, then pacing and balance observations. For each issue include:

- Scenario
- Player impact
- Required rule or state change
- Test case

End with a verdict:

- Safe to implement
- Implement with stated guardrails
- Do not implement because it harms the core experience

## Validation

Test at least:

- Human storyteller round
- AI storyteller round
- Self-vote attempt
- All, none, and partial correct votes
- Card consumption and refill
- Draw-pile exhaustion
- AI failure fallback
- Next-round continuation

