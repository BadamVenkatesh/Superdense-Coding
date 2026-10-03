/**
 * QUANTUM LAB: optional. Everything the game hides, laid bare and live:
 * amplitudes, kets, Bell decomposition, agreements, reduced states, the decoding circuit.
 */
import { abs2, fmt as cfmt, type Complex } from '../../quantum/complex';
import { applyCNOT, applyGate, GATES, type GateName } from '../../quantum/gates';
import { expectation, isMaximallyMixed, measureAll, reducedDensity } from '../../quantum/measurement';
import { BELL_INFO, BELL_NAMES, bellDecomposition, identifyBell, ALL_BITS } from '../../quantum/bellStates';
import { createPair, decodeSteps, encode, movesFor, type Bits } from '../../quantum/superdenseCoding';
import { basisState, basisLabel, toKet, type State } from '../../quantum/state';
import { seeded } from '../../quantum/rng';
import type { AppCtx, Screen } from '../app';
import { button, h } from '../dom';
import { circuitSvg, patternBadge, topbar } from '../components';

type Op = string;

export function labScreen(ctx: AppCtx): Screen {
  let state: State = createPair();
  let ops: Op[] = ['H(q0)', 'CNOT(q0→q1)'];
  let decode: { stage: 0 | 1 | 2 | 3; reading: string | null } = { stage: 0, reading: null };
  const rng = seeded(`lab-${Date.now()}`);

  const ampBox = h('div', { class: 'amps', role: 'img' });
  const ket = h('div', { class: 'ket', 'aria-live': 'polite' });
  const opsLine = h('div', { class: 'agree mono', style: 'margin-top:6px' });
  const bellBox = h('div');
  const agreeBox = h('div');
  const rhoBox = h('div', { style: 'display:flex;gap:16px;flex-wrap:wrap' });
  const decodeBox = h('div');
  const circuitBox = h('div', { class: 'circuit' });

  const apply = (label: string, f: (s: State) => State) => {
    state = f(state);
    ops.push(label);
    decode = { stage: 0, reading: null };
    render();
  };
  const gateBtn = (g: GateName, q: 0 | 1) => button(`${g}`, { cls: `small ${q === 0 ? 'alice-btn' : 'bob-btn'}`, title: `${g} on q${q} (${q === 0 ? 'Alice' : 'Bob'})`, onClick: () => apply(`${g}(q${q})`, (s) => applyGate(s, g, q)) });

  const preset = (bits: Bits) => button(bits, { cls: 'small', title: `Bell pair, then Alice's moves for ${bits}`, onClick: () => {
    state = encode(createPair(), movesFor(bits));
    ops = ['H(q0)', 'CNOT(q0→q1)', ...movesFor(bits).map((m) => `${m}(q0)`)];
    decode = { stage: 0, reading: null };
    render();
  } });

  function matrix(m: Complex[][], cls = 'mat'): HTMLElement {
    return h('div', { class: cls }, ...m.flat().map((c) => h('span', {}, cfmt(c, 2))));
  }

  function render() {
    // amplitudes
    ampBox.setAttribute('aria-label', `Amplitudes: ${state.amps.map((a, i) => `${basisLabel(i, 2)} ${cfmt(a, 3)}`).join(', ')}`);
    ampBox.replaceChildren(...state.amps.map((a, i) => {
      const mag = Math.sqrt(abs2(a));
      const real = Math.abs(a.im) < 1e-9;
      const neg = real ? a.re < 0 : false;
      const hgt = Math.round(mag * 50);
      const col = real ? (neg ? 'var(--phase)' : 'var(--link)') : 'var(--bob)';
      return h('div', { class: 'amp' },
        h('div', { class: 'col' }, h('i', { style: `height:${hgt}%;bottom:${neg ? 50 - hgt : 50}%;background:${col}` })),
        h('span', { class: 'lbl' }, `|${basisLabel(i, 2)}⟩`),
        h('span', { class: 'num' }, cfmt(a, 3)),
        h('span', { class: 'num' }, `P=${abs2(a).toFixed(2)}`));
    }));
    ket.textContent = `|ψ⟩ = ${toKet(state)}`;
    opsLine.textContent = `applied (time order): ${ops.join(' → ') || '—'}`;
    // Bell
    const id = identifyBell(state);
    const dec = bellDecomposition(state);
    bellBox.replaceChildren(
      id ? h('div', { style: 'margin-bottom:8px' }, patternBadge(id.info.bits, 'circuit'), ' ', h('span', { class: 'agree' }, `= ${id.info.symbol} · game name ${id.info.pattern}${Math.abs(id.phase.re + 1) < 1e-9 ? ' · global phase −1 (unobservable)' : ''}`))
        : h('div', { class: 'agree', style: 'margin-bottom:8px' }, 'Not a single Bell state. The analyzer would give a mix of outcomes:'),
      h('table', { class: 'tbl' },
        h('tr', {}, h('th', {}, 'Bell state'), h('th', {}, 'game'), h('th', {}, 'decodes to'), h('th', {}, 'probability')),
        ...BELL_NAMES.map((n) => h('tr', {}, h('td', {}, BELL_INFO[n].symbol), h('td', {}, BELL_INFO[n].pattern), h('td', { class: 'mono' }, BELL_INFO[n].bits), h('td', { class: 'mono' }, dec[n].toFixed(3))))));
    // agreements
    const zz = expectation(state, 'ZZ');
    const xx = expectation(state, 'XX');
    const word = (v: number) => (v > 0.999 ? 'always SAME' : v < -0.999 ? 'always OPPOSITE' : Math.abs(v) < 1e-9 ? 'no relation' : 'partly');
    agreeBox.replaceChildren(h('table', { class: 'tbl' },
      h('tr', {}, h('th', {}, 'observable'), h('th', {}, 'value'), h('th', {}, 'meaning')),
      h('tr', {}, h('td', {}, '⟨Z⊗Z⟩'), h('td', { class: 'mono' }, zz.toFixed(3)), h('td', {}, `▲▼ answers ${word(zz)}`)),
      h('tr', {}, h('td', {}, '⟨X⊗X⟩'), h('td', { class: 'mono' }, xx.toFixed(3)), h('td', {}, `◀ ▶ answers ${word(xx)}`)),
      h('tr', {}, h('td', {}, '⟨Z⊗I⟩'), h('td', { class: 'mono' }, expectation(state, 'ZI').toFixed(3)), h('td', {}, 'Alice’s own ▲▼ bias')),
      h('tr', {}, h('td', {}, '⟨I⊗Z⟩'), h('td', { class: 'mono' }, expectation(state, 'IZ').toFixed(3)), h('td', {}, 'Bob’s own ▲▼ bias'))));
    // reduced states
    const ra = reducedDensity(state, 0);
    const rb = reducedDensity(state, 1);
    rhoBox.replaceChildren(
      h('div', {}, h('div', { class: 'agree' }, 'ρ_Alice (q0 alone)'), matrix(ra), h('div', { class: 'agree' }, isMaximallyMixed(ra) ? '= I/2: pure noise on its own' : 'not maximally mixed')),
      h('div', {}, h('div', { class: 'agree' }, 'ρ_Bob (q1 alone)'), matrix(rb), h('div', { class: 'agree' }, isMaximallyMixed(rb) ? '= I/2: pure noise on its own' : 'not maximally mixed')));
    // decoding steps
    const steps = decodeSteps(state);
    const rows: Node[] = [h('div', { class: 'agree' }, `0. received: ${toKet(state)}`)];
    if (decode.stage >= 1) rows.push(h('div', { class: 'agree' }, `1. after CNOT(q0→q1): ${toKet(steps.afterCNOT)}`));
    if (decode.stage >= 2) rows.push(h('div', { class: 'agree' }, `2. after H(q0): ${toKet(steps.afterH)}`));
    if (decode.stage >= 3 && decode.reading) rows.push(h('div', {}, '3. measure both: ', h('b', { class: 'mono' }, decode.reading)));
    decodeBox.replaceChildren(...rows);
    const movesNow = ops.filter((o) => /^[XZ]\(q0\)$/.test(o)).map((o) => o[0] as 'X' | 'Z');
    circuitBox.replaceChildren(circuitSvg(movesNow, decode.stage >= 3 ? 'decoded' : 'encode', (decode.reading as Bits) ?? null));
  }

  const el = h('div', { class: 'screen' },
    topbar(ctx, 'QUANTUM LAB', 'OPTIONAL', [], '/'),
    h('p', { class: 'muted', style: 'margin:6px 0 0;max-width:820px' }, 'Everything the game shows as links and lamps, written out. You never need this to play. The convention: |q0 q1⟩, with q0 = Alice (her qubit travels) and q1 = Bob (his half was shared earlier). Gates are listed in time order.'),
    h('div', { class: 'lab-grid' },
      h('section', { class: 'card panel', 'aria-label': 'State' },
        h('h4', {}, 'Two-qubit state'),
        h('div', { class: 'lab-row' },
          button('|00⟩', { cls: 'small', onClick: () => { state = basisState(2, 0); ops = []; decode = { stage: 0, reading: null }; render(); } }),
          button('Make Bell pair', { cls: 'small primary', onClick: () => { state = createPair(); ops = ['H(q0)', 'CNOT(q0→q1)']; decode = { stage: 0, reading: null }; render(); } }),
          h('span', { class: 'agree' }, 'Message presets:'), ...ALL_BITS.map(preset)),
        h('div', { class: 'lab-row' }, h('span', { class: 'alice', style: 'font-size:13px;width:110px' }, 'q0 · Alice'), gateBtn('X', 0), gateBtn('Z', 0), gateBtn('Y', 0), gateBtn('H', 0)),
        h('div', { class: 'lab-row' }, h('span', { class: 'bob', style: 'font-size:13px;width:110px' }, 'q1 · Bob'), gateBtn('X', 1), gateBtn('Z', 1), gateBtn('Y', 1), gateBtn('H', 1)),
        h('div', { class: 'lab-row' }, button('CNOT q0→q1', { cls: 'small', onClick: () => apply('CNOT(q0→q1)', (s) => applyCNOT(s, 0, 1)) }), button('CNOT q1→q0', { cls: 'small', onClick: () => apply('CNOT(q1→q0)', (s) => applyCNOT(s, 1, 0)) })),
        ampBox, ket, opsLine,
        h('p', { class: 'agree' }, 'Bars: violet = positive amplitude, yellow = negative, cyan = complex. Heights show |amplitude|.')),
      h('section', { class: 'card panel', 'aria-label': 'Bell basis' }, h('h4', {}, 'Which Bell state?'), bellBox),
      h('section', { class: 'card panel', 'aria-label': 'Agreements' }, h('h4', {}, 'The two agreements'), agreeBox,
        h('p', { class: 'agree' }, 'Z⊗Z and X⊗X commute, so a pair can have definite values for both at once. Those two ±1 values ARE the two bits.')),
      h('section', { class: 'card panel', 'aria-label': 'Each half alone' }, h('h4', {}, 'Each half on its own'), rhoBox,
        h('p', { class: 'agree' }, 'For every message, both halves stay at I/2. That’s why the travelling qubit alone tells a spy nothing, and why Alice’s move can’t signal Bob instantly.')),
      h('section', { class: 'card panel', 'aria-label': 'Decoding' }, h('h4', {}, 'Bob’s analyzer, step by step'),
        h('div', { class: 'lab-row' },
          button('1 · CNOT', { cls: 'small', onClick: () => { decode.stage = Math.max(decode.stage, 1) as 1; render(); } }),
          button('2 · H on q0', { cls: 'small', onClick: () => { decode.stage = Math.max(decode.stage, 2) as 2; render(); } }),
          button('3 · Measure', { cls: 'small primary', onClick: () => { const m = measureAll(decodeSteps(state).afterH, rng); decode = { stage: 3, reading: m.bits }; render(); } })),
        decodeBox, circuitBox),
      h('section', { class: 'card panel', 'aria-label': 'Reference' }, h('h4', {}, 'Reference'),
        h('table', { class: 'tbl' },
          h('tr', {}, h('th', {}, 'msg'), h('th', {}, 'Alice does'), h('th', {}, 'state'), h('th', {}, 'ZZ'), h('th', {}, 'XX'), h('th', {}, 'decodes')),
          ...ALL_BITS.map((b) => {
            const info = BELL_INFO[BELL_NAMES.find((n) => BELL_INFO[n].bits === b)!];
            return h('tr', {}, h('td', { class: 'mono' }, b), h('td', {}, movesFor(b).join(' then ') || 'I'), h('td', {}, `${info.symbol} ${info.ket}`), h('td', { class: 'mono' }, info.zz > 0 ? '+1' : '−1'), h('td', { class: 'mono' }, info.xx > 0 ? '+1' : '−1'), h('td', { class: 'mono' }, b));
          })),
        h('div', { class: 'lab-row', style: 'gap:18px;margin-top:12px' },
          ...(['I', 'X', 'Z', 'Y', 'H'] as GateName[]).map((g) => h('div', {}, h('div', { class: 'agree' }, g), matrix(GATES[g].map((r) => [...r]))))),
        h('ul', { class: 'agree', style: 'padding-left:18px' },
          h('li', {}, '“X then Z” is the matrix Z·X = iY. “Z then X” gives −Ψ⁻: same state up to a global sign, same decode.'),
          h('li', {}, 'Holevo’s theorem: a qubit sent on its own yields at most 1 classical bit when measured.'),
          h('li', {}, 'With a pre-shared pair, one sent qubit yields 2 bits. Two qubits still crossed in total, but one crossed before the message existed.'),
          h('li', {}, 'No signalling: no operation on q0 changes ρ_Bob. Bob learns nothing until q0 physically arrives.'),
          h('li', {}, 'Agreement alone isn’t proof of entanglement: classical twins with matching hidden cards could agree on one question. What no classical pair can do is the trick in Level 5: one carrier, sent after the message exists, delivering two bits. Pre-shared classical randomness never raises the capacity above one bit per use.')))));

  render();
  return { el, onKey: (e) => (e.key === 'Escape' ? (ctx.go('/'), true) : false) };
}
