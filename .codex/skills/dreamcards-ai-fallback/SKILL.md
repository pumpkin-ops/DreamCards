---
name: dreamcards-ai-fallback
description: Implement and audit DreamCards AI-player behavior through OpenAI-compatible providers with reliable local fallback. Use when changing `server/services/aiService.ts`, model/provider configuration, clue generation, card choice, voting, JSON parsing, result validation, AI API routes, mock cards, error handling, or behavior when no API key, network access, valid JSON, or valid card ID is available.
---

# DreamCards AI Fallback

AI enhances the game but must never be required for a playable round.

## Workflow

1. Keep provider initialization in `server/services/aiService.ts`.
2. Read configuration only from environment variables.
3. Build a deterministic valid fallback before calling the model.
4. Request JSON-only output.
5. Parse loosely, validate strictly, and fall back on any failure.
6. Return the same stable result shape for model and fallback paths.
7. Exercise the game with no API key.

Read [references/ai-contract.md](references/ai-contract.md) before adding providers or changing prompts.

## Required Behaviors

- Support SiliconFlow, OpenRouter, and DashScope through `baseURL`, API key, and model configuration.
- Never hardcode credentials or expose them to the frontend.
- `chooseCardByClue` must return an ID from the supplied hand.
- `voteCardByClue` must return an ID from candidates excluding `ownCardId`.
- `generateClue` must return a non-empty, indirect clue.
- Recover from fenced JSON, surrounding prose, malformed JSON, missing fields, invalid IDs, timeouts, HTTP failures, and absent configuration.
- Include `source: "model" | "fallback"` for observability.
- Keep long AI explanations hidden from normal gameplay UI.
- Keep backend tags available to AI but absent from public card payloads.

## Fallback Quality

- Prefer tag/clue affinity plus randomness over pure first-card selection.
- Always validate fallback candidates against current authoritative cards.
- Handle empty arrays without throwing.
- Never let AI failure block phase progression.

## Verification

- Run with `AI_API_KEY` absent.
- Test invalid model card IDs.
- Test model text wrapped in Markdown fences.
- Test voting with the AI's own card among candidates.
- Confirm each API returns a stable JSON structure.
- Run `npm run build`.

