import { DT, PIXEL_FONT } from './constants';
import { GameAudio } from './audio';
import { Input, type InputAction } from './input';
import { LEVELS } from './levels';
import { Renderer } from './render';
import { isHighScore, loadScores, saveScore, type ScoreEntry } from './scores';
import { World } from './world';
import type { DeathCause } from './types';

export type GameState = 'menu' | 'playing' | 'paused' | 'levelclear' | 'victory' | 'scores';

export interface LevelResult { name: string; time: number; deaths: number; score: number }

export interface UISnapshot {
  state: GameState;
  levelIndex: number;
  levelCount: number;
  levelName: string;
  levelSubtitle: string;
  tip: string;
  time: number;
  deaths: number;
  score: number;
  runTime: number;
  runDeaths: number;
  message: { text: string; style: string } | null;
  death: string | null;
  swapped: boolean;
  hudBounce: number;
  introT: number;
  lastResult: LevelResult | null;
  results: LevelResult[];
  muted: boolean;
  scores: ScoreEntry[];
  isHigh: boolean;
  scoreSaved: boolean;
}

const CAUSE_TEXT: Record<DeathCause, string> = {
  spikes: 'got spiked',
  saw: 'met the saw',
  crushed: 'got squished',
  fall: 'fell out of the world',
  anvil: 'got flattened by an anvil',
  fakeExit: 'trusted the fake exit',
  trap: 'was betrayed by the level',
  balloon: 'was gently tapped to death by a balloon',
  piano: 'received a piano. From the sky.',
  popped: 'inflated and POPPED',
  laser: 'was lasered by their best friend',
  cardboard: 'was flattened by a cardboard door',
  launched: 'bounced off the score counter',
};
const QUIPS = ['Shared fate!', 'One falls, both fall.', 'Dumb way to die #' + Math.floor(Math.random() * 900 + 100) + '.', 'That looked painful. And funny.', 'Physics called. It wants an apology.', 'Communicate! (Or laugh. Both work.)', '10/10 would die again.'];

export class Game {
  readonly input = new Input();
  readonly audio = new GameAudio();
  readonly world = new World(this.input);
  private renderer: Renderer;
  state: GameState = 'menu';
  levelIndex = 0;
  levelTime = 0;
  levelDeaths = 0;
  score = 0;
  runTime = 0;
  runDeaths = 0;
  results: LevelResult[] = [];
  lastResult: LevelResult | null = null;
  introT = 0;
  isHigh = false;
  scoreSaved = false;
  scores: ScoreEntry[] = [];
  private deathQuip = '';
  private prevDeathCount = 0;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private uiTimer = 0;
  private dirty = true;
  private destroyed = false;

  constructor(canvas: HTMLCanvasElement, private onUI: (s: UISnapshot) => void) {
    this.renderer = new Renderer(canvas.getContext('2d')!);
    this.world.sound = (n) => this.audio.play(n);
    this.audio.setMuted(localStorage.getItem('shared-fate-muted') === '1');
    this.input.onAction = (a) => this.handleAction(a);
    this.input.onAnyKey = () => this.audio.unlock();
  }

  start() {
    this.input.attach();
    this.world.load(LEVELS[0]);
    this.world.frozen = true;
    this.scores = loadScores();
    if ('fonts' in document) void document.fonts.load(`8px ${PIXEL_FONT}`).catch(() => undefined);
    window.addEventListener('pointerdown', this.pointerUnlock, { passive: true });
    document.addEventListener('visibilitychange', this.onVisibility);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  private pointerUnlock = () => this.audio.unlock();

  private onVisibility = () => {
    if (document.hidden && this.state === 'playing') this.togglePause();
  };

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('pointerdown', this.pointerUnlock);
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.input.detach();
  }

  private loop = (ts: number) => {
    if (this.destroyed) return;
    const dt = Math.min(0.1, Math.max(0, (ts - this.last) / 1000));
    this.last = ts;
    this.acc += dt;
    let steps = 0;
    while (this.acc >= DT && steps < 5) {
      this.tick(DT);
      this.acc -= DT;
      steps++;
    }
    if (steps === 5) this.acc = 0;
    this.renderer.render(this.world);
    this.uiTimer += dt;
    if (this.dirty || this.uiTimer > 0.1) {
      this.pushUI();
      this.uiTimer = 0;
      this.dirty = false;
    }
    this.raf = requestAnimationFrame(this.loop);
  };

  private tick(dt: number) {
    if (this.state === 'paused') return;
    this.world.update(dt);
    if (this.state !== 'playing') return;
    if (this.world.deathCount !== this.prevDeathCount) {
      this.levelDeaths += this.world.deathCount - this.prevDeathCount;
      this.runDeaths += this.world.deathCount - this.prevDeathCount;
      this.prevDeathCount = this.world.deathCount;
      this.deathQuip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
      this.dirty = true;
    }
    if (this.introT > 0) this.introT -= dt;
    if (this.world.phase === 'play') {
      this.levelTime += dt;
      this.runTime += dt;
    } else if (this.world.phase === 'dying') {
      if (this.world.phaseT >= 1.25) this.respawn();
    } else if (this.world.phase === 'cleared' && this.world.phaseT >= 0.8) {
      this.finishLevel();
    }
  }

  // ------------------------------------------------------------ transitions
  private loadLevel(i: number) {
    this.levelIndex = i;
    this.world.load(LEVELS[i]);
    this.world.frozen = false;
    this.prevDeathCount = this.world.deathCount;
    this.levelTime = 0;
    this.levelDeaths = 0;
    this.introT = 2.8;
    this.state = 'playing';
    this.dirty = true;
  }

  private respawn() {
    this.world.reset();
    this.world.frozen = false;
    this.dirty = true;
  }

  private finishLevel() {
    const def = LEVELS[this.levelIndex];
    const lvlScore = Math.max(100, Math.round(1000 + (def.par - this.levelTime) * 12 - this.levelDeaths * 60));
    this.score += lvlScore;
    this.lastResult = { name: def.name, time: this.levelTime, deaths: this.levelDeaths, score: lvlScore };
    this.results.push(this.lastResult);
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.state = 'victory';
      this.isHigh = isHighScore(this.score);
      this.scoreSaved = false;
    } else {
      this.state = 'levelclear';
    }
    this.dirty = true;
  }

  play() {
    this.audio.unlock();
    this.audio.play('select');
    this.score = 0; this.runTime = 0; this.runDeaths = 0; this.results = []; this.lastResult = null;
    this.loadLevel(0);
  }

  nextLevel() {
    if (this.state !== 'levelclear') return;
    this.audio.play('select');
    this.loadLevel(this.levelIndex + 1);
  }

  togglePause() {
    if (this.state === 'playing') { this.state = 'paused'; this.audio.play('blip'); }
    else if (this.state === 'paused') { this.state = 'playing'; this.audio.play('blip'); }
    this.dirty = true;
  }

  restartLevel() {
    if (this.state !== 'playing' && this.state !== 'paused') return;
    this.respawn();
    this.state = 'playing';
    this.audio.play('blip');
  }

  quitToMenu() {
    this.state = 'menu';
    this.world.load(LEVELS[0]);
    this.world.frozen = true;
    this.scores = loadScores();
    this.dirty = true;
  }

  showScores() {
    this.scores = loadScores();
    this.state = 'scores';
    this.audio.play('blip');
    this.dirty = true;
  }

  submitScore(name: string) {
    if (this.scoreSaved) return;
    this.scores = saveScore({ name: name.trim().slice(0, 12) || 'P1 & P2', score: this.score, time: this.runTime, deaths: this.runDeaths, date: Date.now() });
    this.scoreSaved = true;
    this.audio.play('unlock');
    this.state = 'scores';
    this.dirty = true;
  }

  toggleMute() {
    this.audio.setMuted(!this.audio.muted);
    localStorage.setItem('shared-fate-muted', this.audio.muted ? '1' : '0');
    this.dirty = true;
  }

  private handleAction(a: InputAction) {
    switch (a) {
      case 'pause':
        if (this.state === 'playing' || this.state === 'paused') this.togglePause();
        else if (this.state === 'scores') this.quitToMenu();
        break;
      case 'restart':
        this.restartLevel();
        break;
      case 'confirm':
        if (this.state === 'menu') this.play();
        else if (this.state === 'levelclear') this.nextLevel();
        else if (this.state === 'paused') this.togglePause();
        else if (this.state === 'scores') this.quitToMenu();
        break;
      case 'mute':
        this.toggleMute();
        break;
      case 'back':
        if (this.state === 'scores') this.quitToMenu();
        break;
    }
  }

  // --------------------------------------------------------------------- UI
  private pushUI() {
    const w = this.world;
    const def = LEVELS[this.levelIndex];
    const msg = w.message && w.message.until > w.time ? { text: w.message.text, style: w.message.style } : null;
    const death = w.phase === 'dying' && w.death ? `P${w.death.pid} ${CAUSE_TEXT[w.death.cause]}. ${this.deathQuip}` : null;
    this.onUI({
      state: this.state,
      levelIndex: this.levelIndex,
      levelCount: LEVELS.length,
      levelName: def.name,
      levelSubtitle: def.subtitle,
      tip: def.tip,
      time: this.levelTime,
      deaths: this.levelDeaths,
      score: this.score,
      runTime: this.runTime,
      runDeaths: this.runDeaths,
      message: msg,
      death,
      swapped: w.isSwapped(),
      hudBounce: w.hudBounce,
      introT: this.introT,
      lastResult: this.lastResult,
      results: this.results,
      muted: this.audio.muted,
      scores: this.scores,
      isHigh: this.isHigh,
      scoreSaved: this.scoreSaved,
    });
  }
}
