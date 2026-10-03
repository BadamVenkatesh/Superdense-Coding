import { audio } from '../../audio/audio';
import type { AppCtx, Screen } from '../app';
import { button, h } from '../dom';
import { topbar } from '../components';
import { toast } from '../bus';

export function settingsScreen(ctx: AppCtx): Screen {
  const st = ctx.store;
  const seg = <T extends string | boolean | null>(label: string, value: T, options: [T, string][], set: (v: T) => void) =>
    h('div', { class: 'seg', role: 'group', 'aria-label': label },
      ...options.map(([v, text]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => { set(v); ctx.refresh(); } }, text)));

  const s = st.data.settings;
  const row = (title: string, desc: string, control: Node) =>
    h('div', { class: 'setting' }, h('div', {}, h('div', {}, title), h('div', { class: 'd' }, desc)), control);

  const el = h('div', { class: 'screen' },
    topbar(ctx, 'SETTINGS', 'THE OTHER HALF', [], '/'),
    h('div', { class: 'prose', style: 'width:100%' },
      row('Sound', 'Generated tones: no downloads. Every sound has a visual twin.', seg('Sound', s.sound, [[true, 'On'], [false, 'Off']], (v) => { st.setSetting('sound', v); audio.enabled = v; if (v) audio.unlock(); })),
      row('Sound captions', 'Show a short caption for every sound cue.', seg('Captions', s.captions, [[true, 'On'], [false, 'Off']], (v) => st.setSetting('captions', v))),
      row('Reduced motion', 'Stops flowing animations. Link patterns stay readable as still shapes.', seg('Reduced motion', s.reducedMotion, [[null, 'Auto'], [true, 'On'], [false, 'Off']], (v) => st.setSetting('reducedMotion', v))),
      row('Names', 'GAME uses plain names (FLIP, TWIN…). CIRCUIT shows gates, Bell states and a live circuit. Press V anytime.', seg('View', s.view, [['game', 'GAME'], ['circuit', 'CIRCUIT']], (v) => ctx.setView(v))),
      row('Unlock all levels', 'For judges and the curious: jump anywhere.', seg('Unlock all', s.unlockAll, [[true, 'On'], [false, 'Off']], (v) => st.setSetting('unlockAll', v))),
      row('Reset progress', st.persistent ? 'Clears stars and scores on this device.' : 'Progress is not being saved (storage is blocked in this browser).',
        button('Reset', { cls: 'small', onClick: () => { if (confirm('Clear all stars and scores?')) { st.reset(); toast('Progress cleared'); ctx.refresh(); } } })),
    ));
  return { el, onKey: (e) => (e.key === 'Escape' ? (ctx.go('/'), true) : false) };
}
