/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import { FOREST_LEVEL } from '../content/level';
import { getSightOccluders } from '../content/levelValidation';
import type { Camera, IdentifiedCircle, Tree } from '../types';
import { CAMERA_IDS, createRunState, recordPhoto } from './gameState';
import { createMountedCamera, evaluateCameraPhotograph } from './cameraObservation';

const frontFacingCamera: Camera = {
  id: 'camp',
  mountTreeId: 'mount',
  position: { x: 0, y: 0 },
  direction: { x: 1, y: 0 },
  visionRange: 100,
  visionHalfAngleRadians: Math.PI / 4,
  interactionRadius: 48,
  photoCooldownMs: 3_600,
};

const frontInput = {
  camera: frontFacingCamera,
  target: { x: 50, y: 0, radius: 10 },
  occluders: [] as readonly IdentifiedCircle[],
  bushCoverMultiplier: 1,
  disabled: false,
};

describe('createMountedCamera', () => {
  it('normalizes the facing direction and places the lens at the tree edge plus offset', () => {
    const tree: Tree = { id: 'mount', x: 100, y: 100, radius: 40 };

    const camera = createMountedCamera({
      id: 'camp',
      mountTreeId: tree.id,
      direction: { x: 3, y: 4 },
      mountOffset: 10,
      visionRange: 260,
      visionHalfAngleRadians: Math.PI * 26 / 180,
      interactionRadius: 100,
      photoCooldownMs: 3_600,
    }, tree);

    expect(camera.direction).toEqual({ x: 0.6, y: 0.8 });
    expect(Math.hypot(camera.position.x - tree.x, camera.position.y - tree.y)).toBe(50);
  });

  it('rejects a zero-length facing direction', () => {
    const tree: Tree = { id: 'mount', x: 100, y: 100, radius: 40 };

    expect(() => createMountedCamera({
      id: 'camp',
      mountTreeId: tree.id,
      direction: { x: 0, y: 0 },
      mountOffset: 10,
      visionRange: 260,
      visionHalfAngleRadians: Math.PI * 26 / 180,
      interactionRadius: 100,
      photoCooldownMs: 3_600,
    }, tree)).toThrow();
  });
});

describe('evaluateCameraPhotograph', () => {
  it('returns photo quality for a visible target in front of the camera', () => {
    expect(evaluateCameraPhotograph(frontInput)).not.toBeNull();
  });

  it.each([
    ['behind the camera', { x: -50, y: 0, radius: 10 }],
    ['beside the camera', { x: 0, y: 50, radius: 10 }],
    ['beyond the camera range', { x: 101, y: 0, radius: 10 }],
  ] as const)('returns null when the target is %s', (_name, target) => {
    expect(evaluateCameraPhotograph({ ...frontInput, target })).toBeNull();
  });

  it('returns null while the camera is disabled', () => {
    expect(evaluateCameraPhotograph({ ...frontInput, disabled: true })).toBeNull();
  });

  it('returns null when trees fully conceal the target', () => {
    const blockingTree: Tree = { id: 'blocking', x: 25, y: 0, radius: 15 };

    expect(evaluateCameraPhotograph({ ...frontInput, occluders: [blockingTree] })).toBeNull();
  });

  it('does not let the camera mount tree occlude its photograph', () => {
    const mountTree: Tree = { id: 'mount', x: 0, y: 0, radius: 20 };
    const frontInputWithMountTree = { ...frontInput, occluders: [mountTree] };
    const frontInputWithoutMountTree = { ...frontInput, occluders: [] };

    expect(evaluateCameraPhotograph(frontInputWithMountTree)).toBe(
      evaluateCameraPhotograph(frontInputWithoutMountTree),
    );
  });

  it('retains a different-ID rock as an occluder when excluding the mount tree', () => {
    const mountTree: IdentifiedCircle = { id: 'mount', x: 0, y: 0, radius: 20 };
    const rock: IdentifiedCircle = { id: 'rock-1', x: 25, y: 0, radius: 15 };

    expect(evaluateCameraPhotograph({ ...frontInput, occluders: [mountTree, rock] })).toBeNull();
  });

  it('reduces photo quality when the target is under bush cover', () => {
    expect(evaluateCameraPhotograph({ ...frontInput, bushCoverMultiplier: 0.4 }))
      .toBeLessThan(evaluateCameraPhotograph(frontInput) ?? 0);
  });
});

describe('FOREST_LEVEL cameras', () => {
  it('provides the five expanded forest camera mounts in camera ID order', () => {
    expect(FOREST_LEVEL.cameras.map(({ id }) => id)).toEqual(CAMERA_IDS);
    expect(FOREST_LEVEL.cameras.map(({ id, mountTreeId }) => ({ id, mountTreeId }))).toEqual([
      { id: 'camp', mountTreeId: 'mount-camp' },
      { id: 'bridge', mountTreeId: 'mount-bridge' },
      { id: 'deadfall', mountTreeId: 'mount-deadfall' },
      { id: 'bowl', mountTreeId: 'mount-bowl' },
      { id: 'ridge', mountTreeId: 'mount-ridge' },
    ]);
  });

  it('uses unit directions and positions every camera just beyond its mount tree edge', () => {
    expect(FOREST_LEVEL.cameras).toHaveLength(5);

    FOREST_LEVEL.cameras.forEach((camera) => {
      const mountTree = FOREST_LEVEL.trees.find(({ id }) => id === camera.mountTreeId);

      expect(mountTree).toBeDefined();
      expect(Math.hypot(camera.direction.x, camera.direction.y)).toBeCloseTo(1);
      expect(Math.hypot(
        camera.position.x - (mountTree?.x ?? 0),
        camera.position.y - (mountTree?.y ?? 0),
      )).toBeCloseTo((mountTree?.radius ?? 0) + 10);
    });
  });

  it('makes the marked deadfall crossing a harmless covered-camera exposure', () => {
    const camera = FOREST_LEVEL.cameras.find(({ id }) => id === 'deadfall');
    const target = { x: 1770, y: 1400, radius: 20 };
    const bushCoverMultiplier = FOREST_LEVEL.bushes.reduce((multiplier, bush) => (
      Math.hypot(target.x - bush.x, target.y - bush.y) <= target.radius + bush.radius
        ? Math.min(multiplier, bush.coverMultiplier)
        : multiplier
    ), 1);

    expect(camera).toBeDefined();
    const quality = evaluateCameraPhotograph({
      camera: camera!,
      target,
      occluders: getSightOccluders(FOREST_LEVEL),
      bushCoverMultiplier,
      disabled: false,
    });
    expect(quality).not.toBeNull();

    const photographed = recordPhoto(createRunState(), quality!);
    expect(photographed).toMatchObject({ lastPhoto: 'blurry', clearPhotoCount: 0 });
  });

  it('keeps the eastern trail\'s marked ridge approach behind the ridge camera', () => {
    const camera = FOREST_LEVEL.cameras.find(({ id }) => id === 'ridge');
    const route = FOREST_LEVEL.routes.find(({ id }) => id === 'eastern-basalt-route');
    expect(camera).toBeDefined();
    expect(route).toBeDefined();

    const approachStart = route!.points.findIndex(({ x, y }) => x === 2200 && y === 720);
    expect(approachStart).toBeGreaterThanOrEqual(0);
    let firstExposure: { readonly x: number; readonly y: number } | null = null;

    for (let index = approachStart + 1; index < route!.points.length && !firstExposure; index += 1) {
      const start = route!.points[index - 1];
      const end = route!.points[index];
      const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 8);
      for (let step = 0; step <= steps; step += 1) {
        const progress = step / steps;
        const target = {
          x: start.x + (end.x - start.x) * progress,
          y: start.y + (end.y - start.y) * progress,
          radius: 20,
        };
        if (evaluateCameraPhotograph({
          camera: camera!,
          target,
          occluders: getSightOccluders(FOREST_LEVEL),
          bushCoverMultiplier: 1,
          disabled: false,
        }) !== null) {
          firstExposure = { x: Math.round(target.x), y: Math.round(target.y) };
          break;
        }
      }
    }

    expect(firstExposure).toBeNull();
  });

  it('keeps ridge-camera photographs blurry along the covered deadfall trail', () => {
    const camera = FOREST_LEVEL.cameras.find(({ id }) => id === 'ridge');
    const route = FOREST_LEVEL.routes.find(({ id }) => id === 'covered-deadfall-route');
    expect(camera).toBeDefined();
    expect(route).toBeDefined();

    const crossingStart = route!.points.findIndex(({ x, y }) => x === 1720 && y === 820);
    expect(crossingStart).toBeGreaterThanOrEqual(0);
    const start = route!.points[crossingStart];
    const end = route!.points[crossingStart + 1];
    const steps = Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 4);
    const observedQualities: number[] = [];

    for (let step = 0; step <= steps; step += 1) {
      const progress = step / steps;
      const target = {
        x: start.x + (end.x - start.x) * progress,
        y: start.y + (end.y - start.y) * progress,
        radius: 20,
      };
      const bushCoverMultiplier = FOREST_LEVEL.bushes.reduce((multiplier, bush) => (
        Math.hypot(target.x - bush.x, target.y - bush.y) <= target.radius + bush.radius
          ? Math.min(multiplier, bush.coverMultiplier)
          : multiplier
      ), 1);
      const quality = evaluateCameraPhotograph({
        camera: camera!, target, occluders: getSightOccluders(FOREST_LEVEL),
        bushCoverMultiplier, disabled: false,
      });
      if (quality !== null) observedQualities.push(quality);
    }

    expect(observedQualities.length).toBeGreaterThan(0);
    expect(observedQualities.every((quality) => (
      recordPhoto(createRunState(), quality).clearPhotoCount === 0
    ))).toBe(true);
  });

  it('provides a covered side pocket within reach of the ridge camera', () => {
    const camera = FOREST_LEVEL.cameras.find(({ id }) => id === 'ridge');
    const target = { x: 1560, y: 780, radius: 20 };
    const bushCoverMultiplier = FOREST_LEVEL.bushes.reduce((multiplier, bush) => (
      Math.hypot(target.x - bush.x, target.y - bush.y) <= target.radius + bush.radius
        ? Math.min(multiplier, bush.coverMultiplier)
        : multiplier
    ), 1);

    expect(camera).toBeDefined();
    expect(Math.hypot(target.x - camera!.position.x, target.y - camera!.position.y))
      .toBeLessThan(camera!.interactionRadius - 10);
    expect(bushCoverMultiplier).toBeLessThan(1);
    expect(evaluateCameraPhotograph({
      camera: camera!, target, occluders: getSightOccluders(FOREST_LEVEL),
      bushCoverMultiplier, disabled: false,
    })).toBeNull();
  });
});
