export const TILE = 16;
export const COLS = 32;
export const ROWS = 18;
export const VIEW_W = COLS * TILE; // 512
export const VIEW_H = ROWS * TILE; // 288
export const DT = 1 / 60;

// Tight, responsive platforming feel: fast accel, strong friction, variable
// jump height, coyote time and a jump buffer.
export const PHYS = {
  gravity: 920,
  maxFall: 330,
  runSpeed: 112,
  groundAccel: 1500,
  airAccel: 1100,
  groundFriction: 1700,
  airFriction: 320,
  jumpSpeed: 318,
  jumpCut: 0.42,
  coyote: 0.09,
  jumpBuffer: 0.12,
  playerW: 10,
  playerH: 14,
};

// Sweetie-16 inspired palette for a cohesive minimalist pixel look
export const PAL = {
  bg: '#1a1c2c',
  bgDeep: '#12131f',
  purple: '#5d275d',
  red: '#b13e53',
  orange: '#ef7d57',
  yellow: '#ffcd75',
  lime: '#a7f070',
  green: '#38b764',
  teal: '#257179',
  navy: '#29366f',
  blue: '#3b5dc9',
  sky: '#41a6f6',
  cyan: '#73eff7',
  white: '#f4f4f4',
  grey: '#94b0c2',
  slate: '#566c86',
  dark: '#333c57',
};

export const P1_COLORS = { body: PAL.sky, hi: PAL.cyan, dark: PAL.navy };
export const P2_COLORS = { body: PAL.orange, hi: PAL.yellow, dark: PAL.purple };

export const PIXEL_FONT = '"Press Start 2P", "Courier New", monospace';
