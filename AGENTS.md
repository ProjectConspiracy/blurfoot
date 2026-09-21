# Blurfoot agent notes

Read these files before changing the project:

1. `README.md` for setup, controls, and the current player-facing description.
2. `docs/HANDOFF.md` for product intent, architecture, verified state, known gaps, and the continuation roadmap.

Project rules:

- The GitHub repository at `https://github.com/ProjectConspiracy/blurfoot.git` is the shared source of truth. Initial baseline commit `a8a2fc7` is confirmed on remote `main`.
- Preserve the repository's original license commit `8c00bbe000c0d2e14665516ca95a8af6b43d17e6` in history.
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

The slow-water and sight-cone increment is functionally verified: water is traversable at 35% speed, the three crossings remain normal speed, June Bowl is traversable, rocks remain solid, and visible cones clip against real sight occluders without changing detection. See `docs/PLAYTEST-2026-09-21.md` for route and ending evidence. A human feel check still remains.

The project is ready for the first custom Bigfoot art-direction pass. Lock perspective, silhouette, scale, palette, and animation needs with the user before creating or importing an asset. Do not start asset production until that direction is approved.

The user prefers publishing through GitHub Desktop because terminal Git selects the wrong GitHub account. Leave pushes to the user, do not change global credential settings, and never force-push or overwrite remote history.
