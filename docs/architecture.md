# DreamCards Architecture

## Design Goals

DreamCards is structured as an AI narrative game framework rather than a single UI implementation. The architecture must preserve hidden information, tolerate probabilistic AI providers, support UGC governance, and allow realtime transport and storage adapters to change without rewriting game rules.

## System Layers

```text
Client
  |
  | authenticated commands / viewer-specific snapshots
  v
Backend Orchestration
  |
  +--> Core Game Engine ----> State Machine
  |
  +--> AI Service Layer ----> Moderation Layer
  |           |                    |
  |           +--> provider        +--> allow / review / reject
  |           +--> fallback
  |
  +--> Storage Layer
  |
  +--> Realtime Sync Layer
```

### Client

`frontend/` renders only information allowed for the current viewer and phase. It sends intent such as `submit card` or `vote`; it never decides whether a command is legal.

### Backend Orchestration

`backend/` authenticates commands, loads session state, invokes `core/`, calls AI and moderation services, persists accepted changes, and returns viewer-specific snapshots. It owns room membership and authorization but not game-rule definitions.

### Core Game Engine

`core/game-engine/` contains deterministic rules: scoring, self-vote prevention, storyteller restrictions, win limits, and future draw/discard behavior. It has no dependency on HTTP, databases, filesystems, React, or model SDKs.

### State Machine

`core/state-machine/` defines legal transitions:

```text
awaiting_clue
      |
      v
awaiting_cards
      |
      v
awaiting_vote
      |
      v
revealed
      |
      +----> awaiting_clue
```

AI-storyteller rounds include `awaiting_player_card` before `awaiting_cards`.

### AI Service Layer

`ai/` accepts typed tasks and returns validated results. Provider output is untrusted. Prompt construction, provider calls, parsing, card-ID validation, timeout handling, and fallback are separate concerns.

### Moderation Layer

Moderation evaluates uploads, prompts, tags, provider risk signals, and policy rules. Decisions are `allow`, `review`, or `reject`. `review` content must remain quarantined until a human or approved review service resolves it.

### Storage Layer

The current adapter uses SQLite and local files in `backend/data` and `backend/uploads`. Future adapters must preserve card provenance, moderation state, policy version, room snapshots, and idempotency keys.

### Realtime Sync Layer

The demo uses short polling and in-memory rooms. The target design uses:

- authoritative server commands;
- monotonically increasing room versions;
- idempotent action IDs;
- per-player completion state;
- WebSocket event delivery;
- reconnect snapshots filtered by viewer permissions;
- timeout and host-migration policies.

One slow AI or player may delay phase completion, but must not delay acknowledgement of another player's completed action.

## Data Flow

### Player Action

1. Client submits an authenticated command with room and action IDs.
2. Backend checks ownership, room version, phase, and duplicate-action state.
3. Core validates the rule.
4. Backend persists the event and derived snapshot.
5. Realtime layer publishes a permission-filtered update.
6. Other clients see completion status, never hidden card or vote data.

### AI Action

1. Backend creates a task from the permitted game snapshot.
2. AI layer builds a versioned prompt and calls a provider with a timeout.
3. Output is parsed and checked against valid card IDs and rule constraints.
4. Invalid or failed output uses deterministic fallback.
5. Backend commits the result exactly like a human command.

## Card Lifecycle

```text
official / user upload / AI generation
                  |
             provenance
                  |
        validation + moderation
          /        |        \
       allow     review     reject
         |          |
      library    quarantine
         |
      discovery -> collection -> Dream Collection
         |
       match play -> replay interpretation
         |
   archive metrics and community stories
```

Gameplay hides creator identity, tags, sequence, and popularity. Archive and collection views restore provenance after deduction is complete.

## Migration Map

| Previous location | Current location | Migration status |
| --- | --- | --- |
| `client/` | `frontend/` | Complete |
| `server/` | `backend/` | Complete; HTTP and persistence remain compatible |
| duplicated scoring in single/multiplayer | `core/game-engine/scoring.ts` | Complete |
| inline vote checks | `core/game-engine/rules.ts` | Complete |
| implicit phase strings | `core/state-machine/` | Introduced; orchestration adoption continues incrementally |
| `src/ai/fallbackPolicy.ts` | `ai/fallback/` | Complete |
| `src/moderation/cardModeration.ts` | `ai/moderation/` | Complete |
| provider-specific AI service | `backend/services/aiService.ts` | Compatibility adapter; provider interfaces move into `ai/` during Beta |

## Progressive Refactoring Rules

1. Preserve existing API routes while moving implementation behind stable interfaces.
2. Extract deterministic behavior first and cover it with tests.
3. Keep compatibility scripts (`server:dev`, `client:dev`) for one deprecation cycle.
4. Move persistence only after core rules no longer import database types.
5. Introduce realtime events alongside polling before removing polling.
6. Migrate one AI task at a time and retain local fallback for every provider path.
7. Reject pull requests that create reverse dependencies from `core/` into `backend/`, `frontend/`, or `ai/`.
