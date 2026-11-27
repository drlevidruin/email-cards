/**
 * Pins the clock in the static demo. The sample was written for a Tuesday around 1 PM, so every label
 * ("Due today 4:00 PM") is true on any day the demo is opened. The pin ticks: `Date.now()` and
 * `new Date()` return Tuesday, November 24, 2026, 1:00 PM local time plus the time since the page loaded.
 * It is off in the real app, in live Gmail, and for a real snapshot (a URL hash starting with `#k=`, or a key saved in this browser, because the address loses its hash after the first read).
 */
/** True when this browser holds a private copy's key. Same key name as KEY_STORE in snapshot.ts, which is not imported here because this file must run before any module reads a date. */
function hasSnapshotKey(): boolean {
  try {
    return !!window.localStorage.getItem('email_cards_snapshot_key');
  } catch {
    return false;
  }
}

/** True when this is live Gmail: the build has a Google client id, and the address is #live or this browser holds the live flag. The clock never pins for it. Same key name as LIVE_FLAG in liveMode.ts, not imported for the same reason. */
function isLive(): boolean {
  if (!(import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '').trim()) return false;
  if (import.meta.env.VITE_LIVE_DEFAULT === 'true') return true;
  if (window.location.hash === '#live') return true;
  try {
    return window.localStorage.getItem('email_cards_live') === '1';
  } catch {
    return false;
  }
}

const PINNED = import.meta.env.VITE_STATIC_DEMO === 'true' && !/^#k=/.test(window.location.hash) && !hasSnapshotKey() && !isLive();

if (PINNED) {
  const RealDate = Date;
  const start = RealDate.now();
  const anchor = new RealDate(2026, 10, 24, 13, 0, 0, 0).getTime();
  const nowPinned = () => anchor + (RealDate.now() - start);

  class PinnedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) super(nowPinned());
      else super(...(args as [number]));
    }

    static now(): number {
      return nowPinned();
    }
  }

  globalThis.Date = PinnedDate as unknown as DateConstructor;
}

export {};
