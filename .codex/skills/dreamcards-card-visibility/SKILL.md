---
name: dreamcards-card-visibility
description: Enforce DreamCards card identity and information-visibility boundaries in database schemas, Express APIs, TypeScript types, React views, mock data, AI payloads, collections, codex pages, and replay screens. Use whenever adding card fields, displaying card metadata, changing public API serialization, creating mock cards, or deciding whether titles, tags, creators, sequence numbers, usage counts, collection counts, notes, or AI reasoning may appear.
---

# DreamCards Card Visibility

Protect open-ended image interpretation. Card metadata exists for provenance, collection, and AI behavior, not as gameplay hints.

## Workflow

1. Classify the target surface as gameplay, result/replay, or library/detail.
2. Read the visibility matrix in [references/visibility-matrix.md](references/visibility-matrix.md).
3. Check both server serialization and client rendering.
4. Keep private fields out of public payloads when the client never needs them.
5. Search for prohibited text near game-card rendering.

## Data Contract

- Do not reintroduce `title`.
- Preserve `cardId`, `creatorId`, `creatorName`, `creatorSequence`, `imageUrl`, `createdAt`, `timesPlayed`, and `timesCollected`.
- Generate `creatorSequence` per creator and never allow user edits.
- Keep `tags` in storage and AI-facing server objects only.
- Strip `tags` from public card/session serialization.
- Treat inspiration notes as private until the player explicitly publishes them in replay.

## Review Checks

- Search gameplay components for `creatorName`, `creatorSequence`, `tags`, counts, and card IDs.
- Ensure anonymous vote cards contain only images.
- Ensure result cards use player identity, not creator identity.
- Ensure collection, codex, profile, and card detail can show permanent provenance.
- Ensure mock cards follow the same schema and visibility rules.

