import { COLS, ROWS, TILE, PHYS, VIEW_H, VIEW_W, PAL } from './constants';
import { LogicRunner, type LogicHost } from './logic';
import { Particles } from './particles';
import { playerColors } from './sprites';
import type { Input } from './input';
import type {
  DeathCause, Entity, EntityDef, EntityKind, EntityState, LevelDef, Player, PlayerId, SoundName,
} from './types';

export interface Message { text: string; until: number; style: string }
export interface DeathInfo { pid: PlayerId; cause: DeathCause }

const overlap = (ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) =>
  ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

const approach = (v: number, target: number, maxDelta: number) =>
  v < target ? Math.min(target, v + maxDelta) : Math.max(target, v - maxDelta);

const ease = (k: number, kind: string) => {
  if (kind === 'linear') return k;
  if (kind === 'out') return 1 - (1 - k) * (1 - k);
  return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
};

const defaultState = (kind: EntityKind): EntityState => {
  if (kind === 'platform') return 'solid';
  if (kind === 'spikes') return 'up';
  if (kind === 'saw') return 'on';
  if (kind === 'anvil') return 'idle';
  if (kind === 'exit') return 'idle';
  return 'idle';
};

export function spikeRect(e: Entity): [number, number, number, number] {
  const depth = Math.round(10 * e.anim);
  if (e.props.dir === 'down') return [e.x + 2, e.y, e.w - 4, depth];
  return [e.x + 2, e.y + e.h - depth, e.w - 4, depth];
}

export class World implements LogicHost {
  level!: LevelDef;
  solids = new Uint8Array(COLS * ROWS);
  entities: Entity[] = [];
  byId = new Map<string, Entity>();
  players: Player[] = [];
  logic!: LogicRunner;
  particles = new Particles();
  time = 0;
  phase: 'play' | 'dying' | 'cleared' = 'play';
  phaseT = 0;
  death: DeathInfo | null = null;
  deathCount = 0;
  message: Message | null = null;
  shakePower = 0; shakeT = 0; shakeDur = 0.35; shakeX = 0; shakeY = 0;
  flashA = 0; flashColor = PAL.white;
  exitT = 0;
  exitCount = 0;
  frozen = false;
  swapped = false;
  swapUntil = 0;
  marked: PlayerId | null = null;
  hudBounce = 0;           // incremented when a launched player bonks the score counter
  sound: (n: SoundName) => void = () => {};
  private hintsSeen = new Set<string>();

  constructor(public input: Input) {}

  // ----------------------------------------------------------------- loading
  load(level: LevelDef) {
    if (this.level?.id !== level.id) this.hintsSeen.clear();
    this.level = level;
    this.solids.fill(0);
    this.entities = [];
    this.byId.clear();
    this.players = [];
    this.particles.clear();
    this.time = 0;
    this.phase = 'play';
    this.phaseT = 0;
    this.death = null;
    this.message = null;
    this.exitT = 0;
    this.exitCount = 0;
    this.shakeT = 0; this.shakeX = 0; this.shakeY = 0;
    this.flashA = 0;
    this.swapped = false;
    this.swapUntil = 0;
    this.marked = null;

    const spawns: Record<number, [number, number]> = {};
    for (let r = 0; r < ROWS; r++) {
      const row = (level.map[r] ?? '').padEnd(COLS, '.').slice(0, COLS);
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        if (ch === '#') this.solids[r * COLS + c] = 1;
        else if (ch === '1') spawns[1] = [c, r];
        else if (ch === '2') spawns[2] = [c, r];
      }
      // merge runs of static spikes into single entities
      for (const [ch, dir] of [['^', 'up'], ['v', 'down']] as const) {
        let c = 0;
        while (c < COLS) {
          if (row[c] === ch) {
            let end = c;
            while (end + 1 < COLS && row[end + 1] === ch) end++;
            this.addEntity({ id: `sp-${dir}-${r}-${c}`, kind: 'spikes', x: c, y: r, w: end - c + 1, h: 1, props: { dir } });
            c = end + 1;
          } else c++;
        }
      }
    }
    for (const def of level.entities) this.addEntity(def);

    for (const pid of [1, 2] as PlayerId[]) {
      const [c, r] = spawns[pid] ?? [2 + pid * 2, 12];
      this.players.push(this.makePlayer(pid, c * TILE + 3, r * TILE + TILE - PHYS.playerH));
    }
    this.logic = new LogicRunner(level.plans);
  }

  reset() {
    this.load(this.level);
  }

  private addEntity(def: EntityDef) {
    const isSaw = def.kind === 'saw';
    const r = def.props?.radius ?? 14;
    const e: Entity = {
      id: def.id,
      kind: def.kind,
      x: def.x * TILE,
      y: def.y * TILE,
      w: isSaw ? r * 2 : (def.w ?? 1) * TILE,
      h: isSaw ? r * 2 : (def.h ?? 1) * TILE,
      state: def.state ?? defaultState(def.kind),
      initial: { x: def.x * TILE, y: def.y * TILE, state: def.state ?? defaultState(def.kind) },
      props: def.props ?? {},
      shakeT: 0,
      motion: null,
      pressed: false,
      pressT: 0,
      angle: 0,
      pathPos: 0,
      pathDir: 1,
      anim: def.kind === 'spikes' && (def.state ?? 'up') === 'up' ? 1 : 0,
      vy: 0,
      t: Math.random() * 10,
      trail: [],
    };
    if (isSaw && e.props.path && e.props.path.length) {
      e.x = e.props.path[0][0];
      e.y = e.props.path[0][1];
    }
    this.entities.push(e);
    this.byId.set(e.id, e);
  }

  private makePlayer(id: PlayerId, x: number, y: number): Player {
    return {
      id, x, y, vx: 0, vy: 0, w: PHYS.playerW, h: PHYS.playerH,
      grounded: false, coyote: 0, jumpBuf: 0, prevJump: false, jumping: false,
      facing: id === 1 ? 1 : -1, gravScale: 1, invertUntil: -1, dead: false,
      squashX: 1, squashY: 1, runT: 0, spawnT: 0, standingOn: null,
      inflate: 0, inflateRate: 0, launched: false, launchT: 0, laser: false, laserT: 0,
    };
  }

  // ------------------------------------------------------------------ update
  update(dt: number) {
    this.time += dt;
    this.updateFx(dt);
    this.particles.update(dt);
    // timed control-swap expiry
    if (this.swapped && this.swapUntil > 0 && this.time >= this.swapUntil) {
      this.swapped = false;
      this.swapUntil = 0;
    }
    if (this.phase !== 'play' || this.frozen) {
      this.phaseT += dt;
      this.updateEntities(dt, true);
      for (const p of this.players) p.spawnT = Math.min(1, p.spawnT + dt * 4);
      return;
    }
    this.logic.update(dt, this);
    this.updateEntities(dt, false);
    for (const p of this.players) this.updatePlayer(p, dt);
    this.updatePlates();
    this.checkHazards();
    this.checkExit(dt);
  }

  isSwapped(): boolean {
    return this.swapped;
  }

  isAirborne(pid: PlayerId): boolean {
    const p = this.players[pid - 1];
    return !!p && !p.dead && !p.grounded;
  }

  isGrounded(pid: PlayerId): boolean {
    const p = this.players[pid - 1];
    return !!p && !p.dead && p.grounded;
  }

  alivePlayers(): PlayerId[] {
    return this.players.filter((p) => !p.dead).map((p) => p.id);
  }

  private updateFx(dt: number) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      const k = Math.max(0, this.shakeT / this.shakeDur);
      this.shakeX = (Math.random() * 2 - 1) * this.shakePower * k;
      this.shakeY = (Math.random() * 2 - 1) * this.shakePower * k;
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }
    this.flashA = Math.max(0, this.flashA - dt * 2.6);
  }

  private updateEntities(dt: number, ambientOnly: boolean) {
    for (const e of this.entities) {
      e.t += dt;
      if (e.shakeT > 0) {
        e.shakeT -= dt;
        if (Math.random() < dt * 30) this.particles.dust(e.x + Math.random() * e.w, e.y + e.h, 1, 1);
      }
      if (!ambientOnly && e.motion) this.stepMotion(e, dt);
      switch (e.kind) {
        case 'anvil': {
          if (e.state === 'falling' && !ambientOnly) {
            e.vy = Math.min(520, e.vy + 1500 * dt);
            const ny = e.y + e.vy * dt;
            // land on static tiles or solid platforms
            if (this.solidRect(e.x + 2, ny + e.h - 4, e.w - 4, 4)) {
              // snap to surface
              let y = e.y;
              for (let i = 0; i < 24; i++) {
                const test = y + 1;
                if (this.solidRect(e.x + 2, test + e.h - 4, e.w - 4, 4)) break;
                y = test;
              }
              e.y = y;
              e.state = 'landed';
              e.vy = 0;
              this.shake(5, 300);
              this.sound('thud');
              this.particles.debris(e.x, e.y + e.h - 4, e.w, 6);
            } else {
              e.y = ny;
              if (Math.random() < dt * 20) {
                this.particles.add({
                  x: e.x + e.w / 2 + (Math.random() - 0.5) * e.w,
                  y: e.y, vx: 0, vy: -40, life: 0.3, maxLife: 0.3,
                  size: 1, color: PAL.grey, grav: 0, drag: 0,
                });
              }
            }
          }
          break;
        }
        case 'balloon': {
          if (e.state !== 'on') break;
          // Gently, slowly, inevitably drifts toward the nearest living player.
          const alive = this.players.filter((p) => !p.dead);
          if (alive.length && !ambientOnly) {
            const tgt = alive.reduce((a, b) => (Math.hypot(a.x - e.x, a.y - e.y) < Math.hypot(b.x - e.x, b.y - e.y) ? a : b));
            const tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h / 2;
            const d = Math.hypot(tx - e.x, ty - e.y) || 1;
            const sp = e.props.homeSpeed ?? 24;
            e.x += ((tx - e.x) / d) * sp * dt;
            e.y += ((ty - e.y) / d) * sp * dt + Math.sin(e.t * 3) * 6 * dt;
          }
          break;
        }
        case 'exit': {
          if (e.state === 'falling') {
            e.anim = Math.min(1, e.anim + dt / 0.55);
            if (e.anim >= 1) {
              e.state = 'landed';
              this.shake(6, 350);
              this.sound('thud');
              // flattened footprint: door height laid sideways in the topple direction
              const fx = e.pathDir > 0 ? e.x + e.w : e.x - e.h;
              this.particles.debris(fx, e.y + e.h - 6, e.h, 6);
              for (const p of this.players) {
                if (!p.dead && overlap(p.x, p.y, p.w, p.h, fx, e.y + e.h - 14, e.h, 14)) this.kill(p, 'cardboard');
              }
            }
          }
          break;
        }
        case 'saw': {
          if (e.state === 'off') break;
          const patrolling = !e.motion && !!e.props.path && e.props.path.length > 1;
          if (patrolling && !ambientOnly) this.patrol(e, dt);
          e.angle += dt * (e.motion || patrolling ? 15 : 8);
          if (e.motion || patrolling) {
            e.trail.push([e.x, e.y]);
            if (e.trail.length > 6) e.trail.shift();
          } else e.trail.length = 0;
          break;
        }
        case 'spikes': {
          const target = e.state === 'up' ? 1 : 0;
          e.anim = approach(e.anim, target, dt * (target ? 14 : 4));
          break;
        }
        case 'plate':
          e.pressT = approach(e.pressT, e.pressed ? 1 : 0, dt * 12);
          break;
        case 'spring':
          e.anim = approach(e.anim, 0, dt * 4);
          break;
        case 'zone': {
          if (e.props.look === 'ledge' && Math.random() < dt * 5) {
            this.particles.add({
              x: e.x + Math.random() * e.w, y: e.y + e.h - 1, vx: 0, vy: -12 - Math.random() * 10,
              life: 0.8, maxLife: 0.8, size: 1, color: PAL.yellow, grav: 0, drag: 0,
            });
          }
          if (e.props.look === 'well' && Math.random() < dt * (e.state === 'on' ? 28 : 8)) {
            const up = e.state === 'on';
            this.particles.add({
              x: e.x + Math.random() * e.w, y: up ? e.y + e.h - 4 : e.y + 4,
              vx: 0, vy: up ? -50 - Math.random() * 40 : 18 + Math.random() * 12,
              life: up ? 2.2 : 3.5, maxLife: up ? 2.2 : 3.5, size: up ? 2 : 1,
              color: up ? PAL.cyan : PAL.purple, grav: 0, drag: 0,
            });
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private patrol(e: Entity, dt: number) {
    const path = e.props.path!;
    const speed = e.props.speed ?? 80;
    const lens: number[] = [];
    let total = 0;
    for (let i = 0; i < path.length - 1; i++) {
      const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]);
      lens.push(l);
      total += l;
    }
    e.pathPos += e.pathDir * speed * dt;
    if (e.pathPos >= total) { e.pathPos = total; e.pathDir = -1; }
    if (e.pathPos <= 0) { e.pathPos = 0; e.pathDir = 1; }
    let d = e.pathPos;
    for (let i = 0; i < lens.length; i++) {
      if (d <= lens[i] || i === lens.length - 1) {
        const k = lens[i] > 0 ? Math.min(1, d / lens[i]) : 0;
        e.x = path[i][0] + (path[i + 1][0] - path[i][0]) * k;
        e.y = path[i][1] + (path[i + 1][1] - path[i][1]) * k;
        return;
      }
      d -= lens[i];
    }
  }

  private stepMotion(e: Entity, dt: number) {
    const m = e.motion!;
    if (m.kind === 'tween') {
      m.t += dt;
      const k = Math.min(1, m.t / m.dur);
      const ek = ease(k, m.ease);
      e.x = m.fromX + (m.toX - m.fromX) * ek;
      e.y = m.fromY + (m.toY - m.fromY) * ek;
      if (k >= 1) e.motion = null;
    } else {
      const [tx, ty] = m.points[m.next];
      const dx = tx - e.x, dy = ty - e.y;
      const d = Math.hypot(dx, dy);
      const step = m.speed * dt;
      if (d <= step) {
        e.x = tx; e.y = ty;
        m.idx = m.next;
        if (m.idx === m.target) e.motion = null;
        else m.next = m.idx + Math.sign(m.target - m.idx);
      } else {
        e.x += (dx / d) * step;
        e.y += (dy / d) * step;
      }
    }
  }

  // ----------------------------------------------------------------- physics
  solidRect(x: number, y: number, w: number, h: number): boolean {
    const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.01) / TILE);
    const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) continue;
        if (this.solids[ty * COLS + tx]) return true;
      }
    }
    for (const e of this.entities) {
      if (e.kind === 'platform' && e.state === 'solid' && overlap(x, y, w, h, e.x, e.y, e.w, e.h)) return true;
      // landed anvils become standable cover
      if (e.kind === 'anvil' && e.state === 'landed' && overlap(x, y, w, h, e.x, e.y, e.w, e.h)) return true;
    }
    return false;
  }

  private platformAt(x: number, y: number, w: number, h: number): Entity | null {
    for (const e of this.entities) {
      if (e.kind === 'platform' && e.state === 'solid' && overlap(x, y, w, h, e.x, e.y, e.w, e.h)) return e;
      if (e.kind === 'anvil' && e.state === 'landed' && overlap(x, y, w, h, e.x, e.y, e.w, e.h)) return e;
    }
    return null;
  }

  private moveAxis(p: Player, delta: number, horizontal: boolean): boolean {
    let rem = delta;
    while (Math.abs(rem) > 1e-4) {
      const s = Math.sign(rem) * Math.min(1, Math.abs(rem));
      if (horizontal) p.x += s; else p.y += s;
      if (this.solidRect(p.x, p.y, p.w, p.h)) {
        if (horizontal) p.x -= s; else p.y -= s;
        return true;
      }
      rem -= s;
    }
    return false;
  }

  isInverted(p: Player) {
    return p.invertUntil === Infinity || p.invertUntil > this.time;
  }

  private updatePlayer(p: Player, dt: number) {
    if (p.dead) return;
    // PROP COMEDY: spring launch — no physics, no collisions, straight out of the game.
    if (p.launched) {
      p.launchT += dt;
      p.y -= (520 + p.launchT * 600) * dt;
      p.x += Math.sin(p.launchT * 9) * 30 * dt;
      p.runT += dt * 40; // spin
      if (Math.random() < dt * 25) this.particles.dust(p.x + p.w / 2, p.y + p.h, 1, 1);
      if (p.y < -26) {
        this.hudBounce++;
        this.sound('thud');
        this.shake(5, 300);
        this.kill(p, 'launched');
      }
      return;
    }
    // CO-OP BACKFIRE: inflating like a balloon while holding that heavy switch.
    if (p.inflateRate !== 0) {
      p.inflate = Math.max(0, Math.min(1, p.inflate + p.inflateRate * dt));
      if (p.inflate > 0.6 && Math.random() < dt * 6) this.sound('tick');
      if (p.inflate >= 1) {
        this.particles.burst(p.x + p.w / 2, p.y + p.h / 2, [PAL.orange, PAL.yellow, PAL.white, PAL.red], 60, 260);
        this.sound('poof');
        this.kill(p, 'popped');
        return;
      }
    }
    // FRIENDLY FIRE: the laser is useless against walls, lethal to partners.
    if (p.laser) {
      p.laserT += dt;
      const beam = this.laserBeam(p);
      const other = this.players[p.id === 1 ? 1 : 0];
      if (other && !other.dead && overlap(other.x, other.y, other.w, other.h, beam[0], beam[1], beam[2], beam[3])) {
        this.particles.burst(other.x + other.w / 2, other.y + other.h / 2, [PAL.red, PAL.orange, PAL.yellow], 30, 180);
        this.kill(other, 'laser');
        return;
      }
      if (Math.random() < dt * 30) {
        const ex = p.facing > 0 ? beam[0] + beam[2] : beam[0];
        this.particles.add({ x: ex, y: beam[1] + 1, vx: (Math.random() - 0.5) * 60, vy: -Math.random() * 60, life: 0.3, maxLife: 0.3, size: 1, color: PAL.red, grav: 300, drag: 0 });
      }
    }
    // Silent control swap: P1 hardware drives P2 avatar and vice versa.
    const srcId = (this.swapped ? (p.id === 1 ? 2 : 1) : p.id) as PlayerId;
    const b = this.input.get(srcId);
    const inv = this.isInverted(p);
    const left = inv ? b.right : b.left;
    const right = inv ? b.left : b.right;
    const dir = (right ? 1 : 0) - (left ? 1 : 0);
    const gs = p.gravScale < 0 ? -1 : 1;

    if (dir !== 0) {
      p.vx = approach(p.vx, dir * PHYS.runSpeed, (p.grounded ? PHYS.groundAccel : PHYS.airAccel) * dt);
      p.facing = dir as 1 | -1;
    } else {
      p.vx = approach(p.vx, 0, (p.grounded ? PHYS.groundFriction : PHYS.airFriction) * dt);
    }

    if (b.jump && !p.prevJump) p.jumpBuf = PHYS.jumpBuffer;
    p.prevJump = b.jump;
    p.jumpBuf -= dt;
    p.coyote = p.grounded ? PHYS.coyote : p.coyote - dt;
    if (p.jumpBuf > 0 && p.coyote > 0) {
      p.vy = -gs * PHYS.jumpSpeed;
      p.jumpBuf = 0; p.coyote = 0; p.grounded = false; p.jumping = true;
      p.squashX = 0.72; p.squashY = 1.32;
      this.sound('jump');
      this.particles.dust(p.x + p.w / 2, gs > 0 ? p.y + p.h : p.y, 4, gs);
    }
    if (p.jumping && !b.jump && p.vy * gs < 0) { p.vy *= PHYS.jumpCut; p.jumping = false; }
    if (p.vy * gs >= 0) p.jumping = false;

    p.vy += PHYS.gravity * p.gravScale * dt;
    if (p.vy * gs > PHYS.maxFall) p.vy = PHYS.maxFall * gs;

    if (this.moveAxis(p, p.vx * dt, true)) p.vx = 0;
    const fallSpeed = p.vy;
    if (this.moveAxis(p, p.vy * dt, false)) p.vy = 0;

    const was = p.grounded;
    p.grounded = this.solidRect(p.x, p.y + gs, p.w, p.h);
    p.standingOn = p.grounded ? this.platformAt(p.x, p.y + gs, p.w, p.h) : null;
    if (p.grounded && !was && fallSpeed * gs > 70) {
      p.squashX = 1.35; p.squashY = 0.68;
      this.sound('land');
      this.particles.dust(p.x + p.w / 2, gs > 0 ? p.y + p.h : p.y, 5, gs);
    }
    const k = Math.min(1, dt * 11);
    p.squashX += (1 - p.squashX) * k;
    p.squashY += (1 - p.squashY) * k;
    if (p.grounded && Math.abs(p.vx) > 20) {
      p.runT += dt * Math.abs(p.vx) / 18;
      if (Math.abs(p.vx) > 90 && Math.random() < dt * 7) this.particles.dust(p.x + p.w / 2 - p.facing * 4, gs > 0 ? p.y + p.h : p.y, 1, gs);
    } else p.runT = 0;
    p.spawnT = Math.min(1, p.spawnT + dt * 4);

    if (p.y > VIEW_H + 40 || p.y < -60 || p.x < -40 || p.x > VIEW_W + 40) this.kill(p, 'fall');
  }

  private onPlateRect(e: Entity, p: Player): boolean {
    return !p.dead && overlap(p.x, p.y, p.w, p.h, e.x + 1, e.y + e.h - 8, e.w - 2, 8);
  }

  private updatePlates() {
    for (const e of this.entities) {
      if (e.kind !== 'plate') continue;
      const was = e.pressed;
      e.pressed = this.players.some((p) => this.onPlateRect(e, p));
      if (e.pressed && !was) {
        this.sound('plate');
        this.particles.dust(e.x + e.w / 2, e.y + e.h, 6, 1);
      }
    }
  }

  private checkHazards() {
    for (const p of this.players) {
      if (p.dead) continue;
      const px = p.x + 1, py = p.y + 1, pw = p.w - 2, ph = p.h - 2;
      for (const e of this.entities) {
        if (e.kind === 'spikes' && e.state === 'up' && e.anim > 0.45) {
          const [sx, sy, sw, sh] = spikeRect(e);
          if (overlap(px, py, pw, ph, sx, sy, sw, sh)) { this.kill(p, 'spikes'); break; }
        } else if (e.kind === 'saw' && e.state !== 'off') {
          const r = (e.props.radius ?? 14) - 2;
          const cx = Math.max(px, Math.min(e.x, px + pw));
          const cy = Math.max(py, Math.min(e.y, py + ph));
          if ((cx - e.x) ** 2 + (cy - e.y) ** 2 < r * r) { this.kill(p, 'saw'); break; }
        } else if (e.kind === 'anvil' && e.state === 'falling') {
          // generous kill box while falling — anvils/pianos are meant to be feared
          if (overlap(px, py, pw, ph, e.x + 1, e.y, e.w - 2, e.h)) { this.kill(p, e.props.look === 'piano' ? 'piano' : 'anvil'); break; }
        } else if (e.kind === 'balloon' && e.state === 'on') {
          // ANTI-CLIMAX: the gentlest tap in the world
          if (Math.hypot(p.x + p.w / 2 - e.x, p.y + p.h / 2 - e.y) < 9) {
            this.particles.burst(e.x, e.y, [PAL.red, '#ff8fb3', PAL.white], 24, 120);
            e.state = 'off';
            this.sound('poof');
            this.kill(p, 'balloon');
            break;
          }
        } else if (e.kind === 'spring' && e.state !== 'off' && !p.launched) {
          if (p.vy >= 0 && overlap(p.x, p.y + p.h - 2, p.w, 4, e.x + 1, e.y + e.h - 8, e.w - 2, 8)) {
            e.anim = 1;
            this.launchPlayer(p.id);
            break;
          }
        } else if (e.kind === 'pickup' && e.state !== 'off') {
          if (overlap(px, py, pw, ph, e.x, e.y, e.w, e.h)) {
            e.state = 'off';
            this.particles.sparkle(e.x - 4, e.y - 4, e.w + 8, e.h + 8, 20, [PAL.red, PAL.yellow, PAL.white]);
            this.sound('unlock');
            this.giveLaser(p.id, true);
            this.say(`P${p.id} got a LASER! It does nothing to walls. Nothing.`, 2600);
          }
        }
      }
    }
  }

  /** Beam rect in front of the laser holder, stopped by solid tiles (max 7 tiles). */
  laserBeam(p: Player): [number, number, number, number] {
    const y = p.y + 6;
    let len = 0;
    const start = p.facing > 0 ? p.x + p.w : p.x;
    while (len < TILE * 7) {
      const x = p.facing > 0 ? start + len : start - len - 1;
      if (this.solidRect(x, y, 1, 2)) break;
      len += 2;
    }
    return p.facing > 0 ? [start, y, len, 2] : [start - len, y, len, 2];
  }

  private realExits(): Entity[] {
    return this.entities.filter((e) => e.kind === 'exit' && !e.props.fake && e.state !== 'off');
  }

  private checkExit(dt: number) {
    const exits = this.realExits();
    if (exits.length === 0) {
      this.exitCount = 0;
      this.exitT = 0;
      return;
    }
    let inside = 0;
    let focus: Entity = exits[0];
    for (const p of this.players) {
      if (p.dead) continue;
      const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
      for (const ex of exits) {
        if (cx >= ex.x && cx <= ex.x + ex.w && cy >= ex.y && cy <= ex.y + ex.h) {
          inside++;
          focus = ex;
          break;
        }
      }
    }
    this.exitCount = inside;
    if (inside === 2) {
      this.exitT += dt;
      if (this.exitT > 0.15) this.clearLevel(focus);
    } else this.exitT = 0;
  }

  private clearLevel(ex: Entity) {
    this.phase = 'cleared';
    this.phaseT = 0;
    this.sound('clear');
    this.flash(PAL.lime);
    this.particles.sparkle(ex.x - 8, ex.y - 8, ex.w + 16, ex.h + 16, 40);
    for (const p of this.players) {
      const c = playerColors(p.id);
      this.particles.burst(p.x + p.w / 2, p.y + p.h / 2, [c.body, c.hi, PAL.white], 16, 90);
    }
  }

  kill(p: Player, cause: DeathCause) {
    if (this.phase !== 'play' || p.dead) return;
    this.death = { pid: p.id, cause };
    this.deathCount++;
    this.phase = 'dying';
    this.phaseT = 0;
    for (const q of this.players) {
      q.dead = true;
      const c = playerColors(q.id);
      this.particles.burst(q.x + q.w / 2, q.y + q.h / 2, [c.body, c.hi, c.dark, PAL.white], q.id === p.id ? 36 : 22, q.id === p.id ? 190 : 120);
    }
    this.shake(8, 550);
    this.flash(PAL.red);
    this.sound('death');
  }

  // --------------------------------------------------------------- LogicHost
  playerInZone(zone: string, pid: PlayerId): boolean {
    const z = this.byId.get(zone);
    const p = this.players[pid - 1];
    if (!z || !p || p.dead) return false;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    return cx >= z.x && cx < z.x + z.w && cy >= z.y && cy < z.y + z.h;
  }

  plateHeld(plate: string): boolean {
    return !!this.byId.get(plate)?.pressed;
  }

  plateHeldBy(plate: string, pid: PlayerId): boolean {
    const e = this.byId.get(plate);
    const p = this.players[pid - 1];
    if (!e || !p) return false;
    return this.onPlateRect(e, p);
  }

  standingOn(target: string, pid: PlayerId): boolean {
    const p = this.players[pid - 1];
    return !!p && !p.dead && p.standingOn?.id === target;
  }

  entityState(id: string): EntityState | undefined {
    return this.byId.get(id)?.state;
  }

  setEntityState(id: string, state: EntityState, force = false) {
    const e = this.byId.get(id);
    if (!e || e.state === state) return;
    if (e.state === 'gone' && !force) return;
    const was = e.state;
    e.state = state;
    if (e.kind === 'anvil') {
      if (state === 'falling') e.vy = 0;
      if (state === 'idle') e.vy = 0;
      return;
    }
    if (e.kind === 'balloon' && state === 'on') {
      this.particles.poof(e.x, e.y, 10);
      this.sound('blip');
      return;
    }
    if (e.kind === 'exit') {
      if (state !== 'off' && was === 'off') {
        this.particles.sparkle(e.x - 4, e.y - 4, e.w + 8, e.h + 8, 20);
        this.sound('unlock');
      }
      return;
    }
    if (e.kind !== 'platform') return;
    if (state === 'gone') {
      this.particles.debris(e.x, e.y, e.w, e.h);
      return;
    }
    if (state === 'solid' && was !== 'solid') {
      this.particles.sparkle(e.x, e.y - 2, e.w, 4, Math.min(12, Math.max(4, e.w / 8)), [PAL.cyan, PAL.white]);
      // A platform materialising inside a player: nudge them on top or crush.
      for (const p of this.players) {
        if (p.dead || !overlap(p.x + 1, p.y + 1, p.w - 2, p.h - 2, e.x, e.y, e.w, e.h)) continue;
        const gs = p.gravScale < 0 ? -1 : 1;
        const ny = gs > 0 ? e.y - p.h : e.y + e.h;
        if (Math.abs(ny - p.y) <= 32 && !this.solidRect(p.x, ny, p.w, p.h)) {
          p.y = ny;
          p.squashX = 1.3; p.squashY = 0.7;
        } else this.kill(p, 'crushed');
      }
    }
  }

  dropEntity(id: string) {
    const e = this.byId.get(id);
    if (!e || e.kind !== 'anvil') return;
    if (e.state === 'falling' || e.state === 'landed') return;
    e.state = 'falling';
    e.vy = 0;
    e.motion = null;
    this.sound('rumble');
    this.shake(2, 200);
  }

  telegraph(id: string, ms: number) {
    const e = this.byId.get(id);
    if (e) e.shakeT = ms / 1000;
  }

  moveEntity(id: string, toTileX: number, toTileY: number, ms: number, easeKind: string) {
    const e = this.byId.get(id);
    if (!e) return;
    e.motion = { kind: 'tween', fromX: e.x, fromY: e.y, toX: toTileX * TILE, toY: toTileY * TILE, t: 0, dur: Math.max(0.001, ms / 1000), ease: easeKind };
  }

  railEntity(id: string, points: [number, number][], to: number, speed: number) {
    const e = this.byId.get(id);
    if (!e || !points.length) return;
    to = Math.max(0, Math.min(points.length - 1, to));
    let start: number;
    const m = e.motion;
    if (m && m.kind === 'rail' && m.points.length === points.length) {
      const cands = [m.idx, m.next].filter((i) => i >= 0);
      start = cands.reduce((a, b) => (Math.abs(b - to) < Math.abs(a - to) ? b : a), cands[0]);
    } else {
      start = 0;
      let best = Infinity;
      points.forEach(([px, py], i) => {
        const d = Math.hypot(px - e.x, py - e.y);
        if (d < best) { best = d; start = i; }
      });
    }
    const [tx, ty] = points[to];
    if (start === to && Math.hypot(tx - e.x, ty - e.y) < 0.5) { e.motion = null; return; }
    e.motion = { kind: 'rail', points, idx: -1, next: start, target: to, speed };
  }

  resetEntity(id: string) {
    const e = this.byId.get(id);
    if (!e) return;
    e.x = e.initial.x; e.y = e.initial.y; e.state = e.initial.state; e.motion = null; e.shakeT = 0;
    e.vy = 0;
  }

  clearInvert(pid: PlayerId) {
    const p = this.players[pid - 1];
    if (p) p.invertUntil = -1;
  }

  setSwapped(mode: 'on' | 'off' | 'toggle', ms?: number) {
    if (mode === 'toggle') this.swapped = !this.swapped;
    else this.swapped = mode === 'on';
    this.swapUntil = ms === undefined ? 0 : this.time + ms / 1000;
    // permanent swap (no ms) keeps swapUntil at 0 = never expires
    if (this.swapped && ms !== undefined && ms <= 0) this.swapped = false;
  }

  killPlayer(pid: PlayerId, cause: DeathCause = 'trap') {
    const p = this.players[pid - 1];
    if (p && !p.dead) this.kill(p, cause);
  }

  markPlayer(pid: PlayerId | null) {
    this.marked = pid;
  }

  markedPlayer(): PlayerId | null {
    return this.marked;
  }

  /** DELAYED SLAPSTICK: reposition the falling object directly over a player's CURRENT spot. */
  dropAbove(id: string, pid: PlayerId | null) {
    const e = this.byId.get(id);
    const p = pid ? this.players[pid - 1] : null;
    if (!e || !p || p.dead) return;
    e.x = Math.round(p.x + p.w / 2 - e.w / 2);
    e.y = Math.max(-e.h, Math.min(p.y - 90, e.y));
    e.motion = null;
    // little shadow warning is drawn by the renderer from the falling state
  }

  toppleEntity(id: string) {
    const e = this.byId.get(id);
    if (!e || e.kind !== 'exit' || e.state === 'falling' || e.state === 'landed') return;
    const alive = this.players.filter((p) => !p.dead);
    const cx = e.x + e.w / 2;
    const near = alive.length ? alive.reduce((a, b) => (Math.abs(a.x - cx) < Math.abs(b.x - cx) ? a : b)) : null;
    e.pathDir = near && near.x + near.w / 2 < cx ? -1 : 1;
    e.anim = 0;
    e.state = 'falling';
    this.sound('tick');
  }

  setInflate(pid: PlayerId, rate: number) {
    const p = this.players[pid - 1];
    if (!p) return;
    p.inflateRate = rate;
    if (rate > 0 && p.inflate === 0) this.sound('flip');
  }

  launchPlayer(pid: PlayerId) {
    const p = this.players[pid - 1];
    if (!p || p.dead || p.launched) return;
    p.launched = true;
    p.launchT = 0;
    p.vx = 0; p.vy = 0;
    p.squashX = 0.5; p.squashY = 1.6;
    this.sound('warp');
    this.shake(3, 200);
    this.particles.dust(p.x + p.w / 2, p.y + p.h, 12, 1);
    this.say('BOING!', 900);
  }

  giveLaser(pid: PlayerId, on: boolean) {
    const p = this.players[pid - 1];
    if (!p) return;
    p.laser = on;
    p.laserT = 0;
  }

  teleportPlayer(pid: PlayerId, toTileX: number, toTileY: number, keepVel = false) {
    const p = this.players[pid - 1];
    if (!p || p.dead || this.phase !== 'play') return;
    this.particles.poof(p.x + p.w / 2, p.y + p.h / 2, 14);
    p.x = toTileX * TILE + (TILE - p.w) / 2;
    p.y = toTileY * TILE + TILE - p.h;
    if (!keepVel) {
      p.vx = 0;
      p.vy = 0;
    }
    p.jumping = false;
    p.jumpBuf = 0;
    p.coyote = 0;
    this.particles.sparkle(p.x - 4, p.y - 4, p.w + 8, p.h + 8, 12, [PAL.cyan, PAL.white]);
    this.sound('warp');
    this.flash(PAL.cyan);
  }

  shake(power: number, ms = 350) {
    this.shakePower = Math.max(power, this.shakeT > 0 ? this.shakePower : 0);
    this.shakeDur = ms / 1000;
    this.shakeT = this.shakeDur;
  }

  flash(color = PAL.white) {
    this.flashColor = color;
    this.flashA = 0.55;
  }

  say(text: string, ms = 1800, style = 'troll') {
    if (style === 'info') {
      if (this.hintsSeen.has(text)) return;
      this.hintsSeen.add(text);
    }
    this.message = { text, until: this.time + ms / 1000, style };
  }

  particlesAt(id: string, kind: string) {
    const e = this.byId.get(id);
    if (!e) return;
    const isSaw = e.kind === 'saw';
    const x = isSaw ? e.x - e.w / 2 : e.x, y = isSaw ? e.y - e.h / 2 : e.y;
    if (kind === 'poof') this.particles.poof(x + e.w / 2, y + e.h / 2, 18);
    else if (kind === 'sparkle') this.particles.sparkle(x, y, e.w, e.h, 16);
    else this.particles.debris(x, y, e.w, e.h);
  }

  setInvert(pid: PlayerId, ms?: number) {
    const p = this.players[pid - 1];
    if (p) p.invertUntil = ms === undefined ? Infinity : this.time + ms / 1000;
  }

  setGravity(pid: PlayerId, scale: number) {
    const p = this.players[pid - 1];
    if (!p) return;
    if (Math.sign(p.gravScale) !== Math.sign(scale)) {
      p.vy *= 0.35;
      const c = playerColors(pid);
      this.particles.sparkle(p.x - 3, p.y - 3, p.w + 6, p.h + 6, 10, [c.hi, PAL.cyan]);
    }
    p.gravScale = scale;
  }
}
