import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { api } from './lib/api';
import { sentToast } from './lib/snapshot';
import { logMoves, logUndone } from './lib/progress';
import type { EmailThread, ScreenerSender } from './lib/types';
import type { StackId } from './lib/stacks';
import type { CountKey, Data, Exiting, Session, Snap, UndoEntry } from './storeTypes';

export const NOT_SAVED = 'That did not save. Try again.';

interface CommitSpec {
  /** The deck the card came from; null when the action did not come from a deck. */
  stack: StackId | null;
  ids: string[];
  count: CountKey;
  local: (s: Snap) => Snap;
  call: () => Promise<unknown>;
  toast: string;
  undoFallback?: () => Promise<unknown>;
}

export interface Core {
  dataRef: MutableRefObject<Data | null>;
  accountRef: MutableRefObject<string>;
  undoRef: MutableRefObject<UndoEntry | null>;
  session: (stack: StackId) => Session;
  setData: Dispatch<SetStateAction<Data | null>>;
  setCanUndo: (v: boolean) => void;
  setExiting: (e: Exiting | null) => void;
  showToast: (text: string, undoable?: boolean) => void;
  bump: () => void;
  lastStack: StackId;
}

/** The card actions: each updates local state first, calls the API, and rolls back on failure. */
export function useCardActions(core: Core) {
  const { dataRef, accountRef, undoRef, session, setData, setCanUndo, setExiting, showToast, bump, lastStack } = core;

  const patchSnap = useCallback(
    (fn: (s: Snap) => Snap) => {
      setData((d) => {
        if (!d) return d;
        const next = fn({ threads: d.threads, screener: d.screener });
        return { ...d, threads: next.threads, screener: next.screener };
      });
    },
    [setData]
  );

  const commit = useCallback(
    async (spec: CommitSpec) => {
      const prev = dataRef.current;
      if (!prev) return;
      const key = spec.stack ? `${spec.stack}|${accountRef.current}` : '';
      const sess = spec.stack ? session(spec.stack) : null;
      const n = sess ? spec.ids.length : 0;
      if (sess) {
        spec.ids.forEach((id) => sess.dismissed.add(id));
        sess.counts[spec.count] += n;
      }
      if (spec.stack && n > 0) {
        const stack = spec.stack;
        const accountOf = (id: string) =>
          prev.threads.find((t) => t.id === id)?.accountId ?? prev.screener.find((x) => x.email === id)?.accountId ?? '';
        logMoves(spec.ids.map((id) => ({ id, stack, account: accountOf(id) })));
        // A short tap on the phones that have one; it does nothing on an iPhone
        if (['done', 'later', 'allowed', 'blocked'].includes(spec.count)) navigator.vibrate?.(8);
      }
      patchSnap(spec.local);
      bump();
      try {
        const res = await spec.call();
        // The demo API reports a missing thread as ok: false instead of throwing.
        if ((res as { ok?: boolean } | undefined)?.ok === false) throw new Error('not saved');
        const undoId = (res as { undoId?: string } | undefined)?.undoId;
        undoRef.current = {
          sessionKey: key,
          ids: sess ? spec.ids : [],
          count: spec.count,
          n,
          run: async () => {
            if (undoId) await api.undo(undoId);
            else if (spec.undoFallback) await spec.undoFallback();
          },
        };
        setCanUndo(true);
        showToast(spec.toast, true);
      } catch {
        if (sess) {
          spec.ids.forEach((id) => sess.dismissed.delete(id));
          sess.counts[spec.count] -= n;
          if (spec.stack) logUndone(spec.stack, spec.ids);
        }
        // Put back only what this action changed, so an action that saved in the meantime stays.
        const was = (id: string) => prev.threads.find((x) => x.id === id);
        const wasSender = (email: string) => prev.screener.find((x) => x.email === email);
        setData((d) =>
          d && {
            ...d,
            threads: d.threads.map((x) => (spec.ids.includes(x.id) ? was(x.id) ?? x : x)),
            screener: d.screener.map((x) => (spec.ids.includes(x.email) ? wasSender(x.email) ?? x : x)),
          }
        );
        bump();
        showToast(NOT_SAVED);
      }
    },
    [dataRef, accountRef, undoRef, session, patchSnap, bump, setCanUndo, setData, showToast]
  );

  /** Toast with an Undo that runs `run`, for actions that are not card moves. */
  const offerUndo = useCallback(
    (text: string, run: () => Promise<unknown>) => {
      undoRef.current = { sessionKey: '', ids: [], count: 'done', n: 0, run };
      setCanUndo(true);
      showToast(text, true);
    },
    [undoRef, setCanUndo, showToast]
  );

  const done = useCallback(
    (t: EmailThread, stack: StackId | null) =>
      commit({
        stack,
        ids: [t.id],
        count: 'done',
        local: (s) => ({ ...s, threads: s.threads.map((x) => (x.id === t.id ? { ...x, isArchived: true, bucket: 'archived' } : x)) }),
        call: () => api.archiveThread(t.id),
        toast: 'Marked done',
        undoFallback: () => api.unarchiveThread(t.id),
      }),
    [commit]
  );

  const bookmark = useCallback(
    (t: EmailThread, stack: StackId | null, on: boolean) =>
      commit({
        stack,
        ids: [t.id],
        count: on ? 'bookmarked' : 'done',
        local: (s) => ({ ...s, threads: s.threads.map((x) => (x.id === t.id ? { ...x, isStarred: on } : x)) }),
        call: () => api.starThread(t.id, on),
        toast: on ? 'Bookmarked' : 'Bookmark removed',
        undoFallback: () => api.starThread(t.id, !on),
      }),
    [commit]
  );

  const later = useCallback(
    (t: EmailThread, stack: StackId | null, until: Date, when: string) =>
      commit({
        stack,
        ids: [t.id],
        count: 'later',
        local: (s) => ({
          ...s,
          threads: s.threads.map((x) => (x.id === t.id ? { ...x, isSnoozedUntil: until.toISOString() } : x)),
        }),
        call: () => api.snoozeThread(t.id, until.toISOString()),
        toast: `Back ${when}`,
      }),
    [commit]
  );

  const decide = useCallback(
    (s: ScreenerSender, stack: StackId, d: 'approved' | 'feed' | 'muted') => {
      const status = d === 'muted' ? 'muted' : d === 'feed' ? 'feed' : 'approved';
      const toast = d === 'muted' ? `Blocked ${s.name}` : d === 'feed' ? `Moved ${s.name} to Newsletters` : `Allowed ${s.name}`;
      return commit({
        stack,
        ids: [s.email],
        count: d === 'muted' ? 'blocked' : d === 'feed' ? 'moved' : 'allowed',
        local: (x) => ({ ...x, screener: x.screener.map((y) => (y.email === s.email ? { ...y, status } : y)) }),
        call: () => api.decideScreener(s.email, d),
        toast,
      });
    },
    [commit]
  );

  const archiveAll = useCallback(
    (ts: EmailThread[], stack: StackId) => {
      const ids = ts.map((t) => t.id);
      return commit({
        stack,
        ids,
        count: 'done',
        local: (s) => ({
          ...s,
          threads: s.threads.map((x) => (ids.includes(x.id) ? { ...x, isArchived: true, bucket: 'archived' } : x)),
        }),
        call: () => api.bulkArchiveThreads(ids),
        toast: `Archived ${ids.length} ${stack === 'receipts' ? 'receipts' : 'newsletters'}`,
      });
    },
    [commit]
  );

  const markReplied = useCallback(
    (t: EmailThread, name: string, held: boolean, fromDeck = true, keepCard = false) => {
      if (fromDeck) {
        const sess = session(lastStack);
        sess.dismissed.add(t.id);
        sess.counts.replied += 1;
        logMoves([{ id: t.id, stack: lastStack, account: t.accountId, reply: true }]);
        patchSnap((s) => ({ ...s, threads: s.threads.map((x) => (x.id === t.id ? { ...x, isArchived: true, bucket: 'archived' } : x)) }));
        if (!keepCard) setExiting({ thread: t });
      }
      undoRef.current = null;
      setCanUndo(false);
      showToast(sentToast(held ? 'Held until after Shabbos' : `Sent to ${name}`));
    },
    [lastStack, patchSnap, session, showToast, setExiting, undoRef, setCanUndo]
  );

  const patchThread = useCallback(
    (id: string, patch: Partial<EmailThread>) =>
      patchSnap((s) => ({ ...s, threads: s.threads.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),
    [patchSnap]
  );

  return useMemo(
    () => ({ done, bookmark, later, decide, archiveAll, markReplied, patchThread, offerUndo }),
    [done, bookmark, later, decide, archiveAll, markReplied, patchThread, offerUndo]
  );
}
