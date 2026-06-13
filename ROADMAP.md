# DreamCards Roadmap

This roadmap is outcome-based. Dates are targets, not promises.

## MVP: 1–2 weeks

### Product scope

- Complete a four-player match to the 30-point win condition.
- Preserve card consumption, discard recycling, and global artwork uniqueness.
- Keep storyteller and vote information hidden until reveal.
- Provide deterministic local AI behavior with no provider key.

### Technical challenges

- Expand state-machine tests for every scoring branch.
- Separate framework-independent rules from Express and React.
- Make upload errors explicit and remove rejected temporary files.
- Keep local and Vercel builds reproducible.

### AI integration points

- Validate model-selected card IDs.
- Enforce self-vote and storyteller-vote constraints.
- Measure timeout and fallback reasons.
- Test fallback behavior without external calls.

### Exit criteria

- `npm run check` passes on Windows and GitHub Actions.
- Core rule tests cover legal and illegal transitions.
- No committed secrets or unlicensed card assets.

## Beta: 1–2 months

### Product scope

- Real-time rooms with WebSocket updates.
- Reconnect to the current match and seat.
- Player reporting, card quarantine, and review status.
- Adapter interface for player uploads, AI-generated cards, and curated cards.
- Replay-room links to cards, clues, and vote flow.

### Technical challenges

- Authoritative server state and idempotent commands.
- Durable room snapshots and reconnect permissions.
- Object storage and database migration paths.
- Moderation queue, audit events, and appeals.

### AI integration points

- Provider adapters with capability metadata.
- Structured outputs and evaluation fixtures.
- Optional image-content review as one signal, never the only authority.
- AI personality tests based on observable behavior, not model branding.

### Exit criteria

- Four remote players complete repeated matches under simulated latency.
- Reconnect tests preserve information permissions.
- Moderation decisions are auditable and reversible.

## Scale: 3–6 months

### Product scope

- Creator profiles, public Dream Collections, and discovery feeds.
- Fair exposure for new works and established collections.
- Internationalized gameplay and safety policy.
- Community moderation roles and transparent governance.

### Technical challenges

- Horizontal room scaling and event ordering.
- Abuse-resistant upload, reporting, and recommendation systems.
- Cost controls for image generation and multimodal inference.
- Privacy-preserving analytics and retention measurement.

### AI integration points

- Offline evaluation of clue difficulty and fallback quality.
- Model-routing based on latency, capability, and budget.
- Moderation assistance with human escalation.
- Maintainer tooling for issue triage, regression generation, and PR risk summaries.

### Exit criteria

- Load and abuse tests have published methodology.
- Provider failure does not stop active rooms.
- Recommendation metrics include creator-distribution fairness.
- Governance supports maintainers beyond the original author.
