import type {
  AgentChatMessage,
  AgentChatRequest,
  AgentRule,
  AppSettings,
  BriefingData,
  ConstellationGraph,
  DraftItem,
  DraftReplyRequest,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  NlFilterRequest,
  NlFilterResponse,
  PriorityBucket,
  ShabbosStatus,
  SummarizeThreadResponse,
  TestKeyRequest,
  TestKeyResponse,
  BootstrapPayload,
  ThreadDetailPayload,
} from './types';
import { staticDemoApi } from './staticDemoApi';

let staticDemoActive = import.meta.env.VITE_STATIC_DEMO === 'true';

export function isStaticDemoMode(): boolean {
  return staticDemoActive;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
    ...init,
  });

  const contentType = res.headers.get('content-type') || '';
  const text = await res.text();
  let data: unknown = null;
  if (text) {
    if (contentType.includes('application/json') || text.trim().startsWith('{') || text.trim().startsWith('[')) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { error: text };
      }
    } else {
      throw new Error('NON_JSON_RESPONSE');
    }
  }

  if (!res.ok) {
    let errMsg = `Request failed (${res.status})`;
    if (data && typeof data === 'object') {
      if ('error' in data && (data as { error: unknown }).error) {
        errMsg = String((data as { error: unknown }).error);
      } else if ('message' in data && (data as { message: unknown }).message) {
        errMsg = String((data as { message: unknown }).message);
      }
    }
    throw new Error(errMsg);
  }

  return data as T;
}

export const api = {
  // Health & Bootstrap
  health: () => (staticDemoActive ? staticDemoApi.health() : request<{ ok: boolean }>('/api/health')),

  bootstrap: async (): Promise<BootstrapPayload> => {
    if (staticDemoActive) return staticDemoApi.bootstrap();
    try {
      return await request<BootstrapPayload>('/api/bootstrap');
    } catch {
      staticDemoActive = true;
      return staticDemoApi.bootstrap();
    }
  },

  // Threads
  getThreads: (params?: { accountId?: string; bucket?: string; q?: string }) => {
    if (staticDemoActive) return staticDemoApi.getThreads(params);
    const sp = new URLSearchParams();
    if (params?.accountId && params.accountId !== 'all') sp.set('accountId', params.accountId);
    if (params?.bucket) sp.set('bucket', params.bucket);
    if (params?.q) sp.set('q', params.q);
    const qs = sp.toString();
    return request<EmailThread[]>(`/api/threads${qs ? `?${qs}` : ''}`);
  },

  getThread: async (id: string): Promise<ThreadDetailPayload> => {
    if (staticDemoActive) return staticDemoApi.getThread(id);
    const raw = await request<
      | ThreadDetailPayload
      | (EmailThread & {
          senderHistory?: EmailThread[];
          relatedThreads?: EmailThread[];
          tasks?: ExtractedTask[];
        })
    >(`/api/threads/${encodeURIComponent(id)}`);

    if ('thread' in raw && raw.thread) {
      return {
        thread: raw.thread,
        senderHistory: raw.senderHistory || [],
        relatedThreads: raw.relatedThreads || [],
        tasks: raw.tasks || [],
      };
    }
    const t = raw as EmailThread & {
      senderHistory?: EmailThread[];
      relatedThreads?: EmailThread[];
      tasks?: ExtractedTask[];
    };
    return {
      thread: t,
      senderHistory: t.senderHistory || [],
      relatedThreads: t.relatedThreads || [],
      tasks: t.tasks || [],
    };
  },

  archiveThread: (id: string) =>
    staticDemoActive
      ? staticDemoApi.archiveThread(id)
      : request<{ ok?: boolean; undoId?: string; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/archive`,
          { method: 'POST', body: JSON.stringify({}) }
        ),

  unarchiveThread: (id: string) =>
    staticDemoActive
      ? staticDemoApi.unarchiveThread(id)
      : request<{ ok?: boolean; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/unarchive`,
          { method: 'POST', body: JSON.stringify({}) }
        ),

  starThread: (id: string, isStarred: boolean) =>
    staticDemoActive
      ? staticDemoApi.starThread(id, isStarred)
      : request<{ ok?: boolean; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/star`,
          { method: 'POST', body: JSON.stringify({ isStarred, starred: isStarred }) }
        ),

  markReadThread: (id: string, isUnread: boolean) =>
    staticDemoActive
      ? staticDemoApi.markReadThread(id, isUnread)
      : request<{ ok?: boolean; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/read`,
          { method: 'POST', body: JSON.stringify({ isUnread, read: !isUnread }) }
        ),

  snoozeThread: (id: string, until: string) =>
    staticDemoActive
      ? staticDemoApi.snoozeThread(id, until)
      : request<{ ok?: boolean; undoId?: string; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/snooze`,
          { method: 'POST', body: JSON.stringify({ until, snoozedUntil: until }) }
        ),

  moveThreadBucket: (id: string, bucket: PriorityBucket) =>
    staticDemoActive
      ? staticDemoApi.moveThreadBucket(id, bucket)
      : request<{ ok?: boolean; thread?: EmailThread }>(
          `/api/threads/${encodeURIComponent(id)}/bucket`,
          { method: 'POST', body: JSON.stringify({ bucket }) }
        ),

  bulkArchiveThreads: (threadIds: string[]) =>
    staticDemoActive
      ? staticDemoApi.bulkArchiveThreads(threadIds)
      : request<{ ok?: boolean; undoId?: string; count?: number }>('/api/threads/bulk-archive', {
          method: 'POST',
          body: JSON.stringify({ threadIds }),
        }),

  // Accounts & Gmail Auth
  getAccounts: () =>
    staticDemoActive ? staticDemoApi.getAccounts() : request<GmailAccount[]>('/api/accounts'),

  connectImapAccount: (payload: {
    email: string;
    appPassword: string;
    label: string;
    color: string;
    displayName?: string;
  }) =>
    staticDemoActive
      ? staticDemoApi.connectImapAccount(payload)
      : request<{ account: GmailAccount; syncedCount?: number; message?: string }>(
          '/api/accounts/imap',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        ),

  updateAccount: (
    id: string,
    patch: Partial<Pick<GmailAccount, 'label' | 'color' | 'signature' | 'displayName'>>
  ) =>
    staticDemoActive
      ? staticDemoApi.updateAccount(id, patch)
      : request<{ account?: GmailAccount } & Partial<GmailAccount>>(
          `/api/accounts/${encodeURIComponent(id)}`,
          { method: 'PATCH', body: JSON.stringify(patch) }
        ),

  deleteAccount: (id: string) =>
    staticDemoActive
      ? staticDemoApi.deleteAccount(id)
      : request<{ ok: boolean }>(`/api/accounts/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),

  syncAccount: (id: string) =>
    staticDemoActive
      ? staticDemoApi.syncAccount(id)
      : request<{ ok?: boolean; syncedCount?: number; account?: GmailAccount }>(
          `/api/accounts/${encodeURIComponent(id)}/sync`,
          { method: 'POST', body: JSON.stringify({}) }
        ),

  syncAllAccounts: () =>
    staticDemoActive
      ? staticDemoApi.syncAllAccounts()
      : request<{ ok?: boolean; syncedCount?: number; accounts?: GmailAccount[] }>(
          '/api/accounts/sync-all',
          { method: 'POST', body: JSON.stringify({}) }
        ),

  getGoogleAuthUrl: () =>
    staticDemoActive
      ? staticDemoApi.getGoogleAuthUrl()
      : request<{ url?: string; configured?: boolean; error?: string }>('/api/auth/google/url'),

  // Drafts & Sending
  getDrafts: () =>
    staticDemoActive ? staticDemoApi.getDrafts() : request<DraftItem[]>('/api/drafts'),

  createDraft: (payload: {
    threadId?: string | null;
    accountId: string;
    toEmails: string[];
    ccEmails?: string[];
    bccEmails?: string[];
    subject: string;
    bodyText: string;
    tone?: DraftItem['tone'];
    status?: DraftItem['status'];
    createdBy?: 'user' | 'agent';
    attachments?: DraftItem['attachments'];
  }) =>
    staticDemoActive
      ? staticDemoApi.createDraft(payload)
      : request<DraftItem | { draft: DraftItem }>('/api/drafts', {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((res) => ('draft' in res ? res.draft : res)),

  updateDraft: (
    id: string,
    patch: Partial<
      Pick<DraftItem, 'toEmails' | 'ccEmails' | 'bccEmails' | 'subject' | 'bodyText' | 'status' | 'scheduledFor' | 'accountId'>
    >
  ) =>
    staticDemoActive
      ? staticDemoApi.updateDraft(id, patch)
      : request<DraftItem | { draft: DraftItem }>(`/api/drafts/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }).then((res) => ('draft' in res ? res.draft : res)),

  deleteDraft: (id: string) =>
    staticDemoActive
      ? staticDemoApi.deleteDraft(id)
      : request<{ ok: boolean }>(`/api/drafts/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  sendDraft: (id: string, options?: { overrideShabbos?: boolean }) =>
    staticDemoActive
      ? staticDemoApi.sendDraft(id, options)
      : request<{
          ok?: boolean;
          status?: 'sent' | 'held_shabbos';
          heldByShabbos?: boolean;
          scheduledFor?: string | null;
          draft?: DraftItem;
          message?: string;
        }>(`/api/drafts/${encodeURIComponent(id)}/send`, {
          method: 'POST',
          body: JSON.stringify(options || {}),
        }),

  // Screener, Tasks, Commitments
  decideScreener: (email: string, decision: 'approved' | 'feed' | 'muted') =>
    staticDemoActive
      ? staticDemoApi.decideScreener(email, decision)
      : request<{ ok?: boolean; undoId?: string }>(
          `/api/screener/${encodeURIComponent(email)}/decide`,
          { method: 'POST', body: JSON.stringify({ decision }) }
        ),

  updateTask: (
    id: string,
    patch: Partial<Pick<ExtractedTask, 'completed' | 'title' | 'priority'>>
  ) =>
    staticDemoActive
      ? staticDemoApi.updateTask(id, patch)
      : request<ExtractedTask | { task: ExtractedTask }>(`/api/tasks/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }).then((res) => ('task' in res ? res.task : res)),

  createTask: (payload: {
    threadId: string;
    accountId: string;
    title: string;
    dueLabel?: string | null;
    priority?: 'high' | 'medium' | 'low';
  }) =>
    staticDemoActive
      ? staticDemoApi.createTask(payload)
      : request<ExtractedTask | { task: ExtractedTask }>('/api/tasks', {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((res) => ('task' in res ? res.task : res)),

  resolveCommitment: (id: string) =>
    staticDemoActive
      ? staticDemoApi.resolveCommitment(id)
      : request<{ ok?: boolean }>(`/api/commitments/${encodeURIComponent(id)}/resolve`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),

  reopenCommitment: (id: string) =>
    staticDemoActive
      ? staticDemoApi.reopenCommitment(id)
      : request<{ ok?: boolean }>(`/api/commitments/${encodeURIComponent(id)}/reopen`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),

  nudgeCommitment: (id: string) =>
    staticDemoActive
      ? staticDemoApi.nudgeCommitment(id)
      : request<{ ok?: boolean; draft?: DraftItem }>(
          `/api/commitments/${encodeURIComponent(id)}/nudge`,
          {
            method: 'POST',
            body: JSON.stringify({}),
          }
        ),

  // Settings & Demo & Undo
  getSettings: () =>
    staticDemoActive
      ? staticDemoApi.getSettings()
      : request<{ settings?: AppSettings; shabbosStatus?: ShabbosStatus } & Partial<AppSettings>>(
          '/api/settings'
        ),

  updateSettings: (
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
  ) =>
    staticDemoActive
      ? staticDemoApi.updateSettings(patch)
      : request<{ settings?: AppSettings; shabbosStatus?: ShabbosStatus } & Partial<AppSettings>>(
          '/api/settings',
          {
            method: 'PATCH',
            body: JSON.stringify(patch),
          }
        ),

  resetDemo: () =>
    staticDemoActive
      ? staticDemoApi.resetDemo()
      : request<{ ok?: boolean }>('/api/demo/reset', {
          method: 'POST',
          body: JSON.stringify({}),
        }),

  toggleDemo: (enabled: boolean) =>
    staticDemoActive
      ? staticDemoApi.toggleDemo(enabled)
      : request<{ ok?: boolean; demoMode?: boolean }>('/api/demo/toggle', {
          method: 'POST',
          body: JSON.stringify({ enabled, demoMode: enabled }),
        }),

  undo: (undoId: string) =>
    staticDemoActive
      ? staticDemoApi.undo(undoId)
      : request<{ ok?: boolean; restoredCount?: number }>(`/api/undo/${encodeURIComponent(undoId)}`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),

  // Claude Agent Endpoints
  getBriefing: (refresh = false) =>
    staticDemoActive
      ? staticDemoApi.getBriefing()
      : request<BriefingData>(`/api/agent/briefing${refresh ? '?refresh=1' : ''}`),

  agentChat: (payload: AgentChatRequest) =>
    staticDemoActive
      ? staticDemoApi.agentChat(payload)
      : request<AgentChatMessage>('/api/agent/chat', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),

  draftReply: (payload: DraftReplyRequest) =>
    staticDemoActive
      ? staticDemoApi.draftReply(payload)
      : request<DraftItem | { draft: DraftItem }>('/api/agent/draft-reply', {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((res) => ('draft' in res ? res.draft : res)),

  summarizeThread: (threadId: string) =>
    staticDemoActive
      ? staticDemoApi.summarizeThread(threadId)
      : request<SummarizeThreadResponse>(`/api/agent/summarize/${encodeURIComponent(threadId)}`, {
          method: 'POST',
          body: JSON.stringify({}),
        }),

  nlFilter: (payload: NlFilterRequest) =>
    staticDemoActive
      ? staticDemoApi.nlFilter(payload)
      : request<NlFilterResponse>('/api/agent/nl-filter', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),

  getConstellation: (accountId = 'all') =>
    staticDemoActive
      ? staticDemoApi.getConstellation(accountId)
      : request<ConstellationGraph>(
          `/api/agent/constellation?accountId=${encodeURIComponent(accountId)}`
        ),

  executeProposal: (proposalId: string) =>
    staticDemoActive
      ? staticDemoApi.executeProposal(proposalId)
      : request<{ ok?: boolean; undoId?: string; proposal?: unknown }>(
          `/api/agent/proposals/${encodeURIComponent(proposalId)}/execute`,
          { method: 'POST', body: JSON.stringify({}) }
        ),

  undoProposal: (proposalId: string) =>
    staticDemoActive
      ? staticDemoApi.undoProposal(proposalId)
      : request<{ ok?: boolean; proposal?: unknown }>(
          `/api/agent/proposals/${encodeURIComponent(proposalId)}/undo`,
          { method: 'POST', body: JSON.stringify({}) }
        ),

  getRules: () =>
    staticDemoActive ? staticDemoApi.getRules() : request<AgentRule[]>('/api/agent/rules'),

  createRule: (payload: { name: string; naturalLanguage: string }) =>
    staticDemoActive
      ? staticDemoApi.createRule(payload)
      : request<AgentRule | { rule: AgentRule }>('/api/agent/rules', {
          method: 'POST',
          body: JSON.stringify(payload),
        }).then((res) => ('rule' in res ? res.rule : res)),

  updateRule: (id: string, patch: Partial<Pick<AgentRule, 'name' | 'naturalLanguage' | 'enabled'>>) =>
    staticDemoActive
      ? staticDemoApi.updateRule(id, patch)
      : request<AgentRule | { rule: AgentRule }>(`/api/agent/rules/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          body: JSON.stringify(patch),
        }).then((res) => ('rule' in res ? res.rule : res)),

  deleteRule: (id: string) =>
    staticDemoActive
      ? staticDemoApi.deleteRule(id)
      : request<{ ok: boolean }>(`/api/agent/rules/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        }),

  testClaudeKey: (payload: TestKeyRequest) =>
    staticDemoActive
      ? staticDemoApi.testClaudeKey(payload)
      : request<TestKeyResponse>('/api/agent/test-key', {
          method: 'POST',
          body: JSON.stringify(payload),
        }),
};
