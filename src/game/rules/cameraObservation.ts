/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { Camera, Circle, IdentifiedCircle, Point, Tree } from '../types';
import { calculatePhotoQuality } from './photoQuality';
import type { CameraId } from './gameState';
import { isPointInVisionCone, sampleVisibility } from './vision';

export interface CameraMountInput {
  readonly id: CameraId;
  readonly mountTreeId: string;
  readonly direction: Point;
  readonly mountOffset: number;
  readonly visionRange: number;
  readonly visionHalfAngleRadians: number;
  readonly interactionRadius: number;
  readonly photoCooldownMs: number;
}

export interface CameraObservationInput {
  readonly camera: Camera;
  readonly target: Circle;
  readonly occluders: readonly IdentifiedCircle[];
  readonly bushCoverMultiplier: number;
  readonly disabled: boolean;
}

export function createMountedCamera(input: CameraMountInput, tree: Tree): Camera {
  const directionLength = Math.hypot(input.direction.x, input.direction.y);
  if (directionLength === 0) {
    throw new Error('Camera direction must have non-zero length.');
  }

  const direction = {
    x: input.direction.x / directionLength,
    y: input.direction.y / directionLength,
  };
  const distanceFromTreeCentre = tree.radius + input.mountOffset;

  return {
    id: input.id,
    mountTreeId: input.mountTreeId,
    position: {
      x: tree.x + direction.x * distanceFromTreeCentre,
      y: tree.y + direction.y * distanceFromTreeCentre,
    },
    direction,
    visionRange: input.visionRange,
    visionHalfAngleRadians: input.visionHalfAngleRadians,
    interactionRadius: input.interactionRadius,
    photoCooldownMs: input.photoCooldownMs,
  };
}

export function evaluateCameraPhotograph(input: CameraObservationInput): number | null {
  if (input.disabled || !isPointInVisionCone(input.target, {
    origin: input.camera.position,
    direction: input.camera.direction,
    range: input.camera.visionRange,
    halfAngleRadians: input.camera.visionHalfAngleRadians,
  })) {
    return null;
  }

  const visibility = sampleVisibility(
    input.camera.position,
    input.target,
    input.occluders.filter(({ id }) => id !== input.camera.mountTreeId),
  );
  if (visibility === 0) {
    return null;
  }

  return calculatePhotoQuality({
    distance: Math.hypot(
      input.target.x - input.camera.position.x,
      input.target.y - input.camera.position.y,
    ),
    unobstructedRayFraction: visibility,
    bushCoverMultiplier: input.bushCoverMultiplier,
  });
}
