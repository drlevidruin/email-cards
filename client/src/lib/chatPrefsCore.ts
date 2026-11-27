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

/**
 * Settings saved on a sender's own address before the senders of one company became a single chat (`o:domain`) move to the company
 * key. A company chat that has settings of its own keeps them; its old address keys are cleared either way, so a later unpin or
 * unmute sticks. The company chat is pinned when any address was, muted or archived only when every sender address was (mail the
 * owner did not hide is never hidden). Returns null when nothing changed.
 */
export function adoptCompanyPrefs(p: ChatPrefs, chats: { key: string; company: boolean; addresses: string[] }[]): ChatPrefs | null {
  let n: ChatPrefs | null = null;
  const cur = () => (n ??= { pinned: { ...p.pinned }, muted: { ...p.muted }, unread: { ...p.unread }, archived: { ...p.archived } });
  for (const c of chats) {
    if (!c.company) continue;
    const addrs = [...new Set(c.addresses.map((a) => a.toLowerCase()).filter((a) => a !== '' && a !== c.key))];
    const touched = addrs.filter((a) => a in p.pinned || a in p.muted || a in p.unread || a in p.archived);
    if (touched.length === 0) continue;
    const own = c.key in p.pinned || c.key in p.muted || c.key in p.unread || c.key in p.archived;
    const out = cur();
    if (!own) {
      const pins = addrs.filter((a) => a in p.pinned).map((a) => p.pinned[a]);
      if (pins.length > 0) out.pinned[c.key] = Math.max(...pins);
      if (addrs.every((a) => a in p.muted)) out.muted[c.key] = true;
      if (addrs.every((a) => a in p.archived)) out.archived[c.key] = Math.min(...addrs.map((a) => p.archived[a]));
      if (addrs.some((a) => a in p.unread)) out.unread[c.key] = true;
    }
    for (const a of touched) {
      delete out.pinned[a];
      delete out.muted[a];
      delete out.unread[a];
      delete out.archived[a];
    }
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
