/**
 * App shell: hash router, screen lifecycle, settings, toasts, captions and the
 * screen-reader live region. Screens are plain functions that return an element.
 */
import { audio } from '../audio/audio';
import { Store, type ViewMode } from '../game/store';
import { on } from './bus';
import { h } from './dom';

export interface Screen {
  el: HTMLElement;
  /** Return true if the key was handled. */
  onKey?(e: KeyboardEvent): boolean;
  destroy?(): void;
}

export interface AppCtx {
  store: Store;
  go(path: string): void;
  reducedMotion(): boolean;
  view(): ViewMode;
  setView(v: ViewMode): void;
  /** Re-render the current screen (e.g. after a settings change). */
  refresh(): void;
}

export type ScreenFactory = (ctx: AppCtx, params: string[]) => Screen;

const screens = new Map<string, ScreenFactory>();
export function registerScreen(name: string, f: ScreenFactory): void {
  screens.set(name, f);
}

const viewListeners = new Set<(v: ViewMode) => void>();
export function onViewChange(fn: (v: ViewMode) => void): () => void {
  viewListeners.add(fn);
  return () => viewListeners.delete(fn);
}

export function startApp(root: HTMLElement): AppCtx {
  const store = new Store();
  const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let current: Screen | null = null;

  const live = h('div', { class: 'sr-only', 'aria-live': 'polite', role: 'status' });
  const toasts = h('div', { class: 'toast-host', 'aria-live': 'polite' });
  const captions = h('div', { class: 'caption-host', 'aria-hidden': 'true' });
  const host = h('main', { id: 'screen-host' });
  host.style.cssText = 'flex:1;display:flex;flex-direction:column';
  root.replaceChildren(host, toasts, captions, live);

  const applySettings = () => {
    const st = store.data.settings;
    audio.enabled = st.sound;
    audio.captions = st.captions;
    document.documentElement.classList.toggle('reduce-motion', ctx.reducedMotion());
    document.documentElement.dataset.view = st.view;
  };

  const ctx: AppCtx = {
    store,
    go(path: string) {
      const next = path.startsWith('#') ? path : `#${path}`;
      if (location.hash === next) render();
      else location.hash = next;
    },
    reducedMotion() {
      const s = store.data.settings.reducedMotion;
      return s === null ? !!mq?.matches : s;
    },
    view: () => store.data.settings.view,
    setView(v: ViewMode) {
      store.setSetting('view', v);
      applySettings();
      for (const fn of viewListeners) fn(v);
    },
    refresh: () => {
      applySettings();
      render();
    },
  };

  on((e) => {
    if (e.type === 'announce') {
      live.textContent = '';
      requestAnimationFrame(() => (live.textContent = e.text));
    } else if (e.type === 'toast') {
      const t = h('div', { class: `toast ${e.tone ?? ''}` }, e.text);
      toasts.append(t);
      while (toasts.children.length > 3) toasts.firstElementChild?.remove();
      setTimeout(() => t.remove(), e.ms ?? 2600);
    } else if (e.type === 'caption') {
      const c = h('div', { class: 'caption' }, e.text);
      captions.append(c);
      while (captions.children.length > 4) captions.firstElementChild?.remove();
      setTimeout(() => c.remove(), 2200);
    }
  });

  function parse(): { name: string; params: string[] } {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean);
    const name = parts[0] ?? 'title';
    return { name: screens.has(name) ? name : 'title', params: parts.slice(1) };
  }

  function render(): void {
    try {
      current?.destroy?.();
    } catch (err) {
      console.error(err);
    }
    current = null;
    const { name, params } = parse();
    try {
      current = screens.get(name)!(ctx, params);
      host.replaceChildren(current.el);
      window.scrollTo(0, 0);
      const focusTarget = current.el.querySelector<HTMLElement>('[data-autofocus]');
      focusTarget?.focus({ preventScroll: true });
    } catch (err) {
      console.error(err);
      host.replaceChildren(
        h('div', { class: 'screen', style: 'align-items:center;justify-content:center;text-align:center;gap:12px' },
          h('h2', {}, 'Something went sideways.'),
          h('p', { class: 'muted' }, 'That screen hit an unexpected error. Your progress is safe.'),
          h('button', { class: 'btn primary', onclick: () => ctx.go('/') }, 'Back to the title')),
      );
    }
  }

  window.addEventListener('hashchange', render);
  mq?.addEventListener?.('change', applySettings);

  // First gesture unlocks audio (browsers block it until then).
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (current?.onKey?.(e)) {
      e.preventDefault();
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'm') {
      store.setSetting('sound', !store.data.settings.sound);
      applySettings();
    } else if (k === 'v') {
      ctx.setView(ctx.view() === 'game' ? 'circuit' : 'game');
    }
  });

  applySettings();
  render();
  return ctx;
}
