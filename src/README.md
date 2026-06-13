# Shared domain modules

This directory contains framework-independent rules used by the server and test suite.

- `ai/`: deterministic fallback policies and AI behavior contracts.
- `moderation/`: upload preflight decisions and moderation state definitions.

Code in `src/` must not depend on Express, React, SQLite, or a specific model provider. This keeps core policies testable and reusable across local, serverless, and future multiplayer deployments.
