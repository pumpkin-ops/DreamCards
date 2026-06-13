---
name: task-loop
description: Drive DreamCards from the current repository state toward a polished, playable commercial-quality demo through a repeatable plan, implement, verify, repair, and roadmap-update loop. Use when asked to continue, improve the demo, pick the next task, execute the roadmap, perform autonomous iteration, or finish work end to end rather than stopping at analysis.
---

# Task Loop

Advance one coherent, demonstrable increment at a time.

## Required Context

Read before selecting work:

- `.codex/GOAL.md`
- `.codex/TODO.md`
- `.codex/ART_DIRECTION.md` for visual work
- `.codex/UI_RULES.md` for interface work

Load the relevant DreamCards domain Skills when the task touches table experience, game state, card visibility, or AI fallback.

## Loop

1. Inspect the current repository and running behavior.
2. Select the highest-value unchecked TODO that improves the playable demo.
3. Define a narrow completion condition and the files likely involved.
4. Implement the complete increment.
5. Run the cheapest relevant checks, then the broader required checks.
6. If verification fails, diagnose and repair before moving on.
7. Update `.codex/TODO.md`:
   - Mark an item `[x]` only after verification.
   - Add newly discovered concrete work in the correct category.
   - Remove or rewrite stale items whose assumptions changed.
8. Report what changed, verification performed, and remaining risk.

## Selection Priorities

Choose in this order unless the user directs otherwise:

1. Broken or blocked core round flow
2. State corruption, information leakage, or unrecoverable AI failure
3. Interaction problems that stop a first-time user
4. High-impact visual problems on the main table
5. Art consistency and animation polish
6. Secondary library and profile surfaces

Do not add speculative features while a current core-flow or presentation defect remains.

## Execution Rules

- Implement rather than merely propose when the request permits code changes.
- Preserve existing architecture and user changes.
- Keep backend state authoritative for rules, hands, votes, and scoring.
- Start and inspect an actual game for active-table changes.
- Use `npm run build` as the minimum repository-wide check.
- Add focused tests when changing scoring, phase transitions, card consumption, visibility, or AI validation.
- Do not claim demo readiness based only on a passing build.

## Completion Gate

An iteration is complete only when:

- The target behavior works through its user-visible path.
- No new blocking regression is known.
- Required validation has run.
- `.codex/TODO.md` reflects reality.
- The result moves the project toward `.codex/GOAL.md`.

