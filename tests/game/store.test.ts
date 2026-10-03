import { describe, expect, it } from 'vitest';
import { Store, sanitize, defaultSave, type StorageLike } from '../../src/game/store';

class Mem implements StorageLike {
  m = new Map<string, string>();
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

describe('progression and persistence', () => {
  it('starts with only level 1 unlocked', () => {
    const s = new Store(new Mem());
    expect(s.isUnlocked(1)).toBe(true);
    expect(s.isUnlocked(2)).toBe(false);
    expect(s.nextLevel()).toBe(1);
  });

  it('clearing a level unlocks the next and survives a reload', () => {
    const mem = new Mem();
    const s = new Store(mem);
    s.complete(1, 3);
    s.complete(2, 2, 500);
    const again = new Store(mem);
    expect(again.isUnlocked(3)).toBe(true);
    expect(again.data.stars['2']).toBe(2);
    expect(again.data.best['2']).toBe(500);
    expect(again.nextLevel()).toBe(3);
  });

  it('never lowers stars or best score', () => {
    const s = new Store(new Mem());
    s.complete(7, 3, 900);
    s.complete(7, 1, 100);
    expect(s.data.stars['7']).toBe(3);
    expect(s.data.best['7']).toBe(900);
  });

  it('unlock-all opens every level; reset clears progress but keeps settings', () => {
    const s = new Store(new Mem());
    s.setSetting('unlockAll', true);
    expect(s.isUnlocked(10)).toBe(true);
    s.setSetting('view', 'circuit');
    s.complete(1, 3);
    s.reset();
    expect(s.data.stars).toEqual({});
    expect(s.data.settings.view).toBe('circuit');
    expect(s.data.settings.unlockAll).toBe(false);
  });

  it('survives corrupt, hostile or missing storage', () => {
    const mem = new Mem();
    mem.setItem('other-half.save.v1', '{not json');
    expect(new Store(mem).data).toEqual(defaultSave());
    expect(sanitize({ unlocked: 99, stars: { 1: 7, 2: 'x' }, settings: { view: 'hacker', sound: 'yes' } }).unlocked).toBe(10);
    expect(sanitize({ stars: { 1: 7 } }).stars['1']).toBe(3);
    expect(sanitize({ settings: { view: 'hacker' } }).settings.view).toBe('game');
    const s = new Store(null);
    expect(s.persistent).toBe(false);
    s.complete(1, 3); // in-memory only, no crash
    expect(s.isUnlocked(2)).toBe(true);
  });

  it('a throwing storage never crashes saving', () => {
    const bad: StorageLike = { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => undefined };
    const s = new Store(bad);
    expect(() => s.complete(1, 3)).not.toThrow();
  });

  it('records arcade bests and the daily score', () => {
    const s = new Store(new Mem());
    expect(s.arcadeResult(1200, false, '2026-10-03')).toBe(true);
    expect(s.arcadeResult(800, false, '2026-10-03')).toBe(false);
    expect(s.arcadeResult(300, true, null)).toBe(true);
    expect(s.data.arcade).toMatchObject({ quantum: 1200, classical: 300, daily: { date: '2026-10-03', score: 1200 } });
  });
});
