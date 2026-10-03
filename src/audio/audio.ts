/**
 * Sound, synthesised with the Web Audio API: no audio files to download.
 * Each cue means something physical:
 *   pair      two tones slide into unison (entanglement)
 *   flip      a quick up-down swap (X)
 *   phase     a filter sweep that "shifts" the sound (Z)
 *   send      a whoosh that travels left → right (one qubit crossing)
 *   decode    one of four chords, one per Bell state
 *   good/bad  harmonic resolution / detuned buzz
 * Every cue also emits a caption, so the game never relies on sound alone.
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

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  enabled = true;
  captions = false;

  /** Create/resume the context. Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.enabled) return;
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -18;
        comp.ratio.value = 4;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(comp).connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    } catch {
      this.ctx = null;
    }
  }

  private ready(): AudioContext | null {
    if (!this.enabled || !this.ctx || !this.master || this.ctx.state !== 'running') return null;
    return this.ctx;
  }

  private cap(text: string): void {
    if (this.captions) emit({ type: 'caption', text });
  }

  private tone(freq: number, at: number, dur: number, opts: { type?: OscillatorType; gain?: number; to?: number; pan?: number; attack?: number } = {}): void {
    const ctx = this.ready();
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
    node.connect(this.master!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(at: number, dur: number, opts: { from?: number; to?: number; gain?: number; panFrom?: number; panTo?: number; q?: number } = {}): void {
    const ctx = this.ready();
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
    f.type = 'bandpass';
    f.Q.value = opts.q ?? 6;
    f.frequency.setValueAtTime(opts.from ?? 600, t);
    f.frequency.exponentialRampToValueAtTime(opts.to ?? 2400, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opts.gain ?? 0.12, t + dur * 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = src.connect(f).connect(g);
    if (ctx.createStereoPanner && opts.panFrom !== undefined) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(opts.panFrom, t);
      p.pan.linearRampToValueAtTime(opts.panTo ?? opts.panFrom, t + dur);
      node = node.connect(p);
    }
    node.connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

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

  /** A whoosh that travels from Alice (left) to Bob (right). */
  send(dur = 0.9): void {
    this.noise(0, dur, { from: 500, to: 2800, gain: 0.07, panFrom: -0.8, panTo: 0.8 });
    this.cap('♪ one qubit crosses the channel');
  }

  arrive(): void {
    this.tone(hz(19), 0, 0.12, { gain: 0.06, pan: 0.7 });
  }

  decode(bits: Bits): void {
    CHORDS[bits].forEach((s, i) => this.tone(hz(s + 12), i * 0.05, 0.6, { type: 'triangle', gain: 0.07 }));
    this.cap(`♪ analyzer chord for ${bits}`);
  }

  good(): void {
    [0, 4, 7, 12].forEach((s, i) => this.tone(hz(s + 12), 0.15 + i * 0.06, 0.5, { gain: 0.07 }));
    this.cap('♪ resolved: correct');
  }

  bad(): void {
    this.tone(hz(-2), 0, 0.35, { type: 'sawtooth', gain: 0.06 });
    this.tone(hz(-1.4), 0, 0.35, { type: 'sawtooth', gain: 0.06 });
    this.cap('♪ broken signal: wrong message');
  }

  zap(): void {
    this.noise(0, 0.18, { from: 3000, to: 900, gain: 0.1, q: 3 });
    this.cap('♪ zap: the channel twisted the qubit');
  }

  spy(): void {
    this.noise(0, 0.25, { from: 1200, to: 1300, gain: 0.07, q: 20 });
    this.cap('♪ static: the spy looked');
  }

  tick(): void {
    this.tone(hz(24), 0, 0.04, { gain: 0.04 });
  }

  click(): void {
    this.tone(hz(17), 0, 0.03, { type: 'square', gain: 0.025 });
  }

  win(): void {
    [0, 4, 7, 11, 14].forEach((s, i) => this.tone(hz(s), i * 0.09, 0.9, { type: 'triangle', gain: 0.08 }));
    this.cap('♪ level cleared');
  }

  lose(): void {
    [7, 3, 0].forEach((s, i) => this.tone(hz(s - 12), i * 0.14, 0.5, { type: 'triangle', gain: 0.08 }));
    this.cap('♪ mission failed');
  }

  /** The signature: two bits ring out after one qubit crossed. */
  signature(): void {
    this.tone(hz(12), 0, 1.4, { gain: 0.09 });
    this.tone(hz(19), 0.12, 1.3, { gain: 0.07 });
    this.tone(hz(24), 0.24, 1.2, { gain: 0.05 });
    this.cap('♪ one qubit, two bits');
  }
}

export const audio = new AudioEngine();
