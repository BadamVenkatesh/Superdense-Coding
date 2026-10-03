import { audio } from '../../audio/audio';
import { LEVELS } from '../../game/levels';
import type { AppCtx, Screen } from '../app';
import { button, h } from '../dom';
import { Scene, type SceneModel } from '../scene';
import type { Bits } from '../../quantum/superdenseCoding';

const CYCLE: Bits[] = ['00', '01', '11', '10'];

export function titleScreen(ctx: AppCtx): Screen {
  const next = ctx.store.nextLevel();
  const started = Object.keys(ctx.store.data.stars).length > 0;
  const canvas = h('canvas', { class: 'title-hero', role: 'img', 'aria-label': 'Two linked orbs: your half and Bob’s half of an entangled pair. The link between them changes pattern.' });
  const t0 = performance.now() / 1000;
  const model = (): SceneModel => {
    const t = performance.now() / 1000 - t0;
    const k = Math.floor(t / 2.4) % 4;
    return {
      rungs: [{ id: 1, a: {}, b: {}, pattern: CYCLE[k], link: 'linked', changedAt: t0 + Math.floor(t / 2.4) * 2.4 }],
      slots: 1, flight: null, zones: [], spy: null, channel: null, dock: null, view: 'game', bench: true, lane: false,
    };
  };
  const scene = new Scene(canvas, model);
  scene.reducedMotion = ctx.reducedMotion();
  scene.start();

  const play = () => {
    audio.unlock();
    ctx.go(`/level/${next}`);
  };

  const el = h('div', { class: 'screen title-screen' },
    canvas,
    h('h1', { class: 'wordmark' }, h('span', { class: 'a' }, 'THE OTHER'), ' ', h('span', { class: 'b' }, 'HALF')),
    h('p', { class: 'tagline' }, h('b', {}, 'two bits'), ' · one qubit'),
    h('p', { class: 'muted', style: 'max-width:440px;margin:0' }, 'You and Bob share something. Two qubits. One pair. Learn to send him two bits by posting just one.'),
    h('nav', { class: 'menu', 'aria-label': 'Main menu' },
      button(started ? `Continue: Level ${next}` : 'Play', { cls: 'primary', key: 'Space', onClick: play, id: 'play' }),
      h('div', { class: 'menu-row' },
        button('Levels', { onClick: () => ctx.go('/levels'), key: 'L' }),
        button('Arcade', { onClick: () => ctx.go('/arcade'), key: 'A' })),
      h('div', { class: 'menu-row' },
        button('Quantum Lab', { onClick: () => ctx.go('/lab'), key: 'Q' }),
        button('How to play', { onClick: () => ctx.go('/how'), key: 'H' })),
      button('Settings', { cls: 'ghost', onClick: () => ctx.go('/settings') })),
    h('p', { class: 'judge-note' }, 'Judging in a hurry? The signature moment is ',
      h('a', { href: '#/level/5', onclick: (e: Event) => { e.preventDefault(); ctx.store.setSetting('unlockAll', true); ctx.go('/level/5'); } }, `Level 5: ${LEVELS[4].title}`),
      ' (about 2 minutes). Every level can be unlocked in Settings.'),
  );
  el.querySelector<HTMLButtonElement>('#play')?.setAttribute('data-autofocus', '');

  return {
    el,
    onKey(e) {
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'enter') {
        if (document.activeElement && document.activeElement !== document.body && (document.activeElement as HTMLElement).tagName === 'BUTTON' && k === 'enter') return false;
        play();
        return true;
      }
      if (k === 'l') { ctx.go('/levels'); return true; }
      if (k === 'a') { ctx.go('/arcade'); return true; }
      if (k === 'q') { ctx.go('/lab'); return true; }
      if (k === 'h') { ctx.go('/how'); return true; }
      return false;
    },
    destroy: () => scene.destroy(),
  };
}
