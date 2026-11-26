/**
 * Pins the clock in the static demo. The sample was written for a Tuesday around 1 PM, so every label
 * ("Due today 4:00 PM") is true on any day the demo is opened. The pin ticks: `Date.now()` and
 * `new Date()` return Tuesday, November 24, 2026, 1:00 PM local time plus the time since the page loaded.
 * It is off in the real app and for a real snapshot (a URL hash starting with `#k=`).
 */
const PINNED = import.meta.env.VITE_STATIC_DEMO === 'true' && !/^#k=/.test(window.location.hash);

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
