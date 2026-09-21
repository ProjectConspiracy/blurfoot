/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import {
  CAMERA_IDS,
  createRunState,
  disableCamera,
  reachCave,
  recordPhoto,
} from './gameState';
import type { RunState } from './gameState';

describe('run state transitions', () => {
  it('defines the five cameras that can be disabled during a run', () => {
    expect(CAMERA_IDS).toEqual(['camp', 'bridge', 'deadfall', 'bowl', 'ridge']);
  });

  it.each([
    ['records a blurry photo without changing clear-photo count', 0.47, {
      disabledCameraIds: [], clearPhotoCount: 0, status: 'playing', lastPhoto: 'blurry', endingBonus: null, message: 'Blurry photo — keep moving.'
    }],
    ['records a clear photo below the loss threshold', 0.48, {
      disabledCameraIds: [], clearPhotoCount: 1, status: 'playing', lastPhoto: 'clear', endingBonus: null, message: 'Clear photo! 2 more and you lose.'
    }],
  ] as const)('%s', (_name, quality, expected) => {
    expect(recordPhoto(createRunState(), quality)).toEqual(expected);
  });

  it.each([
    ['loses on the third clear photo', () => recordPhoto(recordPhoto(createRunState(), 0.48), 1), (state: RunState) => recordPhoto(state, 0.48), {
      disabledCameraIds: [], clearPhotoCount: 3, status: 'lost', lastPhoto: 'clear', endingBonus: null, message: 'Three clear photos. The humans found you.'
    }],
    ['counts each camera once', () => disableCamera(createRunState(), 'camp'), (state: RunState) => disableCamera(state, 'camp'), {
      disabledCameraIds: ['camp'], clearPhotoCount: 0, status: 'playing', lastPhoto: null, endingBonus: null, message: 'Camera disabled. 4 remaining.'
    }],
    ['rejects unknown camera IDs', () => createRunState(), (state: RunState) => disableCamera(state, 'fake-1'), {
      disabledCameraIds: [], clearPhotoCount: 0, status: 'playing', lastPhoto: null, endingBonus: null, message: ''
    }],
  ] as const)('%s', (_name, createState, transition, expected) => {
    expect(transition(createState())).toEqual(expected);
  });

  it.each([
    ['zero', createRunState(), null],
    ['one', disableCamera(createRunState(), 'camp'), null],
    [
      'all five',
      CAMERA_IDS.reduce((state, id) => disableCamera(state, id), createRunState()),
      'no-evidence-left',
    ],
  ] as const)('wins at High Den after disabling %s cameras', (_label, state, endingBonus) => {
    expect(reachCave(state)).toMatchObject({ status: 'won', endingBonus });
  });

  it('names High Den for an ordinary win', () => {
    expect(reachCave(createRunState()).message).toBe('You made it home to High Den.');
  });

  it('distinguishes the clean route when every camera is disabled', () => {
    const state = CAMERA_IDS.reduce((current, id) => disableCamera(current, id), createRunState());

    expect(reachCave(state).message).toBe('You reached High Den and left every trail camera dark.');
  });

  it.each([
    ['disable camera', createRunState(), (state: RunState) => disableCamera(state, 'camp')],
    ['record photo', createRunState(), (state: RunState) => recordPhoto(state, 0.48)],
    ['reach cave early', createRunState(), reachCave],
  ] as const)('does not mutate its input when it %s', (_name, state, transition) => {
    const before = {
      disabledCameraIds: [...state.disabledCameraIds],
      clearPhotoCount: state.clearPhotoCount,
      status: state.status,
      lastPhoto: state.lastPhoto,
      endingBonus: state.endingBonus,
      message: state.message,
    };

    transition(state);
    expect(state).toEqual(before);
    expect(state.disabledCameraIds).not.toBe(before.disabledCameraIds);
  });

  it.each([
    ['disable camera', (state: RunState) => disableCamera(state, 'camp')],
    ['record photo', (state: RunState) => recordPhoto(state, 0)],
    ['reach cave', reachCave],
  ] as const)('does not change a lost terminal state when asked to %s', (_name, transition) => {
    const lost = recordPhoto(recordPhoto(recordPhoto(createRunState(), 1), 1), 1);

    expect(transition(lost)).toBe(lost);
  });
});
