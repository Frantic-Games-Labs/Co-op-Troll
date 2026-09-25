import { P1_COLORS, P2_COLORS, PAL } from './constants';
import type { PlayerId } from './types';

// Legend: . transparent  b body  h highlight  d dark outline  w eye white  k pupil
// Body is drawn facing RIGHT; left-facing frames are mirrored.
const BODY = [
  '..dddddd..',
  '.dbbbbbbd.',
  'dbhhbbbbbd',
  'dbhbbbbbbd',
  'dbbbbbbbbd',
  'dbbbwwbwwd',
  'dbbbwkbwkd',
  'dbbbbbbbbd',
  'dbbbbbbbbd',
  'dbbbbbbbbd',
  '.dbbbbbbd.',
  '.dbbbbbbd.',
];
const BLINK_ROWS: Record<number, string> = { 5: 'dbbbbbbbbd', 6: 'dbbbddbddd' };

export type Frame = 'idle' | 'run1' | 'run2' | 'jump';
const FEET: Record<Frame, string[]> = {
  idle: ['.dd....dd.', '.dd....dd.'],
  run1: ['dd......dd', 'dd......dd'],
  run2: ['...dddd...', '....dd....'],
  jump: ['..dd..dd..', '..........'],
};

export const SPRITE_W = 10;
export const SPRITE_H = 14;

const cache = new Map<string, HTMLCanvasElement>();

export function playerColors(pid: PlayerId) {
  return pid === 1 ? P1_COLORS : P2_COLORS;
}

/** Returns a cached, fully transparent canvas with the requested frame. */
export function getPlayerSprite(pid: PlayerId, frame: Frame, facing: 1 | -1, blink: boolean): HTMLCanvasElement {
  const key = `${pid}-${frame}-${facing}-${blink ? 1 : 0}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const c = document.createElement('canvas');
  c.width = SPRITE_W;
  c.height = SPRITE_H;
  const ctx = c.getContext('2d')!;
  const col = playerColors(pid);
  const rows = [...BODY.map((r, i) => (blink && BLINK_ROWS[i] ? BLINK_ROWS[i] : r)), ...FEET[frame]];
  rows.forEach((row, y) => {
    for (let x = 0; x < SPRITE_W; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      ctx.fillStyle =
        ch === 'b' ? col.body : ch === 'h' ? col.hi : ch === 'd' ? col.dark : ch === 'w' ? PAL.white : PAL.bg;
      const dx = facing === 1 ? x : SPRITE_W - 1 - x;
      ctx.fillRect(dx, y, 1, 1);
    }
  });
  cache.set(key, c);
  return c;
}
