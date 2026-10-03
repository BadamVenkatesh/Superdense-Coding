/**
 * n-qubit pure state vectors.
 *
 * CONVENTION (used across the whole project):
 *   - qubit 0 is the MOST significant bit of the basis index, so for two qubits
 *     the vector is [α00, α01, α10, α11] with labels |q0 q1⟩.
 *   - In the superdense protocol q0 = Alice (the sender; her qubit travels),
 *     q1 = Bob (the receiver; he got his half earlier).
 */
import { abs2, add, c, conj, div, fmt, mul, ONE, ZERO, type Complex } from './complex';

export interface State {
  readonly n: number;
  readonly amps: readonly Complex[];
}

export function basisState(n: number, index = 0): State {
  const amps: Complex[] = Array.from({ length: 1 << n }, () => ZERO);
  amps[index] = ONE;
  return { n, amps };
}

/** Build a state from plain numbers or complex values. Length must be a power of two. */
export function fromAmps(values: readonly (number | Complex)[]): State {
  const n = Math.log2(values.length);
  if (!Number.isInteger(n) || n < 1) throw new Error(`state length ${values.length} is not a power of two`);
  return { n, amps: values.map((v) => (typeof v === 'number' ? c(v) : v)) };
}

export function norm2(s: State): number {
  return s.amps.reduce((t, a) => t + abs2(a), 0);
}

export function normalize(s: State): State {
  const k = Math.sqrt(norm2(s));
  if (k === 0) throw new Error('cannot normalize the zero vector');
  return { n: s.n, amps: s.amps.map((a) => c(a.re / k, a.im / k)) };
}

/** ⟨a|b⟩ */
export function inner(a: State, b: State): Complex {
  if (a.n !== b.n) throw new Error('qubit count mismatch');
  let t = ZERO;
  for (let i = 0; i < a.amps.length; i++) t = add(t, mul(conj(a.amps[i]), b.amps[i]));
  return t;
}

/** |⟨a|b⟩|²: 1 when the states are physically identical. */
export function fidelity(a: State, b: State): number {
  return abs2(inner(a, b));
}

/**
 * If b = e^{iθ}·a, returns the phase e^{iθ}; otherwise null.
 * A global phase has no observable consequence.
 */
export function globalPhase(a: State, b: State, eps = 1e-9): Complex | null {
  if (a.n !== b.n) return null;
  let k = -1;
  for (let i = 0; i < a.amps.length; i++) if (abs2(a.amps[i]) > eps) { k = i; break; }
  if (k < 0) return null;
  const phase = div(b.amps[k], a.amps[k]);
  if (Math.abs(abs2(phase) - 1) > 1e-6) return null;
  for (let i = 0; i < a.amps.length; i++) {
    const p = mul(phase, a.amps[i]);
    if (Math.abs(p.re - b.amps[i].re) > 1e-6 || Math.abs(p.im - b.amps[i].im) > 1e-6) return null;
  }
  return phase;
}

export const equalUpToGlobalPhase = (a: State, b: State): boolean => globalPhase(a, b) !== null;

/** The value (0/1) of qubit q inside basis index `index`. */
export function bitOf(index: number, q: number, n: number): 0 | 1 {
  return ((index >> (n - 1 - q)) & 1) as 0 | 1;
}

/** Basis label, e.g. index 1 of a 2-qubit register → "01". */
export function basisLabel(index: number, n: number): string {
  return index.toString(2).padStart(n, '0');
}

/** "0.707|00⟩ + 0.707|11⟩" */
export function toKet(s: State, digits = 3): string {
  const parts: string[] = [];
  s.amps.forEach((a, i) => {
    if (abs2(a) < 1e-12) return;
    const ket = `|${basisLabel(i, s.n)}⟩`;
    const coeff = fmt(a, digits);
    const pure = Math.abs(a.im) < 1e-12;
    const term = pure ? `${coeff}${ket}` : `(${coeff})${ket}`;
    parts.push(term);
  });
  if (!parts.length) return '0';
  return parts.reduce((acc, t) => (t.startsWith('−') ? `${acc} − ${t.slice(1)}` : `${acc} + ${t}`));
}
