import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { api } from './lib/api';
import type { AgentChatMessage, EmailThread, ScreenerSender } from './lib/types';
import type { StackId } from './lib/stacks';
import { pruneThreadCache } from './lib/threadCache';
import { logUndone, resetToday, seedSample } from './lib/progress';
import { resetOnboarding } from './lib/onboarding';
import { LIVE_SYNC_EVENT } from './lib/liveMode';
import { NOT_SAVED, useCardActions } from './storeActions';
import { TOAST_MS, type CountKey, type Data, type Exiting, type Session, type Toast, type UndoEntry } from './storeTypes';

export type { CountKey, Data, Session, Toast };

interface Store {
  status: 'loading' | 'error' | 'ready';
  data: Data | null;
  account: string;
  setAccount: (id: string) => void;
  reload: () => Promise<void>;
  refresh: () => Promise<void>;
  resetSessions: () => void;
  lastStack: StackId;
  setLastStack: (s: StackId) => void;
  session: (stack: StackId) => Session;
  exiting: Exiting | null;
  clearExiting: () => void;
  toast: Toast | null;
  showToast: (text: string) => void;
  dismissToast: () => void;
  canUndo: boolean;
  undo: () => Promise<void>;
  done: (t: EmailThread, stack: StackId | null) => Promise<void>;
  bookmark: (t: EmailThread, stack: StackId | null, on: boolean) => Promise<void>;
  later: (t: EmailThread, stack: StackId | null, until: Date, when: string) => Promise<void>;
  decide: (s: ScreenerSender, stack: StackId, d: 'approved' | 'feed' | 'muted') => Promise<void>;
  archiveAll: (ts: EmailThread[], stack: StackId) => Promise<void>;
  markReplied: (t: EmailThread, name: string, held: boolean, fromDeck?: boolean, keepCard?: boolean) => void;
  patchThread: (id: string, patch: Partial<EmailThread>) => void;
  offerUndo: (text: string, run: () => Promise<unknown>) => void;
  patchData: (fn: (d: Data) => Data) => void;
  chat: AgentChatMessage[];
  setChat: Dispatch<SetStateAction<AgentChatMessage[]>>;
  touch: () => void;
}

const Ctx = createContext<Store | null>(null);
const ACCOUNT_KEY = 'email_cards_account';

function newSession(): Session {
  return {
    dismissed: new Set(),
    skipped: [],
    counts: { replied: 0, done: 0, later: 0, bookmarked: 0, blocked: 0, allowed: 0, moved: 0 },
    coverPending: null,
    todayDone: false,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Store['status']>('loading');
  const [data, setData] = useState<Data | null>(null);
  const [account, setAccountState] = useState(() => localStorage.getItem(ACCOUNT_KEY) || 'all');
  const [toast, setToast] = useState<Toast | null>(null);
  const [exiting, setExiting] = useState<Exiting | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [lastStack, setLastStack] = useState<StackId>('needs-you');
  const [chat, setChat] = useState<AgentChatMessage[]>([]);
  const [ver, setVer] = useState(0);
  const dataRef = useRef<Data | null>(null);
  const sessions = useRef(new Map<string, Session>());
  const undoRef = useRef<UndoEntry | null>(null);
  const accountRef = useRef(account);
  const toastId = useRef(0);
  accountRef.current = account;
  dataRef.current = data;
  const bump = useCallback(() => setVer((v) => v + 1), []);

  const load = useCallback(async (silent: boolean) => {
    if (!silent) setStatus('loading');
    try {
      const b = await api.bootstrap();
      pruneThreadCache(b.threads);
      setData({
        accounts: b.accounts,
        threads: b.threads,
        screener: b.screener,
        drafts: b.drafts,
        settings: b.settings,
        commitments: b.commitments,
        tasks: b.tasks,
        shabbosStatus: b.shabbosStatus,
      });
      setStatus('ready');
      if (accountRef.current !== 'all' && !b.accounts.some((a) => a.id === accountRef.current)) {
        setAccountState('all');
      }
    } catch {
      if (!silent) setStatus('error');
    }
  }, []);

  useEffect(() => {
    seedSample();
    void load(false);
  }, [load]);

  // Live mode: a sync changed the saved mail, so the list and an open email update without a reload
  useEffect(() => {
    const again = () => void load(true);
    window.addEventListener(LIVE_SYNC_EVENT, again);
    return () => window.removeEventListener(LIVE_SYNC_EVENT, again);
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    if (toast.sticky) {
      const leave = () => setToast((t) => (t && t.id === toast.id ? null : t));
      window.addEventListener('hashchange', leave);
      return () => window.removeEventListener('hashchange', leave);
    }
    const timer = window.setTimeout(() => setToast((t) => (t && t.id === toast.id ? null : t)), TOAST_MS);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setAccount = useCallback((id: string) => {
    localStorage.setItem(ACCOUNT_KEY, id);
    setAccountState(id);
  }, []);

  const session = useCallback((stack: StackId) => {
    const key = `${stack}|${accountRef.current}`;
    let s = sessions.current.get(key);
    if (!s) {
      s = newSession();
      sessions.current.set(key, s);
    }
    return s;
  }, []);

  const showToast = useCallback((text: string, undoable = false, sticky = false) => {
    toastId.current += 1;
    setToast({ id: toastId.current, text, undoable, sticky });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const actions = useCardActions({
    dataRef, accountRef, undoRef, session, setData, setCanUndo, setExiting, showToast, bump, lastStack,
  });

  const undo = useCallback(async () => {
    const entry = undoRef.current;
    if (!entry) return;
    undoRef.current = null;
    setCanUndo(false);
    setToast(null);
    try {
      await entry.run();
      await load(true);
      const sess = sessions.current.get(entry.sessionKey);
      if (sess) {
        entry.ids.forEach((id) => sess.dismissed.delete(id));
        sess.counts[entry.count] = Math.max(0, sess.counts[entry.count] - entry.n);
      }
      const undoneStack = entry.sessionKey.split('|')[0] as StackId;
      if (entry.sessionKey && entry.ids.length > 0) logUndone(undoneStack, entry.ids);
      bump();
    } catch {
      showToast(NOT_SAVED);
    }
  }, [load, showToast, bump]);

  const value = useMemo<Store>(
    () => ({
      status,
      data,
      account,
      setAccount,
      reload: () => load(false),
      refresh: () => load(true),
      resetSessions: () => {
        sessions.current.clear();
        resetToday();
        resetOnboarding();
        setChat([]);
        setExiting(null);
        undoRef.current = null;
        setCanUndo(false);
        setToast(null);
        bump();
      },
      lastStack,
      setLastStack,
      session,
      exiting,
      clearExiting: () => setExiting(null),
      toast,
      showToast: (text: string) => showToast(text),
      dismissToast,
      canUndo,
      undo,
      ...actions,
      patchData: (fn) => setData((d) => (d ? fn(d) : d)),
      chat,
      setChat,
      touch: bump,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, data, account, setAccount, load, lastStack, session, exiting, toast, showToast, canUndo, undo, dismissToast, actions, chat, bump, ver]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
