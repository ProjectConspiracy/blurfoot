/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import {
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
