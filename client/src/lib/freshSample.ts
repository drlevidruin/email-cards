/**
 * The sample inbox is new in v5: the app is a chat, and the sample starts fresh under it. A browser that
 * still holds an older saved sample starts the sample fresh the first time it meets this version, the way Start
 * over does: the older sample goes, and so does the sample's progress, so the welcome and the first hints show.
 * A private inbox and its progress are not touched. Imported first in main.tsx, before anything reads storage.
 */
export const SAMPLE_STORE_KEY = 'email_cards_static_demo_v5';
const OLD_SAMPLE_PREFIX = 'email_cards_static_demo';
const SAMPLE_PROGRESS_KEY = 'email_cards_progress_v1';

try {
  const ls = window.localStorage;
  if (ls.getItem(SAMPLE_STORE_KEY) === null) {
    const old = Object.keys(ls).filter((k) => k.startsWith(OLD_SAMPLE_PREFIX));
    // A first visit has nothing to clear; only a browser that holds an older sample is started over
    if (old.length > 0) {
      old.forEach((k) => ls.removeItem(k));
      ls.removeItem(SAMPLE_PROGRESS_KEY);
    }
  }
} catch {
  // Storage is unavailable: nothing was saved, so there is nothing to start over
}
