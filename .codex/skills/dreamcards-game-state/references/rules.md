# DreamCards Round Rules

## State Machine

### Human storyteller

`awaiting_clue` -> submit clue and story card -> AI followers submit -> `awaiting_vote` -> non-storytellers vote -> `revealed` -> refill -> next round.

### AI storyteller

Create AI clue and remove the AI story card from its hand -> `awaiting_player_card` -> human drags a card and remaining AI followers submit -> `awaiting_vote` -> votes -> `revealed` -> refill -> next round.

## Scoring

- If everyone or nobody guesses the storyteller card, each non-storyteller receives 2.
- Otherwise, storyteller receives 3 and each correct voter receives 3.
- Each vote attracted by a non-storyteller card gives that card's player 1.

## Round Memory

Store:

- round id
- clue
- storyteller
- cards
- votes
- score delta
- cumulative scores
- private inspirations
- explicitly shared inspirations

Notes and private inspirations must not become public merely because the round resolved.

