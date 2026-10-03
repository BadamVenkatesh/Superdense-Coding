/**
 * Measurement (Born rule + collapse), Pauli expectation values and reduced states.
 *
 * Game vocabulary for single-qubit questions:
 *   basis 'Z' = the ▲▼ question: outcome 0 = ▲ (|0⟩), 1 = ▼ (|1⟩)
 *   basis 'X' = the ◀ ▶ question: outcome 0 = ▶ (|+⟩), 1 = ◀ (|−⟩)
 */
import { abs2, add, c, conj, mul, scale, ZERO, type Complex } from './complex';
import { applyGate, type GateName } from './gates';
import { bitOf, basisLabel, type State } from './state';
import type { Rng } from './rng';

export type Basis = 'Z' | 'X';

export function probabilities(s: State): number[] {
  return s.amps.map(abs2);
}

/** Rotate so that the chosen basis becomes the computational basis (H maps X ↔ Z). */
const toZ = (s: State, q: number, basis: Basis): State => (basis === 'X' ? applyGate(s, 'H', q) : s);

/** [P(0), P(1)] for asking qubit q the given question. */
export function qubitProbabilities(s: State, q: number, basis: Basis): [number, number] {
  const r = toZ(s, q, basis);
  let p1 = 0;
  r.amps.forEach((a, i) => { if (bitOf(i, q, r.n)) p1 += abs2(a); });
  return [1 - p1, p1];
}

export interface QubitMeasurement {
  outcome: 0 | 1;
  /** Probability this outcome had before measuring. */
  p: number;
  /** Collapsed, renormalised state (still expressed in the computational basis). */
  state: State;
}

/** Projective measurement of one qubit in the Z (▲▼) or X (◀ ▶) basis, with collapse. */
export function measureQubit(s: State, q: number, basis: Basis, rng: Rng): QubitMeasurement {
  const r = toZ(s, q, basis);
  const [p0] = qubitProbabilities(s, q, basis);
  const outcome: 0 | 1 = rng() < p0 ? 0 : 1;
  const p = outcome === 0 ? p0 : 1 - p0;
  const k = 1 / Math.sqrt(p);
  const collapsed = r.amps.map((a, i) => (bitOf(i, q, r.n) === outcome ? scale(a, k) : ZERO));
  const post = toZ({ n: s.n, amps: collapsed }, q, basis); // rotate back (H is its own inverse)
  return { outcome, p, state: post };
}

export interface FullMeasurement {
  index: number;
  bits: string;
  p: number;
  state: State;
}

/** Measure every qubit in the computational basis. */
export function measureAll(s: State, rng: Rng): FullMeasurement {
  const probs = probabilities(s);
  let x = rng();
  let index = probs.length - 1;
  for (let i = 0; i < probs.length; i++) {
    if (x < probs[i]) { index = i; break; }
    x -= probs[i];
  }
  // Guard against picking a zero-probability index through floating-point slack.
  if (probs[index] < 1e-12) index = probs.findIndex((p) => p > 1e-12);
  const amps = s.amps.map((_, i) => (i === index ? c(1) : ZERO));
  return { index, bits: basisLabel(index, s.n), p: probs[index], state: { n: s.n, amps } };
}

/**
 * Expectation value of a Pauli string, e.g. 'ZZ', 'XX', 'ZI'. Character i acts on qubit i.
 * For the game: ⟨ZZ⟩ = +1 means "always agree on ▲▼", −1 "always opposite", 0 "no relation".
 */
export function expectation(s: State, paulis: string): number {
  if (paulis.length !== s.n) throw new Error('Pauli string length must equal qubit count');
  let t = s;
  for (let q = 0; q < s.n; q++) {
    const p = paulis[q] as GateName;
    if (p !== 'I') t = applyGate(t, p, q);
  }
  let e: Complex = ZERO;
  for (let i = 0; i < s.amps.length; i++) e = add(e, mul(conj(s.amps[i]), t.amps[i]));
  return e.re;
}

/** 2×2 reduced density matrix of qubit `keep` in a 2-qubit state (partial trace over the other). */
export function reducedDensity(s: State, keep: 0 | 1): Complex[][] {
  if (s.n !== 2) throw new Error('reducedDensity is implemented for two qubits');
  const a = s.amps;
  const amp = (k: number, o: number) => (keep === 0 ? a[k * 2 + o] : a[o * 2 + k]);
  const rho: Complex[][] = [[ZERO, ZERO], [ZERO, ZERO]];
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      let t: Complex = ZERO;
      for (let o = 0; o < 2; o++) t = add(t, mul(amp(i, o), conj(amp(j, o))));
      rho[i][j] = t;
    }
  return rho;
}

/** True when a qubit's reduced state is I/2: every question about it alone is a fair coin. */
export function isMaximallyMixed(rho: Complex[][], eps = 1e-9): boolean {
  return Math.abs(rho[0][0].re - 0.5) < eps && Math.abs(rho[1][1].re - 0.5) < eps && abs2(rho[0][1]) < eps;
}
