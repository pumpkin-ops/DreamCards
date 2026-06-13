# DreamCards Demo Roadmap

Update this file after each meaningful implementation and verification cycle. Use `[x]` only when the behavior has been tested, not merely coded.

## Core Gameplay

- [x] Match four authenticated human players into one server-authoritative room.
- [x] Synchronize clue, card submission, anonymous voting, scoring, and next-round state.
- [x] Deduplicate overlapping player collections when building the shared match pool.
- [x] Refill every multiplayer hand to six cards and rotate the storyteller.
- [x] Start a local four-player game with one human and three AI players.
- [x] Rotate the storyteller across all four players.
- [x] Support human clue and story-card submission.
- [x] Support AI clue generation and follower card choice.
- [x] Prevent storyteller voting and self-voting.
- [x] Consume submitted cards and refill hands from individual draw piles.
- [x] Calculate round scores and advance to the next round.
- [ ] Define and implement a clear end-of-game condition.
- [ ] Make replay memories persist for the entire completed game session.
- [x] Recycle each player's discard pile when their personal draw pile is exhausted.
- [x] Verify behavior when a draw pile has fewer cards than required.
- [ ] Add stable phase/action validation instead of silent fallback to the first card.
- [ ] Ensure restarting a game resets all session-scoped state while preserving only intended player data.

## UI / Interaction

- [x] Keep fixed table seats: Alice top, Bob left, Carol right, human bottom.
- [x] Keep the human hand visible during the round.
- [x] Hover cards with lift, scale, and glow.
- [x] Open enlarged card and inspiration view on click.
- [x] Drag a follower card to the table to submit it.
- [x] Keep notes collapsed by default.
- [ ] Make storyteller drag-to-play and clue confirmation feel like one coherent action.
- [ ] Add clear drag cancellation and invalid-drop feedback.
- [ ] Remove remaining dashboard-like navigation during active play and provide a subtle exit control.
- [x] Ensure player statuses never overlap seats, clues, cards, or controls.
- [x] Refine vote selection feedback without adding labels or card letters.
- [x] Keep all active phases usable without browser-page scrolling.
- [x] Verify accessible button names and close controls.

## Art / Visual

- [x] Replace placeholder seed artwork with a curated coherent demo set.
- [x] Establish warm tabletop lighting over the current cool single-hue presentation.
- [x] Add premium paper edges, restrained depth, and tactile card shadows.
- [x] Improve table surface so it supports images without becoming the visual center.
- [x] Harmonize avatars, card backs, crown, vote markers, and score indicators.
- [x] Add subtle phase transitions and card movement without distracting from interpretation.
- [x] Make enlarged artwork crisp and dominant at common desktop resolutions.
- [x] Audit all visible Chinese text for encoding and typography consistency.
- [ ] Create a polished title/start state that leads directly into the table.

## Validation / Testing

- [x] Complete a full real-player matchmaking round with four temporary accounts.
- [x] Verify multiplayer storyteller voting and self-voting are rejected by the server.
- [x] Production TypeScript and Vite build passes.
- [x] Basic API flow verifies hand count `6 -> 5 -> 6`.
- [ ] Add automated tests for scoring branches: all correct, none correct, partial correct.
- [ ] Add automated tests for storyteller rotation and vote restrictions.
- [ ] Add automated tests for card consumption and draw-pile exhaustion.
- [ ] Add AI fallback tests for no key, malformed JSON, invalid IDs, and own-card voting.
- [x] Run the full game flow for at least eight consecutive rounds.
- [x] Verify desktop layouts at 1366x768, 1440x900, and 1920x1080.
- [x] Verify a narrow viewport without turning the product into a phone-only interface.
- [ ] Inspect browser console and network failures through every phase.
- [x] Perform final reviews with `art-director` and `ui-polish`.
- [x] Capture final demo screenshots and a short repeatable demo script.
