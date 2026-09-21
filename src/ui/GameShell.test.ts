/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import type { HudState } from '../game/events';
import { CAMERA_IDS } from '../game/rules/gameState';
import {
  createInitialShellState,
  getHudPresentation,
  getResultPresentation,
  getTransitionFocusTarget,
  reduceShellState,
  writeTextIfChanged,
} from './GameShell';

const activeHud: HudState = {
  disabledCameraCount: 2,
  totalCameraCount: 3,
  clearPhotoCount: 1,
  clearPhotoLimit: 3,
  cover: 'partly-covered',
  interaction: {
    cameraId: 'bridge',
    progress: 1.4,
  },
};

describe('GameShell state', () => {
  it('derives the initial camera total from the canonical mission cameras', () => {
    expect(createInitialShellState().hud.totalCameraCount).toBe(CAMERA_IDS.length);
    expect(createInitialShellState().hud.totalCameraCount).toBe(5);
  });

  it('begins at the title and enters the controls before a run', () => {
    const initial = createInitialShellState();

    expect(initial.screen).toBe('title');
    expect(reduceShellState(initial, { type: 'show-controls' }).screen).toBe('controls');
  });

  it('resets stale run feedback when gameplay begins again', () => {
    const finished = reduceShellState(
      reduceShellState(createInitialShellState(), { type: 'hud-update', hud: activeHud }),
      {
        type: 'run-result',
        result: {
          status: 'lost',
          message: 'Too many clear photos.',
          disabledCameraCount: 0,
          allCamerasDisabled: false,
        },
      },
    );

    const restarted = reduceShellState(finished, { type: 'begin-run' });

    expect(restarted.screen).toBe('playing');
    expect(restarted.hud.disabledCameraCount).toBe(0);
    expect(restarted.hud.clearPhotoCount).toBe(0);
    expect(restarted.hud.interaction).toBeNull();
    expect(restarted.message).toBeNull();
    expect(restarted.result).toBeNull();
  });

  it('maps game results to their matching terminal screen', () => {
    const playing = reduceShellState(createInitialShellState(), { type: 'begin-run' });
    const won = reduceShellState(playing, {
      type: 'run-result',
      result: {
        status: 'won',
        message: 'The cave is clear.',
        disabledCameraCount: 3,
        allCamerasDisabled: true,
      },
    });

    expect(won.screen).toBe('won');
    expect(won.result?.message).toBe('The cave is clear.');
  });
});

describe('HUD presentation', () => {
  it('uses readable cover text and clamps interaction progress', () => {
    expect(getHudPresentation(activeHud)).toEqual({
      cameras: '2 / 3',
      photos: '1 / 3',
      cover: 'Partly covered',
      interactionPercent: 100,
    });
  });
});

describe('result presentation', () => {
  it('presents an ordinary win as a return home', () => {
    expect(getResultPresentation({
      status: 'won',
      message: 'You made it home to High Den.',
      disabledCameraCount: 1,
      allCamerasDisabled: false,
    })).toMatchObject({ eyebrow: 'Home', heading: 'Back at High Den' });
  });

  it('presents an all-camera win as the clean route bonus', () => {
    expect(getResultPresentation({
      status: 'won',
      message: 'Every trail camera is dark.',
      disabledCameraCount: 3,
      allCamerasDisabled: true,
    })).toMatchObject({ eyebrow: 'Clean route bonus', heading: 'No Evidence Left' });
  });

  it('presents a loss as confirmed evidence', () => {
    expect(getResultPresentation({
      status: 'lost',
      message: 'The hikers got the proof they needed.',
      disabledCameraCount: 2,
      allCamerasDisabled: false,
    })).toMatchObject({
      eyebrow: 'Evidence confirmed',
      heading: 'Too many clear photos',
    });
  });
});

describe('DOM update contracts', () => {
  it('moves focus only for screen transitions, never ordinary HUD updates', () => {
    expect(getTransitionFocusTarget('title', 'controls')).toBe('continue');
    expect(getTransitionFocusTarget('controls', 'playing')).toBe('gameplay');
    expect(getTransitionFocusTarget('playing', 'won')).toBe('restart-win');
    expect(getTransitionFocusTarget('playing', 'lost')).toBe('restart-loss');
    expect(getTransitionFocusTarget('playing', 'playing')).toBeNull();
  });

  it('does not replace live-region text when the value is unchanged', () => {
    let writes = 0;
    let currentText: string | null = '0 / 3';
    const target = {
      get textContent(): string | null {
        return currentText;
      },
      set textContent(value: string | null) {
        writes += 1;
        currentText = value;
      },
    };

    expect(writeTextIfChanged(target, '0 / 3')).toBe(false);
    expect(writes).toBe(0);
    expect(writeTextIfChanged(target, '1 / 3')).toBe(true);
    expect(writes).toBe(1);
    expect(currentText).toBe('1 / 3');
  });
});
