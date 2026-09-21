/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { CameraId } from './rules/gameState';

/** Renderer-independent coordinates in the authored game world. */
export interface Point {
  readonly x: number;
  readonly y: number;
}

/** A circular world object used for collision and line-of-sight checks. */
export interface Circle extends Point {
  readonly radius: number;
}

export interface IdentifiedCircle extends Circle { readonly id: string }
export type TerrainKind = 'lower-forest' | 'access' | 'lahar' | 'lava-forest' | 'ridge';
export interface TerrainRegion {
  readonly id: string;
  readonly kind: TerrainKind;
  readonly points: readonly Point[];
}
export type RouteKind = 'road' | 'trail' | 'creek';
export interface WorldRoute {
  readonly id: string;
  readonly kind: RouteKind;
  readonly points: readonly Point[];
  readonly width: number;
  readonly showOnMap: boolean;
}
export type LandmarkKind = 'hunter-camp' | 'logging-spur' | 'creek-crossing' | 'june-bowl' | 'high-den';
export interface Landmark {
  readonly id: string;
  readonly kind: LandmarkKind;
  readonly name: string;
  readonly position: Point;
  readonly showOnMap: boolean;
}
export type PropKind = 'tent' | 'pickup' | 'atv' | 'canopy' | 'table' | 'generator'
  | 'battery' | 'crate' | 'cooler' | 'radio-mast' | 'thermal-tripod'
  | 'parabolic-dish' | 'camera-rack' | 'map-board' | 'log-pile' | 'stump' | 'camp-light';
export interface WorldProp {
  readonly id: string;
  readonly kind: PropKind;
  readonly position: Point;
  readonly rotationRadians?: number;
  readonly footprintRadius: number;
}
export type TerrainBlockerKind = 'water' | 'rock';
export interface TerrainBlocker extends IdentifiedCircle {
  readonly kind: TerrainBlockerKind;
  readonly blocksSight: boolean;
}

export interface Tree extends Circle {
  readonly id: string;
}

export interface Bush extends Circle {
  readonly id: string;
  /** Multiplier passed to photo-quality scoring while Bigfoot is inside this bush. */
  readonly coverMultiplier: number;
}

export interface Camera {
  readonly id: CameraId;
  readonly mountTreeId: string;
  readonly position: Point;
  readonly direction: Point;
  readonly visionRange: number;
  readonly visionHalfAngleRadians: number;
  readonly interactionRadius: number;
  readonly photoCooldownMs: number;
}

export interface Cave extends Circle {
  readonly id: 'cave';
}

export interface PatrolPath {
  readonly id: string;
  readonly points: readonly Point[];
}

export interface LevelData {
  readonly width: number;
  readonly height: number;
  readonly trees: readonly Tree[];
  readonly bushes: readonly Bush[];
  readonly cameras: readonly Camera[];
  readonly cave: Cave;
  readonly spawn: Point;
  readonly patrolPaths: readonly PatrolPath[];
  readonly terrainRegions: readonly TerrainRegion[];
  readonly routes: readonly WorldRoute[];
  readonly landmarks: readonly Landmark[];
  readonly props: readonly WorldProp[];
  readonly terrainBlockers: readonly TerrainBlocker[];
}
