import { COLS, ROWS, TILE, VIEW_W, VIEW_H, PAL, PIXEL_FONT } from './constants';
import { getPlayerSprite, type Frame } from './sprites';
import { spikeRect, type World } from './world';
import type { Entity, Player } from './types';

const TAU = Math.PI * 2;

export class Renderer {
  private staticCanvas = document.createElement('canvas');
  private staticFor = '';
  private stars: [number, number, number][] = [];

  constructor(private ctx: CanvasRenderingContext2D) {
    this.staticCanvas.width = VIEW_W;
    this.staticCanvas.height = VIEW_H;
    let s = 1337;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 80; i++) this.stars.push([Math.floor(rnd() * VIEW_W), Math.floor(rnd() * VIEW_H), rnd() * TAU]);
  }

  // ------------------------------------------------------------------ helpers
  private text(str: string, x: number, y: number, color: string, align: CanvasTextAlign = 'center', alpha = 1) {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `8px ${PIXEL_FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.fillText(str, Math.round(x), Math.round(y));
    ctx.restore();
  }

  private jitter(e: Entity) {
    return e.shakeT > 0 ? Math.round((Math.random() - 0.5) * 2.4) : 0;
  }

  // ------------------------------------------------------------ static layer
  private buildStatic(world: World) {
    const c = this.staticCanvas.getContext('2d')!;
    c.fillStyle = PAL.bg;
    c.fillRect(0, 0, VIEW_W, VIEW_H);
    const g = c.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, 'rgba(41,54,111,0.28)');
    g.addColorStop(1, 'rgba(18,19,31,0.55)');
    c.fillStyle = g;
    c.fillRect(0, 0, VIEW_W, VIEW_H);

    const solid = (x: number, y: number) => x < 0 || y < 0 || x >= COLS || y >= ROWS || !!world.solids[y * COLS + x];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (!world.solids[y * COLS + x]) continue;
        const px = x * TILE, py = y * TILE;
        c.fillStyle = PAL.dark;
        c.fillRect(px, py, TILE, TILE);
        if ((x * 7 + y * 13) % 4 === 0) {
          c.fillStyle = PAL.navy;
          c.fillRect(px + 3 + ((x * 3 + y) % 9), py + 4 + ((x + y * 5) % 8), 2, 2);
        }
        if (!solid(x, y - 1)) {
          c.fillStyle = PAL.slate; c.fillRect(px, py, TILE, 3);
          c.fillStyle = PAL.grey; c.fillRect(px, py, TILE, 1);
        }
        if (!solid(x - 1, y)) { c.fillStyle = PAL.slate; c.fillRect(px, py, 1, TILE); }
        if (!solid(x + 1, y)) { c.fillStyle = PAL.navy; c.fillRect(px + TILE - 1, py, 1, TILE); }
        if (!solid(x, y + 1)) { c.fillStyle = PAL.navy; c.fillRect(px, py + TILE - 1, TILE, 1); }
      }
    }
    this.staticFor = world.level.id;
  }

  // ------------------------------------------------------------------ render
  render(world: World) {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    if (this.staticFor !== world.level.id) this.buildStatic(world);
    ctx.fillStyle = PAL.bgDeep;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.save();
    ctx.translate(Math.round(world.shakeX), Math.round(world.shakeY));
    ctx.drawImage(this.staticCanvas, 0, 0);

    // twinkling stars (only over empty space)
    for (const [sx, sy, ph] of this.stars) {
      if (world.solids[Math.floor(sy / TILE) * COLS + Math.floor(sx / TILE)]) continue;
      ctx.globalAlpha = 0.25 + 0.3 * (0.5 + 0.5 * Math.sin(world.time * 1.7 + ph));
      ctx.fillStyle = PAL.slate;
      ctx.fillRect(sx, sy, 1, 1);
    }
    ctx.globalAlpha = 1;

    const es = world.entities;
    for (const e of es) if (e.kind === 'zone') this.drawZone(e, world.time);
    for (const e of es) if (e.kind === 'platform') this.drawPlatform(e, world.time);
    for (const e of es) if (e.kind === 'plate') this.drawPlate(e);
    for (const e of es) if (e.kind === 'spikes') this.drawSpikes(e);
    for (const e of es) if (e.kind === 'exit') this.drawExit(e, world);
    for (const e of es) if (e.kind === 'sign') this.drawSign(e, world);
    for (const e of es) if (e.kind === 'spring') this.drawSpring(e);
    for (const e of es) if (e.kind === 'pickup') this.drawPickup(e, world.time);
    for (const p of world.players) if (p.laser && !p.dead) this.drawLaser(p, world);
    for (const p of world.players) this.drawPlayer(p, world);
    for (const e of es) if (e.kind === 'saw') this.drawSaw(e);
    for (const e of es) if (e.kind === 'anvil') this.drawAnvil(e);
    for (const e of es) if (e.kind === 'balloon') this.drawBalloon(e);
    world.particles.draw(ctx);
    ctx.restore();

    if (world.flashA > 0) {
      ctx.globalAlpha = world.flashA;
      ctx.fillStyle = world.flashColor;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      ctx.globalAlpha = 1;
    }
  }

  private drawZone(e: Entity, t: number) {
    const ctx = this.ctx;
    if (e.props.look === 'ledge') {
      const pulse = 0.5 + 0.5 * Math.sin(t * 4 + e.t);
      ctx.globalAlpha = 0.18 + 0.15 * pulse;
      ctx.fillStyle = PAL.yellow;
      ctx.fillRect(e.x - 2, e.y + e.h - 6, e.w + 4, 8);
      ctx.globalAlpha = 0.6 + 0.4 * pulse;
      ctx.fillRect(e.x, e.y + e.h - 2, e.w, 2);
      ctx.globalAlpha = 1;
    } else if (e.props.look === 'well') {
      const on = e.state === 'on';
      ctx.fillStyle = on ? 'rgba(115,239,247,0.10)' : 'rgba(93,39,93,0.30)';
      ctx.fillRect(e.x, e.y, e.w, e.h);
      ctx.save();
      ctx.strokeStyle = on ? PAL.cyan : PAL.purple;
      ctx.globalAlpha = 0.5;
      ctx.setLineDash([3, 3]);
      ctx.lineDashOffset = -t * 12;
      ctx.strokeRect(e.x + 0.5, e.y + 0.5, e.w - 1, e.h - 1);
      ctx.restore();
      this.text(on ? 'GRAVITY FLIPPED' : 'GRAVITY NORMAL', e.x + e.w / 2, e.y + e.h / 2 - 4, on ? PAL.cyan : PAL.purple, 'center', 0.55);
    }
  }

  private drawPlatform(e: Entity, t: number) {
    const ctx = this.ctx;
    if (e.state === 'gone') return;
    const x = Math.round(e.x) + this.jitter(e), y = Math.round(e.y) + this.jitter(e);
    const { w, h } = e;
    // Invisible walls: solid but unseen (faint shimmer only while telegraphed)
    if (e.props.look === 'invisible' && e.state === 'solid') {
      if (e.shakeT > 0) {
        ctx.save();
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = PAL.cyan;
        ctx.setLineDash([2, 2]);
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.restore();
      }
      return;
    }
    if (e.state === 'off') {
      if (e.props.hidden) return;
      if (e.props.look === 'invisible') return;
      ctx.save();
      ctx.globalAlpha = 0.3 + 0.12 * Math.sin(t * 3 + e.t);
      ctx.strokeStyle = PAL.blue;
      ctx.setLineDash([2, 2]);
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      ctx.restore();
      return;
    }
    switch (e.props.look) {
      case 'bridge':
        ctx.fillStyle = PAL.slate; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.dark;
        for (let i = 8; i < w; i += 8) ctx.fillRect(x + i, y, 1, h);
        ctx.fillStyle = PAL.grey; ctx.fillRect(x, y, w, 1);
        break;
      case 'glow': {
        const pulse = 0.5 + 0.5 * Math.sin(t * 5 + e.t);
        ctx.globalAlpha = 0.25 + 0.25 * pulse;
        ctx.fillStyle = PAL.cyan; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = PAL.teal; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.cyan; ctx.fillRect(x, y, w, 2);
        break;
      }
      case 'door':
        ctx.fillStyle = PAL.dark; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.grey;
        for (let i = 2; i < w; i += 5) ctx.fillRect(x + i, y + 1, 2, h - 2);
        ctx.fillStyle = PAL.red; ctx.fillRect(x, y + Math.floor(h / 2) - 1, w, 2);
        break;
      case 'seal':
        ctx.fillStyle = PAL.purple; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.red;
        ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y + h - 2, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
        ctx.fillStyle = PAL.white;
        ctx.fillRect(x + w / 2 - 3, y + h / 2 - 7, 6, 6);
        ctx.fillRect(x + w / 2 - 1, y + h / 2 - 2, 2, 7);
        ctx.fillStyle = PAL.purple; ctx.fillRect(x + w / 2 - 1, y + h / 2 - 5, 2, 2);
        break;
      case 'crusher': {
        // A MASSIVE TERRIFYING SPIKE CRUSHER (results may vary)
        ctx.fillStyle = PAL.purple; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.red; ctx.fillRect(x, y, w, 2); ctx.fillRect(x, y, 2, h); ctx.fillRect(x + w - 2, y, 2, h);
        ctx.fillStyle = PAL.dark;
        for (let i = 4; i < w - 4; i += 6) ctx.fillRect(x + i, y + 4, 2, h - 8);
        for (let i = 0; i < w; i += 8) {
          for (let j = 0; j < 7; j++) {
            const hw = Math.max(1, 4 - Math.floor(j * 0.6));
            ctx.fillStyle = j === 6 ? PAL.white : PAL.grey;
            ctx.fillRect(x + i + 4 - hw, y + h + j, hw * 2, 1);
          }
        }
        if (e.shakeT > 0) {
          ctx.fillStyle = Math.sin(t * 30) > 0 ? PAL.red : PAL.yellow;
          ctx.fillRect(x + w / 2 - 2, y + h / 2 - 2, 4, 4);
          this.text('!!!', x + w / 2, y - 10, PAL.red);
        }
        break;
      }
      default:
        ctx.fillStyle = PAL.slate; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = PAL.grey; ctx.fillRect(x, y, w, 1);
        ctx.fillStyle = PAL.dark; ctx.fillRect(x, y + h - 1, w, 1);
    }
  }

  /** Plates are deliberately anonymous: same plain slab as a floor tile, no
   *  letters, no hazard stripes. Players must work out what each one does. */
  private drawPlate(e: Entity) {
    const ctx = this.ctx;
    const raise = Math.round((1 - e.pressT) * 3);
    const base = e.y + e.h;
    const isGreen = e.props.look === 'greenBtn';
    const idleCol = isGreen ? PAL.lime : PAL.slate;
    const pressCol = isGreen ? PAL.green : PAL.grey;
    ctx.fillStyle = PAL.dark; ctx.fillRect(e.x + 2, base - 3, e.w - 4, 3);
    ctx.fillStyle = e.pressed ? pressCol : idleCol; ctx.fillRect(e.x + 1, base - 4 - raise, e.w - 2, 3);
    ctx.globalAlpha = 0.5; ctx.fillStyle = PAL.white; ctx.fillRect(e.x + 2, base - 4 - raise, e.w - 4, 1); ctx.globalAlpha = 1;
    if (isGreen) {
      const pulse = 0.5 + 0.5 * Math.sin(e.t * 6);
      ctx.globalAlpha = 0.22 + 0.28 * pulse;
      ctx.fillStyle = PAL.lime;
      ctx.fillRect(e.x - 1, e.y + e.h - 8, e.w + 2, 8);
      ctx.globalAlpha = 1;
    }
  }

  private drawSpikes(e: Entity) {
    const ctx = this.ctx;
    const down = e.props.dir === 'down';
    const jx = this.jitter(e);
    // hidden spikes stay fully invisible while retracted — pure betrayal
    if (e.props.hidden && e.state === 'down' && e.anim < 0.05 && e.shakeT <= 0) return;
    // base strip + nubs (visible even when retracted -> a fair hint, unless hidden)
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(e.x, down ? e.y : e.y + e.h - 2, e.w, 2);
    ctx.fillStyle = PAL.red;
    for (let i = 3; i < e.w; i += 8) ctx.fillRect(e.x + i + jx, down ? e.y + 1 : e.y + e.h - 3, 2, 1);
    const depth = spikeRect(e)[3];
    if (depth <= 0) return;
    for (let i = 0; i < e.w; i += 8) {
      const bx = e.x + i + jx;
      for (let j = 0; j < depth; j++) {
        const hw = Math.max(1, Math.round(4 * (1 - j / depth)));
        const yy = down ? e.y + j : e.y + e.h - 1 - j;
        ctx.fillStyle = j === depth - 1 ? PAL.white : PAL.orange;
        ctx.fillRect(Math.round(bx + 4 - hw), yy, hw, 1);
        ctx.fillStyle = j === depth - 1 ? PAL.white : PAL.red;
        ctx.fillRect(Math.round(bx + 4), yy, hw, 1);
      }
    }
  }

  private drawExit(e: Entity, world: World) {
    const ctx = this.ctx;
    // hidden real exits stay invisible until a plan reveals them
    if (e.state === 'off') return;
    const x = Math.round(e.x), y = Math.round(e.y);
    const { w, h } = e;
    const jx = this.jitter(e);
    // PROP COMEDY: 2D cardboard cutout door — topples over like a stage flat
    if (e.props.cardboard && (e.state === 'falling' || e.state === 'landed')) {
      const k = e.anim < 1 ? e.anim * e.anim : 1;
      const dir = e.pathDir || 1;
      ctx.save();
      ctx.translate(dir > 0 ? x + w : x, y + h);
      ctx.rotate(dir * k * Math.PI / 2);
      const ox = dir > 0 ? -w : 0;
      // cardboard back shows once it's tilted
      ctx.fillStyle = k > 0.5 ? '#b08858' : PAL.green;
      ctx.fillRect(ox, -h, w, h);
      if (k > 0.5) {
        ctx.fillStyle = '#8a6a44'; ctx.fillRect(ox + 2, -h + 2, w - 4, 2); ctx.fillRect(ox + 2, -h + 6, w - 4, 2);
        ctx.fillStyle = PAL.dark; ctx.fillRect(ox + w / 2 - 1, -h, 2, h);
      } else {
        ctx.fillStyle = PAL.lime; ctx.fillRect(ox, -h, w, 2);
        ctx.fillStyle = PAL.bg; ctx.fillRect(ox + 3, -h + 4, w - 6, h - 4);
      }
      ctx.restore();
      if (e.state === 'landed') this.text('*thud*', x + w / 2, y - 6, PAL.grey, 'center', 0.8);
      return;
    }
    if (e.motion) {
      const ph = Math.floor(e.t * 18) % 2;
      ctx.fillStyle = PAL.green;
      ctx.fillRect(x + 4, y + h, 2, 4 + ph * 2);
      ctx.fillRect(x + w - 6, y + h, 2, 6 - ph * 2);
    }
    ctx.fillStyle = PAL.green; ctx.fillRect(x + jx, y, w, h);
    ctx.fillStyle = PAL.lime; ctx.fillRect(x + jx, y, w, 2);
    ctx.fillStyle = PAL.bg; ctx.fillRect(x + jx + 3, y + 4, w - 6, h - 4);
    if (world.exitCount > 0 && !e.props.fake) {
      ctx.globalAlpha = 0.25 + 0.15 * Math.sin(world.time * 8);
      ctx.fillStyle = PAL.lime; ctx.fillRect(x + jx + 3, y + 4, w - 6, h - 4);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = Math.sin(e.t * 6) > 0 ? PAL.yellow : PAL.orange;
    ctx.fillRect(x + jx + w / 2 - 1, y + 2, 2, 2);
    this.text('EXIT', x + w / 2, y - 10, PAL.lime, 'center', 0.9);
    if (world.exitCount === 1 && world.phase === 'play' && !e.props.fake && Math.sin(world.time * 10) > -0.3) {
      this.text('1/2', x + w / 2, y - 20, PAL.white);
    }
  }

  /** Springs are disguised as an utterly ordinary block of floor — no pad, no
   *  label, no coil. It just looks like somewhere safe to stand. */
  private drawSpring(e: Entity) {
    const ctx = this.ctx;
    if (e.state === 'off') return;
    const x = Math.round(e.x), y = Math.round(e.y);
    const { w, h } = e;
    ctx.fillStyle = PAL.slate; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.grey; ctx.fillRect(x, y, w, 1);
    ctx.fillStyle = PAL.dark; ctx.fillRect(x, y + h - 1, w, 1);
  }

  private drawPickup(e: Entity, t: number) {
    const ctx = this.ctx;
    if (e.state === 'off') return;
    const bob = Math.round(Math.sin(t * 4) * 2);
    const x = Math.round(e.x) + 2, y = Math.round(e.y) + 4 + bob;
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 6);
    ctx.fillStyle = PAL.red; ctx.fillRect(x - 3, y - 3, 18, 14);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.slate; ctx.fillRect(x, y + 2, 12, 5);
    ctx.fillStyle = PAL.dark; ctx.fillRect(x + 2, y + 7, 3, 4);
    ctx.fillStyle = PAL.red; ctx.fillRect(x + 12, y + 3, 2, 3);
    ctx.fillStyle = PAL.yellow; ctx.fillRect(x + 4, y, 6, 2);
    this.text('FREE LASER', e.x + e.w / 2, e.y - 10, PAL.red, 'center', 0.9);
  }

  private drawLaser(p: Player, world: World) {
    const ctx = this.ctx;
    const [bx, by, bw, bh] = world.laserBeam(p);
    if (bw <= 0) return;
    const flick = Math.sin(p.laserT * 40) > 0;
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = PAL.red; ctx.fillRect(bx, by - 1, bw, bh + 2);
    ctx.globalAlpha = 1;
    ctx.fillStyle = flick ? PAL.white : PAL.yellow; ctx.fillRect(bx, by, bw, bh);
    // harmless sparks at the wall
    const ex = p.facing > 0 ? bx + bw : bx;
    ctx.fillStyle = PAL.orange; ctx.fillRect(ex - 1, by - 1, 2, 4);
  }

  private drawBalloon(e: Entity) {
    const ctx = this.ctx;
    if (e.state !== 'on') return;
    const x = Math.round(e.x), y = Math.round(e.y + Math.sin(e.t * 4) * 1.5);
    // string
    ctx.fillStyle = PAL.grey;
    for (let i = 0; i < 10; i++) ctx.fillRect(x + Math.round(Math.sin(e.t * 5 + i) * 1), y + 7 + i, 1, 1);
    // body
    ctx.fillStyle = '#ff6fa3';
    ctx.beginPath(); ctx.ellipse(x, y, 7, 8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff8fb3';
    ctx.beginPath(); ctx.ellipse(x - 2, y - 3, 2, 3, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.white; ctx.fillRect(x - 3, y - 1, 1, 1); ctx.fillRect(x + 2, y - 1, 1, 1);
    // smug little face
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
    ctx.fillRect(x - 2, y + 2, 4, 1);
    ctx.fillRect(x - 1, y + 8, 2, 2);
  }

  private drawAnvil(e: Entity) {
    const ctx = this.ctx;
    if (e.state === 'off' || e.state === 'gone') return;
    const x = Math.round(e.x) + this.jitter(e);
    const y = Math.round(e.y);
    const { w, h } = e;
    if (e.props.look === 'piano') {
      // drop shadow warning
      if (e.state === 'falling') {
        ctx.globalAlpha = 0.35; ctx.fillStyle = PAL.dark;
        ctx.fillRect(x - 2, y + h + 4, w + 4, 2); ctx.globalAlpha = 1;
      }
      ctx.fillStyle = PAL.dark; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = PAL.bgDeep; ctx.fillRect(x, y, w, 3);
      ctx.fillStyle = PAL.white; ctx.fillRect(x + 1, y + h - 6, w - 2, 5);
      ctx.fillStyle = PAL.dark;
      for (let i = 3; i < w - 2; i += 4) ctx.fillRect(x + i, y + h - 6, 2, 3);
      ctx.fillStyle = PAL.yellow; ctx.fillRect(x + 2, y + 5, 2, 2);
      if (e.state === 'idle') { ctx.fillStyle = PAL.slate; for (let cy = y - 24; cy < y; cy += 4) ctx.fillRect(x + w / 2 - 1, cy, 2, 2); }
      if (e.state === 'falling') { ctx.fillStyle = PAL.white; this.text('♪', x + w + 2, y - 4, PAL.white, 'left', 0.9); }
      return;
    }
    // hanging chain while idle
    if (e.state === 'idle') {
      ctx.fillStyle = PAL.slate;
      for (let cy = y - 20; cy < y; cy += 4) ctx.fillRect(x + w / 2 - 1, cy, 2, 2);
    }
    // motion streaks while falling
    if (e.state === 'falling') {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = PAL.grey;
      ctx.fillRect(x + 2, y - 10, 2, 10);
      ctx.fillRect(x + w - 4, y - 14, 2, 14);
      ctx.globalAlpha = 1;
    }
    // anvil body — heavy dark block with steel top
    ctx.fillStyle = PAL.dark;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = PAL.slate;
    ctx.fillRect(x, y, w, 4);
    ctx.fillStyle = PAL.grey;
    ctx.fillRect(x, y, w, 1);
    ctx.fillRect(x + 2, y + 6, w - 4, 2);
    // warning stripes
    ctx.fillStyle = PAL.yellow;
    for (let i = 2; i < w - 2; i += 6) {
      ctx.fillRect(x + i, y + h - 3, 3, 2);
    }
    ctx.fillStyle = PAL.red;
    ctx.fillRect(x + w / 2 - 2, y + 9, 4, 4);
    ctx.fillStyle = PAL.white;
    ctx.fillRect(x + w / 2 - 1, y + 10, 2, 2);
  }

  private drawSign(e: Entity, world: World) {
    const ctx = this.ctx;
    const x = Math.round(e.x), y = Math.round(e.y);
    ctx.fillStyle = PAL.slate; ctx.fillRect(x + 7, y + 6, 2, 10);
    ctx.fillStyle = PAL.dark; ctx.fillRect(x + 2, y + 2, 12, 7);
    ctx.fillStyle = PAL.yellow; ctx.fillRect(x + 3, y + 3, 10, 5);
    ctx.fillStyle = PAL.dark; ctx.fillRect(x + 7, y + 4, 2, 2); ctx.fillRect(x + 7, y + 7, 2, 1);
    const near = world.players.some((p) => !p.dead && Math.abs(p.x + p.w / 2 - (x + 8)) < 30 && Math.abs(p.y + p.h - (y + TILE)) < 40);
    if (!near || !e.props.text) return;
    ctx.font = `8px ${PIXEL_FONT}`;
    const tw = Math.ceil(ctx.measureText(e.props.text).width) + 8;
    const bx = Math.max(2, Math.min(VIEW_W - tw - 2, x + 8 - tw / 2));
    const by = y - 18;
    ctx.globalAlpha = 0.92; ctx.fillStyle = PAL.bg; ctx.fillRect(bx, by, tw, 15); ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.white;
    ctx.fillRect(bx, by, tw, 1); ctx.fillRect(bx, by + 14, tw, 1); ctx.fillRect(bx, by, 1, 15); ctx.fillRect(bx + tw - 1, by, 1, 15);
    ctx.fillRect(x + 7, by + 15, 2, 2);
    this.text(e.props.text, bx + 4, by + 4, PAL.white, 'left');
  }

  private drawPlayer(p: Player, world: World) {
    if (p.dead) return;
    const ctx = this.ctx;
    const gs = p.gravScale < 0 ? -1 : 1;
    const frame: Frame = !p.grounded ? 'jump' : Math.abs(p.vx) > 20 ? (Math.floor(p.runT) % 2 === 0 ? 'run1' : 'run2') : 'idle';
    const blink = (world.time + p.id * 1.3) % 3.7 < 0.12;
    const spr = getPlayerSprite(p.id, frame, p.facing, blink);
    const grow = 0.4 + 0.6 * p.spawnT;
    // CO-OP BACKFIRE: inflating like a balloon (wobble near the pop)
    const inf = 1 + p.inflate * 2.2 + (p.inflate > 0.7 ? Math.sin(world.time * 40) * 0.08 : 0);
    ctx.save();
    ctx.translate(Math.round(p.x + p.w / 2), Math.round(gs > 0 ? p.y + p.h : p.y));
    if (p.launched) ctx.rotate(p.runT * 0.25);
    ctx.scale(p.squashX * grow * inf, p.squashY * gs * grow * (1 + p.inflate * 1.4));
    ctx.drawImage(spr, -5, -14);
    ctx.restore();
    if (p.inflate > 0.25) {
      ctx.globalAlpha = Math.min(1, (p.inflate - 0.25) * 2);
      this.text(p.inflate > 0.8 ? 'POP INCOMING' : 'inflating...', p.x + p.w / 2, p.y - 24 - p.inflate * 16, PAL.orange);
      ctx.globalAlpha = 1;
    }
    if (p.laser) {
      const lx = Math.round(p.facing > 0 ? p.x + p.w - 2 : p.x - 6);
      ctx.fillStyle = PAL.slate; ctx.fillRect(lx, Math.round(p.y + 5), 8, 3);
      ctx.fillStyle = PAL.red; ctx.fillRect(p.facing > 0 ? lx + 7 : lx, Math.round(p.y + 6), 1, 1);
    }
    if (world.isInverted(p)) {
      const bob = Math.round(Math.sin(world.time * 8));
      const ty = (gs > 0 ? p.y - 9 : p.y + p.h + 4) + bob;
      const x = Math.round(p.x);
      ctx.fillStyle = Math.sin(world.time * 12) > 0 ? PAL.yellow : PAL.orange;
      ctx.fillRect(x - 1, ty + 1, 1, 1); ctx.fillRect(x, ty, 1, 3); ctx.fillRect(x + 1, ty + 1, 3, 1);
      ctx.fillRect(x + 6, ty + 1, 3, 1); ctx.fillRect(x + 9, ty, 1, 3); ctx.fillRect(x + 10, ty + 1, 1, 1);
    }
  }

  private drawSaw(e: Entity) {
    const ctx = this.ctx;
    if (e.state === 'off') return;
    const r = e.props.radius ?? 14;
    if (e.props.path && e.props.path.length > 1) {
      ctx.save();
      ctx.strokeStyle = PAL.dark;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(e.props.path[0][0], e.props.path[0][1]);
      for (const [px, py] of e.props.path) ctx.lineTo(px, py);
      ctx.stroke();
      ctx.restore();
    }
    e.trail.forEach(([tx, ty], i) => {
      ctx.globalAlpha = (0.12 * (i + 1)) / e.trail.length;
      ctx.fillStyle = PAL.grey;
      ctx.beginPath(); ctx.arc(tx, ty, r - 3, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(Math.round(e.x), Math.round(e.y));
    ctx.rotate(e.angle);
    ctx.fillStyle = PAL.grey;
    ctx.beginPath();
    const teeth = 10;
    for (let i = 0; i < teeth * 2; i++) {
      const a = (i * Math.PI) / teeth;
      const rr = i % 2 === 0 ? r : r - 4;
      if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PAL.slate; ctx.beginPath(); ctx.arc(0, 0, r - 6, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.red; ctx.beginPath(); ctx.arc(0, 0, r - 9, 0, TAU); ctx.fill();
    ctx.fillStyle = PAL.dark; ctx.beginPath(); ctx.arc(0, 0, 2.5, 0, TAU); ctx.fill();
    ctx.restore();
  }
}
