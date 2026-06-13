# DreamCards Table Design Contract

## Spatial Model

```text
             AI_Alice

AI_Bob                    AI_Carol

          clue / images

               you
          fanned hand
```

Seats stay in these positions across clue, submission, vote, result, and inspiration work.

## Phase Presentation

- `awaiting_clue`: floating clue composer; hand remains visible.
- `awaiting_player_card`: floating clue plus drag target; no separate confirmation form.
- `awaiting_vote`: anonymous large images; own submitted card is disabled.
- `revealed`: images with owner avatar, storyteller marker, voter avatars, and score delta.

## Enlarged View

- Darken the background.
- Allocate roughly 65% to the image and 35% to the inspiration notebook.
- Present inspirations as poetic lines, not task cards.
- Keep notes collapsed by default.
- Show `使用此牌` only when the human is the storyteller and the phase permits it.

## Layout Failure Modes

- Tailwind utility classes on the active `<main>` can override component-layer CSS. Remove normal-page classes conditionally instead of trying to override all of them.
- Hiding an `<aside>` does not remove an explicit grid column. Replace the grid template.
- Fixed minimum heights can reintroduce browser scrollbars.
- Short-height media queries must not shrink cards until images stop being the visual center.

