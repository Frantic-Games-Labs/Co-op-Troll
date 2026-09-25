// ---------------------------------------------------------------------------
// LogicRunner: interprets "micro-action logic plans".
//
// Every trap / puzzle in the game is described as data:
//   when:  a (possibly nested) condition evaluated every tick
//   do:    a sequence of micro-actions launched on the rising edge
//   else:  a sequence launched on the falling edge
// Sequences run concurrently, can wait, loop (goto), emit events for other
// plans, set flags, and drive entity state through a small host interface.
// Deliberate delays (wait), per-player zone evaluation (inZone p1/p2,
// standingOn who, airborne who) and contradictory simultaneous actions are
// all first-class: a single plan can invert P1 while swapping both, drop an
// anvil, kill whoever is in a fake exit, and teleport the survivor.
// ---------------------------------------------------------------------------
import type { Condition, DeathCause, EntityState, MicroAction, Plan, PlayerId, SoundName, Target, Who } from './types';

export interface LogicHost {
  time: number;
  playerInZone(zone: string, pid: PlayerId): boolean;
  plateHeld(plate: string): boolean;
  plateHeldBy(plate: string, pid: PlayerId): boolean;
  standingOn(target: string, pid: PlayerId): boolean;
  entityState(id: string): EntityState | undefined;
  isSwapped(): boolean;
  isAirborne(pid: PlayerId): boolean;
  isGrounded(pid: PlayerId): boolean;
  setEntityState(id: string, state: EntityState, force?: boolean): void;
  telegraph(id: string, ms: number): void;
  moveEntity(id: string, toTileX: number, toTileY: number, ms: number, ease: string): void;
  railEntity(id: string, points: [number, number][], to: number, speed: number): void;
  dropEntity(id: string): void;
  resetEntity(id: string): void;
  shake(power: number, ms?: number): void;
  flash(color?: string): void;
  say(text: string, ms?: number, style?: string): void;
  sound(name: SoundName): void;
  particlesAt(id: string, kind: string): void;
  setInvert(pid: PlayerId, ms?: number): void;
  clearInvert(pid: PlayerId): void;
  setSwapped(mode: 'on' | 'off' | 'toggle', ms?: number): void;
  setGravity(pid: PlayerId, scale: number): void;
  killPlayer(pid: PlayerId, cause?: DeathCause): void;
  teleportPlayer(pid: PlayerId, toTileX: number, toTileY: number, keepVel?: boolean): void;
  alivePlayers(): PlayerId[];
  markPlayer(pid: PlayerId | null): void;
  markedPlayer(): PlayerId | null;
  dropAbove(id: string, pid: PlayerId | null): void;
  toppleEntity(id: string): void;
  setInflate(pid: PlayerId, rate: number): void;
  launchPlayer(pid: PlayerId): void;
  giveLaser(pid: PlayerId, on: boolean): void;
}

interface Sequence {
  planId: string;
  actions: MicroAction[];
  pc: number;
  wait: number;
  isElse: boolean;
  done: boolean;
}

interface PlanState {
  prev: boolean;
  fired: boolean;
  cooldownUntil: number;
  seq: Sequence | null;
}

const targets = (t: Target): string[] => (Array.isArray(t) ? t : [t]);

export class LogicRunner {
  private st = new Map<string, PlanState>();
  private seqs: Sequence[] = [];
  private events = new Set<string>();
  private pendingEvents = new Set<string>();
  flags: Record<string, number> = {};

  constructor(private plans: Plan[]) {
    for (const p of plans) this.st.set(p.id, { prev: false, fired: false, cooldownUntil: 0, seq: null });
  }

  update(dt: number, host: LogicHost) {
    // 1) Evaluate every plan's condition and react to edges
    for (const plan of this.plans) {
      const s = this.st.get(plan.id)!;
      const now = this.evaluate(plan.when, host);
      if (now && !s.prev) {
        const blocked = (plan.once && s.fired) || host.time < s.cooldownUntil;
        if (!blocked) {
          s.fired = true;
          s.cooldownUntil = host.time + (plan.cooldownMs ?? 0) / 1000;
          this.launch(plan, plan.do, false, s);
        }
      } else if (!now && s.prev) {
        if (plan.else) this.launch(plan, plan.else, true, s);
        else if (plan.interrupt && s.seq && !s.seq.isElse) {
          s.seq.done = true;
          s.seq = null;
        }
      }
      s.prev = now;
    }
    // 2) Step all running sequences
    for (const seq of this.seqs) if (!seq.done) this.step(seq, dt, host);
    this.seqs = this.seqs.filter((s) => !s.done);
    // 3) Events emitted this tick become visible next tick
    this.events = this.pendingEvents;
    this.pendingEvents = new Set();
  }

  private launch(plan: Plan, actions: MicroAction[], isElse: boolean, s: PlanState) {
    if (s.seq) s.seq.done = true;
    const seq: Sequence = { planId: plan.id, actions, pc: 0, wait: 0, isElse, done: false };
    s.seq = seq;
    this.seqs.push(seq);
  }

  private step(seq: Sequence, dt: number, host: LogicHost) {
    if (seq.wait > 0) {
      seq.wait -= dt;
      if (seq.wait > 0) return;
    }
    let guard = 0;
    while (seq.pc < seq.actions.length && guard++ < 64) {
      const a = seq.actions[seq.pc++];
      const w = this.exec(a, seq, host);
      if (w > 0) {
        seq.wait = w;
        return;
      }
    }
    if (seq.pc >= seq.actions.length) seq.done = true;
  }

  /** Resolve a Who selector to concrete player ids, optionally filtered by zone. */
  private resolveWho(who: Who, zone: string | undefined, host: LogicHost): PlayerId[] {
    let pids: PlayerId[];
    if (who === 'p1') pids = [1];
    else if (who === 'p2') pids = [2];
    else if (who === 'both') pids = [1, 2];
    else {
      // 'any': prefer players actually inside the zone when one is given,
      // otherwise fall back to all alive players.
      if (zone) {
        pids = ([1, 2] as PlayerId[]).filter((pid) => host.playerInZone(zone, pid));
        if (pids.length === 0) pids = host.alivePlayers();
      } else {
        pids = host.alivePlayers();
      }
    }
    if (zone && who !== 'any') pids = pids.filter((pid) => host.playerInZone(zone, pid));
    return pids;
  }

  /** Executes one micro-action; returns seconds to wait before continuing. */
  private exec(a: MicroAction, seq: Sequence, host: LogicHost): number {
    switch (a.act) {
      case 'wait':
        return a.ms / 1000;
      case 'set':
        for (const id of targets(a.target)) host.setEntityState(id, a.state, a.force);
        return 0;
      case 'telegraph':
        for (const id of targets(a.target)) host.telegraph(id, a.ms);
        host.sound('tick');
        return a.ms / 1000;
      case 'move':
        for (const id of targets(a.target)) host.moveEntity(id, a.to[0], a.to[1], a.ms, a.ease ?? 'inOut');
        return 0;
      case 'rail':
        host.railEntity(a.target, a.points, a.to, a.speed);
        return 0;
      case 'drop': {
        let pid: PlayerId | null = null;
        if (a.above === 'marked') pid = host.markedPlayer();
        else if (a.above) pid = this.resolveWho(a.above, undefined, host)[0] ?? null;
        for (const id of targets(a.target)) {
          if (a.above) host.dropAbove(id, pid);
          host.dropEntity(id);
        }
        return 0;
      }
      case 'mark': {
        const pid = this.resolveWho(a.who ?? 'any', a.zone, host)[0] ?? null;
        host.markPlayer(pid);
        return 0;
      }
      case 'topple':
        for (const id of targets(a.target)) host.toppleEntity(id);
        return 0;
      case 'inflate':
        for (const pid of this.resolveWho(a.who, a.zone, host)) host.setInflate(pid, a.rate);
        return 0;
      case 'launch':
        for (const pid of this.resolveWho(a.who, a.zone, host)) host.launchPlayer(pid);
        return 0;
      case 'giveLaser':
        for (const pid of this.resolveWho(a.who, a.zone, host)) host.giveLaser(pid, a.on ?? true);
        return 0;
      case 'shake':
        host.shake(a.power, a.ms);
        return 0;
      case 'flash':
        host.flash(a.color);
        return 0;
      case 'invert':
        for (const pid of this.whoList(a.who, host)) host.setInvert(pid, a.ms);
        return 0;
      case 'unInvert':
        for (const pid of this.whoList(a.who, host)) host.clearInvert(pid);
        return 0;
      case 'swap':
        host.setSwapped(a.mode ?? 'toggle', a.ms);
        return 0;
      case 'gravity':
        for (const pid of this.whoList(a.who, host)) host.setGravity(pid, a.scale);
        return 0;
      case 'kill':
        for (const pid of this.resolveWho(a.who, a.zone, host)) host.killPlayer(pid, a.cause ?? 'trap');
        return 0;
      case 'teleport':
        for (const pid of this.resolveWho(a.who, a.zone, host))
          host.teleportPlayer(pid, a.to[0], a.to[1], a.keepVel);
        return 0;
      case 'say':
        host.say(a.text, a.ms, a.style);
        return 0;
      case 'flag':
        this.flags[a.name] = a.value;
        return 0;
      case 'emit':
        this.pendingEvents.add(a.event);
        return 0;
      case 'sound':
        host.sound(a.name);
        return 0;
      case 'particles':
        for (const id of targets(a.target)) host.particlesAt(id, a.kind);
        return 0;
      case 'goto':
        seq.pc = Math.max(0, Math.min(seq.actions.length, a.step));
        return 0;
      case 'reset':
        for (const id of targets(a.target)) host.resetEntity(id);
        return 0;
    }
  }

  private whoList(w: Who, host?: LogicHost): PlayerId[] {
    if (w === 'p1') return [1];
    if (w === 'p2') return [2];
    if (w === 'both') return [1, 2];
    return host ? host.alivePlayers() : [1, 2];
  }

  private who(w: Who, f: (pid: PlayerId) => boolean): boolean {
    switch (w) {
      case 'p1': return f(1);
      case 'p2': return f(2);
      case 'both': return f(1) && f(2);
      default: return f(1) || f(2);
    }
  }

  evaluate(c: Condition, host: LogicHost): boolean {
    switch (c.op) {
      case 'always':
        return true;
      case 'inZone':
        return this.who(c.who, (pid) => host.playerInZone(c.zone, pid));
      case 'onPlate':
        return c.who ? this.who(c.who, (pid) => host.plateHeldBy(c.plate, pid)) : host.plateHeld(c.plate);
      case 'standingOn':
        return this.who(c.who ?? 'any', (pid) => host.standingOn(c.target, pid));
      case 'state':
        return host.entityState(c.target) === c.is;
      case 'flag':
        return c.is === undefined ? !!this.flags[c.name] : this.flags[c.name] === c.is;
      case 'elapsed':
        return host.time * 1000 >= c.ms;
      case 'swapped':
        return host.isSwapped();
      case 'airborne':
        return this.who(c.who ?? 'any', (pid) => host.isAirborne(pid));
      case 'grounded':
        return this.who(c.who ?? 'any', (pid) => host.isGrounded(pid));
      case 'distinctZones': {
        for (let i = 0; i < c.zones.length; i++)
          for (let j = 0; j < c.zones.length; j++)
            if (i !== j && host.playerInZone(c.zones[i], 1) && host.playerInZone(c.zones[j], 2)) return true;
        return false;
      }
      case 'event':
        return this.events.has(c.name);
      case 'and':
        return c.of.every((x) => this.evaluate(x, host));
      case 'or':
        return c.of.some((x) => this.evaluate(x, host));
      case 'not':
        return !this.evaluate(c.of, host);
    }
  }
}
