# Security Policy

## Supported version

DreamCards is pre-1.0. Security fixes are applied to the current `main` branch.

## Reporting a vulnerability

Do not open a public issue for:

- authentication or session bypass;
- hidden card, clue, or vote disclosure;
- arbitrary file upload or path traversal;
- credential exposure;
- moderation bypass with material harm;
- remote code execution, injection, or data loss.

Email `2819092941@qq.com` with:

- affected commit or deployment;
- reproduction steps;
- impact;
- proof of concept, if safe;
- suggested remediation.

You should receive an acknowledgement within seven days. Please allow maintainers reasonable time to investigate before public disclosure.

## Secret handling

- `.env` is ignored and must never be committed.
- Use least-privilege provider tokens.
- Revoke credentials immediately if exposed.
- Tests and CI must work without production secrets.

## Current security limitations

- Local SQLite and filesystem uploads are development defaults.
- Multiplayer state is not yet a hardened, authoritative distributed service.
- The current moderation layer is preflight validation, not complete image-content safety review.
