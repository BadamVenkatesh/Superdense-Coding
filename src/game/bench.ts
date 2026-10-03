/**
 * The bench: one Bell pair on the table, for the hands-on levels 1–5.
 * Asking a half a question is a real projective measurement (it collapses the pair).
 * Progress for each level is computed from the bench's history by pure functions.
 */
import { measureQubit, qubitProbabilities, type Basis } from '../quantum/measurement';
import { seeded, type Rng } from '../quantum/rng';
import { bellMeasure, createPair, encode, loneQubit, movesFor, patternBits, type Bits, type Move } from '../quantum/superdenseCoding';
import { applyGate } from '../quantum/gates';
import type { State } from '../quantum/state';
import { ALL_BITS } from '../quantum/bellStates';

export type Who = 'A' | 'B';

export interface Ask {
  who: Who;
  basis: Basis;
  outcome: 0 | 1;
  /** True if this half had already been asked something before (on this pair). */
  repeat: boolean;
  /** Was the pair still entangled when this question was asked? */
  linkedBefore: boolean;
}

export interface PairRecord {
  no: number;
  /** Alice's net pattern when the first question was asked (null if no question yet). */
  patternAtFirstAsk: Bits | null;
  moves: Move[];
  asks: Ask[];
}

/** The result of comparing the FIRST answer of each half. */
export interface Comparison {
  basisA: Basis;
  basisB: Basis;
  same: boolean;
  pattern: Bits | null;
}

export function firstComparison(r: PairRecord): Comparison | null {
  const a = r.asks.find((x) => x.who === 'A');
  const b = r.asks.find((x) => x.who === 'B');
  if (!a || !b) return null;
  return { basisA: a.basis, basisB: b.basis, same: a.outcome === b.outcome, pattern: r.patternAtFirstAsk };
}

export class PairBench {
  state: State;
  rng: Rng;
  history: PairRecord[] = [];
  current: PairRecord;
  private no = 0;

  constructor(seed: string | number = 'bench') {
    this.rng = seeded(seed);
    this.state = createPair();
    this.current = this.freshRecord();
  }

  private freshRecord(): PairRecord {
    return { no: ++this.no, patternAtFirstAsk: null, moves: [], asks: [] };
  }

  /** Still entangled: nobody has asked either half anything yet. */
  get linked(): boolean {
    return this.current.asks.length === 0;
  }

  /** The pair's pattern (two-bit agreement), or null once a question has broken the link. */
  get pattern(): Bits | null {
    return this.linked ? patternBits(this.state) : null;
  }

  get used(): boolean {
    return this.current.asks.length > 0;
  }

  newPair(): void {
    if (this.current.asks.length || this.current.moves.length) this.history.push(this.current);
    this.state = createPair();
    this.current = this.freshRecord();
  }

  /** Alice's move on her half (q0). Real gate. */
  toggle(m: Move): void {
    this.state = encode(this.state, [m]);
    this.current.moves.push(m);
  }

  /** Ask one half one question. */
  ask(who: Who, basis: Basis): Ask {
    const q = who === 'A' ? 0 : 1;
    const linkedBefore = this.linked;
    if (linkedBefore) this.current.patternAtFirstAsk = patternBits(this.state);
    const repeat = this.current.asks.some((a) => a.who === who);
    const m = measureQubit(this.state, q, basis, this.rng);
    this.state = m.state;
    const ask: Ask = { who, basis, outcome: m.outcome, repeat, linkedBefore };
    this.current.asks.push(ask);
    return ask;
  }

  /** Ask both halves the same question (Alice's first). */
  askBoth(basis: Basis): [Ask, Ask] {
    return [this.ask('A', basis), this.ask('B', basis)];
  }

  /** Probability that a question to one half alone comes out 0, right now (for the honesty readouts). */
  p0(who: Who, basis: Basis): number {
    return qubitProbabilities(this.state, who === 'A' ? 0 : 1, basis)[0];
  }

  /** Bob's analyzer on the current pair (consumes it). */
  analyze(): Bits {
    const r = bellMeasure(this.state, this.rng);
    this.state = r.state;
    this.current.asks.push({ who: 'A', basis: 'Z', outcome: Number(r.bits[0]) as 0 | 1, repeat: false, linkedBefore: true });
    this.current.asks.push({ who: 'B', basis: 'Z', outcome: Number(r.bits[1]) as 0 | 1, repeat: false, linkedBefore: false });
    return r.bits;
  }

  /** All records including the current one. */
  get records(): PairRecord[] {
    return this.current.asks.length ? [...this.history, this.current] : this.history;
  }
}

// ── Level 1: PAIR ─────────────────────────────────────────────────────────

export const L1_TARGET = 3;

export function l1Progress(b: PairBench): { z: number; x: number; zSame: number; xSame: number; done: boolean } {
  let z = 0, x = 0, zSame = 0, xSame = 0;
  for (const r of b.records) {
    const c = firstComparison(r);
    if (!c || c.basisA !== c.basisB) continue;
    if (c.basisA === 'Z') { z++; if (c.same) zSame++; } else { x++; if (c.same) xSame++; }
  }
  return { z, x, zSame, xSame, done: z >= L1_TARGET && x >= L1_TARGET };
}

// ── Level 2: THE LINK ─────────────────────────────────────────────────────

export type CellKey = 'ZZ' | 'ZX' | 'XZ' | 'XX';
export const L2_TRIES = 2;

export interface Cell {
  key: CellKey;
  same: number;
  opposite: number;
  done: boolean;
}

export function l2Grid(b: PairBench): Record<CellKey, Cell> {
  const g = {} as Record<CellKey, Cell>;
  for (const k of ['ZZ', 'ZX', 'XZ', 'XX'] as CellKey[]) g[k] = { key: k, same: 0, opposite: 0, done: false };
  for (const r of b.records) {
    const c = firstComparison(r);
    if (!c) continue;
    const cell = g[`${c.basisA}${c.basisB}` as CellKey];
    if (c.same) cell.same++; else cell.opposite++;
  }
  for (const cell of Object.values(g)) {
    const n = cell.same + cell.opposite;
    const mixed = cell.key === 'ZX' || cell.key === 'XZ';
    // Mixed questions must show the player both outcomes: that IS the lesson.
    cell.done = n >= L2_TRIES && (!mixed || (cell.same > 0 && cell.opposite > 0));
  }
  return g;
}

export const l2Done = (b: PairBench): boolean => Object.values(l2Grid(b)).every((c) => c.done);

// ── Level 3: FOUR MOVES ───────────────────────────────────────────────────

export interface L3Progress {
  /** Each non-TWIN pattern shown OPPOSITE on a question it should flip. */
  cross: boolean;
  offbeat: boolean;
  anti: boolean;
  /** Bob asked his half alone after Alice moved: still a coin flip. */
  bobCheck: boolean;
  /** Bonus: a move made twice cancels. */
  undo: boolean;
  done: boolean;
}

export function l3Progress(b: PairBench): L3Progress {
  const p: L3Progress = { cross: false, offbeat: false, anti: false, bobCheck: false, undo: false, done: false };
  const all = [...b.history, b.current];
  for (const r of all) {
    const xs = r.moves.filter((m) => m === 'X').length;
    const zs = r.moves.filter((m) => m === 'Z').length;
    if ((xs >= 2 && xs % 2 === 0) || (zs >= 2 && zs % 2 === 0)) p.undo = true;
    const first = r.asks[0];
    if (first && first.who === 'B' && r.patternAtFirstAsk && r.patternAtFirstAsk !== '00') p.bobCheck = true;
    const c = firstComparison(r);
    if (!c || c.basisA !== c.basisB || c.same) continue;
    if (r.patternAtFirstAsk === '01' && c.basisA === 'Z') p.cross = true;
    if (r.patternAtFirstAsk === '10' && c.basisA === 'X') p.offbeat = true;
    if (r.patternAtFirstAsk === '11') p.anti = true;
  }
  p.done = p.cross && p.offbeat && p.anti && p.bobCheck;
  return p;
}

// ── Level 4: THE DECODER (you are Bob) ────────────────────────────────────

export interface DecoderRound {
  secret: Bits;
  bench: PairBench;
  usedAnalyzer: boolean;
  analyzerReading: Bits | null;
  guess: Bits | null;
  correct: boolean | null;
}

export class DecoderGame {
  rounds: DecoderRound[] = [];
  analyzerUnlocked = false;
  private rng: Rng;
  private seed: string;

  constructor(seed = 'L4-decoder') {
    this.seed = seed;
    this.rng = seeded(seed);
    this.nextRound();
  }

  get round(): DecoderRound {
    return this.rounds[this.rounds.length - 1];
  }

  /** Alice (the computer) encodes a secret message on a fresh pair; her half has arrived. */
  nextRound(): DecoderRound {
    const secret = ALL_BITS[Math.floor(this.rng() * 4)];
    const bench = new PairBench(`${this.seed}:${this.rounds.length}`);
    for (const m of movesFor(secret)) bench.toggle(m);
    const r: DecoderRound = { secret, bench, usedAnalyzer: false, analyzerReading: null, guess: null, correct: null };
    this.rounds.push(r);
    return r;
  }

  analyze(): Bits | null {
    const r = this.round;
    if (!this.analyzerUnlocked || r.bench.used || r.guess) return null;
    r.usedAnalyzer = true;
    r.analyzerReading = r.bench.analyze();
    return r.analyzerReading;
  }

  submit(guess: Bits): boolean {
    const r = this.round;
    if (r.guess) return r.correct!;
    r.guess = guess;
    r.correct = guess === r.secret;
    const wrong = this.rounds.filter((x) => x.correct === false).length;
    const tried = this.rounds.filter((x) => x.guess).length;
    if (wrong >= 1 || tried >= 2) this.analyzerUnlocked = true;
    return r.correct;
  }

  get analyzerWins(): number {
    return this.rounds.filter((r) => r.usedAnalyzer && r.correct).length;
  }

  get done(): boolean {
    return this.analyzerWins >= 3;
  }
}

// ── Level 5: ONE QUBIT ───────────────────────────────────────────────────

export interface LoneAttempt {
  message: Bits;
  moves: Move[];
  /** What Bob read with his ▲▼ question: the FLIP bit survives, the PHASE bit cannot. */
  readFlip: 0 | 1;
  /** Probability of that reading (1: the lone qubit was in a definite ▲▼ state). */
  p: number;
  phaseVisible: false;
}

export interface PairDelivery {
  message: Bits;
  sentPattern: Bits | null;
  decoded: Bits;
  correct: boolean;
  /** Probability a spy measuring the travelling half alone would read ▲. Always 0.5. */
  spyUp: number;
  sharedBeforeMessage: boolean;
}

export class OneQubitGame {
  readonly ceilingMessage: Bits = '11';
  phase: 'lone' | 'pairs' | 'done' = 'lone';
  lone: State = loneQubit('up');
  loneMoves: Move[] = [];
  loneAttempts: LoneAttempt[] = [];
  /** Messages for part B: first the same 11 that failed, then the other three. */
  readonly queue: Bits[];
  deliveries: PairDelivery[] = [];
  /** A pair whose half Bob holds (shared, not yet used). */
  banked: State | null = null;
  bankedAt = -1;
  messageShown = false;
  messageAt = -1;
  moves: Move[] = [];
  private rng: Rng;
  private clock = 0;

  constructor(seed = 'L5-one-qubit') {
    this.rng = seeded(seed);
    const rest: Bits[] = ['00', '01', '10'];
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    this.queue = ['11', ...rest];
  }

  // Part A: the ceiling
  toggleLone(m: Move): void {
    this.lone = applyGate(this.lone, m, 0);
    this.loneMoves.push(m);
  }

  sendLone(): LoneAttempt {
    const m = measureQubit(this.lone, 0, 'Z', this.rng);
    const a: LoneAttempt = { message: this.ceilingMessage, moves: [...this.loneMoves], readFlip: m.outcome, p: m.p, phaseVisible: false };
    this.loneAttempts.push(a);
    this.lone = loneQubit('up');
    this.loneMoves = [];
    return a;
  }

  startPairs(): void {
    this.phase = 'pairs';
  }

  // Part B: the other half
  get message(): Bits | null {
    return this.phase === 'pairs' && this.messageShown ? this.queue[this.deliveries.length] ?? null : null;
  }

  share(): boolean {
    if (this.banked) return false;
    this.banked = createPair();
    this.bankedAt = ++this.clock;
    this.moves = [];
    return true;
  }

  /** The message only appears after the half is on its way. */
  revealMessage(): void {
    this.messageShown = true;
    this.messageAt = ++this.clock;
  }

  toggle(m: Move): boolean {
    if (!this.banked) return false;
    this.banked = encode(this.banked, [m]);
    this.moves.push(m);
    return true;
  }

  get pattern(): Bits | null {
    return this.banked ? patternBits(this.banked) : null;
  }

  send(): PairDelivery | null {
    const msg = this.message;
    if (!this.banked || !msg) return null;
    const spyUp = qubitProbabilities(this.banked, 0, 'Z')[0];
    const sentPattern = patternBits(this.banked);
    const decoded = bellMeasure(this.banked, this.rng).bits;
    const d: PairDelivery = { message: msg, sentPattern, decoded, correct: decoded === msg, spyUp, sharedBeforeMessage: this.bankedAt < this.messageAt };
    this.banked = null;
    this.moves = [];
    if (d.correct) {
      this.deliveries.push(d);
      this.messageShown = false;
      if (this.deliveries.length >= this.queue.length) this.phase = 'done';
    }
    return d;
  }

  get done(): boolean {
    return this.phase === 'done';
  }
}
