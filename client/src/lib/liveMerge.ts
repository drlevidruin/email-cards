import type { EmailMessage, EmailThread, GmailAccount } from './types';
import type { SyncChanges } from './liveSync.ts';

/** Puts one account's sync result into the saved store. Pure. */
export interface LiveStoreLike {
  accounts: GmailAccount[];
  threads: EmailThread[];
  messages: EmailMessage[];
}

/** The sample's account colors, in order. */
export const ACCOUNT_COLORS = ['#38bdf8', '#34d399', '#f59e0b'];

/** `live-` plus the address, every character outside a to z and 0 to 9 made `-`. */
export const liveAccountId = (email: string): string => 'live-' + email.toLowerCase().replace(/[^a-z0-9]/g, '-');

export function liveGmailAccount(email: string, index: number): GmailAccount {
  return {
    id: liveAccountId(email),
    email: email.toLowerCase(),
    displayName: email.toLowerCase().split('@')[0],
    label: email.toLowerCase(),
    color: ACCOUNT_COLORS[index % ACCOUNT_COLORS.length],
    provider: 'gmail_oauth',
    status: 'connected',
    lastSyncedAt: null,
    unreadCount: 0,
    isDemo: false,
  };
}

/** Makes the store's accounts match the connected addresses: the same order, existing accounts kept, new ones added, gone ones (and their mail) dropped. */
export function reconcileAccounts(store: LiveStoreLike, emails: string[]): boolean {
  const want = emails.map((e) => e.toLowerCase());
  const same = store.accounts.length === want.length && store.accounts.every((a, i) => a.email === want[i]);
  if (same) return false;
  const old = new Map(store.accounts.map((a) => [a.email, a]));
  store.accounts = want.map((e, i) => old.get(e) ?? liveGmailAccount(e, i));
  const ids = new Set(store.accounts.map((a) => a.id));
  store.threads = store.threads.filter((t) => ids.has(t.accountId));
  store.messages = store.messages.filter((m) => ids.has(m.accountId));
  return true;
}

const at = (iso: string) => new Date(iso).getTime() || 0;

/**
 * Upserts the changed threads (their messages replaced), removes the gone ones, and keeps what the owner set in the app:
 * a thread read or marked unread here (it has a localMarkAt stamp) keeps that mark until a newer message arrives.
 * Returns the ids that changed or went, so caches can drop them.
 */
export function mergeChanges(store: LiveStoreLike, accountId: string, changes: Pick<SyncChanges, 'changed' | 'goneIds'>, now = Date.now()): { changedIds: string[]; removedIds: string[] } {
  const changedIds: string[] = [];
  const own = `${accountId}~`;
  const incoming = changes.changed.filter((c) => c.thread.id.startsWith(own));
  const gone = new Set(changes.goneIds.filter((id) => id.startsWith(own)));
  const replaced = new Set(incoming.map((c) => c.thread.id));

  const byId = new Map(store.threads.map((t) => [t.id, t]));
  for (const c of incoming) {
    const old = byId.get(c.thread.id);
    const next: EmailThread = { ...c.thread };
    if (old) {
      const newer = at(next.lastMessageAt) > at(old.lastMessageAt) || next.messageCount > old.messageCount;
      // A mark made in the app holds until a newer message arrives; without one, Gmail decides
      if (!newer && old.localMarkAt) {
        next.isUnread = old.isUnread;
        next.localMarkAt = old.localMarkAt;
      }
      // Archived here stays archived until a newer message arrives (Gmail still has it in the inbox)
      if (!newer && old.isArchived) {
        next.isArchived = true;
        next.bucket = old.bucket;
      }
      if (old.isSnoozedUntil) next.isSnoozedUntil = old.isSnoozedUntil;
    }
    byId.set(next.id, next);
    changedIds.push(next.id);
  }
  for (const id of gone) byId.delete(id);

  store.threads = [...byId.values()].sort((a, b) => at(b.lastMessageAt) - at(a.lastMessageAt));
  store.messages = [...store.messages.filter((m) => !replaced.has(m.threadId) && !gone.has(m.threadId)), ...incoming.flatMap((c) => c.messages)];
  const acc = store.accounts.find((a) => a.id === accountId);
  if (acc) acc.lastSyncedAt = new Date(now).toISOString();
  return { changedIds, removedIds: [...gone] };
}

/** Drops the oldest `n` threads (and their messages), for a store that no longer fits in storage. Returns how many went. */
export function dropOldest(store: LiveStoreLike, n: number): number {
  const oldest = [...store.threads].sort((a, b) => at(a.lastMessageAt) - at(b.lastMessageAt)).slice(0, n);
  const ids = new Set(oldest.map((t) => t.id));
  store.threads = store.threads.filter((t) => !ids.has(t.id));
  store.messages = store.messages.filter((m) => !ids.has(m.threadId));
  return ids.size;
}
