/** #/level/:id[/classical] dispatches to the right level screen. */
import { levelById } from '../../game/levels';
import type { AppCtx, Screen } from '../app';
import { pairLevel, linkLevel, movesLevel } from './levelsIntro';
import { decoderLevel, oneQubitLevel } from './levelsCore';
import { missionScreen } from './mission';
import { h } from '../dom';

export function levelScreen(ctx: AppCtx, params: string[]): Screen {
  const id = Number(params[0]);
  const level = levelById(id);
  if (!level) {
    return { el: h('div', { class: 'screen', style: 'gap:12px' }, h('h2', {}, 'No such level.'), h('a', { href: '#/levels' }, 'Back to levels')) };
  }
  if (!ctx.store.isUnlocked(id)) {
    // Never strand the player: send them to the furthest unlocked level instead.
    setTimeout(() => ctx.go(`/level/${ctx.store.data.unlocked}`), 0);
    return { el: h('div', { class: 'screen' }, h('p', { class: 'muted' }, 'That level is locked. Taking you to the next one…')) };
  }
  switch (level.kind) {
    case 'pair': return pairLevel(ctx, level);
    case 'link': return linkLevel(ctx, level);
    case 'moves': return movesLevel(ctx, level);
    case 'decoder': return decoderLevel(ctx, level);
    case 'onequbit': return oneQubitLevel(ctx, level);
    default: return missionScreen(ctx, { level });
  }
}
