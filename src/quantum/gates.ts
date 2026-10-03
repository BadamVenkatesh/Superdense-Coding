/** Quantum gates acting on a State. Qubit 0 is the most significant bit (see state.ts). */
import { add, c, mul, ZERO, type Complex } from './complex';
import type { State } from './state';

export type Mat2 = readonly [readonly [Complex, Complex], readonly [Complex, Complex]];
export type GateName = 'I' | 'X' | 'Y' | 'Z' | 'H';

const R = Math.SQRT1_2;

/** The Pauli matrices and the Hadamard. */
export const GATES: Record<GateName, Mat2> = {
  I: [[c(1), ZERO], [ZERO, c(1)]],
  X: [[ZERO, c(1)], [c(1), ZERO]],
  Y: [[ZERO, c(0, -1)], [c(0, 1), ZERO]],
  Z: [[c(1), ZERO], [ZERO, c(-1)]],
  H: [[c(R), c(R)], [c(R), c(-R)]],
};

/** Apply a single-qubit gate to qubit q. */
export function applyGate(s: State, gate: GateName | Mat2, q: number): State {
  if (q < 0 || q >= s.n) throw new Error(`qubit ${q} out of range`);
  const g = typeof gate === 'string' ? GATES[gate] : gate;
  const mask = 1 << (s.n - 1 - q);
  const out = s.amps.slice();
  for (let i = 0; i < s.amps.length; i++) {
    if (i & mask) continue;
    const j = i | mask;
    const a0 = s.amps[i];
    const a1 = s.amps[j];
    out[i] = add(mul(g[0][0], a0), mul(g[0][1], a1));
    out[j] = add(mul(g[1][0], a0), mul(g[1][1], a1));
  }
  return { n: s.n, amps: out };
}

/** Controlled-NOT: flips `target` wherever `control` is 1. */
export function applyCNOT(s: State, control: number, target: number): State {
  if (control === target) throw new Error('control and target must differ');
  const cm = 1 << (s.n - 1 - control);
  const tm = 1 << (s.n - 1 - target);
  const out = s.amps.slice();
  for (let i = 0; i < s.amps.length; i++) {
    if (i & cm && !(i & tm)) {
      const j = i | tm;
      out[i] = s.amps[j];
      out[j] = s.amps[i];
    }
  }
  return { n: s.n, amps: out };
}

export type Op = { gate: GateName; q: number } | { cnot: readonly [number, number] };

/** Apply operations in time order (left to right, like a circuit diagram). */
export function applyOps(s: State, ops: readonly Op[]): State {
  return ops.reduce((st, op) => ('cnot' in op ? applyCNOT(st, op.cnot[0], op.cnot[1]) : applyGate(st, op.gate, op.q)), s);
}
