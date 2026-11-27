/// <reference types="vite/client" />
import { GOOGLE_CLIENT_ID } from './liveConfig';

/** Live mode: the owner's own Gmail, read only. Only the static build with a Google client id can have it, and only on a device that was opened with #live. */
/** Fired on window after a sync changed the saved mail, so the screens load it again. */
export const LIVE_SYNC_EVENT = 'email-cards-live-sync';
export const LIVE_FLAG = 'email_cards_live';
export const LIVE_PREFIX = 'email_cards_live';
export const LIVE_KEYS = {
  accounts: 'email_cards_live_accounts',
  pending: 'email_cards_live_pending',
  store: 'email_cards_live_store_v1',
  prefs: 'email_cards_live_prefs_v1',
  progress: 'email_cards_live_progress',
  drafts: 'email_cards_live_drafts',
  trimmed: 'email_cards_live_trimmed',
  tokenOf: (email: string) => `email_cards_live_token_${email}`,
  triedOf: (email: string) => `email_cards_live_tried_${email}`,
};

const available = () => import.meta.env.VITE_STATIC_DEMO === 'true' && GOOGLE_CLIENT_ID !== '';
/** The web.app build: live mode is always on, with no #live and no device flag. Disconnect then shows the Connect screen. */
export const liveIsDefault = (): boolean => available() && import.meta.env.VITE_LIVE_DEFAULT === 'true';

/** True when this build can do live mode and this device has it turned on. */
export function isLiveMode(): boolean {
  if (!available()) return false;
  if (liveIsDefault()) return true;
  try {
    return window.localStorage.getItem(LIVE_FLAG) === '1';
  } catch {
    return false;
  }
}

/** Turns live mode on when the address is #live, and puts the plain address back. Runs first at start, before anything reads the hash. */
export function takeLiveFlag(): void {
  // The web.app build has no private copy: a key in the address is dropped and never stored
  if (liveIsDefault() && /^#k=/.test(window.location.hash)) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
    return;
  }
  if (!available() || window.location.hash !== '#live') return;
  try {
    window.localStorage.setItem(LIVE_FLAG, '1');
  } catch {
    // Storage is blocked: live mode cannot start
  }
  window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
}

let stopped = false;
/** Set first by Disconnect: from then on nothing is saved, so a sync round still in flight cannot write the keys back. */
export const stopLive = (): void => {
  stopped = true;
};
export const liveStopped = (): boolean => stopped;

/** Removes every live key. Nothing else is touched. */
export function removeLiveKeys(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(LIVE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    // Nothing to clear
  }
}
