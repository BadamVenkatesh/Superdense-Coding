/** Shared UI pieces. All physics comes from src/quantum; this file only presents it. */
import { audio } from '../audio/audio';
import { bellForBits, type Bits } from '../quantum/bellStates';
import type { Move } from '../quantum/superdenseCoding';
import type { ViewMode } from '../game/store';
import type { LevelDef } from '../game/levels';
import { onViewChange, type AppCtx } from './app';
import { button, h, s, starsHtml } from './dom';
import { patternSvg } from './scene';

export const PATTERN_DESC: Record<Bits, string> = {
  '00': 'same ▲▼ · same ◀ ▶',
  '01': 'opposite ▲▼ · same ◀ ▶',
  '10': 'same ▲▼ · opposite ◀ ▶',
  '11': 'opposite ▲▼ · opposite ◀ ▶',
};

export function patternName(bits: Bits | null, view: ViewMode): string {
  if (!bits) return view === 'circuit' ? 'not a Bell state' : 'UNKNOWN';
  const info = bellForBits(bits);
  return view === 'circuit' ? info.symbol : info.pattern;
}

export const moveName = (m: Move, view: ViewMode): string => (view === 'circuit' ? (m === 'X' ? 'X' : 'Z') : m === 'X' ? 'FLIP' : 'PHASE');

/** A pattern badge: mini link drawing + name + plain description. */
export function patternBadge(bits: Bits | null, view: ViewMode, opts: { size?: number; desc?: boolean } = {}): HTMLElement {
  return h('span', { class: 'patbadge', style: 'display:inline-flex;align-items:center;gap:8px' },
    patternSvg(bits, opts.size ?? 48),
    h('span', { style: 'display:grid;line-height:1.15' },
      h('span', { class: 'val' }, patternName(bits, view)),
      opts.desc === false || !bits ? null : h('span', { class: 'agree' }, view === 'circuit' ? bellForBits(bits).ket : PATTERN_DESC[bits])));
}

/** Level top bar: back, title, extras, view toggle, sound toggle. */
export function topbar(ctx: AppCtx, title: string, sub: string, extras: (Node | null)[] = [], back = '/levels'): HTMLElement {
  const viewBtn = h('button', { class: 'btn small ghost icon-btn', type: 'button', title: 'Switch between GAME names and CIRCUIT (formal) names (V)' }) as HTMLButtonElement;
  const syncView = () => {
    viewBtn.textContent = ctx.view() === 'game' ? 'GAME' : 'CIRCUIT';
    viewBtn.setAttribute('aria-label', `View: ${viewBtn.textContent}. Press to switch.`);
  };
  syncView();
  viewBtn.addEventListener('click', () => ctx.setView(ctx.view() === 'game' ? 'circuit' : 'game'));
  const off = onViewChange(syncView);
  const sound = h('button', { class: 'btn small ghost icon-btn', type: 'button' }) as HTMLButtonElement;
  const syncSound = () => {
    sound.textContent = ctx.store.data.settings.sound ? '♪ on' : '♪ off';
    sound.setAttribute('aria-label', `Sound ${ctx.store.data.settings.sound ? 'on' : 'off'} (M)`);
  };
  syncSound();
  sound.addEventListener('click', () => {
    ctx.store.setSetting('sound', !ctx.store.data.settings.sound);
    audio.enabled = ctx.store.data.settings.sound;
    if (audio.enabled) audio.unlock();
    syncSound();
  });
  const bar = h('header', { class: 'topbar' },
    h('button', { class: 'btn small ghost icon-btn', type: 'button', 'aria-label': 'Back (Esc)', onclick: () => ctx.go(back) }, '←'),
    h('div', { class: 'title' }, h('span', { class: 'lv' }, sub), h('span', {}, title)),
    h('div', { class: 'spacer' }),
    ...extras,
    viewBtn,
    sound);
  (bar as HTMLElement & { cleanup?: () => void }).cleanup = () => off();
  return bar;
}

/** Message card: two big bits (PHASE bit, FLIP bit), the pattern that carries them, and a fuse. */
export function messageCard(bits: Bits, view: ViewMode, opts: { target?: boolean; sending?: boolean; fuse?: number; label?: string } = {}): HTMLElement {
  const fuse = opts.fuse;
  return h('div', { class: `msg ${opts.target ? 'target' : ''} ${opts.sending ? 'sending' : ''}`, 'aria-label': `Message ${bits[0]} ${bits[1]}${opts.target ? ', next to send' : ''}` },
    h('div', { class: 'bits' }, h('span', { class: 'p' }, bits[0]), h('span', { class: 'f' }, bits[1])),
    patternSvg(bits, 54),
    h('div', { class: 'nm' }, opts.label ?? patternName(bits, view)),
    fuse === undefined || !Number.isFinite(fuse) ? null : h('div', { class: `fuse ${fuse < 0.3 ? 'low' : ''}` }, h('i', { style: `width:${Math.round(fuse * 100)}%` })));
}

export interface CompleteOpts {
  level: LevelDef;
  stars: number;
  ctx: AppCtx;
  extra?: Node | null;
  title?: string;
  onReplay: () => void;
  won?: boolean;
}

/** End-of-level card: names what the player just did. Text only AFTER the discovery. */
export function completeOverlay(o: CompleteOpts): HTMLElement {
  const { level, ctx } = o;
  const won = o.won !== false;
  const next = level.id + 1;
  const hasNext = next <= 10;
  const close = () => overlay.remove();
  const overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Level ${level.id} ${won ? 'cleared' : 'failed'}` },
    h('div', { class: 'modal' },
      h('div', { class: 'kicker' }, `Level ${level.id} · ${level.title}`),
      h('h2', {}, o.title ?? (won ? 'Cleared' : 'Signal lost')),
      won ? h('div', { class: 'stars', html: starsHtml(o.stars) }) : null,
      h('p', { class: 'insight' }, won ? level.insight : 'The rush outran the channel. Bank more pairs while it’s quiet, and press early: a press fires the moment the channel opens.'),
      won ? h('div', { class: 'formal' }, h('b', {}, 'In physics: '), level.formal) : null,
      o.extra ?? null,
      h('div', { class: 'actions' },
        button(won ? 'Replay' : 'Try again', { cls: won ? '' : 'primary', key: 'R', onClick: () => { close(); o.onReplay(); } }),
        won && hasNext ? button(`Next: ${next}`, { cls: 'primary', key: '↵', onClick: () => { close(); ctx.go(`/level/${next}`); } }) : null,
        won && !hasNext ? button('Arcade', { cls: 'primary', key: '↵', onClick: () => { close(); ctx.go('/arcade'); } }) : null,
        button('Levels', { cls: 'ghost', onClick: () => { close(); ctx.go('/levels'); } }),
      )));
  overlay.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'r') { e.preventDefault(); e.stopPropagation(); close(); o.onReplay(); }
    if (k === 'enter' && won) { e.preventDefault(); e.stopPropagation(); close(); ctx.go(hasNext ? `/level/${next}` : '/arcade'); }
  });
  setTimeout(() => overlay.querySelector<HTMLButtonElement>('.btn.primary')?.focus(), 50);
  return overlay;
}

/**
 * The superdense coding circuit with Alice's actual moves, for CIRCUIT view.
 * q0 = Alice (her qubit travels), q1 = Bob (his half was shared earlier).
 */
export function circuitSvg(moves: readonly Move[], stage: 'share' | 'encode' | 'sent' | 'decoded' = 'encode', bits?: Bits | null): SVGSVGElement {
  const gates = moves.length ? moves : [];
  const W = 640 + Math.max(0, gates.length - 2) * 44;
  const H = 120;
  const y0 = 38;
  const y1 = 88;
  const svgEl = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Circuit: H and CNOT make the pair; Alice applies ${gates.join(' then ') || 'nothing'}; Bob applies CNOT, H and measures.` });
  const wire = (y: number) => svgEl.append(s('line', { x1: 60, y1: y, x2: W - 40, y2: y, stroke: '#3b4066', 'stroke-width': 2 }));
  wire(y0);
  wire(y1);
  const t = (x: number, y: number, str: string, col = '#f1f2ff', size = 13, anchor = 'middle') =>
    svgEl.append(s('text', { x, y, fill: col, 'font-size': size, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': anchor, 'dominant-baseline': 'middle' }, str));
  t(30, y0, 'q0', '#ff8a5c', 12);
  t(30, y1, 'q1', '#47e0ff', 12);
  t(30, y0 + 15, 'Alice', '#9aa0c3', 9);
  t(30, y1 + 15, 'Bob', '#9aa0c3', 9);
  const box = (x: number, y: number, label: string, col = '#b18cff', on = true) => {
    svgEl.append(s('rect', { x: x - 15, y: y - 15, width: 30, height: 30, rx: 6, fill: on ? '#1b1f3a' : '#12152a', stroke: on ? col : '#3b4066', 'stroke-width': 1.5 }));
    t(x, y + 1, label, on ? col : '#6b7196', 14);
  };
  const cnot = (x: number, on = true) => {
    const col = on ? '#b18cff' : '#3b4066';
    svgEl.append(s('line', { x1: x, y1: y0, x2: x, y2: y1 + 11, stroke: col, 'stroke-width': 2 }));
    svgEl.append(s('circle', { cx: x, cy: y0, r: 5, fill: col }));
    svgEl.append(s('circle', { cx: x, cy: y1, r: 11, fill: 'none', stroke: col, 'stroke-width': 2 }));
  };
  const sep = (x: number, label: string) => {
    svgEl.append(s('line', { x1: x, y1: 14, x2: x, y2: H - 14, stroke: '#2a2f55', 'stroke-dasharray': '4 4' }));
    t(x, 10, label, '#6b7196', 9);
  };
  // 1. pair source
  box(100, y0, 'H');
  cnot(145);
  sep(178, 'share (earlier)');
  // 2. Alice's moves
  let x = 215;
  if (!gates.length) t(x + 10, y0, 'I', '#6b7196', 14);
  for (const m of gates) {
    box(x, y0, m, m === 'X' ? '#ff5fd2' : '#ffd166');
    x += 44;
  }
  const xs = Math.max(x + 6, 270);
  sep(xs, 'send q0 →');
  // 3. Bob's Bell measurement
  const on = stage === 'decoded' || stage === 'sent';
  cnot(xs + 45, on);
  box(xs + 92, y0, 'H', '#b18cff', on);
  const meter = (mx: number, y: number) => {
    svgEl.append(s('rect', { x: mx - 16, y: y - 14, width: 32, height: 28, rx: 5, fill: '#1b1f3a', stroke: on ? '#5ee59a' : '#3b4066', 'stroke-width': 1.5 }));
    svgEl.append(s('path', { d: `M${mx - 9},${y + 6} A10,10 0 0 1 ${mx + 9},${y + 6}`, fill: 'none', stroke: on ? '#5ee59a' : '#6b7196', 'stroke-width': 1.5 }));
    svgEl.append(s('line', { x1: mx, y1: y + 6, x2: mx + 7, y2: y - 6, stroke: on ? '#5ee59a' : '#6b7196', 'stroke-width': 1.5 }));
  };
  meter(xs + 145, y0);
  meter(xs + 145, y1);
  if (bits && stage === 'decoded') {
    t(xs + 185, y0, bits[0], '#ffd166', 16);
    t(xs + 185, y1, bits[1], '#ff5fd2', 16);
  }
  svgEl.setAttribute('width', String(W));
  return svgEl;
}

/** A goals checklist. */
export function goalsList(items: { text: string; done: boolean; now?: boolean }[]): HTMLElement {
  return h('ul', { class: 'goals' }, ...items.map((g) => h('li', { class: g.done ? 'done' : g.now ? 'now' : '' }, g.text)));
}

export function glyphText(basis: 'Z' | 'X', outcome: 0 | 1): string {
  return basis === 'Z' ? (outcome === 0 ? '▲' : '▼') : outcome === 0 ? '▶' : '◀';
}

export function glyphOf(basis: 'Z' | 'X', outcome: 0 | 1): 'up' | 'down' | 'right' | 'left' {
  return basis === 'Z' ? (outcome === 0 ? 'up' : 'down') : outcome === 0 ? 'right' : 'left';
}
