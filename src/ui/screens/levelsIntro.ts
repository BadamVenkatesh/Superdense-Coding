/**
 * Levels 1–3: the pair, the link, the four moves.
 * Every rule appears as a consequence of an action first; text only names it afterwards.
 */
import { audio } from '../../audio/audio';
import { firstComparison, l1Progress, l2Grid, l2Done, l3Progress, L1_TARGET, type CellKey } from '../../game/bench';
import type { LevelDef } from '../../game/levels';
import type { Bits, Move } from '../../quantum/superdenseCoding';
import type { Basis } from '../../quantum/measurement';
import type { AppCtx, Screen } from '../app';
import { announce, toast } from '../bus';
import { button, h, setOff, shake } from '../dom';
import { completeOverlay, glyphText, goalsList, moveName, patternBadge, patternName } from '../components';
import { BenchStage, benchLayout } from './benchStage';
import { onViewChange } from '../app';

const group = (...kids: Node[]) => h('div', { class: 'group' }, ...kids);
const chip = (a: string, b: string, same: boolean, note = '') =>
  h('span', { class: `res ${same ? 'same' : 'opp'}`, title: note }, h('span', { class: 'a' }, a), h('span', { class: 'b' }, b), h('span', { class: same ? 'good' : 'bad' }, same ? '=' : '≠'));

function finish(ctx: AppCtx, level: LevelDef, host: HTMLElement, replay: () => void, extra?: Node) {
  ctx.store.complete(level.id, 3);
  audio.win();
  host.append(completeOverlay({ level, stars: 3, ctx, onReplay: replay, extra }));
}

// ── Level 1: PAIR ─────────────────────────────────────────────────────────

export function pairLevel(ctx: AppCtx, level: LevelDef): Screen {
  const stage = new BenchStage(ctx, `L1-${Date.now()}`, 'Your half and Bob’s half of an entangled pair, joined by a link');
  const L = benchLayout(ctx, level, stage, { left: 'YOU · ALICE', right: 'BOB' });
  let done = false;
  const history = h('div', { class: 'history', 'aria-label': 'Results' });
  const goals = h('div');
  const tally = h('div', { class: 'tally' });

  const askZ = button('Ask both ▲▼', { key: 'Q', title: 'Ask both halves the up/down question', onClick: () => ask('Z') });
  const askX = button('Ask both ◀ ▶', { key: 'W', title: 'Ask both halves the left/right question', onClick: () => ask('X') });
  const fresh = button('New pair', { key: 'N', cls: 'ghost', onClick: () => share() });
  L.controls.append(group(askZ, askX), group(fresh));
  L.panel.append(h('h4', {}, 'Goal'), goals, h('h4', { style: 'margin-top:14px' }, 'Results'), history, h('div', { style: 'height:10px' }), tally);

  const share = () => {
    if (stage.busy || done || stage.bench.linked) return; // a fresh pair is already waiting
    stage.share(() => update());
    update();
  };

  function ask(basis: Basis) {
    const p = l1Progress(stage.bench);
    if (basis === 'X' && p.z < L1_TARGET) {
      shake(askX);
      toast('First ask ▲▼ a few times.');
      return;
    }
    if (stage.busy) return;
    if (!stage.bench.linked) {
      shake(basis === 'Z' ? askZ : askX);
      toast('This pair is used up. A new one is coming.');
      return;
    }
    const a = stage.ask('A', basis);
    const b = stage.ask('B', basis);
    const same = a.outcome === b.outcome;
    history.prepend(chip(glyphText(basis, a.outcome), glyphText(basis, b.outcome), same));
    announce(`You: ${glyphText(basis, a.outcome)}. Bob: ${glyphText(basis, b.outcome)}. ${same ? 'Same' : 'Opposite'}.`);
    L.setCaption('Asking used the pair up: the link is gone.');
    update();
    const np = l1Progress(stage.bench);
    if (np.done) {
      done = true;
      stage.later(() => finish(ctx, level, L.el, () => ctx.refresh()), 1300);
    } else stage.later(share, 1500);
  }

  function update() {
    const p = l1Progress(stage.bench);
    const n = p.z + p.x;
    goals.replaceChildren(goalsList([
      { text: `Ask ▲▼ on ${L1_TARGET} pairs (${Math.min(p.z, L1_TARGET)}/${L1_TARGET})`, done: p.z >= L1_TARGET, now: p.z < L1_TARGET },
      { text: `Ask ◀ ▶ on ${L1_TARGET} pairs (${Math.min(p.x, L1_TARGET)}/${L1_TARGET})`, done: p.x >= L1_TARGET, now: p.z >= L1_TARGET },
    ]));
    setOff(askX, p.z < L1_TARGET, 'Unlocks after three ▲▼ questions');
    setOff(askZ, false);
    let ups = 0, downs = 0;
    for (const r of stage.bench.records) {
      const c = firstComparison(r);
      if (!c) continue;
      const a = r.asks.find((x) => x.who === 'A')!;
      if (a.outcome === 0) ups++; else downs++;
    }
    const same = p.zSame + p.xSame;
    tally.replaceChildren(
      h('span', {}, 'Same'), h('div', { class: 'bar' }, h('i', { style: `width:${n ? (same / n) * 100 : 0}%;background:var(--good)` })), h('span', { class: 'mono' }, `${same}/${n}`),
      h('span', {}, 'Your ▲ or ▶'), h('div', { class: 'bar' }, h('i', { style: `width:${n ? (ups / n) * 100 : 0}%` })), h('span', { class: 'mono' }, `${ups}/${n}`));
    if (n === 0) {
      L.prompt.textContent = 'You and Bob share something.';
      L.sub.textContent = 'Two qubits. One pair. A qubit can be asked ▲▼ (up or down?) or ◀ ▶ (left or right?). Ask both halves ▲▼.';
      L.setCaption('');
    } else if (p.z < L1_TARGET) {
      L.prompt.textContent = same === n ? 'Same answer.' : 'Look at the results.';
      L.sub.textContent = n === 1 ? 'Asking used up the pair. A fresh one is crossing to Bob.' : `Your answers: ${ups} ▲, ${downs} ▼. Random, yet they always match Bob’s.`;
    } else if (p.x === 0) {
      L.prompt.textContent = 'Always the same, never predictable.';
      L.sub.textContent = 'Do they agree on a different question too? Ask ◀ ▶.';
    } else {
      L.prompt.textContent = 'They agree on ◀ ▶ too.';
      L.sub.textContent = 'Each answer is a coin flip. The pair always agrees.';
    }
    stage.channel = null;
  }

  update();
  return {
    el: L.el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'q' || k === '1') { ask('Z'); return true; }
      if (k === 'w' || k === '2') { ask('X'); return true; }
      if (k === 'n') { share(); return true; }
      if (k === ' ' || k === 'enter') { stage.bench.linked ? ask(l1Progress(stage.bench).z < L1_TARGET ? 'Z' : 'X') : share(); return true; }
      if (k === 'escape') { ctx.go('/levels'); return true; }
      return false;
    },
    destroy: () => { stage.destroy(); L.cleanup(); },
  };
}

// ── Level 2: THE LINK ─────────────────────────────────────────────────────

export function linkLevel(ctx: AppCtx, level: LevelDef): Screen {
  const stage = new BenchStage(ctx, `L2-${Date.now()}`, 'One entangled pair. Ask each half its own question.');
  const L = benchLayout(ctx, level, stage, { left: 'YOU · ALICE', right: 'BOB' });
  let done = false;
  const grid = h('div', { class: 'qgrid', role: 'table', 'aria-label': 'What you found for each pair of questions' });
  const alone = h('div', { class: 'tally' });
  const history = h('div', { class: 'history' });

  const btn = (who: 'A' | 'B', basis: Basis, key: string) =>
    button(`${who === 'A' ? 'Yours' : "Bob's"} ${basis === 'Z' ? '▲▼' : '◀ ▶'}`, { key, cls: who === 'A' ? 'alice-btn' : 'bob-btn', onClick: () => ask(who, basis) });
  const aZ = btn('A', 'Z', 'Q');
  const aX = btn('A', 'X', 'W');
  const bZ = btn('B', 'Z', 'O');
  const bX = btn('B', 'X', 'L');
  L.controls.append(group(aZ, aX), group(bZ, bX));
  L.panel.append(h('h4', {}, 'Your question ↓ · Bob’s question →'), grid, h('h4', { style: 'margin-top:14px' }, 'Your half on its own'), alone, h('h4', { style: 'margin-top:14px' }, 'Pairs'), history);

  function ask(who: 'A' | 'B', basis: Basis) {
    if (stage.busy || done) return;
    if (stage.bench.current.asks.some((a) => a.who === who)) {
      shake(who === 'A' ? (basis === 'Z' ? aZ : aX) : basis === 'Z' ? bZ : bX);
      return;
    }
    stage.ask(who, basis);
    const rec = stage.bench.current;
    const c = firstComparison(rec);
    if (c) {
      const a = rec.asks.find((x) => x.who === 'A')!;
      const b = rec.asks.find((x) => x.who === 'B')!;
      history.prepend(chip(glyphText(a.basis, a.outcome), glyphText(b.basis, b.outcome), c.same));
      const sameQ = c.basisA === c.basisB;
      L.setCaption(sameQ ? (c.same ? 'Same question → same answer.' : 'Same question → …opposite?!') : 'Different questions → no telling.');
      announce(`${c.same ? 'Same' : 'Opposite'} answers.`);
      if (l2Done(stage.bench)) {
        done = true;
        stage.later(() => finish(ctx, level, L.el, () => ctx.refresh()), 1300);
      } else stage.later(() => stage.share(() => update(), 0.7), 1000);
    } else {
      L.setCaption(who === 'A' ? 'Your half answered. Now Bob’s.' : 'Bob’s half answered. Now yours.');
    }
    update();
  }

  function update() {
    const g = l2Grid(stage.bench);
    const label = (k: CellKey) => {
      const c = g[k];
      const n = c.same + c.opposite;
      const diag = k === 'ZZ' || k === 'XX';
      const verdict = !c.done ? (n ? `${n} tried` : 'try it') : diag ? 'SAME EVERY TIME' : 'NO PATTERN';
      return h('div', { class: `cell ${c.done ? 'done' : ''}`, role: 'cell' },
        h('span', { class: 'v' }, verdict),
        h('span', { class: 'muted mono' }, `= ${c.same}  ≠ ${c.opposite}`));
    };
    grid.replaceChildren(
      h('span', {}), h('span', { class: 'h' }, 'Bob ▲▼'), h('span', { class: 'h' }, 'Bob ◀ ▶'),
      h('span', { class: 'h', style: 'align-self:center' }, 'You ▲▼'), label('ZZ'), label('ZX'),
      h('span', { class: 'h', style: 'align-self:center' }, 'You ◀ ▶'), label('XZ'), label('XX'));
    let up = 0, n = 0;
    for (const r of stage.bench.records) for (const a of r.asks) if (a.who === 'A' && !a.repeat) { n++; if (a.outcome === 0) up++; }
    alone.replaceChildren(h('span', {}, '▲ or ▶'), h('div', { class: 'bar' }, h('i', { style: `width:${n ? (up / n) * 100 : 0}%` })), h('span', { class: 'mono' }, `${up}/${n}`));
    const cur = stage.bench.current.asks;
    for (const [b, who] of [[aZ, 'A'], [aX, 'A'], [bZ, 'B'], [bX, 'B']] as const) setOff(b, stage.busy || cur.some((a) => a.who === who));
    const doneCells = Object.values(g).filter((c) => c.done).length;
    if (doneCells === 0 && !cur.length) {
      L.prompt.textContent = 'Now ask each half on its own.';
      L.sub.textContent = 'Choose a question for your half and one for Bob’s. Fill the grid.';
    } else if (doneCells < 4) {
      L.prompt.textContent = doneCells >= 2 ? 'Keep filling the grid.' : 'Try every combination.';
      L.sub.textContent = 'Same question on both halves? Or different questions? Watch what happens.';
    }
  }
  update();
  const tick = window.setInterval(update, 400);
  return {
    el: L.el,
    onKey(e) {
      const k = e.key.toLowerCase();
      const map: Record<string, ['A' | 'B', Basis]> = { q: ['A', 'Z'], w: ['A', 'X'], o: ['B', 'Z'], l: ['B', 'X'] };
      if (map[k]) { ask(...map[k]); return true; }
      if (k === 'escape') { ctx.go('/levels'); return true; }
      return false;
    },
    destroy: () => { clearInterval(tick); stage.destroy(); L.cleanup(); },
  };
}

// ── Level 3: FOUR MOVES ───────────────────────────────────────────────────

export function movesLevel(ctx: AppCtx, level: LevelDef): Screen {
  const stage = new BenchStage(ctx, `L3-${Date.now()}`, 'Your half and Bob’s half. Your moves change the link between them.');
  const L = benchLayout(ctx, level, stage, { left: 'YOU · ALICE', right: 'BOB' });
  let done = false;
  const made = new Set<Bits>(['00']);
  const readout = h('div', { class: 'readout' });
  const goals = h('div');
  const gallery = h('div', { style: 'display:grid;gap:8px' });

  const phaseBtn = button('PHASE', { key: 'P', cls: 'toggle phase-btn', title: 'PHASE: a move on your half only', onClick: () => move('Z') });
  const flipBtn = button('FLIP', { key: 'F', cls: 'toggle flip-btn', title: 'FLIP: a move on your half only', onClick: () => move('X') });
  const askZ = button('Ask both ▲▼', { key: 'Q', onClick: () => test('Z') });
  const askX = button('Ask both ◀ ▶', { key: 'W', onClick: () => test('X') });
  const bobCheck = button("Bob checks his half", { key: 'O', cls: 'bob-btn', title: 'Bob asks only his own half ▲▼', onClick: () => check() });
  L.controls.append(group(phaseBtn, flipBtn), group(askZ, askX), group(bobCheck));
  L.panel.append(h('h4', {}, 'Goals'), goals, h('h4', { style: 'margin-top:14px' }, 'The link right now'), readout, h('h4', { style: 'margin-top:14px' }, 'Patterns found'), gallery);

  const syncLabels = () => {
    const v = ctx.view();
    (phaseBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'Z (PHASE)' : 'PHASE';
    (flipBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'X (FLIP)' : 'FLIP';
    update();
  };
  const offView = onViewChange(syncLabels);

  function move(m: Move) {
    if (stage.busy || done) return;
    if (!stage.bench.linked) {
      shake(m === 'X' ? flipBtn : phaseBtn);
      toast('This pair has been asked. A fresh one is coming.');
      return;
    }
    stage.toggle(m);
    const p = stage.bench.pattern;
    if (p) made.add(p);
    const xs = stage.bench.current.moves.filter((x) => x === m).length;
    L.setCaption(xs % 2 === 0 ? `${moveName(m, ctx.view())} again: undone. A move cancels itself.` : `${moveName(m, ctx.view())} acted on your half only.`);
    announce(`Link is now ${patternName(p, ctx.view())}`);
    update();
  }

  function test(basis: Basis) {
    if (stage.busy || done) return;
    if (!stage.bench.linked) return toast('Already asked. A fresh pair is coming.');
    const before = stage.bench.pattern;
    const a = stage.ask('A', basis);
    const b = stage.ask('B', basis);
    const same = a.outcome === b.outcome;
    L.setCaption(`${patternName(before, ctx.view())}: asked ${basis === 'Z' ? '▲▼' : '◀ ▶'} → ${same ? 'SAME' : 'OPPOSITE'}`);
    announce(`${same ? 'Same' : 'Opposite'} answers.`);
    after();
  }

  function check() {
    if (stage.busy || done) return;
    if (!stage.bench.linked) return toast('Already asked. A fresh pair is coming.');
    if (!stage.bench.pattern || stage.bench.pattern === '00') {
      shake(bobCheck);
      return toast('Change the link first (FLIP or PHASE), then let Bob look.');
    }
    const p0 = stage.bench.p0('B', 'Z');
    const b = stage.ask('B', 'Z');
    L.setCaption(`Bob’s half alone: ${glyphText('Z', b.outcome)}. Odds were ${Math.round(p0 * 100)}/${Math.round((1 - p0) * 100)}. He can’t see your move.`);
    announce('Bob checked his half alone. It was a coin flip. He cannot tell what you did.');
    after();
  }

  function after() {
    update();
    if (l3Progress(stage.bench).done) {
      done = true;
      const table = h('div', { style: 'display:grid;gap:6px;margin-top:12px' },
        h('div', { class: 'kicker' }, 'Four patterns = two bits'),
        ...(['00', '01', '10', '11'] as Bits[]).map((bits) => h('div', { style: 'display:flex;gap:12px;align-items:center' }, h('span', { class: 'mono', style: 'font-size:18px;width:30px' }, bits), patternBadge(bits, ctx.view()))));
      stage.later(() => finish(ctx, level, L.el, () => ctx.refresh(), table), 1400);
    } else stage.later(() => stage.share(() => update()), 1500);
  }

  function update() {
    const p = l3Progress(stage.bench);
    const pat = stage.bench.pattern;
    const v = ctx.view();
    const nm = (b: Bits) => patternName(b, v);
    goals.replaceChildren(goalsList([
      { text: `Make ${nm('01')}, then ask both ▲▼`, done: p.cross, now: !p.cross },
      { text: `Make ${nm('10')}, then ask both ◀ ▶`, done: p.offbeat, now: p.cross && !p.offbeat },
      { text: `Make ${nm('11')}, then ask either`, done: p.anti, now: p.cross && p.offbeat && !p.anti },
      { text: 'After a move, let Bob check his half alone', done: p.bobCheck, now: p.cross && p.offbeat && p.anti && !p.bobCheck },
    ]));
    readout.replaceChildren(stage.bench.linked ? patternBadge(pat, v) : h('span', { class: 'muted' }, 'Asked: the link is gone. A fresh pair is coming.'));
    gallery.replaceChildren(...(['00', '01', '10', '11'] as Bits[]).map((b) => made.has(b)
      ? h('div', {}, patternBadge(b, v, { size: 40 }))
      : h('div', { class: 'muted', style: 'opacity:.5;font-size:13px;padding:4px 0' }, '— not found yet')));
    const net = { X: stage.bench.current.moves.filter((m) => m === 'X').length % 2 === 1, Z: stage.bench.current.moves.filter((m) => m === 'Z').length % 2 === 1 };
    flipBtn.setAttribute('aria-pressed', String(net.X && stage.bench.linked));
    phaseBtn.setAttribute('aria-pressed', String(net.Z && stage.bench.linked));
    for (const b of [flipBtn, phaseBtn, askZ, askX, bobCheck]) setOff(b, stage.busy || !stage.bench.linked);
    // guide
    if (!p.cross) {
      L.prompt.textContent = pat === '01' ? 'Crossed. Now ask both ▲▼.' : 'Change only yours.';
      L.sub.textContent = pat === '01' ? 'Crossed strands mean: opposite answers on ▲▼.' : pat && pat !== '00' ? 'Interesting. Now try FLIP alone on a fresh pair.' : 'Tap FLIP. It touches your half only. Watch the link.';
    } else if (!p.offbeat) {
      L.prompt.textContent = pat === '10' ? 'Offbeat. Ask both ◀ ▶.' : 'Now try PHASE alone.';
      L.sub.textContent = pat === '10' ? 'The zigzag means: opposite answers on ◀ ▶.' : 'PHASE is your other move. It also touches only your half.';
    } else if (!p.anti) {
      L.prompt.textContent = pat === '11' ? 'Both at once. Ask either question.' : 'Now both moves.';
      L.sub.textContent = pat === '11' ? 'Crossed AND zigzag: opposite on everything.' : 'FLIP and PHASE, in any order.';
    } else if (!p.bobCheck) {
      L.prompt.textContent = 'Can Bob tell you moved?';
      L.sub.textContent = 'Make any move, then let Bob check his half, on its own.';
    }
  }
  syncLabels();
  return {
    el: L.el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'f') { move('X'); return true; }
      if (k === 'p') { move('Z'); return true; }
      if (k === 'q' || k === '1') { test('Z'); return true; }
      if (k === 'w' || k === '2') { test('X'); return true; }
      if (k === 'o') { check(); return true; }
      if (k === 'escape') { ctx.go('/levels'); return true; }
      return false;
    },
    destroy: () => { offView(); stage.destroy(); L.cleanup(); },
  };
}
