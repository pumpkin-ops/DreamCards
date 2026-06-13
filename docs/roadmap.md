# DreamCards Roadmap

The roadmap is organized around maintainable framework capabilities, not feature volume.

## MVP: 1–2 Weeks

### Features

- Finish migration to `frontend/`, `backend/`, `core/`, and `ai/`.
- Use shared scoring, vote validation, and state transitions in both game modes.
- Stabilize the 30-point match end and draw/discard lifecycle.
- Publish API contracts, architecture boundaries, contribution templates, and deterministic fixtures.
- Add moderation states to generated artifacts and uploaded cards.

### Technical Challenges

- Removing duplicated rules without changing current player-visible behavior.
- Preserving serverless and local filesystem paths after backend migration.
- Making test fixtures independent of SQLite and external models.
- Defining a quarantine state without prematurely building a full reviewer product.

### AI Integration

- Text, image, and hybrid generation input contract.
- Provider-neutral output validation.
- Prompt filtering, risk score, allow/review/reject decisions.
- Rule-based, tag-similarity, and cached-card fallback.

### Exit Criteria

- CI passes lint, tests, build, secret scan, and production dependency audit.
- At least 20 deterministic tests cover scoring, voting, phases, fallback, and moderation.
- No external API key is required to complete a local match.

## Beta: 1–2 Months

### Features

- Authoritative WebSocket rooms with polling compatibility.
- Reconnect snapshots, action idempotency, timeout policy, and room versioning.
- Provider adapter registry for multimodal reasoning and image generation.
- UGC report, quarantine, reviewer decision, appeal, and audit-log workflow.
- Public example integration and first tagged release.

### Technical Challenges

- Race conditions between player actions, AI completion, reconnects, and timeouts.
- Viewer-specific information filtering for every event.
- Moderation policy versioning and reversible decisions.
- Testable provider behavior without live network calls.

### AI Integration

- Recorded provider fixtures and contract tests.
- Prompt version IDs and evaluation datasets.
- AI behavior profiles with bounded creativity.
- Moderation assistance that never makes irreversible decisions without policy authorization.

### Exit Criteria

- Reconnect does not expose hidden cards or votes.
- One provider outage cannot block room progression.
- Moderation actions are attributable and auditable.
- At least one external contributor completes a reviewed PR.

## Scale: 3–6 Months

### Features

- PostgreSQL-compatible persistence and object-storage adapters.
- Durable event log, moderation queues, and replay snapshots.
- Recommendation and discovery controls for new and established creators.
- Localization, accessibility, abuse testing, load testing, and community governance.
- Framework package extraction for third-party narrative games.

### Technical Challenges

- Horizontal room ownership and ordered event delivery.
- Content deduplication, provenance, copyright reporting, and retention policy.
- Recommendation feedback loops and creator exposure fairness.
- Cost controls across generation, vision inference, storage, and review.

### AI Integration

- Provider routing by latency, cost, capability, and policy.
- Offline evaluation for clue ambiguity and vote behavior.
- Safety ensemble with calibrated review thresholds.
- Codex-assisted triage, regression-test drafting, documentation synchronization, and PR risk summaries.

### Exit Criteria

- Defined service-level objectives and cost budgets.
- Reproducible load and abuse-test reports.
- Public governance and release process used across multiple versions.
- Evidence of downstream use beyond the original DreamCards UI.
