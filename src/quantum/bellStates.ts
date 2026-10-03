/**
 * The four Bell states, and how the game names them.
 *
 * Every Bell state is a joint eigenstate of the two commuting "agreement" observables
 * Z⊗Z (do the halves agree on ▲▼?) and X⊗X (do they agree on ◀ ▶?). Those two ±1
 * values ARE the two bits. Neither half has a definite answer of its own.
 */
import { abs2 } from './complex';
import { expectation } from './measurement';
import { fromAmps, globalPhase, inner, type State } from './state';
import type { Complex } from './complex';

export type BellName = 'phi+' | 'psi+' | 'phi-' | 'psi-';
export type Bits = '00' | '01' | '10' | '11';
export type PatternName = 'TWIN' | 'CROSS' | 'OFFBEAT' | 'ANTI';

const R = Math.SQRT1_2;

export const BELL: Record<BellName, State> = {
  'phi+': fromAmps([R, 0, 0, R]), // (|00⟩ + |11⟩)/√2
  'psi+': fromAmps([0, R, R, 0]), // (|01⟩ + |10⟩)/√2
  'phi-': fromAmps([R, 0, 0, -R]), // (|00⟩ − |11⟩)/√2
  'psi-': fromAmps([0, R, -R, 0]), // (|01⟩ − |10⟩)/√2
};

export interface BellInfo {
  name: BellName;
  symbol: string;
  ket: string;
  /** What Bob's analyzer reads (first bit = PHASE / ◀ ▶ agreement, second = FLIP / ▲▼ agreement). */
  bits: Bits;
  pattern: PatternName;
  /** ⟨Z⊗Z⟩: +1 same on ▲▼, −1 opposite. */
  zz: 1 | -1;
  /** ⟨X⊗X⟩: +1 same on ◀ ▶, −1 opposite. */
  xx: 1 | -1;
  /** Game visual: the link's strands cross (▲▼ answers come out opposite). */
  crossed: boolean;
  /** Game visual: the link's pulses run offbeat (◀ ▶ answers come out opposite). */
  offbeat: boolean;
  /** One-line plain-English identity. */
  plain: string;
}

export const BELL_INFO: Record<BellName, BellInfo> = {
  'phi+': { name: 'phi+', symbol: 'Φ⁺', ket: '(|00⟩ + |11⟩)/√2', bits: '00', pattern: 'TWIN', zz: 1, xx: 1, crossed: false, offbeat: false, plain: 'Same on ▲▼, same on ◀ ▶' },
  'psi+': { name: 'psi+', symbol: 'Ψ⁺', ket: '(|01⟩ + |10⟩)/√2', bits: '01', pattern: 'CROSS', zz: -1, xx: 1, crossed: true, offbeat: false, plain: 'Opposite on ▲▼, same on ◀ ▶' },
  'phi-': { name: 'phi-', symbol: 'Φ⁻', ket: '(|00⟩ − |11⟩)/√2', bits: '10', pattern: 'OFFBEAT', zz: 1, xx: -1, crossed: false, offbeat: true, plain: 'Same on ▲▼, opposite on ◀ ▶' },
  'psi-': { name: 'psi-', symbol: 'Ψ⁻', ket: '(|01⟩ − |10⟩)/√2', bits: '11', pattern: 'ANTI', zz: -1, xx: -1, crossed: true, offbeat: true, plain: 'Opposite on ▲▼, opposite on ◀ ▶' },
};

export const BELL_NAMES: readonly BellName[] = ['phi+', 'psi+', 'phi-', 'psi-'];
export const ALL_BITS: readonly Bits[] = ['00', '01', '10', '11'];

export const bellForBits = (bits: Bits): BellInfo => BELL_INFO[BELL_NAMES.find((n) => BELL_INFO[n].bits === bits)!];
export const infoForPattern = (p: PatternName): BellInfo => BELL_INFO[BELL_NAMES.find((n) => BELL_INFO[n].pattern === p)!];

/** Probability of each Bell outcome: |⟨Bell|ψ⟩|². Sums to 1 for any 2-qubit state. */
export function bellDecomposition(s: State): Record<BellName, number> {
  const out = {} as Record<BellName, number>;
  for (const n of BELL_NAMES) out[n] = abs2(inner(BELL[n], s));
  return out;
}

/** If s is exactly a Bell state (up to an unobservable global phase), say which one. */
export function identifyBell(s: State): { info: BellInfo; phase: Complex } | null {
  if (s.n !== 2) return null;
  for (const n of BELL_NAMES) {
    const phase = globalPhase(BELL[n], s);
    if (phase) return { info: BELL_INFO[n], phase };
  }
  return null;
}

/** The pair's two agreements as expectation values in [−1, 1]. */
export function agreements(s: State): { zz: number; xx: number } {
  return { zz: expectation(s, 'ZZ'), xx: expectation(s, 'XX') };
}
