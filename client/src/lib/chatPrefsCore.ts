/** Settings kept for each chat, by chat key. Numbers are times in ms. */
export interface ChatPrefs {
  pinned: Record<string, number>;
  muted: Record<string, true>;
  unread: Record<string, true>;
  archived: Record<string, number>;
}

export const MAX_PINS = 3;

export function emptyPrefs(): ChatPrefs {
  return { pinned: {}, muted: {}, unread: {}, archived: {} };
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Reads saved settings. Never throws: anything damaged becomes empty, or is skipped entry by entry. */
export function parsePrefs(raw: unknown): ChatPrefs {
  const out = emptyPrefs();
  if (!isObj(raw)) return out;
  for (const field of ['pinned', 'archived'] as const) {
    const src = raw[field];
    if (!isObj(src)) continue;
    for (const [k, v] of Object.entries(src)) if (typeof v === 'number' && Number.isFinite(v)) out[field][k] = v;
  }
  for (const field of ['muted', 'unread'] as const) {
    const src = raw[field];
    if (!isObj(src)) continue;
    for (const [k, v] of Object.entries(src)) if (v === true) out[field][k] = true;
  }
  return out;
}

/** Archived until a newer email arrives. */
export function isArchived(p: ChatPrefs, key: string, lastAt: string): boolean {
  const at = p.archived[key];
  if (typeof at !== 'number') return false;
  const last = Date.parse(lastAt);
  return Number.isNaN(last) ? true : at >= last;
}

/** `listed` is the keys of the chats in the current list: a pin on a key that is not there (an old key, a hidden chat) does not count. Without it every pin counts. */
export function canPin(p: ChatPrefs, key: string, listed?: Iterable<string>): boolean {
  if (key in p.pinned) return true;
  const shown = listed ? new Set(listed) : null;
  return Object.keys(p.pinned).filter((k) => k !== key && (!shown || shown.has(k))).length < MAX_PINS;
}

/** A chat's email moved to a new key and nothing is left on the old one: its pin and mute follow. Never overwrites settings already on the new key. When a chat already has the new key (`toExists`), the mute is dropped, not moved, so that chat is not muted by a move. */
export function movePrefs(p: ChatPrefs, from: string, to: string, toExists = false): ChatPrefs {
  if (from === to) return p;
  const n: ChatPrefs = { pinned: { ...p.pinned }, muted: { ...p.muted }, unread: { ...p.unread }, archived: { ...p.archived } };
  if (from in n.pinned) {
    if (!(to in n.pinned)) n.pinned[to] = n.pinned[from];
    delete n.pinned[from];
  }
  if (from in n.muted) {
    if (!toExists) n.muted[to] = true;
    delete n.muted[from];
  }
  return n;
}

/** Pinned chats first (the one pinned last on top), then the rest, newest first. */
export function sortChats<T extends { key: string; lastAt: string }>(chats: T[], p: ChatPrefs): T[] {
  const t = (c: T) => {
    const n = Date.parse(c.lastAt);
    return Number.isNaN(n) ? 0 : n;
  };
  const pinned = chats.filter((c) => c.key in p.pinned).sort((a, b) => p.pinned[b.key] - p.pinned[a.key]);
  const rest = chats.filter((c) => !(c.key in p.pinned)).sort((a, b) => t(b) - t(a));
  return [...pinned, ...rest];
}
