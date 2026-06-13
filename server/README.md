# Server

Express service responsible for:

- local authentication;
- card, collection, and Dream Collection persistence;
- single-player and multiplayer state;
- legal phase transitions and scoring;
- AI provider orchestration;
- upload storage and moderation preflight.

The current SQLite, filesystem, polling, and in-memory room implementations are development defaults. See `docs/ARCHITECTURE.md` for production boundaries.
