/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import { FOREST_LEVEL } from '../content/level';
import type { Circle, LevelData, Point } from '../types';
import { getSolidTerrain, getTerrainSpeedMultiplier } from './terrainMovement';

type MovementTerrain = Pick<LevelData, 'routes' | 'terrainBlockers' | 'waterCrossings'>;

function fixture(overrides: Partial<MovementTerrain> = {}): MovementTerrain {
  return {
    routes: [{ id: 'creek', kind: 'creek', width: 100, showOnMap: true, points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] }],
    terrainBlockers: [], waterCrossings: [], ...overrides,
  };
}

function player(x: number, y: number, radius = 15): Circle {
  return { x, y, radius };
}

function samplePath(points: readonly Point[]): readonly Point[] {
  return points.flatMap((end, index) => {
    if (index === 0) return [end];
    const start = points[index - 1];
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 5);
    return Array.from({ length: steps }, (_, step) => ({
      x: start.x + (end.x - start.x) * (step + 1) / steps,
      y: start.y + (end.y - start.y) * (step + 1) / steps,
    }));
  });
}

describe('getTerrainSpeedMultiplier', () => {
  it('keeps dry ground, ordinary routes and rock at normal movement speed', () => {
    const level = fixture({
      routes: [{ id: 'road', kind: 'road', width: 100, showOnMap: true, points: [{ x: 100, y: 100 }, { x: 300, y: 100 }] }],
      terrainBlockers: [{ id: 'rock', kind: 'rock', x: 200, y: 100, radius: 80, blocksSight: true }],
    });
    expect(getTerrainSpeedMultiplier(player(200, 100), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(200, 300), fixture())).toBe(1);
  });

  it.each([
    [200, 100, 0.35], [200, 165, 0.35], [200, 165.01, 1],
    [35, 100, 0.35], [34.99, 100, 1], [365, 100, 0.35], [365.01, 100, 1],
  ])('classifies creek sides and round end caps at (%s, %s)', (x, y, expected) => {
    expect(getTerrainSpeedMultiplier(player(x, y), fixture())).toBe(expected);
  });

  it('accounts for the whole player radius on a diagonal creek bank', () => {
    const level = fixture({ routes: [{
      id: 'diagonal', kind: 'creek', width: 100, showOnMap: true,
      points: [{ x: 0, y: 0 }, { x: 300, y: 400 }],
    }] });
    // The 3-4-5 segment has normal (0.8, -0.6); these offsets are 65 and 65.1.
    expect(getTerrainSpeedMultiplier(player(202, 161), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(202.08, 160.94), level)).toBe(1);
  });

  it('keeps rounded creek joins wet without filling the outside of the bend', () => {
    const level = fixture({ routes: [{
      id: 'bend', kind: 'creek', width: 100, showOnMap: true,
      points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 200 }],
    }] });
    expect(getTerrainSpeedMultiplier(player(240, 60), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(246, 54), level)).toBe(1);
  });

  it('slows the June Bowl style pool through its circular-footprint boundary', () => {
    const level = fixture({ terrainBlockers: [
      { id: 'pool', kind: 'water', x: 600, y: 600, radius: 50, blocksSight: false },
    ] });
    expect(getTerrainSpeedMultiplier(player(600, 600), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(600, 665), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(600, 665.01), level)).toBe(1);
  });

  it('gives a crossing priority only when the circular footprint fits inside its width', () => {
    const level = fixture({ waterCrossings: [{
      id: 'bridge', kind: 'bridge', width: 76, points: [{ x: 200, y: 20 }, { x: 200, y: 180 }],
    }] });
    expect(getTerrainSpeedMultiplier(player(200, 100), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(223, 100), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(223.01, 100), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(200, 100, 39), level)).toBe(0.35);
  });

  it('uses rounded crossing caps and joins when crossing a pool', () => {
    const level = fixture({
      terrainBlockers: [{ id: 'pool', kind: 'water', x: 200, y: 100, radius: 180, blocksSight: false }],
      waterCrossings: [{ id: 'ford', kind: 'ford', width: 76, points: [
        { x: 200, y: 20 }, { x: 200, y: 100 }, { x: 280, y: 100 },
      ] }],
    });
    expect(getTerrainSpeedMultiplier(player(200, -3), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(200, -3.01), level)).toBe(0.35);
    expect(getTerrainSpeedMultiplier(player(200, 100), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(303, 100), level)).toBe(1);
    expect(getTerrainSpeedMultiplier(player(303.01, 100), level)).toBe(0.35);
  });
});

describe('authored water traversal', () => {
  it('has no full-speed seams anywhere along Swift Creek without crossings', () => {
    const creek = FOREST_LEVEL.routes.find(({ kind }) => kind === 'creek')!;
    const level = { ...FOREST_LEVEL, waterCrossings: [] };
    const dryPoints = samplePath(creek.points).filter((point) => getTerrainSpeedMultiplier({ ...point, radius: 15 }, level) !== 0.35);
    expect(dryPoints).toEqual([]);
  });

  it.each(FOREST_LEVEL.routes.filter(({ kind }) => kind !== 'creek'))('keeps the complete $id at normal speed', (route) => {
    const slowPoints = samplePath(route.points).filter((point) => getTerrainSpeedMultiplier({ ...point, radius: 15 }, FOREST_LEVEL) !== 1);
    expect(slowPoints).toEqual([]);
  });

  it.each(FOREST_LEVEL.waterCrossings)('carries the circular footprint over water at $id with dry ground beyond both ends', (crossing) => {
    const withoutCrossings = { ...FOREST_LEVEL, waterCrossings: [] };
    expect(getTerrainSpeedMultiplier({ ...crossing.points[1], radius: 15 }, withoutCrossings)).toBe(0.35);
    expect(getTerrainSpeedMultiplier({ ...crossing.points[1], radius: 15 }, FOREST_LEVEL)).toBe(1);
    for (const point of [crossing.points[0], crossing.points[crossing.points.length - 1]]) {
      expect(getTerrainSpeedMultiplier({ ...point, radius: 15 }, withoutCrossings)).toBe(1);
    }
  });

  it.each([{ x: 1410, y: 1600 }, { x: 1842, y: 1336 }, { x: 2194, y: 994 }])('slows wet approaches away from each crossing at $x, $y', (point) => {
    expect(getTerrainSpeedMultiplier({ ...point, radius: 15 }, FOREST_LEVEL)).toBe(0.35);
  });
});

describe('getSolidTerrain', () => {
  it('keeps every rock solid and removes water from the runtime collider set', () => {
    const level = fixture({ terrainBlockers: [
      { id: 'pool', kind: 'water', x: 100, y: 100, radius: 50, blocksSight: false },
      { id: 'basalt', kind: 'rock', x: 300, y: 100, radius: 50, blocksSight: true },
      { id: 'low-rock', kind: 'rock', x: 500, y: 100, radius: 50, blocksSight: false },
    ] });
    expect(getSolidTerrain(level).map(({ id }) => id)).toEqual(['basalt', 'low-rock']);
    expect(getSolidTerrain(level)[0]).toBe(level.terrainBlockers[1]);
    expect(getSolidTerrain({ terrainBlockers: [] })).toEqual([]);
  });
});
