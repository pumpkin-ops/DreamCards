# DreamCards UI Rules

## Table Structure

- Preserve the fixed seating layout: Alice top, Bob left, Carol right, human bottom.
- Keep the player on the same table through clue, submission, vote, result, and replay entry.
- Do not create separate page-like screens for each round phase.
- Keep the human hand visible throughout active play.

## Card Interaction

- Hover a hand card with a slight scale increase, upward movement, and soft glow.
- Click a hand card to enlarge it in the central viewing mode.
- Use drag-to-table as the committed card-submission gesture.
- Keep click-to-view separate from drag-to-play.
- Closing the enlarged view must not leave stale visual highlighting.
- Played cards leave the hand; replacement cards come from the player's own draw pile.
- When the draw pile is exhausted, shuffle the player's own discard pile into a new draw pile.
- Show round, storyteller order, current phase, and compact hand/draw/discard counts without using a progress bar.

## Inspiration

- Allow inspiration drafts at any time, including when the human is not the storyteller.
- Bind drafts to a specific card, not to a global notebook.
- Show other players only a creative status, never their draft content.
- Use statuses such as `🌙 寻找灵感`, `✍ 编织故事`, `💭 构思中`, `📖 联想中`, and `💡 灵感闪现`.
- Keep note inputs collapsed behind a small button by default.
- Notes remain private until the replay stage and explicit publication.

## Information Visibility

- During gameplay, a card communicates only through its image.
- Do not show title, tags, creator, creator sequence, card ID, collection count, or usage count.
- During anonymous voting, do not show submitter identity or A/B/C/D labels.
- During round result, show submitter and voters through avatars and icons.
- Show source, notes, detailed AI reasoning, and creative history only in replay or an explicitly opened detail view.

## Clues and Results

- Present the clue as a floating poetic sentence, not a metric panel.
- Keep results visual: image, owner avatar, storyteller marker, voter avatars, score delta.
- Do not show long AI explanations by default.
- Keep score secondary to the images and social interpretation.

## Layout and Responsiveness

- Build for a desktop web game first; do not constrain the product to a 430px phone shell.
- Avoid browser-page scrollbars during active play.
- Use internal overlays or contained panels for overflow.
- Verify short-height desktop screens as well as wide displays.
- Never leave hidden sidebars or grid columns consuming active-game space.
- Prevent player status labels, cards, clue text, and controls from overlapping.

## Review Requirement

After significant UI work:

1. Start an actual game.
2. Inspect every phase at representative viewport sizes.
3. Verify hover, click, close, drag, vote, result, and next-round behavior.
4. Run `npm run build`.
