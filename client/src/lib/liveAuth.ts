import { useSyncExternalStore } from 'react';
import { AUTH_URL, GMAIL_API, GOOGLE_CLIENT_ID, REDIRECT_URI, SCOPE } from './liveConfig';
import { LIVE_KEYS, removeLiveKeys, stopLive } from './liveMode';
import { revokeLivePictures } from './pictures';
import { trimLiveStore } from './staticDemoApi';
import { gmailGet } from './gmailApi';
import { watchRoute } from '../router';
import {
  acceptReturn,
  buildAuthUrl,
  errorOutcome,
  hasGmailScope,
  newNonce,
  nextRenewal,
  tickRenewal,
  parseAccounts,
  parsePending,
  parseReturn,
  parseStoredToken,
  tokenGood,
  type LiveAccountRec,
  type Pending,
  type SignInKind,
} from './liveAuthCore';

/**
 * Google sign-in for live mode, all in the browser. Read only: the one scope is gmail.readonly.
 * A token is kept per address in this browser, is never logged, never put in an address or a message,
 * and is sent only to the Gmail address in an Authorization header (see gmailApi.ts).
 */
const cfg = () => ({ authUrl: AUTH_URL, clientId: GOOGLE_CLIENT_ID, redirectUri: REDIRECT_URI, scope: SCOPE });

const read = (key: string): unknown => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};
const write = (key: string, value: unknown): void => {
  try {
    window.localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  } catch {
    // Storage is blocked: the sign-in lasts only for this visit
  }
};
const drop = (key: string): void => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing to remove
  }
};

// ------------------------------------------------------------------ accounts

const listeners = new Set<() => void>();
let accountsCache: LiveAccountRec[] | null = null;
let accountsRaw: string | null = null;
const emit = () => {
  accountsCache = null;
  listeners.forEach((l) => l());
};

export function liveAccounts(): LiveAccountRec[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LIVE_KEYS.accounts);
  } catch {
    raw = null;
  }
  // A cached list is good while the saved text is the same
  if (accountsCache && raw === accountsRaw) return accountsCache;
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  accountsRaw = raw;
  accountsCache = parseAccounts(parsed);
  return accountsCache;
}

const saveAccounts = (list: LiveAccountRec[]): void => {
  write(LIVE_KEYS.accounts, list);
  emit();
};

export function setAccountState(email: string, state: 'ok' | 'signin'): void {
  const list = liveAccounts();
  if (!list.some((a) => a.email === email && a.state !== state)) return;
  saveAccounts(list.map((a) => (a.email === email ? { ...a, state } : a)));
}

function addAccount(email: string): void {
  const list = liveAccounts();
  if (list.some((a) => a.email === email)) setAccountState(email, 'ok');
  else saveAccounts([...list, { email, state: 'ok' }]);
}

export function subscribeAuth(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

export function useLiveAccounts(): LiveAccountRec[] {
  return useSyncExternalStore(subscribeAuth, liveAccounts);
}

// ------------------------------------------------------------------ the line from the last return

let message: string | null = null;
export function useLiveMessage(): string | null {
  return useSyncExternalStore(subscribeAuth, () => message);
}
const setMessage = (m: string | null) => {
  message = m;
  emit();
};

// ------------------------------------------------------------------ tokens

/** A token that is good for more than 2 minutes, else null. A token that is not good is removed. */
export function goodToken(email: string): string | null {
  const key = LIVE_KEYS.tokenOf(email);
  const t = parseStoredToken(read(key));
  if (tokenGood(t, Date.now())) return t.token;
  if (t) drop(key);
  return null;
}

/** The sign-in went stale (Gmail said 401): forget the token. A renewal follows. */
export function dropToken(email: string): void {
  drop(LIVE_KEYS.tokenOf(email));
  emit();
}

// ------------------------------------------------------------------ going to Google

/** Whether a saved value reads back the same. A full storage swallows a write, and leaving for Google without the records would repeat at every start. */
const stuck = (key: string, text: string): boolean => {
  try {
    return window.localStorage.getItem(key) === text;
  } catch {
    return false;
  }
};

/** Saves the records a return needs and reads them back. When the storage is full, trims the saved mail to make room, once. */
function saveRecords(pending: Pending, triedFor?: string): boolean {
  const pendingText = JSON.stringify(pending);
  const triedText = String(Date.now());
  const put = (): boolean => {
    write(LIVE_KEYS.pending, pendingText);
    if (triedFor) write(LIVE_KEYS.triedOf(triedFor), triedText);
    return stuck(LIVE_KEYS.pending, pendingText) && (!triedFor || stuck(LIVE_KEYS.triedOf(triedFor), triedText));
  };
  if (put()) return true;
  trimLiveStore();
  return put();
}

/** Returns true when the page is leaving for Google. */
function startSignIn(kind: SignInKind, email?: string, route?: string): boolean {
  if (navigator.onLine === false) {
    setMessage('No connection.');
    return false;
  }
  const nonce = newNonce((a) => crypto.getRandomValues(a));
  const pending: Pending = { nonce, route: route ?? (window.location.hash || '#/'), silent: kind === 'silent', at: Date.now(), ...(email ? { email } : {}) };
  if (!saveRecords(pending, kind === 'silent' ? email : undefined)) {
    drop(LIVE_KEYS.pending);
    setMessage('This device is out of room to sign in.');
    return false;
  }
  window.location.assign(buildAuthUrl(cfg(), kind, nonce, email));
  return true;
}

/** Connect Gmail, or add one more account: Google asks which account. */
export const connectAccount = (): void => void startSignIn('connect');

/** Sign in again to a known address: no account picker. */
export const signInAgain = (email: string): void => void startSignIn('again', email);

// ------------------------------------------------------------------ the return

const safeRoute = (r: string | undefined): string => (r && /^#\/[^\s]*$/.test(r) ? r : '#/');

/**
 * Run first at start, before the router and before the private copy's key. Reads a sign-in return from the address,
 * puts the address back at once (so the token is never left in it or in history), and then checks the token with Gmail.
 */
export async function takeSignInReturn(): Promise<void> {
  const ret = parseReturn(window.location.hash);
  if (!ret) return;
  const pending = parsePending(read(LIVE_KEYS.pending));
  window.history.replaceState(null, '', window.location.pathname + window.location.search + safeRoute(pending?.route));
  drop(LIVE_KEYS.pending);
  if (!acceptReturn(ret, pending, Date.now()) || !pending) return;

  if (ret.kind === 'error') {
    const out = errorOutcome(ret.error, pending.silent);
    if (out.markSignin && pending.email) setAccountState(pending.email, 'signin');
    setMessage(out.message);
    return;
  }
  if (!hasGmailScope(ret.scope) || ret.expiresIn <= 0) {
    setMessage('Google did not give access to email.');
    return;
  }
  const got = await gmailGet((u, i) => window.fetch(u, i), GMAIL_API, 'users/me/profile', ret.token);
  if (got.status === 'unauthorized' || got.status === 'forbidden') {
    setMessage('Google did not give access to email.');
    return;
  }
  const address = got.status === 'ok' ? (got.json as { emailAddress?: unknown } | null)?.emailAddress : undefined;
  if (typeof address !== 'string' || !address.includes('@')) {
    setMessage('Google did not connect this account.');
    return;
  }
  const email = address.toLowerCase();
  // A silent renewal that came back as another account is not used
  if (pending.silent && pending.email && pending.email !== email) return;
  write(LIVE_KEYS.tokenOf(email), { token: ret.token, expiresAt: Date.now() + ret.expiresIn * 1000 });
  addAccount(email);
  setMessage(null);
}

// ------------------------------------------------------------------ silent renewal

function searching(): boolean {
  const input = document.querySelector<HTMLInputElement>('.chatlist__search input');
  return !!input && (document.activeElement === input || input.value !== '');
}

/**
 * An account in state ok with no good token is renewed by a silent redirect, only: at start, when the page becomes visible,
 * and when the route becomes the list while the page is visible. Never while searching, never more than once per account in
 * 10 minutes, one account at a time. Returns true when the page is leaving for Google.
 */
export function renewIfNeeded(): boolean {
  const accounts = liveAccounts();
  const good = new Set(accounts.filter((a) => goodToken(a.email) !== null).map((a) => a.email));
  const tried: Record<string, number | undefined> = {};
  for (const a of accounts) {
    const n = Number(read(LIVE_KEYS.triedOf(a.email)));
    tried[a.email] = Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const email = nextRenewal({ accounts, good, tried, now: Date.now(), visible: document.visibilityState === 'visible', online: navigator.onLine !== false, hash: window.location.hash, searching: searching() });
  if (!email) return false;
  return startSignIn('silent', email);
}

let lastActivityAt = Date.now();
const overlayOpen = (): boolean => !!document.querySelector('[aria-modal="true"], .scrim, .reader');

/**
 * The 30 second tick: renews an account whose token has run out or has under 2 minutes left, while the page stays open and
 * the person is not using it (see tickRenewal). Returns true when the page is leaving for Google.
 */
export function renewOnTick(): boolean {
  const accounts = liveAccounts();
  const good = new Set(accounts.filter((a) => goodToken(a.email) !== null).map((a) => a.email));
  const tried: Record<string, number | undefined> = {};
  for (const a of accounts) {
    const n = Number(read(LIVE_KEYS.triedOf(a.email)));
    tried[a.email] = Number.isFinite(n) && n > 0 ? n : undefined;
  }
  const email = tickRenewal({
    accounts, good, tried, now: Date.now(), visible: document.visibilityState === 'visible', online: navigator.onLine !== false, hash: window.location.hash,
    searching: searching(), overlayOpen: overlayOpen(), lastActivityAt,
  });
  if (!email) return false;
  return startSignIn('silent', email);
}

let watching = false;
/** Renewal also checks when the page becomes visible, when the route changes, and on every 30 second tick while the page is idle. */
export function watchRenewal(): void {
  if (watching) return;
  watching = true;
  const touched = () => {
    lastActivityAt = Date.now();
  };
  for (const ev of ['touchstart', 'keydown', 'scroll', 'wheel', 'pointerdown']) document.addEventListener(ev, touched, { capture: true, passive: true });
  window.setInterval(() => {
    renewOnTick();
  }, 30_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renewIfNeeded();
  });
  // Back online after being offline: an expired token can be renewed now
  window.addEventListener('online', () => {
    renewOnTick();
  });
  watchRoute(() => {
    renewIfNeeded();
  });
}

// ------------------------------------------------------------------ disconnect

/** Removes everything live mode keeps on this device (flag, accounts, tokens, saved mail, settings) and starts again at the list. */
export function disconnect(): void {
  stopLive();
  revokeLivePictures();
  removeLiveKeys();
  window.history.replaceState(null, '', window.location.pathname + window.location.search + '#/');
  window.location.reload();
}

