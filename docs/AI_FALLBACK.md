# AI Fallback Design

## Goal

AI should enrich a match but must never be required for the match to continue.

## Provider contract

Every AI action returns:

- a legal card or clue value;
- a short reason for replay/debugging;
- `source: "model" | "fallback"`.

## Failure handling

```text
provider request
  -> hard timeout
  -> loose JSON extraction
  -> schema and legal-target validation
  -> accept model result
       or
     deterministic local fallback
```

Fallback occurs for:

- missing credentials;
- network failure;
- provider rate limit;
- timeout;
- malformed JSON;
- invalid card ID;
- image read or conversion failure.

## Deterministic policy

`src/ai/fallbackPolicy.ts`:

- scores cards by clue/tag overlap;
- excludes illegal targets such as the AI player's own card;
- uses a stable hash for ties;
- generates a short clue from a stable, bounded phrase set.

Determinism makes tests reproducible and prevents silent behavior drift.

## Safety boundary

The model never decides:

- whether a vote is legal;
- whether a card belongs to a player;
- whether a phase can advance;
- whether UGC is finally approved;
- how points are calculated.

Those decisions remain in deterministic application code.
