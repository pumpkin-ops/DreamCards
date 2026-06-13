# Core

`core/` is the framework-independent DreamCards rules package.

- `game-engine/`: scoring, vote constraints, win conditions, and future deck lifecycle rules.
- `state-machine/`: legal round phases and transitions.

The module must not import Express, React, SQLite, filesystem APIs, or AI providers. Both single-player and multiplayer orchestration depend on this layer so rule changes have one implementation and one test surface.
