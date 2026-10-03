import { describe, expect, it } from 'vitest';
import { Mission, missionStars, scheduleFromWaves, type MissionConfig } from '../../src/game/mission';
import { autoplay, HUMAN, PRACTISED, REACTIVE, SMART } from '../../src/game/bot';
import { LEVELS, arcadeConfig } from '../../src/game/levels';
import { patternBits } from '../../src/quantum/superdenseCoding';
import { deliveryScore } from '../../src/game/scoring';

const base: MissionConfig = {
  seed: 'unit',
  waves: [{ calm: 1 }, { rush: 4, gap: 3 }],
  fuse: Infinity,
  window: 1,
  travel: 0.5,
  rackCap: 3,
  startRack: 0,
  hearts: 3,
  allowSlow: true,
};

const run = (m: Mission, seconds: number, dt = 0.05) => {
  for (let t = 0; t < seconds; t += dt) m.tick(dt);
};

describe('schedule', () => {
  it('turns waves into arrival times', () => {
    expect(scheduleFromWaves([{ calm: 2 }, { rush: 3, gap: 1 }, { calm: 1 }, { rush: 1 }])).toEqual([2, 3, 4, 6]);
  });
});

describe('mission engine', () => {
  it('SHARE sends one qubit and banks a Φ⁺ pair at Bob', () => {
    const m = new Mission(base);
    expect(m.share()).toBe(true);
    expect(m.flight?.kind).toBe('share');
    expect(m.share()).toBe(false); // channel busy: one qubit at a time
    run(m, 0.6);
    expect(m.rack).toHaveLength(1);
    expect(patternBits(m.rack[0].state)).toBe('00');
    expect(m.stats.qubitsSent).toBe(1);
  });

  it('the channel needs a full window to recharge', () => {
    const m = new Mission(base);
    m.share();
    run(m, 0.6);
    expect(m.why('share')).toBe('cooldown');
    run(m, 0.5);
    expect(m.why('share')).toBeNull();
  });

  it('refuses to bank beyond the rack capacity', () => {
    const m = new Mission({ ...base, startRack: 3 });
    expect(m.why('share')).toBe('rack-full');
  });

  it('every message decodes correctly when the link is shaped to match it', () => {
    for (let seed = 0; seed < 8; seed++) {
      const m = new Mission({ ...base, seed: `shape-${seed}`, startRack: 3, waves: [{ rush: 3, gap: 1.2 }] });
      autoplay(m, SMART);
      expect(m.status).toBe('won');
      expect(m.stats.correct).toBe(3);
      expect(m.stats.pairSends).toBe(3);
      expect(m.stats.bitsDelivered).toBe(6);
    }
  });

  it('sending without shaping garbles the message and costs a heart', () => {
    const m = new Mission({ ...base, startRack: 3, waves: [{ rush: 1 }], seed: 'garble' });
    run(m, 0.1);
    const msg = m.target!;
    // make the head pattern deliberately wrong
    if (msg.bits === '00') m.toggle('X');
    m.send();
    run(m, 1);
    const done = m.done[0];
    expect(done.status).toBe('garbled');
    expect(done.diagnosis?.kind).toBe('encode');
    expect(done.diagnosis?.fix?.length).toBeGreaterThan(0);
    expect(m.hearts).toBe(2);
  });

  it('a move made twice cancels (toggle semantics are real gates)', () => {
    const m = new Mission({ ...base, startRack: 1 });
    m.toggle('X');
    expect(patternBits(m.head!.state)).toBe('01');
    m.toggle('X');
    expect(patternBits(m.head!.state)).toBe('00');
    expect(m.netMoves).toEqual({ X: false, Z: false });
  });

  it('BIT BY BIT uses two lone qubits and two windows, and still delivers', () => {
    const m = new Mission({ ...base, waves: [{ rush: 1 }], seed: 'slow' });
    run(m, 0.05);
    expect(m.sendSlow()).toBe(true);
    expect(m.why('share')).toBe('reserved'); // the second bit has the channel booked
    run(m, 3);
    expect(m.stats.bitSends).toBe(2);
    expect(m.stats.qubitsSent).toBe(2);
    expect(m.stats.correct).toBe(1);
    expect(m.done[0].via).toBe('bits');
  });

  it('a message expires when its fuse runs out', () => {
    const m = new Mission({ ...base, fuse: 2, waves: [{ rush: 1 }] });
    run(m, 2.5);
    expect(m.stats.expired).toBe(1);
    expect(m.hearts).toBe(2);
  });

  it('losing every heart ends the mission', () => {
    const m = new Mission({ ...base, fuse: 1, hearts: 2, waves: [{ rush: 3, gap: 0.2 }] });
    run(m, 3);
    expect(m.status).toBe('lost');
  });

  it('message content does not depend on what the player does', () => {
    const a = new Mission({ ...base, startRack: 3, seed: 'same' });
    const b = new Mission({ ...base, startRack: 3, seed: 'same' });
    autoplay(a, SMART);
    run(b, 20); // b does nothing at all
    const inOrder = (m: Mission) => [...m.done, ...m.queue].sort((x, y) => x.born - y.born).map((x) => x.bits);
    expect(inOrder(a)).toHaveLength(4);
    expect(inOrder(a)).toEqual(inOrder(b));
  });

  it('a FLIP zone flips exactly the ▲▼ bit of an unshaped message', () => {
    const m = new Mission({ ...base, startRack: 2, waves: [{ rush: 1 }], zones: [{ kind: 'X', at: 0, duration: 99, x0: 0.3, x1: 0.6 }] });
    run(m, 0.05);
    const msg = m.target!;
    for (const mv of (['X', 'Z'] as const).filter((_x, i) => (i === 0 ? msg.bits[1] : msg.bits[0]) === '1')) m.toggle(mv);
    m.send();
    run(m, 1);
    const d = m.done[0];
    expect(d.decoded![0]).toBe(msg.bits[0]);
    expect(d.decoded![1]).not.toBe(msg.bits[1]);
    expect(d.diagnosis?.kind).toBe('zone');
  });

  it('a PHASE zone does nothing to a lone ▲/▼ bit (phase is invisible to one qubit)', () => {
    const m = new Mission({ ...base, waves: [{ rush: 1 }], zones: [{ kind: 'Z', at: 0, duration: 99, x0: 0, x1: 1 }] });
    run(m, 0.05);
    m.sendSlow();
    run(m, 3);
    expect(m.stats.correct).toBe(1);
  });

  it('the spy learns nothing from paired qubits but reads lone bits', () => {
    const cfg: MissionConfig = { ...base, startRack: 3, rackCap: 5, waves: [{ rush: 40, gap: 1.2 }], fuse: Infinity, hearts: Infinity, spy: { x: 0.5, period: 1, open: 1, offset: 0 } };
    const m = new Mission({ ...cfg, seed: 'spy' });
    autoplay(m, { ...SMART, avoid: false }, 1 / 30, 400);
    expect(m.stats.spyReadings).toBeGreaterThan(30);
    const pairReads = m.spyLog.filter((e) => e.kind === 'message');
    expect(pairReads.every((e) => !e.learned)).toBe(true);
    // the spy's ▲▼/◀▶ readings are uncorrelated with the message
    const ups = pairReads.filter((e) => e.outcome === 0).length / pairReads.length;
    expect(ups).toBeGreaterThan(0.2);
    expect(ups).toBeLessThan(0.8);
    // and looking costs Bob some messages (about half of the spied ones)
    expect(m.stats.wrong).toBeGreaterThan(0);

    const slow = new Mission({ ...cfg, seed: 'spy-slow', classical: true });
    autoplay(slow, { ...SMART, avoid: false, slowAt: 99 }, 1 / 30, 400);
    expect(slow.stats.spyLearnedBits).toBeGreaterThan(0);
  });

  it('classical mode disables pairs entirely', () => {
    const m = new Mission({ ...base, classical: true, startRack: 3 });
    expect(m.rack).toHaveLength(0);
    expect(m.why('share')).toBe('disabled');
    expect(m.toggle('X')).toBe(false);
  });

  it('counts pairs that were shared before their message existed', () => {
    const m = new Mission({ ...base, waves: [{ calm: 3 }, { rush: 2, gap: 2 }] });
    autoplay(m, SMART);
    expect(m.status).toBe('won');
    expect(m.stats.preSharedUsed).toBe(2);
  });

  it('a press during the recharge is buffered and fires the moment the channel opens', () => {
    const m = new Mission({ ...base, startRack: 0 });
    m.share();
    expect(m.press('share')).toBe('armed');
    expect(m.armed).toBe('share');
    run(m, 1.1);
    expect(m.stats.shares).toBe(2);
    expect(m.armed).toBeNull();
    expect(m.press('share')).toBe('armed');
    expect(m.press('share')).toBe('armed'); // pressing again disarms
    expect(m.armed).toBeNull();
  });

  it('a late message is lost even if its qubit is still in flight', () => {
    const m = new Mission({ ...base, fuse: 1.2, window: 1, travel: 1, waves: [{ rush: 1 }] });
    run(m, 0.05);
    m.sendSlow(); // two lone bits need two windows: too slow for this fuse
    run(m, 3);
    expect(m.stats.expired).toBe(1);
    expect(m.stats.correct).toBe(0);
  });

  it('stars reflect slips', () => {
    const m = new Mission({ ...base, startRack: 3, waves: [{ rush: 2, gap: 2 }] });
    autoplay(m, SMART);
    expect(missionStars(m)).toBe(3);
  });
});

describe('scoring', () => {
  it('pays only for correct deliveries, more for pairs, more for speed and streaks', () => {
    expect(deliveryScore({ via: 'pair', fuseLeft: Infinity, fuse: Infinity, streak: 0 })).toBe(100);
    expect(deliveryScore({ via: 'bits', fuseLeft: Infinity, fuse: Infinity, streak: 0 })).toBe(40);
    expect(deliveryScore({ via: 'pair', fuseLeft: 10, fuse: 10, streak: 0 })).toBe(150);
    expect(deliveryScore({ via: 'pair', fuseLeft: 0, fuse: 10, streak: 10 })).toBe(200);
    expect(deliveryScore({ via: 'pair', fuseLeft: 0, fuse: 10, streak: 99 })).toBe(200);
  });
});

describe('level balance (bots play every mission)', () => {
  const missions = LEVELS.filter((l) => l.mission);

  it.each(missions.map((l) => [l.id, l.title]))('level %i %s: perfect and practised play both clear it with 3 stars', (id) => {
    const lvl = LEVELS.find((l) => l.id === id)!;
    for (const style of [SMART, PRACTISED]) {
      const m = autoplay(new Mission(lvl.mission!), style);
      expect(m.status).toBe('won');
      expect(missionStars(m)).toBe(3);
    }
  });

  it.each([6, 7, 8, 9])('level %i can be cleared by a player who reacts late and never presses early', (id) => {
    const lvl = LEVELS.find((l) => l.id === id)!;
    expect(autoplay(new Mission(lvl.mission!), HUMAN).status).toBe('won');
  });

  it('RUSH HOUR punishes not banking pairs in the calm', () => {
    const lvl = LEVELS.find((l) => l.title === 'RUSH HOUR')!;
    const smart = autoplay(new Mission(lvl.mission!), SMART);
    const reactive = autoplay(new Mission(lvl.mission!), REACTIVE);
    expect(smart.status).toBe('won');
    expect(reactive.stats.expired + reactive.stats.wrong).toBeGreaterThan(smart.stats.expired + smart.stats.wrong);
    expect(reactive.status).toBe('lost');
  });

  it.each(['RUSH HOUR', 'STATIC', 'LAST LIGHT'])('%s cannot be survived without entanglement (classical mode)', (title) => {
    const lvl = LEVELS.find((l) => l.title === title)!;
    const classical = autoplay(new Mission({ ...lvl.mission!, classical: true }), { ...SMART, slowAt: 99 });
    expect(classical.status).toBe('lost');
  });

  it('LAST LIGHT also punishes skipping the bank', () => {
    const lvl = LEVELS.find((l) => l.title === 'LAST LIGHT')!;
    expect(autoplay(new Mission(lvl.mission!), REACTIVE).status).toBe('lost');
  });

  it('the arcade runs, escalates and eventually ends', () => {
    const m = autoplay(new Mission(arcadeConfig('test-day', false)), SMART, 1 / 20, 900);
    expect(m.stats.correct).toBeGreaterThan(15);
    const c = autoplay(new Mission(arcadeConfig('test-day', true)), { ...SMART, slowAt: 99 }, 1 / 20, 900);
    expect(c.status).toBe('lost');
    expect(c.stats.correct).toBeLessThan(m.stats.correct);
  });
});
