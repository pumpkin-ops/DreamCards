# DreamCards API

The current API is JSON over HTTP. All game-changing endpoints require authentication unless explicitly marked. Error responses use:

```json
{ "error": "human-readable message" }
```

## Health

### `GET /api/health`

Returns service availability and whether all configured AI profiles are ready.

## AI Framework

### `POST /api/ai/generate-card`

Creates a provider-neutral card artifact.

```json
{
  "mode": "text",
  "textPrompt": "a forgotten station between dreams",
  "imagePrompt": ""
}
```

Response:

```json
{
  "ok": true,
  "artifact": {
    "imageUrl": "/uploads/dream-fallback-2.svg",
    "narrativeText": "醒来之前",
    "tags": ["forgotten", "station"],
    "safetyScore": 1,
    "source": "fallback",
    "moderation": {
      "status": "allow",
      "reasons": [],
      "policyVersion": "2026-06-13"
    }
  }
}
```

`source` is `provider`, `fallback`, or `cache`. A provider failure must not change the response shape.

### `POST /api/ai/moderate`

```json
{
  "prompt": "quiet surreal landscape",
  "tags": ["dream", "moon"],
  "nsfwScore": 0.03
}
```

Returns `allow`, `review`, or `reject`, a safety score, policy version, and machine-readable reasons. Rejected content returns HTTP `422`.

### `POST /api/ai/fallback`

```json
{
  "clue": "未寄出的回声",
  "cards": [
    { "id": "card_1", "tags": ["memory", "ocean"] }
  ],
  "excludedCardIds": []
}
```

Returns a deterministic valid card ID without an external model request.

### Existing AI Player Endpoints

- `POST /api/ai/choose-card`
- `POST /api/ai/generate-clue`
- `POST /api/ai/vote-card`

These remain compatibility endpoints while provider orchestration is migrated into `ai/`.

## Card Upload

### `POST /api/cards`

Multipart fields:

- `image`: JPEG, PNG, or WebP, maximum 8 MB.
- `tags`: optional backend-only metadata.

The upload is not published directly. It passes source review, DreamCards-style image-to-image generation, result review, and only then creates a card record.

Successful response:

```json
{
  "ok": true,
  "card": {
    "imageUrl": "/uploads/dreamcard-xxx.webp",
    "sourceType": "user-ai-restyled",
    "moderationStatus": "approved",
    "generationSource": "image-model",
    "styleVersion": "dreamcards-v1"
  },
  "pipeline": {
    "generationSource": "image-model",
    "stages": [
      { "id": "preflight", "status": "passed" },
      { "id": "source_review", "status": "passed" },
      { "id": "style_generation", "status": "passed" },
      { "id": "result_review", "status": "passed" },
      { "id": "published", "status": "passed" }
    ]
  }
}
```

The original temporary file is deleted whether the pipeline succeeds or fails.

## Single Player

- `POST /api/single-player/start`
- `GET /api/single-player/:sessionId`
- `POST /api/single-player/submit-clue`
- `POST /api/single-player/submit-player-card`
- `POST /api/single-player/submit-vote`
- `POST /api/single-player/next-round`

AI tasks complete independently. Polling snapshots expose per-player submitted/voted state without exposing hidden choices.

## Matchmaking and Multiplayer

- `GET /api/matchmaking/status`
- `POST /api/matchmaking/join`
- `POST /api/matchmaking/leave`
- `POST /api/multiplayer/clue`
- `POST /api/multiplayer/card`
- `POST /api/multiplayer/vote`
- `POST /api/multiplayer/next-round`

Current multiplayer storage is process-local. Do not treat these endpoints as horizontally scalable until room persistence, idempotency, and reconnect versions are implemented.

## Versioning Policy

The prototype uses `/api` without a numeric version. Before Beta, public framework endpoints will move to `/api/v1`; compatibility routes will remain for one documented release cycle.
