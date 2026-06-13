# DreamCards AI Contract

## Environment

```env
AI_PROVIDER=siliconflow
AI_API_KEY=
AI_BASE_URL=https://api.siliconflow.cn/v1
AI_MODEL=Qwen/Qwen3-8B
```

Equivalent OpenAI-compatible endpoints may be used for OpenRouter or DashScope. Credentials remain server-only.

## Stable Results

```ts
type ChooseCardResult = {
  cardId: string;
  reason: string;
  source: "model" | "fallback";
};

type GenerateClueResult = {
  clue: string;
  reason: string;
  source: "model" | "fallback";
};

type VoteCardResult = {
  votedCardId: string;
  reason: string;
  source: "model" | "fallback";
};
```

## Validation Order

1. Normalize the returned ID.
2. Check membership in the authoritative valid set.
3. Exclude the AI's own card for votes.
4. Require non-empty clue text.
5. Fall back if any check fails.

The frontend must never branch on provider-specific responses.

