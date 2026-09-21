/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import type { Camera } from '../types';
import { createExplorationState, discoverNearbyCameras } from './exploration';

const cameras: readonly Camera[] = [
  {
    id: 'camp', mountTreeId: 'tree-camp', position: { x: 260, y: 0 },
    direction: { x: 1, y: 0 }, visionRange: 260, visionHalfAngleRadians: 0.5,
    interactionRadius: 100, photoCooldownMs: 3_600,
  },
  {
    id: 'bridge', mountTreeId: 'tree-bridge', position: { x: 260.01, y: 0 },
    direction: { x: 1, y: 0 }, visionRange: 260, visionHalfAngleRadians: 0.5,
    interactionRadius: 100, photoCooldownMs: 3_600,
  },
] as const;

describe('camera exploration', () => {
  it('starts without any discovered cameras', () => {
    expect(createExplorationState()).toEqual({ discoveredCameraIds: [] });
  });

  it('discovers cameras at the inclusive radius without mutating the prior state', () => {
    const empty = createExplorationState();

    const discovered = discoverNearbyCameras(empty, { x: 0, y: 0 }, cameras, 260);

    expect(discovered.discoveredCameraIds).toEqual(['camp']);
    expect(empty.discoveredCameraIds).toEqual([]);
  });

  it('keeps prior state identity when no new camera is discovered', () => {
    const discovered = discoverNearbyCameras(createExplorationState(), { x: 0, y: 0 }, cameras, 260);

    expect(discoverNearbyCameras(discovered, { x: 0, y: 0 }, cameras, 260)).toBe(discovered);
    expect(discoverNearbyCameras(discovered, { x: 1000, y: 1000 }, cameras, 260)).toBe(discovered);
  });

  it('appends newly in-range camera IDs in level order while retaining the old order', () => {
    const state = { discoveredCameraIds: ['ridge'] as const };
    const reversedCameras = [cameras[1], cameras[0]];

    expect(discoverNearbyCameras(state, { x: 0, y: 0 }, reversedCameras, 261))
      .toEqual({ discoveredCameraIds: ['ridge', 'bridge', 'camp'] });
  });
});
