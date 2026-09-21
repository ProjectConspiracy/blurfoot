/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import { CAMERA_IDS } from '../rules/gameState';
import { segmentIntersectsCircle } from '../rules/vision';
import type { LevelData } from '../types';
import { FOREST_LEVEL } from './level';
import { getLevelValidationErrors, getSightOccluders } from './levelValidation';

function fixture(overrides: Partial<LevelData> = {}): LevelData {
  return {
    ...FOREST_LEVEL,
    trees: FOREST_LEVEL.trees.filter(({ id }) => id.startsWith('mount-')),
    bushes: [], terrainRegions: [], routes: [], waterCrossings: [], props: [], terrainBlockers: [],
    patrolPaths: ['a', 'b', 'c'].map((id) => ({
      id, points: [{ x: 100, y: 1000 }, { x: 300, y: 1000 }, { x: 300, y: 1200 }],
    })),
    ...overrides,
  };
}

describe('expanded forest content', () => {
  it('is a valid 3200 by 2200 level with the required mission content', () => {
    expect(FOREST_LEVEL).toMatchObject({ width: 3200, height: 2200 });
    expect(FOREST_LEVEL.spawn).toEqual({ x: 1850, y: 2070 });
    expect(FOREST_LEVEL.cave).toMatchObject({ x: 1540, y: 170 });
    expect(FOREST_LEVEL.cameras.map(({ id }) => id)).toEqual(CAMERA_IDS);
    expect(FOREST_LEVEL.patrolPaths).toHaveLength(3);
    expect(FOREST_LEVEL.trees).toHaveLength(48);
    expect(FOREST_LEVEL.bushes).toHaveLength(18);
    expect(FOREST_LEVEL.props).toHaveLength(22);
    expect(FOREST_LEVEL.terrainBlockers).toHaveLength(17);
    expect(getLevelValidationErrors(FOREST_LEVEL)).toEqual([]);
  });

  it('contains every required orientation landmark', () => {
    expect(new Set(FOREST_LEVEL.landmarks.map(({ kind }) => kind))).toEqual(new Set([
      'hunter-camp', 'logging-spur', 'creek-crossing', 'june-bowl', 'high-den',
    ]));
  });

  it('shows Swift Creek as a canonical minimap orientation line', () => {
    expect(FOREST_LEVEL.routes.find(({ id }) => id === 'swift-creek')).toMatchObject({
      kind: 'creek',
      showOnMap: true,
    });
  });

  it('authors a wading pool below two sight-blocking basalt shelves', () => {
    const pool = FOREST_LEVEL.terrainBlockers.find(({ id }) => id === 'june-bowl-pool');
    const shelves = FOREST_LEVEL.terrainBlockers.filter(({ id }) => id.startsWith('june-bowl-shelf-'));
    const bowlBlockers = FOREST_LEVEL.terrainBlockers
      .filter(({ id }) => id.startsWith('june-bowl-'))
      .map(({ id, kind, blocksSight }) => ({ id, kind, blocksSight }));

    expect(bowlBlockers).toEqual([
      { id: 'june-bowl-pool', kind: 'water', blocksSight: false },
      { id: 'june-bowl-shelf-west', kind: 'rock', blocksSight: true },
      { id: 'june-bowl-shelf-east', kind: 'rock', blocksSight: true },
    ]);
    expect(pool).toBeDefined();
    expect(shelves).toHaveLength(2);
    expect(shelves.every(({ y }) => y < pool!.y)).toBe(true);
  });

  it('replaces creek collision discs with three explicit normal-speed crossings', () => {
    expect(FOREST_LEVEL.terrainBlockers.filter(({ kind }) => kind === 'water').map(({ id }) => id))
      .toEqual(['june-bowl-pool']);
    expect(FOREST_LEVEL.waterCrossings.map(({ kind, points }) => ({ kind, center: points[1] })))
      .toEqual([
        { kind: 'bridge', center: { x: 1320, y: 1650 } },
        { kind: 'deadfall', center: { x: 1770, y: 1400 } },
        { kind: 'ford', center: { x: 2130, y: 1080 } },
      ]);
  });

  it('keeps all human patrol points in the lower activity region', () => {
    for (const point of FOREST_LEVEL.patrolPaths.flatMap(({ points }) => points)) {
      expect(point.x).toBeLessThanOrEqual(1600);
      expect(point.y).toBeGreaterThanOrEqual(900);
    }
  });

  it('blocks the reproduced walk around the north creek endpoint with authored terrain', () => {
    expect(FOREST_LEVEL.terrainBlockers.filter(({ kind }) => kind === 'rock').some((blocker) => segmentIntersectsCircle(
      { x: 2500, y: 590 },
      { x: 2268, y: 590 },
      { ...blocker, radius: blocker.radius + 21 },
    ))).toBe(true);
  });

  it('routes the eastern approach past the bowl and through the ford without rock intersections', () => {
    const route = FOREST_LEVEL.routes.find(({ id }) => id === 'eastern-basalt-route');
    expect(route).toBeDefined();
    const points = route!.points;
    expect.soft(points.slice(2)).toEqual([
      { x: 2700, y: 1500 }, { x: 2665, y: 1405 },
      { x: 2520, y: 1250 }, { x: 2405, y: 1010 }, { x: 2276, y: 1124 },
      { x: 2130, y: 1080 }, { x: 2040, y: 1010 }, { x: 2200, y: 720 },
      { x: 1750, y: 720 }, { x: 1750, y: 610 }, { x: 1560, y: 610 }, { x: 1540, y: 170 },
    ]);
    const blockedSegments: string[] = [];
    for (let index = 1; index < points.length; index += 1) {
      for (const blocker of FOREST_LEVEL.terrainBlockers.filter(({ kind }) => kind === 'rock')) {
        if (segmentIntersectsCircle(points[index - 1], points[index], {
          ...blocker, radius: blocker.radius + 21,
        })) blockedSegments.push(`${index - 1}: ${blocker.id}`);
      }
    }
    expect(blockedSegments).toEqual([]);
  });

  it('keeps every playable route clear of trees and solid rock for the full player body', () => {
    const conflicts: string[] = [];
    const playerClearance = Math.hypot(15, 21);
    for (const route of FOREST_LEVEL.routes.filter(({ kind }) => kind !== 'creek')) {
      for (let index = 1; index < route.points.length; index += 1) {
        for (const obstacle of [...FOREST_LEVEL.trees, ...FOREST_LEVEL.terrainBlockers.filter(({ kind }) => kind === 'rock')]) {
          if (segmentIntersectsCircle(route.points[index - 1], route.points[index], {
            ...obstacle, radius: obstacle.radius + playerClearance,
          })) conflicts.push(`${route.id} segment ${index - 1}: ${obstacle.id}`);
        }
      }
    }
    expect(conflicts).toEqual([]);
  });

  it('leaves a full body-width of extra space at the deadfall trail ridge turn', () => {
    const route = FOREST_LEVEL.routes.find(({ id }) => id === 'covered-deadfall-route');
    const ridgeTree = FOREST_LEVEL.trees.find(({ id }) => id === 'mount-ridge');
    expect(route).toBeDefined();
    expect(ridgeTree).toBeDefined();

    const playerBodyRadius = Math.hypot(15, 21);
    const comfortableGap = 30;
    for (const index of [8, 9]) {
      expect(segmentIntersectsCircle(route!.points[index], route!.points[index + 1], {
        ...ridgeTree!, radius: ridgeTree!.radius + playerBodyRadius + comfortableGap,
      })).toBe(false);
    }
  });
});

describe('getLevelValidationErrors', () => {
  it('accepts a clear independent fixture', () => {
    expect(getLevelValidationErrors(fixture())).toEqual([]);
  });

  it('rejects non-positive and non-finite dimensions', () => {
    expect(getLevelValidationErrors(fixture({ width: 0, height: -1 })).slice(0, 2))
      .toEqual(['width must be finite and positive', 'height must be finite and positive']);
    expect(getLevelValidationErrors(fixture({ width: Infinity }))[0])
      .toBe('width must be finite and positive');
  });

  it('rejects duplicate crossing IDs', () => {
    const crossing = { id: 'bridge', kind: 'bridge' as const, width: 76, points: [{ x: 100, y: 100 }, { x: 200, y: 100 }] };
    expect(getLevelValidationErrors(fixture({ waterCrossings: [crossing, crossing] })))
      .toEqual(['duplicate waterCrossings id: bridge']);
  });

  it.each([0, -1, Infinity, NaN])('rejects crossing width %s', (width) => {
    expect(getLevelValidationErrors(fixture({ waterCrossings: [{
      id: 'bridge', kind: 'bridge', width, points: [{ x: 100, y: 100 }, { x: 200, y: 100 }],
    }] }))).toEqual(['waterCrossings bridge width must be finite and positive']);
  });

  it('rejects crossings with too few points and non-finite or out-of-bounds points', () => {
    expect(getLevelValidationErrors(fixture({ waterCrossings: [
      { id: 'empty', kind: 'ford', width: 76, points: [] },
      { id: 'short', kind: 'bridge', width: 76, points: [{ x: 100, y: 100 }] },
      { id: 'invalid', kind: 'deadfall', width: 64, points: [{ x: NaN, y: 100 }, { x: 100, y: 2201 }] },
    ] }))).toEqual([
      'waterCrossings empty must contain at least 2 points',
      'waterCrossings short must contain at least 2 points',
      'waterCrossings invalid point 0 is out of bounds',
      'waterCrossings invalid point 1 is out of bounds',
    ]);
  });

  it.each([
    ['trees', 'duplicate trees id: mount-camp'],
    ['cameras', 'duplicate cameras id: camp'],
    ['landmarks', 'duplicate landmarks id: hunter-camp'],
    ['patrolPaths', 'duplicate patrolPaths id: a'],
  ] as const)('rejects duplicate IDs in %s', (collection, error) => {
    const level = fixture();
    const items = level[collection];
    expect(getLevelValidationErrors({ ...level, [collection]: [...items, items[0]] })).toContain(error);
  });

  it('rejects duplicate IDs in the other authored collections', () => {
    const bush = { id: 'bush', x: 50, y: 50, radius: 10, coverMultiplier: 0.4 };
    const region = { id: 'region', kind: 'ridge' as const, points: [{ x: 0, y: 0 }] };
    const route = { id: 'route', kind: 'trail' as const, points: [], width: 20, showOnMap: true };
    const prop = { id: 'prop', kind: 'camp-light' as const, position: { x: 50, y: 50 }, footprintRadius: 0 };
    const blocker = { id: 'blocker', kind: 'rock' as const, x: 50, y: 50, radius: 10, blocksSight: true };
    expect(getLevelValidationErrors(fixture({
      bushes: [bush, bush], terrainRegions: [region, region], routes: [route, route],
      props: [prop, prop], terrainBlockers: [blocker, blocker],
    }))).toEqual([
      'duplicate bushes id: bush', 'duplicate terrainRegions id: region',
      'duplicate routes id: route', 'duplicate props id: prop', 'duplicate terrainBlockers id: blocker',
    ]);
  });

  it('checks full circles and every positional collection against the world bounds', () => {
    const level = fixture();
    expect(getLevelValidationErrors(fixture({
      spawn: { x: -1, y: 0 }, cave: { id: 'cave', x: 50, y: 50, radius: 58 },
      trees: [...level.trees, { id: 'edge-tree', x: 3190, y: 100, radius: 20 }],
      bushes: [{ id: 'edge-bush', x: 100, y: 2190, radius: 20, coverMultiplier: 0.4 }],
      cameras: level.cameras.map((camera, index) => index ? camera : { ...camera, position: { x: 3201, y: 100 } }),
      terrainRegions: [{ id: 'edge-region', kind: 'ridge', points: [{ x: -1, y: 0 }] }],
      routes: [{ id: 'edge-route', kind: 'road', width: 20, showOnMap: true, points: [{ x: 0, y: 2201 }] }],
      landmarks: level.landmarks.map((landmark, index) => index ? landmark : { ...landmark, position: { x: NaN, y: 0 } }),
      props: [{ id: 'edge-prop', kind: 'tent', position: { x: 20, y: 20 }, footprintRadius: 36 }],
      terrainBlockers: [{ id: 'edge-water', kind: 'water', x: 100, y: 2150, radius: 58, blocksSight: false }],
    }))).toEqual([
      'spawn is out of bounds', 'cave circle is out of bounds',
      'trees edge-tree circle is out of bounds', 'bushes edge-bush circle is out of bounds',
      'cameras camp position is out of bounds', 'terrainRegions edge-region point 0 is out of bounds',
      'routes edge-route point 0 is out of bounds', 'landmarks hunter-camp position is out of bounds',
      'props edge-prop circle is out of bounds', 'terrainBlockers edge-water circle is out of bounds',
    ]);
  });

  it('requires canonical camera order, mount trees, unit facings and exposed lenses', () => {
    const level = fixture();
    expect(getLevelValidationErrors(fixture({ cameras: [...level.cameras].reverse() })))
      .toEqual(['cameras must match canonical IDs in order: camp, bridge, deadfall, bowl, ridge']);
    expect(getLevelValidationErrors(fixture({ cameras: level.cameras.slice(1) })))
      .toEqual(['cameras must match canonical IDs in order: camp, bridge, deadfall, bowl, ridge']);
    expect(getLevelValidationErrors(fixture({ cameras: level.cameras.map((camera, index) => index ? camera : {
      ...camera, mountTreeId: 'missing', direction: { x: 2, y: 0 },
    }) }))).toEqual(['camera camp mount tree missing does not exist', 'camera camp direction must be unit length']);
    expect(getLevelValidationErrors(fixture({ cameras: level.cameras.map((camera, index) => index ? camera : {
      ...camera, position: { x: 620, y: 1430 },
    }) }))).toEqual(['camera camp lens must lie beyond mount tree radius']);
  });

  it('rejects incomplete patrols and missing landmark kinds', () => {
    expect(getLevelValidationErrors(fixture({ patrolPaths: [{ id: 'short', points: [{ x: 100, y: 1000 }] }], landmarks: [] })))
      .toEqual([
        'patrolPaths must contain exactly 3 patrols', 'patrol short must contain at least 2 points',
        'missing landmark kind: hunter-camp', 'missing landmark kind: logging-spur',
        'missing landmark kind: creek-crossing', 'missing landmark kind: june-bowl', 'missing landmark kind: high-den',
      ]);
  });

  it('rejects patrol points beyond either lower-activity boundary and the world edge', () => {
    const level = fixture();
    expect(getLevelValidationErrors(fixture({ patrolPaths: [
      { id: 'a', points: [{ x: -1, y: 899 }, { x: 1601, y: 1000 }] }, ...level.patrolPaths.slice(1),
    ] }))).toEqual([
      'patrolPaths a point 0 is out of bounds', 'patrol a point 0 must stay at x <= 1600 and y >= 900',
      'patrol a point 1 must stay at x <= 1600 and y >= 900',
    ]);
  });

  it.each([
    ['tree', [
      'patrol a segment 2 intersects tree obstacle (17px clearance)',
      'patrol b segment 2 intersects tree obstacle (17px clearance)',
      'patrol c segment 2 intersects tree obstacle (17px clearance)',
    ]],
    ['terrain blocker', [
      'patrol a segment 2 intersects terrain blocker obstacle (17px clearance)',
      'patrol b segment 2 intersects terrain blocker obstacle (17px clearance)',
      'patrol c segment 2 intersects terrain blocker obstacle (17px clearance)',
    ]],
    ['prop', [
      'patrol a segment 2 intersects prop obstacle (17px clearance)',
      'patrol b segment 2 intersects prop obstacle (17px clearance)',
      'patrol c segment 2 intersects prop obstacle (17px clearance)',
    ]],
  ] as const)('checks the closing segment against a %s with hiker clearance', (kind, expected) => {
    // Only the closing diagonal from (300,1200) to (100,1000) touches this circle.
    const level = fixture();
    const circle = { id: 'obstacle', x: 200, y: 1120, radius: 1 };
    const override: Partial<LevelData> = kind === 'tree' ? { trees: [...level.trees, circle] }
      : kind === 'terrain blocker' ? { terrainBlockers: [{ ...circle, kind: 'water', blocksSight: false }] }
        : { props: [{ id: 'obstacle', kind: 'battery', position: circle, footprintRadius: 1 }] };
    expect(getLevelValidationErrors(fixture(override))).toEqual(expected);
  });

  it('ignores zero-footprint decorative props for patrol clearance', () => {
    expect(getLevelValidationErrors(fixture({ props: [{
      id: 'light', kind: 'camp-light', position: { x: 200, y: 1100 }, footprintRadius: 0,
    }] }))).toEqual([]);
  });
});

describe('getSightOccluders', () => {
  it('returns all trees followed by sight-blocking terrain, excluding water and props', () => {
    const level = fixture({
      terrainBlockers: [
        { id: 'water', kind: 'water', x: 50, y: 50, radius: 10, blocksSight: false },
        { id: 'rock', kind: 'rock', x: 150, y: 50, radius: 10, blocksSight: true },
      ],
      props: [{ id: 'tent', kind: 'tent', position: { x: 250, y: 50 }, footprintRadius: 36 }],
    });
    expect(getSightOccluders(level).map(({ id }) => id)).toEqual([
      'mount-camp', 'mount-bridge', 'mount-deadfall', 'mount-bowl', 'mount-ridge', 'rock',
    ]);
  });
});
