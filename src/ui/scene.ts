/**
 * The stage: a canvas renderer driven by a plain model, redrawn every frame.
 *
 * Visual language (validated against the physics in submission/QUANTUM_CONCEPT.md):
 *   - An orb is one half of a pair. A shimmering orb has NO definite answer (I/2 on its own).
 *     A solid orb with an arrow has been asked: ▲ ▼ (the ▲▼ question) or ▶ ◀ (the ◀ ▶ question).
 *   - The link between two halves is drawn as two strands:
 *       parallel strands    = the halves AGREE on ▲▼      (Z⊗Z = +1)
 *       crossed strands     = the halves are OPPOSITE on ▲▼ (Z⊗Z = −1)   ← FLIP makes this
 *       rungs (in step)     = the halves AGREE on ◀ ▶      (X⊗X = +1)
 *       zigzag (offbeat)    = the halves are OPPOSITE on ◀ ▶ (X⊗X = −1)   ← PHASE makes this
 *   - Banked pairs stack like rungs of a ladder above the channel; the head pair is the bottom one.
 *   - The channel lane carries ONE qubit at a time.
 */
import type { Bits } from '../quantum/superdenseCoding';

export type Glyph = 'up' | 'down' | 'right' | 'left';
export type LinkState = 'linked' | 'broken' | 'uncertain' | 'hidden';

export interface OrbM {
  glyph?: Glyph | null;
  changedAt?: number;
  dim?: boolean;
}

export interface RungM {
  id: number;
  a: OrbM | null;
  b: OrbM | null;
  pattern: Bits | null;
  link: LinkState;
  brokeAt?: number;
  changedAt?: number;
  /** Shows a small ⚡ marker: a known zone twisted this pair on its way. */
  twisted?: boolean;
}

export interface FlightM {
  id: number;
  kind: 'share' | 'message' | 'bit';
  x: number;
  /** For a share: the rung whose Alice orb the flying half is linked to. */
  rungId?: number;
  pattern?: Bits | null;
  link?: LinkState;
  glyph?: Glyph | null;
  hitAt?: number;
}

export interface ZoneM {
  kind: 'X' | 'Z' | '?';
  x0: number;
  x1: number;
  state: 'warn' | 'on';
}

export interface SpyM {
  x: number;
  open: boolean;
  readAt?: number;
}

export interface DockM {
  /** Seconds (performance.now()/1000) when the analyzer started. */
  t0: number;
  pattern: Bits | null;
  link: LinkState;
  bits?: Bits | null;
  correct?: boolean | null;
  /** Only Bob's half waiting (message not yet arrived). */
  waiting?: boolean;
  /** Both halves resting on Bob's desk, asked individually (Level 4), no analyzer running. */
  desk?: { a: OrbM; b: OrbM; brokeAt?: number };
  /** Only one lone qubit arrived; Bob asked it one question (Level 5, part A). */
  lone?: OrbM;
  /** Nothing on Bob's desk yet. */
  empty?: boolean;
}

export interface SceneModel {
  rungs: RungM[];
  slots: number;
  flight: FlightM | null;
  zones: ZoneM[];
  spy: SpyM | null;
  channel: { ready: boolean; recharge: number; armed: boolean } | null;
  dock: DockM | null;
  /** A lone qubit sitting at Alice's station (Level 5, part A). */
  lone?: OrbM | null;
  view: 'game' | 'circuit';
  /** Bench levels: a single big pair, centred. */
  bench?: boolean;
  /** Draw the channel lane (default true). */
  lane?: boolean;
  /** Draw Bob's desk/analyzer in the middle of the stage, large (Level 4). */
  dockCenter?: boolean;
}

const C = {
  alice: '#ff8a5c',
  aliceHi: '#ffc2a6',
  bob: '#47e0ff',
  bobHi: '#b5f3ff',
  link: '#b18cff',
  text: '#f1f2ff',
  muted: '#9aa0c3',
  faint: '#3b4066',
  flip: '#ff5fd2',
  phase: '#ffd166',
  good: '#5ee59a',
  bad: '#ff5f7a',
  lane: '#2a2f55',
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const now = () => performance.now() / 1000;

interface Pt { x: number; y: number }

export class Scene {
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private dpr = 1;
  private w = 0;
  private h = 0;
  private yCache = new Map<number, number>();
  private ro: ResizeObserver | null = null;
  private model: () => SceneModel;
  reducedMotion = false;
  /** Seconds of animation clock (frozen when reduced motion is on). */
  private clock = 0;
  private last = now();

  constructor(private canvas: HTMLCanvasElement, model: () => SceneModel) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    this.ctx = ctx;
    this.model = model;
    this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    } else {
      window.addEventListener('resize', this.resize);
    }
  }

  start(): void {
    const loop = () => {
      this.raf = requestAnimationFrame(loop);
      try {
        this.draw();
      } catch (err) {
        console.error(err);
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    window.removeEventListener('resize', this.resize);
  }

  private resize = (): void => {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  };

  // ── layout ──────────────────────────────────────────────────────────

  private layout(m: SceneModel) {
    const W = this.w;
    const H = this.h;
    const bench = !!m.bench;
    const R = bench ? clamp(Math.min(W * 0.06, H * 0.15), 18, 46) : clamp(Math.min(W * 0.042, H * 0.1), 14, 32);
    const r = R * 0.52;
    const pad = clamp(W * 0.05, 14, 56);
    const ax = pad + R * 1.25;
    const bx = W - pad - R * 1.25;
    const laneY = bench ? H * 0.74 : H * 0.79;
    const headY = bench ? (m.lane === false ? H * 0.5 : H * 0.36) : laneY - R * 2.75;
    const rail = Math.min(R * 0.62, 13);
    const top = 30 + r;
    // rung k ≥ 1 sits above the head pair: first one clear of the head orb, then evenly stacked
    const firstUp = R + r + 4;
    const gap = m.slots > 2 ? Math.min((headY - firstUp - top) / (m.slots - 2), r * 2.8) : 0;
    const xL = ax + R * 1.15;
    const xR = bx - R * 1.15;
    return { W, H, R, r, ax, bx, laneY, headY, gap, xL, xR, rail, laneX: (f: number) => lerp(xL, xR, f) };
  }

  // ── frame ───────────────────────────────────────────────────────────

  private draw(): void {
    const t = now();
    const dt = Math.min(0.1, t - this.last);
    this.last = t;
    if (!this.reducedMotion) this.clock += dt;
    const m = this.model();
    const L = this.layout(m);
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, L.W, L.H);

    if (m.lane !== false) this.drawLane(m, L);
    for (const z of m.zones) this.drawZone(z, m, L);
    if (m.spy) this.drawSpy(m.spy, L);

    // rungs, head (index 0) at the bottom, drawn top-down so the head is on top
    const alive = new Set<number>();
    for (let i = m.rungs.length - 1; i >= 0; i--) {
      const rung = m.rungs[i];
      alive.add(rung.id);
      const target = i === 0 ? L.headY : L.headY - (L.R + L.r + 4) - (i - 1) * L.gap;
      const prev = this.yCache.get(rung.id) ?? target;
      const y = this.reducedMotion ? target : lerp(prev, target, 1 - Math.pow(0.001, dt));
      this.yCache.set(rung.id, y);
      const head = i === 0;
      const rad = head ? L.R : L.r;
      const pa = { x: L.ax, y };
      const pb = { x: L.bx, y };
      const flyingShare = m.flight?.kind === 'share' && m.flight.rungId === rung.id;
      if (rung.a && rung.b) this.drawLink(pa, pb, rung.pattern, rung.link, head ? 1 : 0.55, rad, t, rung.brokeAt, rung.changedAt);
      if (flyingShare && rung.a) {
        const fp = { x: L.laneX(m.flight!.x), y: L.laneY };
        this.drawLink(pa, fp, m.flight!.pattern ?? rung.pattern, m.flight!.link ?? rung.link, head ? 1 : 0.7, rad, t);
      }
      if (rung.a) this.drawOrb(pa, rad, 'A', rung.a, t);
      if (rung.b) this.drawOrb(pb, rad, 'B', rung.b, t);
      if (rung.twisted && rung.b) this.text('⚡', pb.x + rad * 0.9, pb.y - rad * 0.9, 11, C.flip, 'center');
    }
    for (const id of [...this.yCache.keys()]) if (!alive.has(id)) this.yCache.delete(id);

    if (m.lone) this.drawOrb({ x: L.ax, y: L.headY }, L.R, 'lone', m.lone, t);

    this.dockCenter = !!m.dockCenter;
    if (m.dock) this.drawDock(m.dock, m, L, t);
    if (m.flight) this.drawFlight(m.flight, m, L, t);
  }

  // ── pieces ──────────────────────────────────────────────────────────

  private drawLane(m: SceneModel, L: ReturnType<Scene['layout']>): void {
    const g = this.ctx;
    const y = L.laneY;
    const ch = m.channel;
    g.save();
    g.lineCap = 'round';
    // rails
    g.strokeStyle = C.lane;
    g.lineWidth = 2;
    for (const dy of [-L.rail, L.rail]) {
      g.beginPath();
      g.moveTo(L.xL, y + dy);
      g.lineTo(L.xR, y + dy);
      g.stroke();
    }
    if (ch) {
      // recharge fill
      const f = ch.ready ? 1 : ch.recharge;
      const grad = g.createLinearGradient(L.xL, 0, L.xR, 0);
      grad.addColorStop(0, ch.ready ? 'rgba(177,140,255,0.55)' : 'rgba(177,140,255,0.25)');
      grad.addColorStop(1, ch.ready ? 'rgba(71,224,255,0.45)' : 'rgba(71,224,255,0.15)');
      g.strokeStyle = grad;
      g.lineWidth = 3;
      for (const dy of [-L.rail, L.rail]) {
        g.beginPath();
        g.moveTo(L.xL, y + dy);
        g.lineTo(lerp(L.xL, L.xR, f), y + dy);
        g.stroke();
      }
      // launch port
      const pulse = ch.armed ? 0.5 + 0.5 * Math.sin(this.clock * 9) : 0;
      g.beginPath();
      g.arc(L.xL - L.rail * 0.4, y, L.rail * 0.85 + pulse * 3, 0, Math.PI * 2);
      g.strokeStyle = ch.ready ? C.link : ch.armed ? C.link : C.faint;
      g.lineWidth = ch.ready || ch.armed ? 2.5 : 1.5;
      g.stroke();
      const lbl = ch.ready ? 'READY' : ch.armed ? 'ARMED' : 'CHARGING';
      this.text(lbl, L.xL - L.rail * 0.4, y + L.rail + 13, 10, ch.ready ? C.text : C.muted, 'center', 0.14);
    }
    const narrow = L.W < 600;
    const label = narrow ? (m.view === 'circuit' ? '1 QUBIT PER USE' : 'ONE QUBIT AT A TIME') : m.view === 'circuit' ? 'QUANTUM CHANNEL · 1 QUBIT PER USE' : 'CHANNEL · ONE QUBIT AT A TIME';
    const cx = narrow ? L.xL + (L.xR - L.xL) * 0.45 + 24 : (L.xL + L.xR) / 2;
    this.text(label, cx, y + L.rail + 13, narrow ? 9 : 10, C.muted, 'center', 0.12);
    g.restore();
  }

  private drawZone(z: ZoneM, m: SceneModel, L: ReturnType<Scene['layout']>): void {
    const g = this.ctx;
    const x0 = L.laneX(z.x0);
    const x1 = L.laneX(z.x1);
    const y0 = L.laneY - L.rail - 7;
    const hgt = (L.rail + 7) * 2;
    const col = z.kind === 'X' ? C.flip : z.kind === 'Z' ? C.phase : '#9aa0c3';
    g.save();
    g.beginPath();
    g.roundRect(x0, y0, x1 - x0, hgt, 8);
    if (z.state === 'warn') {
      g.setLineDash([5, 5]);
      g.lineDashOffset = -this.clock * 20;
      g.strokeStyle = col;
      g.globalAlpha = 0.55 + 0.25 * Math.sin(this.clock * 6);
      g.lineWidth = 1.5;
      g.stroke();
    } else {
      g.globalAlpha = 0.16;
      g.fillStyle = col;
      g.fill();
      g.globalAlpha = 0.85;
      g.strokeStyle = col;
      g.lineWidth = 1.5;
      g.stroke();
      g.save();
      g.clip();
      g.globalAlpha = 0.5;
      g.strokeStyle = col;
      g.lineWidth = 1.2;
      if (z.kind === 'X') {
        const off = (this.clock * 14) % 14;
        for (let x = x0 - hgt - 14 + off; x < x1 + hgt; x += 14) {
          g.beginPath();
          g.moveTo(x, y0);
          g.lineTo(x + hgt, y0 + hgt);
          g.moveTo(x + hgt, y0);
          g.lineTo(x, y0 + hgt);
          g.stroke();
        }
      } else if (z.kind === 'Z') {
        for (let k = 0; k < 3; k++) {
          g.beginPath();
          for (let x = x0; x <= x1; x += 3) {
            const yy = y0 + hgt * (0.3 + 0.2 * k) + Math.sin((x - x0) / 7 + this.clock * 4 + k) * 4;
            if (x === x0) g.moveTo(x, yy);
            else g.lineTo(x, yy);
          }
          g.stroke();
        }
      } else {
        g.fillStyle = col;
        for (let i = 0; i < 40; i++) {
          const px = x0 + ((Math.sin(i * 12.9898 + Math.floor(this.clock * 12)) * 43758.5453) % 1 + 1) % 1 * (x1 - x0);
          const py = y0 + ((Math.sin(i * 78.233 + Math.floor(this.clock * 12)) * 12543.13) % 1 + 1) % 1 * hgt;
          g.fillRect(px, py, 2, 2);
        }
      }
      g.restore();
    }
    g.restore();
    const name = m.view === 'circuit'
      ? z.kind === '?' ? 'RANDOM PAULI' : `${z.kind} ERROR`
      : z.kind === 'X' ? '✕ FLIP ZONE' : z.kind === 'Z' ? '∿ PHASE ZONE' : '? STATIC';
    this.text(z.state === 'warn' ? `${name} SOON` : name, (x0 + x1) / 2, y0 - 7, 10, col, 'center', 0.12);
  }

  private drawSpy(s: SpyM, L: ReturnType<Scene['layout']>): void {
    const g = this.ctx;
    const x = L.laneX(s.x);
    const y = L.laneY - L.R * 2.5;
    g.save();
    if (s.open) {
      const grad = g.createLinearGradient(0, y, 0, L.laneY + L.R);
      grad.addColorStop(0, 'rgba(255,95,122,0.45)');
      grad.addColorStop(1, 'rgba(255,95,122,0.03)');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x - 4, y + 6);
      g.lineTo(x + 4, y + 6);
      g.lineTo(x + L.R * 0.9, L.laneY + L.R * 0.8);
      g.lineTo(x - L.R * 0.9, L.laneY + L.R * 0.8);
      g.closePath();
      g.fill();
    }
    g.fillStyle = '#1b1f38';
    g.strokeStyle = s.open ? C.bad : C.faint;
    g.lineWidth = 1.5;
    g.beginPath();
    g.ellipse(x, y, 18, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    // eye
    g.beginPath();
    if (s.open) {
      g.ellipse(x, y, 8, 5, 0, 0, Math.PI * 2);
      g.fillStyle = '#fff';
      g.fill();
      g.beginPath();
      g.arc(x, y, 2.6, 0, Math.PI * 2);
      g.fillStyle = C.bad;
      g.fill();
    } else {
      g.moveTo(x - 8, y);
      g.lineTo(x + 8, y);
      g.strokeStyle = C.muted;
      g.stroke();
    }
    g.restore();
    this.text(s.open ? 'SPY · LOOKING' : 'SPY · EYES SHUT', x, y - 16, 10, s.open ? C.bad : C.muted, 'center', 0.12);
    if (s.readAt && now() - s.readAt < 0.8) {
      const k = (now() - s.readAt) / 0.8;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = C.bad;
      g.beginPath();
      g.arc(x, L.laneY, 6 + k * 28, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  private drawFlight(f: FlightM, m: SceneModel, L: ReturnType<Scene['layout']>, t: number): void {
    const p = { x: L.laneX(ease(f.x) * 0.15 + f.x * 0.85), y: L.laneY };
    if (f.kind === 'message' && m.dock) {
      const dockB = this.dockPoints(L).b;
      this.drawLink(p, dockB, f.pattern ?? null, f.link ?? 'linked', 1, L.R * 0.8, t);
    }
    const kind = f.kind === 'share' ? 'B' : f.kind === 'message' ? 'A' : 'lone';
    this.drawOrb(p, f.kind === 'bit' ? L.R * 0.6 : L.R * 0.8, kind, { glyph: f.glyph ?? null }, t);
    if (f.hitAt && now() - f.hitAt < 0.7) {
      const k = (now() - f.hitAt) / 0.7;
      const g = this.ctx;
      g.save();
      g.globalAlpha = 1 - k;
      g.strokeStyle = '#fff';
      g.lineWidth = 2;
      g.beginPath();
      g.arc(p.x, p.y, L.R * (0.8 + k * 1.4), 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
  }

  private dockCenter = false;

  private dockPoints(L: ReturnType<Scene['layout']>): { a: Pt; b: Pt; box: { x: number; y: number; w: number; h: number } } {
    if (this.dockCenter) {
      const sep = L.R * 1.6;
      const y = L.H * 0.44;
      const cx = L.W / 2;
      return {
        a: { x: cx - sep, y },
        b: { x: cx + sep, y },
        box: { x: cx - sep - L.R * 1.5, y: y - L.R * 1.6, w: sep * 2 + L.R * 3, h: L.R * 3.2 },
      };
    }
    const cx = L.bx - L.R * 0.1;
    const y = L.laneY;
    const sep = L.R * 1.05;
    return {
      a: { x: cx - sep, y },
      b: { x: cx + sep * 0.25, y },
      box: { x: cx - sep - L.R * 1.1, y: y - L.R * 1.25, w: sep * 1.25 + L.R * 2.2, h: L.R * 2.5 },
    };
  }

  /** Bob's analyzer: docks both halves, untangles them (CNOT), turns one (H), reads two bits. */
  private drawDock(d: DockM, m: SceneModel, L: ReturnType<Scene['layout']>, t: number): void {
    const g = this.ctx;
    const P = this.dockPoints(L);
    const box = P.box;
    g.save();
    g.beginPath();
    g.roundRect(box.x, box.y, box.w, box.h, 12);
    g.fillStyle = 'rgba(15,18,38,0.92)';
    g.fill();
    g.strokeStyle = d.correct === true ? C.good : d.correct === false ? C.bad : 'rgba(177,140,255,0.6)';
    g.lineWidth = 1.5;
    g.stroke();
    g.restore();
    const circuit = m.view === 'circuit';
    const title = d.desk || d.lone || d.empty ? "BOB'S DESK" : circuit ? 'BELL MEASUREMENT' : "BOB'S ANALYZER";
    this.text(title, box.x + box.w / 2, box.y - 7, 10, C.muted, 'center', 0.14);

    if (d.waiting) {
      this.drawOrb(P.b, L.R * 0.8, 'B', {}, t);
      this.text('waiting for your half…', box.x + box.w / 2, box.y + box.h + 13, 10, C.muted, 'center');
      return;
    }
    if (d.empty) {
      this.text('empty', box.x + box.w / 2, P.a.y, 10, C.faint, 'center');
      this.text('nothing from you yet', box.x + box.w / 2, box.y + box.h + 13, 10, C.muted, 'center');
      return;
    }
    if (d.lone) {
      this.drawOrb({ x: box.x + box.w / 2, y: P.a.y }, L.R * 0.8, 'lone', d.lone, t);
      this.text('one qubit · one question', box.x + box.w / 2, box.y + box.h + 13, 10, C.muted, 'center');
      return;
    }
    const k = this.dockCenter ? 1 : 0.75;
    if (d.desk) {
      this.drawLink(P.a, P.b, d.pattern, d.link, 1, L.R * k, t, d.desk.brokeAt);
      this.drawOrb(P.a, L.R * k, 'A', d.desk.a, t);
      this.drawOrb(P.b, L.R * k, 'B', d.desk.b, t);
      this.text("Alice's half + yours", box.x + box.w / 2, box.y + box.h + 13, 10, C.muted, 'center');
      return;
    }
    const el = this.reducedMotion ? 9 : t - d.t0;
    const p1 = 0.45, p2 = 0.95, p3 = 1.35;
    const bitA = d.bits ? d.bits[0] : null; // PHASE bit
    const bitB = d.bits ? d.bits[1] : null; // FLIP bit
    if (el < p1) {
      this.drawLink(P.a, P.b, d.pattern, d.link, 1, L.R * k, t);
      this.drawOrb(P.a, L.R * k, 'A', {}, t);
      this.drawOrb(P.b, L.R * k, 'B', {}, t);
      this.text(circuit ? 'CNOT' : 'UNTANGLE', box.x + box.w / 2, box.y + box.h + 13, 10, C.link, 'center', 0.14);
      return;
    }
    // after CNOT: Bob's half holds the FLIP bit (▲▼), Alice's the PHASE bit (◀ ▶)
    const turned = el >= p2;
    const aGlyph: Glyph | null = bitA === null ? null : turned ? (bitA === '0' ? 'up' : 'down') : bitA === '0' ? 'right' : 'left';
    const bGlyph: Glyph | null = bitB === null ? null : bitB === '0' ? 'up' : 'down';
    this.drawOrb(P.a, L.R * k, 'A', { glyph: aGlyph, changedAt: d.t0 + (turned ? p2 : p1) }, t);
    this.drawOrb(P.b, L.R * k, 'B', { glyph: bGlyph, changedAt: d.t0 + p1 }, t);
    const step = el < p2 ? (circuit ? 'H' : 'TURN') : el < p3 ? (circuit ? 'MEASURE' : 'READ') : '';
    if (step) this.text(step, box.x + box.w / 2, box.y + box.h + 13, 10, C.link, 'center', 0.14);
    if (el >= p3 && d.bits) {
      const col = d.correct === false ? C.bad : d.correct === true ? C.good : C.text;
      this.text(d.bits, box.x + box.w / 2, box.y + box.h + 22, 20, col, 'center', 0.2, 'mono');
    }
  }

  // ── primitives ──────────────────────────────────────────────────────

  private text(s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left', spacing = 0, family: 'display' | 'mono' = 'display'): void {
    const g = this.ctx;
    g.save();
    g.fillStyle = color;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.font = family === 'mono' ? `500 ${size}px "JetBrains Mono", ui-monospace, monospace` : `600 ${size}px "Space Grotesk", system-ui, sans-serif`;
    if ('letterSpacing' in g && spacing) (g as unknown as { letterSpacing: string }).letterSpacing = `${spacing * size}px`;
    g.fillText(s, x, y);
    g.restore();
  }

  private drawOrb(p: Pt, r: number, who: 'A' | 'B' | 'lone', o: OrbM, t: number): void {
    const g = this.ctx;
    const base = who === 'A' ? C.alice : who === 'B' ? C.bob : '#e6e8ff';
    const hi = who === 'A' ? C.aliceHi : who === 'B' ? C.bobHi : '#ffffff';
    const pop = o.changedAt ? clamp(1 - (t - o.changedAt) / 0.35, 0, 1) : 0;
    const R = r * (1 + 0.18 * pop);
    g.save();
    if (o.dim) g.globalAlpha = 0.4;
    // glow
    const glow = g.createRadialGradient(p.x, p.y, R * 0.2, p.x, p.y, R * 2.1);
    glow.addColorStop(0, `${base}55`);
    glow.addColorStop(1, `${base}00`);
    g.fillStyle = glow;
    g.beginPath();
    g.arc(p.x, p.y, R * 2.1, 0, Math.PI * 2);
    g.fill();
    // body
    const body = g.createRadialGradient(p.x - R * 0.35, p.y - R * 0.4, R * 0.1, p.x, p.y, R);
    body.addColorStop(0, hi);
    body.addColorStop(1, base);
    g.fillStyle = body;
    g.beginPath();
    g.arc(p.x, p.y, R, 0, Math.PI * 2);
    g.fill();
    if (o.glyph) {
      g.fillStyle = 'rgba(7,8,15,0.55)';
      g.beginPath();
      g.arc(p.x, p.y, R * 0.78, 0, Math.PI * 2);
      g.fill();
      this.arrow(p, R * 0.5, o.glyph, '#ffffff');
    } else {
      // shimmer: no definite answer of its own
      g.strokeStyle = 'rgba(7,8,15,0.45)';
      g.lineWidth = Math.max(1.2, R * 0.08);
      for (let i = 0; i < 3; i++) {
        const a0 = this.clock * (1.3 + i * 0.7) + i * 2.1;
        g.beginPath();
        g.arc(p.x, p.y, R * (0.35 + i * 0.17), a0, a0 + Math.PI * (0.55 + 0.2 * i));
        g.stroke();
      }
    }
    g.restore();
  }

  private arrow(p: Pt, s: number, dir: Glyph, color: string): void {
    const g = this.ctx;
    const rot = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[dir];
    g.save();
    g.translate(p.x, p.y);
    g.rotate(rot);
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.9, s * 0.65);
    g.lineTo(-s * 0.9, s * 0.65);
    g.closePath();
    g.fill();
    g.restore();
  }

  /**
   * The link between two halves. pattern bits: [0] = ◀ ▶ agreement (offbeat if 1),
   * [1] = ▲▼ agreement (crossed if 1).
   */
  private drawLink(a: Pt, b: Pt, pattern: Bits | null, state: LinkState, weight: number, rad: number, t: number, brokeAt?: number, changedAt?: number): void {
    const g = this.ctx;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const off = rad * 0.42 * (0.6 + 0.4 * weight);
    const start = rad * 1.05;
    const pA = { x: a.x + (dx / len) * start, y: a.y + (dy / len) * start };
    const pB = { x: b.x - (dx / len) * start, y: b.y - (dy / len) * start };
    const span = Math.hypot(pB.x - pA.x, pB.y - pA.y);
    if (span < 4) return;

    let alpha = 1;
    let cut = 0; // 0..1: how much of the middle has vanished (broken links)
    if (state === 'broken') {
      const k = brokeAt ? clamp((t - brokeAt) / 0.7, 0, 1) : 1;
      if (k >= 1) return;
      alpha = 1 - k;
      cut = 0.2 + 0.8 * k;
    }
    const crossed = state === 'linked' && pattern !== null && pattern[1] === '1';
    const offbeat = state === 'linked' && pattern !== null && pattern[0] === '1';
    const mystery = state === 'uncertain' || state === 'hidden';

    // strand point at parameter u ∈ [0,1], side s = ±1
    const strand = (u: number, sgn: number): Pt => {
      const mx = lerp(pA.x, pB.x, u);
      const my = lerp(pA.y, pB.y, u);
      let o = sgn * off;
      if (crossed) o = sgn * off * Math.cos(Math.PI * smooth(u)); // swaps sides through the middle
      return { x: mx + nx * o, y: my + ny * o };
    };

    const flash = changedAt ? clamp(1 - (t - changedAt) / 0.6, 0, 1) : 0;
    g.save();
    g.globalAlpha = alpha * (0.35 + 0.65 * weight);
    g.lineCap = 'round';
    // Each strand keeps one colour end to end: when FLIP crosses them, the colours visibly swap sides.
    const cols = mystery ? ['#8a90b5', '#8a90b5'] : [C.bob, C.alice];
    for (const [i, sgn] of [[0, 1], [1, -1]] as const) {
      const grad = g.createLinearGradient(pA.x, pA.y, pB.x, pB.y);
      grad.addColorStop(0, cols[i]);
      grad.addColorStop(0.5, mystery ? '#8a90b5' : mixHex(cols[i], C.link, 0.45));
      grad.addColorStop(1, cols[i]);
      g.strokeStyle = grad;
      g.lineWidth = (1.4 + 1.6 * weight) * (1 + flash * 0.8);
      if (mystery) g.setLineDash([4, 5]);
      g.beginPath();
      const N = 40;
      let pen = false;
      for (let k = 0; k <= N; k++) {
        const u = k / N;
        if (cut > 0 && Math.abs(u - 0.5) < cut / 2) {
          pen = false;
          continue;
        }
        const q = strand(u, sgn);
        if (!pen) g.moveTo(q.x, q.y);
        else g.lineTo(q.x, q.y);
        pen = true;
      }
      g.stroke();
    }
    g.setLineDash([]);

    if (state === 'linked' && pattern !== null) {
      // beats travelling along both strands: rungs when in step, zigzag when offbeat
      const n = Math.max(3, Math.round(span / (rad * 1.25)));
      const phase = (this.clock * 0.35) % 1;
      g.lineWidth = 1 + weight;
      for (let k = 0; k < n; k++) {
        const u1 = ((k + phase) / n) % 1;
        const u2 = offbeat ? ((k + 0.5 + phase) / n) % 1 : u1;
        const q1 = strand(u1, 1);
        const q2 = strand(u2, -1);
        const fade = Math.sin(Math.PI * Math.min(u1, u2 + 0.0001)) ** 0.5;
        g.globalAlpha = alpha * (0.25 + 0.6 * weight) * fade;
        g.strokeStyle = offbeat ? C.phase : C.link;
        g.beginPath();
        g.moveTo(q1.x, q1.y);
        g.lineTo(q2.x, q2.y);
        g.stroke();
        g.fillStyle = '#ffffff';
        g.globalAlpha = alpha * (0.5 + 0.5 * weight) * fade;
        g.beginPath();
        g.arc(q1.x, q1.y, 1.4 + weight * 1.3, 0, Math.PI * 2);
        g.arc(q2.x, q2.y, 1.4 + weight * 1.3, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    if (mystery) this.text('?', (pA.x + pB.x) / 2, (pA.y + pB.y) / 2, 12 + 6 * weight, '#c9cdf0', 'center');
  }
}

function mixHex(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `#${x.map((v, i) => Math.round(lerp(v, y[i], t)).toString(16).padStart(2, '0')).join('')}`;
}

/** Smoothstep. */
function smooth(u: number): number {
  const x = clamp(u, 0, 1);
  return x * x * (3 - 2 * x);
}

/** Small static SVG of a pattern, for cards and badges (same visual language as the stage). */
export function patternSvg(bits: Bits | null, size = 56): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const w = size;
  const h = Math.round(size * 0.42);
  const svgEl = document.createElementNS(ns, 'svg');
  svgEl.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svgEl.setAttribute('width', String(w));
  svgEl.setAttribute('height', String(h));
  svgEl.setAttribute('class', 'pat');
  svgEl.setAttribute('aria-hidden', 'true');
  const crossed = bits?.[1] === '1';
  const offbeat = bits?.[0] === '1';
  const off = h * 0.28;
  const cy = h / 2;
  const pt = (u: number, sgn: number) => {
    const x = 4 + u * (w - 8);
    const o = crossed ? sgn * off * Math.cos(Math.PI * smooth(u)) : sgn * off;
    return [x, cy + o];
  };
  const path = (sgn: number) => {
    let d = '';
    for (let k = 0; k <= 24; k++) {
      const [x, y] = pt(k / 24, sgn);
      d += `${k ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
    }
    return d;
  };
  const mk = (tag: string, attrs: Record<string, string | number>) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
    svgEl.append(e);
    return e;
  };
  if (!bits) {
    mk('line', { x1: 4, y1: cy, x2: w - 4, y2: cy, stroke: '#8a90b5', 'stroke-dasharray': '3 3', 'stroke-width': 1.5 });
    return svgEl;
  }
  mk('path', { d: path(1), fill: 'none', stroke: C.alice, 'stroke-width': 1.8, 'stroke-linecap': 'round' });
  mk('path', { d: path(-1), fill: 'none', stroke: C.bob, 'stroke-width': 1.8, 'stroke-linecap': 'round' });
  const n = 4;
  for (let k = 0; k < n; k++) {
    const u1 = (k + 0.5) / n;
    const u2 = offbeat ? (k + 1) / n : u1;
    const [x1, y1] = pt(u1, 1);
    const [x2, y2] = pt(Math.min(u2, 0.98), -1);
    mk('line', { x1, y1, x2, y2, stroke: offbeat ? C.phase : C.link, 'stroke-width': 1.3 });
  }
  return svgEl;
}
