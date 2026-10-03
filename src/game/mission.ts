/**
 * The mission engine: Alice → channel → Bob, in real time.
 *
 * Rules (all of them are the physics):
 *   - The channel carries ONE qubit at a time and needs `window` seconds to recharge.
 *   - SHARE sends Bob his half of a fresh Bell pair. It carries no message, so it can be
 *     done before any message exists. It is banked in Bob's rack.
 *   - SEND spends the oldest banked pair. Alice's FLIP/PHASE moves (real X/Z gates on her
 *     half) shape the pair, her half crosses, and Bob's analyzer (CNOT, H, measure) reads
 *     two bits.
 *   - BIT BY BIT sends a message without a pair: two lone qubits, one bit each (the Holevo
 *     ceiling), so it needs two windows.
 *   - Zones on the channel apply a real Pauli to whatever crosses them while active.
 *     A spy measures whatever crosses under its open eye.
 *
 * Every pair is a genuine 2-qubit state vector. Every reading is a sampled measurement.
 * Nothing is scripted.
 */
import { measureQubit, type Basis } from '../quantum/measurement';
import { seeded, type Rng } from '../quantum/rng';
import { applyGate } from '../quantum/gates';
import { basisState, type State } from '../quantum/state';
import { bellMeasure, createPair, encode, patternBits, type Bits, type Move } from '../quantum/superdenseCoding';
import { deliveryScore, finishBonus } from './scoring';

export type FlightKind = 'share' | 'message' | 'bit';
export type ZoneKind = 'X' | 'Z' | '?';

export interface Hit {
  /** What happened to the qubit in flight. '?' zones and spies are not visible to the player. */
  kind: 'X' | 'Z' | 'spy' | 'none';
  source: 'zone' | 'storm' | 'spy';
  basis?: Basis;
}

export interface Pair {
  id: number;
  state: State;
  sharedAt: number;
  hits: Hit[];
  /** True when something unknowable (a random storm, a spy) touched it: the player can't know its pattern. */
  uncertain: boolean;
}

export interface Diagnosis {
  kind: 'ok' | 'encode' | 'zone' | 'storm' | 'spy' | 'expired';
  /** For 'encode': the pattern Alice actually sent. */
  sent?: Bits | null;
  /** For 'encode': which moves would have fixed it. */
  fix?: Move[];
  hits?: Hit[];
}

export interface Message {
  id: number;
  bits: Bits;
  born: number;
  fuse: number;
  /** Seconds left to reach Bob (Infinity when untimed). Keeps burning while in transit. */
  left: number;
  status: 'waiting' | 'sending' | 'delivered' | 'garbled' | 'expired';
  via?: 'pair' | 'bits';
  decoded?: Bits;
  sentPattern?: Bits | null;
  diagnosis?: Diagnosis;
  /** Bit-by-bit progress. */
  slow?: { bits: [0 | 1, 0 | 1]; sent: number; got: (0 | 1)[] };
  /** The pre-shared pair it used was shared before this message existed. */
  preShared?: boolean;
  score?: number;
  resolvedAt?: number;
}

export interface Flight {
  id: number;
  kind: FlightKind;
  /** 0 at Alice, 1 at Bob. */
  x: number;
  pair?: Pair;
  msg?: Message;
  lone?: State;
  bitIndex?: number;
  hits: Hit[];
  zonesDone: number[];
  spied: boolean;
}

export interface ZoneSpec {
  kind: ZoneKind;
  at: number;
  duration: number;
  /** Channel span covered, 0 (Alice) … 1 (Bob). */
  x0: number;
  x1: number;
  /** Seconds of visible warning before it switches on. */
  warn?: number;
}

export interface SpySpec {
  x: number;
  period: number;
  open: number;
  offset: number;
}

export interface Wave {
  calm?: number;
  rush?: number;
  gap?: number;
}

export interface MissionConfig {
  seed: string;
  waves: Wave[];
  fuse: number;
  window: number;
  travel: number;
  rackCap: number;
  startRack: number;
  hearts: number;
  zones?: ZoneSpec[];
  spy?: SpySpec;
  classical?: boolean;
  allowSlow?: boolean;
  allowShare?: boolean;
  /** Arcade: the schedule keeps escalating until hearts run out. */
  endless?: boolean;
}

export interface SpyEntry {
  t: number;
  kind: FlightKind;
  basis: Basis;
  outcome: 0 | 1;
  /** The message the qubit belonged to (unknown to the spy). */
  msgBits?: Bits;
  /** For a lone bit read in ▲▼, the spy learned it exactly. */
  learned: boolean;
}

export type MissionEvent =
  | { type: 'spawn'; msg: Message }
  | { type: 'expire'; msg: Message }
  | { type: 'launch'; flight: Flight }
  | { type: 'hit'; flight: Flight; hit: Hit; visible: boolean }
  | { type: 'spy'; flight: Flight; entry: SpyEntry }
  | { type: 'banked'; pair: Pair }
  | { type: 'bit'; msg: Message; value: 0 | 1; index: number }
  | { type: 'decode'; msg: Message; correct: boolean }
  | { type: 'move'; move: Move }
  | { type: 'end'; won: boolean };

export interface MissionStats {
  correct: number;
  wrong: number;
  expired: number;
  shares: number;
  pairSends: number;
  bitSends: number;
  qubitsSent: number;
  bitsDelivered: number;
  preSharedUsed: number;
  slowMessages: number;
  spyLearnedBits: number;
  spyReadings: number;
  hits: number;
  maxWaiting: number;
}

export type Refusal = 'busy' | 'cooldown' | 'no-message' | 'no-pair' | 'rack-full' | 'reserved' | 'disabled' | 'over' | null;

/** Message arrival times for a wave plan. Content is NOT decided here: it is drawn at arrival. */
export function scheduleFromWaves(waves: readonly Wave[], start = 0): number[] {
  const out: number[] = [];
  let t = start;
  for (const w of waves) {
    if (w.calm) t += w.calm;
    if (w.rush) {
      const gap = w.gap ?? 1.5;
      for (let i = 0; i < w.rush; i++) out.push(Number((t + i * gap).toFixed(3)));
      t += w.rush * gap;
    }
  }
  return out;
}

/** An escalating endless plan for the arcade. */
export function endlessWaves(count = 40): Wave[] {
  const w: Wave[] = [{ calm: 6 }];
  for (let i = 0; i < count; i++) {
    const rush = Math.min(4 + i, 12);
    const gap = Math.max(2.3 - i * 0.12, 1.05);
    w.push({ rush, gap }, { calm: Math.max(9 - i * 0.6, 3.5) });
  }
  return w;
}

const BITS: Bits[] = ['00', '01', '10', '11'];
const bit = (b: string): 0 | 1 => (b === '1' ? 1 : 0);

export class Mission {
  readonly cfg: Required<Omit<MissionConfig, 'spy' | 'zones'>> & { spy?: SpySpec; zones: ZoneSpec[] };
  t = 0;
  cooldown = 0;
  hearts: number;
  score = 0;
  streak = 0;
  bestStreak = 0;
  status: 'running' | 'won' | 'lost' = 'running';
  queue: Message[] = [];
  done: Message[] = [];
  rack: Pair[] = [];
  flight: Flight | null = null;
  /** Alice's moves on the head pair since it became the head (for display). */
  moves: Move[] = [];
  /** An action pressed while the channel was recharging: it fires the moment the channel opens. */
  armed: 'share' | 'send' | 'slow' | null = null;
  spyLog: SpyEntry[] = [];
  readonly spawnTimes: number[];
  readonly stats: MissionStats = {
    correct: 0, wrong: 0, expired: 0, shares: 0, pairSends: 0, bitSends: 0, qubitsSent: 0, bitsDelivered: 0,
    preSharedUsed: 0, slowMessages: 0, spyLearnedBits: 0, spyReadings: 0, hits: 0, maxWaiting: 0,
  };
  /** Every channel use, for the end-of-mission timeline. */
  readonly usage: { t: number; kind: FlightKind }[] = [];

  private events: MissionEvent[] = [];
  private nextSpawn = 0;
  private ids = 1;
  private headId = -1;
  private msgRng: Rng;
  private noiseRng: Rng;
  private measureRng: Rng;

  constructor(config: MissionConfig) {
    this.cfg = {
      allowSlow: true,
      allowShare: true,
      classical: false,
      endless: false,
      ...config,
      zones: config.zones ?? [],
    };
    this.hearts = config.hearts;
    this.spawnTimes = scheduleFromWaves(this.cfg.endless ? endlessWaves() : config.waves);
    // Separate streams: message content never depends on what the player does.
    this.msgRng = seeded(`${config.seed}:messages`);
    this.noiseRng = seeded(`${config.seed}:noise`);
    this.measureRng = seeded(`${config.seed}:measure`);
    const start = this.cfg.classical ? 0 : Math.min(config.startRack, config.rackCap);
    for (let i = 0; i < start; i++) this.rack.push(this.newPair(-1));
  }

  get total(): number {
    return this.cfg.endless ? Infinity : this.spawnTimes.length;
  }

  get head(): Pair | undefined {
    return this.rack[0];
  }

  get waiting(): Message[] {
    return this.queue.filter((m) => m.status === 'waiting');
  }

  get target(): Message | undefined {
    return this.waiting[0];
  }

  /** A message whose second bit still has to go out (bit-by-bit reserves the channel). */
  get reserved(): Message | undefined {
    return this.queue.find((m) => m.slow && m.slow.sent < 2);
  }

  get channelReady(): boolean {
    return this.status === 'running' && !this.flight && this.cooldown <= 0;
  }

  /** 0 → just used, 1 → ready. */
  get recharge(): number {
    return this.flight ? 0 : 1 - Math.max(0, Math.min(1, this.cooldown / this.cfg.window));
  }

  /** Upcoming arrival times (for the forecast strip). Times only: content is unknown. */
  upcoming(horizon: number): number[] {
    return this.spawnTimes.slice(this.nextSpawn).filter((s) => s - this.t <= horizon);
  }

  zoneState(z: ZoneSpec, t = this.t): 'off' | 'warn' | 'on' {
    if (t >= z.at && t < z.at + z.duration) return 'on';
    if (t >= z.at - (z.warn ?? 2) && t < z.at) return 'warn';
    return 'off';
  }

  spyOpen(t = this.t): boolean {
    const s = this.cfg.spy;
    if (!s || t < s.offset) return false;
    return (t - s.offset) % s.period < s.open;
  }

  // ── Player actions ─────────────────────────────────────────────────────

  why(action: 'share' | 'send' | 'slow'): Refusal {
    if (this.status !== 'running') return 'over';
    if (action !== 'slow' && this.cfg.classical) return 'disabled';
    if (action === 'share' && !this.cfg.allowShare) return 'disabled';
    if (action === 'slow' && !this.cfg.allowSlow) return 'disabled';
    if (this.reserved) return 'reserved';
    if (this.flight) return 'busy';
    if (this.cooldown > 0) return 'cooldown';
    if (action === 'share') return this.rack.length >= this.cfg.rackCap ? 'rack-full' : null;
    if (!this.target) return 'no-message';
    if (action === 'send' && !this.head) return 'no-pair';
    return null;
  }

  /** Alice's FLIP (X) or PHASE (Z) on her half of the head pair. Real gates; toggling twice undoes. */
  toggle(move: Move): boolean {
    const h = this.head;
    if (!h || this.status !== 'running' || this.cfg.classical) return false;
    h.state = encode(h.state, [move]);
    this.moves.push(move);
    this.emit({ type: 'move', move });
    return true;
  }

  /** Net effect of the moves so far (a move made twice cancels). */
  get netMoves(): { X: boolean; Z: boolean } {
    const x = this.moves.filter((m) => m === 'X').length % 2 === 1;
    const z = this.moves.filter((m) => m === 'Z').length % 2 === 1;
    return { X: x, Z: z };
  }

  share(): boolean {
    if (this.why('share')) return false;
    const pair = this.newPair(this.t);
    this.launch({ id: this.ids++, kind: 'share', x: 0, pair, hits: [], zonesDone: [], spied: false });
    this.stats.shares++;
    return true;
  }

  send(): boolean {
    if (this.why('send')) return false;
    const msg = this.target!;
    const pair = this.rack.shift()!;
    msg.status = 'sending';
    msg.via = 'pair';
    msg.sentPattern = pair.uncertain ? null : patternBits(pair.state);
    msg.preShared = pair.sharedAt < msg.born;
    this.moves = [];
    this.launch({ id: this.ids++, kind: 'message', x: 0, pair, msg, hits: [...pair.hits], zonesDone: [], spied: false });
    this.stats.pairSends++;
    return true;
  }

  /** Send the oldest message as two lone qubits, one bit each. */
  sendSlow(): boolean {
    if (this.why('slow')) return false;
    const msg = this.target!;
    msg.status = 'sending';
    msg.via = 'bits';
    msg.slow = { bits: [bit(msg.bits[0]), bit(msg.bits[1])], sent: 0, got: [] };
    this.stats.slowMessages++;
    this.launchBit(msg);
    return true;
  }

  /**
   * Press an action. If the channel is only recharging, the press is remembered and fires
   * as soon as the channel opens (so players can shape the link during the recharge).
   * Returns 'done', 'armed' or the refusal reason.
   */
  press(action: 'share' | 'send' | 'slow'): 'done' | 'armed' | Exclude<Refusal, null> {
    const why = this.why(action);
    if (why === null) {
      const ok = action === 'share' ? this.share() : action === 'send' ? this.send() : this.sendSlow();
      if (ok) this.armed = null;
      return ok ? 'done' : 'busy';
    }
    if (why === 'cooldown' || why === 'busy' || why === 'reserved') {
      this.armed = this.armed === action ? null : action; // pressing again disarms
      return 'armed';
    }
    return why;
  }

  // ── Simulation ─────────────────────────────────────────────────────────

  tick(dt: number): void {
    if (this.status !== 'running') return;
    dt = Math.max(0, Math.min(dt, 0.25));
    const prevT = this.t;
    this.t += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);

    // arrivals
    while (this.nextSpawn < this.spawnTimes.length && this.spawnTimes[this.nextSpawn] <= this.t) {
      const born = this.spawnTimes[this.nextSpawn++];
      const msg: Message = {
        id: this.ids++,
        bits: BITS[Math.floor(this.msgRng() * 4)],
        born,
        fuse: this.cfg.fuse,
        left: this.cfg.fuse,
        status: 'waiting',
      };
      this.queue.push(msg);
      this.emit({ type: 'spawn', msg });
    }

    // fuses: a message must REACH Bob before its fuse burns out
    for (const m of this.queue) {
      if (!Number.isFinite(m.left)) continue;
      m.left -= dt;
      if (m.left <= 0) {
        m.left = 0;
        m.status = 'expired';
        m.diagnosis = { kind: 'expired' };
        if (m.slow) m.slow.sent = 2; // release the channel booking
        this.resolve(m, false);
        this.emit({ type: 'expire', msg: m });
      }
    }
    this.queue = this.queue.filter((m) => m.status === 'waiting' || m.status === 'sending');
    this.stats.maxWaiting = Math.max(this.stats.maxWaiting, this.waiting.length);

    // flight
    const f = this.flight;
    if (f) {
      const x0 = f.x;
      f.x = Math.min(1, f.x + dt / this.cfg.travel);
      this.applyChannel(f, x0, f.x, prevT);
      if (f.x >= 1) this.arrive(f);
    }

    // a bit-by-bit message sends its second bit as soon as the channel allows
    const r = this.reserved;
    if (r && !this.flight && this.cooldown <= 0 && this.status === 'running') this.launchBit(r);

    // a buffered press fires the moment the channel opens (or is dropped if it no longer makes sense)
    if (this.armed && this.channelReady && !this.reserved) {
      const a = this.armed;
      const why = this.why(a);
      if (why === null) this.press(a);
      else if (why !== 'cooldown' && why !== 'busy') this.armed = null;
    }

    if (this.head?.id !== this.headId) {
      this.headId = this.head?.id ?? -1;
      this.moves = [];
    }
    this.checkEnd();
  }

  drain(): MissionEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }

  // ── internals ──────────────────────────────────────────────────────────

  private emit(e: MissionEvent): void {
    this.events.push(e);
  }

  private newPair(at: number): Pair {
    return { id: this.ids++, state: createPair(), sharedAt: at, hits: [], uncertain: false };
  }

  private launch(f: Flight): void {
    this.flight = f;
    this.cooldown = this.cfg.window;
    this.stats.qubitsSent++;
    this.usage.push({ t: this.t, kind: f.kind });
    this.emit({ type: 'launch', flight: f });
  }

  private launchBit(msg: Message): void {
    const slow = msg.slow!;
    const value = slow.bits[slow.sent];
    let lone = basisState(1, 0);
    if (value === 1) lone = applyGate(lone, 'X', 0); // FLIP prepares ▼
    this.launch({ id: this.ids++, kind: 'bit', x: 0, msg, lone, bitIndex: slow.sent, hits: [], zonesDone: [], spied: false });
    slow.sent++;
    this.stats.bitSends++;
  }

  /** Which qubit of the flight is physically on the channel. */
  private apply(f: Flight, gate: 'X' | 'Z'): void {
    if (f.kind === 'bit') f.lone = applyGate(f.lone!, gate, 0);
    else f.pair!.state = applyGate(f.pair!.state, gate, f.kind === 'share' ? 1 : 0);
  }

  private applyChannel(f: Flight, xa: number, xb: number, prevT: number): void {
    this.cfg.zones.forEach((z, i) => {
      if (f.zonesDone.includes(i)) return;
      const active = this.zoneState(z, this.t) === 'on' || this.zoneState(z, prevT) === 'on';
      if (!active || xb < z.x0 || xa > z.x1) return;
      f.zonesDone.push(i);
      let kind: Hit['kind'] = z.kind === '?' ? 'none' : z.kind;
      if (z.kind === '?') {
        const r = this.noiseRng();
        kind = r < 0.25 ? 'X' : r < 0.5 ? 'Z' : 'none';
        if (f.pair) f.pair.uncertain = true;
      }
      if (kind === 'X' || kind === 'Z') this.apply(f, kind);
      const hit: Hit = { kind, source: z.kind === '?' ? 'storm' : 'zone' };
      f.hits.push(hit);
      f.pair?.hits.push(hit);
      if (kind !== 'none') this.stats.hits++;
      this.emit({ type: 'hit', flight: f, hit, visible: z.kind !== '?' });
    });

    const spy = this.cfg.spy;
    if (spy && !f.spied && xa < spy.x && xb >= spy.x && (this.spyOpen(this.t) || this.spyOpen(prevT))) {
      f.spied = true;
      const basis: Basis = this.noiseRng() < 0.5 ? 'Z' : 'X';
      let outcome: 0 | 1;
      if (f.kind === 'bit') {
        const m = measureQubit(f.lone!, 0, basis, this.noiseRng);
        f.lone = m.state;
        outcome = m.outcome;
      } else {
        const q = f.kind === 'share' ? 1 : 0;
        const m = measureQubit(f.pair!.state, q, basis, this.noiseRng);
        f.pair!.state = m.state;
        f.pair!.uncertain = true;
        outcome = m.outcome;
      }
      const learned = f.kind === 'bit' && basis === 'Z';
      const entry: SpyEntry = { t: this.t, kind: f.kind, basis, outcome, msgBits: f.msg?.bits, learned };
      this.spyLog.push(entry);
      this.stats.spyReadings++;
      if (learned) this.stats.spyLearnedBits++;
      const hit: Hit = { kind: 'spy', source: 'spy', basis };
      f.hits.push(hit);
      f.pair?.hits.push(hit);
      this.emit({ type: 'spy', flight: f, entry });
    }
  }

  private arrive(f: Flight): void {
    this.flight = null;
    if (f.kind === 'share') {
      this.rack.push(f.pair!);
      this.emit({ type: 'banked', pair: f.pair! });
      return;
    }
    const msg = f.msg!;
    if (msg.status === 'expired') return; // arrived too late: already counted
    if (f.kind === 'bit') {
      const slow = msg.slow!;
      const read = measureQubit(f.lone!, 0, 'Z', this.measureRng).outcome;
      slow.got.push(read);
      this.emit({ type: 'bit', msg, value: read, index: f.bitIndex! });
      if (f.hits.some((h) => h.kind !== 'none')) (msg.diagnosis ??= { kind: 'ok', hits: [] }).hits!.push(...f.hits);
      if (slow.got.length < 2) return;
      msg.decoded = `${slow.got[0]}${slow.got[1]}` as Bits;
    } else {
      msg.decoded = bellMeasure(f.pair!.state, this.measureRng).bits;
    }
    const correct = msg.decoded === msg.bits;
    msg.status = correct ? 'delivered' : 'garbled';
    msg.diagnosis = this.diagnose(msg, f);
    if (correct && msg.via === 'pair' && msg.preShared) this.stats.preSharedUsed++;
    this.resolve(msg, correct);
    this.emit({ type: 'decode', msg, correct });
  }

  private diagnose(msg: Message, f: Flight): Diagnosis {
    const hits = [...(msg.diagnosis?.hits ?? []), ...f.hits].filter((h) => h.kind !== 'none');
    if (msg.decoded === msg.bits) return { kind: 'ok', hits };
    if (msg.via === 'pair' && msg.sentPattern && msg.sentPattern !== msg.bits) {
      const fix: Move[] = [];
      if (msg.sentPattern[1] !== msg.bits[1]) fix.push('X');
      if (msg.sentPattern[0] !== msg.bits[0]) fix.push('Z');
      return { kind: 'encode', sent: msg.sentPattern, fix, hits };
    }
    if (hits.some((h) => h.kind === 'spy')) return { kind: 'spy', hits };
    if (hits.some((h) => h.source === 'storm')) return { kind: 'storm', hits };
    return { kind: 'zone', hits };
  }

  private resolve(msg: Message, correct: boolean): void {
    msg.resolvedAt = this.t;
    this.done.push(msg);
    if (correct) {
      msg.score = deliveryScore({ via: msg.via ?? 'pair', fuseLeft: msg.left, fuse: msg.fuse, streak: this.streak });
      this.score += msg.score;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.stats.correct++;
      this.stats.bitsDelivered += 2;
    } else {
      this.streak = 0;
      if (msg.status === 'expired') this.stats.expired++;
      else this.stats.wrong++;
      if (Number.isFinite(this.hearts)) this.hearts = Math.max(0, this.hearts - 1);
    }
  }

  private checkEnd(): void {
    if (this.status !== 'running') return;
    if (this.hearts <= 0) {
      this.status = 'lost';
      this.emit({ type: 'end', won: false });
      return;
    }
    const allSpawned = this.nextSpawn >= this.spawnTimes.length;
    if (allSpawned && this.queue.length === 0 && !this.flight) {
      this.status = 'won';
      this.score += finishBonus(this.hearts, this.cfg.hearts);
      this.emit({ type: 'end', won: true });
    }
  }
}

/** Stars for a finished mission: 3 = flawless, 2 = one slip, 1 = cleared. */
export function missionStars(m: Mission): number {
  if (m.status !== 'won') return 0;
  const slips = m.stats.wrong + m.stats.expired;
  return slips === 0 ? 3 : slips === 1 ? 2 : 1;
}
