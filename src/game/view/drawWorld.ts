/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import Phaser from 'phaser';
import type { CameraId } from '../rules/gameState';
import { createMinimapModel, projectWorldPoint } from '../rules/minimap';
import type { LevelData, Point, TerrainKind, WorldProp } from '../types';

export interface HikerRenderState {
  readonly position: Point;
  readonly direction: Point;
}

export interface WorldRenderState {
  readonly hikers: readonly HikerRenderState[];
  readonly disabledCameraIds: readonly string[];
  readonly minimap: {
    readonly playerPosition: Point;
    readonly discoveredCameraIds: readonly CameraId[];
  };
  readonly interaction: {
    readonly cameraId: CameraId;
    readonly progress: number;
  } | null;
  readonly photoFlash: 'clear' | 'blurry' | null;
  readonly photoFlashAlpha: number;
}

export interface WorldView {
  readonly player: Phaser.GameObjects.Rectangle;
  readonly trees: readonly Phaser.GameObjects.Arc[];
  readonly terrainBlockers: readonly Phaser.GameObjects.Arc[];
  readonly hikers: readonly Phaser.GameObjects.Arc[];
  readonly cameras: ReadonlyMap<CameraId, Phaser.GameObjects.Rectangle>;
  readonly cameraStraps: ReadonlyMap<CameraId, Phaser.GameObjects.Rectangle>;
  readonly cameraLenses: ReadonlyMap<CameraId, Phaser.GameObjects.Arc>;
  readonly cave: Phaser.GameObjects.Arc;
  readonly cones: Phaser.GameObjects.Graphics;
  readonly cameraMarks: Phaser.GameObjects.Graphics;
  readonly cameraProgress: Phaser.GameObjects.Graphics;
  readonly flash: Phaser.GameObjects.Rectangle;
  readonly minimapBase: Phaser.GameObjects.Graphics;
  readonly minimapDynamic: Phaser.GameObjects.Graphics;
}

const VISION_RANGE = 340;
const VISION_HALF_ANGLE = Phaser.Math.DegToRad(35);
const MINIMAP_RECT = { x: 760, y: 395, width: 180, height: 125 };

function drawTerrain(graphics: Phaser.GameObjects.Graphics, level: LevelData): void {
  const colors: Record<TerrainKind, number> = {
    'lower-forest': 0x183c2a, access: 0x394638, lahar: 0x585850,
    'lava-forest': 0x29453c, ridge: 0x4c5852,
  };
  level.terrainRegions.forEach((region) => {
    graphics.fillStyle(colors[region.kind]);
    graphics.fillPoints([...region.points], true);
  });
  level.routes.filter(({ kind }) => kind === 'creek').forEach((route) => {
    graphics.lineStyle(route.width, 0x1e3b44);
    graphics.strokePoints([...route.points]);
    graphics.lineStyle(24, 0x719da3, 0.45);
    graphics.strokePoints([...route.points]);
  });
  level.terrainBlockers.forEach((blocker) => {
    if (blocker.kind === 'water') {
      const isBowlPool = blocker.id === 'june-bowl-pool';
      graphics.fillStyle(isBowlPool ? 0x1c5261 : 0x244a56, 0.9);
      graphics.fillCircle(blocker.x, blocker.y, blocker.radius);
      graphics.lineStyle(2, isBowlPool ? 0x9bc5ca : 0x82a7ad, isBowlPool ? 0.65 : 0.35);
      graphics.strokeCircle(blocker.x, blocker.y, blocker.radius);
      if (isBowlPool) {
        graphics.lineStyle(2, 0x8ebbc2, 0.48);
        graphics.strokeCircle(blocker.x, blocker.y, blocker.radius * 0.62);
        graphics.strokeCircle(blocker.x, blocker.y, blocker.radius * 0.34);
      } else {
        graphics.lineBetween(blocker.x - 17, blocker.y - 3, blocker.x + 17, blocker.y + 3);
      }
    } else {
      graphics.fillStyle(0x343d3c);
      graphics.fillCircle(blocker.x, blocker.y, blocker.radius);
      graphics.lineStyle(4, 0x77817a, 0.85);
      graphics.strokeCircle(blocker.x, blocker.y, blocker.radius);
      graphics.lineStyle(2, 0x889088, 0.5);
      graphics.strokePoints([
        { x: blocker.x - blocker.radius * 0.55, y: blocker.y + 12 },
        { x: blocker.x - 8, y: blocker.y - blocker.radius * 0.55 },
        { x: blocker.x + blocker.radius * 0.5, y: blocker.y - 8 },
      ]);
    }
  });
  const bowlPool = level.terrainBlockers.find(({ id }) => id === 'june-bowl-pool');
  const bowlShelves = level.terrainBlockers.filter(({ id }) => id.startsWith('june-bowl-shelf-'));
  if (bowlPool?.kind === 'water' && bowlShelves.length === 2) {
    const waterfallX = (bowlShelves[0].x + bowlShelves[1].x) / 2;
    const waterfallTop = Math.max(...bowlShelves.map(({ y }) => y)) + 28;
    const waterfallBottom = bowlPool.y - bowlPool.radius * 0.5;
    graphics.lineStyle(16, 0x5f97a5, 0.82);
    graphics.lineBetween(waterfallX, waterfallTop, waterfallX, waterfallBottom);
    graphics.lineStyle(4, 0xc2dddc, 0.72);
    graphics.lineBetween(waterfallX - 4, waterfallTop + 2, waterfallX - 4, waterfallBottom);
    graphics.lineBetween(waterfallX + 5, waterfallTop, waterfallX + 5, waterfallBottom - 2);
    graphics.lineStyle(3, 0x8e9992, 0.75);
    bowlShelves.forEach((shelf) => {
      graphics.lineBetween(
        shelf.x - shelf.radius * 0.68,
        shelf.y + shelf.radius * 0.15,
        shelf.x + shelf.radius * 0.68,
        shelf.y + shelf.radius * 0.24,
      );
    });
  }
  // The authored route strokes bridge the creek at its three navigable gaps.
  level.routes.filter(({ kind }) => kind !== 'creek').forEach((route) => {
    graphics.lineStyle(route.width + 4, 0x24372d, 0.55);
    graphics.strokePoints([...route.points]);
    graphics.lineStyle(route.width, route.kind === 'road' ? 0x807763 : 0x697258, 0.9);
    graphics.strokePoints([...route.points]);
    graphics.lineStyle(2, 0xb8ac85, 0.4);
    graphics.strokePoints([...route.points]);
  });
}

function drawProp(graphics: Phaser.GameObjects.Graphics, prop: WorldProp): void {
  graphics.save();
  graphics.translateCanvas(prop.position.x, prop.position.y);
  graphics.rotateCanvas(prop.rotationRadians ?? 0);
  graphics.lineStyle(2, 0x242d29);
  const box = (width: number, height: number, color: number): void => {
    graphics.fillStyle(color);
    graphics.fillRect(-width / 2, -height / 2, width, height);
    graphics.strokeRect(-width / 2, -height / 2, width, height);
  };
  switch (prop.kind) {
    case 'tent':
      graphics.fillStyle(0xb19557);
      graphics.fillTriangle(-34, 24, 0, -30, 34, 24);
      graphics.strokeTriangle(-34, 24, 0, -30, 34, 24);
      graphics.fillStyle(0x3c4031);
      graphics.fillTriangle(-13, 24, 0, -9, 13, 24);
      break;
    case 'pickup':
      box(80, 40, 0x87918a);
      graphics.fillStyle(0x31434a);
      graphics.fillRect(-14, -16, 22, 32);
      graphics.strokeRect(12, -15, 23, 30);
      graphics.fillStyle(0x222b29);
      for (const x of [-28, 22]) for (const y of [-24, 17]) graphics.fillRect(x, y, 13, 7);
      break;
    case 'atv':
      box(38, 24, 0x8f764c);
      graphics.fillStyle(0x222b29);
      for (const x of [-18, 8]) for (const y of [-19, 11]) graphics.fillRect(x, y, 10, 8);
      graphics.lineBetween(-2, -11, -2, 11);
      break;
    case 'canopy':
      graphics.fillStyle(0x8d9b87, 0.28);
      graphics.fillRect(-40, -32, 80, 64);
      graphics.lineStyle(3, 0xc0c4aa);
      graphics.strokeRect(-40, -32, 80, 64);
      graphics.lineBetween(-40, -32, 0, -42);
      graphics.lineBetween(0, -42, 40, -32);
      break;
    case 'table':
      box(48, 23, 0x817660);
      graphics.fillStyle(0x222f31);
      graphics.fillRect(-14, -9, 17, 13);
      graphics.fillStyle(0x80aeb0);
      graphics.fillRect(-12, -7, 13, 8);
      graphics.strokeRect(8, -7, 10, 11);
      break;
    case 'generator':
      box(38, 29, 0x927147);
      graphics.fillStyle(0x303b38);
      graphics.fillRect(-12, -8, 24, 16);
      graphics.lineBetween(-14, -19, 14, -19);
      break;
    case 'battery':
      box(19, 23, 0x505f61);
      graphics.lineStyle(2, 0xc0c4aa);
      graphics.lineBetween(-5, -5, 5, -5);
      graphics.lineBetween(0, -10, 0, 0);
      break;
    case 'crate':
      box(26, 26, 0x8b7550);
      graphics.lineBetween(-13, -13, 13, 13);
      graphics.lineBetween(13, -13, -13, 13);
      break;
    case 'cooler':
      box(31, 23, 0x7f9a9b);
      graphics.lineStyle(4, 0xc2c4b1);
      graphics.lineBetween(-14, -7, 14, -7);
      break;
    case 'radio-mast':
    case 'thermal-tripod':
      graphics.lineStyle(3, 0xadb4a8);
      graphics.lineBetween(0, -28, 0, 15);
      graphics.lineBetween(0, -5, -15, 18);
      graphics.lineBetween(0, -5, 15, 18);
      if (prop.kind === 'radio-mast') {
        graphics.lineBetween(-18, -23, 18, -23);
        graphics.lineBetween(-11, -34, 11, -34);
      } else {
        graphics.fillStyle(0x9ca9a0);
        graphics.fillRect(-12, -28, 27, 12);
        graphics.fillStyle(0x65adbe);
        graphics.fillCircle(17, -22, 4);
      }
      break;
    case 'parabolic-dish':
      graphics.lineStyle(3, 0xa9b4ad);
      graphics.lineBetween(0, 0, 0, 24);
      graphics.lineBetween(-13, 24, 13, 24);
      graphics.beginPath();
      graphics.arc(0, -8, 18, 0, Math.PI);
      graphics.strokePath();
      graphics.lineBetween(-18, -8, 18, -8);
      graphics.lineBetween(0, -8, 12, -23);
      break;
    case 'camera-rack':
      graphics.lineStyle(3, 0xa9b4ad);
      graphics.strokeRect(-23, -16, 46, 32);
      graphics.lineBetween(-23, 0, 23, 0);
      graphics.fillStyle(0x7a969b);
      for (const x of [-16, 0, 13]) graphics.fillRect(x, -12, 9, 8);
      break;
    case 'map-board':
      box(38, 28, 0xbfc3a2);
      graphics.lineStyle(2, 0x637f69);
      graphics.strokePoints([{ x: -13, y: 9 }, { x: -3, y: 0 }, { x: 12, y: -8 }]);
      graphics.lineStyle(3, 0x655641);
      graphics.lineBetween(-13, 14, -16, 23);
      graphics.lineBetween(13, 14, 16, 23);
      break;
    case 'log-pile':
      graphics.lineStyle(13, 0x715337);
      for (const y of [-15, 0, 15]) graphics.lineBetween(-30, y, 30, y);
      graphics.fillStyle(0xab9168);
      for (const y of [-15, 0, 15]) graphics.fillCircle(30, y, 6);
      break;
    case 'stump':
      graphics.fillStyle(0x80603e);
      graphics.fillCircle(0, 0, 15);
      graphics.lineStyle(2, 0xb39a6c);
      graphics.strokeCircle(0, 0, 9);
      break;
    case 'camp-light':
      for (const radius of [24, 15, 7]) {
        graphics.fillStyle(0xf4cc6d, 0.15);
        graphics.fillCircle(0, 0, radius);
      }
      graphics.fillStyle(0xf4d38d);
      graphics.fillCircle(0, 0, 3);
      break;
  }
  graphics.restore();
}

export function drawWorld(scene: Phaser.Scene, level: LevelData): WorldView {
  scene.add.rectangle(level.width / 2, level.height / 2, level.width, level.height, 0x183c2a);
  const terrainGraphics = scene.add.graphics().setDepth(0.1);
  drawTerrain(terrainGraphics, level);
  const propGraphics = scene.add.graphics().setDepth(1.2);
  propGraphics.lineStyle(2, 0x182722);
  propGraphics.strokePoints([{ x: 970, y: 1360 }, { x: 1030, y: 1375 }, { x: 1080, y: 1330 }, { x: 1110, y: 1360 }, { x: 1134, y: 1360 }]);
  level.props.forEach((prop) => drawProp(propGraphics, prop));
  const terrainBlockers = level.terrainBlockers.map((blocker) => (
    scene.add.circle(blocker.x, blocker.y, blocker.radius, 0, 0).setVisible(false)
  ));
  [
    { x: 930, y: 1135, text: 'REDROCK SEARCH CAMP' },
    { x: 1480, y: 1780, text: 'SWIFT LAHAR CUT' },
    { x: 2670, y: 910, text: 'JUNE BOWL' },
    { x: 1670, y: 570, text: 'MONITOR RIDGE' },
  ].forEach(({ x, y, text }) => {
    scene.add.text(x, y, text, { color: '#b7bfa7', fontFamily: 'monospace', fontSize: '13px' })
      .setOrigin(0.5).setAlpha(0.8).setDepth(1.5);
  });

  scene.add.polygon(level.cave.x - 40, level.cave.y + 60, [
    { x: -210, y: 135 },
    { x: -145, y: 45 },
    { x: -92, y: 78 },
    { x: -18, y: -128 },
    { x: 48, y: -28 },
    { x: 118, y: 30 },
    { x: 198, y: 138 },
  ], 0x536168).setStrokeStyle(4, 0x3c484e, 0.8).setDepth(0.3);
  scene.add.polygon(level.cave.x - 90, level.cave.y + 86, [
    { x: -175, y: 92 },
    { x: -78, y: -45 },
    { x: 8, y: 42 },
    { x: 95, y: -18 },
    { x: 176, y: 94 },
  ], 0x68757a).setDepth(0.4);
  scene.add.circle(level.cave.x - 166, level.cave.y + 112, 62, 0x46555a).setDepth(0.45);
  scene.add.circle(level.cave.x + 82, level.cave.y + 116, 70, 0x46555a).setDepth(0.45);
  scene.add.triangle(
    level.cave.x - 58,
    level.cave.y - 49,
    -40,
    31,
    0,
    -42,
    43,
    34,
    0xd4ddd8,
    0.9,
  ).setDepth(0.5);

  const bushes = level.bushes.map((bush) => (
    scene.add.circle(bush.x, bush.y, bush.radius, 0x3e7a45, 0.72)
      .setStrokeStyle(2, 0x75a65f, 0.7)
  ));
  bushes.forEach((bush) => bush.setDepth(1));

  const trees = level.trees.map((tree) => (
    scene.add.circle(tree.x, tree.y, tree.radius, 0x245f35)
      .setStrokeStyle(5, 0x173f27)
      .setDepth(3)
  ));

  const cameraStraps = new Map<CameraId, Phaser.GameObjects.Rectangle>();
  const cameras = new Map<CameraId, Phaser.GameObjects.Rectangle>();
  const cameraLenses = new Map<CameraId, Phaser.GameObjects.Arc>();
  level.cameras.forEach((camera) => {
    const facingAngle = Math.atan2(camera.direction.y, camera.direction.x);
    cameraStraps.set(
      camera.id,
      scene.add.rectangle(camera.position.x, camera.position.y, 34, 5, 0x30383b)
        .setRotation(facingAngle + Math.PI / 2)
        .setDepth(3.8),
    );
    cameras.set(
      camera.id,
      scene.add.rectangle(camera.position.x, camera.position.y, 26, 15, 0x9aa2a5)
        .setStrokeStyle(3, 0x30383b)
        .setRotation(facingAngle + Math.PI / 2)
        .setDepth(4),
    );
    cameraLenses.set(
      camera.id,
      scene.add.circle(
        camera.position.x + camera.direction.x * 9,
        camera.position.y + camera.direction.y * 9,
        3,
        0x8eb7c5,
      ).setStrokeStyle(1, 0x253238).setDepth(5),
    );
  });

  const cave = scene.add.circle(level.cave.x, level.cave.y, level.cave.radius, 0x406f51)
    .setStrokeStyle(6, 0xb9d997)
    .setDepth(2);
  scene.add.text(level.cave.x, level.cave.y + level.cave.radius + 13, 'HIGH DEN', {
    color: '#d4ddd8',
    fontFamily: 'monospace',
    fontSize: '13px',
  }).setOrigin(0.5, 0).setDepth(1.5);
  const cones = scene.add.graphics().setDepth(2);
  const cameraMarks = scene.add.graphics().setDepth(6);
  const cameraProgress = scene.add.graphics().setDepth(5);
  const hikers = level.patrolPaths.map((path) => {
    const start = path.points[0];
    return scene.add.circle(start.x, start.y, 13, 0xe4c95c)
      .setStrokeStyle(3, 0x574a1c)
      .setDepth(5);
  });
  const player = scene.add.rectangle(level.spawn.x, level.spawn.y, 34, 46, 0x6f4329)
    .setStrokeStyle(3, 0x382116)
    .setDepth(6);
  const flash = scene.add.rectangle(0, 0, 960, 540, 0xffffff, 0)
    .setOrigin(0)
    .setScrollFactor(0)
    .setDepth(100);
  const minimapBase = scene.add.graphics().setScrollFactor(0).setDepth(80);
  const minimapDynamic = scene.add.graphics().setScrollFactor(0).setDepth(81);
  minimapBase.fillStyle(0x13291f);
  minimapBase.fillRect(MINIMAP_RECT.x, MINIMAP_RECT.y, MINIMAP_RECT.width, MINIMAP_RECT.height);
  minimapBase.lineStyle(1, 0xd2cfaa, 0.8);
  minimapBase.strokeRect(MINIMAP_RECT.x, MINIMAP_RECT.y, MINIMAP_RECT.width, MINIMAP_RECT.height);
  minimapBase.lineBetween(770, 410, 770, 400);
  minimapBase.strokeTriangle(770, 399, 767, 403, 773, 403);
  level.routes.filter(({ showOnMap }) => showOnMap).forEach((route) => {
    const isCreek = route.kind === 'creek';
    minimapBase.lineStyle(
      isCreek || route.kind === 'road' ? 2 : 1,
      isCreek ? 0x6f9ba5 : 0x89937a,
      isCreek ? 0.52 : 0.55,
    );
    minimapBase.strokePoints(route.points.map((point) => projectWorldPoint(point, level, MINIMAP_RECT)));
  });

  return {
    player,
    trees,
    terrainBlockers,
    hikers,
    cameras,
    cameraStraps,
    cameraLenses,
    cave,
    cones,
    cameraMarks,
    cameraProgress,
    flash,
    minimapBase,
    minimapDynamic,
  };
}

export function renderWorld(view: WorldView, level: LevelData, state: WorldRenderState): void {
  view.cones.clear();
  state.hikers.forEach((hiker, index) => {
    const hikerView = view.hikers[index];
    if (!hikerView) {
      return;
    }

    hikerView.setPosition(hiker.position.x, hiker.position.y);
    const angle = Math.atan2(hiker.direction.y, hiker.direction.x);
    const conePoints: Phaser.Types.Math.Vector2Like[] = [{ x: hiker.position.x, y: hiker.position.y }];
    for (let step = 0; step <= 12; step += 1) {
      const rayAngle = angle - VISION_HALF_ANGLE + (VISION_HALF_ANGLE * 2 * step / 12);
      conePoints.push({
        x: hiker.position.x + Math.cos(rayAngle) * VISION_RANGE,
        y: hiker.position.y + Math.sin(rayAngle) * VISION_RANGE,
      });
    }
    view.cones.fillStyle(0xf2db65, 0.13);
    view.cones.fillPoints(conePoints, true);
    view.cones.lineStyle(1, 0xf2db65, 0.28);
    view.cones.strokePoints(conePoints, true);
  });

  const disabledIds = new Set(state.disabledCameraIds);
  level.cameras.forEach((camera) => {
    if (disabledIds.has(camera.id)) {
      return;
    }

    const facingAngle = Math.atan2(camera.direction.y, camera.direction.x);
    const conePoints: Phaser.Types.Math.Vector2Like[] = [camera.position];
    for (let step = 0; step <= 12; step += 1) {
      const rayAngle = facingAngle - camera.visionHalfAngleRadians
        + (camera.visionHalfAngleRadians * 2 * step / 12);
      conePoints.push({
        x: camera.position.x + Math.cos(rayAngle) * camera.visionRange,
        y: camera.position.y + Math.sin(rayAngle) * camera.visionRange,
      });
    }
    view.cones.fillStyle(0x8eb7c5, 0.09);
    view.cones.fillPoints(conePoints, true);
    view.cones.lineStyle(1, 0x8eb7c5, 0.22);
    view.cones.strokePoints(conePoints, true);
  });

  view.cameraMarks.clear();
  view.cameras.forEach((cameraView, cameraId) => {
    const disabled = disabledIds.has(cameraId);
    cameraView.setFillStyle(disabled ? 0x4f6b59 : 0x9aa2a5);
    cameraView.setAlpha(disabled ? 0.55 : 1);
    view.cameraStraps.get(cameraId)?.setAlpha(disabled ? 0.55 : 1);
    view.cameraLenses.get(cameraId)
      ?.setFillStyle(disabled ? 0x31483a : 0x8eb7c5)
      .setAlpha(disabled ? 0.55 : 1);

    if (disabled) {
      const camera = level.cameras.find(({ id }) => id === cameraId);
      if (camera) {
        view.cameraMarks.lineStyle(3, 0xc7d8ca, 0.9);
        view.cameraMarks.lineBetween(
          camera.position.x - 7,
          camera.position.y - 7,
          camera.position.x + 7,
          camera.position.y + 7,
        );
        view.cameraMarks.lineBetween(
          camera.position.x + 7,
          camera.position.y - 7,
          camera.position.x - 7,
          camera.position.y + 7,
        );
      }
    }
  });

  view.cameraProgress.clear();
  if (state.interaction) {
    const camera = level.cameras.find(({ id }) => id === state.interaction?.cameraId);
    if (camera) {
      view.cameraProgress.lineStyle(5, 0xe8e1bd, 0.95);
      view.cameraProgress.beginPath();
      view.cameraProgress.arc(
        camera.position.x,
        camera.position.y,
        23,
        -Math.PI / 2,
        -Math.PI / 2 + Phaser.Math.Clamp(state.interaction.progress, 0, 1) * Math.PI * 2,
      );
      view.cameraProgress.strokePath();
    }
  }

  const flashColor = state.photoFlash === 'clear' ? 0xffffff : 0x9fb3c8;
  view.flash.setFillStyle(flashColor, Phaser.Math.Clamp(state.photoFlashAlpha, 0, 1));

  const minimap = createMinimapModel({
    player: state.minimap.playerPosition,
    discoveredCameraIds: state.minimap.discoveredCameraIds,
    disabledCameraIds: state.disabledCameraIds,
    landmarks: level.landmarks,
    cameras: level.cameras,
    routes: level.routes,
  });
  const graphics = view.minimapDynamic;
  graphics.clear();
  // Draw the player last so it remains legible when standing at a landmark or camera.
  [...minimap.markers].sort((a, b) => Number(a.kind === 'player') - Number(b.kind === 'player'))
    .forEach((marker) => {
      const { x, y } = projectWorldPoint(marker.position, level, MINIMAP_RECT);
      if (marker.kind === 'player') {
        graphics.fillStyle(0x996547);
        graphics.lineStyle(1, 0xf1e1bd);
        const diamond = [{ x, y: y - 3 }, { x: x + 3, y }, { x, y: y + 3 }, { x: x - 3, y }];
        graphics.fillPoints(diamond, true);
        graphics.strokePoints(diamond, true);
      } else if (marker.kind === 'camera') {
        graphics.fillStyle(marker.disabled ? 0x678371 : 0x8eb7c5);
        graphics.fillRect(x - 2.5, y - 2.5, 5, 5);
        graphics.lineStyle(1, marker.disabled ? 0xc0cdb7 : 0x8eb7c5);
        if (marker.disabled) {
          graphics.lineBetween(x - 2, y - 2, x + 2, y + 2);
          graphics.lineBetween(x + 2, y - 2, x - 2, y + 2);
        } else {
          const direction = level.cameras.find(({ id }) => id === marker.id)?.direction;
          if (direction) graphics.lineBetween(x, y, x + direction.x * 7, y + direction.y * 7);
        }
      } else {
        graphics.lineStyle(1, marker.landmarkKind === 'high-den' ? 0xb9d997 : 0x9caa8e);
        switch (marker.landmarkKind) {
          case 'high-den':
            graphics.strokePoints([{ x: x - 4, y: y + 2 }, { x, y: y - 3 }, { x: x + 4, y: y + 2 }]);
            break;
          case 'hunter-camp': graphics.strokeTriangle(x - 3, y + 3, x, y - 3, x + 3, y + 3); break;
          case 'logging-spur': graphics.lineBetween(x - 3, y - 2, x + 3, y + 2); break;
          case 'creek-crossing':
            graphics.lineBetween(x - 3, y - 2, x + 3, y - 2);
            graphics.lineBetween(x - 3, y + 2, x + 3, y + 2);
            break;
          case 'june-bowl': graphics.strokeCircle(x, y, 3); break;
        }
      }
    });
}
