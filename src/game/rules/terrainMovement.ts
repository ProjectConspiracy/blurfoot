/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { Circle, LevelData, Point, TerrainBlocker } from '../types';
import { segmentIntersectsCircle } from './vision';

export const WATER_SPEED_MULTIPLIER = 0.35;

/** Segment capsules form a continuous corridor, including round joins and end caps. */
function overlapsPath(player: Circle, points: readonly Point[], distance: number): boolean {
  if (distance < 0) return false;
  return points.some((end, index) => index > 0 && segmentIntersectsCircle(points[index - 1], end, {
    ...player, radius: distance,
  }));
}

/** Water slows any circular-footprint overlap; crossings carry that footprint at normal speed. */
export function getTerrainSpeedMultiplier(
  player: Circle,
  level: Pick<LevelData, 'routes' | 'terrainBlockers' | 'waterCrossings'>,
): number {
  const fitsCrossing = level.waterCrossings.some((crossing) => (
    overlapsPath(player, crossing.points, crossing.width / 2 - player.radius)
  ));
  if (fitsCrossing) return 1;

  const touchesCreek = level.routes.some((route) => route.kind === 'creek'
    && overlapsPath(player, route.points, route.width / 2 + player.radius));
  const touchesPool = level.terrainBlockers.some((terrain) => terrain.kind === 'water'
    && Math.hypot(player.x - terrain.x, player.y - terrain.y) <= player.radius + terrain.radius);
  return touchesCreek || touchesPool ? WATER_SPEED_MULTIPLIER : 1;
}

/** Water remains authored terrain but is never a solid physics obstacle. */
export function getSolidTerrain(level: Pick<LevelData, 'terrainBlockers'>): readonly TerrainBlocker[] {
  return level.terrainBlockers.filter(({ kind }) => kind === 'rock');
}
