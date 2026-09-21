/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { CAMERA_IDS } from '../rules/gameState';
import { segmentIntersectsCircle } from '../rules/vision';
import type { Circle, IdentifiedCircle, LandmarkKind, LevelData, Point } from '../types';

const PATROL_CLEARANCE = 13 + 4;
const REQUIRED_LANDMARK_KINDS: readonly LandmarkKind[] = [
  'hunter-camp', 'logging-spur', 'creek-crossing', 'june-bowl', 'high-den',
];

/** Reports all authored contract violations in a deterministic collection order. */
export function getLevelValidationErrors(level: LevelData): readonly string[] {
  const errors: string[] = [];
  for (const dimension of ['width', 'height'] as const) {
    if (!Number.isFinite(level[dimension]) || level[dimension] <= 0) {
      errors.push(`${dimension} must be finite and positive`);
    }
  }

  for (const collection of [
    'trees', 'bushes', 'cameras', 'terrainRegions', 'routes', 'waterCrossings', 'landmarks', 'props', 'terrainBlockers', 'patrolPaths',
  ] as const) {
    const seen = new Set<string>();
    for (const { id } of level[collection]) {
      if (seen.has(id)) errors.push(`duplicate ${collection} id: ${id}`);
      seen.add(id);
    }
  }

  const inBounds = ({ x, y }: Point): boolean => Number.isFinite(x) && Number.isFinite(y)
    && x >= 0 && x <= level.width && y >= 0 && y <= level.height;
  const checkPoint = (point: Point, label: string): void => {
    if (!inBounds(point)) errors.push(`${label} is out of bounds`);
  };
  const checkCircle = ({ x, y, radius }: Circle, label: string): void => {
    if (!Number.isFinite(radius) || radius < 0
      || !inBounds({ x: x - radius, y: y - radius }) || !inBounds({ x: x + radius, y: y + radius })) {
      errors.push(`${label} circle is out of bounds`);
    }
  };

  checkPoint(level.spawn, 'spawn');
  checkCircle(level.cave, 'cave');
  for (const tree of level.trees) checkCircle(tree, `trees ${tree.id}`);
  for (const bush of level.bushes) checkCircle(bush, `bushes ${bush.id}`);
  for (const camera of level.cameras) checkPoint(camera.position, `cameras ${camera.id} position`);
  for (const collection of ['terrainRegions', 'routes'] as const) {
    for (const item of level[collection]) {
      item.points.forEach((point, index) => checkPoint(point, `${collection} ${item.id} point ${index}`));
    }
  }
  for (const crossing of level.waterCrossings) {
    if (!Number.isFinite(crossing.width) || crossing.width <= 0) {
      errors.push(`waterCrossings ${crossing.id} width must be finite and positive`);
    }
    if (crossing.points.length < 2) errors.push(`waterCrossings ${crossing.id} must contain at least 2 points`);
    crossing.points.forEach((point, index) => checkPoint(point, `waterCrossings ${crossing.id} point ${index}`));
  }
  for (const landmark of level.landmarks) checkPoint(landmark.position, `landmarks ${landmark.id} position`);
  for (const prop of level.props) checkCircle({ ...prop.position, radius: prop.footprintRadius }, `props ${prop.id}`);
  for (const blocker of level.terrainBlockers) checkCircle(blocker, `terrainBlockers ${blocker.id}`);

  if (level.cameras.length !== CAMERA_IDS.length || CAMERA_IDS.some((id, index) => level.cameras[index]?.id !== id)) {
    errors.push(`cameras must match canonical IDs in order: ${CAMERA_IDS.join(', ')}`);
  }
  for (const camera of level.cameras) {
    const mount = level.trees.find(({ id }) => id === camera.mountTreeId);
    if (!mount) errors.push(`camera ${camera.id} mount tree ${camera.mountTreeId} does not exist`);
    const directionLength = Math.hypot(camera.direction.x, camera.direction.y);
    if (!Number.isFinite(directionLength) || Math.abs(directionLength - 1) > 1e-6) {
      errors.push(`camera ${camera.id} direction must be unit length`);
    }
    if (mount && !(Math.hypot(camera.position.x - mount.x, camera.position.y - mount.y) > mount.radius)) {
      errors.push(`camera ${camera.id} lens must lie beyond mount tree radius`);
    }
  }

  const obstacles = [
    ...level.trees.map((circle) => ({ circle, label: `tree ${circle.id}` })),
    ...level.terrainBlockers.map((circle) => ({ circle, label: `terrain blocker ${circle.id}` })),
    ...level.props.filter(({ footprintRadius }) => footprintRadius > 0).map((prop) => ({
      circle: { ...prop.position, radius: prop.footprintRadius }, label: `prop ${prop.id}`,
    })),
  ];
  if (level.patrolPaths.length !== 3) errors.push('patrolPaths must contain exactly 3 patrols');
  for (const patrol of level.patrolPaths) {
    if (patrol.points.length < 2) errors.push(`patrol ${patrol.id} must contain at least 2 points`);
    patrol.points.forEach((point, index) => {
      checkPoint(point, `patrolPaths ${patrol.id} point ${index}`);
      if (!(point.x <= 1600 && point.y >= 900)) {
        errors.push(`patrol ${patrol.id} point ${index} must stay at x <= 1600 and y >= 900`);
      }
    });
    if (patrol.points.length < 2) continue;
    patrol.points.forEach((start, index) => {
      const end = patrol.points[(index + 1) % patrol.points.length];
      for (const { circle, label } of obstacles) {
        if (segmentIntersectsCircle(start, end, { ...circle, radius: circle.radius + PATROL_CLEARANCE })) {
          errors.push(`patrol ${patrol.id} segment ${index} intersects ${label} (17px clearance)`);
        }
      }
    });
  }

  for (const kind of REQUIRED_LANDMARK_KINDS) {
    if (!level.landmarks.some((landmark) => landmark.kind === kind)) errors.push(`missing landmark kind: ${kind}`);
  }
  return errors;
}

export function getSightOccluders(level: LevelData): readonly IdentifiedCircle[] {
  return [...level.trees, ...level.terrainBlockers.filter(({ blocksSight }) => blocksSight)];
}
