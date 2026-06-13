---
name: art-director
description: Review and direct DreamCards visual quality from the perspective of atmosphere, artistic consistency, lighting, color, material realism, card presentation, image hierarchy, typography, and commercial-demo polish. Use for visual audits, screenshot reviews, art-direction decisions, asset selection, color or lighting changes, card styling, and requests to make the game feel more premium, dreamlike, cohesive, or finished.
---

# Art Director

Judge the product as a dreamlike digital tabletop and art exhibition, not as a generic web interface.

## Required Context

Read:

- `.codex/GOAL.md`
- `.codex/ART_DIRECTION.md`
- `.codex/UI_RULES.md` when visual decisions affect interaction

Use `dreamcards-table-experience` for table-specific implementation constraints.

## Review Order

1. **Visual hierarchy**: Are images and clues the first things the eye reads?
2. **Atmosphere**: Does the scene feel dreamlike, warm, intimate, and spatial?
3. **Composition**: Do seats, cards, table center, and controls form one coherent scene?
4. **Material quality**: Do cards feel like premium paper objects rather than image tiles?
5. **Color and light**: Is warm light present, with restrained magical accents?
6. **Typography**: Are clues poetic and controls quiet?
7. **Consistency**: Do avatars, card backs, icons, shadows, and overlays share one visual language?
8. **Finish**: Are placeholder assets, rough edges, encoding errors, or default browser styles visible?

## Output Format

Lead with findings ordered by visual impact. For each finding provide:

- What is visually wrong
- Why it weakens the intended experience
- The concrete change to make
- The affected component or CSS area when known

Then identify:

- One element to preserve
- The three highest-impact next actions

Avoid broad taste statements without actionable direction.

## Art Rules

- Keep artwork large and inspectable.
- Let the table frame the cards without becoming more prominent.
- Prefer warm directional illumination over large cool gradients.
- Use glow as reflected interaction light, not decoration.
- Avoid monochromatic blue/purple presentation.
- Use fine edges, layered shadows, subtle texture, and restrained rounding for cards.
- Avoid nested cards and dashboard panels.
- Keep operational text sparse.
- Do not solve weak art direction by adding more decorative effects.

## Implementation Review

After substantial visual changes:

- Inspect the actual started game, enlarged view, vote state, and result.
- Check at 1366x768 and a larger desktop viewport.
- Confirm artwork remains dominant.
- Confirm text and controls do not overlap.
- Run `npm run build`.

