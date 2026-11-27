import { useEffect, useState } from 'react';
import type { EmailThread } from './types';
import { loadThread, peekThread } from './threadCache';

const newest = (threads: EmailThread[], cap: number) => [...threads].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()).slice(0, cap);

/** Loads the full thread (with its messages) for the newest `cap` of these, whatever order the list is in, and re-renders as they arrive. Returns how many have loaded, so a memo can depend on it. */
export function useLoadedCount(threads: EmailThread[], cap = 80): number {
  const [n, setN] = useState(0);
  const sig = newest(threads, cap).map((t) => `${t.id}:${t.messageCount}:${t.lastMessageAt}`).join('|');
  useEffect(() => {
    let live = true;
    const todo = newest(threads, cap).filter((t) => !peekThread(t.id));
    if (todo.length === 0) {
      setN((x) => x + 1);
      return;
    }
    let left = todo.length;
    const step = () => {
      if (live && --left <= 0) setN((x) => x + 1);
    };
    for (const t of todo) loadThread(t.id).then(step, step);
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);
  return n;
}

/** The full thread if loaded, else the summary. */
export const fullOf = (t: EmailThread): EmailThread => peekThread(t.id) ?? t;
