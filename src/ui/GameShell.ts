/*
 * Copyright (C) 2026 ProjectConspiracy
 * SPDX-License-Identifier: GPL-3.0-only
 * See LICENSE for the full license terms.
 */
import { isMuted, setMuted, unlockAudio } from '../game/audio';
import {
  gameEvents,
  type GameMessage,
  type GameResult,
  type HudState,
} from '../game/events';
import { CAMERA_IDS } from '../game/rules/gameState';

export type ShellScreen = 'title' | 'controls' | 'playing' | 'won' | 'lost';

export interface SceneLifecycleCommands {
  start(): void;
  restart(): void;
  destroy(): void;
}

export interface ShellState {
  readonly screen: ShellScreen;
  readonly hud: HudState;
  readonly message: GameMessage | null;
  readonly result: GameResult | null;
}

export type ShellAction =
  | { readonly type: 'show-controls' }
  | { readonly type: 'begin-run' }
  | { readonly type: 'run-ready' }
  | { readonly type: 'hud-update'; readonly hud: HudState }
  | { readonly type: 'message-show'; readonly message: GameMessage }
  | { readonly type: 'message-clear' }
  | { readonly type: 'run-result'; readonly result: GameResult };

export interface HudPresentation {
  readonly cameras: string;
  readonly photos: string;
  readonly cover: string;
  readonly interactionPercent: number;
}

export interface ResultPresentation {
  readonly eyebrow: string;
  readonly heading: string;
  readonly message: string;
}

export type FocusTarget = 'start' | 'continue' | 'gameplay' | 'restart-win' | 'restart-loss';

interface TextTarget {
  textContent: string | null;
}

const coverLabels: Readonly<Record<HudState['cover'], string>> = {
  exposed: 'Exposed',
  'partly-covered': 'Partly covered',
  hidden: 'Hidden',
};

function createEmptyHud(): HudState {
  return {
    disabledCameraCount: 0,
    totalCameraCount: CAMERA_IDS.length,
    clearPhotoCount: 0,
    clearPhotoLimit: 3,
    cover: 'hidden',
    interaction: null,
  };
}

export function createInitialShellState(): ShellState {
  return {
    screen: 'title',
    hud: createEmptyHud(),
    message: null,
    result: null,
  };
}

export function reduceShellState(state: ShellState, action: ShellAction): ShellState {
  switch (action.type) {
    case 'show-controls':
      return { ...state, screen: 'controls' };
    case 'begin-run':
      return {
        screen: 'playing',
        hud: createEmptyHud(),
        message: null,
        result: null,
      };
    case 'run-ready':
      return { ...state, screen: 'playing' };
    case 'hud-update':
      return { ...state, hud: action.hud };
    case 'message-show':
      return { ...state, message: action.message };
    case 'message-clear':
      return { ...state, message: null };
    case 'run-result':
      return {
        ...state,
        screen: action.result.status,
        message: null,
        result: action.result,
      };
  }
}

export function getHudPresentation(hud: HudState): HudPresentation {
  const interactionProgress = hud.interaction?.progress ?? 0;
  return {
    cameras: `${hud.disabledCameraCount} / ${hud.totalCameraCount}`,
    photos: `${hud.clearPhotoCount} / ${hud.clearPhotoLimit}`,
    cover: coverLabels[hud.cover],
    interactionPercent: Math.round(Math.min(1, Math.max(0, interactionProgress)) * 100),
  };
}

export function getResultPresentation(result: GameResult): ResultPresentation {
  if (result.status === 'lost') {
    return {
      eyebrow: 'Evidence confirmed',
      heading: 'Too many clear photos',
      message: result.message,
    };
  }
  return result.allCamerasDisabled
    ? {
        eyebrow: 'Clean route bonus',
        heading: 'No Evidence Left',
        message: result.message,
      }
    : { eyebrow: 'Home', heading: 'Back at High Den', message: result.message };
}

/** Returns a focus destination only when the shell actually changes screens. */
export function getTransitionFocusTarget(
  previousScreen: ShellScreen,
  nextScreen: ShellScreen,
): FocusTarget | null {
  if (previousScreen === nextScreen) {
    return null;
  }

  switch (nextScreen) {
    case 'title':
      return 'start';
    case 'controls':
      return 'continue';
    case 'playing':
      return 'gameplay';
    case 'won':
      return 'restart-win';
    case 'lost':
      return 'restart-loss';
  }
}

/** Prevents unchanged text from retriggering assistive-technology live regions. */
export function writeTextIfChanged(target: TextTarget, text: string): boolean {
  if (target.textContent === text) {
    return false;
  }
  target.textContent = text;
  return true;
}

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Game shell element not found: ${selector}`);
  }
  return element;
}

/** DOM-only presentation layer. Phaser communicates with it exclusively through typed events. */
export class GameShell {
  readonly gameParent: HTMLElement;

  private state = createInitialShellState();
  private controller: SceneLifecycleCommands | null = null;
  private readonly screens: Readonly<Record<Exclude<ShellScreen, 'playing'>, HTMLElement>>;
  private readonly hud: HTMLElement;
  private readonly cameraValue: HTMLElement;
  private readonly photoValue: HTMLElement;
  private readonly coverValue: HTMLElement;
  private readonly interactionPrompt: HTMLElement;
  private readonly interactionProgress: HTMLElement;
  private readonly message: HTMLElement;
  private readonly resultEyebrows: Readonly<Record<'won' | 'lost', HTMLElement>>;
  private readonly resultHeadings: Readonly<Record<'won' | 'lost', HTMLElement>>;
  private readonly resultMessages: Readonly<Record<'won' | 'lost', HTMLElement>>;
  private readonly muteButton: HTMLButtonElement;
  private readonly unsubscribers: Array<() => void> = [];
  private messageTimer: number | null = null;

  constructor(private readonly root: HTMLElement) {
    this.root.innerHTML = `
      <main class="game-page" aria-labelledby="game-title">
        <section class="field-note" aria-label="Ranger field note">
          <span class="field-note__label">Field operation 03</span>
          <span>Leave no trail. Leave no clear photographs.</span>
        </section>

        <div class="game-stage" data-screen="title">
          <div id="game-canvas" class="game-canvas" tabindex="-1" data-focus-target="gameplay" aria-label="Bigfoot forest playfield"></div>
          <div class="stage-vignette" aria-hidden="true"></div>

          <aside class="hud" aria-label="Mission status" aria-live="polite" hidden>
            <div class="hud__item">
              <span class="hud__label">Cameras (optional)</span>
              <strong data-hud="cameras">0 / ${CAMERA_IDS.length}</strong>
            </div>
            <div class="hud__item">
              <span class="hud__label">Clear photos</span>
              <strong data-hud="photos">0 / 3</strong>
            </div>
            <div class="hud__item hud__cover" data-cover="hidden">
              <span class="hud__label">Cover</span>
              <strong data-hud="cover">Hidden</strong>
            </div>
          </aside>

          <button class="mute-button" type="button" aria-pressed="false" aria-label="Mute sound">
            <span aria-hidden="true" data-mute-icon>Sound on</span>
          </button>

          <div class="interaction-prompt" hidden>
            <span role="status">Hold <kbd>E</kbd> to disable camera</span>
            <span class="interaction-prompt__track" role="progressbar" aria-label="Camera disable progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
              <span class="interaction-prompt__fill"></span>
            </span>
          </div>

          <div class="game-message" role="status" aria-live="assertive" hidden></div>

          <section class="game-screen game-screen--title" data-overlay="title">
            <div class="screen-card screen-card--title">
              <p class="eyebrow">Back to the High Den</p>
              <h1 id="game-title">Blurfoot</h1>
              <p class="lede">The lookout's three knocks travel down the ridge: humans are in the lower forest again. Bigfoot is far from High Den, and the only route home runs through their lights, cameras, and rotten-mustard stink.</p>
              <button class="primary-button" type="button" data-action="start" data-focus-target="start">Start</button>
            </div>
          </section>

          <section class="game-screen" data-overlay="controls" hidden>
            <div class="screen-card">
              <p class="eyebrow">Field briefing</p>
              <h2>Reach High Den</h2>
              <dl class="controls-list">
                <div><dt><kbd>WASD</kbd> / <kbd>Arrows</kbd></dt><dd>Move through the forest; water slows you to a wade</dd></div>
                <div><dt>Hold <kbd>E</kbd> for 2 seconds</dt><dd>Disable a nearby trail camera; releasing E or stepping away resets progress</dd></div>
              </dl>
              <p class="briefing-note">Blue cones belong to tree cameras; yellow cones belong to hikers. Approaching a camera from the side or rear is safer. Bushes soften a photograph, while tree trunks stop sight entirely. The bridge, deadfall, and basalt ford let you cross Swift Creek at walking speed. Your field map records major landmarks and any trail cameras you pass.</p>
              <button class="primary-button" type="button" data-action="continue" data-focus-target="continue">Continue</button>
            </div>
          </section>

          <section class="game-screen" data-overlay="won" aria-labelledby="win-heading" aria-describedby="win-message" hidden>
            <div class="screen-card screen-card--result">
              <p class="eyebrow" data-result-eyebrow="won">Home</p>
              <h2 id="win-heading" data-result-heading="won">Back at High Den</h2>
              <p id="win-message" data-result="won">You made it home to High Den.</p>
              <button class="primary-button" type="button" data-action="restart-win" data-focus-target="restart-win">Play again</button>
            </div>
          </section>

          <section class="game-screen" data-overlay="lost" aria-labelledby="loss-heading" aria-describedby="loss-message" hidden>
            <div class="screen-card screen-card--result">
              <p class="eyebrow" data-result-eyebrow="lost">Evidence confirmed</p>
              <h2 id="loss-heading" data-result-heading="lost">Too many clear photos</h2>
              <p id="loss-message" data-result="lost">The hikers got the proof they needed.</p>
              <button class="primary-button" type="button" data-action="restart-loss" data-focus-target="restart-loss">Try again</button>
            </div>
          </section>
        </div>

        <p class="mission-key"><span>Bigfoot</span> brown rectangle · <span>Hikers</span> yellow circles · <span>Mission</span> Reach High Den · Optional: disable ${CAMERA_IDS.length} cameras</p>
      </main>
    `;

    this.gameParent = requireElement(this.root, '#game-canvas');
    this.screens = {
      title: requireElement(this.root, '[data-overlay="title"]'),
      controls: requireElement(this.root, '[data-overlay="controls"]'),
      won: requireElement(this.root, '[data-overlay="won"]'),
      lost: requireElement(this.root, '[data-overlay="lost"]'),
    };
    this.hud = requireElement(this.root, '.hud');
    this.cameraValue = requireElement(this.root, '[data-hud="cameras"]');
    this.photoValue = requireElement(this.root, '[data-hud="photos"]');
    this.coverValue = requireElement(this.root, '[data-hud="cover"]');
    this.interactionPrompt = requireElement(this.root, '.interaction-prompt');
    this.interactionProgress = requireElement(this.root, '[role="progressbar"]');
    this.message = requireElement(this.root, '.game-message');
    this.resultEyebrows = {
      won: requireElement(this.root, '[data-result-eyebrow="won"]'),
      lost: requireElement(this.root, '[data-result-eyebrow="lost"]'),
    };
    this.resultHeadings = {
      won: requireElement(this.root, '[data-result-heading="won"]'),
      lost: requireElement(this.root, '[data-result-heading="lost"]'),
    };
    this.resultMessages = {
      won: requireElement(this.root, '[data-result="won"]'),
      lost: requireElement(this.root, '[data-result="lost"]'),
    };
    this.muteButton = requireElement(this.root, '.mute-button');

    requireElement<HTMLButtonElement>(this.root, '[data-action="start"]')
      .addEventListener('click', () => this.showControls());
    requireElement<HTMLButtonElement>(this.root, '[data-action="continue"]')
      .addEventListener('click', () => this.beginRun('start'));
    requireElement<HTMLButtonElement>(this.root, '[data-action="restart-win"]')
      .addEventListener('click', () => this.beginRun('restart'));
    requireElement<HTMLButtonElement>(this.root, '[data-action="restart-loss"]')
      .addEventListener('click', () => this.beginRun('restart'));
    this.muteButton.addEventListener('click', () => {
      setMuted(!isMuted());
      this.renderMute();
    });

    this.unsubscribers.push(
      gameEvents.on('run:ready', () => this.dispatch({ type: 'run-ready' })),
      gameEvents.on('hud:update', (hud) => this.dispatch({ type: 'hud-update', hud })),
      gameEvents.on('message:show', (message) => this.showMessage(message)),
      gameEvents.on('run:result', (result) => this.dispatch({ type: 'run-result', result })),
    );

    this.renderMute();
    this.render();
  }

  connect(controller: SceneLifecycleCommands): void {
    if (this.controller) {
      throw new Error('The game shell is already connected.');
    }
    this.controller = controller;
  }

  destroy(): void {
    if (this.messageTimer !== null) {
      window.clearTimeout(this.messageTimer);
    }
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.controller?.destroy();
    this.root.replaceChildren();
  }

  private showControls(): void {
    void unlockAudio();
    this.dispatch({ type: 'show-controls' });
  }

  private beginRun(command: 'start' | 'restart'): void {
    if (!this.controller) {
      throw new Error('The game shell has not been connected.');
    }

    void unlockAudio();
    if (this.messageTimer !== null) {
      window.clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
    this.dispatch({ type: 'begin-run' });
    this.controller[command]();
  }

  private showMessage(message: GameMessage): void {
    if (this.messageTimer !== null) {
      window.clearTimeout(this.messageTimer);
    }
    this.dispatch({ type: 'message-show', message });
    this.messageTimer = window.setTimeout(() => {
      this.messageTimer = null;
      this.dispatch({ type: 'message-clear' });
    }, message.durationMs);
  }

  private dispatch(action: ShellAction): void {
    const previousScreen = this.state.screen;
    this.state = reduceShellState(this.state, action);
    this.render();
    const focusTarget = getTransitionFocusTarget(previousScreen, this.state.screen);
    if (focusTarget) {
      requireElement<HTMLElement>(this.root, `[data-focus-target="${focusTarget}"]`).focus();
    }
  }

  private renderMute(): void {
    const muted = isMuted();
    this.muteButton.setAttribute('aria-pressed', String(muted));
    this.muteButton.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
    requireElement(this.muteButton, '[data-mute-icon]').textContent = muted ? 'Sound off' : 'Sound on';
  }

  private render(): void {
    const playing = this.state.screen === 'playing';
    const stage = requireElement<HTMLElement>(this.root, '.game-stage');
    stage.dataset.screen = this.state.screen;
    this.hud.hidden = !playing;

    (Object.keys(this.screens) as Array<keyof typeof this.screens>).forEach((screen) => {
      const visible = this.state.screen === screen;
      this.screens[screen].hidden = !visible;
      this.screens[screen].setAttribute('aria-hidden', String(!visible));
    });

    const hud = getHudPresentation(this.state.hud);
    writeTextIfChanged(this.cameraValue, hud.cameras);
    writeTextIfChanged(this.photoValue, hud.photos);
    writeTextIfChanged(this.coverValue, hud.cover);
    this.coverValue.parentElement?.setAttribute('data-cover', this.state.hud.cover);

    const interactionVisible = playing && this.state.hud.interaction !== null;
    this.interactionPrompt.hidden = !interactionVisible;
    const interactionPercent = String(hud.interactionPercent);
    if (this.interactionProgress.getAttribute('aria-valuenow') !== interactionPercent) {
      this.interactionProgress.setAttribute('aria-valuenow', interactionPercent);
    }
    const interactionFill = requireElement<HTMLElement>(
      this.interactionProgress,
      '.interaction-prompt__fill',
    );
    const visualProgress = `${hud.interactionPercent}%`;
    if (interactionFill.style.getPropertyValue('--progress') !== visualProgress) {
      interactionFill.style.setProperty('--progress', visualProgress);
    }

    const messageVisible = playing && this.state.message !== null;
    this.message.hidden = !messageVisible;
    writeTextIfChanged(this.message, messageVisible ? this.state.message?.text ?? '' : '');
    const messageKind = this.state.message?.kind ?? '';
    if (this.message.dataset.kind !== messageKind) {
      this.message.dataset.kind = messageKind;
    }

    if (this.state.result) {
      const presentation = getResultPresentation(this.state.result);
      const status = this.state.result.status;
      writeTextIfChanged(this.resultEyebrows[status], presentation.eyebrow);
      writeTextIfChanged(this.resultHeadings[status], presentation.heading);
      writeTextIfChanged(this.resultMessages[status], presentation.message);
    }
  }
}
