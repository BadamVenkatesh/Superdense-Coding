/**
 * Persistence: progress, stars, best scores, settings.
 * localStorage can be missing, full or blocked (private mode, sandboxed iframes), so every
 * access is wrapped and the game falls back to in-memory state.
 */
import { LEVEL_COUNT } from './levels';

export type ViewMode = 'game' | 'circuit';

export interface Settings {
  /** Master sound switch. */
  sound: boolean;
  /** Generative music under the game. */
  music: boolean;
  /** 0…1 */
  volume: number;
  captions: boolean;
  /** null = follow the operating system's prefers-reduced-motion. */
  reducedMotion: boolean | null;
  /** GAME = intuitive names; CIRCUIT = formal gates, Bell states and a live circuit. */
  view: ViewMode;
  /** Judges' shortcut: every level playable. */
  unlockAll: boolean;
}

export interface SaveData {
  v: 1;
  unlocked: number;
  stars: Record<string, number>;
  best: Record<string, number>;
  arcade: { quantum: number; classical: number; daily: { date: string; score: number } };
  settings: Settings;
}

const KEY = 'other-half.save.v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    unlocked: 1,
    stars: {},
    best: {},
    arcade: { quantum: 0, classical: 0, daily: { date: '', score: 0 } },
    settings: { sound: true, music: true, volume: 0.8, captions: false, reducedMotion: null, view: 'game', unlockAll: false },
  };
}

export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function safeStorage(): StorageLike | null {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    const probe = '__other_half_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

const num = (v: unknown, d: number, lo = 0, hi = Infinity): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
const bool = (v: unknown, d: boolean): boolean => (typeof v === 'boolean' ? v : d);

/** Merge unknown or old data onto defaults, so a corrupt save can never crash the game. */
export function sanitize(raw: unknown): SaveData {
  const d = defaultSave();
  if (!raw || typeof raw !== 'object') return d;
  const r = raw as Partial<SaveData> & Record<string, unknown>;
  const rec = (v: unknown, hi: number): Record<string, number> => {
    const out: Record<string, number> = {};
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (typeof x === 'number' && Number.isFinite(x)) out[k] = Math.max(0, Math.min(hi, x));
    return out;
  };
  const s = (r.settings ?? {}) as Partial<Settings>;
  const a = (r.arcade ?? {}) as Partial<SaveData['arcade']>;
  return {
    v: 1,
    unlocked: Math.round(num(r.unlocked, 1, 1, LEVEL_COUNT)),
    stars: rec(r.stars, 3),
    best: rec(r.best, 1e9),
    arcade: {
      quantum: num(a.quantum, 0),
      classical: num(a.classical, 0),
      daily: {
        date: typeof a.daily?.date === 'string' ? a.daily.date : '',
        score: num(a.daily?.score, 0),
      },
    },
    settings: {
      sound: bool(s.sound, true),
      music: bool(s.music, true),
      volume: num(s.volume, 0.8, 0, 1),
      captions: bool(s.captions, false),
      reducedMotion: s.reducedMotion === null || typeof s.reducedMotion === 'boolean' ? s.reducedMotion ?? null : null,
      view: s.view === 'circuit' ? 'circuit' : 'game',
      unlockAll: bool(s.unlockAll, false),
    },
  };
}

export class Store {
  data: SaveData;
  private storage: StorageLike | null;

  constructor(storage: StorageLike | null = safeStorage()) {
    this.storage = storage;
    let raw: unknown = null;
    try {
      const txt = storage?.getItem(KEY);
      raw = txt ? JSON.parse(txt) : null;
    } catch {
      raw = null;
    }
    this.data = sanitize(raw);
  }

  get persistent(): boolean {
    return this.storage !== null;
  }

  save(): void {
    try {
      this.storage?.setItem(KEY, JSON.stringify(this.data));
    } catch {
      /* full or blocked: keep playing in memory */
    }
  }

  isUnlocked(id: number): boolean {
    return this.data.settings.unlockAll || id <= this.data.unlocked;
  }

  /** Record a cleared level. Never lowers stars or best score. */
  complete(id: number, stars: number, score = 0): void {
    const k = String(id);
    this.data.stars[k] = Math.max(this.data.stars[k] ?? 0, Math.max(1, Math.min(3, stars)));
    if (score > (this.data.best[k] ?? 0)) this.data.best[k] = score;
    this.data.unlocked = Math.min(LEVEL_COUNT, Math.max(this.data.unlocked, id + 1));
    this.save();
  }

  cleared(id: number): boolean {
    return (this.data.stars[String(id)] ?? 0) > 0;
  }

  /** The next level the player hasn't cleared yet (for CONTINUE). */
  nextLevel(): number {
    for (let i = 1; i <= LEVEL_COUNT; i++) if (!this.cleared(i)) return Math.min(i, this.data.settings.unlockAll ? i : this.data.unlocked);
    return LEVEL_COUNT;
  }

  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
    this.data.settings[key] = value;
    this.save();
  }

  arcadeResult(score: number, classical: boolean, daily: string | null): boolean {
    let record = false;
    const key = classical ? 'classical' : 'quantum';
    if (score > this.data.arcade[key]) {
      this.data.arcade[key] = score;
      record = true;
    }
    if (daily && !classical) {
      const d = this.data.arcade.daily;
      if (d.date !== daily || score > d.score) this.data.arcade.daily = { date: daily, score: Math.max(score, d.date === daily ? d.score : 0) };
    }
    this.save();
    return record;
  }

  reset(): void {
    const settings = this.data.settings;
    this.data = defaultSave();
    this.data.settings = { ...settings, unlockAll: false };
    this.save();
  }
}
