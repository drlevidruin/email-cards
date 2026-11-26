import type { EmailThread } from './types';
import { api } from './api';

const cache = new Map<string, Promise<EmailThread>>();
const loaded = new Map<string, EmailThread>();

export function loadThread(id: string): Promise<EmailThread> {
  let p = cache.get(id);
  if (!p) {
    p = api.getThread(id).then((r) => {
      loaded.set(id, r.thread);
      return r.thread;
    });
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

/** The thread if it has already loaded, so a card can render its full email on the first paint. */
export function peekThread(id: string): EmailThread | undefined {
  return loaded.get(id);
}

export function clearThreadCache() {
  cache.clear();
  loaded.clear();
}

/** After a reload, keep every cached thread that is unchanged and drop the ones that are gone or have a new message. */
export function pruneThreadCache(fresh: { id: string; messageCount: number; lastMessageAt: string }[]) {
  const now = new Map(fresh.map((t) => [t.id, t]));
  for (const id of [...cache.keys()]) {
    const t = now.get(id);
    const have = loaded.get(id);
    if (!t || (have && (have.messageCount !== t.messageCount || have.lastMessageAt !== t.lastMessageAt))) {
      cache.delete(id);
      loaded.delete(id);
    }
  }
}
