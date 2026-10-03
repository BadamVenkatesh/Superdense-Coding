/**
 * Missions (levels 6–10) and the arcade: the real-time superdense courier.
 * The engine (src/game/mission.ts) does all the physics; this screen only shows it.
 */
import { audio } from '../../audio/audio';
import { forecastPath } from '../../game/bot';
import { arcadeConfig, type LevelDef } from '../../game/levels';
import { Mission, missionStars, type Diagnosis, type MissionConfig, type MissionEvent, type Message } from '../../game/mission';
import { dailySeedLabel } from '../../quantum/rng';
import { patternBits, type Bits, type Move } from '../../quantum/superdenseCoding';
import type { AppCtx, Screen } from '../app';
import { onViewChange } from '../app';
import { announce, toast } from '../bus';
import { button, fmt, h, heartsHtml, kids, setOff, shake } from '../dom';
import { circuitSvg, completeOverlay, messageCard, moveName, patternBadge, patternName, topbar } from '../components';
import { Scene, type DockM, type FlightM, type RungM, type SceneModel } from '../scene';

const nowS = () => performance.now() / 1000;
const group = (...kids: Node[]) => h('div', { class: 'group' }, ...kids);

interface Intro {
  lines: string[];
  tips: string[];
}

const INTROS: Record<number, Intro> = {
  6: {
    lines: ['Last night you shared four pairs with Bob. His halves are waiting in his rack.', 'Messages will arrive one at a time. Shape the link to match each card, then SEND.'],
    tips: ['FLIP crosses the strands. PHASE makes them zigzag.', 'When Bob’s rack runs low, SHARE more pairs.'],
  },
  7: {
    lines: ['Two rushes are coming. The forecast shows WHEN messages arrive, never WHAT they say.', 'Each message must reach Bob before its fuse burns out.'],
    tips: ['SHARE while it’s quiet so Bob’s rack is full when the rush hits.', 'No pair? BIT BY BIT sends two lone qubits: one bit each, two channel uses.', 'Press early: a press fires the instant the channel opens.'],
  },
  8: {
    lines: ['Zones on the channel twist whatever crosses them while they’re lit.', 'A FLIP zone does a FLIP. A PHASE zone does a PHASE. You didn’t choose it, but it counts.'],
    tips: ['Wait for a zone to pass, or cancel it: add the same move before you send.', 'Shares that cross a zone arrive twisted (⚡). The link shows it, so fix it when you send.'],
  },
  9: {
    lines: ['A spy watches the channel. When its eye is open, it measures whatever crosses.', 'Keep an eye on its notebook.'],
    tips: ['Your paired qubit looks like pure noise to the spy.', 'But looking breaks the pair, so Bob may misread one bit. Time your sends.', 'BIT BY BIT qubits are readable: the spy can learn those.'],
  },
  10: {
    lines: ['The last night. Rushes, zones, a spy and random static.', 'Everything you know, all at once.'],
    tips: ['Bank pairs in every lull.', 'Grey STATIC is random: nobody can undo it, only avoid it.', 'Press early, read the link, watch the eye.'],
  },
};

export interface MissionOpts {
  level?: LevelDef;
  arcade?: { seed: string; classical: boolean; daily: boolean };
}

function diagnosisText(d: Diagnosis | undefined, msg: Message, view: 'game' | 'circuit'): string {
  if (!d) return '';
  switch (d.kind) {
    case 'encode':
      return `Link was ${patternName(d.sent ?? null, view)}, message needed ${patternName(msg.bits, view)}: add ${(d.fix ?? []).map((m) => moveName(m, view)).join(' + ')}.`;
    case 'zone': {
      const k = d.hits?.find((x) => x.source === 'zone' && x.kind !== 'none')?.kind;
      return `A ${k === 'X' ? moveName('X', view) : moveName('Z', view)} zone twisted it in flight: bit ${k === 'X' ? 2 : 1} flipped.`;
    }
    case 'storm':
      return 'Random static hit it. Nobody could have known which way.';
    case 'spy':
      return 'The spy’s look broke the pair, so the analyzer got a coin flip on one bit.';
    case 'expired':
      return 'The fuse ran out before it reached Bob.';
    default:
      return '';
  }
}

export function missionScreen(ctx: AppCtx, opts: MissionOpts): Screen {
  const level = opts.level;
  const arcade = opts.arcade;
  const classical = !!arcade?.classical || location.hash.endsWith('/classical');
  const cfg: MissionConfig = arcade ? arcadeConfig(arcade.seed, arcade.classical) : { ...level!.mission!, classical: classical || level!.mission!.classical };
  const features = arcade ? { slow: true, zones: true, spy: true, forecast: true } : level!.features ?? {};
  let m = new Mission(cfg);
  let started = false;
  let paused = false;
  let ended = false;
  let raf = 0;
  let last = nowS();
  let toggledAt = 0;
  let dockAnim: { dock: DockM; until: number } | null = null;
  let flightHitAt = 0;
  let spyReadAt = 0;
  const logItems: HTMLElement[] = [];
  let queueSig = '';
  let readoutSig = '';
  let forecastAt = -1;

  // ── DOM ──────────────────────────────────────────────────────────────
  const hearts = h('span', { class: 'chip hearts', 'aria-label': 'Hearts' });
  const score = h('span', { class: 'chip' });
  const streak = h('span', { class: 'chip' });
  const progress = h('span', { class: 'chip' });
  const title = arcade ? `ARCADE${arcade.classical ? ' · CLASSICAL' : ''}` : level!.title;
  const bar = topbar(ctx, title, arcade ? (arcade.daily ? `DAILY ${arcade.seed}` : 'ENDLESS') : `LEVEL ${level!.id}`, [progress, hearts, score, streak]);
  const prompt = h('h2', { class: 'prompt' });
  const sub = h('p', { class: 'subprompt' });
  const forecast = h('div', { class: 'forecast', 'aria-label': 'Forecast: when messages will arrive', role: 'img' });
  const queue = h('div', { class: 'queue', 'aria-label': 'Messages waiting', role: 'list' });
  const canvas = h('canvas', { class: 'stage', role: 'img', 'aria-label': 'Alice on the left, Bob on the right. Banked pairs stack as rungs; the channel runs along the bottom.' });
  const caption = h('div', { class: 'stage-caption' });
  const tags = h('div', { class: 'stage-tags', 'aria-hidden': 'true' }, h('span', { class: 'alice' }, 'YOU · ALICE'), h('span', { class: 'bob' }, 'BOB · RACK'));
  const stageWrap = h('div', { class: 'stage-wrap' }, canvas, tags, caption);
  const readout = h('div', { class: 'readout grow', 'aria-live': 'off' });
  const phaseBtn = button('PHASE', { key: 'P', cls: 'toggle phase-btn', title: 'PHASE your half of the next pair', onClick: () => doMove('Z') });
  const flipBtn = button('FLIP', { key: 'F', cls: 'toggle flip-btn', title: 'FLIP your half of the next pair', onClick: () => doMove('X') });
  const sendBtn = button('SEND', { key: 'Space', cls: 'primary', title: 'Send your half of the next pair: the message rides on the pair', onClick: () => act('send') });
  const shareBtn = button('SHARE', { key: 'S', cls: 'bob-btn', title: 'Send Bob his half of a new pair (no message)', onClick: () => act('share') });
  const slowBtn = button('BIT BY BIT', { key: 'B', cls: 'ghost', title: 'Send the message as two lone qubits: one bit each', onClick: () => act('slow') });
  const log = h('div', { class: 'log', 'aria-label': 'Bob’s decoded messages' });
  const notebook = h('div', { class: 'history', 'aria-label': 'Spy notebook' });
  const circuitBox = h('div', { class: 'circuit' });
  const rackInfo = h('span', { class: 'chip' });

  const controls = h('div', { class: 'controls' }, group(phaseBtn, flipBtn), readout, group(sendBtn, shareBtn, features.slow || classical ? slowBtn : h('span')));
  const bottom = h('div', { class: 'cols', style: 'grid-template-columns:minmax(0,1fr) minmax(0,1fr)' },
    h('div', { class: 'card panel' }, h('h4', {}, 'Bob decoded'), log),
    features.spy ? h('div', { class: 'card panel' }, h('h4', {}, 'Spy’s notebook'), notebook) : h('div', { class: 'card panel' }, h('h4', {}, 'Rack'), rackInfo, circuitBox));
  const el = h('div', { class: 'screen level' },
    bar, prompt, sub,
    features.forecast ? forecast : null,
    queue, stageWrap, controls, bottom);
  if (classical) {
    setOff(phaseBtn, true);
    setOff(flipBtn, true);
    setOff(sendBtn, true);
    setOff(shareBtn, true);
  }

  const scene = new Scene(canvas, () => model());
  scene.reducedMotion = ctx.reducedMotion();
  scene.start();

  const syncLabels = () => {
    const v = ctx.view();
    (phaseBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'Z (PHASE)' : 'PHASE';
    (flipBtn.firstChild as HTMLElement).textContent = v === 'circuit' ? 'X (FLIP)' : 'FLIP';
    queueSig = '';
  };
  const offView = onViewChange(syncLabels);
  syncLabels();

  // ── model for the canvas ─────────────────────────────────────────────
  function model(): SceneModel {
    const v = ctx.view();
    const rungs: RungM[] = m.rack.map((p, i) => ({
      id: p.id,
      a: {},
      b: {},
      pattern: p.uncertain ? null : patternBits(p.state),
      link: p.uncertain ? 'uncertain' : 'linked',
      changedAt: i === 0 ? toggledAt : undefined,
      twisted: p.hits.some((x) => x.source === 'zone' && x.kind !== 'none'),
    }));
    let flight: FlightM | null = null;
    let dock: DockM | null = null;
    const f = m.flight;
    if (f) {
      const pat = f.pair && !f.pair.uncertain ? patternBits(f.pair.state) : null;
      const link = f.pair?.uncertain ? 'uncertain' : 'linked';
      if (f.kind === 'share') {
        rungs.push({ id: f.pair!.id, a: {}, b: null, pattern: pat, link });
        flight = { id: f.id, kind: 'share', x: f.x, rungId: f.pair!.id, pattern: pat, link, hitAt: flightHitAt };
      } else if (f.kind === 'message') {
        flight = { id: f.id, kind: 'message', x: f.x, pattern: pat, link, hitAt: flightHitAt };
        dock = { t0: 0, pattern: pat, link, waiting: true };
      } else {
        const q = f.lone!;
        const p1 = q.amps[1].re * q.amps[1].re + q.amps[1].im * q.amps[1].im;
        flight = { id: f.id, kind: 'bit', x: f.x, glyph: p1 > 0.99 ? 'down' : p1 < 0.01 ? 'up' : null, hitAt: flightHitAt };
      }
    }
    if (!dock && dockAnim && nowS() < dockAnim.until) dock = dockAnim.dock;
    const zones = m.cfg.zones.map((z) => ({ z, st: m.zoneState(z) })).filter((x) => x.st !== 'off').map((x) => ({ kind: x.z.kind, x0: x.z.x0, x1: x.z.x1, state: x.st as 'warn' | 'on' }));
    const spy = m.cfg.spy && m.t >= m.cfg.spy.offset - 2 ? { x: m.cfg.spy.x, open: m.spyOpen(), readAt: spyReadAt } : null;
    return {
      rungs, slots: m.cfg.rackCap + 1, flight, zones, spy, dock, view: v,
      channel: { ready: m.channelReady && !m.reserved, recharge: m.recharge, armed: !!m.armed },
    };
  }

  // ── actions ──────────────────────────────────────────────────────────
  function doMove(mv: Move) {
    audio.unlock();
    if (!started || paused || ended) return;
    if (classical) { shake(mv === 'X' ? flipBtn : phaseBtn); toast('Classical mode: no pairs, no moves.'); return; }
    if (!m.head) { shake(mv === 'X' ? flipBtn : phaseBtn); toast('No pair at Bob’s yet. SHARE one first.'); return; }
    m.toggle(mv);
    toggledAt = nowS();
    mv === 'X' ? audio.flip() : audio.phase();
    announce(`Link is now ${patternName(m.head.uncertain ? null : patternBits(m.head.state), ctx.view())}`);
  }

  function act(a: 'send' | 'share' | 'slow') {
    audio.unlock();
    if (!started) return begin();
    if (paused || ended) return;
    const btn = a === 'send' ? sendBtn : a === 'share' ? shareBtn : slowBtn;
    const r = m.press(a);
    if (r === 'done' || r === 'armed') {
      if (r === 'armed') audio.click();
      return;
    }
    shake(btn);
    const why: Record<string, string> = {
      'no-message': 'No message waiting. Bank pairs while it’s quiet.',
      'no-pair': 'Bob has no half from you. SHARE first, or send BIT BY BIT.',
      'rack-full': 'Bob’s rack is full.',
      disabled: classical ? 'Classical mode: there are no entangled pairs.' : 'Not available in this level.',
      over: '',
    };
    if (why[r]) toast(why[r]);
  }

  // ── events → sound, log, announcements ───────────────────────────────
  function handle(e: MissionEvent) {
    const v = ctx.view();
    switch (e.type) {
      case 'spawn':
        audio.tick();
        announce(`New message ${e.msg.bits[0]} ${e.msg.bits[1]}`);
        break;
      case 'launch':
        audio.send(m.cfg.travel);
        flightHitAt = 0;
        break;
      case 'hit':
        if (e.hit.kind !== 'none') {
          flightHitAt = nowS();
          audio.zap();
          if (e.visible) caption.textContent = `${e.hit.kind === 'X' ? moveName('X', v) : moveName('Z', v)} zone hit the ${e.flight.kind === 'share' ? 'shared half' : 'qubit'}`;
        }
        break;
      case 'spy': {
        spyReadAt = nowS();
        audio.spy();
        const en = e.entry;
        const glyph = en.basis === 'Z' ? (en.outcome ? '▼' : '▲') : en.outcome ? '◀' : '▶';
        const what = en.kind === 'message' ? `msg ${en.msgBits} → saw ${glyph}` : en.kind === 'share' ? `shared half → saw ${glyph}` : `lone bit → saw ${glyph}${en.learned ? ' (learned it!)' : ''}`;
        notebook.prepend(h('span', { class: `res ${en.learned ? 'opp' : ''}` }, what));
        break;
      }
      case 'banked':
        audio.arrive();
        break;
      case 'bit':
        audio.answer(e.value, 'B');
        break;
      case 'decode': {
        const msg = e.msg;
        if (msg.via === 'pair') {
          dockAnim = {
            dock: { t0: nowS(), pattern: msg.sentPattern ?? null, link: msg.sentPattern ? 'linked' : 'uncertain', bits: msg.decoded!, correct: e.correct },
            until: nowS() + 2.2,
          };
          audio.decode(msg.decoded!);
        }
        if (e.correct) audio.good(); else audio.bad();
        const d = diagnosisText(msg.diagnosis, msg, v);
        const item = h('span', { class: `res ${e.correct ? 'good' : 'bad'}`, title: d },
          h('span', {}, msg.bits), e.correct ? h('span', { class: 'good' }, '✓') : h('span', { class: 'bad' }, `→ ${msg.decoded} ✗`), msg.via === 'bits' ? h('span', { class: 'muted' }, '·bits') : null);
        logItems.unshift(item);
        log.prepend(item);
        while (log.children.length > 14) log.lastElementChild?.remove();
        if (!e.correct) toast(d, 'bad', 3800);
        announce(e.correct ? `Bob decoded ${msg.bits}. Correct.` : `Bob decoded ${msg.decoded} instead of ${msg.bits}. ${d}`);
        caption.textContent = e.correct ? `Bob read ${msg.decoded} ✓${msg.via === 'pair' ? ' · one qubit crossed for it' : ' · two qubits crossed for it'}` : d;
        break;
      }
      case 'expire': {
        audio.bad();
        const item = h('span', { class: 'res bad' }, h('span', {}, e.msg.bits), h('span', { class: 'bad' }, 'expired'));
        log.prepend(item);
        toast('A message expired before it reached Bob.', 'bad');
        break;
      }
      case 'end':
        finish(e.won);
        break;
      default:
        break;
    }
  }

  // ── DOM refresh ──────────────────────────────────────────────────────
  function refresh() {
    const v = ctx.view();
    const setHtml = (e: HTMLElement, html: string) => { if (e.innerHTML !== html) e.innerHTML = html; };
    setHtml(hearts, heartsHtml(m.hearts, m.cfg.hearts));
    setHtml(score, `score <b>${fmt(m.score)}</b>`);
    setHtml(streak, `streak <b>${m.streak}</b>`);
    setHtml(progress, arcade ? `delivered <b>${m.stats.correct}</b>` : `<b>${m.stats.correct + m.stats.wrong + m.stats.expired}/${m.total}</b>`);
    // queue
    const sig = m.queue.map((q) => `${q.id}:${q.status}`).join(',') + `|${v}`;
    if (sig !== queueSig) {
      queueSig = sig;
      const target = m.target;
      queue.replaceChildren(...(m.queue.length ? m.queue.map((q) => {
        const c = messageCard(q.bits, v, { target: q === target, sending: q.status === 'sending', fuse: Number.isFinite(q.fuse) ? q.left / q.fuse : undefined });
        c.dataset.id = String(q.id);
        c.setAttribute('role', 'listitem');
        return c;
      }) : [h('span', { class: 'queue-empty' }, started ? 'No messages waiting. Quiet time: bank pairs.' : 'Messages will appear here.')]));
    } else {
      for (const q of m.queue) {
        const fuse = queue.querySelector<HTMLElement>(`[data-id="${q.id}"] .fuse`);
        if (fuse && Number.isFinite(q.fuse)) {
          const f = q.left / q.fuse;
          fuse.classList.toggle('low', f < 0.3);
          (fuse.firstElementChild as HTMLElement).style.width = `${Math.round(f * 100)}%`;
        }
      }
    }
    // readout: link vs target
    const head = m.head;
    const target = m.target;
    const pat = head && !head.uncertain ? patternBits(head.state) : null;
    const path = forecastPath(m);
    const twists = (['X', 'Z'] as Move[]).filter((k) => path.twist[k]);
    const rSig = [classical, head?.id, head?.uncertain, pat, target?.id, twists.join(''), path.risky, v].join('|');
    const rebuild = rSig !== readoutSig;
    readoutSig = rSig;
    if (!rebuild) {
      /* unchanged: keep the existing readout */
    } else if (classical) {
      readout.className = 'readout grow';
      readout.replaceChildren(h('span', { class: 'lbl' }, 'Classical mode'), h('span', { class: 'agree' }, 'No entangled pairs. Every message needs two lone qubits: BIT BY BIT.'));
    } else if (!head) {
      readout.className = 'readout grow miss';
      readout.replaceChildren(h('span', { class: 'lbl' }, 'Link'), h('span', { class: 'muted' }, 'Bob’s rack is empty. SHARE a pair.'));
    } else {
      let wanted: Bits | null = target?.bits ?? null;
      if (wanted && twists.includes('X')) wanted = `${wanted[0]}${wanted[1] === '1' ? '0' : '1'}` as Bits;
      if (wanted && twists.includes('Z')) wanted = `${wanted[0] === '1' ? '0' : '1'}${wanted[1]}` as Bits;
      const match = !!pat && !!target && pat === wanted;
      readout.className = `readout grow ${target ? (match ? 'match' : 'miss') : ''}`;
      readout.replaceChildren(...kids(
        h('span', { class: 'lbl' }, 'Link'),
        head.uncertain ? h('span', { class: 'val' }, '? unknown') : patternBadge(pat, v, { size: 44 }),
        target ? h('span', { class: 'eq', 'aria-hidden': 'true' }, match ? '=' : '≠') : null,
        target ? patternBadge(target.bits, v, { size: 44, desc: false }) : h('span', { class: 'agree' }, 'no message yet'),
        twists.length && target ? h('span', { class: 'agree', style: 'color:var(--warn)' }, `⚠ a ${twists.map((k) => moveName(k, v)).join(' + ')} zone will hit it: ${match ? 'cancelled ✓' : 'add that move to cancel it'}`) : null,
        path.risky ? h('span', { class: 'agree', style: 'color:var(--bad)' }, '⚠ risky right now: something random or a spy is on the way') : null));
    }
    flipBtn.setAttribute('aria-pressed', String(m.netMoves.X));
    phaseBtn.setAttribute('aria-pressed', String(m.netMoves.Z));
    sendBtn.classList.toggle('armed', m.armed === 'send');
    shareBtn.classList.toggle('armed', m.armed === 'share');
    slowBtn.classList.toggle('armed', m.armed === 'slow');
    if (!classical) {
      setOff(sendBtn, !m.target || !m.head);
      setOff(shareBtn, m.rack.length >= m.cfg.rackCap);
      setOff(phaseBtn, !m.head);
      setOff(flipBtn, !m.head);
    }
    setOff(slowBtn, !m.target);
    const rackTxt = `Bob holds <b>${m.rack.length}/${m.cfg.rackCap}</b> halves`;
    if (rackInfo.innerHTML !== rackTxt) rackInfo.innerHTML = rackTxt;
    const cSig = `${v}|${m.moves.join('')}`;
    if (!features.spy && circuitBox.dataset.sig !== cSig) {
      circuitBox.dataset.sig = cSig;
      if (v === 'circuit') circuitBox.replaceChildren(circuitSvg(m.moves, 'encode'));
      else circuitBox.replaceChildren();
    }
    // forecast strip: next 20 s (10 updates a second is plenty)
    if (features.forecast && (performance.now() - forecastAt > 100 || forecastAt < 0)) {
      forecastAt = performance.now();
      const H = 20;
      const kids: HTMLElement[] = [h('div', { class: 'now' }), h('span', { class: 'lab' }, 'NEXT 20 s')];
      for (const t of m.upcoming(H)) kids.push(h('div', { class: 'tick', style: `left:${((t - m.t) / H) * 100}%` }));
      for (const z of m.cfg.zones) {
        const a = Math.max(z.at, m.t);
        const b = Math.min(z.at + z.duration, m.t + H);
        if (b > a) kids.push(h('div', { class: `zone ${z.kind === '?' ? 'Q' : z.kind}`, style: `left:${((a - m.t) / H) * 100}%;width:${((b - a) / H) * 100}%` }));
      }
      const s = m.cfg.spy;
      if (s) for (let k = Math.max(0, Math.floor((m.t - s.offset) / s.period)); k < 200; k++) {
        const a = s.offset + k * s.period;
        if (a > m.t + H) break;
        const b = a + s.open;
        if (b < m.t) continue;
        kids.push(h('div', { class: 'spy', style: `left:${((Math.max(a, m.t) - m.t) / H) * 100}%;width:${((Math.min(b, m.t + H) - Math.max(a, m.t)) / H) * 100}%` }));
      }
      forecast.replaceChildren(...kids);
    }
    // prompt (only touch the DOM when the words change)
    if (!started) return;
    let P = '';
    let S = '';
    const w = m.waiting.length;
    if (classical) {
      P = 'No entanglement. Two qubits per message.';
      S = 'The Holevo limit: read on its own, each qubit can carry at most one bit.';
    } else if (!m.head && w) {
      P = 'Bob has no half! SHARE, or go BIT BY BIT.';
      S = 'Lesson for next time: bank pairs before the rush.';
    } else if (w) {
      P = pat === target?.bits && !twists.length ? 'Matches. SEND.' : 'Shape the link to match the message.';
      S = `${v === 'circuit' ? 'X' : 'FLIP'} crosses the strands (2nd bit). ${v === 'circuit' ? 'Z' : 'PHASE'} makes them zigzag (1st bit).`;
    } else {
      P = m.rack.length < m.cfg.rackCap ? 'Quiet. Bank pairs: SHARE.' : 'Rack full. Ready for the rush.';
      S = 'A shared half carries no message, so you can send it before you know what you’ll say.';
    }
    if (prompt.textContent !== P) prompt.textContent = P;
    if (sub.textContent !== S) sub.textContent = S;
  }

  // ── loop ─────────────────────────────────────────────────────────────
  function frame() {
    raf = requestAnimationFrame(frame);
    const t = nowS();
    const dt = Math.min(0.1, t - last);
    last = t;
    if (started && !paused && !ended) {
      m.tick(dt);
      for (const e of m.drain()) handle(e);
    }
    refresh();
  }

  // ── intro / pause / end ──────────────────────────────────────────────
  let overlay: HTMLElement | null = null;
  function showIntro() {
    const intro = arcade
      ? { lines: [arcade.classical ? 'Classical mode: entanglement switched off. Every message must go BIT BY BIT.' : 'An endless night. The rushes keep growing.', 'Three hearts. How long can you keep Bob in the loop?'], tips: ['Daily seed: everyone gets the same messages today.', arcade.classical ? 'Compare your score with the quantum run: that gap is the superdense advantage.' : 'Try Classical mode afterwards and compare.'] }
      : INTROS[level!.id];
    overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal' },
        h('div', { class: 'kicker' }, arcade ? 'Arcade' : `Level ${level!.id} · ${level!.tagline}`),
        h('h2', {}, title),
        ...intro.lines.map((l) => h('p', { class: 'insight', style: 'font-size:16px;margin:8px 0' }, l)),
        h('ul', { class: 'muted', style: 'padding-left:18px;margin:8px 0' }, ...intro.tips.map((t) => h('li', {}, t))),
        level?.goal ? h('div', { class: 'formal' }, h('b', {}, 'Goal: '), level.goal) : null,
        h('div', { class: 'actions' }, button('Start', { cls: 'primary', key: 'Space', onClick: begin }), button('Levels', { cls: 'ghost', onClick: () => ctx.go(arcade ? '/' : '/levels') }))));
    el.append(overlay);
    setTimeout(() => overlay?.querySelector<HTMLButtonElement>('.btn.primary')?.focus(), 30);
  }

  function begin() {
    if (started) return;
    audio.unlock();
    overlay?.remove();
    overlay = null;
    started = true;
    last = nowS();
    queueSig = '';
  }

  function pause(on: boolean) {
    if (!started || ended || paused === on) return;
    paused = on;
    if (on) {
      overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Paused' },
        h('div', { class: 'modal' }, h('h2', {}, 'Paused'),
          h('div', { class: 'actions' },
            button('Resume', { cls: 'primary', key: 'Esc', onClick: () => pause(false) }),
            button('Restart', { onClick: restart }),
            button('Levels', { cls: 'ghost', onClick: () => ctx.go(arcade ? '/' : '/levels') }))));
      el.append(overlay);
      setTimeout(() => overlay?.querySelector<HTMLButtonElement>('.btn.primary')?.focus(), 30);
    } else {
      overlay?.remove();
      overlay = null;
      last = nowS();
    }
  }

  function restart() {
    overlay?.remove();
    overlay = null;
    m = new Mission(cfg);
    started = false;
    paused = false;
    ended = false;
    dockAnim = null;
    log.replaceChildren();
    notebook.replaceChildren();
    queueSig = '';
    readoutSig = '';
    showIntro();
  }

  function finish(won: boolean) {
    if (ended) return;
    ended = true;
    const s = m.stats;
    won ? audio.win() : audio.lose();
    const stars = missionStars(m);
    let record = false;
    if (arcade) record = ctx.store.arcadeResult(m.score, arcade.classical, arcade.daily ? arcade.seed : null);
    else if (won && !classical) ctx.store.complete(level!.id, stars, m.score);
    const msgs = s.correct + s.wrong + s.expired;
    const pairQubits = s.pairSends;
    const statgrid = h('div', { class: 'statgrid' },
      ...[
        ['Delivered', `${s.correct}/${msgs}`],
        ['Bits to Bob', String(s.bitsDelivered)],
        ['Score', fmt(m.score)],
        ['Best streak', String(m.bestStreak)],
      ].map(([k, v]) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v))));
    const ledger = h('div', { class: 'ledger' },
      h('span', {}, 'Halves shared ahead (no message on them)'), h('span', { class: 'n' }, String(s.shares)),
      h('span', {}, 'Qubits that carried a message via a pair'), h('span', { class: 'n' }, String(pairQubits)),
      h('span', {}, 'Lone qubits (bit by bit, 1 bit each)'), h('span', { class: 'n' }, String(s.bitSends)),
      h('span', { class: 'tot' }, 'Channel uses in total'), h('span', { class: 'n tot' }, String(s.qubitsSent)),
      h('span', { class: 'muted' }, 'Messages whose pair was shared before the message existed'), h('span', { class: 'n muted' }, String(s.preSharedUsed)),
      features.spy || s.spyReadings ? h('span', {}, 'Bits the spy learned') : null,
      features.spy || s.spyReadings ? h('span', { class: 'n' }, `${s.spyLearnedBits} (from ${s.spyReadings} looks)`) : null);
    const note = h('p', { class: 'agree', style: 'margin:10px 0 0' }, classical
      ? 'Without entanglement, each qubit can carry at most one bit when read (Holevo), so every message used two channel uses at the moment it was needed.'
      : `During the rushes, each message needed just one channel use. The other half had crossed during a quiet moment. Total uses are the same; WHEN they happen is what entanglement changes.`);
    const extra = h('div', {}, statgrid, ledger, note,
      !arcade && level!.id === 7 && !classical ? h('div', { style: 'margin-top:12px' }, button('Try this rush with NO entanglement', { cls: 'small', onClick: () => { overlay?.remove(); ctx.go('/level/7/classical'); } })) : null,
      record ? h('p', { class: 'good', style: 'margin:8px 0 0' }, 'New best!') : null);
    if (arcade) {
      overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal' },
          h('div', { class: 'kicker' }, arcade.classical ? 'Arcade · classical' : 'Arcade'),
          h('h2', {}, `Night over: ${fmt(m.score)}`),
          extra,
          h('p', { class: 'muted', style: 'font-size:14px' }, `Best quantum: ${fmt(ctx.store.data.arcade.quantum)} · best classical: ${fmt(ctx.store.data.arcade.classical)}`),
          h('div', { class: 'actions' },
            button('Again', { cls: 'primary', key: 'R', onClick: restart }),
            button(arcade.classical ? 'Play quantum' : 'Play classical', { onClick: () => ctx.go(arcade.classical ? '/arcade' : '/arcade/classical') }),
            button('Title', { cls: 'ghost', onClick: () => ctx.go('/') }))));
      el.append(overlay);
      setTimeout(() => overlay?.querySelector<HTMLButtonElement>('.btn.primary')?.focus(), 30);
      return;
    }
    if (classical && level) {
      overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true' },
        h('div', { class: 'modal' },
          h('div', { class: 'kicker' }, `Level ${level.id} · no entanglement`),
          h('h2', {}, won ? 'Survived… barely?' : 'The rush wins without pairs'),
          extra,
          h('div', { class: 'actions' },
            button('Play it with entanglement', { cls: 'primary', onClick: () => ctx.go(`/level/${level.id}`) }),
            button('Levels', { cls: 'ghost', onClick: () => ctx.go('/levels') }))));
      el.append(overlay);
      return;
    }
    overlay = completeOverlay({ level: level!, stars, ctx, onReplay: restart, extra, won });
    el.append(overlay);
  }

  const onVis = () => { if (document.hidden) pause(true); };
  document.addEventListener('visibilitychange', onVis);
  // Read-only snapshot for automated end-to-end tests (scripts/e2e.mjs). Never used by the game.
  const hook = window as unknown as { __otherHalf?: { snapshot: () => unknown } };
  hook.__otherHalf = {
    snapshot: () => {
      const path = forecastPath(m);
      return {
        status: m.status, started, paused, t: m.t, ready: m.channelReady, armed: m.armed, reserved: !!m.reserved,
        target: m.target?.bits ?? null,
        head: m.head ? (m.head.uncertain ? '??' : patternBits(m.head.state)) : null,
        rack: m.rack.length, cap: m.cfg.rackCap, twist: path.twist, risky: path.risky,
        hearts: m.hearts, score: m.score, stats: { ...m.stats }, classical: !!m.cfg.classical,
        failures: m.done.filter((d) => d.status !== 'delivered').map((d) => ({ bits: d.bits, decoded: d.decoded, sent: d.sentPattern, diag: d.diagnosis?.kind, via: d.via })),
      };
    },
  };
  raf = requestAnimationFrame(frame);
  showIntro();

  return {
    el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (overlay && !paused && !started && (k === ' ' || k === 'enter')) { begin(); return true; }
      if (k === 'escape') {
        if (ended) { ctx.go(arcade ? '/' : '/levels'); return true; }
        if (!started) { ctx.go(arcade ? '/' : '/levels'); return true; }
        pause(!paused);
        return true;
      }
      if (overlay && (paused || ended)) return false;
      if (e.repeat) return true;
      if (k === 'f') { doMove('X'); return true; }
      if (k === 'p') { doMove('Z'); return true; }
      if (k === ' ' || k === 'enter') { act(classical ? 'slow' : 'send'); return true; }
      if (k === 's') { act('share'); return true; }
      if (k === 'b') { act('slow'); return true; }
      return false;
    },
    destroy() {
      delete hook.__otherHalf;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVis);
      offView();
      scene.destroy();
      (bar as HTMLElement & { cleanup?: () => void }).cleanup?.();
    },
  };
}

/** #/arcade, #/arcade/classical, #/arcade/random */
export function arcadeScreen(ctx: AppCtx, params: string[]): Screen {
  const classical = params.includes('classical');
  const random = params.includes('random');
  const seed = random ? `r-${Math.floor(Math.random() * 1e9)}` : dailySeedLabel();
  return missionScreen(ctx, { arcade: { seed, classical, daily: !random } });
}
