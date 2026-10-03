/** A tiny app-wide event bus for captions, toasts and announcements. */
export type AppEvent =
  | { type: 'caption'; text: string }
  | { type: 'toast'; text: string; tone?: 'good' | 'bad' | 'info'; ms?: number }
  | { type: 'announce'; text: string };

type Handler = (e: AppEvent) => void;
const handlers = new Set<Handler>();

export function on(fn: Handler): () => void {
  handlers.add(fn);
  return () => handlers.delete(fn);
}

export function emit(e: AppEvent): void {
  for (const fn of handlers) {
    try {
      fn(e);
    } catch (err) {
      console.error(err);
    }
  }
}

export const toast = (text: string, tone: 'good' | 'bad' | 'info' = 'info', ms = 2600): void => emit({ type: 'toast', text, tone, ms });
export const announce = (text: string): void => emit({ type: 'announce', text });
