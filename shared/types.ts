// Shared TypeScript contracts for Prism Mail (server and client)

export type PriorityBucket =
  | 'decision'
  | 'waiting'
  | 'feed'
  | 'paper_trail'
  | 'screener'
  | 'archived';

export type LensId = 'pulse' | 'constellation' | 'stream' | 'vault';

export type DraftTone = 'direct' | 'warm' | 'executive' | 'decline';

export type BulkActionType =
  | 'archive'
  | 'label'
  | 'move_bucket'
  | 'snooze'
  | 'mark_read';

export type SenderTrust = 'approved' | 'screener' | 'feed' | 'muted';

export type ClaudeModelId =
  | 'claude-sonnet-4-20250514'
  | 'claude-opus-4-20250514'
  | 'claude-3-5-haiku-20241022';

export interface GmailAccount {
  id: string;
  email: string;
  displayName: string;
  label: string;
  color: string;
  provider: 'gmail_oauth' | 'gmail_imap' | 'demo';
  status: 'connected' | 'syncing' | 'error' | 'demo';
  lastSyncedAt: string | null;
  unreadCount: number;
  signature?: string;
  isDemo: boolean;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface EmailMessage {
  id: string;
  threadId: string;
  accountId: string;
  externalId?: string;
  fromName: string;
  fromEmail: string;
  toEmails: string[];
  ccEmails?: string[];
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml?: string;
  sentAt: string;
  isUnread: boolean;
  isOutbound: boolean;
  attachments: EmailAttachment[];
}

export interface QuickActionChip {
  id: string;
  label: string;
  kind: 'reply' | 'approve' | 'schedule' | 'snooze' | 'archive' | 'nudge';
  draftHint?: string;
  draftBody?: string;
}

export interface ReceiptInfo {
  vendor: string;
  amount: number;
  currency: string;
  category: string;
  invoiceNumber?: string;
}

export interface EmailThread {
  id: string;
  accountId: string;
  accountColor: string;
  accountLabel: string;
  accountEmail: string;
  subject: string;
  snippet: string;
  participants: { name: string; email: string }[];
  messageCount: number;
  lastMessageAt: string;
  isUnread: boolean;
  isStarred: boolean;
  isArchived: boolean;
  isSnoozedUntil?: string | null;
  labels: string[];
  bucket: PriorityBucket;
  urgencyScore: number;
  distilledAsk: string | null;
  /** The exact words in the newest message that the Goal comes from. */
  goalQuote?: string | null;
  aiSummaryBullets: string[];
  deadlineAt?: string | null;
  deadlineLabel?: string | null;
  quickActions: QuickActionChip[];
  receiptInfo?: ReceiptInfo | null;
  relatedThreadIds: string[];
  senderTrust: SenderTrust;
  messages?: EmailMessage[];
}

export interface CommitmentItem {
  id: string;
  threadId: string;
  accountId: string;
  accountColor: string;
  accountLabel: string;
  direction: 'you_promised' | 'waiting_on_them';
  counterpartyName: string;
  counterpartyEmail: string;
  summary: string;
  dueLabel: string;
  daysOpen: number;
  status: 'open' | 'nudged' | 'resolved';
  suggestedNudgeDraft: string;
}

export interface ExtractedTask {
  id: string;
  threadId: string;
  accountId: string;
  title: string;
  dueLabel?: string | null;
  completed: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface ScreenerSender {
  email: string;
  name: string;
  domain: string;
  accountId: string;
  accountColor: string;
  firstSeenAt: string;
  sampleSubject: string;
  sampleSnippet: string;
  threadIds: string[];
  aiRecommendation: 'approve' | 'feed' | 'mute';
  aiReason: string;
  status: 'pending' | 'approved' | 'feed' | 'muted';
}

export interface DraftItem {
  id: string;
  threadId?: string | null;
  accountId: string;
  toEmails: string[];
  ccEmails?: string[];
  subject: string;
  bodyText: string;
  tone?: DraftTone;
  status: 'draft' | 'pending_approval' | 'held_shabbos' | 'sent';
  scheduledFor?: string | null;
  createdBy: 'user' | 'agent';
  createdAt: string;
}

export interface AgentRule {
  id: string;
  name: string;
  naturalLanguage: string;
  enabled: boolean;
  matchCount: number;
  createdAt: string;
}

export interface CustomView {
  id: string;
  name: string;
  icon: string;
  queryDescription: string;
  filterSpec: Record<string, unknown>;
  threadIds?: string[];
  createdAt: string;
}

export interface ActionProposal {
  id: string;
  title: string;
  description: string;
  actionType: BulkActionType;
  targetThreadIds: string[];
  targetThreadsPreview: {
    id: string;
    subject: string;
    fromName: string;
    accountLabel: string;
  }[];
  payload?: Record<string, unknown>;
  status: 'pending' | 'executed' | 'undone';
}

export interface ConstellationNode {
  threadId: string;
  accountId: string;
  accountColor: string;
  accountLabel: string;
  subject: string;
  fromName: string;
  distilledAsk: string | null;
  bucket: PriorityBucket;
  urgencyScore: number;
  isUnread: boolean;
  messageCount: number;
  lastMessageAt: string;
  ring: 'core' | 'orbit' | 'outer' | 'perimeter';
  angle: number;
  radius: number;
  tags: string[];
}

export interface ConstellationLink {
  sourceThreadId: string;
  targetThreadId: string;
  reason: string;
  crossAccount: boolean;
}

export interface ConstellationGraph {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
}

export interface BriefingData {
  greeting: string;
  headline: string;
  stats: {
    decisions: number;
    waitingOn: number;
    youPromised: number;
    clearedNoise: number;
    totalUnread: number;
    screenerPending: number;
  };
  highlights: {
    threadId: string;
    title: string;
    reason: string;
    urgency: 'high' | 'medium';
  }[];
  generatedBy: 'claude' | 'local';
  generatedAt: string;
}

export interface ShabbosStatus {
  enabled: boolean;
  isCurrentlyRestricted: boolean;
  nextWindowStart: string;
  nextWindowEnd: string;
  timezone: string;
  heldCount: number;
  reason?: string;
}

export interface AppSettings {
  anthropicApiKeyConfigured: boolean;
  anthropicApiKeyMasked?: string;
  claudeModel: string;
  googleOAuthConfigured: boolean;
  googleClientIdMasked?: string;
  shabbosGuardEnabled: boolean;
  shabbosTimezone: string;
  demoMode: boolean;
  theme: 'dark' | 'light';
}

export interface AgentChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: {
    threadId: string;
    subject: string;
    accountLabel: string;
  }[];
  proposal?: ActionProposal;
  createdDraft?: DraftItem;
  createdView?: CustomView;
  createdRule?: AgentRule;
  toolTrace?: {
    tool: string;
    summary: string;
  }[];
  timestamp: string;
}

export interface AgentChatRequest {
  message: string;
  history?: Pick<AgentChatMessage, 'role' | 'content'>[];
  selectedAccountId?: string;
  activeThreadId?: string;
}

export interface DraftReplyRequest {
  threadId: string;
  instruction?: string;
  tone?: DraftTone;
}

export interface NlFilterRequest {
  query: string;
  accountId?: string;
}

export interface NlFilterResponse {
  threadIds: string[];
  explanation: string;
  suggestedViewName?: string;
  generatedBy?: 'claude' | 'local';
}

export interface SummarizeThreadResponse {
  threadId: string;
  distilledAsk: string | null;
  aiSummaryBullets: string[];
  extractedTasks: ExtractedTask[];
  generatedBy: 'claude' | 'local';
}

export interface TestKeyRequest {
  apiKey: string;
  model?: string;
}

export interface TestKeyResponse {
  ok: boolean;
  message: string;
  model: string;
}
