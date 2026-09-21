/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
export interface PhotoQualityInput {
  /** Hiker-to-Bigfoot distance in logical pixels; vision range is 340 pixels. */
  readonly distance: number;
  /** Fraction of the three silhouette rays that reach Bigfoot unobstructed. */
  readonly unobstructedRayFraction: number;
  /** Bush-cover factor, where 1 is exposed and 0 is fully covered. */
  readonly bushCoverMultiplier: number;
}

const VISION_RANGE = 340;

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * Scores a photograph from proximity, visible silhouette, and bush cover.
 * Tree occlusion should supply an unobstructedRayFraction of zero.
 */
export function calculatePhotoQuality(input: PhotoQualityInput): number {
  const proximity = 1 - clampUnit(input.distance / VISION_RANGE);
  const visibleFraction = clampUnit(input.unobstructedRayFraction);
  const bushCover = clampUnit(input.bushCoverMultiplier);

  return clampUnit(proximity * visibleFraction * bushCover);
}
