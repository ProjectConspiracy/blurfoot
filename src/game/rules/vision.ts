/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { Circle, Point } from '../types';

export type { Circle, Point } from '../types';

/** A hiker's forward-facing field of view. Direction need not be unit length. */
export interface VisionCone {
  readonly origin: Point;
  readonly direction: Point;
  readonly range: number;
  readonly halfAngleRadians: number;
}

const EPSILON = 1e-9;

function length(vector: Point): number {
  return Math.hypot(vector.x, vector.y);
}

/** Returns true when a target lies in both the angular and distance bounds of a cone. */
export function isPointInVisionCone(point: Point, cone: VisionCone): boolean {
  const offset = { x: point.x - cone.origin.x, y: point.y - cone.origin.y };
  const distance = length(offset);
  if (distance > cone.range || cone.range < 0) {
    return false;
  }

  if (distance < EPSILON) {
    return true;
  }

  const directionLength = length(cone.direction);
  if (directionLength < EPSILON || cone.halfAngleRadians < 0) {
    return false;
  }

  const cosine = (offset.x * cone.direction.x + offset.y * cone.direction.y)
    / (distance * directionLength);
  return cosine + EPSILON >= Math.cos(cone.halfAngleRadians);
}

/** Tests whether the closed segment from start to end meets a circular obstacle. */
export function segmentIntersectsCircle(start: Point, end: Point, circle: Circle): boolean {
  const segment = { x: end.x - start.x, y: end.y - start.y };
  const segmentLengthSquared = segment.x ** 2 + segment.y ** 2;
  const fromStart = { x: circle.x - start.x, y: circle.y - start.y };

  const projection = segmentLengthSquared < EPSILON
    ? 0
    : Math.max(0, Math.min(1, (fromStart.x * segment.x + fromStart.y * segment.y) / segmentLengthSquared));
  const closest = {
    x: start.x + segment.x * projection,
    y: start.y + segment.y * projection,
  };

  return Math.hypot(circle.x - closest.x, circle.y - closest.y) <= circle.radius;
}

/**
 * Returns the unobstructed share of Bigfoot's centre and two perpendicular edge samples.
 * The result feeds directly into calculatePhotoQuality's unobstructedRayFraction.
 */
export function sampleVisibility(
  observer: Point,
  target: Circle,
  occluders: readonly Circle[],
): number {
  const towardTarget = { x: target.x - observer.x, y: target.y - observer.y };
  const targetDistance = length(towardTarget);
  const perpendicular = targetDistance < EPSILON
    ? { x: 0, y: 0 }
    : { x: -towardTarget.y / targetDistance * target.radius, y: towardTarget.x / targetDistance * target.radius };
  const samples: readonly Point[] = [
    { x: target.x, y: target.y },
    { x: target.x + perpendicular.x, y: target.y + perpendicular.y },
    { x: target.x - perpendicular.x, y: target.y - perpendicular.y },
  ];
  const visibleSamples = samples.filter((sample) => !occluders.some((tree) => (
    segmentIntersectsCircle(observer, sample, tree)
  ))).length;

  return visibleSamples / samples.length;
}
