# Blurfoot project handoff

Last updated: 2026-09-21

This document is the canonical transfer note for the standalone Blurfoot game. It consolidates the design decisions, implementation state, recovery history, architecture, verification evidence, known gaps, and recommended continuation order that previously lived across one long Codex task and an unavailable Desktop workspace.

## 1. Start here

| Item | Current state |
| --- | --- |
| Standalone source of truth | GitHub `main`; current continuation work is in `/Users/face/utils/blurfoot` until the user publishes it |
| Git | Initial baseline commit `a8a2fc7` is confirmed on remote `main` |
| GitHub remote | `https://github.com/ProjectConspiracy/blurfoot.git` (`origin`) |
| Preserved remote commit | `8c00bbe000c0d2e14665516ca95a8af6b43d17e6` |
| License | GPL-3.0-only |
| Current increment | Slow water, route/ending regression coverage, and clipped visible sight cones are implemented |
| Next product task | Lock the first Bigfoot art direction with the user before creating the asset |
| Package/browser/title-screen name | `Blurfoot` |
| Character terminology | Story and accessibility text still call the creature Bigfoot intentionally |
| Package version | `0.0.0` |
| Backend | None |
| Project Conspiracy integration | Not performed |
| Static output | Generated `dist/`, ignored by Git |
| Local preview | Start it with `npm run dev -- --host 127.0.0.1 --port 5174 --strictPort` |
| Beta status | Playable beta candidate, not yet a deployed beta |

The preview server is not guaranteed to be running when a new task begins. The browser tab at `http://127.0.0.1:5174/` may therefore be stale until the command above is run.

## 2. Product intent to preserve

These decisions came directly from user feedback and should be treated as the product brief unless the user changes them:

- The game title is **Blurfoot**.
- The story hook is **Back to the High Den**. A lookout squatch's three knocks warn that humans have entered the lower forest. Bigfoot is trying to get home through their lights, cameras, and “rotten-mustard stink.”
- There is deliberately no “before daylight” deadline.
- The world is a fictional, compressed Mount St. Helens south-flank journey, not literal geography.
- The forest should feel much larger than one screen and support navigation with a minimap.
- Humans should be relatively few and clustered around believable activity hubs, not sprinkled across the whole forest. The current fiction reads as a focused Bigfoot-search/hunter camp around an access road and old logging spur.
- Trail cameras are optional hazards. Bigfoot can reach High Den with cameras still active. Disabling all five earns the distinct **No Evidence Left** bonus.
- Trail cameras are mounted to tree trunks and face a clear direction. A side or rear approach is safer; crossing their front cone risks a photograph.
- Side/rear disabling is an emergent safety choice, not a hard interaction rule. Any angle within interaction range can disable a camera if Bigfoot survives the exposure.
- Placeholder geometry is intentional until movement, navigation, stealth, and scoring feel right.
- The mechanics baseline is stable enough for the first custom Bigfoot art-direction pass. Bigfoot should be the first real character asset because it establishes scale and personality; agree on direction before creating it.
- Bigfoot can enter water and moves at 35% of normal speed while wading. The three authored crossings remain normal-speed route choices.

Avoid adding unrelated mechanics. Water traversal does not add stamina, drowning, inventory, combat, or new controls.

## 3. What has been completed

### Initial playable graybox

The original Phaser + TypeScript + Vite specification was implemented as a complete browser-game loop:

- start screen;
- controls screen;
- top-down WASD/arrow movement;
- hikers with predefined patrols and visible cones;
- directional photo detection;
- distance, occlusion, and bush-cover photo scoring;
- harmless blurry photos and a three-clear-photo loss;
- hold `E` for two seconds to disable a nearby camera;
- win, loss, restart, HUD, mute, messages, and photo feedback;
- responsive 16:9 presentation;
- tests, README, and static Vite build.

### Story and camera redesign

The prototype was then revised around the user's feedback:

- established the High Den homecoming plot and lookout warning;
- removed the requirement to disable every camera to win;
- added the all-camera **No Evidence Left** bonus;
- moved cameras onto authored tree mounts;
- gave every camera a clear facing, lens, blue cone, cooldown, and safer side/rear approach;
- retained the 2-second continuous disable interaction with reset on release or leaving range.

### Forest expansion

The small map grew into the current 3200×2200 world:

- five landscape regions;
- three readable routes home;
- a focused search camp and logging-spur scene with geometric technology and gear;
- three lower-forest patrols;
- five cameras;
- June Bowl pool, basalt shelves, waterfall, ridge, mountain silhouette, and High Den cave;
- a north-up minimap showing routes, creek, landmarks, player, and discovered cameras.

Route and content validation was added to prevent authored geometry regressions. Work included sealing an unintended fourth creek bypass, correcting the eastern route, preserving full player-body clearance, keeping patrols clear of terrain/props, and ensuring the upper forest remains human-free.

### Hazard and cover refinement

Browser playtests found that the route advertised as “covered” could produce two clear photos in a repeatable run. Existing bushes were repositioned and regression tests added so:

- the deadfall/ridge route still triggers meaningful camera exposure;
- its intended brush produces a harmless blurry photograph rather than an automatic clear strike;
- the ridge camera's side-disable pocket remains reachable;
- the eastern approach demonstrates the rear-camera route;
- all routes can still reach High Den.

### Recovery and rename

After the former Desktop workspace entered a cloud-sync failure state, the game was recovered and moved out of Desktop. Before the rename, the recovered authored files matched the last known complete build, and the full test/build/browser gates passed.

The project was then renamed from the former working title to **Blurfoot**:

- directory: `/Users/face/utils/blurfoot`;
- package name and package lock;
- browser `<title>`;
- visible title-screen heading;
- README title and future static URL;
- `.gitignore` added before first Git initialization.

No gameplay or story-character terminology changed during the rename.

### GitHub baseline and slow-water pass

The licensed standalone baseline was published to `https://github.com/ProjectConspiracy/blurfoot.git` at commit `a8a2fc7`, retaining the original GPL-3 license commit in its history.

The current local increment replaces the hard creek barrier with terrain-aware movement:

- Swift Creek uses continuous capsule geometry rather than a chain of circular water blockers;
- water slows Bigfoot to 35% of normal speed;
- the access bridge, deadfall crossing, and eastern basalt ford are explicit normal-speed corridors;
- the June Bowl pool is traversable slow water;
- only rocks remain solid terrain;
- wading adds lightweight water ripples, without new controls or mechanics;
- terrain classification and speed selection live in renderer-independent rules.

The automated gate and targeted browser route/ending checks pass. A human feel check remains before final tuning; the targeted bonus and loss scenarios are regression fixtures rather than uninterrupted natural playthroughs.

### Sight-cone display alignment

Visible hiker and camera cones now use `buildVisionPolygon` to clip their rendered shape against the same tree and rock occluders used by detection. Camera rendering excludes the camera's own mount tree, matching the existing observation rule and preserving the clear space directly in front of the lens. Detection behavior itself is unchanged.

## 4. Current playable contract

### Flow

`Title → Controls → Playing → Win or Lose → Play again`

The DOM shell owns screens and HUD. Phaser remains idle until the controls screen advances into a run. Restarting starts the single gameplay scene again and resets run/exploration state.

### Controls

- `WASD` or arrow keys: move.
- Hold `E` near an enabled camera for two continuous seconds: disable it.
- Mute button: toggles generated UI tones.

There are no touch controls, pause screen, save slots, or remappable bindings.

### Win and loss

- Enter High Den while still playing: win.
- Enter High Den after disabling all five cameras: win with **No Evidence Left**.
- Accumulate three photographs with quality `>= 0.48`: lose.
- Blurry photos never increment the loss count.

Photo processing occurs before camera interaction and cave resolution during a frame. Consequently, a live camera can photograph Bigfoot on the frame a disable completes, and a third clear photo takes priority over reaching the cave on that same update. Preserve or deliberately revise this ordering with tests.

### Cover and observation

- Trees and sight-blocking basalt/rock block line of sight.
- Visible camera and hiker cones clip against those occluders instead of drawing through them.
- A camera's own mount tree is excluded from both its observation test and its displayed cone.
- Visibility samples three silhouette rays: center and two perpendicular edges.
- Bush overlap multiplies photo quality by the authored bush factor.
- Current bush multipliers are `0.38–0.45`, below the `0.48` clear threshold. Therefore any bush overlap guarantees a blurry photograph even at point-blank range. This is current behavior, but should be consciously reviewed during balance tuning.
- The HUD's `Hidden / Partly covered / Exposed` indicator is advisory. Camera/hiker cooldowns do not affect the exposure label.

### Collision

- Solid: world bounds, all trees, and all rock terrain.
- Traversable slow terrain: Swift Creek and the June Bowl pool, at 35% movement speed.
- Normal-speed water corridors: access bridge, deadfall crossing, and eastern basalt ford.
- Non-solid: bushes, hikers, trail-camera rectangles, cave marker, and camp/logging props.
- Camp props reserve patrol clearance in authored validation but Bigfoot can walk through them.

## 5. World content

The renderer-independent source of truth is `src/game/content/level.ts`.

- World: 3200×2200.
- Spawn: `(1850, 2070)` in the south.
- High Den: `(1540, 170)` in the north.
- 48 trees, including five camera-mount trees.
- 18 bushes.
- 5 tree-mounted cameras: `camp`, `bridge`, `deadfall`, `bowl`, `ridge`.
- 3 human patrol paths.
- 22 camp/logging props.
- 17 circular terrain features: 16 rock/shelf blockers and the traversable June Bowl pool.
- Continuous Swift Creek capsule geometry with 3 authored normal-speed crossings.
- 6 landmarks.
- 5 terrain-region polygons.
- 4 route polylines: three player-facing route guides and Swift Creek.

### Regions

1. Lower Swift Woods.
2. Redrock Access and Hunter Camp.
3. Swift Lahar Cut.
4. June Bowl and Lava Forest.
5. Monitor Ridge and High Den.

Terrain-region polygons are presently visual only; they do not change movement or rules.

### Routes

1. **Fast access road and bridge** — direct and exposed.
2. **Covered deadfall crossing** — intended to teach brush/cover tradeoffs.
3. **Eastern basalt ford** — longer route that approaches the ridge camera from behind.

Route lines are visual/navigation guidance, not locked route selections. Rocks and trees define solid clearance; authored water geometry and crossing corridors determine movement speed.

The three crossings are also authored as `waterCrossings`, so the terrain-movement rule can distinguish normal-speed route corridors from surrounding slow water.

### Search camp

The camp includes geometric tents, pickup, ATV, canopy/table, generator, batteries, crates, cooler, radio mast, thermal-camera tripod, parabolic microphone dish, camera rack, map board, warm lights, logs, stumps, and an old logging spur. These are scenery only for now.

## 6. Architecture and important files

| File | Responsibility |
| --- | --- |
| `index.html` | Minimal Vite document and browser title |
| `src/main.ts` | Mounts `GameShell`, creates the idle Phaser game, exposes the scene lifecycle controller |
| `src/game/config.ts` | 960×540 logical viewport, FIT scaling, Arcade physics, scene key |
| `src/ui/GameShell.ts` | DOM title/controls/HUD/messages/results/mute, focus management, state reducer |
| `src/game/events.ts` | Typed event boundary between Phaser and the DOM shell |
| `src/game/scenes/GameScene.ts` | Single runtime scene and update orchestration |
| `src/game/content/level.ts` | Canonical authored world data and most camera/content constants |
| `src/game/content/levelValidation.ts` | Deterministic level contract checking and sight-occluder selection |
| `src/game/types.ts` | Renderer-independent level/content schema |
| `src/game/input.ts` | WASD/arrows/`E` bindings and normalized movement vector |
| `src/game/audio.ts` | In-memory mute state and synthesized Web Audio UI tones |
| `src/game/rules/gameState.ts` | Immutable run state, photos, camera disabling, win/loss/bonus |
| `src/game/rules/vision.ts` | Cone geometry, clipped `buildVisionPolygon`, segment/circle occlusion, and three-ray silhouette visibility |
| `src/game/rules/photoQuality.ts` | Renderer-independent photo-quality formula |
| `src/game/rules/cameraObservation.ts` | Camera mounting, facing, occlusion, and observation |
| `src/game/rules/exploration.ts` | Proximity-based camera discovery for one run |
| `src/game/rules/minimap.ts` | Map projection and marker model |
| `src/game/rules/terrainMovement.ts` | Pure water classification, 35% wading multiplier, and solid-terrain selection |
| `src/game/view/drawWorld.ts` | All current geometric rendering and minimap drawing |
| `src/style.css` | Responsive shell, overlays, HUD, focus, reduced-motion behavior |
| colocated `*.test.ts` files | Rule, shell, minimap, camera, and authored-level regression tests |
| `vite.config.ts` | Relative static-asset base (`./`) |
| `README.md` | Setup, controls, world description, and hosting boundary |

### Runtime ownership

- `GameShell` owns presentation screens and subscribes to typed events.
- `GameScene` owns mutable per-run runtime objects: player body, hikers, cooldowns, interaction timing, photo flash, and orchestration.
- Pure modules own most durable rules and authored data.
- `drawWorld.ts` creates geometry once and redraws occluder-clipped cones, marks, progress, flash, minimap, and wading ripples each frame.

There are no boot/preload scenes, sprite assets, asset manifest, downloaded sounds, router, backend calls, telemetry, or persistent storage.

### Current update order

1. Read movement, classify terrain, and set terrain-adjusted player velocity.
2. Discover nearby cameras for the minimap.
3. Move hikers and tick hiker/camera cooldowns.
4. Process hiker photographs.
5. Process camera photographs if still playing.
6. Process camera-disable interaction if still playing.
7. Process cave overlap if still playing.
8. Select/emit messages, HUD, result, and render state.

Clear-photo feedback takes precedence over less urgent same-frame messages. Multiple observers can record separate photos in one update.

## 7. Current tuning values

| Setting | Value | Current source |
| --- | ---: | --- |
| Bigfoot movement speed | 190 px/s | `GameScene.ts` |
| Water movement multiplier | 0.35 | `terrainMovement.ts` |
| Bigfoot sight/visibility radius | 20 px | `GameScene.ts` |
| Hiker movement speed | 76 px/s | `GameScene.ts` |
| Hiker sight range | 340 px | `GameScene.ts` / renderer |
| Hiker cone half-angle | 35° | `GameScene.ts` / renderer |
| Hiker photo cooldown | 2.0 s | `GameScene.ts` |
| Camera sight range | 260 px | `level.ts` |
| Camera cone half-angle | 26° | `level.ts` |
| Camera interaction radius | 100 px | `level.ts` |
| Camera disable time | 2.0 s | `GameScene.ts` |
| Camera photo cooldown | 3.6 s | `level.ts` |
| Minimap camera discovery radius | 260 px | `GameScene.ts` |
| Clear-photo threshold | 0.48 | `gameState.ts` |
| Clear photos to lose | 3 | `gameState.ts` plus HUD copy |

Photo quality is:

```text
clamp(1 - distance / 340) × visible silhouette fraction × bush multiplier
```

Important technical debt: several tuning constants are duplicated between runtime, renderer, scoring, and HUD code. Centralize them before a major balance pass.

## 8. Verification and test boundary

Current verification on 2026-09-21:

- `npm test`: 10/10 test files, 148/148 tests passed.
- `npm run typecheck`: passed.
- `npm run build`: passed.
- Verified environment: Node `22.23.2`, npm `10.9.8`.
- Installed/locked top-level packages: Phaser `3.90.0`, TypeScript `5.9.3`, Vite `6.4.3`, Vitest `3.2.7`, `@types/node` `22.20.1`.
- Lockfile version: 3.

The tests cover:

- immutable win/loss/bonus state transitions;
- canonical five-camera order;
- photo quality and thresholds;
- cone geometry and tree/rock occlusion;
- clipped vision polygons and camera-own-mount exclusion;
- directional mount geometry and camera photographs;
- camera exploration and minimap projection;
- message priority;
- DOM shell transitions, result copy, focus, progress, and live-region update behavior;
- world counts, bounds, IDs, patrol confinement/clearance;
- all three playable-route clearances;
- the blocked north-creek bypass;
- deadfall/ridge/eastern-camera route behavior;
- `getTerrainSpeedMultiplier(player, level)` and `getSolidTerrain(level)`;
- continuous creek geometry, the three normal-speed crossings, and revised terrain counts.

Browser evidence is recorded in [`docs/PLAYTEST-2026-09-21.md`](PLAYTEST-2026-09-21.md):

- all three routes reached ordinary wins with zero cameras disabled: covered route with one clear photo, eastern route with zero, and access route with one;
- targeted side-approach fixtures disabled all five cameras through real held-`E` input and produced **No Evidence Left**;
- a real camera cooldown/timer produced the three-clear-photo loss;
- restart from both endings cleared photos, disabled cameras, and camera discovery;
- mute/unmute worked, and releasing `E` or leaving range reset disable progress;
- dry land measured 190 px/s, water 66.5 px/s, and all three crossings 190 px/s;
- no console errors occurred.

The bonus and loss checks used targeted scene placements, not uninterrupted natural runs. A human feel check remains. The clipped cone visuals were inspected, and the uninstrumented production build passed a 1024×768 title → controls → gameplay smoke test with keyboard movement, mute/unmute, successful asset requests, no overflow, and no console errors.

Not currently committed/tested:

- no Playwright configuration or automated end-to-end suite;
- no CI workflow;
- no scene-level integration test running Arcade physics;
- no automated or uninterrupted natural playthrough of all endings;
- no mobile/touch test because desktop is the intended control target.

The production build's Phaser-containing JavaScript chunk is about 1.53 MB raw / 354 KB gzip. Vite emits its nonblocking `>500 kB` warning. This is acceptable for a beta candidate but should remain a later loading/performance item.

All runtime dependencies are currently declared in `devDependencies`, so use plain `npm ci` for builds; `npm ci --omit=dev` would omit Phaser and the toolchain.

## 9. Known limitations and polish debt

### Highest-priority product gap

Functional route and ending coverage is complete, but a human feel check still needs to answer whether 35% wading and the three crossings create readable, enjoyable tradeoffs. Do not tune from the targeted regression fixtures alone.

### Other known rough edges

- All world and character art is placeholder geometry.
- Bigfoot can pass through hikers and substantial camp props.
- Audio is limited to short synthesized UI chirps.
- The minimap is fixed-size, noninteractive, and has no zoom.
- No save/progression exists; all state is per run.
- Mute state is in memory only.
- `GameScene.ts`, `drawWorld.ts`, `GameShell.ts`, and `style.css` are large. Split the renderer and runtime systems before a large asset/animation expansion.
- Level validation runs in tests, not during production boot.
- Package version remains `0.0.0`.
- No release tags, CI, or committed browser smoke test exists.
- `.DS_Store` and old local Playwright artifacts may exist on disk, but `.gitignore` excludes them.
- `dist/` is generated and ignored. Do not treat a preexisting `dist/` as source of truth; rebuild it.

## 10. Where work stopped

The **slow-water, route/ending regression, and clipped-cone** increment is implemented and passes the automated gate. Targeted browser coverage, cone inspection, and the clean production-build smoke test are complete.

The agreed order had been:

1. Expand and shape the forest.
2. Playtest navigation and hazard density.
3. Tune movement, sight ranges, and photo scoring.
4. Lock the Mount St. Helens visual direction.
5. Replace placeholders systematically.
6. Finish sound, feedback, responsive layout, and full-route testing.

Steps 1 and the functional portion of step 2 are largely complete. The remaining gameplay task is a human feel check and any narrowly justified tuning it reveals. The project is ready to discuss visual direction, with Bigfoot as the first asset after the user approves that direction.

## 11. Recommended next increment

Run the first Bigfoot art-direction pass before creating an asset:

- agree on top-down perspective and facing readability;
- lock Bigfoot's silhouette, proportions, scale, palette, and personality;
- decide the minimum movement and interaction animation set;
- preserve the current collision body and stealth readability;
- get user approval on the direction before generating, drawing, or importing production art.

The remaining human playtest question is:

> Do the bridge, deadfall, and eastern ford feel like three legible choices with meaningfully different exposure and cover tradeoffs once water is passable but slow?

That feel check may run before or alongside art-direction discussion. If it reveals a problem, tune one reproduced issue at a time and keep a before/after observation.

## 12. Recommended continuation roadmap

### P0 — Establish the GitHub source of truth

Completed. Initial baseline commit `a8a2fc7` is confirmed on remote `main` and retains license commit `8c00bbe000c0d2e14665516ca95a8af6b43d17e6`.

### P1 — Close the beta gameplay gap

Mostly complete. Automated gates and targeted browser coverage now exercise all routes, endings, restart state, audio, interaction resets, water speed, crossing speed, and console health. Visible cones now match real occlusion.

Remaining:

1. Conduct a human feel check for route readability and 35% wading pace.
2. Tune only from reproduced human-playtest evidence.
3. Optionally add a lightweight committed browser smoke harness later; it is not required before art-direction work.

### P2 — Visual direction and assets

The functional mechanics baseline is ready for this phase. Begin with direction-setting, and wait for user approval before asset creation.

1. Lock palette, perspective, silhouette scale, and texture density.
2. Start with the user's custom Bigfoot sprite while preserving the current collision body.
3. Add stable asset-manifest keys before asset paths spread through gameplay code.
4. Replace in order: Bigfoot; hikers/facing; cameras/straps/lenses; vegetation/rocks/water; camp technology; mountain/cave; UI icons and Lab thumbnail.
5. Add animation and richer audio only where they improve stealth readability.

### P3 — Publish a labeled Project Conspiracy beta

The current game is a plausible beta candidate. Complete the slow-water route and ending playtest, tune from those observations, establish the visual direction, and validate the final site embedding before calling it a deployed beta.

The standalone source repository must remain authoritative. Project Conspiracy should receive a compiled snapshot, not a second editable source copy.

## 13. GitHub handoff

The GitHub repository is `https://github.com/ProjectConspiracy/blurfoot.git`, configured locally as `origin`. Remote `main` contains initial baseline commit `a8a2fc7`, which retains GPL-3 license commit `8c00bbe000c0d2e14665516ca95a8af6b43d17e6` in its history. The licensing pass declares the original Blurfoot code GPL-3.0-only and preserves runtime dependency notices in `THIRD_PARTY_NOTICES.md`.

Before committing, inspect the staged files; authored work should exclude `node_modules/`, `dist/`, `.playwright-cli/`, and every `.DS_Store`.

The user retains responsibility for publishing and prefers GitHub Desktop because terminal Git selects the wrong GitHub account. Do not change global credential settings, push on the user's behalf, force-push, or replace remote history. Local continuation work remains unpublished until the user pushes it through GitHub Desktop.

Suggested later release naming: bump the package only when appropriate and tag the approved website build as something like `v0.1.0-beta.1`; do not retroactively pretend the initial recovered baseline was a polished release.

## 14. Project Conspiracy integration boundary

The former canonical `/Users/face/Desktop/project-conspiracy` checkout is not currently available. A cloud-restored Desktop path may exist, but its data integrity is explicitly questionable. A successor must ask the user for or independently confirm the authoritative website checkout before editing it.

Once the authoritative Project Conspiracy repository is open:

1. In the standalone Blurfoot repository, run `npm ci`, `npm test`, and `npm run build`.
2. Verify the website's current `public/games` and Lab-registration conventions rather than relying on old filenames.
3. Copy the **contents** of fresh `dist/` into `<SITE_ROOT>/public/games/blurfoot/`, excluding `.DS_Store`.
4. Register Blurfoot through the site's existing The Lab/Jimbo's Lab data/card pattern.
5. Point the play target to `/games/blurfoot/` (the trailing slash is safest for relative assets).
6. Decide whether the existing “Insert Coin & Play” behavior opens a page or embeds an iframe; follow the site's established pattern.
7. For an iframe, test focus, `WASD`/arrows/`E`, audio unlock, mute, and sufficient 16:9 height. Review CSP/sandbox policy.
8. Smoke-test the final site route, JS/CSS asset requests, title → controls → gameplay, console, keyboard input, restart, and mute.
9. Label the site entry `Beta` and expose the controls.
10. Update `README.md` once the statement “Project Conspiracy is untouched” stops being true.

`vite.config.ts` sets `base: './'`; the built HTML references `./assets/...`, making the output structurally suitable for `/games/blurfoot/`. There are no runtime network calls or external art/audio dependencies.

Longer term, add an explicit build/copy or release-artifact workflow so the website snapshot cannot silently drift from the standalone game repository.

## 15. Local Codex automation status

A historical 8:00 p.m. America/Chicago heartbeat exists outside the repository:

```text
/Users/face/.codex/automations/daily-bigfoot-high-den-build/automation.toml
```

It is currently **PAUSED**. Its prompt still contains the old game title and deleted Desktop path, and it targets the old Codex task. Do not resume it as-is. After GitHub becomes authoritative, either:

- create/update a daily task attached to the new agent/task and repository; or
- retire the old automation to prevent confusion.

Its original cadence was one bounded playable increment per day, followed by tests, a real browser playtest, a local preview when possible, and one focused question for user feedback. It explicitly prohibited publishing without approval.

## 16. Suggested first prompt for the successor

```text
Work in /Users/face/utils/blurfoot. Read AGENTS.md, README.md, docs/HANDOFF.md, and docs/PLAYTEST-2026-09-21.md before acting. The mechanics baseline is ready for the first custom Bigfoot art-direction pass. Collaborate with the user to lock perspective, silhouette, proportions, scale, palette, personality, and the minimum animation set before creating or importing an asset. Preserve the current collision body and stealth readability. Do not begin production art until the user approves the direction. Leave publishing to the user through GitHub Desktop, and do not change global Git credentials or integrate into Project Conspiracy yet.
```

The next useful action is the Bigfoot direction conversation. Asset creation follows only after user approval; the remaining human route-feel check can still inform later tuning.
