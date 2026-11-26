import type { EmailThread } from './types';
import { api } from './api';

const cache = new Map<string, Promise<EmailThread>>();

export function loadThread(id: string): Promise<EmailThread> {
  let p = cache.get(id);
  if (!p) {
    p = api.getThread(id).then((r) => r.thread);
    p.catch(() => cache.delete(id));
    cache.set(id, p);
  }
  return p;
}

export function clearThreadCache() {
  cache.clear();
}
