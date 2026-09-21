/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import { calculatePhotoQuality } from './photoQuality';

describe('calculatePhotoQuality', () => {
  it.each([
    ['scores a nearby, fully visible Bigfoot as clear', { distance: 0, unobstructedRayFraction: 1, bushCoverMultiplier: 1 }, 1],
    ['scores a distant, fully hidden Bigfoot as blurry', { distance: 340, unobstructedRayFraction: 0, bushCoverMultiplier: 0 }, 0],
    ['applies the scalar formula at the clear boundary', { distance: 170, unobstructedRayFraction: 1, bushCoverMultiplier: 0.96 }, 0.48],
    ['reduces a nonzero score for partial visibility', { distance: 85, unobstructedRayFraction: 2 / 3, bushCoverMultiplier: 1 }, 0.5],
    ['combines partial visibility with bush cover', { distance: 85, unobstructedRayFraction: 2 / 3, bushCoverMultiplier: 0.4 }, 0.2],
    ['clamps out-of-range inputs', { distance: -10, unobstructedRayFraction: 2, bushCoverMultiplier: 2 }, 1],
    ['clamps a negative result', { distance: 999, unobstructedRayFraction: -1, bushCoverMultiplier: -1 }, 0],
  ] as const)('%s', (name, input, expected) => {
    expect(calculatePhotoQuality(input), name).toBeCloseTo(expected);
  });
});
