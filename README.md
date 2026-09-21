# Blurfoot

Standalone Phaser, TypeScript, and Vite preview for the top-down stealth game. Three knocks from the lookout warn that humans have returned to the lower forest, leaving Bigfoot to cross their lights, cameras, and rotten-mustard stink on the way home to High Den. The build uses placeholder geometry only and is intentionally isolated from the main Project Conspiracy site.

For continuation status, architecture, known gaps, GitHub setup, and the Project Conspiracy beta plan, see [`docs/HANDOFF.md`](docs/HANDOFF.md). New coding agents should also read [`AGENTS.md`](AGENTS.md).

Source repository: [ProjectConspiracy/blurfoot](https://github.com/ProjectConspiracy/blurfoot).

## Install

```sh
npm install
```

## Run locally

Start the Vite development server:

```sh
npm run dev
```

For the shared playtest address at `http://127.0.0.1:5174/`:

```sh
npm run dev -- --host 127.0.0.1 --port 5174 --strictPort
```

## Verify

Run the complete unit-test suite:

```sh
npm test
```

Run TypeScript without emitting files:

```sh
npm run typecheck
```

Create the production bundle (this also runs the typecheck):

```sh
npm run build
```

The current mechanics build passes 148 unit tests across 10 files, TypeScript checking, and the production build. Route and ending browser evidence is recorded in [`docs/PLAYTEST-2026-09-21.md`](docs/PLAYTEST-2026-09-21.md). Those checks establish functional coverage; a human feel pass remains before final tuning.

The logical game viewport is 960×540 and scales to fit the available desktop browser space. Move with WASD or the arrow keys. Bigfoot can wade through water at 35% of normal speed; no extra control is required. Tree-mounted trail cameras project blue detection cones and pose the greatest photo risk from the front. Approach from the safer side or rear, then hold E continuously for two seconds to disable a nearby camera; releasing E or stepping out of range resets that camera’s progress. Yellow cones show hikers’ sight.

Disabling cameras is optional: reaching High Den with any cameras active produces the ordinary home ending. Disable all five cameras before reaching the den to earn the **No Evidence Left** clean-route bonus. Exactly three clear photos confirm the evidence and end the run; blurry photos are harmless. Bushes reduce photo quality, while tree trunks and solid basalt rocks block sight and visibly clip sight cones. Use the sound control in the upper-right corner at any time.

## Expanded forest

The 3200×2200 world is a fictional, compressed Mount St. Helens south-flank journey, not a literal geographic map. Bigfoot starts in the south and heads north toward High Den. Character scale and dry-land speed remain unchanged as the viewport follows through five regions:

- **Lower Swift Woods:** wet forest and sheltered starting clearings.
- **Redrock Access and Hunter Camp:** gravel access, a focused search operation, and an old logging spur outside or beside the Monument boundary.
- **Swift Lahar Cut:** water, gravel and basalt separating three deliberate crossings.
- **June Bowl and Lava Forest:** a cold pool, waterfall shelf and young forest.
- **Monitor Ridge and High Den:** thinning trees, old lava ribs, pumice and the cave home.

The camp's geometric props include tents, a pickup, ATV, canopy/table, generator, batteries, crates, cooler, radio mast, thermal-camera tripod, parabolic microphone dish, trail-camera rack, map board and warm lights. Gear and lights are scenery, not extra mechanics. Camp props reserve clear patrol space but do not yet collide with Bigfoot. Nearby stumps and stacked logs suggest past logging; the upper mountain has no active logging operation.

Choose the fast, exposed **access road and bridge**, the covered **deadfall crossing**, or the longer **eastern basalt ford**. These three crossings remain normal-speed corridors across Swift Creek. Bigfoot may instead wade through the continuous stream at 35% speed, and the June Bowl pool is also traversable slow water. The eastern trail bends behind the final ridge camera before joining the High Den approach, visibly demonstrating the safer rear route around a directional camera. Basalt rocks remain solid and block sight. Exactly three people patrol the lower camp/road/search loops; no humans patrol June Bowl, Monitor Ridge or High Den.

Five directional cameras are strapped to trees at the camp, bridge, deadfall, bowl and ridge. The blue cone and lens show each camera's facing. Cones are clipped by the same trees and rocks used for actual line-of-sight detection; a camera's own mount is excluded so the area directly in front of its lens remains visible. Disabling a camera removes its cone and stops its photographs.

The compact north-up field map shows Bigfoot, High Den, major landmarks, Swift Creek, and the three route lines. Cameras appear only after Bigfoot comes within 260 world pixels, stay recorded after leaving, and change to a crossed marker when disabled. Restart clears all camera discoveries and disabled states. Human positions and patrol paths never appear on the minimap. The map is a schematic, without zoom or interaction.

## Static-hosting boundary

Vite uses `base: './'`, so the generated `dist/` directory is portable beneath a later static URL. The preview build is **not** copied to the main site yet: nothing in `public/games`, The Lab, or the Next.js application is updated by this phase. After playtest approval, a separate integration step can copy `dist/` to `public/games/blurfoot/` and register the game in The Lab.

## License

Copyright (C) 2026 ProjectConspiracy.

Blurfoot's original source, configuration, and documentation are free software: you may redistribute and modify them under the GNU General Public License, version 3 only (`GPL-3.0-only`). See [`LICENSE`](LICENSE) for the full terms.

Blurfoot is distributed without any warranty, including the implied warranties of merchantability or fitness for a particular purpose.

Third-party dependencies retain their own licenses. Notices for the runtime packages are recorded in [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md); dependency versions are pinned in `package-lock.json`.
