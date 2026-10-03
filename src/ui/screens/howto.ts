import type { AppCtx, Screen } from '../app';
import { button, h } from '../dom';
import { patternBadge, topbar } from '../components';
import type { Bits } from '../../quantum/superdenseCoding';

export function howtoScreen(ctx: AppCtx): Screen {
  const v = ctx.view();
  const keys: [string, string][] = [
    ['Space / Enter', 'Main action (send, next…)'],
    ['F', 'FLIP your half (X)'],
    ['P', 'PHASE your half (Z)'],
    ['S', 'SHARE: send Bob his half of a new pair'],
    ['B', 'BIT BY BIT: send without a pair (two qubits)'],
    ['Q / W', 'Ask ▲▼ / ask ◀ ▶'],
    ['O / L', "Bob asks ▲▼ / ◀ ▶ (when available)"],
    ['A', "Bob's analyzer"],
    ['N', 'New pair'],
    ['V', 'Switch GAME ↔ CIRCUIT names'],
    ['M', 'Sound on/off'],
    ['Esc', 'Back'],
  ];
  const el = h('div', { class: 'screen' },
    topbar(ctx, 'HOW TO PLAY', 'THE OTHER HALF', [], '/'),
    h('article', { class: 'prose' },
      h('h2', {}, 'The goal'),
      h('p', {}, 'Bob needs two-bit messages: 00, 01, 10 or 11. The channel between you carries one qubit at a time. Your job: get each message to Bob correctly, before its fuse burns out.'),
      h('h2', {}, 'The trick'),
      h('p', {}, 'When the channel is quiet, SHARE: send Bob his half of an entangled pair. It carries no message. Later, shape the link with FLIP and PHASE so it matches the message, then SEND your half. One qubit crosses, and Bob reads two bits.'),
      h('h3', {}, 'Read the link'),
      h('div', { style: 'display:grid;gap:10px;margin:8px 0' }, ...(['00', '01', '10', '11'] as Bits[]).map((b) => h('div', { style: 'display:flex;gap:14px;align-items:center' }, h('span', { class: 'mono', style: 'font-size:20px;width:34px' }, b), patternBadge(b, v)))),
      h('p', { class: 'muted' }, 'Crossed strands mean the halves give opposite ▲▼ answers. FLIP makes that happen. A zigzag (offbeat) means opposite ◀ ▶ answers. PHASE makes that happen. The message card shows the pattern it needs.'),
      h('h3', {}, 'Keys'),
      h('div', { class: 'keys' }, ...keys.flatMap(([k, d]) => [h('kbd', {}, k), h('span', {}, d)])),
      h('h3', {}, 'Tips'),
      h('ul', {},
        h('li', {}, 'Press SEND or SHARE while the channel is charging. The press is remembered and fires the instant it opens.'),
        h('li', {}, 'Zones on the channel twist whatever crosses them. Wait for them to pass, or cancel the twist with your own move first.'),
        h('li', {}, 'A spy can read the channel. Your paired qubits look like pure noise to it, but looking breaks the pair.')),
      h('div', { style: 'margin-top:20px;display:flex;gap:10px;flex-wrap:wrap' },
        button('Start Level 1', { cls: 'primary', onClick: () => ctx.go('/level/1') }),
        button('Quantum Lab', { onClick: () => ctx.go('/lab') }))));
  return { el, onKey: (e) => (e.key === 'Escape' ? (ctx.go('/'), true) : false) };
}
