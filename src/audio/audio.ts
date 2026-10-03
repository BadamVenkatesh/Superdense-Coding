/**
 * Sound, synthesised with the Web Audio API: no audio files to download.
 *
 * Effects (each one means something physical or tells you what the game did):
 *   pair       two tones slide into unison: a new entangled pair
 *   snap       a short crackle as asking a question breaks the link
 *   flip       a quick up-down swap (X)          phase   a filter sweep (Z)
 *   send       a whoosh panned left → right: one qubit crossing
 *   banked     a two-note lock-in: Bob's half is in his rack
 *   motif      a new message plays its own chord quietly…
 *   decode     …and Bob's analyzer plays the same chord when it decodes it
 *   untangle / turn / read   the three analyzer steps, in sync with the animation
 *   ready      a soft ping when the channel can take a qubit again
 *   fuse       a warning tick as a message runs out of time
 *   heart      a low thud when a heart is lost
 *   zone, spy  hum as a noise zone lights; shimmer as the spy's eye opens
 *   UI         hover, click, refusal, overlays, screen changes
 *
 * Music: a generative bed. Alice's drone and Bob's drone sit a fifth apart, and a
 * duet arpeggio grows busier as messages pile up (calm → rush).
 *
 * Every meaningful cue can show a caption, so the game never relies on sound alone.
 * If audio is unsupported or blocked, every call is a silent no-op.
 */
import { emit } from '../ui/bus';
import type { Bits } from '../quantum/superdenseCoding';

const CHORDS: Record<Bits, number[]> = {
  '00': [0, 4, 7], // TWIN: major, at rest
  '01': [0, 3, 7], // CROSS: minor
  '10': [0, 5, 7], // OFFBEAT: suspended
  '11': [0, 3, 6], // ANTI: diminished
};
const BASE = 220;
const hz = (semi: number, base = BASE) => base * Math.pow(2, semi / 12);
/** A-minor pentatonic ladder for the music (semitones above A2 = 110 Hz). */
const SCALE = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24];

export type MusicMode = 'off' | 'menu' | 'title' | 'bench' | 'mission';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfx: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private resumedAt = 0;
  private lastHover = 0;
  private lastUi = 0;

  /** Master switch (Settings → Sound). */
  enabled = true;
  /** Music layer (Settings → Music). */
  musicOn = true;
  /** 0…1 (Settings → Volume). */
  volume = 0.8;
  captions = false;

  // music state
  private mode: MusicMode = 'off';
  private intensity = 0;
  private drone: { oscs: OscillatorNode[]; gain: GainNode; filter: BiquadFilterNode; lfo: OscillatorNode } | null = null;
  private timer: number | null = null;
  private nextStep = 0;
  private step = 0;

  /** Create/resume the context. Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;
        this.master = ctx.createGain();
        this.master.gain.value = this.volume * 0.7;
        this.sfx = ctx.createGain();
        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = this.musicOn ? 1 : 0;
        this.analyser = ctx.createAnalyser();
        this.analyser.fftSize = 1024;
        this.sfx.connect(this.master);
        this.musicBus.connect(this.master);
        this.master.connect(comp).connect(this.analyser).connect(ctx.destination);
        this.ctx = ctx;
        document.addEventListener('visibilitychange', () => (document.hidden ? this.pauseMusic() : this.resumeMusic()));
      }
      if (this.ctx.state === 'suspended') {
        this.resumedAt = performance.now();
        void this.ctx.resume().then(() => this.resumeMusic()).catch(() => undefined);
      }
      this.resumeMusic();
    } catch {
      this.ctx = null;
    }
  }

  /** Apply settings. Safe to call any time. */
  configure(o: { enabled?: boolean; music?: boolean; volume?: number; captions?: boolean }): void {
    if (o.enabled !== undefined) this.enabled = o.enabled;
    if (o.music !== undefined) this.musicOn = o.music;
    if (o.volume !== undefined) this.volume = Math.max(0, Math.min(1, o.volume));
    if (o.captions !== undefined) this.captions = o.captions;
    const ctx = this.ctx;
    if (ctx && this.master && this.musicBus) {
      const t = ctx.currentTime;
      this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.7 : 0, t, 0.05);
      this.musicBus.gain.setTargetAtTime(this.musicOn ? 1 : 0, t, 0.2);
    }
    if (this.enabled && this.musicOn) this.resumeMusic();
    else this.pauseMusic();
  }

  /** RMS of what is playing right now (0 = silence). Used by tests and the settings meter. */
  meter(): number {
    const a = this.analyser;
    if (!a) return 0;
    const buf = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    return Math.sqrt(s / buf.length);
  }

  get state(): string {
    return this.ctx?.state ?? 'none';
  }

  /** Can we schedule sound right now? (Also during the brief resume after a gesture.) */
  private live(): AudioContext | null {
    const ctx = this.ctx;
    if (!this.enabled || !ctx || !this.sfx) return null;
    if (ctx.state === 'running') return ctx;
    if (ctx.state === 'suspended' && performance.now() - this.resumedAt < 500) return ctx;
    return null;
  }

  private cap(text: string): void {
    if (this.captions) emit({ type: 'caption', text });
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; pan?: number; attack?: number; bus?: AudioNode } = {}): void {
    const ctx = this.live();
    if (!ctx) return;
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
    const peak = opts.gain ?? 0.18;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + (opts.attack ?? 0.012));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o.connect(g);
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      node = node.connect(p);
    }
    node.connect(opts.bus ?? this.sfx!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(at: number, dur: number, opts: { from?: number; to?: number; gain?: number; panFrom?: number; panTo?: number; q?: number; type?: BiquadFilterType } = {}): void {
    const ctx = this.live();
    if (!ctx) return;
    if (!this.noiseBuf) {
      this.noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.Q.value = opts.q ?? 6;
    f.frequency.setValueAtTime(opts.from ?? 600, t);
    f.frequency.exponentialRampToValueAtTime(opts.to ?? 2400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t + Math.min(0.04, dur * 0.3));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = src.connect(f).connect(g);
    if (ctx.createStereoPanner && opts.panFrom !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(opts.panFrom, t);
      p.pan.linearRampToValueAtTime(opts.panTo ?? opts.panFrom, t + dur);
      node = node.connect(p);
    }
    node.connect(this.sfx!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  // ── physics cues ────────────────────────────────────────────────────

  /** Two tones glide into unison: a new entangled pair. */
  pair(): void {
    this.tone(hz(-5), 0, 0.5, { to: hz(0), pan: -0.5, gain: 0.12 });
    this.tone(hz(5), 0, 0.5, { to: hz(0), pan: 0.5, gain: 0.12 });
    this.tone(hz(12), 0.42, 0.35, { gain: 0.06 });
    this.cap('♪ two tones lock together: a new pair');
  }

  flip(): void {
    this.tone(hz(12), 0, 0.09, { type: 'triangle', gain: 0.14 });
    this.tone(hz(7), 0.07, 0.12, { type: 'triangle', gain: 0.14 });
    this.noise(0, 0.06, { from: 4000, to: 2000, gain: 0.04, q: 2 });
    this.cap('♪ flip');
  }

  phase(): void {
    this.noise(0, 0.28, { from: 300, to: 2600, gain: 0.08, q: 12 });
    this.tone(hz(9), 0, 0.22, { type: 'sine', to: hz(10), gain: 0.08 });
    this.cap('♪ phase shift');
  }

  /** Asking a question: high for ▲/▶, low for ▼/◀; panned to whose half it was. */
  answer(outcome: 0 | 1, who: 'A' | 'B'): void {
    this.tone(outcome === 0 ? hz(14) : hz(2), 0, 0.16, { type: 'triangle', pan: who === 'A' ? -0.6 : 0.6, gain: 0.13 });
    this.cap(`♪ ${who === 'A' ? 'your' : "Bob's"} half answers ${outcome === 0 ? 'high' : 'low'}`);
  }

  /** The link breaks: a question has used the pair up. */
  snap(): void {
    this.noise(0, 0.12, { from: 2500, to: 600, gain: 0.07, q: 1.5 });
    this.tone(hz(19), 0, 0.08, { type: 'square', gain: 0.025, to: hz(7) });
    this.cap('♪ snap: asking broke the link');
  }

  /** A whoosh that travels from Alice (left) to Bob (right). */
  send(dur = 0.9): void {
    this.noise(0, dur, { from: 500, to: 2800, gain: 0.07, panFrom: -0.8, panTo: 0.8 });
    this.tone(hz(7), 0, Math.min(0.25, dur), { type: 'sine', gain: 0.05, to: hz(14), pan: -0.6 });
    this.cap('♪ one qubit crosses the channel');
  }

  arrive(): void {
    this.tone(hz(19), 0, 0.12, { gain: 0.06, pan: 0.7 });
  }

  /** Bob's half is safely in his rack. */
  banked(): void {
    this.tone(hz(12), 0, 0.1, { type: 'triangle', gain: 0.07, pan: 0.6 });
    this.tone(hz(19), 0.08, 0.16, { type: 'triangle', gain: 0.07, pan: 0.6 });
    this.cap('♪ click-clack: a half is banked at Bob’s');
  }

  /** A new message announces itself with the chord its decode will play. */
  motif(bits: Bits): void {
    CHORDS[bits].forEach((s, i) => this.tone(hz(s + 12), i * 0.07, 0.25, { type: 'sine', gain: 0.045 }));
    this.cap(`♪ a message arrives: ${bits}`);
  }

  /** Bob's analyzer, in sync with the stage animation (0, 0.45 s, 0.95 s, 1.35 s). */
  analyzer(bits: Bits): void {
    this.noise(0, 0.35, { from: 400, to: 1800, gain: 0.05, q: 8 }); // untangle
    this.tone(hz(7), 0.45, 0.14, { type: 'triangle', gain: 0.07 }); // flip bit appears
    this.tone(hz(bits[0] === '0' ? 12 : 10), 0.95, 0.18, { type: 'triangle', gain: 0.07, to: hz(bits[0] === '0' ? 14 : 8) }); // turn
    CHORDS[bits].forEach((s, i) => this.tone(hz(s + 12), 1.35 + i * 0.05, 0.6, { type: 'triangle', gain: 0.07 })); // read
    this.cap(`♪ analyzer: untangle, turn, read ${bits}`);
  }

  /** The chord for a decoded message (also used when there is no step animation). */
  decode(bits: Bits): void {
    CHORDS[bits].forEach((s, i) => this.tone(hz(s + 12), i * 0.05, 0.6, { type: 'triangle', gain: 0.07 }));
    this.cap(`♪ analyzer chord for ${bits}`);
  }

  good(at = 0): void {
    [0, 4, 7, 12].forEach((s, i) => this.tone(hz(s + 12), at + 0.15 + i * 0.06, 0.5, { gain: 0.07 }));
    this.cap('♪ resolved: correct');
  }

  bad(at = 0): void {
    this.tone(hz(-2), at, 0.35, { type: 'sawtooth', gain: 0.06 });
    this.tone(hz(-1.4), at, 0.35, { type: 'sawtooth', gain: 0.06 });
    this.cap('♪ broken signal: wrong message');
  }

  /** A heart is lost. */
  heart(at = 0): void {
    this.tone(70, at + 0.05, 0.35, { type: 'sine', gain: 0.22, to: 40 });
    this.noise(at + 0.05, 0.2, { from: 300, to: 120, gain: 0.06, q: 1, type: 'lowpass' });
    this.cap('♪ thud: a heart lost');
  }

  /** Every third correct decode in a row. */
  streak(n: number): void {
    const lift = Math.min(n, 12);
    [0, 7, 12].forEach((s, i) => this.tone(hz(s + 12 + lift), i * 0.05, 0.25, { type: 'triangle', gain: 0.05 }));
    this.cap(`♪ streak ${n}`);
  }

  /** A message is running out of time. */
  fuse(urgent = false): void {
    this.tone(urgent ? hz(26) : hz(21), 0, 0.06, { type: 'square', gain: urgent ? 0.04 : 0.03 });
    if (urgent) this.tone(hz(26), 0.12, 0.06, { type: 'square', gain: 0.04 });
    this.cap(urgent ? '♪ tick-tick: a message is about to expire' : '♪ tick: a message is running low');
  }

  /** The channel can take a qubit again. */
  channelReady(): void {
    this.tone(hz(24), 0, 0.07, { type: 'sine', gain: 0.025, pan: -0.7 });
  }

  /** A press was remembered and will fire when the channel opens. */
  armed(): void {
    this.tone(hz(17), 0, 0.04, { type: 'square', gain: 0.025 });
    this.tone(hz(22), 0.05, 0.05, { type: 'square', gain: 0.02 });
  }

  zap(): void {
    this.noise(0, 0.18, { from: 3000, to: 900, gain: 0.1, q: 3 });
    this.cap('♪ zap: the channel twisted the qubit');
  }

  /** A noise zone is about to light / has lit. */
  zone(on: boolean): void {
    if (on) {
      this.tone(hz(-12), 0, 0.6, { type: 'sawtooth', gain: 0.03, to: hz(-10) });
      this.noise(0, 0.5, { from: 200, to: 800, gain: 0.04, q: 4 });
      this.cap('♪ hum: a noise zone is live');
    } else {
      this.tone(hz(5), 0, 0.12, { type: 'triangle', gain: 0.04 });
      this.tone(hz(5), 0.2, 0.12, { type: 'triangle', gain: 0.04 });
      this.cap('♪ warning: a noise zone is coming');
    }
  }

  spy(): void {
    this.noise(0, 0.25, { from: 1200, to: 1300, gain: 0.07, q: 20 });
    this.cap('♪ static: the spy looked');
  }

  /** The spy's eye opens. */
  spyEye(): void {
    this.tone(hz(15), 0, 0.5, { type: 'sine', gain: 0.03, to: hz(16) });
    this.tone(hz(21), 0.03, 0.5, { type: 'sine', gain: 0.025, to: hz(20) });
    this.cap('♪ shimmer: the spy is watching');
  }

  tick(): void {
    this.tone(hz(24), 0, 0.04, { gain: 0.04 });
  }

  win(): void {
    [0, 4, 7, 11, 14].forEach((s, i) => this.tone(hz(s), i * 0.09, 0.9, { type: 'triangle', gain: 0.08 }));
    this.tone(hz(24), 0.5, 1.2, { gain: 0.04 });
    this.cap('♪ level cleared');
  }

  lose(): void {
    [7, 3, 0].forEach((s, i) => this.tone(hz(s - 12), i * 0.14, 0.5, { type: 'triangle', gain: 0.08 }));
    this.cap('♪ mission failed');
  }

  /** Mission start. */
  go(): void {
    this.tone(hz(0), 0, 0.12, { type: 'triangle', gain: 0.07 });
    this.tone(hz(7), 0.1, 0.12, { type: 'triangle', gain: 0.07 });
    this.tone(hz(12), 0.2, 0.3, { type: 'triangle', gain: 0.08 });
    this.cap('♪ go');
  }

  /** The signature: two bits ring out after one qubit crossed. */
  signature(): void {
    this.tone(hz(12), 0, 1.4, { gain: 0.09 });
    this.tone(hz(19), 0.12, 1.3, { gain: 0.07 });
    this.tone(hz(24), 0.24, 1.2, { gain: 0.05 });
    this.noise(0, 1.2, { from: 6000, to: 9000, gain: 0.015, q: 2 });
    this.cap('♪ one qubit, two bits');
  }

  // ── UI ──────────────────────────────────────────────────────────────

  hover(): void {
    const now = performance.now();
    if (now - this.lastHover < 70) return;
    this.lastHover = now;
    this.tone(hz(31), 0, 0.03, { type: 'sine', gain: 0.012 });
  }

  click(): void {
    const now = performance.now();
    if (now - this.lastUi < 40) return;
    this.lastUi = now;
    this.tone(hz(17), 0, 0.03, { type: 'square', gain: 0.02 });
  }

  /** A refused action (the button shakes). */
  deny(): void {
    this.tone(hz(-3), 0, 0.08, { type: 'square', gain: 0.03 });
    this.tone(hz(-4), 0.08, 0.1, { type: 'square', gain: 0.03 });
  }

  /** A card or dialog opens. */
  open(): void {
    this.tone(hz(12), 0, 0.18, { type: 'sine', gain: 0.04, to: hz(19) });
  }

  /** Moving between screens. */
  nav(): void {
    this.noise(0, 0.18, { from: 900, to: 2400, gain: 0.025, q: 3 });
  }

  // ── music ───────────────────────────────────────────────────────────

  /** Choose the music for the current screen. */
  music(mode: MusicMode): void {
    if (mode === this.mode) return;
    this.mode = mode;
    if (mode === 'off') this.pauseMusic();
    else this.resumeMusic();
    this.setIntensity(mode === 'title' ? 0.25 : mode === 'bench' ? 0.15 : mode === 'menu' ? 0.05 : this.intensity);
  }

  /** 0 = calm, 1 = full rush. Missions call this every frame; it is smoothed. */
  setIntensity(x: number): void {
    this.intensity = Math.max(0, Math.min(1, x));
    const d = this.drone;
    const ctx = this.ctx;
    if (d && ctx) d.filter.frequency.setTargetAtTime(380 + this.intensity * 1600, ctx.currentTime, 0.6);
  }

  private resumeMusic(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.enabled || !this.musicOn || this.mode === 'off' || document.hidden) return;
    if (!this.drone) {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      filter.Q.value = 0.7;
      const a = ctx.createOscillator(); // Alice: A2
      a.type = 'triangle';
      a.frequency.value = 110;
      const b = ctx.createOscillator(); // Bob: E3, a fifth above
      b.type = 'sine';
      b.frequency.value = 164.81;
      b.detune.value = 4;
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.07;
      lfoGain.gain.value = 120;
      lfo.connect(lfoGain).connect(filter.frequency);
      a.connect(filter);
      b.connect(filter);
      filter.connect(gain).connect(this.musicBus!);
      a.start();
      b.start();
      lfo.start();
      this.drone = { oscs: [a, b], gain, filter, lfo };
    }
    this.drone.gain.gain.setTargetAtTime(0.026, ctx.currentTime, 1.2);
    if (this.timer === null) {
      this.nextStep = ctx.currentTime + 0.1;
      this.timer = window.setInterval(() => this.schedule(), 60);
    }
  }

  private pauseMusic(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const ctx = this.ctx;
    if (this.drone && ctx) this.drone.gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.4);
  }

  /** Lookahead scheduler for the duet arpeggio (16th notes, tempo rises with intensity). */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.musicOn || !this.enabled) return;
    const x = this.intensity;
    const stepDur = 0.21 - x * 0.07; // ≈ 71 → 107 bpm in 16ths
    while (this.nextStep < ctx.currentTime + 0.25) {
      const t = this.nextStep - ctx.currentTime;
      const s = this.step++;
      // Alice and Bob alternate notes; the same pitch class answers back like a pair.
      const density = 0.08 + x * 0.75;
      const accent = s % 4 === 0;
      if (Math.random() < density * (accent ? 1.4 : 1)) {
        const who = s % 2 === 0 ? 'A' : 'B';
        const idx = Math.floor((Math.sin(s * 0.37) * 0.5 + 0.5) * (SCALE.length - 1));
        const semi = SCALE[idx] + (who === 'B' ? 7 : 0);
        this.tone(110 * Math.pow(2, (semi + 12) / 12), t, 0.35 + (1 - x) * 0.6, {
          type: 'triangle', gain: (accent ? 0.026 : 0.016) * (0.6 + x * 0.6), pan: who === 'A' ? -0.45 : 0.45, attack: 0.005, bus: this.musicBus!,
        });
      }
      // a soft pulse underneath once things get busy
      if (x > 0.55 && s % 4 === 0) this.tone(55, t, 0.25, { type: 'sine', gain: 0.05 * x, to: 42, bus: this.musicBus! });
      this.nextStep += stepDur;
    }
  }
}

export const audio = new AudioEngine();

// Read-only hook for automated tests (scripts/e2e.mjs): is sound reaching the output?
(globalThis as unknown as { __otherHalfAudio?: unknown }).__otherHalfAudio = {
  state: () => audio.state,
  meter: () => audio.meter(),
};
