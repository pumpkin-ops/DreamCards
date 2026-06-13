export type FallbackCard = {
  id: string;
  cardId?: string;
  tags?: string[];
};

const FALLBACK_CLUES = [
  "未寄出的回声",
  "醒来之前",
  "遥远的归途",
  "被时间忘记",
  "另一种孤独",
  "故事没有结尾"
];

export function chooseFallbackCard<T extends FallbackCard>(
  clue: string,
  cards: T[],
  excludedCardIds: string[] = []
): T | undefined {
  const excluded = new Set(excludedCardIds);
  const candidates = cards.filter((card) => !excluded.has(card.id));
  if (candidates.length === 0) return undefined;

  const clueTokens = tokenize(clue);
  return [...candidates].sort((left, right) => {
    const scoreDifference = scoreCard(right, clueTokens) - scoreCard(left, clueTokens);
    if (scoreDifference !== 0) return scoreDifference;
    return stableHash(`${clue}:${left.id}`) - stableHash(`${clue}:${right.id}`);
  })[0];
}

export function generateFallbackClueForCard(card: FallbackCard) {
  const seed = `${card.cardId ?? card.id}:${(card.tags ?? []).join("|")}`;
  return FALLBACK_CLUES[stableHash(seed) % FALLBACK_CLUES.length];
}

function tokenize(value: string) {
  return [...new Set(value.toLowerCase().split(/[\s,，。；;！？!?、]+/).filter(Boolean))];
}

function scoreCard(card: FallbackCard, tokens: string[]) {
  const haystack = `${card.cardId ?? card.id} ${(card.tags ?? []).join(" ")}`.toLowerCase();
  return tokens.reduce((score, token) => score + (haystack.includes(token) ? 2 : 0), 0);
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
