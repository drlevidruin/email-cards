import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type {
  AgentRule,
  AppSettings,
  BulkActionType,
  CommitmentItem,
  CustomView,
  DraftItem,
  EmailAttachment,
  EmailMessage,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  PriorityBucket,
  QuickActionChip,
  ReceiptInfo,
  ScreenerSender,
  SenderTrust,
  ShabbosStatus,
} from '../../shared/types.js';
import type {
  AgentContext,
  BulkActionResult,
  StoredProposal,
  ThreadQueryOptions,
  UndoActionResult,
} from './agent/types.js';
import { SETTING_KEYS } from './agent/types.js';
import { buildDemoDataset } from './demoData.js';
import { getShabbosStatus } from './shabbosGuard.js';

export interface AccountCredentials {
  // OAuth2 fields
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  // IMAP/SMTP fields
  appPassword?: string;
}

export interface AccountRecord extends GmailAccount {
  credentials: AccountCredentials;
}

interface ThreadSnapshot {
  id: string;
  isArchived: boolean;
  isUnread: boolean;
  isStarred: boolean;
  isSnoozedUntil: string | null;
  bucket: PriorityBucket;
  labels: string[];
  senderTrust: SenderTrust;
}

interface ScreenerSnapshot {
  email: string;
  status: ScreenerSender['status'];
}

interface UndoPayload {
  threads: ThreadSnapshot[];
  screener?: ScreenerSnapshot[];
}

function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function maskSecret(val?: string | null): string | undefined {
  if (!val || val.trim().length === 0) return undefined;
  const trimmed = val.trim();
  if (trimmed.length <= 8) return '••••••••';
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

export class PrismDatabase {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(customPath?: string) {
    const defaultDir = path.join(os.homedir(), '.prism-mail');
    const resolvedPath =
      customPath || process.env.PRISM_DB_PATH || path.join(defaultDir, 'prism.db');
    fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
    this.dbPath = resolvedPath;
    this.db = new DatabaseSync(resolvedPath);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    this.initSchema();
    this.ensureDefaultSettings();
    this.seedIfEmpty();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        display_name TEXT NOT NULL,
        label TEXT NOT NULL,
        color TEXT NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL,
        last_synced_at TEXT,
        signature TEXT,
        is_demo INTEGER NOT NULL DEFAULT 0,
        credentials_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS threads (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        external_thread_id TEXT,
        account_color TEXT NOT NULL,
        account_label TEXT NOT NULL,
        account_email TEXT NOT NULL,
        subject TEXT NOT NULL,
        snippet TEXT NOT NULL,
        participants_json TEXT NOT NULL,
        message_count INTEGER NOT NULL DEFAULT 1,
        last_message_at TEXT NOT NULL,
        is_unread INTEGER NOT NULL DEFAULT 0,
        is_starred INTEGER NOT NULL DEFAULT 0,
        is_archived INTEGER NOT NULL DEFAULT 0,
        is_snoozed_until TEXT,
        labels_json TEXT NOT NULL DEFAULT '[]',
        bucket TEXT NOT NULL,
        urgency_score INTEGER NOT NULL DEFAULT 50,
        distilled_ask TEXT,
        ai_summary_bullets_json TEXT NOT NULL DEFAULT '[]',
        deadline_at TEXT,
        deadline_label TEXT,
        quick_actions_json TEXT NOT NULL DEFAULT '[]',
        receipt_info_json TEXT,
        related_thread_ids_json TEXT NOT NULL DEFAULT '[]',
        sender_trust TEXT NOT NULL DEFAULT 'approved',
        is_demo INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_threads_account ON threads(account_id);
      CREATE INDEX IF NOT EXISTS idx_threads_bucket ON threads(bucket);
      CREATE INDEX IF NOT EXISTS idx_threads_last_msg ON threads(last_message_at DESC);

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        external_id TEXT,
        from_name TEXT NOT NULL,
        from_email TEXT NOT NULL,
        to_emails_json TEXT NOT NULL,
        cc_emails_json TEXT,
        subject TEXT NOT NULL,
        snippet TEXT NOT NULL,
        body_text TEXT NOT NULL,
        body_html TEXT,
        sent_at TEXT NOT NULL,
        is_unread INTEGER NOT NULL DEFAULT 0,
        is_outbound INTEGER NOT NULL DEFAULT 0,
        attachments_json TEXT NOT NULL DEFAULT '[]',
        is_demo INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);

      CREATE TABLE IF NOT EXISTS commitments (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_color TEXT NOT NULL,
        account_label TEXT NOT NULL,
        direction TEXT NOT NULL,
        counterparty_name TEXT NOT NULL,
        counterparty_email TEXT NOT NULL,
        summary TEXT NOT NULL,
        due_label TEXT NOT NULL,
        days_open INTEGER NOT NULL DEFAULT 1,
        status TEXT NOT NULL DEFAULT 'open',
        suggested_nudge_draft TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS screener (
        email TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        domain TEXT NOT NULL,
        account_id TEXT NOT NULL,
        account_color TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        sample_subject TEXT NOT NULL,
        sample_snippet TEXT NOT NULL,
        thread_ids_json TEXT NOT NULL DEFAULT '[]',
        ai_recommendation TEXT NOT NULL,
        ai_reason TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        thread_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        title TEXT NOT NULL,
        due_label TEXT,
        completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'medium',
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS drafts (
        id TEXT PRIMARY KEY,
        thread_id TEXT,
        account_id TEXT NOT NULL,
        to_emails_json TEXT NOT NULL,
        cc_emails_json TEXT,
        subject TEXT NOT NULL,
        body_text TEXT NOT NULL,
        tone TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        scheduled_for TEXT,
        created_by TEXT NOT NULL DEFAULT 'user',
        created_at TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        natural_language TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        match_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS custom_views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT NOT NULL,
        query_description TEXT NOT NULL,
        filter_spec_json TEXT NOT NULL DEFAULT '{}',
        thread_ids_json TEXT,
        created_at TEXT NOT NULL,
        is_demo INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS undo_log (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        snapshot_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        undone INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS proposals (
        id TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  private ensureDefaultSettings(): void {
    const defaults: Record<string, string> = {
      [SETTING_KEYS.CLAUDE_MODEL]: 'claude-sonnet-4-20250514',
      [SETTING_KEYS.SHABBOS_GUARD_ENABLED]: 'true',
      [SETTING_KEYS.SHABBOS_TIMEZONE]: 'America/New_York',
      [SETTING_KEYS.DEMO_MODE]: 'true',
      [SETTING_KEYS.THEME]: 'light',
    };
    const stmt = this.db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    for (const [k, v] of Object.entries(defaults)) {
      stmt.run(k, v);
    }
    // Migrate existing databases to Prism's bright light-only theme
    this.db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(SETTING_KEYS.THEME, 'light');
  }

  private seedIfEmpty(): void {
    const countRow = this.db.prepare('SELECT COUNT(*) as cnt FROM accounts').get() as {
      cnt: number;
    };
    const demoMode = this.isDemoMode();
    if (countRow.cnt === 0 && demoMode) {
      this.seedDemoData();
    }
  }

  public isDemoMode(): boolean {
    const val = this.getSetting(SETTING_KEYS.DEMO_MODE);
    return val !== 'false';
  }

  public seedDemoData(): void {
    const dataset = buildDemoDataset();
    this.db.exec('BEGIN');
    try {
      // Clear existing demo rows only (preserve all real user Gmail accounts & user settings)
      this.db.exec(`
        DELETE FROM messages WHERE is_demo = 1;
        DELETE FROM threads WHERE is_demo = 1;
        DELETE FROM accounts WHERE is_demo = 1;
        DELETE FROM commitments WHERE is_demo = 1;
        DELETE FROM screener WHERE is_demo = 1;
        DELETE FROM tasks WHERE is_demo = 1;
        DELETE FROM drafts WHERE is_demo = 1;
        DELETE FROM rules WHERE is_demo = 1;
        DELETE FROM custom_views WHERE is_demo = 1;
      `);

      const insAcc = this.db.prepare(`
        INSERT OR REPLACE INTO accounts (
          id, email, display_name, label, color, provider, status, last_synced_at, signature, is_demo, credentials_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '{}')
      `);
      for (const a of dataset.accounts) {
        insAcc.run(
          a.id,
          a.email,
          a.displayName,
          a.label,
          a.color,
          a.provider,
          a.status,
          a.lastSyncedAt,
          a.signature ?? null,
        );
      }

      const insThread = this.db.prepare(`
        INSERT OR REPLACE INTO threads (
          id, account_id, external_thread_id, account_color, account_label, account_email,
          subject, snippet, participants_json, message_count, last_message_at,
          is_unread, is_starred, is_archived, is_snoozed_until, labels_json,
          bucket, urgency_score, distilled_ask, ai_summary_bullets_json,
          deadline_at, deadline_label, quick_actions_json, receipt_info_json,
          related_thread_ids_json, sender_trust, is_demo
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const t of dataset.threads) {
        insThread.run(
          t.id,
          t.accountId,
          t.accountColor,
          t.accountLabel,
          t.accountEmail,
          t.subject,
          t.snippet,
          JSON.stringify(t.participants),
          t.messageCount,
          t.lastMessageAt,
          t.isUnread ? 1 : 0,
          t.isStarred ? 1 : 0,
          t.isArchived ? 1 : 0,
          t.isSnoozedUntil ?? null,
          JSON.stringify(t.labels),
          t.bucket,
          t.urgencyScore,
          t.distilledAsk ?? null,
          JSON.stringify(t.aiSummaryBullets),
          t.deadlineAt ?? null,
          t.deadlineLabel ?? null,
          JSON.stringify(t.quickActions),
          t.receiptInfo ? JSON.stringify(t.receiptInfo) : null,
          JSON.stringify(t.relatedThreadIds),
          t.senderTrust,
        );
      }

      const insMsg = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, thread_id, account_id, external_id, from_name, from_email,
          to_emails_json, cc_emails_json, subject, snippet, body_text, body_html,
          sent_at, is_unread, is_outbound, attachments_json, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const m of dataset.messages) {
        insMsg.run(
          m.id,
          m.threadId,
          m.accountId,
          m.externalId ?? null,
          m.fromName,
          m.fromEmail,
          JSON.stringify(m.toEmails),
          m.ccEmails ? JSON.stringify(m.ccEmails) : null,
          m.subject,
          m.snippet,
          m.bodyText,
          m.bodyHtml ?? null,
          m.sentAt,
          m.isUnread ? 1 : 0,
          m.isOutbound ? 1 : 0,
          JSON.stringify(m.attachments),
        );
      }

      const insCom = this.db.prepare(`
        INSERT OR REPLACE INTO commitments (
          id, thread_id, account_id, account_color, account_label, direction,
          counterparty_name, counterparty_email, summary, due_label, days_open,
          status, suggested_nudge_draft, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const c of dataset.commitments) {
        insCom.run(
          c.id,
          c.threadId,
          c.accountId,
          c.accountColor,
          c.accountLabel,
          c.direction,
          c.counterpartyName,
          c.counterpartyEmail,
          c.summary,
          c.dueLabel,
          c.daysOpen,
          c.status,
          c.suggestedNudgeDraft,
        );
      }

      const insScr = this.db.prepare(`
        INSERT OR REPLACE INTO screener (
          email, name, domain, account_id, account_color, first_seen_at,
          sample_subject, sample_snippet, thread_ids_json, ai_recommendation,
          ai_reason, status, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const s of dataset.screener) {
        insScr.run(
          s.email,
          s.name,
          s.domain,
          s.accountId,
          s.accountColor,
          s.firstSeenAt,
          s.sampleSubject,
          s.sampleSnippet,
          JSON.stringify(s.threadIds),
          s.aiRecommendation,
          s.aiReason,
          s.status,
        );
      }

      const insTask = this.db.prepare(`
        INSERT OR REPLACE INTO tasks (
          id, thread_id, account_id, title, due_label, completed, priority, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const t of dataset.tasks) {
        insTask.run(
          t.id,
          t.threadId,
          t.accountId,
          t.title,
          t.dueLabel ?? null,
          t.completed ? 1 : 0,
          t.priority,
        );
      }

      const insDraft = this.db.prepare(`
        INSERT OR REPLACE INTO drafts (
          id, thread_id, account_id, to_emails_json, cc_emails_json,
          subject, body_text, tone, status, scheduled_for, created_by, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const d of dataset.drafts) {
        insDraft.run(
          d.id,
          d.threadId ?? null,
          d.accountId,
          JSON.stringify(d.toEmails),
          d.ccEmails ? JSON.stringify(d.ccEmails) : null,
          d.subject,
          d.bodyText,
          d.tone ?? null,
          d.status,
          d.scheduledFor ?? null,
          d.createdBy,
          d.createdAt,
        );
      }

      const insRule = this.db.prepare(`
        INSERT OR REPLACE INTO rules (
          id, name, natural_language, enabled, match_count, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, 1)
      `);
      for (const r of dataset.rules) {
        insRule.run(
          r.id,
          r.name,
          r.naturalLanguage,
          r.enabled ? 1 : 0,
          r.matchCount,
          r.createdAt,
        );
      }

      const insView = this.db.prepare(`
        INSERT OR REPLACE INTO custom_views (
          id, name, icon, query_description, filter_spec_json, thread_ids_json, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 1)
      `);
      for (const v of dataset.customViews) {
        insView.run(
          v.id,
          v.name,
          v.icon,
          v.queryDescription,
          JSON.stringify(v.filterSpec),
          v.threadIds ? JSON.stringify(v.threadIds) : null,
          v.createdAt,
        );
      }

      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public setDemoMode(enabled: boolean): void {
    this.setSetting(SETTING_KEYS.DEMO_MODE, enabled ? 'true' : 'false');
    if (enabled) {
      const demoCount = this.db
        .prepare('SELECT COUNT(*) as cnt FROM accounts WHERE is_demo = 1')
        .get() as { cnt: number };
      if (demoCount.cnt === 0) {
        this.seedDemoData();
      }
    }
  }

  // =========================================================================
  // SETTINGS & SHABBOS
  // =========================================================================

  public getSetting(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
      | { value: string }
      | undefined;
    return row ? row.value : null;
  }

  public setSetting(key: string, value: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
      .run(key, value);
  }

  public deleteSetting(key: string): void {
    this.db.prepare('DELETE FROM settings WHERE key = ?').run(key);
  }

  public getAppSettings(): AppSettings {
    const anthropicKey = this.getSetting(SETTING_KEYS.ANTHROPIC_API_KEY);
    const googleClientId = this.getSetting('googleClientId');
    const googleClientSecret = this.getSetting('googleClientSecret');
    const claudeModel =
      this.getSetting(SETTING_KEYS.CLAUDE_MODEL) || 'claude-sonnet-4-20250514';
    const shabbosGuardEnabled =
      this.getSetting(SETTING_KEYS.SHABBOS_GUARD_ENABLED) !== 'false';
    const shabbosTimezone =
      this.getSetting(SETTING_KEYS.SHABBOS_TIMEZONE) || 'America/New_York';
    const demoMode = this.isDemoMode();
    const theme: 'light' = 'light';

    return {
      anthropicApiKeyConfigured: Boolean(anthropicKey && anthropicKey.trim().length > 0),
      anthropicApiKeyMasked: maskSecret(anthropicKey),
      claudeModel,
      googleOAuthConfigured: Boolean(
        googleClientId &&
          googleClientId.trim().length > 0 &&
          googleClientSecret &&
          googleClientSecret.trim().length > 0,
      ),
      googleClientIdMasked: maskSecret(googleClientId),
      shabbosGuardEnabled,
      shabbosTimezone,
      demoMode,
      theme,
    };
  }

  public getShabbosStatus(): ShabbosStatus {
    const enabled = this.getSetting(SETTING_KEYS.SHABBOS_GUARD_ENABLED) !== 'false';
    const timezone =
      this.getSetting(SETTING_KEYS.SHABBOS_TIMEZONE) || 'America/New_York';
    const demoClause = this.isDemoMode() ? '' : 'AND is_demo = 0';
    const row = this.db
      .prepare(`SELECT COUNT(*) as cnt FROM drafts WHERE status = 'held_shabbos' ${demoClause}`)
      .get() as { cnt: number };
    return getShabbosStatus(enabled, timezone, row.cnt);
  }

  // =========================================================================
  // ACCOUNTS
  // =========================================================================

  private mapAccountRow(row: Record<string, unknown>, includeDemoFilter = true): AccountRecord {
    const id = String(row.id);
    const demoClause = includeDemoFilter && !this.isDemoMode() ? 'AND is_demo = 0' : '';
    const unreadRow = this.db
      .prepare(
        `SELECT COUNT(*) as cnt FROM threads WHERE account_id = ? AND is_unread = 1 AND is_archived = 0 ${demoClause}`,
      )
      .get(id) as { cnt: number };

    return {
      id,
      email: String(row.email),
      displayName: String(row.display_name),
      label: String(row.label),
      color: String(row.color),
      provider: row.provider as GmailAccount['provider'],
      status: row.status as GmailAccount['status'],
      lastSyncedAt: row.last_synced_at ? String(row.last_synced_at) : null,
      unreadCount: unreadRow.cnt,
      signature: row.signature ? String(row.signature) : undefined,
      isDemo: Number(row.is_demo) === 1,
      credentials: safeJsonParse<AccountCredentials>(
        row.credentials_json as string | undefined,
        {},
      ),
    };
  }

  public toPublicAccount(rec: AccountRecord): GmailAccount {
    const { credentials: _creds, ...pub } = rec;
    return pub;
  }

  public getAccounts(): GmailAccount[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM accounts ${where} ORDER BY is_demo ASC, label ASC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.toPublicAccount(this.mapAccountRow(r)));
  }

  public getAccountRecordById(id: string): AccountRecord | null {
    const row = this.db.prepare('SELECT * FROM accounts WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapAccountRow(row, false) : null;
  }

  public getAccountRecordByEmail(email: string): AccountRecord | null {
    const row = this.db
      .prepare('SELECT * FROM accounts WHERE LOWER(email) = LOWER(?)')
      .get(email) as Record<string, unknown> | undefined;
    return row ? this.mapAccountRow(row, false) : null;
  }

  public upsertAccount(
    account: Omit<GmailAccount, 'unreadCount'>,
    credentials: AccountCredentials = {},
  ): GmailAccount {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO accounts (
          id, email, display_name, label, color, provider, status, last_synced_at, signature, is_demo, credentials_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        account.id,
        account.email,
        account.displayName,
        account.label,
        account.color,
        account.provider,
        account.status,
        account.lastSyncedAt,
        account.signature ?? null,
        account.isDemo ? 1 : 0,
        JSON.stringify(credentials),
      );
    const updated = this.getAccountRecordById(account.id)!;
    return this.toPublicAccount(updated);
  }

  public updateAccount(
    id: string,
    patch: Partial<
      Pick<GmailAccount, 'label' | 'color' | 'signature' | 'displayName' | 'status' | 'lastSyncedAt'>
    > & { credentials?: AccountCredentials },
  ): GmailAccount | null {
    const existing = this.getAccountRecordById(id);
    if (!existing) return null;

    const nextLabel = patch.label ?? existing.label;
    const nextColor = patch.color ?? existing.color;
    const nextSig = patch.signature !== undefined ? patch.signature : existing.signature;
    const nextDisplayName = patch.displayName ?? existing.displayName;
    const nextStatus = patch.status ?? existing.status;
    const nextSyncedAt =
      patch.lastSyncedAt !== undefined ? patch.lastSyncedAt : existing.lastSyncedAt;
    const nextCreds = patch.credentials ?? existing.credentials;

    this.db
      .prepare(
        `UPDATE accounts
         SET display_name = ?, label = ?, color = ?, signature = ?, status = ?, last_synced_at = ?, credentials_json = ?
         WHERE id = ?`,
      )
      .run(
        nextDisplayName,
        nextLabel,
        nextColor,
        nextSig ?? null,
        nextStatus,
        nextSyncedAt,
        JSON.stringify(nextCreds),
        id,
      );

    // Keep denormalized thread/commitment/screener account colors & labels in sync
    if (patch.label || patch.color) {
      this.db
        .prepare('UPDATE threads SET account_label = ?, account_color = ? WHERE account_id = ?')
        .run(nextLabel, nextColor, id);
      this.db
        .prepare('UPDATE commitments SET account_label = ?, account_color = ? WHERE account_id = ?')
        .run(nextLabel, nextColor, id);
      this.db
        .prepare('UPDATE screener SET account_color = ? WHERE account_id = ?')
        .run(nextColor, id);
    }

    const updated = this.getAccountRecordById(id);
    return updated ? this.toPublicAccount(updated) : null;
  }

  public deleteAccount(id: string): boolean {
    const info = this.db.prepare('DELETE FROM accounts WHERE id = ?').run(id);
    this.db.prepare('DELETE FROM commitments WHERE account_id = ?').run(id);
    this.db.prepare('DELETE FROM screener WHERE account_id = ?').run(id);
    this.db.prepare('DELETE FROM tasks WHERE account_id = ?').run(id);
    this.db.prepare('DELETE FROM drafts WHERE account_id = ?').run(id);
    return info.changes > 0;
  }

  public saveSyncedAccountData(
    accountId: string,
    threads: EmailThread[],
    messages: EmailMessage[],
    externalMap?: Map<string, string>,
  ): number {
    this.db.exec('BEGIN');
    try {
      const insThread = this.db.prepare(`
        INSERT OR REPLACE INTO threads (
          id, account_id, external_thread_id, account_color, account_label, account_email,
          subject, snippet, participants_json, message_count, last_message_at,
          is_unread, is_starred, is_archived, is_snoozed_until, labels_json,
          bucket, urgency_score, distilled_ask, ai_summary_bullets_json,
          deadline_at, deadline_label, quick_actions_json, receipt_info_json,
          related_thread_ids_json, sender_trust, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      for (const t of threads) {
        insThread.run(
          t.id,
          accountId,
          externalMap?.get(t.id) ?? null,
          t.accountColor,
          t.accountLabel,
          t.accountEmail,
          t.subject,
          t.snippet,
          JSON.stringify(t.participants),
          t.messageCount,
          t.lastMessageAt,
          t.isUnread ? 1 : 0,
          t.isStarred ? 1 : 0,
          t.isArchived ? 1 : 0,
          t.isSnoozedUntil ?? null,
          JSON.stringify(t.labels),
          t.bucket,
          t.urgencyScore,
          t.distilledAsk ?? null,
          JSON.stringify(t.aiSummaryBullets),
          t.deadlineAt ?? null,
          t.deadlineLabel ?? null,
          JSON.stringify(t.quickActions),
          t.receiptInfo ? JSON.stringify(t.receiptInfo) : null,
          JSON.stringify(t.relatedThreadIds),
          t.senderTrust,
        );
      }

      const insMsg = this.db.prepare(`
        INSERT OR REPLACE INTO messages (
          id, thread_id, account_id, external_id, from_name, from_email,
          to_emails_json, cc_emails_json, subject, snippet, body_text, body_html,
          sent_at, is_unread, is_outbound, attachments_json, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
      `);

      for (const m of messages) {
        insMsg.run(
          m.id,
          m.threadId,
          accountId,
          m.externalId ?? null,
          m.fromName,
          m.fromEmail,
          JSON.stringify(m.toEmails),
          m.ccEmails ? JSON.stringify(m.ccEmails) : null,
          m.subject,
          m.snippet,
          m.bodyText,
          m.bodyHtml ?? null,
          m.sentAt,
          m.isUnread ? 1 : 0,
          m.isOutbound ? 1 : 0,
          JSON.stringify(m.attachments),
        );
      }

      this.db
        .prepare('UPDATE accounts SET status = ?, last_synced_at = ? WHERE id = ?')
        .run('connected', new Date().toISOString(), accountId);

      this.db.exec('COMMIT');
      return threads.length;
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  // =========================================================================
  // THREADS & MESSAGES
  // =========================================================================

  private mapMessageRow(row: Record<string, unknown>): EmailMessage {
    return {
      id: String(row.id),
      threadId: String(row.thread_id),
      accountId: String(row.account_id),
      externalId: row.external_id ? String(row.external_id) : undefined,
      fromName: String(row.from_name),
      fromEmail: String(row.from_email),
      toEmails: safeJsonParse<string[]>(row.to_emails_json as string, []),
      ccEmails: row.cc_emails_json
        ? safeJsonParse<string[]>(row.cc_emails_json as string, [])
        : undefined,
      subject: String(row.subject),
      snippet: String(row.snippet),
      bodyText: String(row.body_text),
      bodyHtml: row.body_html ? String(row.body_html) : undefined,
      sentAt: String(row.sent_at),
      isUnread: Number(row.is_unread) === 1,
      isOutbound: Number(row.is_outbound) === 1,
      attachments: safeJsonParse<EmailAttachment[]>(row.attachments_json as string, []),
    };
  }

  private mapThreadRow(row: Record<string, unknown>, includeMessages = false): EmailThread {
    const id = String(row.id);
    const thread: EmailThread = {
      id,
      accountId: String(row.account_id),
      accountColor: String(row.account_color),
      accountLabel: String(row.account_label),
      accountEmail: String(row.account_email),
      subject: String(row.subject),
      snippet: String(row.snippet),
      participants: safeJsonParse<{ name: string; email: string }[]>(
        row.participants_json as string,
        [],
      ),
      messageCount: Number(row.message_count ?? 1),
      lastMessageAt: String(row.last_message_at),
      isUnread: Number(row.is_unread) === 1,
      isStarred: Number(row.is_starred) === 1,
      isArchived: Number(row.is_archived) === 1,
      isSnoozedUntil: row.is_snoozed_until ? String(row.is_snoozed_until) : null,
      labels: safeJsonParse<string[]>(row.labels_json as string, []),
      bucket: row.bucket as PriorityBucket,
      urgencyScore: Number(row.urgency_score ?? 50),
      distilledAsk: row.distilled_ask ? String(row.distilled_ask) : null,
      aiSummaryBullets: safeJsonParse<string[]>(row.ai_summary_bullets_json as string, []),
      deadlineAt: row.deadline_at ? String(row.deadline_at) : null,
      deadlineLabel: row.deadline_label ? String(row.deadline_label) : null,
      quickActions: safeJsonParse<QuickActionChip[]>(row.quick_actions_json as string, []),
      receiptInfo: row.receipt_info_json
        ? safeJsonParse<ReceiptInfo | null>(row.receipt_info_json as string, null)
        : null,
      relatedThreadIds: safeJsonParse<string[]>(row.related_thread_ids_json as string, []),
      senderTrust: (row.sender_trust as SenderTrust) || 'approved',
    };
    if (includeMessages) {
      thread.messages = this.getMessagesForThread(id);
    }
    return thread;
  }

  public getExternalThreadId(threadId: string): string | null {
    const row = this.db
      .prepare('SELECT external_thread_id FROM threads WHERE id = ?')
      .get(threadId) as { external_thread_id: string | null } | undefined;
    return row?.external_thread_id ?? null;
  }

  public getMessagesForThread(threadId: string): EmailMessage[] {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY sent_at ASC')
      .all(threadId) as Record<string, unknown>[];
    return rows.map((r) => this.mapMessageRow(r));
  }

  public getThreads(opts: ThreadQueryOptions & { q?: string } = {}): EmailThread[] {
    const clauses: string[] = [];
    const params: (string | number)[] = [];

    if (!this.isDemoMode()) {
      clauses.push('is_demo = 0');
    }
    if (opts.accountId && opts.accountId !== 'all') {
      clauses.push('account_id = ?');
      params.push(opts.accountId);
    }
    if (opts.bucket) {
      clauses.push('bucket = ?');
      params.push(opts.bucket);
    }
    if (!opts.includeArchived && opts.bucket !== 'archived') {
      clauses.push('is_archived = 0');
    }
    if (opts.unreadOnly) {
      clauses.push('is_unread = 1');
    }
    if (opts.q && opts.q.trim().length > 0) {
      const needle = `%${opts.q.trim().toLowerCase()}%`;
      clauses.push(
        '(LOWER(subject) LIKE ? OR LOWER(snippet) LIKE ? OR LOWER(participants_json) LIKE ? OR LOWER(COALESCE(distilled_ask, "")) LIKE ? OR LOWER(labels_json) LIKE ?)',
      );
      params.push(needle, needle, needle, needle, needle);
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const limitSql = opts.limit && opts.limit > 0 ? `LIMIT ${Math.floor(opts.limit)}` : '';
    const rows = this.db
      .prepare(
        `SELECT * FROM threads ${whereSql} ORDER BY urgency_score DESC, last_message_at DESC ${limitSql}`,
      )
      .all(...params) as Record<string, unknown>[];

    return rows.map((r) => this.mapThreadRow(r, false));
  }

  public getThreadById(id: string): EmailThread | null {
    const row = this.db.prepare('SELECT * FROM threads WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;
    return this.mapThreadRow(row, true);
  }

  public getThreadDetail(id: string): {
    thread: EmailThread;
    senderHistory: EmailThread[];
    relatedThreads: EmailThread[];
    tasks: ExtractedTask[];
  } | null {
    const thread = this.getThreadById(id);
    if (!thread) return null;

    // Cross-account sender history: find other threads involving any non-self participant
    const selfEmails = new Set(
      this.getAccounts().map((a) => a.email.toLowerCase()),
    );
    const externalSenders = thread.participants
      .map((p) => p.email.toLowerCase())
      .filter((e) => !selfEmails.has(e));

    const allThreads = this.getThreads({ includeArchived: true });
    const senderHistory =
      externalSenders.length > 0
        ? allThreads.filter((other) => {
            if (other.id === thread.id) return false;
            return other.participants.some((p) =>
              externalSenders.includes(p.email.toLowerCase()),
            );
          })
        : [];

    const relatedSet = new Set(thread.relatedThreadIds);
    const relatedThreads = allThreads.filter(
      (other) =>
        other.id !== thread.id &&
        (relatedSet.has(other.id) || other.relatedThreadIds.includes(thread.id)),
    );

    const tasks = this.getTasks(thread.id);

    return { thread, senderHistory, relatedThreads, tasks };
  }

  private captureSnapshots(threadIds: string[]): ThreadSnapshot[] {
    const snapshots: ThreadSnapshot[] = [];
    const stmt = this.db.prepare('SELECT * FROM threads WHERE id = ?');
    for (const id of threadIds) {
      const row = stmt.get(id) as Record<string, unknown> | undefined;
      if (!row) continue;
      snapshots.push({
        id,
        isArchived: Number(row.is_archived) === 1,
        isUnread: Number(row.is_unread) === 1,
        isStarred: Number(row.is_starred) === 1,
        isSnoozedUntil: row.is_snoozed_until ? String(row.is_snoozed_until) : null,
        bucket: row.bucket as PriorityBucket,
        labels: safeJsonParse<string[]>(row.labels_json as string, []),
        senderTrust: (row.sender_trust as SenderTrust) || 'approved',
      });
    }
    return snapshots;
  }

  private createUndoEntry(description: string, payload: UndoPayload): string {
    const undoId = `undo_${crypto.randomUUID().slice(0, 12)}`;
    this.db
      .prepare(
        'INSERT INTO undo_log (id, description, snapshot_json, created_at, undone) VALUES (?, ?, ?, ?, 0)',
      )
      .run(undoId, description, JSON.stringify(payload), new Date().toISOString());
    return undoId;
  }

  public undoAction(undoId: string): UndoActionResult {
    const row = this.db.prepare('SELECT * FROM undo_log WHERE id = ?').get(undoId) as
      | { id: string; snapshot_json: string; undone: number; description: string }
      | undefined;
    if (!row) {
      return { ok: false, restoredCount: 0, message: 'Undo record not found' };
    }
    if (row.undone === 1) {
      return { ok: true, restoredCount: 0, message: 'Already undone' };
    }
    const payload = safeJsonParse<UndoPayload>(row.snapshot_json, { threads: [] });
    this.db.exec('BEGIN');
    try {
      const stmt = this.db.prepare(`
        UPDATE threads
        SET is_archived = ?, is_unread = ?, is_starred = ?, is_snoozed_until = ?,
            bucket = ?, labels_json = ?, sender_trust = ?
        WHERE id = ?
      `);
      for (const snap of payload.threads) {
        stmt.run(
          snap.isArchived ? 1 : 0,
          snap.isUnread ? 1 : 0,
          snap.isStarred ? 1 : 0,
          snap.isSnoozedUntil,
          snap.bucket,
          JSON.stringify(snap.labels),
          snap.senderTrust,
          snap.id,
        );
      }

      if (payload.screener) {
        const scrStmt = this.db.prepare('UPDATE screener SET status = ? WHERE email = ?');
        for (const s of payload.screener) {
          scrStmt.run(s.status, s.email);
        }
      }

      this.db.prepare('UPDATE undo_log SET undone = 1 WHERE id = ?').run(undoId);
      this.db.exec('COMMIT');
      return {
        ok: true,
        restoredCount: payload.threads.length,
        message: `Restored ${payload.threads.length} thread(s)`,
      };
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  public archiveThread(id: string): { thread: EmailThread | null; undoId: string } {
    const snapshots = this.captureSnapshots([id]);
    const undoId = this.createUndoEntry('Archive thread', { threads: snapshots });
    this.db
      .prepare('UPDATE threads SET is_archived = 1, bucket = ? WHERE id = ?')
      .run('archived', id);
    return { thread: this.getThreadById(id), undoId };
  }

  public unarchiveThread(id: string): EmailThread | null {
    const existing = this.getThreadById(id);
    if (!existing) return null;
    const restoredBucket: PriorityBucket =
      existing.bucket === 'archived'
        ? existing.receiptInfo
          ? 'paper_trail'
          : existing.senderTrust === 'feed'
            ? 'feed'
            : 'decision'
        : existing.bucket;
    this.db
      .prepare('UPDATE threads SET is_archived = 0, bucket = ? WHERE id = ?')
      .run(restoredBucket, id);
    return this.getThreadById(id);
  }

  public starThread(id: string, isStarred: boolean): EmailThread | null {
    this.db
      .prepare('UPDATE threads SET is_starred = ? WHERE id = ?')
      .run(isStarred ? 1 : 0, id);
    return this.getThreadById(id);
  }

  public markThreadRead(id: string, isUnread: boolean): EmailThread | null {
    this.db
      .prepare('UPDATE threads SET is_unread = ? WHERE id = ?')
      .run(isUnread ? 1 : 0, id);
    this.db
      .prepare('UPDATE messages SET is_unread = ? WHERE thread_id = ?')
      .run(isUnread ? 1 : 0, id);
    return this.getThreadById(id);
  }

  public snoozeThread(id: string, untilIso: string): { thread: EmailThread | null; undoId: string } {
    const snapshots = this.captureSnapshots([id]);
    const undoId = this.createUndoEntry('Snooze thread', { threads: snapshots });
    this.db
      .prepare('UPDATE threads SET is_snoozed_until = ?, bucket = ? WHERE id = ?')
      .run(untilIso, 'waiting', id);
    return { thread: this.getThreadById(id), undoId };
  }

  public moveThreadBucket(id: string, bucket: PriorityBucket): EmailThread | null {
    const isArchived = bucket === 'archived' ? 1 : 0;
    this.db
      .prepare('UPDATE threads SET bucket = ?, is_archived = ? WHERE id = ?')
      .run(bucket, isArchived, id);
    return this.getThreadById(id);
  }

  public updateThreadIntelligence(
    threadId: string,
    patch: { distilledAsk?: string | null; aiSummaryBullets?: string[] },
  ): void {
    const existing = this.getThreadById(threadId);
    if (!existing) return;
    const nextAsk =
      patch.distilledAsk !== undefined ? patch.distilledAsk : existing.distilledAsk;
    const nextBullets =
      patch.aiSummaryBullets !== undefined
        ? patch.aiSummaryBullets
        : existing.aiSummaryBullets;
    this.db
      .prepare('UPDATE threads SET distilled_ask = ?, ai_summary_bullets_json = ? WHERE id = ?')
      .run(nextAsk, JSON.stringify(nextBullets), threadId);
  }

  public applyBulkAction(
    actionType: BulkActionType,
    threadIds: string[],
    payload?: Record<string, unknown>,
  ): BulkActionResult {
    const uniqueIds = Array.from(new Set(threadIds));
    const snapshots = this.captureSnapshots(uniqueIds);
    const affectedThreadIds = snapshots.map((s) => s.id);
    const undoId = this.createUndoEntry(`Bulk ${actionType} (${affectedThreadIds.length})`, {
      threads: snapshots,
    });

    this.db.exec('BEGIN');
    try {
      for (const snap of snapshots) {
        if (actionType === 'archive') {
          this.db
            .prepare('UPDATE threads SET is_archived = 1, bucket = ? WHERE id = ?')
            .run('archived', snap.id);
        } else if (actionType === 'mark_read') {
          this.db.prepare('UPDATE threads SET is_unread = 0 WHERE id = ?').run(snap.id);
          this.db.prepare('UPDATE messages SET is_unread = 0 WHERE thread_id = ?').run(snap.id);
        } else if (actionType === 'move_bucket') {
          const targetBucket = (payload?.bucket as PriorityBucket) || 'feed';
          const arch = targetBucket === 'archived' ? 1 : 0;
          this.db
            .prepare('UPDATE threads SET bucket = ?, is_archived = ? WHERE id = ?')
            .run(targetBucket, arch, snap.id);
        } else if (actionType === 'snooze') {
          const until =
            typeof payload?.until === 'string'
              ? payload.until
              : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
          this.db
            .prepare('UPDATE threads SET is_snoozed_until = ?, bucket = ? WHERE id = ?')
            .run(until, 'waiting', snap.id);
        } else if (actionType === 'label') {
          const newLabel = String(payload?.label || 'Triaged').trim();
          const labels = Array.from(new Set([...snap.labels, newLabel]));
          this.db
            .prepare('UPDATE threads SET labels_json = ? WHERE id = ?')
            .run(JSON.stringify(labels), snap.id);
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return {
      undoId,
      affectedCount: affectedThreadIds.length,
      affectedThreadIds,
    };
  }

  public appendOutboundMessageToThread(
    threadId: string,
    account: AccountRecord,
    toEmails: string[],
    ccEmails: string[] | undefined,
    subject: string,
    bodyText: string,
  ): void {
    const now = new Date().toISOString();
    const msgId = `msg_out_${crypto.randomUUID().slice(0, 12)}`;
    const isDemo = account.isDemo ? 1 : 0;

    this.db
      .prepare(
        `INSERT INTO messages (
          id, thread_id, account_id, external_id, from_name, from_email,
          to_emails_json, cc_emails_json, subject, snippet, body_text, body_html,
          sent_at, is_unread, is_outbound, attachments_json, is_demo
        ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, NULL, ?, 0, 1, '[]', ?)`,
      )
      .run(
        msgId,
        threadId,
        account.id,
        account.displayName,
        account.email,
        JSON.stringify(toEmails),
        ccEmails ? JSON.stringify(ccEmails) : null,
        subject,
        bodyText.slice(0, 160).replace(/\s+/g, ' ').trim(),
        bodyText,
        now,
        isDemo,
      );

    this.db
      .prepare(
        `UPDATE threads
         SET message_count = message_count + 1,
             last_message_at = ?,
             snippet = ?,
             is_unread = 0,
             bucket = CASE WHEN bucket = 'decision' THEN 'waiting' ELSE bucket END
         WHERE id = ?`,
      )
      .run(now, bodyText.slice(0, 160).replace(/\s+/g, ' ').trim(), threadId);
  }

  // =========================================================================
  // COMMITMENTS, SCREENER, TASKS
  // =========================================================================

  public getCommitments(): CommitmentItem[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM commitments ${where} ORDER BY status ASC, days_open DESC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      threadId: String(r.thread_id),
      accountId: String(r.account_id),
      accountColor: String(r.account_color),
      accountLabel: String(r.account_label),
      direction: r.direction as CommitmentItem['direction'],
      counterpartyName: String(r.counterparty_name),
      counterpartyEmail: String(r.counterparty_email),
      summary: String(r.summary),
      dueLabel: String(r.due_label),
      daysOpen: Number(r.days_open ?? 1),
      status: r.status as CommitmentItem['status'],
      suggestedNudgeDraft: String(r.suggested_nudge_draft),
    }));
  }

  public resolveCommitment(id: string): boolean {
    const info = this.db
      .prepare("UPDATE commitments SET status = 'resolved' WHERE id = ?")
      .run(id);
    return info.changes > 0;
  }

  public reopenCommitment(id: string): boolean {
    const info = this.db
      .prepare("UPDATE commitments SET status = 'open' WHERE id = ? AND status = 'resolved'")
      .run(id);
    return info.changes > 0;
  }

  public createNudgeForCommitment(id: string): DraftItem | null {
    const row = this.db.prepare('SELECT * FROM commitments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;

    const thread = this.getThreadById(String(row.thread_id));
    const subject = thread
      ? thread.subject.startsWith('Re:')
        ? thread.subject
        : `Re: ${thread.subject}`
      : `Following up: ${String(row.summary).slice(0, 60)}`;

    this.db.prepare("UPDATE commitments SET status = 'nudged' WHERE id = ?").run(id);

    return this.saveDraft({
      threadId: String(row.thread_id),
      accountId: String(row.account_id),
      toEmails: [String(row.counterparty_email)],
      subject,
      bodyText: String(row.suggested_nudge_draft),
      tone: 'warm',
      status: 'pending_approval',
      scheduledFor: null,
      createdBy: 'agent',
    });
  }

  public getScreener(): ScreenerSender[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM screener ${where} ORDER BY first_seen_at DESC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      email: String(r.email),
      name: String(r.name),
      domain: String(r.domain),
      accountId: String(r.account_id),
      accountColor: String(r.account_color),
      firstSeenAt: String(r.first_seen_at),
      sampleSubject: String(r.sample_subject),
      sampleSnippet: String(r.sample_snippet),
      threadIds: safeJsonParse<string[]>(r.thread_ids_json as string, []),
      aiRecommendation: r.ai_recommendation as ScreenerSender['aiRecommendation'],
      aiReason: String(r.ai_reason),
      status: r.status as ScreenerSender['status'],
    }));
  }

  public decideScreener(
    email: string,
    decision: 'approved' | 'feed' | 'muted',
  ): { ok: boolean; undoId: string } {
    const row = this.db
      .prepare('SELECT * FROM screener WHERE LOWER(email) = LOWER(?)')
      .get(email) as Record<string, unknown> | undefined;
    if (!row) return { ok: false, undoId: '' };

    const threadIds = safeJsonParse<string[]>(row.thread_ids_json as string, []);
    const snapshots = this.captureSnapshots(threadIds);
    const undoId = this.createUndoEntry(`Screener ${decision} for ${email}`, {
      threads: snapshots,
      screener: [{ email: String(row.email), status: row.status as ScreenerSender['status'] }],
    });

    this.db.exec('BEGIN');
    try {
      this.db
        .prepare('UPDATE screener SET status = ? WHERE email = ?')
        .run(decision, String(row.email));

      for (const tid of threadIds) {
        if (decision === 'approved') {
          this.db
            .prepare("UPDATE threads SET bucket = 'decision', sender_trust = 'approved', is_archived = 0 WHERE id = ?")
            .run(tid);
        } else if (decision === 'feed') {
          this.db
            .prepare("UPDATE threads SET bucket = 'feed', sender_trust = 'feed', is_archived = 0 WHERE id = ?")
            .run(tid);
        } else {
          this.db
            .prepare("UPDATE threads SET bucket = 'archived', sender_trust = 'muted', is_archived = 1 WHERE id = ?")
            .run(tid);
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }

    return { ok: true, undoId };
  }

  public getTasks(threadId?: string): ExtractedTask[] {
    const clauses: string[] = [];
    const params: string[] = [];
    if (!this.isDemoMode()) {
      clauses.push('is_demo = 0');
    }
    if (threadId) {
      clauses.push('thread_id = ?');
      params.push(threadId);
    }
    const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
    const rows = this.db
      .prepare(`SELECT * FROM tasks ${where} ORDER BY completed ASC, priority ASC`)
      .all(...params) as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      threadId: String(r.thread_id),
      accountId: String(r.account_id),
      title: String(r.title),
      dueLabel: r.due_label ? String(r.due_label) : null,
      completed: Number(r.completed) === 1,
      priority: r.priority as ExtractedTask['priority'],
    }));
  }

  public saveTask(task: Omit<ExtractedTask, 'id'> & { id?: string }): ExtractedTask {
    const id = task.id || `tsk_${crypto.randomUUID().slice(0, 10)}`;
    const acc = this.getAccountRecordById(task.accountId);
    const isDemo = acc?.isDemo ? 1 : 0;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO tasks (id, thread_id, account_id, title, due_label, completed, priority, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        task.threadId,
        task.accountId,
        task.title,
        task.dueLabel ?? null,
        task.completed ? 1 : 0,
        task.priority || 'medium',
        isDemo,
      );
    return { ...task, id };
  }

  public updateTask(
    id: string,
    patch: Partial<Pick<ExtractedTask, 'completed' | 'title' | 'priority' | 'dueLabel'>>,
  ): ExtractedTask | null {
    const row = this.db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;

    const nextTitle = patch.title ?? String(row.title);
    const nextCompleted =
      patch.completed !== undefined ? (patch.completed ? 1 : 0) : Number(row.completed);
    const nextPriority = patch.priority ?? (row.priority as ExtractedTask['priority']);
    const nextDue =
      patch.dueLabel !== undefined
        ? patch.dueLabel
        : row.due_label
          ? String(row.due_label)
          : null;

    this.db
      .prepare('UPDATE tasks SET title = ?, completed = ?, priority = ?, due_label = ? WHERE id = ?')
      .run(nextTitle, nextCompleted, nextPriority, nextDue, id);

    return {
      id,
      threadId: String(row.thread_id),
      accountId: String(row.account_id),
      title: nextTitle,
      dueLabel: nextDue,
      completed: nextCompleted === 1,
      priority: nextPriority,
    };
  }

  // =========================================================================
  // DRAFTS
  // =========================================================================

  private mapDraftRow(r: Record<string, unknown>): DraftItem {
    return {
      id: String(r.id),
      threadId: r.thread_id ? String(r.thread_id) : null,
      accountId: String(r.account_id),
      toEmails: safeJsonParse<string[]>(r.to_emails_json as string, []),
      ccEmails: r.cc_emails_json
        ? safeJsonParse<string[]>(r.cc_emails_json as string, [])
        : undefined,
      subject: String(r.subject),
      bodyText: String(r.body_text),
      tone: (r.tone as DraftItem['tone']) || undefined,
      status: r.status as DraftItem['status'],
      scheduledFor: r.scheduled_for ? String(r.scheduled_for) : null,
      createdBy: (r.created_by as DraftItem['createdBy']) || 'user',
      createdAt: String(r.created_at),
    };
  }

  public getDrafts(): DraftItem[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM drafts ${where} ORDER BY created_at DESC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => this.mapDraftRow(r));
  }

  public getDraftById(id: string): DraftItem | null {
    const row = this.db.prepare('SELECT * FROM drafts WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapDraftRow(row) : null;
  }

  public saveDraft(
    draft: Omit<DraftItem, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): DraftItem {
    const id = draft.id || `drf_${crypto.randomUUID().slice(0, 10)}`;
    const createdAt = draft.createdAt || new Date().toISOString();
    const acc = this.getAccountRecordById(draft.accountId);
    const isDemo = acc?.isDemo ? 1 : 0;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO drafts (
          id, thread_id, account_id, to_emails_json, cc_emails_json,
          subject, body_text, tone, status, scheduled_for, created_by, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        draft.threadId ?? null,
        draft.accountId,
        JSON.stringify(draft.toEmails),
        draft.ccEmails ? JSON.stringify(draft.ccEmails) : null,
        draft.subject,
        draft.bodyText,
        draft.tone ?? null,
        draft.status || 'draft',
        draft.scheduledFor ?? null,
        draft.createdBy || 'user',
        createdAt,
        isDemo,
      );
    return this.getDraftById(id)!;
  }

  public updateDraft(
    id: string,
    patch: Partial<
      Pick<
        DraftItem,
        'toEmails' | 'ccEmails' | 'subject' | 'bodyText' | 'status' | 'scheduledFor' | 'accountId' | 'tone'
      >
    >,
  ): DraftItem | null {
    const existing = this.getDraftById(id);
    if (!existing) return null;
    return this.saveDraft({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
    });
  }

  public deleteDraft(id: string): boolean {
    const info = this.db.prepare('DELETE FROM drafts WHERE id = ?').run(id);
    return info.changes > 0;
  }

  // =========================================================================
  // AGENT RULES, CUSTOM VIEWS & PROPOSALS
  // =========================================================================

  public getRules(): AgentRule[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM rules ${where} ORDER BY created_at DESC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      naturalLanguage: String(r.natural_language),
      enabled: Number(r.enabled) === 1,
      matchCount: Number(r.match_count ?? 0),
      createdAt: String(r.created_at),
    }));
  }

  public saveRule(
    rule: Omit<AgentRule, 'id' | 'createdAt' | 'matchCount'> & {
      id?: string;
      matchCount?: number;
      createdAt?: string;
    },
  ): AgentRule {
    const id = rule.id || `rule_${crypto.randomUUID().slice(0, 10)}`;
    const createdAt = rule.createdAt || new Date().toISOString();
    const matchCount = rule.matchCount ?? 0;
    this.db
      .prepare(
        `INSERT OR REPLACE INTO rules (id, name, natural_language, enabled, match_count, created_at, is_demo)
         VALUES (?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(id, rule.name, rule.naturalLanguage, rule.enabled ? 1 : 0, matchCount, createdAt);
    return {
      id,
      name: rule.name,
      naturalLanguage: rule.naturalLanguage,
      enabled: rule.enabled,
      matchCount,
      createdAt,
    };
  }

  public updateRule(
    id: string,
    patch: Partial<Pick<AgentRule, 'name' | 'naturalLanguage' | 'enabled' | 'matchCount'>>,
  ): AgentRule | null {
    const row = this.db.prepare('SELECT * FROM rules WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return null;

    const next: AgentRule = {
      id,
      name: patch.name ?? String(row.name),
      naturalLanguage: patch.naturalLanguage ?? String(row.natural_language),
      enabled: patch.enabled !== undefined ? patch.enabled : Number(row.enabled) === 1,
      matchCount: patch.matchCount ?? Number(row.match_count ?? 0),
      createdAt: String(row.created_at),
    };
    this.db
      .prepare(
        'UPDATE rules SET name = ?, natural_language = ?, enabled = ?, match_count = ? WHERE id = ?',
      )
      .run(next.name, next.naturalLanguage, next.enabled ? 1 : 0, next.matchCount, id);
    return next;
  }

  public toggleRule(id: string, enabled?: boolean): AgentRule | null {
    const row = this.db.prepare('SELECT enabled FROM rules WHERE id = ?').get(id) as
      | { enabled: number }
      | undefined;
    if (!row) return null;
    const nextEnabled = enabled !== undefined ? enabled : row.enabled !== 1;
    return this.updateRule(id, { enabled: nextEnabled });
  }

  public deleteRule(id: string): boolean {
    const info = this.db.prepare('DELETE FROM rules WHERE id = ?').run(id);
    return info.changes > 0;
  }

  public getCustomViews(): CustomView[] {
    const where = this.isDemoMode() ? '' : 'WHERE is_demo = 0';
    const rows = this.db
      .prepare(`SELECT * FROM custom_views ${where} ORDER BY created_at DESC`)
      .all() as Record<string, unknown>[];
    return rows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      icon: String(r.icon),
      queryDescription: String(r.query_description),
      filterSpec: safeJsonParse<Record<string, unknown>>(r.filter_spec_json as string, {}),
      threadIds: r.thread_ids_json
        ? safeJsonParse<string[]>(r.thread_ids_json as string, [])
        : undefined,
      createdAt: String(r.created_at),
    }));
  }

  public saveCustomView(
    view: Omit<CustomView, 'id' | 'createdAt'> & { id?: string; createdAt?: string },
  ): CustomView {
    const id = view.id || `view_${crypto.randomUUID().slice(0, 10)}`;
    const createdAt = view.createdAt || new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO custom_views (
          id, name, icon, query_description, filter_spec_json, thread_ids_json, created_at, is_demo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      )
      .run(
        id,
        view.name,
        view.icon || 'sparkles',
        view.queryDescription,
        JSON.stringify(view.filterSpec || {}),
        view.threadIds ? JSON.stringify(view.threadIds) : null,
        createdAt,
      );
    return {
      id,
      name: view.name,
      icon: view.icon || 'sparkles',
      queryDescription: view.queryDescription,
      filterSpec: view.filterSpec || {},
      threadIds: view.threadIds,
      createdAt,
    };
  }

  public saveProposal(proposal: StoredProposal): void {
    this.db
      .prepare('INSERT OR REPLACE INTO proposals (id, data_json, created_at) VALUES (?, ?, ?)')
      .run(proposal.id, JSON.stringify(proposal), proposal.createdAt || new Date().toISOString());
  }

  public getProposal(id: string): StoredProposal | null {
    const row = this.db.prepare('SELECT data_json FROM proposals WHERE id = ?').get(id) as
      | { data_json: string }
      | undefined;
    return row ? safeJsonParse<StoredProposal | null>(row.data_json, null) : null;
  }

  // =========================================================================
  // AGENT CONTEXT ADAPTER FOR @claude-agent
  // =========================================================================

  public createAgentContext(): AgentContext {
    return {
      getThreads: (opts) => this.getThreads(opts),
      getThreadById: (id) => this.getThreadById(id),
      updateThreadIntelligence: (threadId, patch) =>
        this.updateThreadIntelligence(threadId, patch),
      getAccounts: () => this.getAccounts(),
      getCommitments: () => this.getCommitments(),
      getScreener: () => this.getScreener(),
      getTasks: (threadId) => this.getTasks(threadId),
      saveTask: (task) => this.saveTask(task),
      getRules: () => this.getRules(),
      saveRule: (rule) => this.saveRule(rule),
      deleteRule: (id) => this.deleteRule(id),
      toggleRule: (id, enabled) => this.toggleRule(id, enabled),
      updateRule: (id, patch) => this.updateRule(id, patch),
      getCustomViews: () => this.getCustomViews(),
      saveCustomView: (view) => this.saveCustomView(view),
      saveDraft: (draft) => this.saveDraft(draft),
      applyBulkAction: (actionType, threadIds, payload) =>
        this.applyBulkAction(actionType, threadIds, payload),
      undoAction: (undoId) => this.undoAction(undoId),
      getSetting: (key) => this.getSetting(key),
      setSetting: (key, value) => this.setSetting(key, value),
      getShabbosStatus: () => this.getShabbosStatus(),
      saveProposal: (proposal) => this.saveProposal(proposal),
      getProposal: (id) => this.getProposal(id),
    };
  }
}
