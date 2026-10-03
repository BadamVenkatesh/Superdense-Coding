import { describe, expect, it } from 'vitest';
import { c } from '../../src/quantum/complex';
import { applyCNOT, applyGate, applyOps, GATES } from '../../src/quantum/gates';
import { basisState, fromAmps, globalPhase, norm2, toKet, fidelity } from '../../src/quantum/state';
import { expectation, measureAll, measureQubit, probabilities, qubitProbabilities, reducedDensity, isMaximallyMixed } from '../../src/quantum/measurement';
import { seeded } from '../../src/quantum/rng';

const R = Math.SQRT1_2;
const close = (a: number, b: number, eps = 1e-12) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('state vector basics', () => {
  it('uses q0 as the most significant bit: |q0 q1⟩ → index 2·q0 + q1', () => {
    const s = applyGate(basisState(2, 0), 'X', 0); // flip q0 only
    expect(probabilities(s)).toEqual([0, 0, 1, 0]); // |10⟩
    const t = applyGate(basisState(2, 0), 'X', 1); // flip q1 only
    expect(probabilities(t)).toEqual([0, 1, 0, 0]); // |01⟩
  });

  it('formats kets with the right signs', () => {
    expect(toKet(fromAmps([R, 0, 0, -R]))).toBe('0.707|00⟩ − 0.707|11⟩');
    expect(toKet(fromAmps([0, R, R, 0]))).toBe('0.707|01⟩ + 0.707|10⟩');
  });

  it('rejects malformed states', () => {
    expect(() => fromAmps([1, 0, 0])).toThrow();
  });
});

describe('gates', () => {
  it('Pauli X swaps |0⟩ and |1⟩', () => {
    expect(probabilities(applyGate(basisState(1, 0), 'X', 0))).toEqual([0, 1]);
    expect(probabilities(applyGate(basisState(1, 1), 'X', 0))).toEqual([1, 0]);
  });

  it('Pauli Z leaves |0⟩ alone and puts a minus sign on |1⟩', () => {
    const z0 = applyGate(basisState(1, 0), 'Z', 0);
    const z1 = applyGate(basisState(1, 1), 'Z', 0);
    expect(z0.amps[0]).toEqual(c(1));
    close(z1.amps[1].re, -1);
  });

  it('every gate here undoes itself (X·X = Z·Z = H·H = I)', () => {
    const s = fromAmps([0.6, c(0, 0.8)]);
    for (const g of ['X', 'Z', 'H', 'Y'] as const) {
      const back = applyGate(applyGate(s, g, 0), g, 0);
      close(fidelity(back, s), 1, 1e-12);
    }
  });

  it('X and Z anticommute: XZ = −ZX (only a global sign)', () => {
    const s = fromAmps([0.6, 0.8]);
    const xThenZ = applyGate(applyGate(s, 'X', 0), 'Z', 0);
    const zThenX = applyGate(applyGate(s, 'Z', 0), 'X', 0);
    const ph = globalPhase(xThenZ, zThenX);
    expect(ph).not.toBeNull();
    close(ph!.re, -1);
  });

  it('Y equals i·X·Z', () => {
    const Y = GATES.Y;
    // i·X·Z = [[0, −i], [i, 0]]
    expect(Y[0][1]).toEqual(c(0, -1));
    expect(Y[1][0]).toEqual(c(0, 1));
  });

  it('CNOT flips the target only when the control is 1', () => {
    expect(probabilities(applyCNOT(basisState(2, 0b10), 0, 1))).toEqual([0, 0, 0, 1]);
    expect(probabilities(applyCNOT(basisState(2, 0b00), 0, 1))).toEqual([1, 0, 0, 0]);
    expect(probabilities(applyCNOT(basisState(2, 0b01), 1, 0))).toEqual([0, 0, 0, 1]);
  });

  it('applyOps runs in time order', () => {
    const s = applyOps(basisState(2, 0), [{ gate: 'H', q: 0 }, { cnot: [0, 1] }]);
    close(s.amps[0].re, R);
    close(s.amps[3].re, R);
  });

  it('gates preserve normalisation', () => {
    let s = fromAmps([0.5, c(0, 0.5), -0.5, c(0.5, 0)]);
    for (const g of ['H', 'X', 'Y', 'Z'] as const) for (const q of [0, 1]) s = applyGate(s, g, q);
    s = applyCNOT(s, 1, 0);
    close(norm2(s), 1, 1e-12);
  });
});

describe('measurement', () => {
  it('Born rule: probabilities are |amplitude|²', () => {
    const s = fromAmps([0.6, 0.8]);
    const [p0, p1] = qubitProbabilities(s, 0, 'Z');
    close(p0, 0.36);
    close(p1, 0.64);
  });

  it('X-basis question on |+⟩ is certain, on |0⟩ is a coin flip', () => {
    const plus = applyGate(basisState(1, 0), 'H', 0);
    close(qubitProbabilities(plus, 0, 'X')[0], 1);
    close(qubitProbabilities(basisState(1, 0), 0, 'X')[0], 0.5);
  });

  it('collapse: asking again gives the same answer', () => {
    const rng = seeded(7);
    const plus = applyGate(basisState(1, 0), 'H', 0);
    for (let i = 0; i < 20; i++) {
      const first = measureQubit(plus, 0, 'Z', rng);
      const again = measureQubit(first.state, 0, 'Z', rng);
      expect(again.outcome).toBe(first.outcome);
      close(again.p, 1);
    }
  });

  it('sampled frequencies match the Born rule', () => {
    const rng = seeded(42);
    const s = fromAmps([Math.sqrt(0.2), Math.sqrt(0.8)]);
    let ones = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) ones += measureQubit(s, 0, 'Z', rng).outcome;
    expect(Math.abs(ones / N - 0.8)).toBeLessThan(0.015);
  });

  it('measureAll returns a valid basis state and never a zero-probability outcome', () => {
    const rng = seeded(3);
    const s = fromAmps([R, 0, 0, R]);
    for (let i = 0; i < 200; i++) {
      const m = measureAll(s, rng);
      expect(['00', '11']).toContain(m.bits);
      close(norm2(m.state), 1);
    }
  });

  it('Pauli expectation values', () => {
    const phi = fromAmps([R, 0, 0, R]);
    close(expectation(phi, 'ZZ'), 1);
    close(expectation(phi, 'XX'), 1);
    close(expectation(phi, 'ZI'), 0);
    close(expectation(phi, 'IX'), 0);
  });

  it('reduced state of either half of a Bell pair is I/2', () => {
    const phi = fromAmps([R, 0, 0, R]);
    expect(isMaximallyMixed(reducedDensity(phi, 0))).toBe(true);
    expect(isMaximallyMixed(reducedDensity(phi, 1))).toBe(true);
    expect(isMaximallyMixed(reducedDensity(basisState(2, 0), 0))).toBe(false);
  });
});
