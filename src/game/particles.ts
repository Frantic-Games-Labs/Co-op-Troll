import { PAL } from './constants';

export interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number;
  color: string; grav: number; drag: number;
}

const MAX = 450;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export class Particles {
  list: Particle[] = [];

  add(p: Particle) {
    if (this.list.length >= MAX) this.list.shift();
    this.list.push(p);
  }

  /** Small dust puffs at feet (jump / land). gs = gravity sign. */
  dust(x: number, y: number, n: number, gs: number) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: x + rnd(-4, 4), y, vx: rnd(-35, 35), vy: -gs * rnd(5, 30),
        life: rnd(0.2, 0.4), maxLife: 0.4, size: rnd(1, 2.5), color: PAL.grey, grav: 0, drag: 3,
      });
    }
  }

  /** Big colourful explosion (player death). */
  burst(x: number, y: number, colors: string[], n = 28, speed = 160) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(speed * 0.25, speed);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40,
        life: rnd(0.5, 1.0), maxLife: 1.0, size: rnd(1.5, 3.5),
        color: colors[i % colors.length], grav: 380, drag: 1.2,
      });
    }
  }

  /** Falling chunks when a platform crumbles. */
  debris(x: number, y: number, w: number, h: number) {
    const n = Math.min(40, Math.max(8, Math.floor((w * h) / 24)));
    for (let i = 0; i < n; i++) {
      this.add({
        x: rnd(x, x + w), y: rnd(y, y + h), vx: rnd(-30, 30), vy: rnd(-40, 20),
        life: rnd(0.5, 0.9), maxLife: 0.9, size: rnd(1.5, 3),
        color: i % 3 === 0 ? PAL.dark : PAL.slate, grav: 420, drag: 0.5,
      });
    }
  }

  /** Soft grey poof (something vanished). */
  poof(x: number, y: number, n = 14) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rnd(15, 60);
      this.add({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: rnd(0.3, 0.6), maxLife: 0.6, size: rnd(2, 4), color: PAL.grey, grav: -20, drag: 2.5,
      });
    }
  }

  /** Rising sparkles (reveal / unlock / level clear). */
  sparkle(x: number, y: number, w: number, h: number, n = 10, colors = [PAL.yellow, PAL.lime, PAL.white]) {
    for (let i = 0; i < n; i++) {
      this.add({
        x: rnd(x, x + w), y: rnd(y, y + h), vx: rnd(-15, 15), vy: rnd(-60, -20),
        life: rnd(0.4, 0.9), maxLife: 0.9, size: rnd(1, 2.5),
        color: colors[i % colors.length], grav: -10, drag: 1,
      });
    }
  }

  update(dt: number) {
    const out: Particle[] = [];
    for (const p of this.list) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.vy += p.grav * dt;
      const d = Math.max(0, 1 - p.drag * dt);
      p.vx *= d; p.vy *= d;
      p.x += p.vx * dt; p.y += p.vy * dt;
      out.push(p);
    }
    this.list = out;
  }

  draw(ctx: CanvasRenderingContext2D) {
    for (const p of this.list) {
      const k = p.life / p.maxLife;
      ctx.globalAlpha = k < 0.3 ? k / 0.3 : 1;
      ctx.fillStyle = p.color;
      const s = Math.max(1, Math.round(p.size * (0.5 + 0.5 * k)));
      ctx.fillRect(Math.round(p.x - s / 2), Math.round(p.y - s / 2), s, s);
    }
    ctx.globalAlpha = 1;
  }

  clear() {
    this.list = [];
  }
}
