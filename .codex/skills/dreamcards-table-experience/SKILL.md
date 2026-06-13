---
name: dreamcards-table-experience
description: Preserve DreamCards' immersive desktop game-table experience when changing React components, Tailwind/CSS layout, card interactions, clue presentation, results, or replay UI. Use for any request involving the single-player table, player seats, hand layout, card viewing, drag-to-play, viewport sizing, scrolling, visual hierarchy, or complaints that the game looks like a dashboard, mobile app, or ordinary web form.
---

# DreamCards Table Experience

Keep the user seated at one dreamlike table. Treat UI controls as support for images, association, storytelling, and discussion.

## Workflow

1. Read the affected parts of `client/src/App.tsx` and `client/src/styles.css`.
2. Identify the current game phase without replacing the table shell.
3. Preserve the fixed spatial model: Alice top, Bob left, Carol right, human bottom.
4. Keep the human hand visible throughout the round.
5. Make the center show only the phase's primary material: clue, submitted images, vote choices, or visual result.
6. Verify layout after starting a game, not only on the deck-selection screen.
7. Run `npm run build`.

Read [references/design-contract.md](references/design-contract.md) before substantial layout or interaction changes.

## Non-Negotiable Rules

- Keep all round phases inside one table; do not create page-like phase screens.
- Prioritize image area over the decorative table surface.
- Hide global navigation and dashboard chrome while a game is active.
- Use a desktop web layout. Do not constrain the experience to a phone-width shell.
- Avoid visible progress bars and browser-page scrolling during play.
- Never reserve hidden sidebar grid columns. Active-game layout classes must replace, not merely visually hide, the normal page grid.
- Use click for enlarged viewing and inspiration editing.
- Use drag to the center for committing a non-storyteller card.
- Preserve a fanned hand with hover lift, scale, and glow.
- Keep clue text poetic and floating; avoid statistic-panel styling.
- Keep result UI visual: images, avatars, vote markers, and score deltas. Hide model explanations by default.

## Interaction Safety

- Separate visual selection state from committed game state.
- Closing enlarged view must clear temporary highlighting without losing a valid pending choice unless the interaction explicitly cancels it.
- Do not let hover transforms permanently change layout dimensions.
- Keep drop targets explicit during drag and inert outside card-submission phases.
- Ensure buttons and overlays do not block hand dragging.

## Verification

- Start a game and inspect the active table at common desktop sizes.
- Confirm no hidden sidebar space compresses the table.
- Confirm player statuses do not overlap seats or the round controls.
- Confirm all six hand cards remain inspectable.
- Confirm hover, click-to-view, close, and drag-to-play are distinct behaviors.
- Confirm vote and result images remain the dominant visual elements.

