import type { SoundName } from './types';

type Wave = OscillatorType;

/** Tiny procedural synth: every SFX is generated from oscillators & noise. */
export class GameAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  unlock() {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.22;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.22;
  }

  private tone(t0: number, freq: number, dur: number, type: Wave, vol: number, freqEnd?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (freqEnd !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master!);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  private noise(t0: number, dur: number, vol: number, filterFreq = 2000, type: BiquadFilterType = 'lowpass') {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  play(name: SoundName) {
    if (!this.ctx || !this.master || this.muted) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'jump':
        this.tone(t, 260, 0.1, 'square', 0.35, 560);
        break;
      case 'land':
        this.tone(t, 130, 0.06, 'triangle', 0.3, 80);
        this.noise(t, 0.05, 0.15, 900);
        break;
      case 'death':
        this.noise(t, 0.35, 0.5, 1200);
        this.tone(t, 420, 0.45, 'sawtooth', 0.4, 50);
        this.tone(t + 0.05, 300, 0.4, 'square', 0.2, 40);
        break;
      case 'plate':
        this.tone(t, 620, 0.05, 'square', 0.3);
        this.tone(t + 0.06, 880, 0.07, 'square', 0.3);
        break;
      case 'unplate':
        this.tone(t, 520, 0.09, 'square', 0.25, 330);
        break;
      case 'unlock':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(t + i * 0.07, f, 0.12, 'triangle', 0.35));
        break;
      case 'troll':
        this.tone(t, 420, 0.22, 'sawtooth', 0.3, 260);
        this.tone(t + 0.25, 330, 0.35, 'sawtooth', 0.3, 160);
        break;
      case 'tick':
        for (let i = 0; i < 3; i++) this.noise(t + i * 0.07, 0.03, 0.3, 3000, 'highpass');
        break;
      case 'clear':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(t + i * 0.09, f, 0.25, 'square', 0.28));
        this.tone(t + 0.45, 1568, 0.5, 'triangle', 0.3);
        break;
      case 'poof':
        this.noise(t, 0.18, 0.4, 700);
        this.tone(t, 200, 0.15, 'triangle', 0.2, 60);
        break;
      case 'blip':
        this.tone(t, 880, 0.05, 'square', 0.25);
        break;
      case 'select':
        this.tone(t, 660, 0.06, 'square', 0.25);
        this.tone(t + 0.07, 990, 0.09, 'square', 0.25);
        break;
      case 'rumble':
        this.noise(t, 0.6, 0.5, 180);
        this.tone(t, 60, 0.6, 'sawtooth', 0.25, 40);
        break;
      case 'flip':
        this.tone(t, 300, 0.22, 'sine', 0.35, 900);
        this.tone(t + 0.02, 150, 0.22, 'triangle', 0.2, 450);
        break;
      case 'spike':
        this.tone(t, 1300, 0.12, 'square', 0.35, 300);
        this.noise(t, 0.06, 0.3, 4000, 'highpass');
        break;
      case 'thud':
        this.tone(t, 90, 0.2, 'sine', 0.6, 35);
        this.noise(t, 0.15, 0.5, 300);
        break;
      case 'warp':
        this.tone(t, 200, 0.25, 'sine', 0.4, 1200);
        this.tone(t + 0.05, 400, 0.2, 'triangle', 0.25, 1600);
        this.noise(t, 0.2, 0.15, 3000, 'highpass');
        break;
      case 'alarm':
        this.tone(t, 880, 0.12, 'square', 0.3, 660);
        this.tone(t + 0.14, 880, 0.12, 'square', 0.3, 660);
        this.tone(t + 0.28, 1100, 0.2, 'square', 0.3, 550);
        break;
    }
  }
}
