import { LEVELS } from '../../game/levels';
import type { AppCtx, Screen } from '../app';
import { button, fmt, h, starsHtml } from '../dom';
import { topbar } from '../components';

export function mapScreen(ctx: AppCtx): Screen {
  const st = ctx.store;
  const tiles = LEVELS.map((l) => {
    const open = st.isUnlocked(l.id);
    const stars = st.data.stars[String(l.id)] ?? 0;
    const best = st.data.best[String(l.id)];
    return h('button', {
      class: `level-tile ${l.id === 5 ? 'sig' : ''}`,
      type: 'button',
      disabled: !open,
      'aria-label': `Level ${l.id}: ${l.title}. ${l.tagline}. ${open ? `${stars} of 3 stars` : 'Locked'}`,
      onclick: () => open && ctx.go(`/level/${l.id}`),
    },
      l.id === 5 ? h('span', { class: 'badge' }, 'signature') : null,
      h('span', { class: 'n' }, String(l.id).padStart(2, '0')),
      h('span', { class: 't' }, l.title),
      h('span', { class: 'tg' }, l.tagline),
      h('span', { class: 'st', html: open ? starsHtml(stars) + (best ? ` <span class="muted mono" style="letter-spacing:0;font-size:12px">${fmt(best)}</span>` : '') : '🔒' }));
  });
  const arcadeTile = h('button', { class: 'level-tile', type: 'button', onclick: () => ctx.go('/arcade') },
    h('span', { class: 'n' }, '∞'),
    h('span', { class: 't' }, 'ARCADE'),
    h('span', { class: 'tg' }, 'Endless night. Daily seed. Try it with the quantum switched off.'),
    h('span', { class: 'st mono', style: 'letter-spacing:0;font-size:13px;color:var(--muted)' }, `best ${fmt(st.data.arcade.quantum)} · classical ${fmt(st.data.arcade.classical)}`));

  const insights = h('section', { class: 'card insights', 'aria-label': 'What you know so far' },
    h('h3', {}, 'WHAT YOU KNOW'),
    h('ol', {}, ...LEVELS.map((l) => (st.cleared(l.id) ? h('li', {}, l.insight) : h('li', { class: 'locked' }, '…')))));

  const el = h('div', { class: 'screen' },
    topbar(ctx, 'LEVELS', 'THE OTHER HALF', [
      st.data.settings.unlockAll ? null : button('Unlock all', { cls: 'small ghost', onClick: () => { st.setSetting('unlockAll', true); ctx.refresh(); }, title: 'Unlock every level (for judges)' }),
    ], '/'),
    h('div', { class: 'map-grid' }, ...tiles, arcadeTile),
    insights);
  tiles.find((t) => !t.hasAttribute('disabled') && !t.querySelector('.st')?.textContent?.includes('★★★'))?.setAttribute('data-autofocus', '');

  return {
    el,
    onKey(e) {
      if (e.key === 'Escape') { ctx.go('/'); return true; }
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && st.isUnlocked(n)) { ctx.go(`/level/${n}`); return true; }
      if (e.key === '0' && st.isUnlocked(10)) { ctx.go('/level/10'); return true; }
      return false;
    },
  };
}
