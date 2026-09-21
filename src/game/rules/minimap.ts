/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { Camera, Landmark, LandmarkKind, Point, WorldRoute } from '../types';
import type { CameraId } from './gameState';

export interface MinimapRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface WorldSize {
  readonly width: number;
  readonly height: number;
}

export type MinimapMarker =
  | { readonly kind: 'player'; readonly id: 'player'; readonly position: Point }
  | { readonly kind: 'landmark'; readonly id: string; readonly landmarkKind: LandmarkKind; readonly position: Point }
  | { readonly kind: 'camera'; readonly id: CameraId; readonly position: Point; readonly disabled: boolean };

export interface MinimapInput {
  readonly player: Point;
  readonly landmarks: readonly Landmark[];
  readonly cameras: readonly Camera[];
  readonly discoveredCameraIds: readonly CameraId[];
  readonly disabledCameraIds: readonly string[];
  readonly routes: readonly WorldRoute[];
}

export interface MinimapModel {
  readonly markers: readonly MinimapMarker[];
  readonly routes: readonly WorldRoute[];
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.min(upper, Math.max(lower, value));
}

/** Projects a world point into a minimap rectangle while retaining its border bounds. */
export function projectWorldPoint(
  point: Point,
  worldSize: WorldSize,
  mapRect: MinimapRect,
): Point {
  const projectedX = mapRect.x + point.x / worldSize.width * mapRect.width;
  const projectedY = mapRect.y + point.y / worldSize.height * mapRect.height;

  return {
    x: clamp(projectedX, mapRect.x, mapRect.x + mapRect.width),
    y: clamp(projectedY, mapRect.y, mapRect.y + mapRect.height),
  };
}

/** Builds a renderer-independent summary of the explored parts of the world. */
export function createMinimapModel(input: MinimapInput): MinimapModel {
  const discoveredIds = new Set(input.discoveredCameraIds);
  const disabledIds = new Set(input.disabledCameraIds);
  const markers: MinimapMarker[] = [
    { kind: 'player', id: 'player', position: input.player },
    ...input.landmarks
      .filter((landmark) => landmark.showOnMap)
      .map((landmark) => ({
        kind: 'landmark' as const,
        id: landmark.id,
        landmarkKind: landmark.kind,
        position: landmark.position,
      })),
    ...input.cameras
      .filter((camera) => discoveredIds.has(camera.id))
      .map((camera) => ({
        kind: 'camera' as const,
        id: camera.id,
        position: camera.position,
        disabled: disabledIds.has(camera.id),
      })),
  ];

  return {
    markers,
    routes: input.routes.filter((route) => route.showOnMap),
  };
}
