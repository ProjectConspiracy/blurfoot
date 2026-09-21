/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
export type UiTone = 'camera' | 'clear-photo' | 'blurry-photo' | 'win' | 'lose';

let muted = false;
let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;

const toneFrequencies: Readonly<Record<UiTone, readonly [number, number]>> = {
  camera: [440, 660],
  'clear-photo': [880, 220],
  'blurry-photo': [240, 180],
  win: [523, 784],
  lose: [196, 98],
};

export function setMuted(nextMuted: boolean): void {
  muted = nextMuted;
  if (audioContext && masterGain) {
    masterGain.gain.setValueAtTime(muted ? 0 : 1, audioContext.currentTime);
  }
}

export function isMuted(): boolean {
  return muted;
}

function createAudioGraph(): AudioContext | null {
  if (typeof AudioContext === 'undefined') {
    return null;
  }

  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.gain.setValueAtTime(muted ? 0 : 1, audioContext.currentTime);
    masterGain.connect(audioContext.destination);
  }

  return audioContext;
}

/** Must be called from a genuine click/key gesture before gameplay tones are requested. */
export async function unlockAudio(): Promise<void> {
  const context = createAudioGraph();
  if (context?.state === 'suspended') {
    await context.resume();
  }
}

function scheduleTone(context: AudioContext, output: GainNode, tone: UiTone): void {
  const now = context.currentTime;
  const duration = tone === 'win' || tone === 'lose' ? 0.28 : 0.12;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const [startFrequency, endFrequency] = toneFrequencies[tone];

  oscillator.type = tone === 'clear-photo' || tone === 'lose' ? 'sawtooth' : 'sine';
  oscillator.frequency.setValueAtTime(startFrequency, now);
  oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  oscillator.connect(gain);
  gain.connect(output);
  oscillator.start(now);
  oscillator.stop(now + duration);
}

/** Plays a short oscillator chirp, creating no downloaded audio assets. */
export function playUiTone(tone: UiTone): void {
  const context = audioContext;
  const output = masterGain;
  if (muted || !context || !output || context.state === 'closed') {
    return;
  }

  if (context.state === 'suspended') {
    void context.resume().then(() => {
      if (!muted && context.state === 'running') {
        scheduleTone(context, output, tone);
      }
    });
    return;
  }

  scheduleTone(context, output, tone);
}
