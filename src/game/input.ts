import type { PlayerId } from './types';

export interface Buttons { left: boolean; right: boolean; jump: boolean }
export type ButtonName = keyof Buttons;
export type InputAction = 'pause' | 'restart' | 'confirm' | 'mute' | 'back';

const fresh = (): Buttons => ({ left: false, right: false, jump: false });

/** Merges keyboard (WASD = P1, Arrows = P2) with virtual touch buttons. */
export class Input {
  private kb: Record<PlayerId, Buttons> = { 1: fresh(), 2: fresh() };
  private touch: Record<PlayerId, Buttons> = { 1: fresh(), 2: fresh() };
  private merged: Record<PlayerId, Buttons> = { 1: fresh(), 2: fresh() };
  onAction: ((a: InputAction) => void) | null = null;
  onAnyKey: (() => void) | null = null;

  private keyMap: Record<string, [PlayerId, ButtonName]> = {
    KeyA: [1, 'left'], KeyD: [1, 'right'], KeyW: [1, 'jump'], Space: [1, 'jump'],
    ArrowLeft: [2, 'left'], ArrowRight: [2, 'right'], ArrowUp: [2, 'jump'],
  };

  private onDown = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
    this.onAnyKey?.();
    const m = this.keyMap[e.code];
    if (m) {
      this.kb[m[0]][m[1]] = true;
      e.preventDefault();
      return;
    }
    if (e.repeat) return;
    switch (e.code) {
      case 'Escape': case 'KeyP': this.onAction?.('pause'); break;
      case 'KeyR': this.onAction?.('restart'); break;
      case 'Enter': this.onAction?.('confirm'); break;
      case 'KeyM': this.onAction?.('mute'); break;
      case 'Backspace': this.onAction?.('back'); break;
    }
  };

  private onUp = (e: KeyboardEvent) => {
    const m = this.keyMap[e.code];
    if (m) this.kb[m[0]][m[1]] = false;
  };

  private onBlur = () => {
    for (const pid of [1, 2] as PlayerId[]) {
      this.kb[pid] = fresh();
      this.touch[pid] = fresh();
    }
  };

  attach() {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.onBlur);
  }

  setTouch(pid: PlayerId, btn: ButtonName, down: boolean) {
    this.touch[pid][btn] = down;
  }

  get(pid: PlayerId): Buttons {
    const m = this.merged[pid];
    m.left = this.kb[pid].left || this.touch[pid].left;
    m.right = this.kb[pid].right || this.touch[pid].right;
    m.jump = this.kb[pid].jump || this.touch[pid].jump;
    return m;
  }
}
