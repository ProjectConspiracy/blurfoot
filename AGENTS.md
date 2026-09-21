# Blurfoot agent notes

Read these files before changing the project:

1. `README.md` for setup, controls, and the current player-facing description.
2. `docs/HANDOFF.md` for product intent, architecture, verified state, known gaps, and the continuation roadmap.

Project rules:

- `/Users/face/utils/blurfoot` remains the source of truth until the user pushes the prepared local `main` branch to GitHub.
- The GitHub repository is `https://github.com/ProjectConspiracy/blurfoot.git`. Its existing license-only commit `8c00bbe000c0d2e14665516ca95a8af6b43d17e6` must remain in history.
- The project license is **GPL-3.0-only**.
- Preserve the focused scope: top-down stealth, directional cameras, hikers, cover, photographs, and the trip home to High Den. Do not add unrelated mechanics without user approval.
- The title is **Blurfoot**. Story references to Bigfoot describe the character and are intentional.
- Cameras are optional hazards. Reaching High Den wins; disabling all five adds the **No Evidence Left** bonus.
- Humans should remain few and concentrated around believable lower-forest activity hubs.
- Placeholder geometry is intentional until playtesting and tuning are stable.
- Keep game rules renderer-independent where practical. Add tests for rule or level-data changes.
- Before reporting completion, run `npm test`, `npm run typecheck`, and `npm run build`. Browser-facing changes also require a real browser smoke test.
- Do not commit `node_modules/`, `dist/`, `.playwright-cli/`, or `.DS_Store`.
- Do not deploy, publish, or modify the Project Conspiracy website without confirming its authoritative checkout and the user-approved release scope.

The local baseline is prepared on top of the existing GitHub license commit. For this initial publication, the user retains responsibility for `git push -u origin main`; leave that push to them. Never force-push or overwrite remote history.
