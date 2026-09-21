/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import type { Camera, Landmark, WorldRoute } from '../types';
import { createMinimapModel, projectWorldPoint } from './minimap';

const world = { width: 3200, height: 2200 };
const rect = { x: 760, y: 395, width: 180, height: 125 };

describe('projectWorldPoint', () => {
  it.each([
    [{ x: 0, y: 0 }, { x: 760, y: 395 }],
    [{ x: 3200, y: 2200 }, { x: 940, y: 520 }],
    [{ x: 1600, y: 1100 }, { x: 850, y: 457.5 }],
    [{ x: -1, y: 2201 }, { x: 760, y: 520 }],
  ] as const)('projects %o into the map rectangle', (point, expected) => {
    expect(projectWorldPoint(point, world, rect)).toEqual(expected);
  });
});

describe('createMinimapModel', () => {
  it('contains the player, visible landmarks, and discovered cameras in world space', () => {
    const landmarks: readonly Landmark[] = [
      { id: 'high-den', kind: 'high-den', name: 'High Den', position: { x: 1540, y: 170 }, showOnMap: true },
      { id: 'hidden-ford', kind: 'creek-crossing', name: 'Hidden Ford', position: { x: 2130, y: 1080 }, showOnMap: false },
    ];
    const cameras: readonly Camera[] = [
      {
        id: 'camp', mountTreeId: 'camp-tree', position: { x: 900, y: 1350 },
        direction: { x: 1, y: 0 }, visionRange: 260, visionHalfAngleRadians: 0.5,
        interactionRadius: 100, photoCooldownMs: 3_600,
      },
      {
        id: 'bridge', mountTreeId: 'bridge-tree', position: { x: 1390, y: 1600 },
        direction: { x: 1, y: 0 }, visionRange: 260, visionHalfAngleRadians: 0.5,
        interactionRadius: 100, photoCooldownMs: 3_600,
      },
    ];
    const routes: readonly WorldRoute[] = [
      { id: 'shown-route', kind: 'trail', width: 20, showOnMap: true, points: [{ x: 0, y: 0 }, { x: 100, y: 100 }] },
      { id: 'hidden-creek', kind: 'creek', width: 118, showOnMap: false, points: [{ x: 200, y: 200 }, { x: 300, y: 300 }] },
    ];

    const model = createMinimapModel({
      player: { x: 1850, y: 2070 }, landmarks, cameras,
      discoveredCameraIds: ['camp'], disabledCameraIds: ['camp'], routes,
    });

    expect(model.markers).toEqual([
      { kind: 'player', id: 'player', position: { x: 1850, y: 2070 } },
      { kind: 'landmark', id: 'high-den', landmarkKind: 'high-den', position: { x: 1540, y: 170 } },
      { kind: 'camera', id: 'camp', position: { x: 900, y: 1350 }, disabled: true },
    ]);
    expect(model.routes).toEqual([routes[0]]);
    expect(model.markers.map(({ kind }) => kind)).toEqual(['player', 'landmark', 'camera']);
  });
});
