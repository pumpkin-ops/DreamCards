# DreamCards Demo Script

## Start

1. Run `npm run dev`.
2. Open `http://127.0.0.1:5173`.
3. Enter single-player mode and start the four-player game.

## Three-Minute Walkthrough

1. Hover across the hand to show the fan lift, scale, and warm edge glow.
2. Click a card to open the large artwork and private inspiration notebook.
3. Close the artwork, then drag a card from the hand onto the table.
4. When the human is storyteller, choose an inspiration or enter a short clue and confirm the card.
5. In voting, show that the human's own card is unavailable, then vote for another image.
6. Reveal the round result: card ownership, crown, vote avatars, correctness mark, and score deltas are visible without explanatory panels.
7. Continue to the next round to demonstrate storyteller rotation and hand refill.

## Visual Checkpoints

- Opponents remain fixed around the table and never cover the central cards.
- Images remain the strongest visual element at 1024x768 through 1920x1080.
- No card title, tag, creator, or sequence appears during play.
- The page does not scroll during active phases.
- Inspiration notes remain private until replay.
