# Backend

The Express backend is responsible for:

- local authentication and command authorization;
- card, collection, and Dream Collection persistence;
- single-player and multiplayer session orchestration;
- invoking deterministic rules from `core/`;
- AI provider orchestration through contracts in `ai/`;
- upload storage and moderation enforcement;
- viewer-specific hidden-information snapshots.

The backend must not redefine scoring or voting rules already owned by `core/`. SQLite, filesystem uploads, polling, and in-memory rooms are development adapters. See `docs/architecture.md` for target realtime and storage boundaries.
