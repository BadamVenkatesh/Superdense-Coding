/**
 * The superdense coding protocol (Bennett & Wiesner, 1992), built from real gates.
 *
 *   1. SHARE   Alice makes |Φ⁺⟩ = H(q0) then CNOT(q0→q1) on |00⟩, and sends q1 to Bob
 *              BEFORE any message exists.
 *   2. ENCODE  Alice applies a local move to q0 only:
 *                00 → nothing   01 → X (FLIP)   10 → Z (PHASE)   11 → X then Z
 *   3. SEND    Alice sends q0. It is the only qubit that crosses for this message.
 *   4. DECODE  Bob applies CNOT(q0→q1), then H(q0), then measures both qubits.
 *              He reads b1 b2, where b1 = the ◀ ▶ (PHASE) agreement and b2 = the ▲▼ (FLIP) agreement.
 *
 * Gate sequences are written in TIME order. "X then Z" is the matrix Z·X = iY.
 * "Z then X" gives the same state times −1, a global phase no measurement can see.
 */
import { applyCNOT, applyGate } from './gates';
import { measureAll, qubitProbabilities, measureQubit, type Basis } from './measurement';
import { basisState, type State } from './state';
import { identifyBell, type Bits } from './bellStates';
import type { Rng } from './rng';

export type { Bits } from './bellStates';

/** Alice's two moves. FLIP = Pauli X, PHASE = Pauli Z. */
export type Move = 'X' | 'Z';

export const ALICE = 0;
export const BOB = 1;

export const MOVE_LABEL: Record<Move, { game: string; formal: string }> = {
  X: { game: 'FLIP', formal: 'X' },
  Z: { game: 'PHASE', formal: 'Z' },
};

/** Alice's pair source: H on q0, then CNOT(q0→q1). Returns |Φ⁺⟩. */
export function createPair(): State {
  return applyCNOT(applyGate(basisState(2, 0), 'H', ALICE), ALICE, BOB);
}

/** The textbook encoding, in time order. */
export function movesFor(bits: Bits): Move[] {
  const m: Move[] = [];
  if (bits[1] === '1') m.push('X');
  if (bits[0] === '1') m.push('Z');
  return m;
}

/** Apply Alice's moves to her qubit (q0) only, in time order. */
export function encode(pair: State, moves: readonly Move[]): State {
  return moves.reduce((s, m) => applyGate(s, m, ALICE), pair);
}

/** Bob's analyzer, step by step, so the UI and the Lab can show each stage. */
export function decodeSteps(s: State): { afterCNOT: State; afterH: State } {
  const afterCNOT = applyCNOT(s, ALICE, BOB);
  const afterH = applyGate(afterCNOT, 'H', ALICE);
  return { afterCNOT, afterH };
}

/** Probability of each two-bit reading from Bob's analyzer (exact, no sampling). */
export function decodeProbabilities(s: State): Record<Bits, number> {
  const { afterH } = decodeSteps(s);
  const p = afterH.amps.map((a) => a.re * a.re + a.im * a.im);
  return { '00': p[0], '01': p[1], '10': p[2], '11': p[3] };
}

export interface BellReading {
  bits: Bits;
  /** Probability this reading had. 1 for a clean Bell state. */
  p: number;
  /** Bob's register after measuring (a product state: the pair is used up). */
  state: State;
}

/** Bell-basis measurement as real hardware does it: CNOT, H, then measure both qubits. */
export function bellMeasure(s: State, rng: Rng): BellReading {
  const { afterH } = decodeSteps(s);
  const m = measureAll(afterH, rng);
  return { bits: m.bits as Bits, p: m.p, state: m.state };
}

/** The pattern a state carries, if it is exactly a Bell state; otherwise null. */
export function patternBits(s: State): Bits | null {
  return identifyBell(s)?.info.bits ?? null;
}

/** Full protocol in one call: share, encode, send, decode. */
export function runProtocol(bits: Bits, rng: Rng): { shared: State; encoded: State; reading: BellReading } {
  const shared = createPair();
  const encoded = encode(shared, movesFor(bits));
  return { shared, encoded, reading: bellMeasure(encoded, rng) };
}

// ── Lone qubits: the Holevo ceiling ─────────────────────────────────────────

/** A lone qubit prepared ▲ (|0⟩) or ▶ (|+⟩). */
export function loneQubit(start: 'up' | 'right'): State {
  const s = basisState(1, 0);
  return start === 'right' ? applyGate(s, 'H', 0) : s;
}

/**
 * Bob can ask a lone qubit ONE question. Returns what he reads and how likely it was.
 * On ▲, a PHASE move changes nothing he can ever measure (Z|0⟩ = |0⟩), so at most
 * one of Alice's two moves gets through: one qubit, one bit.
 */
export function askLone(s: State, basis: Basis, rng: Rng): { outcome: 0 | 1; p: number; state: State } {
  return measureQubit(s, 0, basis, rng);
}

/** Deterministic: the probability that asking `basis` reads 1. */
export function loneP1(s: State, basis: Basis): number {
  return qubitProbabilities(s, 0, basis)[1];
}
