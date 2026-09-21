/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { createMountedCamera } from '../rules/cameraObservation';
import { CAMERA_IDS } from '../rules/gameState';
import type { Camera, LevelData, PropKind, TerrainBlocker, Tree, WorldProp } from '../types';

const CAMERA_RANGE = 260;
const CAMERA_HALF_ANGLE = Math.PI * 26 / 180;
const CAMERA_INTERACTION_RADIUS = 100;
const CAMERA_COOLDOWN_MS = 3_600;
const CAMERA_MOUNT_OFFSET = 10;

const trees: readonly Tree[] = ([
  ['mount-camp', 620, 1430, 48],
  ['mount-bridge', 1390, 1600, 46],
  ['mount-deadfall', 1690, 1320, 52],
  ['mount-bowl', 2460, 930, 48],
  ['mount-ridge', 1640, 720, 50],
  ['lower-01', 160, 2050, 48], ['lower-02', 430, 2100, 54],
  ['lower-03', 710, 1940, 50], ['lower-04', 980, 2080, 46],
  ['lower-05', 1260, 1970, 58], ['lower-06', 1510, 2120, 50],
  ['lower-07', 2130, 2050, 55], ['lower-08', 2390, 1900, 48],
  ['lower-09', 2690, 2070, 54], ['lower-10', 3030, 1910, 58],
  ['lower-11', 260, 1800, 50], ['lower-12', 590, 1750, 46],
  ['lower-13', 950, 1830, 52], ['lower-14', 2740, 1730, 56],
  ['access-01', 210, 1480, 54], ['access-02', 310, 1210, 50],
  ['access-03', 510, 1080, 45], ['access-04', 760, 950, 48],
  ['access-05', 1080, 930, 52], ['access-06', 1320, 1140, 54],
  ['access-07', 1510, 1050, 50], ['access-08', 260, 900, 58],
  ['mid-01', 1870, 1580, 48], ['mid-02', 2050, 1380, 52],
  ['mid-03', 2280, 1510, 54], ['mid-04', 2600, 1450, 50],
  ['mid-05', 2930, 1360, 56], ['mid-06', 2310, 1190, 46],
  ['mid-07', 2860, 1120, 52], ['mid-08', 3100, 1250, 48],
  ['bowl-01', 3030, 900, 52], ['bowl-02', 2760, 700, 48],
  ['bowl-03', 2310, 690, 54], ['bowl-04', 2580, 820, 46],
  ['bowl-05', 2940, 560, 50], ['bowl-06', 2200, 1020, 45],
  ['upper-01', 520, 720, 58], ['upper-02', 820, 650, 50],
  ['upper-03', 1100, 790, 46], ['upper-04', 1290, 620, 52],
  ['upper-05', 1900, 620, 48], ['upper-06', 2160, 470, 56],
  ['upper-07', 900, 350, 60],
] as const).map(([id, x, y, radius]) => ({ id, x, y, radius }));

const mounts = [
  { id: 'camp', mountTreeId: 'mount-camp', direction: { x: 1, y: 0.2 } },
  { id: 'bridge', mountTreeId: 'mount-bridge', direction: { x: -1, y: 0 } },
  { id: 'deadfall', mountTreeId: 'mount-deadfall', direction: { x: 0.8, y: 0.55 } },
  { id: 'bowl', mountTreeId: 'mount-bowl', direction: { x: -0.9, y: 0.2 } },
  { id: 'ridge', mountTreeId: 'mount-ridge', direction: { x: 0, y: 1 } },
] as const;

const mountedCameras = mounts.map((mount) => {
  const tree = trees.find(({ id }) => id === mount.mountTreeId);
  if (!tree) {
    throw new Error(`Camera mount tree not found: ${mount.mountTreeId}`);
  }

  return createMountedCamera({
    ...mount,
    mountOffset: CAMERA_MOUNT_OFFSET,
    visionRange: CAMERA_RANGE,
    visionHalfAngleRadians: CAMERA_HALF_ANGLE,
    interactionRadius: CAMERA_INTERACTION_RADIUS,
    photoCooldownMs: CAMERA_COOLDOWN_MS,
  }, tree);
});

const cameras: readonly Camera[] = CAMERA_IDS.map((id) => {
  const camera = mountedCameras.find((mountedCamera) => mountedCamera.id === id);
  if (!camera) {
    throw new Error(`Camera not found: ${id}`);
  }
  return camera;
});

const terrainRegions = [
  { id: 'lower-swift-woods', kind: 'lower-forest', points: [{ x: 0, y: 1180 }, { x: 3200, y: 1180 }, { x: 3200, y: 2200 }, { x: 0, y: 2200 }] },
  { id: 'redrock-access', kind: 'access', points: [{ x: 0, y: 880 }, { x: 1550, y: 880 }, { x: 1660, y: 1760 }, { x: 0, y: 1910 }] },
  { id: 'swift-lahar-cut', kind: 'lahar', points: [{ x: 720, y: 2200 }, { x: 1040, y: 2200 }, { x: 2580, y: 650 }, { x: 2370, y: 570 }] },
  { id: 'june-lava-forest', kind: 'lava-forest', points: [{ x: 1720, y: 410 }, { x: 3200, y: 410 }, { x: 3200, y: 1480 }, { x: 1840, y: 1480 }] },
  { id: 'monitor-ridge', kind: 'ridge', points: [{ x: 0, y: 0 }, { x: 2700, y: 0 }, { x: 2780, y: 850 }, { x: 0, y: 920 }] },
] as const;

const routes = [
  { id: 'fast-access-route', kind: 'road', width: 54, showOnMap: true, points: [{ x: 1850, y: 2070 }, { x: 1510, y: 1800 }, { x: 1320, y: 1650 }, { x: 1050, y: 1450 }, { x: 900, y: 1350 }, { x: 1210, y: 1070 }, { x: 1450, y: 850 }, { x: 1560, y: 700 }, { x: 1540, y: 170 }] },
  { id: 'covered-deadfall-route', kind: 'trail', width: 20, showOnMap: true, points: [{ x: 1850, y: 2070 }, { x: 1900, y: 1770 }, { x: 1785, y: 1615 }, { x: 1770, y: 1400 }, { x: 1810, y: 1260 }, { x: 2050, y: 990 }, { x: 1850, y: 800 }, { x: 1720, y: 820 }, { x: 1560, y: 820 }, { x: 1520, y: 700 }, { x: 1570, y: 610 }, { x: 1540, y: 170 }] },
  { id: 'eastern-basalt-route', kind: 'trail', width: 20, showOnMap: true, points: [{ x: 1850, y: 2070 }, { x: 2360, y: 1750 }, { x: 2700, y: 1500 }, { x: 2665, y: 1405 }, { x: 2520, y: 1250 }, { x: 2405, y: 1010 }, { x: 2276, y: 1124 }, { x: 2130, y: 1080 }, { x: 2040, y: 1010 }, { x: 2200, y: 720 }, { x: 1750, y: 720 }, { x: 1750, y: 610 }, { x: 1560, y: 610 }, { x: 1540, y: 170 }] },
  { id: 'swift-creek', kind: 'creek', width: 118, showOnMap: true, points: [{ x: 850, y: 2200 }, { x: 1320, y: 1650 }, { x: 1770, y: 1400 }, { x: 2130, y: 1080 }, { x: 2450, y: 650 }] },
] as const;

const propFootprints: Readonly<Record<PropKind, number>> = {
  tent: 36, pickup: 48, atv: 26, canopy: 42, table: 28, generator: 24,
  battery: 14, crate: 16, cooler: 18, 'radio-mast': 10, 'thermal-tripod': 16,
  'parabolic-dish': 18, 'camera-rack': 22, 'map-board': 22, 'log-pile': 36,
  stump: 15, 'camp-light': 0,
};

// Prop footprints reserve patrol clearance; Bigfoot can walk through graybox props.
const props: readonly WorldProp[] = ([
  ['tent-a', 'tent', 810, 1300, -0.15], ['tent-b', 'tent', 930, 1265, 0.18],
  ['pickup', 'pickup', 760, 1405, -0.08], ['atv', 'atv', 1035, 1440, 0.2],
  ['canopy', 'canopy', 970, 1360, 0], ['field-table', 'table', 970, 1360, 0],
  ['generator', 'generator', 1080, 1330, 0], ['battery-a', 'battery', 1110, 1360, 0],
  ['battery-b', 'battery', 1134, 1360, 0], ['crate-a', 'crate', 1040, 1285, 0],
  ['cooler', 'cooler', 865, 1370, 0], ['radio-mast', 'radio-mast', 850, 1195, 0],
  ['thermal-tripod', 'thermal-tripod', 1090, 1240, 0], ['dish', 'parabolic-dish', 770, 1225, 0],
  ['camera-rack', 'camera-rack', 1015, 1210, 0], ['map-board', 'map-board', 850, 1465, 0],
  ['camp-light-a', 'camp-light', 885, 1335, 0], ['camp-light-b', 'camp-light', 1060, 1390, 0],
  ['log-pile', 'log-pile', 1220, 1040, 0], ['stump-a', 'stump', 1120, 1010, 0],
  ['stump-b', 'stump', 1280, 990, 0], ['stump-c', 'stump', 1340, 1080, 0],
] as const).map(([id, kind, x, y, rotationRadians]) => ({
  id, kind, position: { x, y }, rotationRadians, footprintRadius: propFootprints[kind],
}));

const terrainBlockers: readonly TerrainBlocker[] = [
  ...([
    [880, 2142], [970, 2055], [1060, 1960], [1150, 1865], [1235, 1765],
    [1435, 1575], [1530, 1510], [1620, 1450], [1885, 1310], [1975, 1225],
    [2050, 1150], [2215, 990], [2285, 890], [2355, 790], [2420, 690],
  ] as const).map(([x, y], index) => ({ id: `water-${index + 1}`, kind: 'water' as const, x, y, radius: 58, blocksSight: false })),
  { id: 'june-bowl-pool', kind: 'water', x: 2870, y: 985, radius: 80, blocksSight: false },
  ...([
    [460, 520, 72], [680, 430, 60], [1450, 510, 74], [1850, 440, 68],
    [2050, 260, 78], [2700, 520, 82], [2950, 700, 66], [1150, 160, 62],
    [2390, 590, 60], [2450, 485, 65], [2575, 470, 65],
    [2850, 520, 82], [3000, 520, 82], [3118, 520, 82],
  ] as const).map(([x, y, radius], index) => ({ id: `rock-${index + 1}`, kind: 'rock' as const, x, y, radius, blocksSight: true })),
  { id: 'june-bowl-shelf-west', kind: 'rock', x: 2810, y: 850, radius: 50, blocksSight: true },
  { id: 'june-bowl-shelf-east', kind: 'rock', x: 2930, y: 850, radius: 55, blocksSight: true },
];

/** A single, renderer-independent 3200 by 2200 forest mission layout. */
export const FOREST_LEVEL: LevelData = {
  width: 3200,
  height: 2200,
  spawn: { x: 1850, y: 2070 },
  cave: { id: 'cave', x: 1540, y: 170, radius: 58 },
  cameras,
  trees,
  terrainRegions,
  routes,
  props,
  terrainBlockers,
  landmarks: [
    { id: 'hunter-camp', kind: 'hunter-camp', name: 'Hunter Camp', position: { x: 900, y: 1350 }, showOnMap: true },
    { id: 'logging-spur', kind: 'logging-spur', name: 'Logging Spur', position: { x: 1210, y: 1070 }, showOnMap: true },
    { id: 'deadfall-crossing', kind: 'creek-crossing', name: 'Deadfall Crossing', position: { x: 1770, y: 1400 }, showOnMap: true },
    { id: 'basalt-ford', kind: 'creek-crossing', name: 'Basalt Ford', position: { x: 2130, y: 1080 }, showOnMap: false },
    { id: 'june-bowl', kind: 'june-bowl', name: 'June Bowl', position: { x: 2670, y: 910 }, showOnMap: true },
    { id: 'high-den', kind: 'high-den', name: 'High Den', position: { x: 1540, y: 170 }, showOnMap: true },
  ],
  bushes: ([
    ['bush-lower-a', 1730, 2010, 42, 0.42], ['bush-lower-b', 2000, 1880, 40, 0.4],
    ['bush-lower-c', 1440, 1900, 44, 0.42], ['bush-lower-d', 2290, 1780, 42, 0.4],
    ['bush-road-west', 440, 1630, 40, 0.45], ['bush-camp-south', 680, 1560, 42, 0.42],
    ['bush-bridge-west', 1190, 1580, 40, 0.4], ['bush-bridge-east', 1510, 1690, 44, 0.42],
    ['bush-deadfall-south', 1750, 1480, 46, 0.38], ['bush-deadfall-north', 1800, 1350, 42, 0.4],
    ['bush-ford-south', 2210, 1170, 42, 0.4], ['bush-ford-north', 2170, 1010, 40, 0.42],
    ['bush-bowl-east', 2540, 1040, 44, 0.4], ['bush-bowl-north', 2700, 820, 42, 0.4],
    ['bush-ridge-west', 1560, 780, 40, 0.4], ['bush-ridge-east', 1640, 840, 42, 0.4],
    ['bush-upper-west', 1180, 560, 40, 0.38], ['bush-den-approach', 1510, 350, 44, 0.38],
  ] as const).map(([id, x, y, radius, coverMultiplier]) => ({ id, x, y, radius, coverMultiplier })),
  patrolPaths: [
    { id: 'camp-crew', points: [{ x: 690, y: 1150 }, { x: 1200, y: 1150 }, { x: 1200, y: 1530 }, { x: 690, y: 1530 }] },
    { id: 'road-crew', points: [{ x: 260, y: 1600 }, { x: 560, y: 1540 }, { x: 820, y: 1530 }, { x: 1090, y: 1510 }, { x: 780, y: 1690 }, { x: 420, y: 1660 }] },
    { id: 'search-crew', points: [{ x: 1175, y: 1110 }, { x: 1235, y: 1210 }, { x: 1490, y: 1280 }, { x: 1380, y: 1490 }, { x: 1180, y: 1450 }] },
  ],
};
