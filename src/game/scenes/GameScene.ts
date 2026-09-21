/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import Phaser from 'phaser';
import { playUiTone } from '../audio';
import { GAME_SCENE_KEY } from '../config';
import { FOREST_LEVEL } from '../content/level';
import { getSightOccluders } from '../content/levelValidation';
import {
  gameEvents,
  selectUpdateMessage,
  type CoverState,
  type GameMessage,
  type HudState,
} from '../events';
import { bindGameInput, isInteractionHeld, readMovement, type GameInput } from '../input';
import {
  createRunState,
  disableCamera,
  reachCave,
  recordPhoto,
  type CameraId,
  type RunState,
} from '../rules/gameState';
import { evaluateCameraPhotograph } from '../rules/cameraObservation';
import { createExplorationState, discoverNearbyCameras } from '../rules/exploration';
import { calculatePhotoQuality } from '../rules/photoQuality';
import { isPointInVisionCone, sampleVisibility } from '../rules/vision';
import type { PatrolPath, Point } from '../types';
import {
  drawWorld,
  renderWorld,
  type HikerRenderState,
  type WorldView,
} from '../view/drawWorld';

const PLAYER_SPEED = 190;
const PLAYER_SIGHT_RADIUS = 20;
const HIKER_SPEED = 76;
const VISION_RANGE = 340;
const VISION_HALF_ANGLE = Phaser.Math.DegToRad(35);
const PHOTO_COOLDOWN_MS = 2_000;
const CAMERA_DISABLE_MS = 2_000;
const PHOTO_FLASH_MS = 150;

interface HikerRuntime extends HikerRenderState {
  readonly path: PatrolPath;
  targetIndex: number;
  cooldownMs: number;
  position: Point;
  direction: Point;
}

interface InteractionRuntime {
  cameraId: CameraId;
  startedAtMs: number;
}

function moveHiker(hiker: HikerRuntime, deltaSeconds: number): void {
  let remainingTravel = HIKER_SPEED * deltaSeconds;
  let safety = hiker.path.points.length + 1;

  while (remainingTravel > 0 && safety > 0) {
    safety -= 1;
    const target = hiker.path.points[hiker.targetIndex];
    const offset = { x: target.x - hiker.position.x, y: target.y - hiker.position.y };
    const distance = Math.hypot(offset.x, offset.y);
    if (distance < 0.001) {
      hiker.targetIndex = (hiker.targetIndex + 1) % hiker.path.points.length;
      continue;
    }

    hiker.direction = { x: offset.x / distance, y: offset.y / distance };
    const step = Math.min(distance, remainingTravel);
    hiker.position = {
      x: hiker.position.x + hiker.direction.x * step,
      y: hiker.position.y + hiker.direction.y * step,
    };
    remainingTravel -= step;
    if (step >= distance) {
      hiker.targetIndex = (hiker.targetIndex + 1) % hiker.path.points.length;
    }
  }
}

export class GameScene extends Phaser.Scene {
  private inputState!: GameInput;
  private view!: WorldView;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private runState: RunState = createRunState();
  private explorationState = createExplorationState();
  private readonly sightOccluders = getSightOccluders(FOREST_LEVEL);
  private hikers: HikerRuntime[] = [];
  private cameraCooldownMs = new Map<CameraId, number>();
  private interaction: InteractionRuntime | null = null;
  private photoFlash: 'clear' | 'blurry' | null = null;
  private photoFlashRemainingMs = 0;
  private caveWasOverlapping = false;
  private resultEmitted = false;
  private lastHudSignature = '';
  private currentTimeMs = 0;

  constructor() {
    super(GAME_SCENE_KEY);
  }

  create(): void {
    this.runState = createRunState();
    this.explorationState = createExplorationState();
    this.interaction = null;
    this.photoFlash = null;
    this.photoFlashRemainingMs = 0;
    this.caveWasOverlapping = false;
    this.resultEmitted = false;
    this.lastHudSignature = '';
    this.currentTimeMs = 0;
    this.cameraCooldownMs = new Map(
      FOREST_LEVEL.cameras.map((camera) => [camera.id, 0]),
    );
    this.inputState = bindGameInput(this);
    this.view = drawWorld(this, FOREST_LEVEL);

    this.physics.world.setBounds(0, 0, FOREST_LEVEL.width, FOREST_LEVEL.height);
    this.physics.add.existing(this.view.player);
    this.playerBody = this.view.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);
    this.playerBody.setSize(30, 42, true);

    [...this.view.trees, ...this.view.terrainBlockers].forEach((obstacle) => {
      this.physics.add.existing(obstacle, true);
      const body = obstacle.body as Phaser.Physics.Arcade.StaticBody;
      body.setCircle(obstacle.radius);
      body.updateFromGameObject();
      this.physics.add.collider(this.view.player, obstacle);
    });

    this.hikers = FOREST_LEVEL.patrolPaths.map((path) => {
      const start = path.points[0];
      const next = path.points[1];
      const distance = Math.hypot(next.x - start.x, next.y - start.y);
      return {
        path,
        targetIndex: 1,
        cooldownMs: 0,
        position: { ...start },
        direction: { x: (next.x - start.x) / distance, y: (next.y - start.y) / distance },
      };
    });

    this.cameras.main.setBounds(0, 0, FOREST_LEVEL.width, FOREST_LEVEL.height);
    this.cameras.main.startFollow(this.view.player, true, 0.12, 0.12);
    this.emitHud(this.deriveCoverState());
    this.render();
    gameEvents.emit('run:ready', undefined);
  }

  update(time: number, delta: number): void {
    this.currentTimeMs = time;
    const safeDelta = Math.min(delta, 100);
    this.photoFlashRemainingMs = Math.max(0, this.photoFlashRemainingMs - safeDelta);
    if (this.photoFlashRemainingMs === 0) {
      this.photoFlash = null;
    }

    if (this.runState.status !== 'playing') {
      this.playerBody.setVelocity(0, 0);
      this.render();
      return;
    }

    const movement = readMovement(this.inputState);
    this.playerBody.setVelocity(movement.x * PLAYER_SPEED, movement.y * PLAYER_SPEED);
    this.explorationState = discoverNearbyCameras(
      this.explorationState,
      { x: this.view.player.x, y: this.view.player.y },
      FOREST_LEVEL.cameras,
      260,
    );
    this.hikers.forEach((hiker) => {
      moveHiker(hiker, safeDelta / 1_000);
      hiker.cooldownMs = Math.max(0, hiker.cooldownMs - safeDelta);
    });
    this.cameraCooldownMs.forEach((cooldownMs, cameraId) => {
      this.cameraCooldownMs.set(cameraId, Math.max(0, cooldownMs - safeDelta));
    });

    const updateMessages: GameMessage[] = [];
    const photoMessage = this.processHikerPhotos();
    if (photoMessage) {
      updateMessages.push(photoMessage);
    }
    if (this.runState.status === 'playing') {
      const cameraPhotoMessage = this.processCameraPhotos();
      if (cameraPhotoMessage) {
        updateMessages.push(cameraPhotoMessage);
      }
    }
    const photoFeedback = selectUpdateMessage(updateMessages);
    if (photoFeedback?.kind === 'clear-photo' || photoFeedback?.kind === 'blurry-photo') {
      this.photoFlash = photoFeedback.kind === 'clear-photo' ? 'clear' : 'blurry';
      this.photoFlashRemainingMs = PHOTO_FLASH_MS;
    }
    if (this.runState.status === 'playing') {
      const cameraMessage = this.processCameraInteraction(time);
      if (cameraMessage) {
        updateMessages.push(cameraMessage);
      }
      const caveMessage = this.processCave();
      if (caveMessage) {
        updateMessages.push(caveMessage);
      }
    }

    const updateMessage = selectUpdateMessage(updateMessages);
    if (updateMessage) {
      gameEvents.emit('message:show', updateMessage);
      if (updateMessage.kind !== 'info') {
        playUiTone(updateMessage.kind);
      }
    }

    const cover = this.deriveCoverState();
    this.emitHud(cover);
    this.emitResultIfNeeded();
    this.render();
  }

  private processHikerPhotos(): GameMessage | null {
    const player = { x: this.view.player.x, y: this.view.player.y, radius: PLAYER_SIGHT_RADIUS };
    const messages: GameMessage[] = [];
    const bushCoverMultiplier = this.getBushCoverMultiplier(player);

    for (const hiker of this.hikers) {
      if (hiker.cooldownMs > 0) {
        continue;
      }

      const cone = {
        origin: hiker.position,
        direction: hiker.direction,
        range: VISION_RANGE,
        halfAngleRadians: VISION_HALF_ANGLE,
      };
      if (!isPointInVisionCone(player, cone)) {
        continue;
      }

      const visibility = sampleVisibility(hiker.position, player, this.sightOccluders);
      if (visibility === 0) {
        continue;
      }

      hiker.cooldownMs = PHOTO_COOLDOWN_MS;
      const quality = calculatePhotoQuality({
        distance: Phaser.Math.Distance.Between(hiker.position.x, hiker.position.y, player.x, player.y),
        unobstructedRayFraction: visibility,
        bushCoverMultiplier,
      });
      const message = this.recordObservedPhoto(quality);
      if (message) {
        messages.push(message);
      }

      if (this.runState.status === 'lost') {
        break;
      }
    }

    return selectUpdateMessage(messages);
  }

  private processCameraPhotos(): GameMessage | null {
    const player = { x: this.view.player.x, y: this.view.player.y, radius: PLAYER_SIGHT_RADIUS };
    const bushCoverMultiplier = this.getBushCoverMultiplier(player);
    const messages: GameMessage[] = [];

    for (const camera of FOREST_LEVEL.cameras) {
      const disabled = this.runState.disabledCameraIds.includes(camera.id);
      if (disabled || (this.cameraCooldownMs.get(camera.id) ?? 0) > 0) {
        continue;
      }

      const quality = evaluateCameraPhotograph({
        camera,
        target: player,
        occluders: this.sightOccluders,
        bushCoverMultiplier,
        disabled,
      });
      if (quality === null) {
        continue;
      }

      this.cameraCooldownMs.set(camera.id, camera.photoCooldownMs);
      const message = this.recordObservedPhoto(quality);
      if (message) {
        messages.push(message);
      }
      if (this.runState.status === 'lost') {
        break;
      }
    }

    return selectUpdateMessage(messages);
  }

  private recordObservedPhoto(quality: number): GameMessage | null {
    const nextState = recordPhoto(this.runState, quality);
    if (nextState === this.runState) {
      return null;
    }

    this.runState = nextState;
    return {
      text: nextState.message,
      kind: nextState.lastPhoto === 'clear' ? 'clear-photo' : 'blurry-photo',
      durationMs: 1_600,
    };
  }

  private getBushCoverMultiplier(player: { readonly x: number; readonly y: number; readonly radius: number }): number {
    return FOREST_LEVEL.bushes.reduce((multiplier, bush) => {
      const overlaps = Phaser.Math.Distance.Between(player.x, player.y, bush.x, bush.y)
        <= player.radius + bush.radius;
      return overlaps ? Math.min(multiplier, bush.coverMultiplier) : multiplier;
    }, 1);
  }

  private processCameraInteraction(time: number): GameMessage | null {
    const nearbyCamera = FOREST_LEVEL.cameras.find((camera) => (
      !this.runState.disabledCameraIds.includes(camera.id)
      && Phaser.Math.Distance.Between(
        this.view.player.x,
        this.view.player.y,
        camera.position.x,
        camera.position.y,
      ) <= camera.interactionRadius
    ));

    if (!nearbyCamera || !isInteractionHeld(this.inputState)) {
      this.interaction = null;
      return null;
    }

    if (!this.interaction || this.interaction.cameraId !== nearbyCamera.id) {
      this.interaction = { cameraId: nearbyCamera.id, startedAtMs: time };
      return null;
    }

    if (time - this.interaction.startedAtMs < CAMERA_DISABLE_MS) {
      return null;
    }

    const nextState = disableCamera(this.runState, nearbyCamera.id);
    this.interaction = null;
    if (nextState === this.runState) {
      return null;
    }

    this.runState = nextState;
    return {
      text: nextState.message,
      kind: 'camera',
      durationMs: 1_600,
    };
  }

  private processCave(): GameMessage | null {
    const overlaps = Phaser.Math.Distance.Between(
      this.view.player.x,
      this.view.player.y,
      FOREST_LEVEL.cave.x,
      FOREST_LEVEL.cave.y,
    ) <= FOREST_LEVEL.cave.radius;

    if (overlaps && !this.caveWasOverlapping) {
      const nextState = reachCave(this.runState);
      if (nextState !== this.runState) {
        this.runState = nextState;
        if (nextState.status === 'playing') {
          this.caveWasOverlapping = overlaps;
          return {
            text: nextState.message,
            kind: 'info',
            durationMs: 1_600,
          };
        }
      }
    }
    this.caveWasOverlapping = overlaps;
    return null;
  }

  private deriveCoverState(): CoverState {
    const player = { x: this.view.player.x, y: this.view.player.y, radius: PLAYER_SIGHT_RADIUS };
    if (this.getBushCoverMultiplier(player) < 1) {
      return 'partly-covered';
    }

    const visibleToHiker = this.hikers.some((hiker) => (
      isPointInVisionCone(player, {
        origin: hiker.position,
        direction: hiker.direction,
        range: VISION_RANGE,
        halfAngleRadians: VISION_HALF_ANGLE,
      }) && sampleVisibility(hiker.position, player, this.sightOccluders) > 0
    ));
    const visibleToCamera = FOREST_LEVEL.cameras.some((camera) => (
      evaluateCameraPhotograph({
        camera,
        target: player,
        occluders: this.sightOccluders,
        bushCoverMultiplier: 1,
        disabled: this.runState.disabledCameraIds.includes(camera.id),
      }) !== null
    ));
    return visibleToHiker || visibleToCamera ? 'exposed' : 'hidden';
  }

  private emitHud(cover: CoverState): void {
    const interaction = this.interaction
      ? {
          cameraId: this.interaction.cameraId,
          progress: Phaser.Math.Clamp(
            (this.currentTimeMs - this.interaction.startedAtMs) / CAMERA_DISABLE_MS,
            0,
            1,
          ),
        }
      : null;
    const hud: HudState = {
      disabledCameraCount: this.runState.disabledCameraIds.length,
      totalCameraCount: FOREST_LEVEL.cameras.length,
      clearPhotoCount: this.runState.clearPhotoCount,
      clearPhotoLimit: 3,
      cover,
      interaction,
    };
    const signature = JSON.stringify(hud);
    if (signature !== this.lastHudSignature) {
      this.lastHudSignature = signature;
      gameEvents.emit('hud:update', hud);
    }
  }

  private emitResultIfNeeded(): void {
    if (this.runState.status === 'playing' || this.resultEmitted) {
      return;
    }

    this.resultEmitted = true;
    this.playerBody.setVelocity(0, 0);
    gameEvents.emit('run:result', {
      status: this.runState.status,
      message: this.runState.message,
      disabledCameraCount: this.runState.disabledCameraIds.length,
      allCamerasDisabled: this.runState.endingBonus === 'no-evidence-left',
    });
    playUiTone(this.runState.status === 'won' ? 'win' : 'lose');
  }

  private render(): void {
    renderWorld(this.view, FOREST_LEVEL, {
      hikers: this.hikers,
      disabledCameraIds: this.runState.disabledCameraIds,
      minimap: {
        playerPosition: { x: this.view.player.x, y: this.view.player.y },
        discoveredCameraIds: this.explorationState.discoveredCameraIds,
      },
      interaction: this.interaction
        ? {
            cameraId: this.interaction.cameraId,
            progress: (this.currentTimeMs - this.interaction.startedAtMs) / CAMERA_DISABLE_MS,
          }
        : null,
      photoFlash: this.photoFlash,
      photoFlashAlpha: this.photoFlashRemainingMs / PHOTO_FLASH_MS * 0.72,
    });
  }
}
