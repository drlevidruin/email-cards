import { useCallback, useMemo, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import { api } from './lib/api';
import { sentToast } from './lib/snapshot';
import { logMoves, logUndone } from './lib/progress';
import type { EmailThread, ScreenerSender } from './lib/types';
import type { StackId } from './lib/stacks';
import type { CountKey, Data, Exiting, Session, Snap, UndoEntry } from './storeTypes';

/** What the finish card calls each move. */
const KIND: Record<CountKey, string> = { replied: 'Done', done: 'Done', later: 'Later', bookmarked: 'To-do', blocked: 'Blocked', allowed: 'Allowed', moved: 'Moved' };

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
  /** Promises this action resolves; a failed save puts them back. */
  commitmentIds?: string[];
  /** Extra steps for Undo, after the thread itself is restored. */
  afterUndo?: () => Promise<unknown>;
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
        const next = fn({ threads: d.threads, screener: d.screener, commitments: d.commitments });
        return { ...d, threads: next.threads, screener: next.screener, commitments: next.commitments };
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
        logMoves(spec.ids.map((id) => ({ id, stack, account: accountOf(id), kind: KIND[spec.count] })));
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
            if (spec.afterUndo) await spec.afterUndo();
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
        const wasPromise = (id: string) => prev.commitments.find((x) => x.id === id);
        const promises = spec.commitmentIds ?? [];
        setData((d) =>
          d && {
            ...d,
            threads: d.threads.map((x) => (spec.ids.includes(x.id) ? was(x.id) ?? x : x)),
            screener: d.screener.map((x) => (spec.ids.includes(x.email) ? wasSender(x.email) ?? x : x)),
            commitments: d.commitments.map((x) => (promises.includes(x.id) ? wasPromise(x.id) ?? x : x)),
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

  /** Done also clears the thread from To-do: unstar it, resolve its open promises, archive it. Undo brings all of it back. */
  const done = useCallback(
    (t: EmailThread, stack: StackId | null) => {
      const promises = (dataRef.current?.commitments ?? [])
        .filter((c) => c.threadId === t.id && c.direction === 'you_promised' && c.status !== 'resolved')
        .map((c) => c.id);
      const starred = t.isStarred;
      return commit({
        stack,
        ids: [t.id],
        count: 'done',
        commitmentIds: promises,
        local: (s) => ({
          ...s,
          threads: s.threads.map((x) => (x.id === t.id ? { ...x, isArchived: true, isStarred: false, bucket: 'archived' } : x)),
          commitments: s.commitments.map((c) => (promises.includes(c.id) ? { ...c, status: 'resolved' } : c)),
        }),
        call: async () => {
          const res = await api.archiveThread(t.id);
          if (starred) await api.starThread(t.id, false);
          for (const id of promises) await api.resolveCommitment(id);
          return res;
        },
        toast: 'Done',
        undoFallback: async () => {
          await api.unarchiveThread(t.id);
          if (starred) await api.starThread(t.id, true);
        },
        afterUndo: async () => {
          for (const id of promises) await api.reopenCommitment(id);
        },
      });
    },
    [commit, dataRef]
  );

  const bookmark = useCallback(
    (t: EmailThread, stack: StackId | null, on: boolean) =>
      commit({
        stack,
        ids: [t.id],
        count: on ? 'bookmarked' : 'done',
        local: (s) => ({ ...s, threads: s.threads.map((x) => (x.id === t.id ? { ...x, isStarred: on } : x)) }),
        call: () => api.starThread(t.id, on),
        toast: on ? 'Moved to To-do' : 'Removed from To-do',
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
        toast: `Later: ${when}`,
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
        // The sender's threads move with the decision, the same as the API does, so every pile and count follows at once
        local: (x) => ({
          ...x,
          screener: x.screener.map((y) => (y.email === s.email ? { ...y, status } : y)),
          threads: x.threads.map((t) => {
            if (!s.threadIds.includes(t.id)) return t;
            if (d === 'approved') return { ...t, bucket: 'decision', senderTrust: 'approved' };
            if (d === 'feed') return { ...t, bucket: 'feed', senderTrust: 'feed' };
            return { ...t, bucket: 'archived', isArchived: true, senderTrust: 'muted' };
          }),
        }),
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
        logMoves([{ id: t.id, stack: lastStack, account: t.accountId, reply: true, kind: 'Done' }]);
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
