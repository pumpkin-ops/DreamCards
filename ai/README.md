# AI Service Layer

The AI layer treats every model response as untrusted input.

- `generation/`: text, image, and hybrid card-generation pipeline.
- `prompts/`: versionable prompt builders without provider credentials.
- `fallback/`: deterministic local card choice, clue generation, and cached-art reuse.
- `moderation/`: upload validation, prompt filtering, risk scoring, and review decisions.

Provider adapters may fail, timeout, or return invalid output. Callers must always receive a stable result or a typed rejection; model availability must never block the game state machine.
