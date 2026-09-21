/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import {
  buildVisionPolygon,
  isPointInVisionCone,
  sampleVisibility,
  segmentIntersectsCircle,
  type Circle,
  type VisionCone,
} from './vision';

const eastFacingCone: VisionCone = {
  origin: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  range: 100,
  halfAngleRadians: Math.PI / 4,
};

describe('vision geometry', () => {
  it.each([
    ['includes a point on the cone centreline', { x: 60, y: 0 }, true],
    ['includes a point on the cone edge', { x: 50, y: 50 }, true],
    ['excludes a point outside the cone angle', { x: 40, y: 50 }, false],
    ['excludes a point beyond the cone range', { x: 101, y: 0 }, false],
  ] as const)('%s', (_name, point, expected) => {
    expect(isPointInVisionCone(point, eastFacingCone)).toBe(expected);
  });

  it.each([
    ['detects an obstacle crossing the segment', { x: 50, y: 0, radius: 10 }, true],
    ['does not count an obstacle away from the segment', { x: 50, y: 20, radius: 10 }, false],
    ['detects a segment endpoint inside an obstacle', { x: 100, y: 0, radius: 10 }, true],
  ] as const)('%s', (_name, obstacle, expected) => {
    expect(segmentIntersectsCircle({ x: 0, y: 0 }, { x: 100, y: 0 }, obstacle)).toBe(expected);
  });

  it('reports complete concealment when a tree blocks all three silhouette samples', () => {
    const trees: readonly Circle[] = [{ x: 50, y: 0, radius: 35 }];

    expect(sampleVisibility({ x: 0, y: 0 }, { x: 100, y: 0, radius: 12 }, trees)).toBe(0);
  });

  it('reports partial visibility when a tree blocks only the centre silhouette sample', () => {
    const trees: readonly Circle[] = [{ x: 50, y: 0, radius: 8 }];

    expect(sampleVisibility({ x: 0, y: 0 }, { x: 100, y: 0, radius: 20 }, trees)).toBeCloseTo(2 / 3);
  });
});

describe('buildVisionPolygon', () => {
  it('starts at the origin and includes both angular boundaries for a non-unit facing', () => {
    const polygon = buildVisionPolygon({
      origin: { x: 10, y: 20 }, direction: { x: 0, y: 7 }, range: 100, halfAngleRadians: Math.PI / 2,
    }, [], 2);
    expect(polygon).toHaveLength(4);
    for (const [index, expected] of [{ x: 10, y: 20 }, { x: 110, y: 20 }, { x: 10, y: 120 }, { x: -90, y: 20 }].entries()) {
      expect(polygon[index].x).toBeCloseTo(expected.x, 8);
      expect(polygon[index].y).toBeCloseTo(expected.y, 8);
    }
  });

  it('clips only rays intersecting a circle, using the near surface rather than its centre or far surface', () => {
    const polygon = buildVisionPolygon(eastFacingCone, [{ x: 50, y: 0, radius: 10 }], 2);
    expect(polygon[1].x).toBeCloseTo(70.710678119, 8);
    expect(polygon[1].y).toBeCloseTo(-70.710678119, 8);
    expect(polygon[2]).toEqual({ x: 40, y: 0 });
    expect(polygon[3].x).toBeCloseTo(70.710678119, 8);
    expect(polygon[3].y).toBeCloseTo(70.710678119, 8);
  });

  it('clips to the nearest obstacle regardless of array order', () => {
    const obstacles = [{ x: 80, y: 0, radius: 10 }, { x: 40, y: 0, radius: 10 }];
    expect(buildVisionPolygon(eastFacingCone, obstacles, 2)[2]).toEqual({ x: 30, y: 0 });
    expect(buildVisionPolygon(eastFacingCone, [...obstacles].reverse(), 2)[2]).toEqual({ x: 30, y: 0 });
  });

  it.each([
    ['behind the origin', { x: -50, y: 0, radius: 10 }, 100],
    ['tangent to the ray', { x: 50, y: 10, radius: 10 }, 50],
    ['just outside the ray', { x: 50, y: 10.01, radius: 10 }, 100],
    ['touching the range endpoint', { x: 110, y: 0, radius: 10 }, 100],
    ['beyond range', { x: 111, y: 0, radius: 10 }, 100],
    ['containing the origin', { x: -5, y: 0, radius: 10 }, 0],
    ['touching the origin', { x: 10, y: 0, radius: 10 }, 0],
  ] as const)('handles an occluder %s', (_name, obstacle, distance) => {
    expect(buildVisionPolygon(eastFacingCone, [obstacle], 2)[2]).toEqual({ x: distance, y: 0 });
  });

  it('clips a diagonal ray using its unit direction', () => {
    const polygon = buildVisionPolygon({
      origin: { x: 0, y: 0 }, direction: { x: 3, y: 4 }, range: 100, halfAngleRadians: 0,
    }, [{ x: 30, y: 40, radius: 10 }], 1);
    expect(polygon[1].x).toBeCloseTo(24, 8);
    expect(polygon[1].y).toBeCloseTo(32, 8);
  });

  it('clips a cone boundary without shortening the opposite boundary', () => {
    const polygon = buildVisionPolygon({ ...eastFacingCone, halfAngleRadians: Math.PI / 2 }, [{ x: 0, y: -50, radius: 10 }], 2);
    expect(polygon[1].x).toBeCloseTo(0, 8);
    expect(polygon[1].y).toBeCloseTo(-40, 8);
    expect(polygon[2]).toEqual({ x: 100, y: 0 });
    expect(polygon[3].x).toBeCloseTo(0, 8);
    expect(polygon[3].y).toBeCloseTo(100, 8);
  });

  it('collapses every ray when the cone origin is inside an occluder', () => {
    expect(buildVisionPolygon(eastFacingCone, [{ x: 0, y: 0, radius: 10 }], 2))
      .toEqual([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }]);
  });

  it.each([undefined, 0, -1, NaN, Infinity])('uses a finite default fan when segments is %s', (segments) => {
    const polygon = buildVisionPolygon(eastFacingCone, [], segments);
    expect(polygon).toHaveLength(66);
    expect(polygon.every(({ x, y }) => Number.isFinite(x) && Number.isFinite(y))).toBe(true);
  });

  it('rounds fractional segment counts down', () => {
    expect(buildVisionPolygon(eastFacingCone, [], 2.9)).toHaveLength(4);
  });

  it('reads frozen input without modifying the cone or its occluders', () => {
    const cone = Object.freeze({ ...eastFacingCone, origin: Object.freeze({ x: 0, y: 0 }), direction: Object.freeze({ x: 1, y: 0 }) });
    const obstacles = Object.freeze([Object.freeze({ x: 50, y: 0, radius: 10 })]);
    expect(buildVisionPolygon(cone, obstacles, 2)[2]).toEqual({ x: 40, y: 0 });
    expect(cone).toEqual(eastFacingCone);
    expect(obstacles).toEqual([{ x: 50, y: 0, radius: 10 }]);
  });
});
