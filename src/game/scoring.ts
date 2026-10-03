/**
 * Scoring. Points only come from messages Bob decodes correctly, so the score can never
 * reward skipping the physics. Speed and streaks add bonuses on top of correct deliveries.
 */
export interface DeliveryInput {
  via: 'pair' | 'bits';
  /** Seconds left on the message's fuse when it was resolved (Infinity when untimed). */
  fuseLeft: number;
  fuse: number;
  /** Correct deliveries in a row before this one. */
  streak: number;
}

export const PAIR_POINTS = 100;
export const BITS_POINTS = 40;
export const SPEED_POINTS = 50;
export const STREAK_STEP = 0.1;
export const STREAK_CAP = 10;

export function deliveryScore({ via, fuseLeft, fuse, streak }: DeliveryInput): number {
  const base = via === 'pair' ? PAIR_POINTS : BITS_POINTS;
  const speed = Number.isFinite(fuse) && fuse > 0 ? Math.round(SPEED_POINTS * Math.max(0, Math.min(1, fuseLeft / fuse))) : 0;
  const mult = 1 + STREAK_STEP * Math.min(Math.max(0, streak), STREAK_CAP);
  return Math.round((base + speed) * mult);
}

/** Bonus for hearts left when a mission is cleared. */
export function finishBonus(hearts: number, maxHearts: number): number {
  if (!Number.isFinite(hearts) || !Number.isFinite(maxHearts)) return 0;
  return Math.max(0, hearts) * 150;
}
