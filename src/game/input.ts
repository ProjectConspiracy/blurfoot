/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import Phaser from 'phaser';
import type { Point } from './types';

export interface GameInput {
  readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  readonly moveUp: Phaser.Input.Keyboard.Key;
  readonly moveDown: Phaser.Input.Keyboard.Key;
  readonly moveLeft: Phaser.Input.Keyboard.Key;
  readonly moveRight: Phaser.Input.Keyboard.Key;
  readonly interact: Phaser.Input.Keyboard.Key;
}

export function bindGameInput(scene: Phaser.Scene): GameInput {
  const keyboard = scene.input.keyboard;
  if (!keyboard) {
    throw new Error('Keyboard input is unavailable.');
  }

  return {
    cursors: keyboard.createCursorKeys(),
    moveUp: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
    moveDown: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
    moveLeft: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
    moveRight: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    interact: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
  };
}

/** Reads WASD and arrow keys as one normalized movement action. */
export function readMovement(input: GameInput): Point {
  const horizontal = Number(input.moveRight.isDown || input.cursors.right.isDown)
    - Number(input.moveLeft.isDown || input.cursors.left.isDown);
  const vertical = Number(input.moveDown.isDown || input.cursors.down.isDown)
    - Number(input.moveUp.isDown || input.cursors.up.isDown);
  const magnitude = Math.hypot(horizontal, vertical);

  return magnitude === 0
    ? { x: 0, y: 0 }
    : { x: horizontal / magnitude, y: vertical / magnitude };
}

export function isInteractionHeld(input: GameInput): boolean {
  return input.interact.isDown;
}
