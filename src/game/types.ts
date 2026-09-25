// ---------------------------------------------------------------------------
// Core type definitions for SHARED FATE
// Traps & puzzles are NOT hardcoded: they are authored as "logic plans" made of
// declarative conditions and sequences of micro-actions interpreted at runtime.
// Diabolical subversions (safe-zone betrayal, goal subversion, silent input
// malfunctions, co-op sabotage) are all expressed as data via these plans.
// ---------------------------------------------------------------------------

export type PlayerId = 1 | 2;
export type Who = 'p1' | 'p2' | 'any' | 'both';

export type SoundName =
  | 'jump' | 'land' | 'death' | 'plate' | 'unplate' | 'unlock' | 'troll'
  | 'tick' | 'clear' | 'poof' | 'blip' | 'rumble' | 'flip' | 'spike' | 'select'
  | 'thud' | 'warp' | 'alarm';

export type EntityKind =
  | 'platform' | 'spikes' | 'saw' | 'plate' | 'zone' | 'exit' | 'sign' | 'anvil'
  | 'balloon' | 'spring' | 'pickup';
export type EntityState =
  | 'solid' | 'off' | 'gone' | 'up' | 'down' | 'on' | 'idle' | 'falling' | 'landed';
export type Look =
  | 'normal' | 'bridge' | 'glow' | 'door' | 'seal' | 'crumble' | 'well' | 'ledge'
  | 'invisible' | 'greenBtn' | 'crusher' | 'piano' | 'trapPlate';

// ----- Conditions: evaluated every tick against live world state -----------
export type Condition =
  | { op: 'always' }
  | { op: 'inZone'; zone: string; who: Who }
  | { op: 'onPlate'; plate: string; who?: Who }
  | { op: 'standingOn'; target: string; who?: Who }
  | { op: 'state'; target: string; is: EntityState }
  | { op: 'flag'; name: string; is?: number }
  | { op: 'elapsed'; ms: number }
  | { op: 'distinctZones'; zones: string[] }   // one player in each of two different zones
  | { op: 'event'; name: string }              // emitted by another plan last tick
  | { op: 'swapped' }                          // true while P1/P2 controls are swapped
  | { op: 'airborne'; who?: Who }              // true if matching player(s) mid-air
  | { op: 'grounded'; who?: Who }
  | { op: 'and'; of: Condition[] }
  | { op: 'or'; of: Condition[] }
  | { op: 'not'; of: Condition };

export type Target = string | string[];

// ----- Micro-actions: tiny composable steps that plans sequence -------------
export type MicroAction =
  | { act: 'wait'; ms: number }
  | { act: 'set'; target: Target; state: EntityState; force?: boolean }
  | { act: 'telegraph'; target: Target; ms: number }          // warn (rattle) then continue
  | { act: 'move'; target: Target; to: [number, number]; ms: number; ease?: 'linear' | 'inOut' | 'out' }
  | { act: 'rail'; target: string; points: [number, number][]; to: number; speed: number }
  | { act: 'drop'; target: Target; above?: Who | 'marked' }    // anvil/piano falls; optionally repositioned over a player
  | { act: 'mark'; zone?: string; who?: Who }                  // remember a specific player for later slapstick
  | { act: 'topple'; target: Target }                          // cardboard exit falls over toward nearest player
  | { act: 'inflate'; who: Who; rate: number; zone?: string }  // rate>0 inflates until POP, rate<0 deflates
  | { act: 'launch'; who: Who; zone?: string }                 // spring-launch player out of the screen
  | { act: 'giveLaser'; who: Who; zone?: string; on?: boolean }
  | { act: 'shake'; power: number; ms?: number }
  | { act: 'flash'; color?: string }
  | { act: 'invert'; who: Who; ms?: number }                   // no ms = until level ends
  | { act: 'unInvert'; who: Who }
  | { act: 'swap'; mode?: 'on' | 'off' | 'toggle'; ms?: number } // silent P1<->P2 control swap
  | { act: 'gravity'; who: Who; scale: number }
  | { act: 'kill'; who: Who; zone?: string; cause?: DeathCause } // zone filters to players inside it
  | { act: 'teleport'; who: Who; to: [number, number]; zone?: string; keepVel?: boolean }
  | { act: 'say'; text: string; ms?: number; style?: 'troll' | 'info' }
  | { act: 'flag'; name: string; value: number }
  | { act: 'emit'; event: string }
  | { act: 'sound'; name: SoundName }
  | { act: 'particles'; target: Target; kind: 'poof' | 'sparkle' | 'debris' }
  | { act: 'goto'; step: number }
  | { act: 'reset'; target: Target };

export interface Plan {
  id: string;
  when: Condition;
  once?: boolean;        // fire a single time per level attempt
  cooldownMs?: number;   // minimum time between firings
  do: MicroAction[];     // run on rising edge of `when`
  else?: MicroAction[];  // run on falling edge of `when`
  interrupt?: boolean;   // abort the running `do` sequence when `when` turns false
}

// ----- Entities -------------------------------------------------------------
export interface EntityProps {
  look?: Look;
  hidden?: boolean;               // fully invisible while 'off' (spikes: also while 'down')
  fake?: boolean;                 // exit: deadly decoy, never triggers level clear
  cardboard?: boolean;            // exit: 2D cutout prop that topples and flattens you
  homeSpeed?: number;             // balloon drift speed
  dir?: 'up' | 'down';            // spikes direction
  radius?: number;                // saw radius
  path?: [number, number][];      // saw patrol path (pixels)
  speed?: number;                 // saw patrol speed
  text?: string;                  // sign text
}

export interface EntityDef {
  id: string;
  kind: EntityKind;
  x: number; y: number;           // tile units (saws: center, fractional ok)
  w?: number; h?: number;         // tile units
  state?: EntityState;
  props?: EntityProps;
}

export type Motion =
  | { kind: 'tween'; fromX: number; fromY: number; toX: number; toY: number; t: number; dur: number; ease: string }
  | { kind: 'rail'; points: [number, number][]; idx: number; next: number; target: number; speed: number };

export interface Entity {
  id: string;
  kind: EntityKind;
  x: number; y: number; w: number; h: number;   // pixels (saws: x,y = center)
  state: EntityState;
  initial: { x: number; y: number; state: EntityState };
  props: EntityProps;
  shakeT: number;
  motion: Motion | null;
  pressed: boolean;
  pressT: number;
  angle: number;
  pathPos: number;
  pathDir: number;
  anim: number;
  vy: number;              // anvil falling velocity
  t: number;
  trail: [number, number][];
}

export interface LevelDef {
  id: string;
  name: string;
  subtitle: string;
  par: number;       // seconds
  tip: string;
  map: string[];
  entities: EntityDef[];
  plans: Plan[];
}

export interface Player {
  id: PlayerId;
  x: number; y: number; vx: number; vy: number; w: number; h: number;
  grounded: boolean;
  coyote: number;
  jumpBuf: number;
  prevJump: boolean;
  jumping: boolean;
  facing: 1 | -1;
  gravScale: number;
  invertUntil: number;   // -1 none, Infinity permanent
  dead: boolean;
  squashX: number; squashY: number;
  runT: number;
  spawnT: number;
  standingOn: Entity | null;
  inflate: number;       // 0 = normal, 1 = POP
  inflateRate: number;   // per second
  launched: boolean;     // spring gag: flying out of the screen
  launchT: number;
  laser: boolean;
  laserT: number;
}

export type DeathCause =
  | 'spikes' | 'saw' | 'crushed' | 'fall' | 'anvil' | 'fakeExit' | 'trap'
  | 'balloon' | 'piano' | 'popped' | 'laser' | 'cardboard' | 'launched';
