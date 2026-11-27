import { useSyncExternalStore } from 'react';
import { useProgressLog } from './progress';

/**
 * The welcome layer's state. It shows on a first visit to the sample inbox, until its button is pressed once.
 * `leaving` keeps it up while it slides away.
 */
let leaving = false;
let version = 0;
const listeners = new Set<() => void>();

const emit = () => {
  version += 1;
  listeners.forEach((l) => l());
};

export type WelcomeMode = 'first' | null;

/** The chat app has no welcome: a first visit lands on the chat list. */
const modeNow = (): WelcomeMode => null;

export function setWelcomeLeaving(v: boolean): void {
  leaving = v;
  emit();
}

/** What the welcome is doing right now. `up` is true while it covers the app, sliding away included. */
export function useWelcome(): { mode: WelcomeMode; up: boolean } {
  useProgressLog();
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version
  );
  const mode = modeNow();
  return { mode, up: mode !== null || leaving };
}

/** While the welcome is up, no key reaches the app behind it. Enter presses its button. */
let onPrimary: (() => void) | null = null;
export const setWelcomePrimary = (fn: (() => void) | null): void => {
  onPrimary = fn;
};

if (typeof window !== 'undefined') {
  window.addEventListener(
    'keydown',
    (e) => {
      if (!(modeNow() !== null || leaving)) return;
      if (e.key === 'Enter' && !(e.target instanceof HTMLElement && e.target.closest('button'))) {
        e.preventDefault();
        onPrimary?.();
      }
      // Tab stays inside the layer's own controls; every other key stops here
      if (e.key !== 'Tab') e.stopImmediatePropagation();
    },
    true
  );
}
