import { useSyncExternalStore } from 'react';
import { GMAIL_API } from './liveConfig';
import { LIVE_SYNC_EVENT, liveStopped } from './liveMode';
import { applyLiveSync, liveKnown, liveMessageIds, liveThreadTotal } from './staticDemoApi';
import { pruneLivePictures } from './pictures';
import { dropToken, goodToken, liveAccounts } from './liveAuth';
import { liveAccountId, ACCOUNT_COLORS } from './liveMerge';
import { fetchChanges } from './liveSync';
import { dropFromThreadCache } from './threadCache';

/**
 * Keeps live mode current: reads each connected account's inbox at start, every 30 seconds while the page is visible and online,
 * and at once when the page becomes visible or the device comes back online. One sync at a time, one account after another.
 * Only GET reads of the inbox go out (see gmailApi.ts). Nothing in Gmail is ever changed.
 */
const EVERY_MS = 30_000;

interface Status {
  /** The first round has not finished and there is no saved mail yet. */
  waiting: boolean;
}

let firstDone = false;
let hasMail = false;
let status: Status = { waiting: true };
const listeners = new Set<() => void>();

function setStatus(): void {
  const waiting = !firstDone && !hasMail;
  if (waiting === status.waiting) return;
  status = { waiting };
  listeners.forEach((l) => l());
}

export function useLiveStatus(): Status {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => status
  );
}

let inFlight = false;

/** One round over every account that is signed in. Does nothing while another round runs. */
export async function syncNow(): Promise<void> {
  if (inFlight) return;
  inFlight = true;
  try {
    const accounts = liveAccounts();
    const mine = accounts.map((a) => a.email);
    for (const [index, rec] of accounts.entries()) {
      if (liveStopped()) break;
      if (rec.state !== 'ok') continue;
      const token = goodToken(rec.email);
      // No good token: its saved mail stays on screen and its sync waits for the renewal
      if (!token) continue;
      const id = liveAccountId(rec.email);
      const info = { id, email: rec.email, color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length], label: rec.email };
      const got = await fetchChanges({ fetch: (u, i) => window.fetch(u, i), base: GMAIL_API }, info, token, mine, liveKnown(id));
      if (got.outcome === 'unauthorized') {
        dropToken(rec.email);
        continue;
      }
      if (got.outcome === 'forbidden' || got.outcome === 'failed') continue;
      // Disconnect may have come while this round was in flight: save nothing
      if (liveStopped()) break;
      const done = applyLiveSync(id, got);
      if (done.changedIds.length > 0 || done.removedIds.length > 0) {
        dropFromThreadCache([...done.changedIds, ...done.removedIds]);
        const have = liveMessageIds();
        pruneLivePictures((id) => have.has(id));
        window.dispatchEvent(new Event(LIVE_SYNC_EVENT));
      }
    }
  } catch {
    // A failed round is tried again at the next turn
  } finally {
    inFlight = false;
    hasMail = liveThreadTotal() > 0;
    firstDone = true;
    setStatus();
  }
}

const canSync = () => !liveStopped() && document.visibilityState === 'visible' && navigator.onLine !== false;

let started = false;
/** Starts the first round and the timers. Safe to call once. */
export function startLiveSync(): void {
  if (started) return;
  started = true;
  hasMail = liveThreadTotal() > 0;
  setStatus();
  document.addEventListener('visibilitychange', () => {
    if (canSync()) void syncNow();
  });
  window.addEventListener('online', () => {
    if (canSync()) void syncNow();
  });
  window.setInterval(() => {
    if (canSync()) void syncNow();
  }, EVERY_MS);
  void syncNow();
}
