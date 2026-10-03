/** Minimal DOM helpers (no framework). */
import { audio } from '../audio/audio';
type Attrs = Record<string, string | number | boolean | EventListener | undefined | null>;
export type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    else if (k === 'class') el.className = String(v);
    else if (k === 'html') el.innerHTML = String(v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, ...children: (SVGElement | string)[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const c of children) el.append(c);
  return el;
}

export interface ButtonOpts {
  key?: string;
  cls?: string;
  title?: string;
  id?: string;
  onClick: () => void;
}

/** A game button with a visible keyboard hint. */
export function button(label: string | Node, opts: ButtonOpts): HTMLButtonElement {
  const b = h('button', { class: `btn ${opts.cls ?? ''}`, type: 'button', title: opts.title, id: opts.id },
    typeof label === 'string' ? h('span', {}, label) : label,
    opts.key ? h('span', { class: 'key', 'aria-hidden': 'true' }, opts.key) : null);
  if (opts.title) b.setAttribute('aria-label', opts.title);
  b.addEventListener('click', () => {
    if (b.disabled || b.classList.contains('is-off')) {
      shake(b);
      return;
    }
    opts.onClick();
  });
  return b;
}

export function pressFlash(b: HTMLElement | null | undefined): void {
  if (!b) return;
  b.classList.add('is-pressed');
  setTimeout(() => b.classList.remove('is-pressed'), 120);
}

export function shake(b: HTMLElement | null | undefined): void {
  audio.deny();
  if (!b) return;
  b.classList.remove('shake');
  void b.offsetWidth;
  b.classList.add('shake');
}

export function setOff(b: HTMLElement, off: boolean, reason = ''): void {
  b.classList.toggle('is-off', off);
  b.setAttribute('aria-disabled', String(off));
  if (reason) b.title = reason;
}

export function starsHtml(n: number, max = 3): string {
  let out = '';
  for (let i = 0; i < max; i++) out += i < n ? '★' : '<span class="off">★</span>';
  return out;
}

export function heartsHtml(n: number, max: number): string {
  if (!Number.isFinite(max)) return '<span class="muted" style="letter-spacing:0">practice</span>';
  let out = '';
  for (let i = 0; i < max; i++) out += i < n ? '♥' : '<span class="off">♥</span>';
  return out;
}

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');

/** Render "10" with the PHASE bit and FLIP bit coloured, plus a screen-reader label. */
export function bitsEl(bits: string, cls = 'bits'): HTMLElement {
  return h('span', { class: cls, 'aria-label': `message ${bits.split('').join(' ')}` },
    h('span', { class: 'p' }, bits[0]), h('span', { class: 'f' }, bits[1]));
}

/** Children list without the null/false placeholders used for optional parts. */
export const kids = (...items: Child[]): (Node | string)[] =>
  items.filter((c): c is Node | string | number => c !== null && c !== undefined && c !== false).map((c) => (typeof c === 'number' ? String(c) : c));
