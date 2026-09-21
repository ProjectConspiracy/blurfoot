/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { Camera, Point } from '../types';
import type { CameraId } from './gameState';

/** Cameras Bigfoot has encountered during the current run. */
export interface ExplorationState {
  readonly discoveredCameraIds: readonly CameraId[];
}

export function createExplorationState(): ExplorationState {
  return { discoveredCameraIds: [] };
}

/** Adds in-range cameras in the supplied level order without mutating existing state. */
export function discoverNearbyCameras(
  state: ExplorationState,
  player: Point,
  cameras: readonly Camera[],
  discoveryRadius: number,
): ExplorationState {
  const radiusSquared = discoveryRadius * discoveryRadius;
  const knownIds = new Set(state.discoveredCameraIds);
  const newlyDiscovered = cameras
    .filter((camera) => {
      const deltaX = camera.position.x - player.x;
      const deltaY = camera.position.y - player.y;
      return !knownIds.has(camera.id) && deltaX * deltaX + deltaY * deltaY <= radiusSquared;
    })
    .map((camera) => camera.id);

  return newlyDiscovered.length === 0
    ? state
    : { discoveredCameraIds: [...state.discoveredCameraIds, ...newlyDiscovered] };
}
