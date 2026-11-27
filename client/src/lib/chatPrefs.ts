import { useEffect, useState } from 'react';
import { isSnapshot } from './snapshot';
import { canPin, emptyPrefs, parsePrefs, type ChatPrefs } from './chatPrefsCore';

/** Pin, mute, archive and the hand-set unread mark for each chat. Kept in this browser only. In a saved copy they use their own key. */
const key = () => (isSnapshot() ? 'email_cards_snapshot_prefs_v1' : 'email_cards_chat_prefs_v1');

let cache: ChatPrefs | null = null;
const listeners = new Set<() => void>();

function load(): ChatPrefs {
  if (cache) return cache;
  cache = emptyPrefs();
  try {
    const raw = window.localStorage.getItem(key());
    cache = parsePrefs(raw ? JSON.parse(raw) : null);
  } catch {
    // Storage is blocked or the saved text is damaged: start empty
  }
  return cache;
}

function commit(next: ChatPrefs): void {
  cache = next;
  try {
    window.localStorage.setItem(key(), JSON.stringify(next));
  } catch {
    // Not saved: the settings still live for this visit
  }
  listeners.forEach((l) => l());
}

const copy = (p: ChatPrefs): ChatPrefs => ({ pinned: { ...p.pinned }, muted: { ...p.muted }, unread: { ...p.unread }, archived: { ...p.archived } });

/** Returns false, and changes nothing, when three other chats are already pinned. */
export function togglePin(k: string): boolean {
  const p = load();
  const n = copy(p);
  if (k in n.pinned) delete n.pinned[k];
  else if (canPin(p, k)) n.pinned[k] = Date.now();
  else return false;
  commit(n);
  return true;
}

export function toggleMute(k: string): void {
  const n = copy(load());
  if (k in n.muted) delete n.muted[k];
  else n.muted[k] = true;
  commit(n);
}

export function setUnread(k: string, on: boolean): void {
  const p = load();
  if (on === (k in p.unread)) return;
  const n = copy(p);
  if (on) n.unread[k] = true;
  else delete n.unread[k];
  commit(n);
}

export function archiveChat(k: string): void {
  const n = copy(load());
  n.archived[k] = Date.now();
  commit(n);
}

export function unarchiveChat(k: string): void {
  const p = load();
  if (!(k in p.archived)) return;
  const n = copy(p);
  delete n.archived[k];
  commit(n);
}

export function resetChatPrefs(): void {
  commit(emptyPrefs());
}

/** The settings of every chat. The caller draws again when any of them change. */
export function useChatPrefs(): ChatPrefs {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);
  return load();
}
