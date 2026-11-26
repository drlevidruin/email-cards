import { useSyncExternalStore } from 'react';

const STREAK_KEY = 'email_cards_show_streak';
const listeners = new Set<() => void>();

/** The streak shows unless the user turned it off. */
export function streakOn(): boolean {
  try {
    return window.localStorage.getItem(STREAK_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setStreakOn(on: boolean): void {
  try {
    window.localStorage.setItem(STREAK_KEY, on ? 'on' : 'off');
  } catch {
    // Storage may be blocked; the choice lasts until the page closes
  }
  listeners.forEach((l) => l());
}

export function useStreakOn(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    streakOn
  );
}
