import type {
  ActionProposal,
  AgentChatMessage,
  AgentChatRequest,
  AgentRule,
  AppSettings,
  BriefingData,
  BulkActionType,
  CommitmentItem,
  ConstellationGraph,
  ConstellationLink,
  ConstellationNode,
  CustomView,
  DraftItem,
  DraftReplyRequest,
  DraftTone,
  EmailMessage,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  NlFilterRequest,
  NlFilterResponse,
  PriorityBucket,
  ScreenerSender,
  ShabbosStatus,
  SummarizeThreadResponse,
  TestKeyRequest,
  TestKeyResponse,
  BootstrapPayload,
  ThreadDetailPayload,
} from './types';
import { buildDemoDataset } from './staticDemoData';

const STORAGE_KEY = 'email_cards_static_demo_v1';

interface UndoRecord {
  id: string;
  threads: EmailThread[];
  screener: ScreenerSender[];
}

interface DemoStore {
  accounts: GmailAccount[];
  threads: EmailThread[];
  messages: EmailMessage[];
  commitments: CommitmentItem[];
  screener: ScreenerSender[];
  tasks: ExtractedTask[];
  drafts: DraftItem[];
  rules: AgentRule[];
  customViews: CustomView[];
  settings: AppSettings;
  undoLog: Record<string, UndoRecord>;
  proposals: Record<string, ActionProposal & { undoId?: string }>;
}

function deepClone<T>(val: T): T {
  return JSON.parse(JSON.stringify(val)) as T;
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function computeShabbosStatus(
  enabled: boolean,
  timezone: string,
  drafts: DraftItem[],
  now = new Date()
): ShabbosStatus {
  const heldCount = drafts.filter((d) => d.status === 'held_shabbos').length;
  const day = now.getDay(); // 0=Sun ... 5=Fri, 6=Sat
  const hour = now.getHours() + now.getMinutes() / 60;

  const isRestricted = enabled && ((day === 5 && hour >= 18) || (day === 6 && hour < 20.5));

  // Next Friday 6:00 PM -> Saturday 8:30 PM
  const start = new Date(now);
  const daysToFri = (5 - day + 7) % 7;
  if (day === 5 && hour >= 18) {
    start.setHours(18, 0, 0, 0);
  } else if (day === 6 && hour < 20.5) {
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0);
  } else {
    start.setDate(start.getDate() + (daysToFri === 0 ? 7 : daysToFri));
    start.setHours(18, 0, 0, 0);
  }

  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  end.setHours(20, 30, 0, 0);

  return {
    enabled,
    isCurrentlyRestricted: isRestricted,
    nextWindowStart: start.toISOString(),
    nextWindowEnd: end.toISOString(),
    timezone,
    heldCount,
    reason: isRestricted ? 'Shabbos' : undefined,
  };
}

function recomputeUnreadCounts(store: DemoStore): void {
  for (const acc of store.accounts) {
    acc.unreadCount = store.threads.filter(
      (t) => t.accountId === acc.id && t.isUnread && !t.isArchived
    ).length;
  }
}

function createFreshStore(): DemoStore {
  const data = buildDemoDataset();
  const store: DemoStore = {
    accounts: data.accounts,
    threads: data.threads,
    messages: data.messages,
    commitments: data.commitments,
    screener: data.screener,
    tasks: data.tasks,
    drafts: data.drafts,
    rules: data.rules,
    customViews: data.customViews,
    settings: {
      anthropicApiKeyConfigured: false,
      claudeModel: 'claude-sonnet-4-20250514',
      googleOAuthConfigured: false,
      shabbosGuardEnabled: true,
      shabbosTimezone: 'America/New_York',
      demoMode: true,
      theme: 'light',
    },
    undoLog: {},
    proposals: {},
  };
  recomputeUnreadCounts(store);
  return store;
}

let cachedStore: DemoStore | null = null;

function loadStore(): DemoStore {
  if (cachedStore) return cachedStore;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoStore;
      if (parsed && Array.isArray(parsed.accounts) && Array.isArray(parsed.threads)) {
        parsed.settings = {
          ...parsed.settings,
          theme: 'light',
        };
        parsed.undoLog = parsed.undoLog || {};
        parsed.proposals = parsed.proposals || {};
        recomputeUnreadCounts(parsed);
        cachedStore = parsed;
        return cachedStore;
      }
    }
  } catch {
    // Fallback to fresh demo store if localStorage is unavailable
  }
  cachedStore = createFreshStore();
  saveStore(cachedStore);
  return cachedStore;
}

function saveStore(store: DemoStore): void {
  recomputeUnreadCounts(store);
  cachedStore = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Ignore storage quota issues in private browsing
  }
}

function saveUndoSnapshot(store: DemoStore, threadIds: string[], screenerEmails: string[] = []): string {
  const undoId = uid('undo');
  const idSet = new Set(threadIds);
  const emailSet = new Set(screenerEmails.map((e) => e.toLowerCase()));
  store.undoLog[undoId] = {
    id: undoId,
    threads: deepClone(store.threads.filter((t) => idSet.has(t.id))),
    screener: deepClone(store.screener.filter((s) => emailSet.has(s.email.toLowerCase()))),
  };
  // Keep undo history bounded
  const keys = Object.keys(store.undoLog);
  if (keys.length > 35) {
    delete store.undoLog[keys[0]];
  }
  return undoId;
}

function restoreUndoSnapshot(store: DemoStore, undoId: string): number {
  const rec = store.undoLog[undoId];
  if (!rec) return 0;
  let restored = 0;
  for (const prev of rec.threads) {
    const idx = store.threads.findIndex((t) => t.id === prev.id);
    if (idx !== -1) {
      store.threads[idx] = deepClone(prev);
      restored += 1;
    }
  }
  for (const prevS of rec.screener) {
    const idx = store.screener.findIndex(
      (s) => s.email.toLowerCase() === prevS.email.toLowerCase()
    );
    if (idx !== -1) {
      store.screener[idx] = deepClone(prevS);
      restored += 1;
    }
  }
  delete store.undoLog[undoId];
  return restored;
}

function buildToneDraftBody(
  thread: EmailThread,
  tone: DraftTone,
  instruction?: string
): string {
  const sender =
    thread.participants.find((p) => p.email.toLowerCase() !== thread.accountEmail.toLowerCase())
      ?.name ||
    thread.participants[0]?.name ||
    'there';
  const firstName = sender.split(/\s+/)[0] || 'there';
  const ask = thread.distilledAsk || thread.snippet;

  if (instruction && instruction.trim()) {
    const note = instruction.trim();
    if (tone === 'executive') {
      return `Hi ${firstName},\n\n${note}.\n\nLet me know if anything else is needed to keep this moving.\n\nBest,\nAlex`;
    }
    if (tone === 'warm') {
      return `Hi ${firstName},\n\nThanks so much for sending this over. ${note}. Happy to coordinate further if helpful!\n\nWarmly,\nAlex`;
    }
    if (tone === 'decline') {
      return `Hi ${firstName},\n\nThank you for thinking of me. Unfortunately I have to pass for now (${note}), though I appreciate you reaching out.\n\nBest,\nAlex`;
    }
    return `Hi ${firstName},\n\nQuick reply on "${thread.subject}": ${note}.\n\nThanks,\nAlex`;
  }

  switch (tone) {
    case 'warm':
      return `Hi ${firstName},\n\nThanks so much for the clear update on "${thread.subject}". I reviewed everything on my side and we are good to move forward.\n\nLet me know what works best for next steps!\n\nWarmly,\nAlex`;
    case 'executive':
      return `Hi ${firstName},\n\nApproved on my end regarding ${ask.slice(0, 120)}${ask.length > 120 ? '...' : ''}\n\nPlease proceed and send over final confirmation.\n\nBest,\nAlex`;
    case 'decline':
      return `Hi ${firstName},\n\nThank you for reaching out about "${thread.subject}". My schedule and commitments are full right now, so I will need to pass on this one.\n\nWishing you all the best with it!\n\nBest,\nAlex`;
    case 'direct':
    default:
      return `Hi ${firstName},\n\nThanks for the note on "${thread.subject}". Confirmed on my end, please go ahead and lock next steps.\n\nBest,\nAlex`;
  }
}

function searchThreadsLocal(threads: EmailThread[], query: string, accountId?: string): EmailThread[] {
  const tokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s$@.-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !['the', 'and', 'for', 'all', 'with', 'show', 'find', 'emails', 'email', 'about', 'from'].includes(w));

  const scoped = threads.filter(
    (t) => !t.isArchived && (!accountId || accountId === 'all' || t.accountId === accountId)
  );

  if (tokens.length === 0) {
    return scoped.slice(0, 6);
  }

  const scored = scoped
    .map((t) => {
      const hay = [
        t.subject,
        t.snippet,
        t.distilledAsk || '',
        t.accountLabel,
        t.bucket,
        t.deadlineLabel || '',
        t.receiptInfo?.vendor || '',
        t.receiptInfo?.category || '',
        ...t.labels,
        ...t.participants.map((p) => `${p.name} ${p.email}`),
      ]
        .join(' ')
        .toLowerCase();
      let score = 0;
      for (const tok of tokens) {
        if (hay.includes(tok)) score += 2;
        if (t.subject.toLowerCase().includes(tok)) score += 3;
      }
      return { t, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.t.urgencyScore - a.t.urgencyScore);

  return scored.map((x) => x.t);
}

export const staticDemoApi = {
  health: async () => ({ ok: true }),

  bootstrap: async (): Promise<BootstrapPayload> => {
    const store = loadStore();
    return deepClone({
      accounts: store.accounts,
      threads: store.threads,
      commitments: store.commitments,
      screener: store.screener,
      tasks: store.tasks,
      drafts: store.drafts,
      rules: store.rules,
      customViews: store.customViews,
      settings: store.settings,
      shabbosStatus: computeShabbosStatus(
        store.settings.shabbosGuardEnabled,
        store.settings.shabbosTimezone,
        store.drafts
      ),
    });
  },

  getThreads: async (params?: { accountId?: string; bucket?: string; q?: string }): Promise<EmailThread[]> => {
    const store = loadStore();
    let list = store.threads;
    if (params?.accountId && params.accountId !== 'all') {
      list = list.filter((t) => t.accountId === params.accountId);
    }
    if (params?.bucket) {
      list = list.filter((t) => t.bucket === params.bucket);
    }
    if (params?.q) {
      list = searchThreadsLocal(list, params.q, params.accountId);
    }
    return deepClone(list);
  },

  getThread: async (id: string): Promise<ThreadDetailPayload> => {
    const store = loadStore();
    const found = store.threads.find((t) => t.id === id);
    if (!found) throw new Error('Thread not found');

    const msgs = store.messages
      .filter((m) => m.threadId === id)
      .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());

    const senderEmails = new Set(
      found.participants
        .map((p) => p.email.toLowerCase())
        .filter((e) => e !== found.accountEmail.toLowerCase())
    );
    const senderHistory = store.threads.filter(
      (other) =>
        other.id !== id &&
        other.participants.some((p) => senderEmails.has(p.email.toLowerCase()))
    );
    const relatedThreads = store.threads.filter((other) => found.relatedThreadIds.includes(other.id));
    const tasks = store.tasks.filter((tk) => tk.threadId === id);

    return deepClone({
      thread: { ...found, messages: msgs },
      senderHistory,
      relatedThreads,
      tasks,
    });
  },

  archiveThread: async (id: string) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    const undoId = saveUndoSnapshot(store, [id]);
    t.isArchived = true;
    t.bucket = 'archived';
    t.isUnread = false;
    saveStore(store);
    return { ok: true, undoId, thread: deepClone(t) };
  },

  unarchiveThread: async (id: string) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    t.isArchived = false;
    if (t.bucket === 'archived') t.bucket = 'decision';
    saveStore(store);
    return { ok: true, thread: deepClone(t) };
  },

  starThread: async (id: string, isStarred: boolean) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    t.isStarred = isStarred;
    saveStore(store);
    return { ok: true, thread: deepClone(t) };
  },

  markReadThread: async (id: string, isUnread: boolean) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    t.isUnread = isUnread;
    saveStore(store);
    return { ok: true, thread: deepClone(t) };
  },

  snoozeThread: async (id: string, until: string) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    const undoId = saveUndoSnapshot(store, [id]);
    t.isSnoozedUntil = until;
    t.bucket = 'waiting';
    saveStore(store);
    return { ok: true, undoId, thread: deepClone(t) };
  },

  moveThreadBucket: async (id: string, bucket: PriorityBucket) => {
    const store = loadStore();
    const t = store.threads.find((x) => x.id === id);
    if (!t) return { ok: false };
    t.bucket = bucket;
    t.isArchived = bucket === 'archived';
    saveStore(store);
    return { ok: true, thread: deepClone(t) };
  },

  bulkArchiveThreads: async (threadIds: string[]) => {
    const store = loadStore();
    const undoId = saveUndoSnapshot(store, threadIds);
    const set = new Set(threadIds);
    let count = 0;
    for (const t of store.threads) {
      if (set.has(t.id)) {
        t.isArchived = true;
        t.bucket = 'archived';
        t.isUnread = false;
        count += 1;
      }
    }
    saveStore(store);
    return { ok: true, undoId, count };
  },

  getAccounts: async () => deepClone(loadStore().accounts),

  connectImapAccount: async (payload: {
    email: string;
    appPassword: string;
    label: string;
    color: string;
    displayName?: string;
  }) => {
    const store = loadStore();
    const acc: GmailAccount = {
      id: uid('acc'),
      email: payload.email,
      displayName: payload.displayName || payload.label,
      label: payload.label,
      color: payload.color,
      provider: 'demo',
      status: 'demo',
      lastSyncedAt: new Date().toISOString(),
      unreadCount: 0,
      isDemo: true,
    };
    store.accounts.push(acc);
    saveStore(store);
    return {
      account: deepClone(acc),
      syncedCount: 0,
      message: 'Added locally in interactive demo mode. Run on Mac to sync live Gmail IMAP.',
    };
  },

  updateAccount: async (
    id: string,
    patch: Partial<Pick<GmailAccount, 'label' | 'color' | 'signature' | 'displayName'>>
  ) => {
    const store = loadStore();
    const acc = store.accounts.find((a) => a.id === id);
    if (!acc) throw new Error('Account not found');
    Object.assign(acc, patch);
    for (const t of store.threads) {
      if (t.accountId === id) {
        if (patch.label) t.accountLabel = patch.label;
        if (patch.color) t.accountColor = patch.color;
      }
    }
    saveStore(store);
    return { account: deepClone(acc), ...deepClone(acc) };
  },

  deleteAccount: async (id: string) => {
    const store = loadStore();
    store.accounts = store.accounts.filter((a) => a.id !== id);
    store.threads = store.threads.filter((t) => t.accountId !== id);
    saveStore(store);
    return { ok: true };
  },

  syncAccount: async (id: string) => {
    const store = loadStore();
    const acc = store.accounts.find((a) => a.id === id);
    if (acc) acc.lastSyncedAt = new Date().toISOString();
    saveStore(store);
    return { ok: true, syncedCount: 0, account: acc ? deepClone(acc) : undefined };
  },

  syncAllAccounts: async () => {
    const store = loadStore();
    const now = new Date().toISOString();
    for (const acc of store.accounts) acc.lastSyncedAt = now;
    saveStore(store);
    return { ok: true, syncedCount: 0, accounts: deepClone(store.accounts) };
  },

  getGoogleAuthUrl: async (): Promise<{ url?: string; configured?: boolean; error?: string }> => ({
    url: undefined,
    configured: false,
    error: 'Interactive Phone Demo mode: run Email Cards locally on Mac to connect live Google OAuth2.',
  }),

  getDrafts: async () => deepClone(loadStore().drafts),

  createDraft: async (payload: {
    threadId?: string | null;
    accountId: string;
    toEmails: string[];
    ccEmails?: string[];
    subject: string;
    bodyText: string;
    tone?: DraftItem['tone'];
    status?: DraftItem['status'];
    createdBy?: 'user' | 'agent';
  }): Promise<DraftItem> => {
    const store = loadStore();
    const draft: DraftItem = {
      id: uid('drf'),
      threadId: payload.threadId ?? null,
      accountId: payload.accountId,
      toEmails: payload.toEmails,
      ccEmails: payload.ccEmails || [],
      subject: payload.subject,
      bodyText: payload.bodyText,
      tone: payload.tone,
      status: payload.status || 'pending_approval',
      scheduledFor: null,
      createdBy: payload.createdBy || 'user',
      createdAt: new Date().toISOString(),
    };
    store.drafts.unshift(draft);
    saveStore(store);
    return deepClone(draft);
  },

  updateDraft: async (
    id: string,
    patch: Partial<
      Pick<DraftItem, 'toEmails' | 'ccEmails' | 'subject' | 'bodyText' | 'status' | 'scheduledFor' | 'accountId'>
    >
  ): Promise<DraftItem> => {
    const store = loadStore();
    const d = store.drafts.find((x) => x.id === id);
    if (!d) throw new Error('Draft not found');
    Object.assign(d, patch);
    saveStore(store);
    return deepClone(d);
  },

  deleteDraft: async (id: string) => {
    const store = loadStore();
    store.drafts = store.drafts.filter((d) => d.id !== id);
    saveStore(store);
    return { ok: true };
  },

  sendDraft: async (id: string, options?: { overrideShabbos?: boolean }) => {
    const store = loadStore();
    const d = store.drafts.find((x) => x.id === id);
    if (!d) throw new Error('Draft not found');

    const shabbos = computeShabbosStatus(
      store.settings.shabbosGuardEnabled,
      store.settings.shabbosTimezone,
      store.drafts
    );

    if (shabbos.isCurrentlyRestricted && !options?.overrideShabbos) {
      d.status = 'held_shabbos';
      d.scheduledFor = shabbos.nextWindowEnd;
      saveStore(store);
      return {
        ok: true,
        status: 'held_shabbos' as const,
        heldByShabbos: true,
        scheduledFor: shabbos.nextWindowEnd,
        draft: deepClone(d),
        message: 'Held by Shabbos Guard until Havdalah.',
      };
    }

    d.status = 'sent';
    if (d.threadId) {
      const thread = store.threads.find((t) => t.id === d.threadId);
      const acc = store.accounts.find((a) => a.id === d.accountId);
      if (thread && acc) {
        const msg: EmailMessage = {
          id: uid('msg'),
          threadId: thread.id,
          accountId: acc.id,
          fromName: acc.displayName,
          fromEmail: acc.email,
          toEmails: d.toEmails,
          ccEmails: d.ccEmails,
          subject: d.subject,
          snippet: d.bodyText.slice(0, 140),
          bodyText: d.bodyText,
          sentAt: new Date().toISOString(),
          isUnread: false,
          isOutbound: true,
          attachments: [],
        };
        store.messages.push(msg);
        thread.messageCount += 1;
        thread.lastMessageAt = msg.sentAt;
        thread.snippet = msg.snippet;
      }
    }
    saveStore(store);
    return { ok: true, status: 'sent' as const, heldByShabbos: false, draft: deepClone(d) };
  },

  decideScreener: async (email: string, decision: 'approved' | 'feed' | 'muted') => {
    const store = loadStore();
    const entry = store.screener.find((s) => s.email.toLowerCase() === email.toLowerCase());
    if (!entry) return { ok: false };
    const undoId = saveUndoSnapshot(store, entry.threadIds, [email]);
    entry.status = decision;
    for (const tid of entry.threadIds) {
      const t = store.threads.find((x) => x.id === tid);
      if (!t) continue;
      if (decision === 'approved') {
        t.bucket = 'decision';
        t.senderTrust = 'approved';
      } else if (decision === 'feed') {
        t.bucket = 'feed';
        t.senderTrust = 'feed';
      } else {
        t.bucket = 'archived';
        t.isArchived = true;
        t.senderTrust = 'muted';
      }
    }
    saveStore(store);
    return { ok: true, undoId };
  },

  updateTask: async (
    id: string,
    patch: Partial<Pick<ExtractedTask, 'completed' | 'title' | 'priority'>>
  ): Promise<ExtractedTask> => {
    const store = loadStore();
    const tk = store.tasks.find((x) => x.id === id);
    if (!tk) throw new Error('Task not found');
    Object.assign(tk, patch);
    saveStore(store);
    return deepClone(tk);
  },

  createTask: async (payload: {
    threadId: string;
    accountId: string;
    title: string;
    dueLabel?: string | null;
    priority?: 'high' | 'medium' | 'low';
  }): Promise<ExtractedTask> => {
    const store = loadStore();
    const tk: ExtractedTask = {
      id: uid('tsk'),
      threadId: payload.threadId,
      accountId: payload.accountId,
      title: payload.title,
      dueLabel: payload.dueLabel ?? null,
      completed: false,
      priority: payload.priority || 'medium',
    };
    store.tasks.push(tk);
    saveStore(store);
    return deepClone(tk);
  },

  resolveCommitment: async (id: string) => {
    const store = loadStore();
    const c = store.commitments.find((x) => x.id === id);
    if (c) c.status = 'resolved';
    saveStore(store);
    return { ok: true };
  },

  nudgeCommitment: async (id: string) => {
    const store = loadStore();
    const c = store.commitments.find((x) => x.id === id);
    if (!c) throw new Error('Commitment not found');
    c.status = 'nudged';
    const thread = store.threads.find((t) => t.id === c.threadId);
    const draft: DraftItem = {
      id: uid('drf'),
      threadId: c.threadId,
      accountId: c.accountId,
      toEmails: [c.counterpartyEmail],
      subject: thread ? `Re: ${thread.subject}` : `Following up: ${c.summary.slice(0, 48)}`,
      bodyText: c.suggestedNudgeDraft,
      tone: 'warm',
      status: 'pending_approval',
      scheduledFor: null,
      createdBy: 'agent',
      createdAt: new Date().toISOString(),
    };
    store.drafts.unshift(draft);
    saveStore(store);
    return { ok: true, draft: deepClone(draft) };
  },

  getSettings: async () => {
    const store = loadStore();
    return {
      settings: deepClone(store.settings),
      shabbosStatus: computeShabbosStatus(
        store.settings.shabbosGuardEnabled,
        store.settings.shabbosTimezone,
        store.drafts
      ),
      ...deepClone(store.settings),
    };
  },

  updateSettings: async (
    patch: Partial<{
      anthropicApiKey: string;
      claudeModel: string;
      googleClientId: string;
      googleClientSecret: string;
      shabbosGuardEnabled: boolean;
      shabbosTimezone: string;
      demoMode: boolean;
      theme: 'dark' | 'light';
    }>
  ) => {
    const store = loadStore();
    if (patch.claudeModel) store.settings.claudeModel = patch.claudeModel;
    if (typeof patch.shabbosGuardEnabled === 'boolean') {
      store.settings.shabbosGuardEnabled = patch.shabbosGuardEnabled;
    }
    if (patch.shabbosTimezone) store.settings.shabbosTimezone = patch.shabbosTimezone;
    if (typeof patch.demoMode === 'boolean') store.settings.demoMode = patch.demoMode;
    store.settings.theme = 'light';
    saveStore(store);
    return {
      settings: deepClone(store.settings),
      shabbosStatus: computeShabbosStatus(
        store.settings.shabbosGuardEnabled,
        store.settings.shabbosTimezone,
        store.drafts
      ),
      ...deepClone(store.settings),
    };
  },

  resetDemo: async () => {
    const fresh = createFreshStore();
    saveStore(fresh);
    return { ok: true };
  },

  toggleDemo: async (enabled: boolean) => {
    const store = loadStore();
    store.settings.demoMode = enabled;
    saveStore(store);
    return { ok: true, demoMode: enabled };
  },

  undo: async (undoId: string) => {
    const store = loadStore();
    const restoredCount = restoreUndoSnapshot(store, undoId);
    saveStore(store);
    return { ok: restoredCount > 0, restoredCount };
  },

  getBriefing: async (): Promise<BriefingData> => {
    const store = loadStore();
    const active = store.threads.filter((t) => !t.isArchived);
    const decisions = active
      .filter((t) => t.bucket === 'decision')
      .sort((a, b) => b.urgencyScore - a.urgencyScore);
    const openCommitments = store.commitments.filter((c) => c.status === 'open');
    const pendingScreener = store.screener.filter((s) => s.status === 'pending');

    return {
      greeting: 'Good day.',
      headline: `${decisions.length} priority cards need a quick decision across your 3 accounts.`,
      stats: {
        decisions: decisions.length,
        waitingOn: openCommitments.filter((c) => c.direction === 'waiting_on_them').length,
        youPromised: openCommitments.filter((c) => c.direction === 'you_promised').length,
        clearedNoise: active.filter((t) => t.bucket === 'feed' || t.bucket === 'paper_trail').length,
        totalUnread: active.filter((t) => t.isUnread).length,
        screenerPending: pendingScreener.length,
      },
      highlights: decisions.slice(0, 3).map((t) => ({
        threadId: t.id,
        title: t.subject,
        reason: t.distilledAsk || t.snippet,
        urgency: t.urgencyScore >= 85 ? 'high' : 'medium',
      })),
      generatedBy: 'local',
      generatedAt: new Date().toISOString(),
    };
  },

  agentChat: async (payload: AgentChatRequest): Promise<AgentChatMessage> => {
    const store = loadStore();
    const q = payload.message.trim();
    const lower = q.toLowerCase();
    const now = new Date().toISOString();

    const scoped = store.threads.filter(
      (t) =>
        !t.isArchived &&
        (!payload.selectedAccountId ||
          payload.selectedAccountId === 'all' ||
          t.accountId === payload.selectedAccountId)
    );

    // 1. Bulk cleanup / archive newsletters proposal (dry-run preview!)
    if (
      (lower.includes('archive') || lower.includes('clean') || lower.includes('sweep')) &&
      (lower.includes('newsletter') || lower.includes('feed') || lower.includes('promo') || lower.includes('noise'))
    ) {
      const targets = scoped.filter((t) => t.bucket === 'feed');
      if (targets.length === 0) {
        return {
          id: uid('chat'),
          role: 'assistant',
          content: 'Your newsletter feed is already completely clear.',
          timestamp: now,
        };
      }
      const proposal: ActionProposal = {
        id: uid('prop'),
        title: `Archive ${targets.length} Newsletter Cards`,
        description: 'Moves all unread and read newsletter items out of your active deck with one-click Undo.',
        actionType: 'archive',
        targetThreadIds: targets.map((t) => t.id),
        targetThreadsPreview: targets.slice(0, 6).map((t) => ({
          id: t.id,
          subject: t.subject,
          fromName: t.participants[0]?.name || t.accountLabel,
          accountLabel: t.accountLabel,
        })),
        status: 'pending',
      };
      store.proposals[proposal.id] = deepClone(proposal);
      saveStore(store);
      return {
        id: uid('chat'),
        role: 'assistant',
        content: `I prepared a safe dry-run preview to archive ${targets.length} newsletters across your accounts. Nothing has changed yet: click Execute below when ready.`,
        proposal,
        toolTrace: [{ tool: 'propose_bulk_action', summary: `Previewed ${targets.length} newsletters` }],
        timestamp: now,
      };
    }

    // 2. Draft reply to active thread
    if (payload.activeThreadId && (lower.includes('draft') || lower.includes('reply') || lower.includes('write'))) {
      const target = store.threads.find((t) => t.id === payload.activeThreadId);
      if (target) {
        const tone: DraftTone = lower.includes('warm')
          ? 'warm'
          : lower.includes('decline')
            ? 'decline'
            : lower.includes('exec')
              ? 'executive'
              : 'direct';
        const draft = await staticDemoApi.draftReply({
          threadId: target.id,
          tone,
          instruction: q,
        });
        return {
          id: uid('chat'),
          role: 'assistant',
          content: `I drafted a ${tone} reply to "${target.subject}" and placed it in your Drafts queue for review.`,
          createdDraft: draft,
          citations: [{ threadId: target.id, subject: target.subject, accountLabel: target.accountLabel }],
          toolTrace: [{ tool: 'draft_reply', summary: `Queued ${tone} draft` }],
          timestamp: now,
        };
      }
    }

    // 3. Summarize focused thread
    if (payload.activeThreadId && (lower.includes('summarize') || lower.includes('need') || lower.includes('this thread') || lower.includes('this email'))) {
      const target = store.threads.find((t) => t.id === payload.activeThreadId);
      if (target) {
        const bullets = target.aiSummaryBullets.map((b) => `- ${b}`).join('\n');
        return {
          id: uid('chat'),
          role: 'assistant',
          content: `Here is the summary for "${target.subject}":\n\nWhat they need: ${target.distilledAsk || target.snippet}\n${bullets ? `\nKey points:\n${bullets}` : ''}${target.deadlineLabel ? `\n\nTiming: ${target.deadlineLabel}` : ''}`,
          citations: [{ threadId: target.id, subject: target.subject, accountLabel: target.accountLabel }],
          timestamp: now,
        };
      }
    }

    // 4. Receipts & spend summary
    if (lower.includes('receipt') || lower.includes('spend') || lower.includes('invoice') || lower.includes('money') || lower.includes('total')) {
      const receipts = scoped.filter((t) => Boolean(t.receiptInfo));
      const total = receipts.reduce((sum, t) => sum + (t.receiptInfo?.amount || 0), 0);
      const topLines = receipts
        .sort((a, b) => (b.receiptInfo?.amount || 0) - (a.receiptInfo?.amount || 0))
        .slice(0, 5)
        .map(
          (t) =>
            `- ${t.receiptInfo!.vendor} (${t.accountLabel}): $${t.receiptInfo!.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
        )
        .join('\n');
      return {
        id: uid('chat'),
        role: 'assistant',
        content: `Tracked ${receipts.length} receipts totaling $${total.toLocaleString('en-US', { minimumFractionDigits: 2 })} across your accounts:\n\n${topLines}`,
        citations: receipts.slice(0, 5).map((t) => ({
          threadId: t.id,
          subject: t.subject,
          accountLabel: t.accountLabel,
        })),
        toolTrace: [{ tool: 'search_and_filter_threads', summary: `Scanned ${receipts.length} receipts` }],
        timestamp: now,
      };
    }

    // 5. Priorities / deadlines / open asks
    if (lower.includes('priorit') || lower.includes('deadline') || lower.includes('ask') || lower.includes('urgent') || lower.includes('today')) {
      const top = scoped
        .filter((t) => t.bucket === 'decision')
        .sort((a, b) => b.urgencyScore - a.urgencyScore)
        .slice(0, 5);
      const lines = top
        .map(
          (t, i) =>
            `${i + 1}. ${t.subject} (${t.deadlineLabel || 'Priority'})\n   ${t.distilledAsk || t.snippet}`
        )
        .join('\n\n');
      return {
        id: uid('chat'),
        role: 'assistant',
        content:
          top.length > 0
            ? `Here are your top ${top.length} priority cards right now:\n\n${lines}`
            : 'All priority decision cards are cleared!',
        citations: top.map((t) => ({
          threadId: t.id,
          subject: t.subject,
          accountLabel: t.accountLabel,
        })),
        toolTrace: [{ tool: 'search_and_filter_threads', summary: `Ranked ${top.length} decisions` }],
        timestamp: now,
      };
    }

    // 6. General search
    const matches = searchThreadsLocal(store.threads, q, payload.selectedAccountId).slice(0, 5);
    return {
      id: uid('chat'),
      role: 'assistant',
      content:
        matches.length > 0
          ? `Found ${matches.length} relevant emails across your merged accounts:\n\n${matches
              .map((t) => `- ${t.subject} (${t.accountLabel}): ${t.distilledAsk || t.snippet}`)
              .join('\n')}`
          : `No direct matches for "${q}" in the demo deck. Try asking about your top priorities, receipts, or archiving newsletters.`,
      citations: matches.map((t) => ({
        threadId: t.id,
        subject: t.subject,
        accountLabel: t.accountLabel,
      })),
      toolTrace: [{ tool: 'search_and_filter_threads', summary: `Matched ${matches.length} emails` }],
      timestamp: now,
    };
  },

  draftReply: async (payload: DraftReplyRequest): Promise<DraftItem> => {
    const store = loadStore();
    const thread = store.threads.find((t) => t.id === payload.threadId);
    if (!thread) throw new Error('Thread not found');
    const tone: DraftTone = payload.tone || 'direct';
    const recipient =
      thread.participants.find((p) => p.email.toLowerCase() !== thread.accountEmail.toLowerCase())
        ?.email ||
      thread.participants[0]?.email ||
      '';

    const draft: DraftItem = {
      id: uid('drf'),
      threadId: thread.id,
      accountId: thread.accountId,
      toEmails: recipient ? [recipient] : [],
      subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
      bodyText: buildToneDraftBody(thread, tone, payload.instruction),
      tone,
      status: 'pending_approval',
      scheduledFor: null,
      createdBy: 'agent',
      createdAt: new Date().toISOString(),
    };
    store.drafts.unshift(draft);
    saveStore(store);
    return deepClone(draft);
  },

  summarizeThread: async (threadId: string): Promise<SummarizeThreadResponse> => {
    const store = loadStore();
    const thread = store.threads.find((t) => t.id === threadId);
    if (!thread) throw new Error('Thread not found');
    const tasks = store.tasks.filter((tk) => tk.threadId === threadId);
    return deepClone({
      threadId,
      distilledAsk: thread.distilledAsk || thread.snippet,
      aiSummaryBullets:
        thread.aiSummaryBullets.length > 0 ? thread.aiSummaryBullets : [thread.snippet],
      extractedTasks: tasks,
      generatedBy: 'local',
    });
  },

  nlFilter: async (payload: NlFilterRequest): Promise<NlFilterResponse> => {
    const store = loadStore();
    const matches = searchThreadsLocal(store.threads, payload.query, payload.accountId);
    return {
      threadIds: matches.map((t) => t.id),
      explanation: `Matched ${matches.length} emails for "${payload.query}".`,
      generatedBy: 'local',
    };
  },

  getConstellation: async (accountId = 'all'): Promise<ConstellationGraph> => {
    const store = loadStore();
    const active = store.threads.filter(
      (t) => !t.isArchived && (accountId === 'all' || t.accountId === accountId)
    );
    const nodes: ConstellationNode[] = active.map((t, i) => ({
      threadId: t.id,
      accountId: t.accountId,
      accountColor: t.accountColor,
      accountLabel: t.accountLabel,
      subject: t.subject,
      fromName: t.participants[0]?.name || t.accountLabel,
      distilledAsk: t.distilledAsk,
      bucket: t.bucket,
      urgencyScore: t.urgencyScore,
      isUnread: t.isUnread,
      messageCount: t.messageCount,
      lastMessageAt: t.lastMessageAt,
      ring: t.bucket === 'decision' ? 'core' : t.bucket === 'waiting' ? 'orbit' : t.bucket === 'paper_trail' ? 'outer' : 'perimeter',
      angle: (i / Math.max(active.length, 1)) * Math.PI * 2,
      radius: t.bucket === 'decision' ? 80 : t.bucket === 'waiting' ? 160 : 250,
      tags: t.labels,
    }));
    const links: ConstellationLink[] = [];
    return { nodes, links };
  },

  executeProposal: async (proposalId: string) => {
    const store = loadStore();
    const prop = store.proposals[proposalId];
    if (!prop) throw new Error('Proposal not found');
    const undoId = saveUndoSnapshot(store, prop.targetThreadIds);
    const set = new Set(prop.targetThreadIds);
    const actionType: BulkActionType = prop.actionType;
    for (const t of store.threads) {
      if (!set.has(t.id)) continue;
      if (actionType === 'archive') {
        t.isArchived = true;
        t.bucket = 'archived';
        t.isUnread = false;
      } else if (actionType === 'mark_read') {
        t.isUnread = false;
      }
    }
    prop.status = 'executed';
    prop.undoId = undoId;
    saveStore(store);
    return { ok: true, undoId, proposal: deepClone(prop) };
  },

  undoProposal: async (proposalId: string) => {
    const store = loadStore();
    const prop = store.proposals[proposalId];
    if (!prop) throw new Error('Proposal not found');
    if (prop.undoId) {
      restoreUndoSnapshot(store, prop.undoId);
    }
    prop.status = 'undone';
    saveStore(store);
    return { ok: true, proposal: deepClone(prop) };
  },

  getRules: async () => deepClone(loadStore().rules),

  createRule: async (payload: { name: string; naturalLanguage: string }): Promise<AgentRule> => {
    const store = loadStore();
    const rule: AgentRule = {
      id: uid('rule'),
      name: payload.name,
      naturalLanguage: payload.naturalLanguage,
      enabled: true,
      matchCount: 0,
      createdAt: new Date().toISOString(),
    };
    store.rules.unshift(rule);
    saveStore(store);
    return deepClone(rule);
  },

  updateRule: async (
    id: string,
    patch: Partial<Pick<AgentRule, 'name' | 'naturalLanguage' | 'enabled'>>
  ): Promise<AgentRule> => {
    const store = loadStore();
    const r = store.rules.find((x) => x.id === id);
    if (!r) throw new Error('Rule not found');
    Object.assign(r, patch);
    saveStore(store);
    return deepClone(r);
  },

  deleteRule: async (id: string) => {
    const store = loadStore();
    store.rules = store.rules.filter((r) => r.id !== id);
    saveStore(store);
    return { ok: true };
  },

  testClaudeKey: async (payload: TestKeyRequest): Promise<TestKeyResponse> => ({
    ok: false,
    message:
      'Interactive Phone Demo mode runs locally in your browser without sending API keys. Run Email Cards locally on your Mac to connect your Anthropic key.',
    model: payload.model || 'claude-sonnet-4-20250514',
  }),
};
