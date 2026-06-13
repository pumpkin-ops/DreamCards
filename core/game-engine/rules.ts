export type VoteValidationInput<PlayerId extends string = string, CardId extends string | number = string> = {
  voterId: PlayerId;
  storytellerId: PlayerId;
  targetCardId: CardId;
  submissions: Array<{ playerId: PlayerId; cardId: CardId }>;
  existingVoterIds?: PlayerId[];
};

export function validateVote<PlayerId extends string, CardId extends string | number>(
  input: VoteValidationInput<PlayerId, CardId>
) {
  if (input.voterId === input.storytellerId) return { valid: false, reason: "storyteller_cannot_vote" } as const;
  if (input.existingVoterIds?.includes(input.voterId)) return { valid: false, reason: "duplicate_vote" } as const;

  const target = input.submissions.find((submission) => submission.cardId === input.targetCardId);
  if (!target) return { valid: false, reason: "target_not_found" } as const;
  if (target.playerId === input.voterId) return { valid: false, reason: "self_vote" } as const;

  return { valid: true } as const;
}
