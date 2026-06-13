# Contributing to DreamCards

Thank you for helping build an open, safe, image-based storytelling game.

## Before opening work

1. Search existing issues and discussions.
2. Open an issue for changes that affect game rules, stored data, moderation policy, or public APIs.
3. Keep pull requests focused on one reviewable outcome.
4. Do not include copyrighted card art, personal data, API keys, or production credentials.

## Local setup

```bash
npm install
copy .env.example .env
npm run check
npm run dev
```

AI credentials are optional. Tests must pass without external model access.

## Repository boundaries

- `frontend/`: user-facing React code.
- `backend/`: transport, persistence, sessions, and orchestration.
- `core/`: framework-independent game rules and state transitions.
- `ai/`: prompts, provider contracts, fallback, generation, and moderation.
- `tests/`: deterministic tests that do not call external services.
- `docs/`: architecture, moderation, gameplay, and maintenance decisions.

Shared rules belong in `core/` and must be testable without Express, React, SQLite, or model access. AI policy belongs in `ai/`; provider credentials and transport concerns remain in `backend/`.

## Pull request requirements

- Explain the player or maintainer problem.
- Describe the chosen approach and alternatives considered.
- Add or update tests for behavior changes.
- Run `npm run check`.
- Document new environment variables and migration steps.
- Identify moderation, privacy, hidden-information, or multiplayer-state impact.
- Include screenshots for visible UI changes.

## AI-assisted contributions

AI-assisted work is welcome. In the PR:

- disclose substantial AI assistance;
- name the areas generated or reviewed by AI;
- verify licenses and provenance for generated assets;
- confirm that you read and tested the final change;
- never paste private prompts, credentials, user content, or security reports into a third-party model.

The human contributor remains accountable for correctness and licensing.

## Design review triggers

Maintainer approval is required before merging changes to:

- scoring and win conditions;
- information visibility or vote secrecy;
- AI prompts and fallback behavior;
- card identity or creator provenance;
- moderation states or policy terms;
- authentication, room authority, or reconnect behavior.

## Commit and PR style

Use imperative, scoped summaries:

```text
Add deterministic fallback selection tests
Prevent storyteller identity leakage
Document moderation review states
```

## Feature workflow

1. Open an issue that defines the maintainer or player problem.
2. Identify affected boundaries: `game-core`, AI, moderation, storage, realtime, or UI.
3. Record alternatives and rejected approaches for rule, schema, or public API changes.
4. Agree on acceptance criteria and deterministic tests.
5. Submit a focused PR with migration and rollback notes.
6. Update architecture, API, examples, or roadmap files when contracts change.

## Coding conventions

- TypeScript strict mode is required.
- Prefer pure functions in `core/` and typed dependency injection in `ai/`.
- Treat external model output and client input as untrusted.
- Keep hidden-information filtering on the backend.
- Avoid provider-specific types in public framework contracts.
- New fallible integrations require timeout, validation, and fallback behavior.

## Code of conduct and security

Participation is governed by [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). Report vulnerabilities through [SECURITY.md](SECURITY.md), not public issues.
