---
name: ui-polish
description: Review and improve DreamCards interaction quality, layout, responsive behavior, animation, feedback, accessibility, viewport use, and phase-to-phase usability. Use for hover, click, drag, drop, modal, voting, result, navigation, scrolling, sizing, overlap, desktop or narrow-screen issues, and any request to make the interface smoother, clearer, more responsive, or less like a web form.
---

# UI Polish

Polish the playable path without changing the product into a dashboard or phone-only interface.

## Required Context

Read:

- `.codex/UI_RULES.md`
- `.codex/GOAL.md`
- `.codex/ART_DIRECTION.md` when polish changes visual emphasis

Use `dreamcards-table-experience` for active-table work and `dreamcards-game-state` when interaction commits game actions.

## Review the Full Interaction Chain

1. Start game
2. Inspect hand
3. Hover a card
4. Click to enlarge
5. Add or edit inspiration
6. Close enlarged view
7. Drag and submit a card
8. Vote
9. Read result
10. Continue to next round
11. Enter replay

Do not review only the static initial screen.

## Evaluation Criteria

- **Affordance**: Does the player understand what can be clicked or dragged?
- **Feedback**: Does hover, drag, drop, vote, loading, success, and failure have immediate response?
- **State clarity**: Is the current phase obvious without explanatory panels?
- **Spatial stability**: Do seats and hand remain anchored?
- **Layout resilience**: Are there no overlaps, clipped cards, hidden buttons, or stale grid columns?
- **Motion quality**: Are transitions short, physically motivated, and non-disruptive?
- **Input separation**: Does click-to-view remain distinct from drag-to-play?
- **Accessibility**: Can controls be focused, named, and closed predictably?
- **Responsiveness**: Does desktop remain primary while narrow viewports stay usable?

## Output Format

List findings by severity:

- Blocker: prevents progress or hides a required action
- Major: causes confusion, overlap, or inconsistent state
- Polish: improves feel without changing comprehension

For each finding include reproduction steps and a specific correction.

## Implementation Rules

- Avoid browser-page scrollbars during active play.
- Use contained overlays for secondary content.
- Do not retain visual highlight after closing a card unless selection is intentionally visible.
- Do not clear authoritative pending selection merely to remove visual highlight.
- Make invalid drops recoverable and explain them briefly.
- Keep primary actions reachable without excessive text.
- Validate at 1366x768, 1440x900, and one narrow viewport.
- Run `npm run build` after changes.

