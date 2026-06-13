# Repository instructions for coding agents

## Required verification

Run before proposing a merge:

```bash
npm run lint
npm test
npm run build
```

## Behavioral invariants

- The storyteller never votes.
- A non-storyteller never votes for their own submitted card.
- Card ownership and vote targets stay hidden until reveal.
- A completed player's state updates without waiting for every AI.
- Provider failures degrade one AI action, not the whole round.
- UGC must pass moderation preflight before a public card record is created.
- Never expose backend AI tags in gameplay UI or public card APIs.

## Change boundaries

- Put framework-independent policies in `src/`.
- Keep provider-specific code in `server/services/`.
- Keep transport and persistence in `server/`.
- Keep UI-only behavior in `frontend/`.
- Add deterministic tests for rule, safety, or fallback changes.
- Do not commit `.env`, tokens, local databases, user uploads, or browser profiles.

## Review focus

Prioritize hidden-information leaks, illegal state transitions, duplicate cards, race conditions, moderation bypasses, and unbounded external-provider waits.
