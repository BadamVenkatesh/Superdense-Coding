/**
 * A mission-playing bot. It is used to:
 *   - prove in tests that every mission can be cleared,
 *   - prove that NOT banking pairs (or playing classically) fails the rushes,
 *   - drive the title-screen attract demo.
 * It only sees what the player sees: the link pattern, the queue, zones and the spy's eye.
 */
import { patternBits, type Bits, type Move } from '../quantum/superdenseCoding';
import type { Mission, ZoneSpec } from './mission';

export interface BotStyle {
  /** Bank pairs whenever the channel is idle. */
  bank: boolean;
  /** Wait for zones and the spy to clear before launching. */
  avoid: boolean;
  /** Pre-cancel a known zone twist with an extra move instead of waiting. */
  compensate: boolean;
  /** Fuse seconds left at which an un-paired message is sent bit by bit. */
  slowAt: number;
  /** Reaction time: seconds the channel must have been ready before the bot acts. */
  delay?: number;
  /** Decide during the recharge (decision time after each launch) and press early. */
  buffered?: number;
}

export const SMART: BotStyle = { bank: true, avoid: true, compensate: true, slowAt: 4 };
/** A careful human: same strategy, but takes a moment to react and shape the link. */
export const HUMAN: BotStyle = { ...SMART, delay: 0.7 };
/** A slow beginner who never uses the press-early buffer. */
export const BEGINNER: BotStyle = { ...SMART, delay: 1.2 };
/** A practised human: takes a full second to decide, but presses early so the channel never idles. */
export const PRACTISED: BotStyle = { ...SMART, buffered: 1.0 };

const lastLaunch = new WeakMap<Mission, number>();

/** Buffered play: shape and press during the recharge, after a human decision delay. */
function bufferedStep(m: Mission, style: BotStyle): void {
  if (m.status !== 'running' || m.armed || m.reserved) return;
  if (m.flight && !lastLaunch.has(m)) lastLaunch.set(m, m.t);
  if (!m.flight && m.cooldown <= 0) lastLaunch.delete(m);
  const since = lastLaunch.has(m) ? m.t - lastLaunch.get(m)! : Infinity;
  if (since < style.buffered!) return;
  // Decide as if the channel were ready now, but only press: the engine fires it on time.
  const target = m.target;
  const wait = m.channelReady ? 0 : m.cooldown; // window ≥ travel, so the recharge dominates
  const path = forecastPathAt(m, m.t + wait);
  if (style.avoid && path.risky) return;
  if (target && m.head) {
    let wanted = target.bits;
    if (path.twist.X) wanted = `${wanted[0]}${flipBit(wanted[1])}` as Bits;
    if (path.twist.Z) wanted = `${flipBit(wanted[0])}${wanted[1]}` as Bits;
    const now = m.head.uncertain ? null : patternBits(m.head.state);
    if (now) for (const mv of movesToShape(now, wanted)) m.toggle(mv);
    m.press('send');
    lastLaunch.delete(m);
    return;
  }
  if (target && !m.head && (m.cfg.classical || target.left <= style.slowAt)) {
    m.press('slow');
    lastLaunch.delete(m);
    return;
  }
  if (style.bank && m.rack.length + (m.flight?.kind === 'share' ? 1 : 0) < m.cfg.rackCap && !m.cfg.classical) {
    m.press('share');
    lastLaunch.delete(m);
  }
}
export const REACTIVE: BotStyle = { bank: false, avoid: true, compensate: true, slowAt: 99 };

const readySince = new WeakMap<Mission, number>();

/** Deterministic zones a launch made now would cross, and whether anything unknowable would touch it. */
export function forecastPath(m: Mission): { twist: { X: boolean; Z: boolean }; risky: boolean } {
  return forecastPathAt(m, m.t);
}

export function forecastPathAt(m: Mission, t0: number): { twist: { X: boolean; Z: boolean }; risky: boolean } {
  const T = m.cfg.travel;
  const twist = { X: false, Z: false };
  let risky = false;
  m.cfg.zones.forEach((z: ZoneSpec) => {
    const enter = t0 + z.x0 * T;
    const exit = t0 + z.x1 * T;
    if (exit < z.at || enter >= z.at + z.duration) return;
    if (z.kind === '?') risky = true;
    else twist[z.kind] = !twist[z.kind];
  });
  const s = m.cfg.spy;
  if (s && (m.spyOpen(t0 + s.x * T) || m.spyOpen(t0 + s.x * T - 0.1) || m.spyOpen(t0 + s.x * T + 0.1))) risky = true;
  return { twist, risky };
}

const flipBit = (b: string) => (b === '1' ? '0' : '1');

/** Moves that turn the head pair's current pattern into the pattern that must ARRIVE. */
export function movesToShape(current: Bits, wanted: Bits): Move[] {
  const out: Move[] = [];
  if (current[1] !== wanted[1]) out.push('X');
  if (current[0] !== wanted[0]) out.push('Z');
  return out;
}

export function botStep(m: Mission, style: BotStyle = SMART): void {
  if (style.buffered !== undefined) return bufferedStep(m, style);
  if (m.status !== 'running' || !m.channelReady || m.reserved) {
    readySince.delete(m);
    return;
  }
  if (!readySince.has(m)) readySince.set(m, m.t);
  if (m.t - readySince.get(m)! < (style.delay ?? 0)) return;
  const path = forecastPath(m);
  const twisted = path.twist.X || path.twist.Z;
  const blocked = style.avoid && (path.risky || (twisted && !style.compensate));
  const target = m.target;

  if (target && m.head && !blocked) {
    let wanted = target.bits;
    // A known twist on the way will be applied to Alice's half: pre-cancel it.
    if (path.twist.X) wanted = `${wanted[0]}${flipBit(wanted[1])}` as Bits;
    if (path.twist.Z) wanted = `${flipBit(wanted[0])}${wanted[1]}` as Bits;
    const now = m.head.uncertain ? null : patternBits(m.head.state);
    if (now) for (const mv of movesToShape(now, wanted)) m.toggle(mv);
    m.send();
    readySince.delete(m);
    return;
  }
  const noPairs = m.cfg.classical || !m.cfg.allowShare;
  const urgent = noPairs || target === undefined || !Number.isFinite(target.left) ? !!target : target.left <= style.slowAt;
  if (target && !m.head && m.cfg.allowSlow && urgent && (noPairs || !style.bank || m.rack.length === 0) && !(style.avoid && (path.risky || path.twist.X))) {
    if (m.sendSlow()) {
      readySince.delete(m);
      return;
    }
  }
  const wantPair = style.bank ? m.rack.length < m.cfg.rackCap : !!target && !m.head;
  // Shares cross the channel too, and a known twist on Bob's half is visible, so it can be cancelled later.
  if (wantPair && !(style.avoid && path.risky) && m.why('share') === null && m.share()) readySince.delete(m);
}

/** Run a whole mission with the bot. */
export function autoplay(m: Mission, style: BotStyle = SMART, dt = 1 / 30, limit = 600): Mission {
  let guard = 0;
  while (m.status === 'running' && m.t < limit && guard++ < limit / dt + 10) {
    botStep(m, style);
    m.tick(dt);
    m.drain();
  }
  return m;
}
