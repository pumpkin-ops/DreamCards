# Migration Notes

The former shared `src/` directory was split into explicit framework boundaries:

- AI fallback and moderation moved to `ai/`.
- Shared scoring, vote constraints, and state transitions moved to `core/`.

Compatibility HTTP routes remain in `backend/` while orchestration is gradually rewritten around these pure modules. See `docs/architecture.md` for the migration table and dependency rules.
