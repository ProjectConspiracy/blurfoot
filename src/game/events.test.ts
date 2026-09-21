/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { describe, expect, it } from 'vitest';
import { selectUpdateMessage, type GameMessage } from './events';

const clearPhoto: GameMessage = {
  text: 'Clear photo! 2 more and you lose.',
  kind: 'clear-photo',
  durationMs: 1_600,
};

const camera: GameMessage = {
  text: 'Camera disabled. 2 remaining.',
  kind: 'camera',
  durationMs: 1_600,
};

describe('selectUpdateMessage', () => {
  it('keeps a clear-photo warning when camera feedback occurs later in the update', () => {
    expect(selectUpdateMessage([clearPhoto, camera])).toEqual(clearPhoto);
  });

  it('keeps a clear-photo warning ahead of both camera exposure and disable feedback', () => {
    expect(selectUpdateMessage([
      { text: 'Camera exposure.', kind: 'blurry-photo', durationMs: 1_600 },
      { text: 'Clear photo!', kind: 'clear-photo', durationMs: 1_600 },
      camera,
    ])).toMatchObject({ kind: 'clear-photo' });
  });

  it('keeps later objective feedback ahead of an earlier blurry-photo message', () => {
    const blurryPhoto: GameMessage = {
      text: 'Blurry photo — keep moving.',
      kind: 'blurry-photo',
      durationMs: 1_600,
    };

    expect(selectUpdateMessage([blurryPhoto, camera])).toEqual(camera);
  });
});
