import type {
  ActionProposal,
  AgentRule,
  BulkActionType,
  CommitmentItem,
  CustomView,
  DraftItem,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  PriorityBucket,
  ScreenerSender,
  ShabbosStatus,
} from '../../../shared/types.js';

export type MaybePromise<T> = T | Promise<T>;

export interface ThreadQueryOptions {
  accountId?: string;
  bucket?: PriorityBucket;
  includeArchived?: boolean;
  unreadOnly?: boolean;
  limit?: number;
}

export interface BulkActionResult {
  undoId: string;
  affectedCount: number;
  affectedThreadIds: string[];
}

export interface UndoActionResult {
  ok: boolean;
  restoredCount: number;
  message?: string;
}

export interface StoredProposal extends ActionProposal {
  undoId?: string | null;
  createdAt: string;
  executedAt?: string | null;
  undoneAt?: string | null;
}

export const SETTING_KEYS = {
  ANTHROPIC_API_KEY: 'anthropicApiKey',
  CLAUDE_MODEL: 'claudeModel',
  SHABBOS_GUARD_ENABLED: 'shabbosGuardEnabled',
  SHABBOS_TIMEZONE: 'shabbosTimezone',
  DEMO_MODE: 'demoMode',
  THEME: 'theme',
} as const;

export interface AgentContext {
  // Threads
  getThreads(opts?: ThreadQueryOptions): MaybePromise<EmailThread[]>;
  getThreadById(id: string): MaybePromise<EmailThread | null>;
  updateThreadIntelligence?(
    threadId: string,
    patch: {
      distilledAsk?: string | null;
      aiSummaryBullets?: string[];
    }
  ): MaybePromise<void>;

  // Accounts, Commitments, Screener, Tasks
  getAccounts(): MaybePromise<GmailAccount[]>;
  getCommitments(): MaybePromise<CommitmentItem[]>;
  getScreener(): MaybePromise<ScreenerSender[]>;
  getTasks(threadId?: string): MaybePromise<ExtractedTask[]>;
  saveTask?(
    task: Omit<ExtractedTask, 'id'> & { id?: string }
  ): MaybePromise<ExtractedTask>;

  // Agent Rules
  getRules(): MaybePromise<AgentRule[]>;
  saveRule(
    rule: Omit<AgentRule, 'id' | 'createdAt' | 'matchCount'> & {
      id?: string;
      matchCount?: number;
      createdAt?: string;
    }
  ): MaybePromise<AgentRule>;
  deleteRule(id: string): MaybePromise<boolean>;
  toggleRule(id: string, enabled?: boolean): MaybePromise<AgentRule | null>;
  updateRule?(
    id: string,
    patch: Partial<
      Pick<AgentRule, 'name' | 'naturalLanguage' | 'enabled' | 'matchCount'>
    >
  ): MaybePromise<AgentRule | null>;

  // Custom Smart Views
  getCustomViews(): MaybePromise<CustomView[]>;
  saveCustomView(
    view: Omit<CustomView, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ): MaybePromise<CustomView>;

  // Drafts (Approval Dock)
  saveDraft(
    draft: Omit<DraftItem, 'id' | 'createdAt'> & {
      id?: string;
      createdAt?: string;
    }
  ): MaybePromise<DraftItem>;

  // Bulk mutations with reversible undo tokens
  applyBulkAction(
    actionType: BulkActionType,
    threadIds: string[],
    payload?: Record<string, unknown>
  ): MaybePromise<BulkActionResult>;
  undoAction(undoId: string): MaybePromise<UndoActionResult>;

  // Settings & Shabbos Guard
  getSetting(key: string): MaybePromise<string | null>;
  setSetting(key: string, value: string): MaybePromise<void>;
  getShabbosStatus(): MaybePromise<ShabbosStatus>;

  // Optional proposal persistence (routes.ts maintains an in-memory map as fallback)
  saveProposal?(proposal: StoredProposal): MaybePromise<void>;
  getProposal?(id: string): MaybePromise<StoredProposal | null>;
}
