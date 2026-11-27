import { useEffect, useState } from 'react';
import { isSnapshot } from './snapshot';
import type { Recipients } from './recipients';

/** Unsent text, and who it was meant for, kept for each chat. Saved in the browser; in a snapshot it lives in memory only. */
const STORE = 'email_cards_chat_drafts_v1';

export interface Draft { text: string; rec?: Recipients; threadId?: string; lastId?: string }

let cache: Record<string, Draft> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, Draft> {
  if (cache) return cache;
  cache = {};
  // A snapshot reads nothing from storage: its drafts start empty
  if (isSnapshot()) return cache;
  try {
    const raw = window.localStorage.getItem(STORE);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        // An older version saved a plain string
        if (typeof v === 'string') {
          if (v.trim()) cache[k] = { text: v };
        } else if (v && typeof v === 'object') {
          const o = v as Record<string, unknown>;
          if (typeof o.text === 'string' && o.text.trim()) {
            const d: Draft = { text: o.text };
            if (o.rec && typeof o.rec === 'object') d.rec = o.rec as Recipients;
            if (typeof o.threadId === 'string') d.threadId = o.threadId;
            if (typeof o.lastId === 'string') d.lastId = o.lastId;
            cache[k] = d;
          }
        }
      }
    }
  } catch {
    // Storage is blocked or the saved text is damaged: start empty
  }
  return cache;
}

export function getDraft(key: string): Draft | undefined {
  return load()[key];
}

export function setDraft(key: string, draft: Draft): void {
  const all = load();
  const had = key in all;
  if (!draft.text.trim()) {
    if (!had) return;
    delete all[key];
  } else {
    if (had && JSON.stringify(all[key]) === JSON.stringify(draft)) return;
    all[key] = draft;
  }
  cache = { ...all };
  if (!isSnapshot()) {
    try {
      window.localStorage.setItem(STORE, JSON.stringify(cache));
    } catch {
      // Not saved: the text still lives for this visit
    }
  }
  listeners.forEach((l) => l());
}

/** Forgets every unsent text, in memory and in storage. */
export function resetChatDrafts(): void {
  cache = {};
  if (!isSnapshot()) {
    try {
      window.localStorage.removeItem(STORE);
    } catch {
      // Storage is blocked: the memory copy is already empty
    }
  }
  listeners.forEach((l) => l());
}

/** Every draft by chat key. The caller draws again when any draft changes. */
export function useDrafts(): Record<string, Draft> {
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
