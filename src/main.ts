/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import Phaser from 'phaser';
import { createGameConfig, GAME_SCENE_KEY } from './game/config';
import { GameScene } from './game/scenes/GameScene';
import { GameShell } from './ui/GameShell';
import './style.css';

export { gameEvents } from './game/events';
export { isMuted, setMuted, unlockAudio } from './game/audio';

export interface GameController {
  readonly game: Phaser.Game;
  start(): void;
  restart(): void;
  destroy(): void;
}

/** Mounts an idle Phaser canvas. The DOM shell explicitly starts each run. */
export function mountGame(parent: string | HTMLElement): GameController {
  const game = new Phaser.Game(createGameConfig(parent));
  game.scene.add(GAME_SCENE_KEY, GameScene, false);

  const start = (): void => {
    game.scene.start(GAME_SCENE_KEY);
  };

  return {
    game,
    start,
    restart: start,
    destroy: () => game.destroy(true),
  };
}

const app = document.querySelector<HTMLElement>('#app');
if (!app) {
  throw new Error('App mount element not found.');
}

const shell = new GameShell(app);
shell.connect(mountGame(shell.gameParent));
