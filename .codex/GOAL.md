# DreamCards Project Goal

## Final Objective

Complete a playable AI-assisted, Dixit-inspired web game that looks and feels close to a commercial-quality demo.

The finished demo must let a player complete multiple rounds with three AI players while remaining immersed in one dreamlike table. Images, association, storytelling, and post-round discussion are the product center. UI, rules, AI, and visual assets must work together as one coherent experience.

## Demo-Ready Definition

DreamCards is demo-ready when:

- A new user can start a game without setup guidance.
- A complete four-player round works from clue through result and next round.
- Storyteller rotation, card consumption, drawing, voting, and scoring are correct.
- AI play remains functional with or without a configured model API.
- The active game feels like a shared tabletop, not a dashboard or form workflow.
- Cards and artwork dominate the visual hierarchy.
- Hover, enlargement, drag-to-play, voting, result, and replay interactions feel deliberate.
- No private card metadata, AI tags, or hidden inspiration content leaks into gameplay.
- The project builds cleanly and the critical flow is manually verified at desktop and narrow viewport sizes.

## Product Principles

1. Images are the primary information.
2. Stories matter more than scores.
3. Players stay spatially anchored around one table.
4. Private inspiration supports creativity without leaking strategy.
5. AI failure must degrade gracefully, never stop the game.
6. Every iteration must improve a playable demo, not merely increase feature count.

## Technical Baseline

- Frontend: React, TypeScript, TailwindCSS, Vite
- Backend: Node.js, Express
- Database: SQLite
- Images: local upload directory for this stage
- AI: OpenAI-compatible API with local fallback

## Out of Scope

- NFT, blockchain, payments
- Complex account systems
- Production matchmaking
- Real-time multiplayer networking
- Monetization work that does not improve the demo

