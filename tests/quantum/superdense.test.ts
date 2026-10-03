import { describe, expect, it } from 'vitest';
import { BELL, BELL_INFO, BELL_NAMES, ALL_BITS, agreements, bellDecomposition, bellForBits, identifyBell, type Bits } from '../../src/quantum/bellStates';
import { applyGate } from '../../src/quantum/gates';
import { expectation, measureQubit, qubitProbabilities, reducedDensity, isMaximallyMixed } from '../../src/quantum/measurement';
import { seeded } from '../../src/quantum/rng';
import { fidelity, globalPhase, norm2 } from '../../src/quantum/state';
import {
  askLone, bellMeasure, createPair, decodeProbabilities, decodeSteps, encode, loneP1, loneQubit, movesFor, patternBits, runProtocol,
} from '../../src/quantum/superdenseCoding';

const R = Math.SQRT1_2;
const close = (a: number, b: number, eps = 1e-12) => expect(Math.abs(a - b)).toBeLessThan(eps);

describe('Bell pair initialisation', () => {
  const pair = createPair();
  it('|00⟩ and |11⟩ amplitudes are 1/√2, the others are zero', () => {
    close(pair.amps[0].re, R);
    close(pair.amps[3].re, R);
    for (const i of [1, 2]) close(pair.amps[i].re, 0);
    for (const a of pair.amps) close(a.im, 0);
  });
  it('is exactly Φ⁺', () => {
    expect(identifyBell(pair)?.info.name).toBe('phi+');
    close(fidelity(pair, BELL['phi+']), 1);
  });
  it('is normalised', () => close(norm2(pair), 1));
  it('agrees on both questions: ⟨ZZ⟩ = ⟨XX⟩ = +1', () => {
    const a = agreements(pair);
    close(a.zz, 1);
    close(a.xx, 1);
  });
});

describe('the four Bell states', () => {
  it('are orthonormal', () => {
    for (const a of BELL_NAMES)
      for (const b of BELL_NAMES) close(fidelity(BELL[a], BELL[b]), a === b ? 1 : 0);
  });
  it('carry the agreement signs the game shows (crossed ⇔ ZZ = −1, offbeat ⇔ XX = −1)', () => {
    for (const n of BELL_NAMES) {
      const info = BELL_INFO[n];
      close(expectation(BELL[n], 'ZZ'), info.zz);
      close(expectation(BELL[n], 'XX'), info.xx);
      expect(info.crossed).toBe(info.zz === -1);
      expect(info.offbeat).toBe(info.xx === -1);
    }
  });
  it('Bell decomposition of any state sums to 1', () => {
    const s = encode(createPair(), ['X']);
    const d = bellDecomposition(applyGate(s, 'H', 1));
    close(Object.values(d).reduce((t, x) => t + x, 0), 1);
  });
});

describe("Alice's local moves on q0", () => {
  const pair = createPair();

  it('I (no move) leaves Φ⁺', () => {
    expect(identifyBell(encode(pair, []))?.info.name).toBe('phi+');
  });

  it('X (FLIP) → Ψ⁺ = (|01⟩+|10⟩)/√2', () => {
    const s = encode(pair, ['X']);
    close(s.amps[1].re, R);
    close(s.amps[2].re, R);
    close(s.amps[0].re, 0);
    close(s.amps[3].re, 0);
    expect(identifyBell(s)?.info.name).toBe('psi+');
  });

  it('Z (PHASE) → Φ⁻ = (|00⟩−|11⟩)/√2', () => {
    const s = encode(pair, ['Z']);
    close(s.amps[0].re, R);
    close(s.amps[3].re, -R);
    expect(identifyBell(s)?.info.name).toBe('phi-');
  });

  it('X then Z → exactly Ψ⁻ = (|01⟩−|10⟩)/√2', () => {
    const s = encode(pair, ['X', 'Z']);
    close(s.amps[1].re, R);
    close(s.amps[2].re, -R);
    const id = identifyBell(s)!;
    expect(id.info.name).toBe('psi-');
    close(id.phase.re, 1);
  });

  it('Z then X → −Ψ⁻: same Bell state up to a global sign, same decode', () => {
    const s = encode(pair, ['Z', 'X']);
    const id = identifyBell(s)!;
    expect(id.info.name).toBe('psi-');
    close(id.phase.re, -1);
    close(decodeProbabilities(s)['11'], 1);
  });

  it('a move twice undoes itself', () => {
    expect(identifyBell(encode(pair, ['X', 'X']))?.info.name).toBe('phi+');
    expect(identifyBell(encode(pair, ['Z', 'Z']))?.info.name).toBe('phi+');
    expect(identifyBell(encode(pair, ['X', 'Z', 'X', 'Z']))?.info.name).toBe('phi+'); // up to −1
  });

  it('FLIP toggles only the ▲▼ agreement, PHASE only the ◀▶ agreement', () => {
    for (const bits of ALL_BITS) {
      const s = encode(pair, movesFor(bits));
      const { zz, xx } = agreements(s);
      close(zz, bits[1] === '1' ? -1 : 1);
      close(xx, bits[0] === '1' ? -1 : 1);
    }
  });

  it('a FLIP on either half does the same thing to the pair (X⊗I Φ⁺ = I⊗X Φ⁺)', () => {
    const viaAlice = applyGate(pair, 'X', 0);
    const viaBob = applyGate(pair, 'X', 1);
    expect(globalPhase(viaAlice, viaBob)).not.toBeNull();
    const zA = applyGate(pair, 'Z', 0);
    const zB = applyGate(pair, 'Z', 1);
    expect(globalPhase(zA, zB)).not.toBeNull();
  });

  it('moves preserve normalisation', () => {
    for (const bits of ALL_BITS) close(norm2(encode(pair, movesFor(bits))), 1);
  });
});

describe('Bell-basis decoding (CNOT, then H on q0, then measure)', () => {
  it.each(ALL_BITS.map((b) => [b]))('message %s decodes with certainty', (bits) => {
    const s = encode(createPair(), movesFor(bits as Bits));
    const p = decodeProbabilities(s);
    close(p[bits as Bits], 1);
    const rng = seeded(bits);
    for (let i = 0; i < 25; i++) expect(bellMeasure(s, rng).bits).toBe(bits);
  });

  it('maps Φ⁺, Ψ⁺, Φ⁻, Ψ⁻ to 00, 01, 10, 11', () => {
    const rng = seeded(1);
    expect(bellMeasure(BELL['phi+'], rng).bits).toBe('00');
    expect(bellMeasure(BELL['psi+'], rng).bits).toBe('01');
    expect(bellMeasure(BELL['phi-'], rng).bits).toBe('10');
    expect(bellMeasure(BELL['psi-'], rng).bits).toBe('11');
  });

  it('CNOT+H is the same as projecting onto the Bell basis', () => {
    for (const n of BELL_NAMES) {
      const s = applyGate(applyGate(BELL[n], 'H', 1), 'X', 0); // some non-Bell state
      const viaCircuit = decodeProbabilities(s);
      const viaProjection = bellDecomposition(s);
      for (const m of BELL_NAMES) close(viaCircuit[BELL_INFO[m].bits], viaProjection[m], 1e-12);
    }
  });

  it('after CNOT the two halves are no longer entangled: Bob holds the FLIP bit, Alice the PHASE bit', () => {
    for (const bits of ALL_BITS) {
      const { afterCNOT, afterH } = decodeSteps(encode(createPair(), movesFor(bits)));
      // q1 is now definite in ▲▼ = the flip bit
      close(qubitProbabilities(afterCNOT, 1, 'Z')[Number(bits[1])], 1);
      // q0 is definite in ◀▶ = the phase bit (▶ = 0, ◀ = 1)
      close(qubitProbabilities(afterCNOT, 0, 'X')[Number(bits[0])], 1);
      // and H turns that into a plain ▲▼ reading
      close(qubitProbabilities(afterH, 0, 'Z')[Number(bits[0])], 1);
    }
  });

  it('the full protocol delivers every message, every time', () => {
    const rng = seeded('protocol');
    for (let i = 0; i < 400; i++) {
      const bits = ALL_BITS[i % 4];
      expect(runProtocol(bits, rng).reading.bits).toBe(bits);
    }
  });

  it('patternBits reads the message straight off a clean pair', () => {
    for (const bits of ALL_BITS) expect(patternBits(encode(createPair(), movesFor(bits)))).toBe(bits);
    expect(bellForBits('10').pattern).toBe('OFFBEAT');
  });
});

describe('what the game claims about information', () => {
  it('the travelling qubit alone is pure noise for EVERY message (ρ_A = I/2)', () => {
    for (const bits of ALL_BITS) {
      const s = encode(createPair(), movesFor(bits));
      expect(isMaximallyMixed(reducedDensity(s, 0))).toBe(true);
      close(qubitProbabilities(s, 0, 'Z')[0], 0.5);
      close(qubitProbabilities(s, 0, 'X')[0], 0.5);
    }
  });

  it("no signalling: Alice's move leaves Bob's half exactly as it was", () => {
    const before = reducedDensity(createPair(), 1);
    for (const bits of ALL_BITS) {
      const after = reducedDensity(encode(createPair(), movesFor(bits)), 1);
      for (let i = 0; i < 2; i++)
        for (let j = 0; j < 2; j++) {
          close(after[i][j].re, before[i][j].re);
          close(after[i][j].im, before[i][j].im);
        }
    }
  });

  it('asking the halves one at a time reads ▲▼ agreement but destroys the ◀▶ agreement', () => {
    const rng = seeded('halves');
    for (const bits of ALL_BITS) {
      const s = encode(createPair(), movesFor(bits));
      const a = measureQubit(s, 0, 'Z', rng);
      const b = measureQubit(a.state, 1, 'Z', rng);
      // the ▲▼ comparison still reveals the flip bit…
      expect(String(a.outcome ^ b.outcome)).toBe(bits[1]);
      // …but the pair no longer agrees on ◀▶ at all
      close(expectation(b.state, 'XX'), 0);
    }
  });

  it('a spy who measures the travelling qubit learns nothing and garbles one bit half the time', () => {
    const rng = seeded('spy');
    let wrong = 0;
    const N = 4000;
    const seenUp: Record<string, number> = { '00': 0, '01': 0, '10': 0, '11': 0 };
    for (let i = 0; i < N; i++) {
      const bits = ALL_BITS[i % 4];
      const s = encode(createPair(), movesFor(bits));
      const spy = measureQubit(s, 0, 'Z', rng);
      if (spy.outcome === 0) seenUp[bits]++;
      const read = bellMeasure(spy.state, rng).bits;
      if (read !== bits) {
        wrong++;
        expect(read[1]).toBe(bits[1]); // a ▲▼ spy never damages the FLIP bit
      }
    }
    for (const b of ALL_BITS) expect(Math.abs(seenUp[b] / (N / 4) - 0.5)).toBeLessThan(0.05);
    expect(Math.abs(wrong / N - 0.5)).toBeLessThan(0.04);
  });

  it('channel noise is an accidental move: X garbles bit 2, Z garbles bit 1', () => {
    const rng = seeded('noise');
    for (const bits of ALL_BITS) {
      const s = encode(createPair(), movesFor(bits));
      const flipHit = bellMeasure(applyGate(s, 'X', 0), rng).bits;
      const phaseHit = bellMeasure(applyGate(s, 'Z', 0), rng).bits;
      expect(flipHit).toBe(`${bits[0]}${bits[1] === '1' ? '0' : '1'}`);
      expect(phaseHit).toBe(`${bits[0] === '1' ? '0' : '1'}${bits[1]}`);
    }
  });
});

describe('the Holevo ceiling: a lone qubit carries at most one bit', () => {
  it('on a ▲ start, PHASE is invisible and FLIP is readable', () => {
    const up = loneQubit('up');
    close(loneP1(applyGate(up, 'Z', 0), 'Z'), 0); // PHASE: nothing changes
    close(loneP1(applyGate(up, 'Z', 0), 'X'), 0.5); // and the ◀▶ question is a coin flip either way
    close(loneP1(applyGate(up, 'X', 0), 'Z'), 1); // FLIP: reads ▼
  });

  it('on a ▶ start, FLIP is invisible and PHASE is readable', () => {
    const right = loneQubit('right');
    close(loneP1(applyGate(right, 'X', 0), 'X'), 0);
    close(loneP1(applyGate(right, 'Z', 0), 'X'), 1);
  });

  it('whatever Bob asks, the four messages collapse onto at most two distinguishable outcomes', () => {
    const rng = seeded('lone');
    for (const start of ['up', 'right'] as const)
      for (const basis of ['Z', 'X'] as const) {
        const readings = new Set<string>();
        for (const bits of ALL_BITS) {
          const q = encode(loneQubit(start), movesFor(bits)); // same moves, but no partner
          const p1 = loneP1(q, basis);
          readings.add(p1.toFixed(6));
          askLone(q, basis, rng);
        }
        // only two distinct outcome distributions ever reach Bob: ≤ 1 bit
        expect(readings.size).toBeLessThanOrEqual(2);
      }
  });
});
