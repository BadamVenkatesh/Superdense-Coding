/**
 * Integration: message → operation → transmission → Bell measurement → decoded message,
 * through the same mission engine the game runs. No shortcuts: every step is the state vector.
 */
import { describe, expect, it } from 'vitest';
import { Mission, type MissionConfig } from '../../src/game/mission';
import { ALL_BITS } from '../../src/quantum/bellStates';
import { movesFor, patternBits, type Bits } from '../../src/quantum/superdenseCoding';
import { reducedDensity, isMaximallyMixed } from '../../src/quantum/measurement';

const cfg = (seed: string, extra: Partial<MissionConfig> = {}): MissionConfig => ({
  seed, waves: [{ rush: 1 }], fuse: Infinity, window: 1, travel: 0.5, rackCap: 2, startRack: 0, hearts: Infinity, ...extra,
});
const run = (m: Mission, s: number) => { for (let t = 0; t < s; t += 0.02) m.tick(0.02); };

describe('the full superdense pipeline in the game engine', () => {
  it.each(ALL_BITS.map((b) => [b]))('message %s: share → encode → send one qubit → Bell measurement → same two bits', (bits) => {
    // find a seed whose single message is `bits`, so each mapping is exercised end to end
    let m: Mission | null = null;
    for (let i = 0; i < 200 && !m; i++) {
      const probe = new Mission(cfg(`pipe-${i}`));
      probe.tick(0.01);
      if (probe.target?.bits === bits) m = new Mission(cfg(`pipe-${i}`, { waves: [{ calm: 2 }, { rush: 1 }] }));
    }
    expect(m).not.toBeNull();
    const mission = m!;

    // 1. SHARE before the message exists: one qubit crosses, carrying nothing
    expect(mission.target).toBeUndefined();
    expect(mission.share()).toBe(true);
    run(mission, 1.2);
    expect(mission.rack).toHaveLength(1);
    expect(patternBits(mission.head!.state)).toBe('00');

    // 2. the message arrives later
    run(mission, 1.2);
    expect(mission.target?.bits).toBe(bits);

    // 3. local operation on Alice's half only
    for (const mv of movesFor(bits as Bits)) mission.toggle(mv);
    expect(patternBits(mission.head!.state)).toBe(bits);
    // the half about to travel is, on its own, pure noise
    expect(isMaximallyMixed(reducedDensity(mission.head!.state, 0))).toBe(true);

    // 4. transmit exactly one qubit
    const before = mission.stats.qubitsSent;
    expect(mission.send()).toBe(true);
    run(mission, 1);
    expect(mission.stats.qubitsSent - before).toBe(1);

    // 5. Bell measurement decodes the two bits
    const done = mission.done[0];
    expect(done.decoded).toBe(bits);
    expect(done.status).toBe('delivered');
    expect(done.preShared).toBe(true);
    expect(mission.stats.bitsDelivered).toBe(2);
    expect(mission.stats.preSharedUsed).toBe(1);
    expect(mission.status).toBe('won');
  });

  it('without a pair, the same message costs two channel uses (one bit each)', () => {
    const m = new Mission(cfg('slow-pipe'));
    run(m, 0.05);
    const bits = m.target!.bits;
    m.sendSlow();
    run(m, 3);
    expect(m.stats.qubitsSent).toBe(2);
    expect(m.done[0].decoded).toBe(bits);
  });
});
