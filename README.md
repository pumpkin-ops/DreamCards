# DreamCards

**AI-powered UGC storytelling card game for image-based social deduction.**

DreamCards is an open-source multiplayer narrative card game where players bring image collections, create ambiguous clues, submit misleading cards, vote, and discuss how the same image produced different stories. It combines an AI-assisted UGC pipeline, three card sources (player uploads, AI-generated art, and curated official sets), social storytelling rules, and a moderation-first content model.

[![CI](https://github.com/pumpkin-ops/DreamCards/actions/workflows/ci.yml/badge.svg)](https://github.com/pumpkin-ops/DreamCards/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Demo](https://img.shields.io/badge/demo-live-2f855a)](https://dreamcards-psi.vercel.app)

[Play the demo](https://dreamcards-psi.vercel.app) · [Read the design docs](docs/portfolio/) · [View the roadmap](ROADMAP.md) · [Contribute](CONTRIBUTING.md)

![DreamCards table](assets/screenshots/table.png)

> Demo GIF placeholder: replace `assets/demo.gif` when the next recorded gameplay walkthrough is ready.

## Why DreamCards?

Most image-association games treat cards as a fixed content library. DreamCards treats every image as a persistent community artifact: it can be created, discovered, collected, curated into a Dream Collection, played in matches, and enriched by new clues, interpretations, and stories.

The project explores four difficult open-source problems together:

- **AI UGC system**: multimodal models help generate clues, choose cards, and vote without becoming the source of truth.
- **Multi-source card generation**: player uploads, AI-generated cards, and curated official cards share one identity and provenance model.
- **Social storytelling gameplay**: hidden information, asynchronous player state, scoring, replay, and discussion must remain understandable.
- **Moderation and safety layer**: user-generated images require preflight validation, review states, reporting, provenance, and auditable policy decisions.

## Features

- Four-player storyteller, submission, anonymous voting, reveal, scoring, and next-round flow.
- Single-player mode with three image-capable AI players.
- Per-player asynchronous state: one slow AI does not block the player's local feedback.
- Deterministic local AI fallback when a provider is missing, rate-limited, invalid, or slow.
- Player-created Dream Collections with ten cards and a persistent creator signature.
- Discovery, collection, card archive, inspiration drafts, and replay-room concepts.
- Image-only gameplay: titles, tags, creator identity, and popularity are hidden during deduction.
- Upload preflight for media type, file size, and blocked metadata.
- Local SQLite development storage with a server abstraction suitable for future cloud migration.
- English OSS governance and Chinese portfolio-grade design documentation.

## Gameplay Loop

```text
Choose Dream Collection
        |
Storyteller selects an image and writes a clue
        |
Other players submit misleading images
        |
Cards are shuffled and shown anonymously
        |
Non-storytellers vote (never for their own card)
        |
Reveal ownership, vote flow, and score changes
        |
Discard, draw back to six, rotate storyteller
```

The match ends after the current round when a player reaches 30 points.

## Architecture

```text
┌──────────────────────── frontend/ ────────────────────────┐
│ React + TypeScript table UI, collection, replay, matching │
└─────────────────────────────┬──────────────────────────────┘
                              │ HTTP / JSON
┌──────────────────────── server/ ──────────────────────────┐
│ Express API · auth · rooms · SQLite · AI orchestration    │
└──────────────┬──────────────────────────┬──────────────────┘
               │                          │
┌──────────── src/ ────────────┐   ┌──── AI providers ─────┐
│ Moderation policy            │   │ Vision model calls     │
│ Deterministic AI fallback    │   │ Timeout + validation   │
│ Framework-independent rules  │   │ Local fallback         │
└──────────────┬───────────────┘   └────────────────────────┘
               │
┌──────────── tests/ ──────────┐
│ Node test runner + TSX       │
└──────────────────────────────┘
```

See [Architecture](docs/ARCHITECTURE.md), [Moderation](docs/MODERATION.md), and [AI fallback design](docs/AI_FALLBACK.md).

## Repository Structure

| Path | Responsibility |
| --- | --- |
| `frontend/` | React user experience, game table, collections, matching, and replay UI |
| `server/` | Express API, authentication, SQLite access, multiplayer sessions, and AI orchestration |
| `src/` | Framework-independent moderation and AI fallback policies |
| `docs/` | Architecture, safety, portfolio, design, and maintenance documentation |
| `examples/` | Provider configuration and integration examples |
| `assets/` | Public screenshots and documentation media |
| `tests/` | Unit tests for shared rules and safety-critical behavior |
| `.github/` | CI workflows, Issue forms, and pull-request templates |

## Quick Start

### Prerequisites

- Node.js 22 or newer
- npm 10 or newer

### Install and run

```bash
git clone https://github.com/pumpkin-ops/DreamCards.git
cd DreamCards
npm install
cp .env.example .env
npm run dev
```

PowerShell users can replace `cp` with `Copy-Item`.

Open:

- Frontend: `http://localhost:5173`
- API health check: `http://localhost:4000/api/health`

No model key is required. Without one, DreamCards uses the deterministic local fallback policy.

### Optional AI configuration

Configure a GitHub Models token with `Models: read`:

```env
GITHUB_MODELS_TOKEN=github_pat_your_token
GITHUB_MODELS_BASE_URL=https://models.github.ai/inference
AI_TIMEOUT_MS=9000
```

Never commit `.env`. See [examples/ai-provider.env.example](examples/ai-provider.env.example).

## Development Commands

```bash
npm run dev       # frontend and server
npm run lint      # ESLint
npm test          # unit tests
npm run build     # TypeScript + production frontend build
npm run check     # lint + test + build
```

## Moderation and Safety

The current pipeline is intentionally layered:

1. Validate upload count, file size, and supported raster MIME type.
2. Reject blocked metadata before creating a public card record.
3. Keep card provenance and creator identity outside hidden-information gameplay.
4. Reserve explicit `review` and `reject` states for future image-model and human review.
5. Treat model output as untrusted: parse, validate, constrain, timeout, and locally degrade.

This is a foundation, not a claim of production-grade content safety. Public deployments must add image-content classification, reporting, appeals, audit logs, and human review. See [MODERATION.md](docs/MODERATION.md).

## Roadmap

### MVP: 1–2 weeks

- Stabilize the four-player state machine and 30-point match ending.
- Expand tests for scoring, self-vote prevention, card uniqueness, and fallback behavior.
- Complete upload moderation states and contributor-facing architecture docs.

### Beta: 1–2 months

- WebSocket rooms, reconnect snapshots, authoritative server state, and timeout takeover.
- AI/player behavior telemetry with opt-in privacy controls.
- Report, review, quarantine, and appeal flows for UGC cards.
- Provider adapters for image generation and multimodal reasoning.

### Scale: 3–6 months

- Cloud database and object storage adapters.
- Moderation queues, audit logs, policy versioning, and reviewer tools.
- Recommendation fairness for new and established creators.
- Load tests, abuse tests, internationalization, and community governance.

See the detailed [ROADMAP.md](ROADMAP.md).

## Project Status

DreamCards is a playable research/demo project, not a production service.

Known limitations:

- Multiplayer rooms currently use short polling and in-memory process state.
- Local SQLite and filesystem uploads are not suitable for horizontally scaled hosting.
- Automated image-content moderation and appeals are not complete.
- Long-term balance and retention have not been validated with a large player sample.

## Contributing

Start with [CONTRIBUTING.md](CONTRIBUTING.md) and check issues labeled `good first issue` or `help wanted`.

AI-assisted contributions are welcome, but contributors remain responsible for:

- understanding generated changes;
- disclosing material AI assistance in the PR;
- adding tests for behavioral changes;
- avoiding secrets, copyrighted assets, and unreviewed generated content.

## Security

Do not report vulnerabilities in public issues. Follow [SECURITY.md](SECURITY.md).

## Governance

Decision-making, maintainer responsibilities, and escalation paths are documented in [GOVERNANCE.md](GOVERNANCE.md).

## License

Licensed under the [Apache License 2.0](LICENSE).

Game rules and code are original to this repository. The project does not include or distribute Dixit trademarks, official artwork, or proprietary assets.
