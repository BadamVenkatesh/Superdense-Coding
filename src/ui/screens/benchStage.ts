/**
 * Shared stage + layout for the hands-on levels (1–5): one real Bell pair on the bench.
 */
import { audio } from '../../audio/audio';
import { PairBench, type Who } from '../../game/bench';
import type { Basis } from '../../quantum/measurement';
import type { Move } from '../../quantum/superdenseCoding';
import type { AppCtx } from '../app';
import { h } from '../dom';
import { glyphOf, topbar } from '../components';
import { Scene, type DockM, type FlightM, type OrbM, type SceneModel } from '../scene';
import type { LevelDef } from '../../game/levels';

const nowS = () => performance.now() / 1000;

export class BenchStage {
  bench: PairBench;
  scene: Scene;
  canvas: HTMLCanvasElement;
  brokeAt = 0;
  changedAt = 0;
  askAt: Record<Who, number> = { A: 0, B: 0 };
  sharing: { t0: number; dur: number } | null = null;
  /** Hide the link's pattern (Bob doesn't know what Alice did). */
  hidden = false;
  dock: DockM | null = null;
  lone: OrbM | null = null;
  showPair = true;
  /** Extra flight (e.g. Level 5's lone qubit or Alice's half travelling). */
  flight: FlightM | null = null;
  channel: SceneModel['channel'] = null;
  private timers: number[] = [];

  constructor(private ctx: AppCtx, seed: string, label: string) {
    this.bench = new PairBench(seed);
    this.canvas = h('canvas', { class: 'stage', role: 'img', 'aria-label': label });
    this.scene = new Scene(this.canvas, () => this.model());
    this.scene.reducedMotion = ctx.reducedMotion();
    this.scene.start();
  }

  get busy(): boolean {
    return !!this.sharing || !!this.flight;
  }

  model(): SceneModel {
    const b = this.bench;
    const last = (who: Who) => [...b.current.asks].reverse().find((a) => a.who === who);
    const la = last('A');
    const lb = last('B');
    const orb = (who: Who, a: typeof la): OrbM => ({ glyph: a ? glyphOf(a.basis, a.outcome) : null, changedAt: this.askAt[who] || undefined });
    const sharing = this.sharing;
    const progress = sharing ? Math.min(1, (nowS() - sharing.t0) / sharing.dur) : 0;
    const rungs: SceneModel['rungs'] = this.showPair
      ? [{
          id: 1000 + b.current.no,
          a: orb('A', la),
          b: sharing ? null : orb('B', lb),
          pattern: this.hidden ? null : b.linked ? b.pattern : b.pattern,
          link: this.hidden && b.linked ? 'hidden' : b.linked ? 'linked' : 'broken',
          brokeAt: this.brokeAt,
          changedAt: this.changedAt,
        }]
      : [];
    const flight: FlightM | null = sharing
      ? { id: 1, kind: 'share', x: progress, rungId: 1000 + b.current.no, pattern: b.pattern, link: 'linked' }
      : this.flight;
    return { rungs, slots: 1, flight, zones: [], spy: null, channel: this.channel, dock: this.dock, lone: this.lone, view: this.ctx.view(), bench: true };
  }

  ask(who: Who, basis: Basis) {
    const wasLinked = this.bench.linked;
    const a = this.bench.ask(who, basis);
    this.askAt[who] = nowS();
    if (wasLinked) {
      this.brokeAt = nowS();
      audio.snap();
    }
    audio.answer(a.outcome, who);
    return a;
  }

  toggle(m: Move): void {
    this.bench.toggle(m);
    this.changedAt = nowS();
    if (m === 'X') audio.flip();
    else audio.phase();
  }

  /** Make a fresh pair at Alice's and fly Bob's half across the channel. */
  share(then?: () => void, dur = 0.85): void {
    if (this.sharing) return;
    this.bench.newPair();
    this.askAt = { A: 0, B: 0 };
    this.brokeAt = 0;
    this.changedAt = 0;
    this.sharing = { t0: nowS(), dur: this.ctx.reducedMotion() ? 0.25 : dur };
    audio.pair();
    audio.send(dur);
    this.later(() => {
      this.sharing = null;
      audio.banked();
      then?.();
    }, this.sharing.dur * 1000 + 30);
  }

  later(fn: () => void, ms: number): void {
    this.timers.push(window.setTimeout(fn, ms));
  }

  destroy(): void {
    this.timers.forEach(clearTimeout);
    this.scene.destroy();
  }
}

/** Standard layout for a bench level. Returns the pieces to fill. */
export function benchLayout(ctx: AppCtx, level: LevelDef, stage: BenchStage, opts: { left: string; right: string }) {
  const prompt = h('h2', { class: 'prompt', 'aria-live': 'polite' });
  const sub = h('p', { class: 'subprompt' });
  const controls = h('div', { class: 'controls' });
  const panel = h('aside', { class: 'card panel', 'aria-label': 'Goals and results' });
  const caption = h('div', { class: 'stage-caption' });
  const tags = h('div', { class: 'stage-tags', 'aria-hidden': 'true' }, h('span', { class: 'alice' }, opts.left), h('span', { class: 'bob' }, opts.right));
  const stageWrap = h('div', { class: 'stage-wrap' }, stage.canvas, tags, caption);
  const bar = topbar(ctx, level.title, `LEVEL ${level.id}`);
  const el = h('div', { class: 'screen level' },
    bar,
    prompt,
    sub,
    h('div', { class: 'cols' }, h('div', { style: 'display:grid;gap:12px;min-width:0' }, stageWrap, controls), panel));
  const setCaption = (t: string) => {
    caption.textContent = t;
    caption.style.display = t ? '' : 'none';
  };
  setCaption('');
  return { el, prompt, sub, controls, panel, stageWrap, setCaption, tags, cleanup: () => (bar as HTMLElement & { cleanup?: () => void }).cleanup?.() };
}

export function banner(host: HTMLElement, big: string, small: string, ms = 3800): void {
  const b = h('div', { class: 'banner', role: 'status' }, h('div', { class: 'big' }, big), h('div', { class: 'small' }, small));
  host.append(b);
  setTimeout(() => b.remove(), ms);
}
