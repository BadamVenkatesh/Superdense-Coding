/**
 * The ten levels. Each teaches ONE new rule through an action. Text only names what the
 * player has already seen. Levels 1–5 are hands-on "bench" levels; 6–10 are missions.
 */
import type { MissionConfig, ZoneSpec } from './mission';
import { endlessWaves } from './mission';
import { seeded } from '../quantum/rng';

export type LevelKind = 'pair' | 'link' | 'moves' | 'decoder' | 'onequbit' | 'mission';

export interface LevelDef {
  id: number;
  title: string;
  /** Shown on the map and the level intro. ≤ 6 words. */
  tagline: string;
  kind: LevelKind;
  /** The plain-English rule the player walks away with (collected in "What you know"). */
  insight: string;
  /** The formal name, revealed after the level is cleared. */
  formal: string;
  /** Which AHA moments this level is built to create (numbered in submission/EDUCATIONAL_VALUE.md). */
  aha: number[];
  mission?: MissionConfig;
  /** One-line objective for missions. */
  goal?: string;
  /** Mission features to introduce in the HUD. */
  features?: { slow?: boolean; zones?: boolean; spy?: boolean; forecast?: boolean };
}

const z = (kind: ZoneSpec['kind'], at: number, duration: number, x0: number, x1: number, warn = 2.5): ZoneSpec => ({ kind, at, duration, x0, x1, warn });

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    title: 'PAIR',
    tagline: 'Meet your other half',
    kind: 'pair',
    insight: 'Each half answers at random, yet the pair always agrees.',
    formal: 'Entanglement. Your pair is the Bell state Φ⁺ = (|00⟩ + |11⟩)/√2.',
    aha: [1],
  },
  {
    id: 2,
    title: 'THE LINK',
    tagline: 'Same question, same answer',
    kind: 'link',
    insight: 'Neither half has a predictable answer of its own. The pair holds two agreements: one for ▲▼, one for ◀ ▶.',
    formal: 'Φ⁺ is a joint eigenstate of Z⊗Z and X⊗X. Each half alone is maximally mixed (I/2).',
    aha: [2],
  },
  {
    id: 3,
    title: 'FOUR MOVES',
    tagline: 'Change only yours',
    kind: 'moves',
    insight: 'FLIP or PHASE on your half changes how the pair agrees. Bob cannot tell.',
    formal: 'Local Paulis I, X, Z, XZ turn Φ⁺ into the four Bell states Φ⁺, Ψ⁺, Φ⁻, Ψ⁻. No signalling.',
    aha: [3, 4, 5, 14],
  },
  {
    id: 4,
    title: 'THE DECODER',
    tagline: 'Read the pair, not the halves',
    kind: 'decoder',
    insight: 'Asking the halves one by one loses a bit. The analyzer reads both agreements at once.',
    formal: 'Bell-basis measurement: CNOT, then H, then measure both qubits.',
    aha: [6, 7],
  },
  {
    id: 5,
    title: 'ONE QUBIT',
    tagline: 'Two bits. One qubit. One friend.',
    kind: 'onequbit',
    insight: 'A lone qubit gives at most one bit. With a half shared earlier, one sent qubit delivers two.',
    formal: 'Superdense coding (Bennett & Wiesner, 1992). Holevo: a lone qubit yields ≤ 1 bit.',
    aha: [8, 9, 10],
  },
  {
    id: 6,
    title: 'DEAD DROP',
    tagline: 'Bob kept your halves',
    kind: 'mission',
    goal: 'Deliver 6 messages. Shape the link to match each one.',
    insight: 'Every banked pair turns one qubit into two bits.',
    formal: 'Each SEND is one use of the quantum channel carrying 2 classical bits (entanglement-assisted).',
    aha: [9, 12],
    features: {},
    mission: {
      seed: 'L6-dead-drop',
      waves: [{ calm: 1.2 }, { rush: 6, gap: 3.2 }],
      fuse: Infinity,
      window: 1.1,
      travel: 0.9,
      rackCap: 4,
      startRack: 4,
      hearts: Infinity,
      allowSlow: false,
    },
  },
  {
    id: 7,
    title: 'RUSH HOUR',
    tagline: "Share while it's quiet",
    kind: 'mission',
    goal: 'Survive two rushes. Bank pairs before the messages come.',
    insight: 'Pairs carry no message, so you can send them before you know what to say.',
    formal: 'Entanglement is a resource: distributed in advance, consumed one pair per 2-bit message.',
    aha: [11, 12],
    features: { slow: true, forecast: true },
    mission: {
      seed: 'L7-rush',
      waves: [{ calm: 14 }, { rush: 6, gap: 1.7 }, { calm: 13 }, { rush: 6, gap: 1.6 }],
      fuse: 7.5,
      window: 1.6,
      travel: 1.0,
      rackCap: 6,
      startRack: 0,
      hearts: 3,
      allowSlow: true,
    },
  },
  {
    id: 8,
    title: 'STATIC',
    tagline: "Noise is a move you didn't make",
    kind: 'mission',
    goal: 'Cross the zones. Wait, or cancel the twist in advance.',
    insight: 'A FLIP zone flips the ▲▼ bit; a PHASE zone flips the ◀ ▶ bit. A known twist can be undone.',
    formal: 'Channel errors are Pauli operators: a bit-flip (X) or phase-flip (Z). X·X = Z·Z = I.',
    aha: [13],
    features: { slow: true, zones: true, forecast: true },
    mission: {
      seed: 'L8-static',
      waves: [{ calm: 6 }, { rush: 4, gap: 2.5 }, { calm: 4 }, { rush: 4, gap: 2.3 }, { calm: 4 }, { rush: 5, gap: 2.2 }],
      fuse: 14,
      window: 1.5,
      travel: 1.1,
      rackCap: 4,
      startRack: 3,
      hearts: 3,
      allowSlow: true,
      zones: [z('X', 6, 8, 0.36, 0.6), z('Z', 19.5, 7, 0.4, 0.64), z('X', 31.5, 8, 0.28, 0.48), z('Z', 33, 7, 0.56, 0.76)],
    },
  },
  {
    id: 9,
    title: 'WIRETAP',
    tagline: 'Let them listen',
    kind: 'mission',
    goal: 'A spy reads the channel when its eye is open. Deliver anyway.',
    insight: 'A spy holding your qubit learns nothing. But looking breaks the pair.',
    formal: 'The sent qubit alone is I/2 for every message. Measuring it destroys the entanglement.',
    aha: [10],
    features: { slow: true, spy: true, forecast: true },
    mission: {
      seed: 'L9-wiretap',
      waves: [{ calm: 6 }, { rush: 4, gap: 2.3 }, { calm: 7 }, { rush: 5, gap: 2.0 }],
      fuse: 10,
      window: 1.5,
      travel: 1.0,
      rackCap: 4,
      startRack: 3,
      hearts: 3,
      allowSlow: true,
      spy: { x: 0.5, period: 8, open: 2.2, offset: 3 },
    },
  },
  {
    id: 10,
    title: 'LAST LIGHT',
    tagline: 'Everything, all at once',
    kind: 'mission',
    goal: 'The final night. Bank, shape, dodge, deliver.',
    insight: 'Shared entanglement + one qubit + a joint measurement = two bits.',
    formal: 'The complete superdense coding protocol, under load, with noise and an eavesdropper.',
    aha: [9, 11, 12, 13],
    features: { slow: true, zones: true, spy: true, forecast: true },
    mission: {
      seed: 'L10-last-light',
      waves: [{ calm: 10 }, { rush: 5, gap: 2.0 }, { calm: 11 }, { rush: 6, gap: 1.9 }, { calm: 12 }, { rush: 6, gap: 1.8 }],
      fuse: 12,
      window: 1.45,
      travel: 0.95,
      rackCap: 6,
      startRack: 0,
      hearts: 3,
      allowSlow: true,
      zones: [z('X', 13, 6, 0.3, 0.52), z('Z', 33, 6, 0.45, 0.68), z('?', 56, 6, 0.25, 0.42), z('X', 60, 5, 0.6, 0.8)],
      spy: { x: 0.62, period: 11, open: 2.4, offset: 22 },
    },
  },
];

export const LEVEL_COUNT = LEVELS.length;
export const levelById = (id: number): LevelDef | undefined => LEVELS.find((l) => l.id === id);

/** Arcade: endless, escalating, seeded. Zones and a spy appear as the night goes on. */
export function arcadeConfig(seed: string, classical: boolean): MissionConfig {
  const rng = seeded(`${seed}:arcade-zones`);
  const zones: ZoneSpec[] = [];
  let t = 25;
  while (t < 900) {
    const kind = (['X', 'Z', '?'] as const)[Math.floor(rng() * 3)];
    const w = 0.18 + rng() * 0.14;
    const x0 = 0.15 + rng() * (0.7 - w);
    zones.push(z(kind, t, 5 + rng() * 4, x0, x0 + w));
    t += 12 + rng() * 10 - Math.min(6, t / 120);
  }
  return {
    seed,
    waves: endlessWaves(),
    fuse: 9,
    window: 1.45,
    travel: 0.95,
    rackCap: 5,
    startRack: 2,
    hearts: 3,
    allowSlow: true,
    classical,
    endless: true,
    zones,
    spy: { x: 0.55, period: 11, open: 3.5, offset: 60 },
  };
}
