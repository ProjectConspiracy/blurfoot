/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import type { CameraId } from './rules/gameState';

export type CoverState = 'exposed' | 'partly-covered' | 'hidden';

export interface HudState {
  readonly disabledCameraCount: number;
  readonly totalCameraCount: number;
  readonly clearPhotoCount: number;
  readonly clearPhotoLimit: number;
  readonly cover: CoverState;
  readonly interaction: {
    readonly cameraId: CameraId;
    readonly progress: number;
  } | null;
}

export interface GameMessage {
  readonly text: string;
  readonly kind: 'info' | 'camera' | 'clear-photo' | 'blurry-photo';
  readonly durationMs: number;
}

/** Selects the single message shown for one scene update; clear photos are always urgent. */
export function selectUpdateMessage(messages: readonly GameMessage[]): GameMessage | null {
  return messages.reduce<GameMessage | null>((selected, candidate) => {
    if (!selected || candidate.kind === 'clear-photo' || selected.kind !== 'clear-photo') {
      return candidate;
    }
    return selected;
  }, null);
}

export interface GameResult {
  readonly status: 'won' | 'lost';
  readonly message: string;
  readonly disabledCameraCount: number;
  readonly allCamerasDisabled: boolean;
}

export interface GameEventMap {
  readonly 'run:ready': undefined;
  readonly 'hud:update': HudState;
  readonly 'message:show': GameMessage;
  readonly 'run:result': GameResult;
}

type Listener<T> = (payload: T) => void;

/** Small typed boundary between the Phaser playfield and the DOM shell. */
class GameEventBus {
  private readonly listeners = new Map<keyof GameEventMap, Set<Listener<unknown>>>();

  on<K extends keyof GameEventMap>(event: K, listener: Listener<GameEventMap[K]>): () => void {
    const listeners = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    listeners.add(listener as Listener<unknown>);
    this.listeners.set(event, listeners);

    return () => {
      listeners.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      return;
    }

    [...listeners].forEach((listener) => listener(payload));
  }
}

export const gameEvents = new GameEventBus();
