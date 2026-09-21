/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
/** A single run's serializable, immutable mission state. */
export type EndingBonus = 'no-evidence-left' | null;

export interface RunState {
  readonly disabledCameraIds: readonly string[];
  readonly clearPhotoCount: number;
  readonly status: 'playing' | 'won' | 'lost';
  readonly lastPhoto: 'clear' | 'blurry' | null;
  readonly endingBonus: EndingBonus;
  readonly message: string;
}

const CLEAR_PHOTO_LOSS_COUNT = 3;
const CLEAR_PHOTO_QUALITY = 0.48;
export const CAMERA_IDS = ['camp', 'bridge', 'deadfall', 'bowl', 'ridge'] as const;
const CAMERA_COUNT = CAMERA_IDS.length;

export type CameraId = (typeof CAMERA_IDS)[number];

function isCameraId(id: string): id is CameraId {
  return CAMERA_IDS.some((cameraId) => cameraId === id);
}

export function createRunState(): RunState {
  return {
    disabledCameraIds: [],
    clearPhotoCount: 0,
    status: 'playing',
    lastPhoto: null,
    endingBonus: null,
    message: '',
  };
}

/** Disables a camera once; duplicate interactions deliberately have no effect. */
export function disableCamera(state: RunState, id: string): RunState {
  if (
    state.status !== 'playing'
    || !isCameraId(id)
    || state.disabledCameraIds.includes(id)
  ) {
    return state;
  }

  const disabledCameraIds = [...state.disabledCameraIds, id];
  const remaining = Math.max(0, CAMERA_COUNT - disabledCameraIds.length);

  return {
    ...state,
    disabledCameraIds,
    message: `Camera disabled. ${remaining} remaining.`,
  };
}

/** Records a photograph from any observer. Qualities below the clear threshold are harmless. */
export function recordPhoto(state: RunState, quality: number): RunState {
  if (state.status !== 'playing') {
    return state;
  }

  if (quality < CLEAR_PHOTO_QUALITY) {
    return {
      ...state,
      lastPhoto: 'blurry',
      message: 'Blurry photo — keep moving.',
    };
  }

  const clearPhotoCount = state.clearPhotoCount + 1;
  if (clearPhotoCount >= CLEAR_PHOTO_LOSS_COUNT) {
    return {
      ...state,
      clearPhotoCount,
      status: 'lost',
      lastPhoto: 'clear',
      message: 'Three clear photos. The humans found you.',
    };
  }

  return {
    ...state,
    clearPhotoCount,
    lastPhoto: 'clear',
    message: `Clear photo! ${CLEAR_PHOTO_LOSS_COUNT - clearPhotoCount} more and you lose.`,
  };
}

/** Ends the run at High Den, with a bonus for disabling every camera. */
export function reachCave(state: RunState): RunState {
  if (state.status !== 'playing') {
    return state;
  }

  const allCamerasDisabled = state.disabledCameraIds.length === CAMERA_COUNT;

  return {
    ...state,
    status: 'won',
    endingBonus: allCamerasDisabled ? 'no-evidence-left' : null,
    message: allCamerasDisabled
      ? 'You reached High Den and left every trail camera dark.'
      : 'You made it home to High Den.',
  };
}
