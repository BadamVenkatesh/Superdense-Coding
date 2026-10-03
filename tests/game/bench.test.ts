import { describe, expect, it } from 'vitest';
import { DecoderGame, OneQubitGame, PairBench, l1Progress, l2Done, l2Grid, l3Progress, L1_TARGET } from '../../src/game/bench';
import { patternBits } from '../../src/quantum/superdenseCoding';

describe('PairBench (one real pair on the table)', () => {
  it('starts as an unasked Φ⁺ pair', () => {
    const b = new PairBench('t');
    expect(b.linked).toBe(true);
    expect(b.pattern).toBe('00');
  });

  it('asking both halves the same question always agrees on Φ⁺', () => {
    const b = new PairBench('agree');
    for (let i = 0; i < 50; i++) {
      const [x, y] = b.askBoth(i % 2 ? 'X' : 'Z');
      expect(x.outcome).toBe(y.outcome);
      b.newPair();
    }
  });

  it('each half alone is a coin flip (sampled)', () => {
    const b = new PairBench('coin');
    let ups = 0;
    for (let i = 0; i < 2000; i++) {
      ups += b.ask('A', 'Z').outcome === 0 ? 1 : 0;
      b.newPair();
    }
    expect(Math.abs(ups / 2000 - 0.5)).toBeLessThan(0.04);
  });

  it('asking breaks the link (the pair is used up)', () => {
    const b = new PairBench('break');
    b.ask('B', 'Z');
    expect(b.linked).toBe(false);
    expect(b.pattern).toBeNull();
  });

  it('a toggle is a real gate on Alice’s half', () => {
    const b = new PairBench('toggle');
    b.toggle('X');
    expect(b.pattern).toBe('01');
    b.toggle('Z');
    expect(b.pattern).toBe('11');
    expect(patternBits(b.state)).toBe('11');
  });

  it('Bob’s half alone stays 50/50 after any move (no signalling)', () => {
    for (const moves of [[], ['X'], ['Z'], ['X', 'Z']] as const) {
      const b = new PairBench('nosig');
      for (const m of moves) b.toggle(m);
      expect(b.p0('B', 'Z')).toBeCloseTo(0.5, 12);
      expect(b.p0('B', 'X')).toBeCloseTo(0.5, 12);
    }
  });
});

describe('level 1 progress', () => {
  it('needs three ▲▼ and three ◀ ▶ comparisons', () => {
    const b = new PairBench('l1');
    for (let i = 0; i < L1_TARGET; i++) { b.askBoth('Z'); b.newPair(); }
    expect(l1Progress(b).done).toBe(false);
    for (let i = 0; i < L1_TARGET; i++) { b.askBoth('X'); b.newPair(); }
    const p = l1Progress(b);
    expect(p.done).toBe(true);
    expect(p.zSame + p.xSame).toBe(6); // Φ⁺ always agrees
  });
});

describe('level 2 progress', () => {
  it('same-question cells always agree; mixed cells show both outcomes before completing', () => {
    const b = new PairBench('l2');
    const combos = [['Z', 'Z'], ['X', 'X'], ['Z', 'X'], ['X', 'Z']] as const;
    for (let i = 0; i < 80 && !l2Done(b); i++) {
      const [qa, qb] = combos[i % 4];
      b.ask('A', qa);
      b.ask('B', qb);
      b.newPair();
    }
    const g = l2Grid(b);
    expect(l2Done(b)).toBe(true);
    expect(g.ZZ.opposite).toBe(0);
    expect(g.XX.opposite).toBe(0);
    expect(g.ZX.same).toBeGreaterThan(0);
    expect(g.ZX.opposite).toBeGreaterThan(0);
  });
});

describe('level 3 progress', () => {
  it('requires CROSS on ▲▼, OFFBEAT on ◀ ▶, ANTI, and a Bob-alone check', () => {
    const b = new PairBench('l3');
    b.toggle('X'); b.askBoth('Z'); b.newPair();
    b.toggle('Z'); b.askBoth('X'); b.newPair();
    expect(l3Progress(b).done).toBe(false);
    b.toggle('X'); b.toggle('Z'); b.askBoth('Z'); b.newPair();
    b.toggle('Z'); b.ask('B', 'Z'); b.newPair();
    const p = l3Progress(b);
    expect([p.cross, p.offbeat, p.anti, p.bobCheck]).toEqual([true, true, true, true]);
    expect(p.done).toBe(true);
  });

  it('a move made twice counts as the undo discovery', () => {
    const b = new PairBench('undo');
    b.toggle('X'); b.toggle('X');
    expect(l3Progress(b).undo).toBe(true);
  });
});

describe('level 4: the decoder', () => {
  it('reading halves cannot reliably recover both bits; the analyzer always can', () => {
    let halvesRight = 0;
    const N = 400;
    for (let i = 0; i < N; i++) {
      const g = new DecoderGame(`halves-${i}`);
      const r = g.round;
      const [a, b] = r.bench.askBoth('Z');
      const flip = a.outcome === b.outcome ? '0' : '1';
      const [c, d] = r.bench.askBoth('X'); // link already broken: a coin flip
      const phase = c.outcome === d.outcome ? '0' : '1';
      if (g.submit(`${phase}${flip}` as never)) halvesRight++;
    }
    expect(halvesRight / N).toBeGreaterThan(0.4);
    expect(halvesRight / N).toBeLessThan(0.6);

    const g = new DecoderGame('analyzer');
    g.submit('00');
    g.nextRound();
    g.submit('00');
    expect(g.analyzerUnlocked).toBe(true);
    for (let i = 0; i < 3; i++) {
      g.nextRound();
      const reading = g.analyze()!;
      expect(reading).toBe(g.round.secret);
      expect(g.submit(reading)).toBe(true);
    }
    expect(g.done).toBe(true);
  });

  it('the analyzer refuses a pair that was already asked', () => {
    const g = new DecoderGame('used');
    g.analyzerUnlocked = true;
    g.round.bench.askBoth('Z');
    expect(g.analyze()).toBeNull();
  });
});

describe('level 5: one qubit', () => {
  it('a lone qubit never carries the PHASE bit', () => {
    const g = new OneQubitGame('lone');
    g.toggleLone('X');
    g.toggleLone('Z');
    const a = g.sendLone();
    expect(a.readFlip).toBe(1); // FLIP got through
    expect(a.p).toBeCloseTo(1, 12); // deterministic: the lone qubit was definitely ▼
    expect(a.phaseVisible).toBe(false);
  });

  it('with a pre-shared pair, all four messages arrive, first 11 then the rest', () => {
    const g = new OneQubitGame('pairs');
    g.sendLone();
    g.startPairs();
    expect(g.queue[0]).toBe('11');
    expect(new Set(g.queue).size).toBe(4);
    while (!g.done) {
      g.share();
      g.revealMessage();
      const msg = g.message!;
      if (msg[1] === '1') g.toggle('X');
      if (msg[0] === '1') g.toggle('Z');
      const d = g.send()!;
      expect(d.correct).toBe(true);
      expect(d.decoded).toBe(msg);
      expect(d.spyUp).toBeCloseTo(0.5, 12);
      expect(d.sharedBeforeMessage).toBe(true);
    }
    expect(g.deliveries).toHaveLength(4);
  });

  it('a wrong pattern decodes wrongly, consumes the pair and is not counted', () => {
    const g = new OneQubitGame('wrong');
    g.startPairs();
    g.share();
    g.revealMessage();
    const d = g.send()!; // no moves: sends TWIN (00) for message 11
    expect(d.correct).toBe(false);
    expect(d.decoded).toBe('00');
    expect(g.banked).toBeNull();
    expect(g.deliveries).toHaveLength(0);
    g.share();
    expect(g.send()!.sharedBeforeMessage).toBe(false); // shared after the message was known
  });
});
