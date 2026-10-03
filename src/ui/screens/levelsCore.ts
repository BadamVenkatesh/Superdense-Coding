/**
 * Levels 4–5: the decoder struggle and the signature one-qubit moment.
 */
import { audio } from '../../audio/audio';
import { DecoderGame, OneQubitGame } from '../../game/bench';
import type { LevelDef } from '../../game/levels';
import { ALL_BITS } from '../../quantum/bellStates';
import type { Basis } from '../../quantum/measurement';
import { patternBits, type Bits, type Move } from '../../quantum/superdenseCoding';
import type { AppCtx, Screen } from '../app';
import { onViewChange } from '../app';
import { announce, toast } from '../bus';
import { bitsEl, button, h, kids, setOff, shake } from '../dom';
import { circuitSvg, completeOverlay, glyphOf, glyphText, goalsList, messageCard, moveName, patternBadge, patternName } from '../components';
import { BenchStage, benchLayout, banner } from './benchStage';
import type { DockM, SceneModel } from '../scene';

const group = (...kids: Node[]) => h('div', { class: 'group' }, ...kids);
const nowS = () => performance.now() / 1000;

// ── Level 4: THE DECODER ──────────────────────────────────────────────────

export function decoderLevel(ctx: AppCtx, level: LevelDef): Screen {
  const game = new DecoderGame(`L4-${Date.now()}`);
  const stage = new BenchStage(ctx, 'L4-stage', 'Bob’s desk: Alice’s half and Bob’s half, side by side');
  const L = benchLayout(ctx, level, stage, { left: 'ALICE (FAR AWAY)', right: 'YOU · BOB' });
  let done = false;
  let arriving = false;
  let analyzing: DockM | null = null;
  let deskBrokeAt = 0;
  let askAt = { A: 0, B: 0 };
  const lamps = h('div', { style: 'display:grid;gap:6px' });
  const log = h('div', { class: 'history' });
  const goals = h('div');
  const cards = h('div', { class: 'queue', role: 'group', 'aria-label': 'Which message did Alice send?' });

  const askZ = button('Ask both ▲▼', { key: 'Q', onClick: () => ask('Z') });
  const askX = button('Ask both ◀ ▶', { key: 'W', onClick: () => ask('X') });
  const analyzer = button('Analyzer', { key: 'A', cls: 'primary', title: "Bob's analyzer: asks the PAIR, not the halves", onClick: () => analyze() });
  L.controls.append(group(askZ, askX), group(analyzer), h('div', { style: 'width:100%' }, h('div', { class: 'readout', style: 'display:block' }, h('div', { class: 'lbl', style: 'margin-bottom:6px' }, 'Your answer: what did Alice send?'), cards)));
  L.panel.append(h('h4', {}, 'Goal'), goals, h('h4', { style: 'margin-top:14px' }, 'This pair told you'), lamps, h('h4', { style: 'margin-top:14px' }, 'Rounds'), log);

  stage.showPair = false;
  stage.model = (): SceneModel => {
    const r = game.round;
    const b = r.bench;
    const last = (who: 'A' | 'B') => [...b.current.asks].reverse().find((a) => a.who === who);
    const la = last('A');
    const lb = last('B');
    let dock: DockM | null;
    if (arriving) dock = { t0: 0, pattern: null, link: 'hidden', waiting: true };
    else if (analyzing) dock = analyzing;
    else dock = {
      t0: 0, pattern: null, link: b.linked ? 'hidden' : 'broken',
      desk: { a: { glyph: la ? glyphOf(la.basis, la.outcome) : null, changedAt: askAt.A || undefined }, b: { glyph: lb ? glyphOf(lb.basis, lb.outcome) : null, changedAt: askAt.B || undefined }, brokeAt: deskBrokeAt },
    };
    return { rungs: [], slots: 1, flight: null, zones: [], spy: null, channel: null, dock: arriving ? { t0: 0, pattern: null, link: 'hidden', desk: { a: { dim: true }, b: {} } } : dock, view: ctx.view(), bench: true, lane: false, dockCenter: true };
  };

  function newRound(first = false) {
    if (!first) game.nextRound();
    askAt = { A: 0, B: 0 };
    deskBrokeAt = 0;
    analyzing = null;
    arriving = true;
    audio.send(1);
    stage.later(() => { arriving = false; audio.arrive(); update(); }, ctx.reducedMotion() ? 200 : 1000);
    update();
  }

  function ask(basis: Basis) {
    const r = game.round;
    if (done || arriving || analyzing || r.guess) return;
    const b = r.bench;
    const wasLinked = b.linked;
    const [a1, a2] = b.askBoth(basis);
    askAt = { A: nowS(), B: nowS() };
    if (wasLinked) deskBrokeAt = nowS();
    audio.answer(a1.outcome, 'A');
    const same = a1.outcome === a2.outcome;
    L.setCaption(`${glyphText(basis, a1.outcome)} and ${glyphText(basis, a2.outcome)}: ${same ? 'SAME' : 'OPPOSITE'}${wasLinked ? '' : ' (link already gone)'}`);
    update();
  }

  function analyze() {
    const r = game.round;
    if (done || arriving || analyzing || r.guess) return;
    if (!game.analyzerUnlocked) {
      shake(analyzer);
      toast('Not yet. Try reading the halves first.');
      return;
    }
    if (r.bench.used) {
      shake(analyzer);
      toast('You already asked this pair a question. The link is gone; wait for the next one.');
      return;
    }
    const pattern = patternBits(r.bench.state);
    const bits = game.analyze()!;
    analyzing = { t0: nowS(), pattern, link: 'hidden', bits, correct: null };
    audio.decode(bits);
    L.setCaption('The analyzer asks the pair both questions at once.');
    stage.later(() => {
      announce(`Analyzer reads ${bits[0]} ${bits[1]}`);
      update();
      cards.querySelector<HTMLButtonElement>(`[data-bits="${bits}"]`)?.focus();
    }, 1500);
    update();
  }

  function guess(bits: Bits) {
    const r = game.round;
    if (done || arriving || r.guess) return;
    const ok = game.submit(bits);
    if (analyzing) analyzing.correct = ok;
    ok ? audio.good() : audio.bad();
    log.prepend(h('span', { class: `res ${ok ? 'same' : 'opp'}` }, `sent ${r.secret} · you ${bits} ${ok ? '✓' : '✗'}${r.usedAnalyzer ? ' · analyzer' : ''}`));
    const unlockedNow = game.analyzerUnlocked && game.rounds.filter((x) => x.guess).length <= 2 && !r.usedAnalyzer && !analyzerAnnounced;
    if (ok) toast(`Right: Alice sent ${r.secret}.`, 'good');
    else toast(`Alice sent ${r.secret} (${patternName(r.secret, ctx.view())}). You said ${bits}.`, 'bad', 3400);
    if (unlockedNow) {
      analyzerAnnounced = true;
      stage.later(() => toast('New tool: Bob’s analyzer. It asks the PAIR, not the halves.', 'info', 4200), 900);
    }
    update();
    if (game.done) {
      done = true;
      ctx.store.complete(level.id, game.rounds.filter((x) => x.correct === false).length <= 1 ? 3 : 2);
      audio.win();
      stage.later(() => L.el.append(completeOverlay({ level, stars: 3, ctx, onReplay: () => ctx.refresh(), extra: h('div', { class: 'circuit', style: 'margin-top:12px' }, circuitSvg(['X', 'Z'], 'decoded', '11')) })), 1500);
    } else stage.later(() => newRound(), ok ? 1500 : 2200);
  }
  let analyzerAnnounced = false;

  function update() {
    const r = game.round;
    const b = r.bench;
    const v = ctx.view();
    goals.replaceChildren(goalsList([
      { text: 'Work out what Alice sent', done: game.rounds.some((x) => x.guess), now: !game.analyzerUnlocked },
      { text: `Decode 3 messages with the analyzer (${game.analyzerWins}/3)`, done: game.done, now: game.analyzerUnlocked },
    ]));
    // what the questions revealed on THIS pair
    const firstZ = b.current.asks.findIndex((a) => a.basis === 'Z' && a.who === 'A');
    const firstX = b.current.asks.findIndex((a) => a.basis === 'X' && a.who === 'A');
    const lampFor = (basis: Basis, idx: number) => {
      if (idx < 0) return h('div', { class: 'lamp' }, `${basis === 'Z' ? '▲▼' : '◀ ▶'}: not asked`);
      const a = b.current.asks[idx];
      const bb = b.current.asks[idx + 1];
      const same = a.outcome === bb.outcome;
      const meaningful = a.linkedBefore;
      const bit = basis === 'Z' ? '2nd' : '1st';
      return h('div', { class: `lamp ${same ? 'same' : 'opp'}` },
        `${basis === 'Z' ? '▲▼' : '◀ ▶'}: ${same ? 'SAME' : 'OPPOSITE'} → `,
        meaningful ? h('b', {}, `${bit} bit = ${same ? 0 : 1}`) : h('span', { class: 'bad' }, 'meaningless: the first question already broke the link'));
    };
    if (analyzing && r.analyzerReading) {
      lamps.replaceChildren(
        h('div', { class: `lamp ${r.analyzerReading[0] === '0' ? 'same' : 'opp'}` }, `◀ ▶ agreement: ${r.analyzerReading[0] === '0' ? 'SAME' : 'OPPOSITE'} → 1st bit = ${r.analyzerReading[0]}`),
        h('div', { class: `lamp ${r.analyzerReading[1] === '0' ? 'same' : 'opp'}` }, `▲▼ agreement: ${r.analyzerReading[1] === '0' ? 'SAME' : 'OPPOSITE'} → 2nd bit = ${r.analyzerReading[1]}`),
        h('div', { class: 'agree' }, 'Read from the pair. Neither half’s own answer was ever revealed.'));
    } else lamps.replaceChildren(lampFor('Z', firstZ), lampFor('X', firstX));
    cards.replaceChildren(...ALL_BITS.map((bits) => {
      const c = messageCard(bits, v, { target: analyzing?.bits === bits && !r.guess });
      const btn = h('button', { type: 'button', class: 'btn ghost', 'data-bits': bits, style: 'padding:0;border:0;min-height:0;background:none', 'aria-label': `Alice sent ${bits}`, onclick: () => guess(bits) }, c);
      return btn;
    }));
    setOff(analyzer, !game.analyzerUnlocked || b.used || !!r.guess || arriving);
    (analyzer.firstChild as HTMLElement).textContent = game.analyzerUnlocked ? (v === 'circuit' ? 'Bell measurement' : 'Analyzer') : 'Analyzer 🔒';
    for (const x of [askZ, askX]) setOff(x, !!r.guess || arriving || !!analyzing);
    if (!game.rounds.some((x) => x.guess)) {
      L.prompt.textContent = 'You’re Bob now. Alice’s half just arrived.';
      L.sub.textContent = 'She shaped the link into one of four patterns. You can’t see it. Ask the halves, then pick her message.';
    } else if (!game.analyzerUnlocked) {
      L.prompt.textContent = 'Try another one.';
      L.sub.textContent = 'Can you get BOTH bits by asking the halves?';
    } else if (!analyzing) {
      L.prompt.textContent = 'One question per pair. Asking the halves gets you one bit.';
      L.sub.textContent = 'The analyzer asks the PAIR both questions at once. Use it before asking anything else.';
    } else {
      L.prompt.textContent = r.guess ? (r.correct ? 'Both bits, every time.' : 'Check the reading.') : 'Read the two lamps, pick the message.';
      L.sub.textContent = v === 'circuit' ? 'Bell measurement: CNOT, H, then measure both qubits.' : 'UNTANGLE, TURN, READ: two bits from one pair.';
    }
  }

  const offView = onViewChange(() => update());
  newRound(true);
  let typed = '';
  return {
    el: L.el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'q') { ask('Z'); return true; }
      if (k === 'w') { ask('X'); return true; }
      if (k === 'a') { analyze(); return true; }
      if (k === '0' || k === '1') {
        typed += k;
        if (typed.length === 2) { guess(typed as Bits); typed = ''; }
        else toast(`Typed ${typed}_`, 'info', 1200);
        return true;
      }
      if (k === 'enter' && analyzing?.bits && !game.round.guess) { guess(analyzing.bits); return true; }
      if (k === 'escape') { ctx.go('/levels'); return true; }
      return false;
    },
    destroy: () => { offView(); stage.destroy(); L.cleanup(); },
  };
}

// ── Level 5: ONE QUBIT ────────────────────────────────────────────────────

export function oneQubitLevel(ctx: AppCtx, level: LevelDef): Screen {
  const game = new OneQubitGame(`L5-${Date.now()}`);
  const stage = new BenchStage(ctx, 'L5-stage', 'Alice and Bob, the channel between them, and Bob’s analyzer');
  const L = benchLayout(ctx, level, stage, { left: 'YOU · ALICE', right: 'BOB' });
  let done = false;
  type Vis = 'idle' | 'loneFly' | 'loneRead' | 'shareFly' | 'msgFly' | 'analyze';
  let vis: Vis = 'idle';
  let t0 = 0;
  let loneGlyph: 'up' | 'down' = 'up';
  let loneChanged = 0;
  let pairChanged = 0;
  let readGlyph: 'up' | 'down' = 'up';
  let dock: DockM | null = null;
  let sentPattern: Bits | null = null;
  let shares = 0;
  let sharedBefore = 0;
  let sentWith = 0;

  const msgHost = h('div', { class: 'queue', style: 'min-height:96px' });
  const ledger = h('div', { class: 'ledger' });
  const spyBox = h('div', { class: 'agree' });
  const goals = h('div');
  const readout = h('div', { class: 'readout' });
  const circuit = h('div', { class: 'circuit' });

  const phaseBtn = button('PHASE', { key: 'P', cls: 'toggle phase-btn', onClick: () => move('Z') });
  const flipBtn = button('FLIP', { key: 'F', cls: 'toggle flip-btn', onClick: () => move('X') });
  const shareBtn = button('SHARE a pair', { key: 'S', cls: 'bob-btn', title: 'Send Bob his half of a fresh pair. It carries no message.', onClick: () => share() });
  const sendBtn = button('SEND one qubit', { key: 'Space', cls: 'primary', onClick: () => send() });
  const nextBtn = button('Use the other half →', { key: 'Enter', cls: 'primary', onClick: () => toPairs() });
  L.controls.append(h('div', { class: 'group' }, msgHost), group(phaseBtn, flipBtn), group(shareBtn, sendBtn, nextBtn), h('div', { style: 'width:100%' }, readout));
  L.panel.append(h('h4', {}, 'Goal'), goals, h('h4', { style: 'margin-top:14px' }, 'Channel ledger'), ledger, h('h4', { style: 'margin-top:14px' }, 'If a spy grabbed your qubit'), spyBox, circuit);

  stage.showPair = false;
  stage.channel = { ready: true, recharge: 1, armed: false };
  stage.model = (): SceneModel => {
    const v = ctx.view();
    const p = Math.min(1, (nowS() - t0) / (ctx.reducedMotion() ? 0.25 : 1.1));
    const base: SceneModel = { rungs: [], slots: 1, flight: null, zones: [], spy: null, channel: stage.channel, dock: null, view: v, bench: true };
    if (game.phase === 'lone') {
      if (vis === 'idle') base.lone = { glyph: loneGlyph, changedAt: loneChanged || undefined };
      if (vis === 'loneFly') base.flight = { id: 1, kind: 'bit', x: p, glyph: loneGlyph };
      if (vis === 'loneRead') base.dock = { t0: 0, pattern: null, link: 'linked', lone: { glyph: readGlyph, changedAt: t0 + 1.1 } };
      if (vis === 'loneFly' || vis === 'idle') base.dock = { t0: 0, pattern: null, link: 'linked', empty: true };
      return base;
    }
    // part B
    const pat = game.pattern;
    if (vis === 'shareFly') {
      base.rungs = [{ id: 2, a: {}, b: null, pattern: '00', link: 'linked' }];
      base.flight = { id: 2, kind: 'share', x: p, rungId: 2, pattern: '00', link: 'linked' };
    } else if (game.banked && vis === 'idle') {
      base.rungs = [{ id: 2, a: {}, b: {}, pattern: pat, link: 'linked', changedAt: pairChanged || undefined }];
    } else if (vis === 'msgFly') {
      base.flight = { id: 3, kind: 'message', x: p, pattern: sentPattern, link: 'linked' };
      base.dock = { t0: 0, pattern: sentPattern, link: 'linked', waiting: true };
    } else if (vis === 'analyze') base.dock = dock;
    return base;
  };

  function move(m: Move) {
    if (done || vis !== 'idle') return;
    if (game.phase === 'lone') {
      game.toggleLone(m);
      if (m === 'X') {
        loneGlyph = loneGlyph === 'up' ? 'down' : 'up';
        loneChanged = nowS();
        audio.flip();
        L.setCaption(`FLIP turned your lone qubit ${loneGlyph === 'up' ? '▲' : '▼'}.`);
      } else {
        audio.phase();
        L.setCaption('PHASE did… nothing you can see. A lone ▲ or ▼ has no phase to show.');
        toast('PHASE on a lone ▲/▼ qubit changes nothing anyone can measure.', 'info', 3200);
      }
    } else {
      if (!game.banked) return toast('Share a pair first.');
      if (!game.message) return toast('No message yet. Wait for it.');
      game.toggle(m);
      pairChanged = nowS();
      m === 'X' ? audio.flip() : audio.phase();
      L.setCaption(`${moveName(m, ctx.view())} on your half: the link is now ${patternName(game.pattern, ctx.view())}.`);
    }
    update();
  }

  function send() {
    if (done || vis !== 'idle') return;
    if (game.phase === 'lone') {
      vis = 'loneFly';
      t0 = nowS();
      audio.send(1.1);
      update();
      stage.later(() => {
        const a = game.sendLone();
        readGlyph = a.readFlip === 0 ? 'up' : 'down';
        vis = 'loneRead';
        t0 = nowS() - 1.1;
        audio.answer(a.readFlip, 'B');
        sentWith += 1;
        L.setCaption(`Bob asks ▲▼ and reads ${a.readFlip ? '▼' : '▲'}. Second bit = ${a.readFlip}. First bit: lost.`);
        announce(`Bob got only one bit: ? ${a.readFlip}`);
        audio.bad();
        update();
      }, ctx.reducedMotion() ? 260 : 1150);
      return;
    }
    if (!game.banked) { shake(sendBtn); return toast('Bob has no half from you. SHARE first.'); }
    if (!game.message) { shake(sendBtn); return toast('No message yet.'); }
    sentPattern = game.pattern;
    vis = 'msgFly';
    t0 = nowS();
    audio.send(1.1);
    sentWith += 1;
    update();
    stage.later(() => {
      const before = game.deliveries.length;
      const d = game.send()!;
      vis = 'analyze';
      dock = { t0: nowS(), pattern: d.sentPattern, link: 'linked', bits: d.decoded, correct: d.correct };
      audio.decode(d.decoded);
      update();
      stage.later(() => {
        if (d.correct) {
          audio.signature();
          const first = before === 0;
          const when = d.sharedBeforeMessage ? 'before the message existed' : 'earlier';
          banner(L.stageWrap, 'ONLY ONE QUBIT CROSSED THE CHANNEL', first
            ? `Bob read ${d.decoded}: two bits. His half crossed ${when}.`
            : `Message ${d.decoded}: two bits from one qubit + a half shared ${when}.`, first ? 4600 : 2800);
          announce(`Bob decoded ${d.decoded}. Only one qubit crossed the channel for this message.`);
        } else {
          audio.bad();
          toast(`Bob read ${d.decoded}, but the message was ${d.message}. The link was ${patternName(d.sentPattern, ctx.view())}; it needed ${patternName(d.message, ctx.view())}. Share a new pair and try again.`, 'bad', 4200);
        }
        stage.later(() => {
          vis = 'idle';
          dock = null;
          if (game.done) finish();
          update();
        }, d.correct ? (before === 0 ? 3600 : 1800) : 1500);
      }, 1500);
    }, ctx.reducedMotion() ? 260 : 1150);
  }

  function share() {
    if (done || vis !== 'idle' || game.phase !== 'pairs') return;
    if (game.banked) { shake(shareBtn); return toast('Bob already has a half waiting.'); }
    game.share();
    shares += 1;
    sharedBefore += game.message ? 0 : 1;
    vis = 'shareFly';
    t0 = nowS();
    audio.pair();
    audio.send(1.1);
    L.setCaption('Bob’s half crosses. It carries no message: there is no message yet.');
    update();
    stage.later(() => {
      vis = 'idle';
      audio.arrive();
      if (!game.message) stage.later(() => {
        game.revealMessage();
        L.setCaption('');
        toast(`A message arrives: ${game.message}`, 'info', 2400);
        announce(`New message: ${game.message![0]} ${game.message![1]}`);
        audio.tick();
        update();
      }, 650);
      update();
    }, ctx.reducedMotion() ? 260 : 1150);
  }

  function toPairs() {
    if (game.phase !== 'lone' || !game.loneAttempts.length || vis === 'loneFly') return;
    game.startPairs();
    vis = 'idle';
    L.setCaption('');
    update();
  }

  function finish() {
    done = true;
    ctx.store.complete(level.id, 3);
    audio.win();
    const v = ctx.view();
    const proto = h('div', { class: 'protocol' },
      h('div', { class: 'kicker' }, 'What you just did'),
      h('div', { class: 'row' }, h('span', { class: 'pill' }, 'earlier: SHARE a pair'), h('span', { class: 'arrow' }, '→'), h('span', { class: 'pill' }, '1 qubit crosses · no message')),
      h('div', { class: 'row' }, h('span', { class: 'pill' }, '2-bit message'), h('span', { class: 'arrow' }, '→'), h('span', { class: 'pill' }, `${moveName('X', v)} / ${moveName('Z', v)} on your half`), h('span', { class: 'arrow' }, '→'), h('span', { class: 'pill' }, '1 qubit crosses')),
      h('div', { class: 'row' }, h('span', { class: 'pill' }, v === 'circuit' ? 'Bell measurement' : 'Bob’s analyzer reads the pair'), h('span', { class: 'arrow' }, '→'), h('span', { class: 'pill good' }, '2 bits')),
      h('p', { class: 'agree', style: 'margin:4px 0 0' }, 'The qubit you sent never held the message on its own (a spy would read 50/50). Two bits came from the pair: your half, plus the half Bob already had.'));
    stage.later(() => L.el.append(completeOverlay({ level, stars: 3, ctx, onReplay: () => ctx.refresh(), extra: proto, title: 'Two bits. One qubit.' })), 900);
  }

  function update() {
    const v = ctx.view();
    const lone = game.phase === 'lone';
    const tried = game.loneAttempts.length > 0;
    (phaseBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'Z (PHASE)' : 'PHASE';
    (flipBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'X (FLIP)' : 'FLIP';
    // message
    const msg: Bits | null = lone ? game.ceilingMessage : game.message;
    msgHost.replaceChildren(msg ? messageCard(msg, v, { target: true, label: 'MESSAGE' }) : h('span', { class: 'queue-empty' }, game.phase === 'pairs' ? (game.banked ? 'Waiting for a message…' : 'No message yet.') : ''));
    // buttons
    nextBtn.style.display = lone && tried ? '' : 'none';
    shareBtn.style.display = lone ? 'none' : '';
    setOff(sendBtn, vis !== 'idle' || (lone ? vis !== 'idle' : !game.banked || !game.message));
    setOff(shareBtn, vis !== 'idle' || !!game.banked || done);
    for (const b of [phaseBtn, flipBtn]) setOff(b, vis !== 'idle' || (!lone && (!game.banked || !game.message)));
    const xs = (lone ? game.loneMoves : game.moves).filter((m) => m === 'X').length % 2 === 1;
    const zs = (lone ? game.loneMoves : game.moves).filter((m) => m === 'Z').length % 2 === 1;
    flipBtn.setAttribute('aria-pressed', String(xs));
    phaseBtn.setAttribute('aria-pressed', String(zs));
    // readout
    if (lone) {
      const last = game.loneAttempts[game.loneAttempts.length - 1];
      readout.className = 'readout';
      readout.replaceChildren(...kids(
        h('span', { class: 'lbl' }, 'Bob received'),
        last ? h('span', { class: 'val mono', style: 'font-size:26px' }, '?', h('span', { class: 'f' }, String(last.readFlip))) : h('span', { class: 'val muted' }, '…'),
        h('span', { class: 'lbl' }, 'needed'),
        bitsEl(game.ceilingMessage, 'val mono'),
        last ? h('span', { class: 'bad' }, 'One qubit → one bit. The PHASE bit can’t ride a lone ▲/▼.') : null));
    } else {
      const pat = game.pattern;
      const target = game.message;
      const match = !!pat && !!target && pat === target;
      readout.className = `readout ${target && game.banked ? (match ? 'match' : 'miss') : ''}`;
      readout.replaceChildren(...kids(
        h('span', { class: 'lbl' }, 'Link'),
        game.banked ? patternBadge(pat, v) : h('span', { class: 'muted' }, 'no pair at Bob’s yet'),
        target && game.banked ? h('span', { class: 'eq', 'aria-hidden': 'true' }, match ? '=' : '≠') : null,
        target && game.banked ? patternBadge(target, v) : null,
        target && game.banked ? h('span', { class: 'lbl' }, match ? 'ready to send' : 'shape it to match') : null));
    }
    // ledger: always honest about what crossed
    const delivered = game.deliveries.length * 2;
    ledger.replaceChildren(
      h('span', {}, 'Halves shared (no message on them)'), h('span', { class: 'n' }, String(shares)),
      h('span', { class: 'muted', style: 'padding-left:12px' }, '…of those, before the message existed'), h('span', { class: 'n muted' }, String(sharedBefore)),
      h('span', {}, 'Qubits sent with a message'), h('span', { class: 'n' }, String(sentWith)),
      h('span', { class: 'tot' }, 'Bits Bob decoded correctly'), h('span', { class: 'n tot' }, String(delivered)));
    spyBox.replaceChildren(game.phase === 'pairs'
      ? h('span', {}, 'For every message: ', h('b', {}, '▲ 50% · ▼ 50%'), '. The sent half alone is pure noise.')
      : h('span', {}, 'A lone ▲/▼ qubit is readable: a spy would learn your one bit.'));
    circuit.replaceChildren(v === 'circuit' && game.phase === 'pairs' ? circuitSvg(game.moves, vis === 'analyze' ? 'decoded' : 'encode', dock?.bits ?? null) : '');
    goals.replaceChildren(goalsList([
      { text: 'Send 11 to Bob in ONE lone qubit', done: tried, now: lone },
      { text: `Deliver all four messages with shared pairs (${game.deliveries.length}/4)`, done: game.done, now: !lone },
    ]));
    // prompts
    if (lone) {
      L.prompt.textContent = tried ? 'Bob got one bit, not two.' : 'Message for Bob: 11. Send it in ONE qubit.';
      L.sub.textContent = tried ? 'Read on its own, a qubit gives at most one bit. That’s the ceiling (Holevo’s theorem).' : 'Bob has nothing from you. Use FLIP and PHASE on this lone qubit, then SEND.';
    } else if (!game.banked && !game.message && vis === 'idle') {
      L.prompt.textContent = game.deliveries.length === 0 ? 'Rewind to this morning. No message yet.' : 'Next: share another pair first.';
      L.sub.textContent = game.deliveries.length === 0 ? 'SHARE: send Bob his half of a fresh pair. It carries nothing… yet.' : 'Every message spends one pair.';
    } else if (game.banked && !game.message) {
      L.prompt.textContent = 'Bob holds his half. Waiting for a message…';
      L.sub.textContent = '';
    } else if (game.message && game.banked && vis === 'idle') {
      L.prompt.textContent = `Message: ${game.message}. Shape the link, send ONE qubit.`;
      L.sub.textContent = 'Make the link match the card. Then only your half crosses.';
    } else if (game.message && !game.banked && vis === 'idle') {
      L.prompt.textContent = 'That pair is spent. Share a new one.';
      L.sub.textContent = 'Then shape and send again.';
    } else if (vis === 'msgFly') {
      L.prompt.textContent = 'One qubit in flight…';
      L.sub.textContent = 'Only your half is crossing. Bob’s half has been waiting at his end.';
    } else if (vis === 'analyze') {
      L.prompt.textContent = 'Bob’s analyzer reads the pair.';
      L.sub.textContent = ctx.view() === 'circuit' ? 'CNOT, then H, then measure both qubits.' : 'UNTANGLE, TURN, READ.';
    }
  }

  const offView = onViewChange(() => update());
  update();
  return {
    el: L.el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === 'f') { move('X'); return true; }
      if (k === 'p') { move('Z'); return true; }
      if (k === 's') { share(); return true; }
      if (k === ' ') { send(); return true; }
      if (k === 'enter') {
        if (game.phase === 'lone' && game.loneAttempts.length) toPairs();
        else if (game.phase === 'pairs' && !game.banked) share();
        else send();
        return true;
      }
      if (k === 'escape') { ctx.go('/levels'); return true; }
      return false;
    },
    destroy: () => { offView(); stage.destroy(); L.cleanup(); },
  };
}
