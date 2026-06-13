---
name: dreamcards-game-state
description: Maintain DreamCards gameplay correctness across the React client, Express routes, and single-player session engine. Use when changing round phases, storyteller rotation, clue submission, card submission, drag-to-play, voting, score calculation, hand consumption, drawing replacement cards, next-round transitions, replay memories, or any bug where the UI cannot continue or disagrees with backend state.
---

# DreamCards Game State

Treat `server/src/singlePlayer.ts` as the single-player source of truth. The frontend renders returned session state and must not invent authoritative hand, vote, or score transitions.

## Workflow

1. Trace the full transition in `server/src/singlePlayer.ts`.
2. Check the matching route in `server/src/index.ts`.
3. Check API typing in `client/src/lib/types.ts` and calls in `client/src/lib/api.ts`.
4. Update `client/src/App.tsx` only after the backend transition is coherent.
5. Test the complete path through the next round.

Read [references/rules.md](references/rules.md) for phase and scoring invariants.

## State Rules

- Use explicit phases: `awaiting_clue`, `awaiting_player_card`, `awaiting_vote`, `revealed`.
- Rotate storyteller in fixed order: human, Alice, Bob, Carol.
- The storyteller submits a clue and card but never votes.
- A non-storyteller must submit exactly one card and cannot vote for their own card.
- Anonymous cards must not expose submitter identity before reveal.
- A submitted card leaves its owner's hand immediately.
- At the next round, draw from that player's own draw pile until the hand reaches six or the pile is empty.
- Played cards enter that player's own discard pile.
- When a personal draw pile is empty, shuffle that player's discard pile into a new draw pile and continue refilling to six.
- Never mix cards between players, and never recycle cards before the personal draw pile is exhausted.
- Reset clue, submissions, anonymous cards, votes, and score events between rounds.
- Preserve cumulative scores across rounds.

## Validation Boundaries

- Reject invalid human actions; do not silently substitute the first hand card.
- AI output may fall back, but fallback must select a currently valid card.
- Do not accept duplicate submissions or votes from the same player.
- Keep private AI hands and draw piles out of `publicSession`.
- Record played/discovered cards only after a round resolves.

## Required Checks

- Start hand: 6.
- After submission: 5.
- Next round after refill: 6 when a draw card or discarded card exists.
- Draw-pile exhaustion shuffles the personal discard pile back exactly once and preserves a six-card hand.
- Storyteller vote count: 0.
- Human own-card vote: rejected or disabled.
- Next round advances storyteller and returns a usable phase.
- `npm run build` passes.
