# Architecture

## Design goals

- Keep player actions responsive even when AI providers are slow.
- Keep hidden information server-authoritative.
- Treat model output and UGC input as untrusted.
- Keep core policy testable without React, Express, SQLite, or network access.

## Layers

```text
frontend/
  React views and player interaction
        |
        v
server/
  HTTP transport, auth, rooms, persistence, AI orchestration
        |
        +------------------+
        v                  v
src/                    provider APIs
  pure policies           multimodal inference
  moderation              structured output
  fallback                 timeouts
        |
        v
tests/
  deterministic policy and rule verification
```

## State ownership

The server owns:

- phase transitions;
- legal submissions and votes;
- storyteller rotation;
- card ownership and uniqueness;
- score calculation;
- information released to each player.

The frontend owns presentation and immediate local interaction feedback, but it must not infer hidden truth from UI state.

## Asynchronous player state

Individual completion and global progression are separate:

```text
player submits -> player state updates immediately
AI A completes -> AI A state updates
AI B completes -> AI B state updates
all required actors complete -> phase transition
```

A single provider failure falls back for that one action. It does not roll back completed player actions.

## Current deployment boundary

The repository uses SQLite, local files, in-memory rooms, and short polling for the demo. Production multiplayer requires durable storage, object storage, WebSocket events, idempotent commands, reconnect snapshots, and server-authoritative authorization.
