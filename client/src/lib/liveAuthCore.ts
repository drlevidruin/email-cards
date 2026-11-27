/** The pure rules of Google sign-in for live mode: addresses, the return, token life, and when to renew. No window, no storage. */
export interface AuthConfig {
  authUrl: string;
  clientId: string;
  redirectUri: string;
  scope: string;
}

export type SignInKind = 'connect' | 'again' | 'silent';

export interface Pending {
  nonce: string;
  email?: string;
  route: string;
  silent: boolean;
  at: number;
}

export interface LiveAccountRec {
  email: string;
  state: 'ok' | 'signin';
}

export interface StoredToken {
  token: string;
  expiresAt: number;
}

export const TOKEN_MARGIN_MS = 2 * 60_000;
export const PENDING_MS = 10 * 60_000;
export const SILENT_GAP_MS = 10 * 60_000;

/** 16 random bytes as base64url. */
export function newNonce(getRandomValues: (a: Uint8Array) => Uint8Array): string {
  const bytes = getRandomValues(new Uint8Array(16));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The address to send the browser to. connect: pick an account. again: a known account, no prompt.
 * silent: no screen at all (prompt=none), for a known account.
 */
export function buildAuthUrl(cfg: AuthConfig, kind: SignInKind, nonce: string, email?: string): string {
  const u = new URL(cfg.authUrl);
  u.searchParams.set('client_id', cfg.clientId);
  u.searchParams.set('redirect_uri', cfg.redirectUri);
  u.searchParams.set('response_type', 'token');
  u.searchParams.set('scope', cfg.scope);
  u.searchParams.set('state', nonce);
  if (kind === 'connect') u.searchParams.set('prompt', 'select_account');
  else if (kind === 'silent') {
    u.searchParams.set('prompt', 'none');
    if (email) u.searchParams.set('login_hint', email);
  } else if (email) u.searchParams.set('login_hint', email);
  return u.toString();
}

export type ReturnParams =
  | { kind: 'token'; token: string; expiresIn: number; state: string; scope: string }
  | { kind: 'error'; error: string; state: string };

/** Reads a sign-in return from a hash: `#access_token=...&expires_in=...&state=...` or `#error=...&state=...`. Anything else is null. */
export function parseReturn(hash: string): ReturnParams | null {
  if (!hash.startsWith('#') || hash.length < 3) return null;
  let p: URLSearchParams;
  try {
    p = new URLSearchParams(hash.slice(1));
  } catch {
    return null;
  }
  const token = p.get('access_token');
  if (token) {
    const expiresIn = Number(p.get('expires_in'));
    return { kind: 'token', token, expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : 0, state: p.get('state') ?? '', scope: p.get('scope') ?? '' };
  }
  const error = p.get('error');
  if (error) return { kind: 'error', error, state: p.get('state') ?? '' };
  return null;
}

/** A return counts only when its state is the pending nonce and the pending record is under 10 minutes old. */
export function acceptReturn(ret: { state: string }, pending: Pending | null, now: number): boolean {
  if (!pending || !pending.nonce) return false;
  if (!(now - pending.at < PENDING_MS) || now < pending.at) return false;
  return ret.state === pending.nonce;
}

/** Reads a saved pending record. Anything damaged is null. */
export function parsePending(raw: unknown): Pending | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.nonce !== 'string' || typeof o.route !== 'string' || typeof o.at !== 'number') return null;
  return { nonce: o.nonce, route: o.route, at: o.at, silent: o.silent === true, ...(typeof o.email === 'string' ? { email: o.email } : {}) };
}

export function parseStoredToken(raw: unknown): StoredToken | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.token !== 'string' || !o.token || typeof o.expiresAt !== 'number') return null;
  return { token: o.token, expiresAt: o.expiresAt };
}

/** Good while more than 2 minutes remain. */
export const tokenGood = (t: StoredToken | null | undefined, now: number): t is StoredToken => !!t && t.expiresAt - now > TOKEN_MARGIN_MS;

export function parseAccounts(raw: unknown): LiveAccountRec[] {
  if (!Array.isArray(raw)) return [];
  const out: LiveAccountRec[] = [];
  for (const a of raw) {
    if (!a || typeof a !== 'object') continue;
    const o = a as Record<string, unknown>;
    if (typeof o.email !== 'string' || !o.email) continue;
    const email = o.email.toLowerCase();
    if (out.some((x) => x.email === email)) continue;
    out.push({ email, state: o.state === 'signin' ? 'signin' : 'ok' });
  }
  return out;
}

export const hasGmailScope = (scope: string): boolean => scope.split(/[\s,]+/).includes('https://www.googleapis.com/auth/gmail.readonly');

/** The list screens: `#/` and `#/chats` (with or without a query). */
export function isListRoute(hash: string): boolean {
  const path = (hash.replace(/^#/, '') || '/').split('?')[0];
  return path === '/' || path === '' || path === '/chats';
}

export interface RenewInput {
  accounts: LiveAccountRec[];
  /** Emails that have a good token. */
  good: Set<string>;
  /** When the last silent attempt was made, by email. */
  tried: Record<string, number | undefined>;
  now: number;
  visible: boolean;
  /** The device has a network. Offline, a renewal would leave for an error page instead of the saved mail. */
  online: boolean;
  hash: string;
  /** The list's search field has focus or text. */
  searching: boolean;
}

/**
 * The account to renew by a silent redirect now, or null. An account in state ok with no good token, only while the page is
 * visible and on the list, never while searching, and never twice within 10 minutes. One account at a time: the first that qualifies.
 */
export function nextRenewal(i: RenewInput): string | null {
  if (!i.online || !i.visible || i.searching || !isListRoute(i.hash)) return null;
  for (const a of i.accounts) {
    if (a.state !== 'ok' || i.good.has(a.email)) continue;
    const last = i.tried[a.email];
    if (last !== undefined && i.now - last < SILENT_GAP_MS && i.now >= last) continue;
    return a.email;
  }
  return null;
}

/** How long the person must have been still (no touch, key or scroll) before a renewal may leave the page. */
export const IDLE_MS = 60_000;

export interface TickRenewInput extends RenewInput {
  /** A sheet, press-and-hold menu or picture viewer is open. */
  overlayOpen: boolean;
  /** When the last touch, key press or scroll happened. */
  lastActivityAt: number;
}

/**
 * The 30 second tick's decision while the page stays open: the account to renew, or null. Everything nextRenewal needs
 * (visible, on the list, search empty and not focused, once per account per 10 minutes), and also no sheet, menu or viewer
 * open and no touch, key or scroll in the last minute. `good` is false for an expired token or one with under 2 minutes left.
 */
export function tickRenewal(i: TickRenewInput): string | null {
  if (i.overlayOpen) return null;
  if (i.now - i.lastActivityAt < IDLE_MS) return null;
  return nextRenewal(i);
}

/** What a failed return means. `silentRenewal` is true when the sign-in in progress was a silent one. */
export function errorOutcome(error: string, silentRenewal: boolean): { markSignin: boolean; message: string | null } {
  if (error === 'access_denied') return { markSignin: false, message: null };
  const needsYou = ['login_required', 'interaction_required', 'consent_required', 'account_selection_required'].includes(error);
  if (needsYou && silentRenewal) return { markSignin: true, message: null };
  return { markSignin: false, message: 'Google did not connect this account.' };
}
