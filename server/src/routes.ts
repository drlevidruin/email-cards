import crypto from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { DraftItem, PriorityBucket } from '../../shared/types.js';
import { SETTING_KEYS } from './agent/types.js';
import type { AccountRecord, PrismDatabase } from './db.js';
import {
  sendGmailImapMessage,
  syncGmailImapAccount,
  updateGmailImapFlags,
  verifyGmailImapCredentials,
} from './gmailImap.js';
import {
  buildGoogleAuthUrl,
  ensureFreshAccessToken,
  exchangeCodeForTokens,
  fetchGoogleUserProfile,
  modifyGmailOAuthThread,
  renderOAuthCallbackHtml,
  sendGmailOAuthMessage,
  syncGmailOAuthAccount,
} from './gmailOAuth.js';
import { isOutboundRestricted, sanitizeTimezone } from './shabbosGuard.js';

const ACCOUNT_PALETTE = ['#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#fb7185', '#2dd4bf'];

interface PendingOAuthState {
  label?: string;
  color?: string;
  createdAt: number;
}

const pendingOAuthStates = new Map<string, PendingOAuthState>();

function getGoogleOAuthConfig(db: PrismDatabase): { clientId: string; clientSecret: string } {
  const clientId = (db.getSetting('googleClientId') || process.env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (
    db.getSetting('googleClientSecret') ||
    process.env.GOOGLE_CLIENT_SECRET ||
    ''
  ).trim();
  return { clientId, clientSecret };
}

async function syncSingleAccount(
  db: PrismDatabase,
  account: AccountRecord,
): Promise<{ syncedCount: number }> {
  if (account.provider === 'demo') {
    db.updateAccount(account.id, { lastSyncedAt: new Date().toISOString(), status: 'demo' });
    return { syncedCount: 0 };
  }

  db.updateAccount(account.id, { status: 'syncing' });

  try {
    if (account.provider === 'gmail_oauth') {
      const { clientId, clientSecret } = getGoogleOAuthConfig(db);
      if (!clientId || !clientSecret) {
        throw new Error('Google OAuth Client ID and Secret must be configured to sync.');
      }
      const accessToken = await ensureFreshAccessToken(
        {
          accessToken: account.credentials.accessToken || '',
          refreshToken: account.credentials.refreshToken,
          expiryDate: account.credentials.expiryDate,
        },
        clientId,
        clientSecret,
        (refreshed) => {
          db.updateAccount(account.id, {
            credentials: { ...account.credentials, ...refreshed },
          });
        },
      );
      const { threads, messages, externalMap } = await syncGmailOAuthAccount(
        accessToken,
        db.toPublicAccount(account),
        35,
      );
      const syncedCount = db.saveSyncedAccountData(account.id, threads, messages, externalMap);
      return { syncedCount };
    }

    if (account.provider === 'gmail_imap') {
      const appPassword = account.credentials.appPassword || '';
      if (!appPassword) {
        throw new Error('Missing stored Gmail App Password for this account.');
      }
      const { threads, messages } = await syncGmailImapAccount(
        account.email,
        appPassword,
        db.toPublicAccount(account),
        40,
      );
      const syncedCount = db.saveSyncedAccountData(account.id, threads, messages);
      return { syncedCount };
    }

    return { syncedCount: 0 };
  } catch (err) {
    db.updateAccount(account.id, { status: 'error' });
    throw err;
  }
}

async function mirrorThreadMutationToProvider(
  db: PrismDatabase,
  threadId: string,
  action: 'archive' | 'unarchive' | 'star' | 'unstar' | 'mark_read' | 'mark_unread',
): Promise<void> {
  const thread = db.getThreadById(threadId);
  if (!thread) return;
  const account = db.getAccountRecordById(thread.accountId);
  if (!account || account.provider === 'demo') return;

  try {
    if (account.provider === 'gmail_oauth') {
      const externalThreadId = db.getExternalThreadId(threadId);
      if (!externalThreadId) return;
      const { clientId, clientSecret } = getGoogleOAuthConfig(db);
      if (!clientId || !clientSecret) return;
      const accessToken = await ensureFreshAccessToken(
        {
          accessToken: account.credentials.accessToken || '',
          refreshToken: account.credentials.refreshToken,
          expiryDate: account.credentials.expiryDate,
        },
        clientId,
        clientSecret,
        (refreshed) => {
          db.updateAccount(account.id, {
            credentials: { ...account.credentials, ...refreshed },
          });
        },
      );
      if (action === 'archive') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, [], ['INBOX']);
      } else if (action === 'unarchive') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, ['INBOX'], []);
      } else if (action === 'star') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, ['STARRED'], []);
      } else if (action === 'unstar') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, [], ['STARRED']);
      } else if (action === 'mark_read') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, [], ['UNREAD']);
      } else if (action === 'mark_unread') {
        await modifyGmailOAuthThread(accessToken, externalThreadId, ['UNREAD'], []);
      }
    } else if (account.provider === 'gmail_imap' && action !== 'unarchive') {
      const appPassword = account.credentials.appPassword;
      if (!appPassword) return;
      const messages = db.getMessagesForThread(threadId);
      const uids = messages
        .map((m) => Number(m.externalId))
        .filter((n) => Number.isInteger(n) && n > 0);
      if (uids.length > 0) {
        await updateGmailImapFlags(account.email, appPassword, uids, action);
      }
    }
  } catch (err) {
    console.warn(`[provider-sync] Non-fatal mirror error for ${action}:`, err);
  }
}

export async function dispatchDraftNow(
  db: PrismDatabase,
  draft: DraftItem,
): Promise<DraftItem> {
  const account =
    db.getAccountRecordById(draft.accountId) ||
    (() => {
      const list = db.getAccounts();
      return list.length > 0 ? db.getAccountRecordById(list[0].id) : null;
    })();

  if (!account) {
    throw new Error('No sender Gmail account found for this draft.');
  }

  if (account.provider === 'gmail_oauth') {
    const { clientId, clientSecret } = getGoogleOAuthConfig(db);
    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth credentials are missing in Settings.');
    }
    const accessToken = await ensureFreshAccessToken(
      {
        accessToken: account.credentials.accessToken || '',
        refreshToken: account.credentials.refreshToken,
        expiryDate: account.credentials.expiryDate,
      },
      clientId,
      clientSecret,
      (refreshed) => {
        db.updateAccount(account.id, {
          credentials: { ...account.credentials, ...refreshed },
        });
      },
    );
    const externalThreadId = draft.threadId
      ? db.getExternalThreadId(draft.threadId) || undefined
      : undefined;
    await sendGmailOAuthMessage(accessToken, {
      fromEmail: account.email,
      fromName: account.displayName,
      toEmails: draft.toEmails,
      ccEmails: draft.ccEmails,
      subject: draft.subject,
      bodyText: draft.bodyText,
      externalThreadId,
    });
  } else if (account.provider === 'gmail_imap') {
    const appPassword = account.credentials.appPassword;
    if (!appPassword) {
      throw new Error('Gmail App Password is missing for this account.');
    }
    await sendGmailImapMessage(account.email, appPassword, {
      fromName: account.displayName,
      toEmails: draft.toEmails,
      ccEmails: draft.ccEmails,
      subject: draft.subject,
      bodyText: draft.bodyText,
    });
  }

  // Record sent status and append outbound message to local thread view
  const updated = db.updateDraft(draft.id, {
    status: 'sent',
    scheduledFor: null,
  })!;

  if (draft.threadId) {
    db.appendOutboundMessageToThread(
      draft.threadId,
      account,
      draft.toEmails,
      draft.ccEmails,
      draft.subject,
      draft.bodyText,
    );
  }

  return updated;
}

export async function releaseHeldShabbosDrafts(db: PrismDatabase): Promise<number> {
  const settings = db.getAppSettings();
  const now = new Date();
  if (settings.shabbosGuardEnabled) {
    const check = isOutboundRestricted(now, settings.shabbosTimezone);
    if (check.restricted) {
      return 0;
    }
  }

  const drafts = db.getDrafts().filter((d) => d.status === 'held_shabbos');
  let released = 0;
  for (const draft of drafts) {
    const ready =
      !draft.scheduledFor || new Date(draft.scheduledFor).getTime() <= now.getTime();
    if (!ready) continue;
    try {
      await dispatchDraftNow(db, draft);
      released++;
    } catch (err) {
      console.error(`[shabbos-guard] Failed to release draft ${draft.id}:`, err);
    }
  }
  return released;
}

export function createApiRouter(db: PrismDatabase): Router {
  const router = Router();

  // Health
  router.get('/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'prism-mail',
      timestamp: new Date().toISOString(),
    });
  });

  // Bootstrap: one fast initial payload for the whole client shell
  router.get('/bootstrap', (_req: Request, res: Response) => {
    res.json({
      accounts: db.getAccounts(),
      threads: db.getThreads(),
      commitments: db.getCommitments(),
      screener: db.getScreener(),
      tasks: db.getTasks(),
      drafts: db.getDrafts(),
      rules: db.getRules(),
      customViews: db.getCustomViews(),
      settings: db.getAppSettings(),
      shabbosStatus: db.getShabbosStatus(),
    });
  });

  // =========================================================================
  // THREADS
  // =========================================================================

  router.get('/threads', (req: Request, res: Response) => {
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined;
    const bucket = typeof req.query.bucket === 'string' ? (req.query.bucket as PriorityBucket) : undefined;
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const includeArchived = req.query.includeArchived === '1' || req.query.includeArchived === 'true';
    const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
    const limit = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;

    const threads = db.getThreads({
      accountId,
      bucket,
      q,
      includeArchived,
      unreadOnly,
      limit: Number.isFinite(limit) ? limit : undefined,
    });
    res.json(threads);
  });

  router.post('/threads/bulk-archive', (req: Request, res: Response) => {
    const threadIds = Array.isArray(req.body?.threadIds)
      ? (req.body.threadIds as unknown[]).map(String).filter(Boolean)
      : [];
    if (threadIds.length === 0) {
      res.status(400).json({ error: 'threadIds array is required' });
      return;
    }
    const result = db.applyBulkAction('archive', threadIds);
    for (const tid of result.affectedThreadIds) {
      void mirrorThreadMutationToProvider(db, tid, 'archive');
    }
    res.json({
      ok: true,
      undoId: result.undoId,
      count: result.affectedCount,
      affectedThreadIds: result.affectedThreadIds,
    });
  });

  router.get('/threads/:id', (req: Request, res: Response) => {
    const detail = db.getThreadDetail(req.params.id);
    if (!detail) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    res.json(detail);
  });

  router.post('/threads/:id/archive', (req: Request, res: Response) => {
    const { thread, undoId } = db.archiveThread(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    void mirrorThreadMutationToProvider(db, req.params.id, 'archive');
    res.json({ ok: true, undoId, thread });
  });

  router.post('/threads/:id/unarchive', (req: Request, res: Response) => {
    const thread = db.unarchiveThread(req.params.id);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    void mirrorThreadMutationToProvider(db, req.params.id, 'unarchive');
    res.json({ ok: true, thread });
  });

  router.post('/threads/:id/star', (req: Request, res: Response) => {
    const isStarred =
      typeof req.body?.isStarred === 'boolean'
        ? req.body.isStarred
        : typeof req.body?.starred === 'boolean'
          ? req.body.starred
          : true;
    const thread = db.starThread(req.params.id, isStarred);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    void mirrorThreadMutationToProvider(db, req.params.id, isStarred ? 'star' : 'unstar');
    res.json({ ok: true, thread });
  });

  router.post('/threads/:id/read', (req: Request, res: Response) => {
    let isUnread = false;
    if (typeof req.body?.isUnread === 'boolean') {
      isUnread = req.body.isUnread;
    } else if (typeof req.body?.read === 'boolean') {
      isUnread = !req.body.read;
    }
    const thread = db.markThreadRead(req.params.id, isUnread);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    void mirrorThreadMutationToProvider(
      db,
      req.params.id,
      isUnread ? 'mark_unread' : 'mark_read',
    );
    res.json({ ok: true, thread });
  });

  router.post('/threads/:id/snooze', (req: Request, res: Response) => {
    const rawUntil = req.body?.until || req.body?.snoozedUntil;
    const until =
      typeof rawUntil === 'string' && rawUntil.trim()
        ? rawUntil.trim()
        : new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const { thread, undoId } = db.snoozeThread(req.params.id, until);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    res.json({ ok: true, undoId, thread });
  });

  router.post('/threads/:id/bucket', (req: Request, res: Response) => {
    const bucket = req.body?.bucket as PriorityBucket | undefined;
    const valid: PriorityBucket[] = [
      'decision',
      'waiting',
      'feed',
      'paper_trail',
      'screener',
      'archived',
    ];
    if (!bucket || !valid.includes(bucket)) {
      res.status(400).json({ error: 'Invalid priority bucket' });
      return;
    }
    const thread = db.moveThreadBucket(req.params.id, bucket);
    if (!thread) {
      res.status(404).json({ error: 'Thread not found' });
      return;
    }
    res.json({ ok: true, thread });
  });

  // =========================================================================
  // ACCOUNTS & REAL GMAIL AUTH (IMAP + GOOGLE OAUTH2)
  // =========================================================================

  router.get('/accounts', (_req: Request, res: Response) => {
    res.json(db.getAccounts());
  });

  router.post('/accounts/imap', async (req: Request, res: Response) => {
    try {
      const email = String(req.body?.email || '').trim().toLowerCase();
      const appPassword = String(req.body?.appPassword || '').trim();
      const label = String(req.body?.label || email.split('@')[0] || 'Gmail').trim();
      const color = String(req.body?.color || ACCOUNT_PALETTE[0]).trim();
      const displayName = String(req.body?.displayName || label).trim();

      await verifyGmailImapCredentials(email, appPassword);

      const existing = db.getAccountRecordByEmail(email);
      const id = existing ? existing.id : `acc_imap_${crypto.randomUUID().slice(0, 8)}`;

      const saved = db.upsertAccount(
        {
          id,
          email,
          displayName,
          label,
          color,
          provider: 'gmail_imap',
          status: 'connected',
          lastSyncedAt: null,
          signature: existing?.signature,
          isDemo: false,
        },
        { appPassword: appPassword.replace(/\s+/g, '') },
      );

      const record = db.getAccountRecordById(saved.id)!;
      const { syncedCount } = await syncSingleAccount(db, record);
      const refreshed = db.toPublicAccount(db.getAccountRecordById(saved.id)!);

      res.json({
        account: refreshed,
        syncedCount,
        message: `Connected ${email} and synced ${syncedCount} recent threads.`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to connect Gmail account';
      res.status(400).json({ error: message });
    }
  });

  router.patch('/accounts/:id', (req: Request, res: Response) => {
    const patch: Record<string, string | undefined> = {};
    if (typeof req.body?.label === 'string') patch.label = req.body.label.trim();
    if (typeof req.body?.color === 'string') patch.color = req.body.color.trim();
    if (typeof req.body?.signature === 'string') patch.signature = req.body.signature;
    if (typeof req.body?.displayName === 'string') patch.displayName = req.body.displayName.trim();

    const account = db.updateAccount(req.params.id, patch);
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ account, ...account });
  });

  router.delete('/accounts/:id', (req: Request, res: Response) => {
    const ok = db.deleteAccount(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/accounts/sync-all', async (_req: Request, res: Response) => {
    const accounts = db.getAccounts();
    let totalSynced = 0;
    for (const acc of accounts) {
      const rec = db.getAccountRecordById(acc.id);
      if (!rec) continue;
      try {
        const { syncedCount } = await syncSingleAccount(db, rec);
        totalSynced += syncedCount;
      } catch (err) {
        console.warn(`[sync-all] Account ${acc.email} failed:`, err);
      }
    }
    res.json({
      ok: true,
      syncedCount: totalSynced,
      accounts: db.getAccounts(),
    });
  });

  router.post('/accounts/:id/sync', async (req: Request, res: Response) => {
    const rec = db.getAccountRecordById(req.params.id);
    if (!rec) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    try {
      const { syncedCount } = await syncSingleAccount(db, rec);
      const updated = db.toPublicAccount(db.getAccountRecordById(rec.id)!);
      res.json({ ok: true, syncedCount, account: updated });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      res.status(500).json({ error: message });
    }
  });

  // Google OAuth2 flow
  router.get('/auth/google/url', (req: Request, res: Response) => {
    const { clientId, clientSecret } = getGoogleOAuthConfig(db);
    if (!clientId || !clientSecret) {
      res.json({
        configured: false,
        error:
          'Google OAuth Client ID and Client Secret are not configured yet. Save them in Connect Gmail -> Google OAuth2 first.',
      });
      return;
    }

    const state = crypto.randomUUID();
    pendingOAuthStates.set(state, {
      label: typeof req.query.label === 'string' ? req.query.label : undefined,
      color: typeof req.query.color === 'string' ? req.query.color : undefined,
      createdAt: Date.now(),
    });

    // Prune stale states older than 15 minutes
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [key, val] of pendingOAuthStates.entries()) {
      if (val.createdAt < cutoff) pendingOAuthStates.delete(key);
    }

    const url = buildGoogleAuthUrl(clientId, state);
    res.json({ configured: true, url });
  });

  router.get('/auth/google/callback', async (req: Request, res: Response) => {
    const errParam = typeof req.query.error === 'string' ? req.query.error : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const state = typeof req.query.state === 'string' ? req.query.state : '';

    if (errParam) {
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(renderOAuthCallbackHtml(false, { error: errParam }));
      return;
    }

    if (!code) {
      res.setHeader('Content-Type', 'text/html');
      res.status(400).send(renderOAuthCallbackHtml(false, { error: 'Missing authorization code' }));
      return;
    }

    const stateMeta = pendingOAuthStates.get(state);
    pendingOAuthStates.delete(state);

    const { clientId, clientSecret } = getGoogleOAuthConfig(db);
    if (!clientId || !clientSecret) {
      res.setHeader('Content-Type', 'text/html');
      res
        .status(400)
        .send(renderOAuthCallbackHtml(false, { error: 'Google OAuth credentials not configured' }));
      return;
    }

    try {
      const tokens = await exchangeCodeForTokens(code, clientId, clientSecret);
      const profile = await fetchGoogleUserProfile(tokens.accessToken);
      const existing = db.getAccountRecordByEmail(profile.email);
      const existingCount = db.getAccounts().length;

      const id = existing ? existing.id : `acc_oauth_${crypto.randomUUID().slice(0, 8)}`;
      const label = stateMeta?.label || existing?.label || profile.name.split(' ')[0] || 'Gmail';
      const color =
        stateMeta?.color ||
        existing?.color ||
        ACCOUNT_PALETTE[existingCount % ACCOUNT_PALETTE.length];

      db.upsertAccount(
        {
          id,
          email: profile.email,
          displayName: profile.name,
          label,
          color,
          provider: 'gmail_oauth',
          status: 'connected',
          lastSyncedAt: null,
          signature: existing?.signature,
          isDemo: false,
        },
        {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken || existing?.credentials.refreshToken,
          expiryDate: tokens.expiryDate,
        },
      );

      // Perform initial sync right away (non-fatal if quota/network hiccups)
      const record = db.getAccountRecordById(id)!;
      try {
        await syncSingleAccount(db, record);
      } catch (syncErr) {
        console.warn('[oauth-callback] Initial sync warning:', syncErr);
      }

      res.setHeader('Content-Type', 'text/html');
      res.send(renderOAuthCallbackHtml(true, { email: profile.email, accountId: id }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google OAuth callback error';
      res.setHeader('Content-Type', 'text/html');
      res.status(500).send(renderOAuthCallbackHtml(false, { error: message }));
    }
  });

  // =========================================================================
  // DRAFTS & SHABBOS-GUARDED OUTBOUND SENDING
  // =========================================================================

  router.get('/drafts', (_req: Request, res: Response) => {
    res.json(db.getDrafts());
  });

  router.post('/drafts', (req: Request, res: Response) => {
    const toEmails = Array.isArray(req.body?.toEmails)
      ? (req.body.toEmails as unknown[]).map(String).filter(Boolean)
      : [];
    const ccEmails = Array.isArray(req.body?.ccEmails)
      ? (req.body.ccEmails as unknown[]).map(String).filter(Boolean)
      : undefined;
    const accounts = db.getAccounts();
    const accountId = String(req.body?.accountId || accounts[0]?.id || 'acc_studio');
    const subject = String(req.body?.subject || '(No subject)');
    const bodyText = String(req.body?.bodyText || '');
    const threadId = req.body?.threadId ? String(req.body.threadId) : null;
    const tone = req.body?.tone as DraftItem['tone'];
    let status = (req.body?.status as DraftItem['status']) || 'draft';
    let scheduledFor = req.body?.scheduledFor ? String(req.body.scheduledFor) : null;
    const createdBy = req.body?.createdBy === 'agent' ? 'agent' : 'user';

    // If explicitly scheduled during a Shabbos/Yom Tov window, hold until Havdalah
    const settings = db.getAppSettings();
    if (scheduledFor && settings.shabbosGuardEnabled) {
      const check = isOutboundRestricted(new Date(scheduledFor), settings.shabbosTimezone);
      if (check.restricted) {
        status = 'held_shabbos';
        scheduledFor = check.windowEnd;
      }
    }

    const draft = db.saveDraft({
      threadId,
      accountId,
      toEmails,
      ccEmails,
      subject,
      bodyText,
      tone,
      status,
      scheduledFor,
      createdBy,
    });
    res.status(201).json(draft);
  });

  router.patch('/drafts/:id', (req: Request, res: Response) => {
    const existing = db.getDraftById(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    const patch: Partial<DraftItem> = {};
    if (Array.isArray(req.body?.toEmails)) {
      patch.toEmails = (req.body.toEmails as unknown[]).map(String).filter(Boolean);
    }
    if (Array.isArray(req.body?.ccEmails)) {
      patch.ccEmails = (req.body.ccEmails as unknown[]).map(String).filter(Boolean);
    }
    if (typeof req.body?.subject === 'string') patch.subject = req.body.subject;
    if (typeof req.body?.bodyText === 'string') patch.bodyText = req.body.bodyText;
    if (typeof req.body?.accountId === 'string') patch.accountId = req.body.accountId;
    if (typeof req.body?.status === 'string') patch.status = req.body.status as DraftItem['status'];
    if (req.body?.scheduledFor !== undefined) {
      patch.scheduledFor = req.body.scheduledFor ? String(req.body.scheduledFor) : null;
    }

    const settings = db.getAppSettings();
    if (patch.scheduledFor && settings.shabbosGuardEnabled) {
      const check = isOutboundRestricted(new Date(patch.scheduledFor), settings.shabbosTimezone);
      if (check.restricted) {
        patch.status = 'held_shabbos';
        patch.scheduledFor = check.windowEnd;
      }
    }

    const updated = db.updateDraft(req.params.id, patch);
    res.json(updated);
  });

  router.delete('/drafts/:id', (req: Request, res: Response) => {
    const ok = db.deleteDraft(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/drafts/:id/send', async (req: Request, res: Response) => {
    const draft = db.getDraftById(req.params.id);
    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }
    if (draft.toEmails.length === 0) {
      res.status(400).json({ error: 'Draft must include at least one recipient email.' });
      return;
    }

    const overrideShabbos = Boolean(req.body?.overrideShabbos);
    const requestedSchedule =
      typeof req.body?.scheduledFor === 'string' && req.body.scheduledFor.trim()
        ? req.body.scheduledFor.trim()
        : null;
    const settings = db.getAppSettings();

    if (settings.shabbosGuardEnabled && !overrideShabbos) {
      // Always check the current wall-clock time so held_shabbos drafts cannot
      // bypass the guard via their post-Havdalah scheduledFor timestamp.
      const nowCheck = isOutboundRestricted(new Date(), settings.shabbosTimezone);
      const scheduleTarget =
        requestedSchedule || (draft.status !== 'held_shabbos' ? draft.scheduledFor : null);
      const scheduleCheck = scheduleTarget
        ? isOutboundRestricted(new Date(scheduleTarget), settings.shabbosTimezone)
        : null;
      const activeRestriction = nowCheck.restricted
        ? nowCheck
        : scheduleCheck?.restricted
          ? scheduleCheck
          : null;

      if (activeRestriction) {
        const held = db.updateDraft(draft.id, {
          status: 'held_shabbos',
          scheduledFor: activeRestriction.windowEnd,
        })!;
        res.json({
          ok: true,
          status: 'held_shabbos',
          heldByShabbos: true,
          scheduledFor: activeRestriction.windowEnd,
          draft: held,
          message:
            activeRestriction.reason ||
            'Held by Shabbos and Yom Tov Guard. Scheduled for automatic release after Havdalah.',
        });
        return;
      }
    }

    try {
      const sent = await dispatchDraftNow(db, draft);
      res.json({
        ok: true,
        status: 'sent',
        heldByShabbos: false,
        scheduledFor: null,
        draft: sent,
        message: 'Email sent successfully.',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send draft';
      res.status(500).json({ error: message });
    }
  });

  // =========================================================================
  // SCREENER, TASKS, COMMITMENTS
  // =========================================================================

  router.post('/screener/:email/decide', (req: Request, res: Response) => {
    const decision = req.body?.decision as 'approved' | 'feed' | 'muted' | undefined;
    if (!decision || !['approved', 'feed', 'muted'].includes(decision)) {
      res.status(400).json({ error: 'decision must be approved, feed, or muted' });
      return;
    }
    const result = db.decideScreener(req.params.email, decision);
    if (!result.ok) {
      res.status(404).json({ error: 'Screener sender not found' });
      return;
    }
    res.json({ ok: true, undoId: result.undoId });
  });

  router.post('/tasks', (req: Request, res: Response) => {
    const threadId = String(req.body?.threadId || '');
    const accountId = String(req.body?.accountId || db.getAccounts()[0]?.id || 'acc_studio');
    const title = String(req.body?.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'Task title is required' });
      return;
    }
    const task = db.saveTask({
      threadId,
      accountId,
      title,
      dueLabel: req.body?.dueLabel ? String(req.body.dueLabel) : null,
      completed: false,
      priority: (req.body?.priority as 'high' | 'medium' | 'low') || 'medium',
    });
    res.status(201).json(task);
  });

  router.patch('/tasks/:id', (req: Request, res: Response) => {
    const patch: {
      completed?: boolean;
      title?: string;
      priority?: 'high' | 'medium' | 'low';
      dueLabel?: string | null;
    } = {};
    if (typeof req.body?.completed === 'boolean') patch.completed = req.body.completed;
    if (typeof req.body?.title === 'string') patch.title = req.body.title;
    if (typeof req.body?.priority === 'string') {
      patch.priority = req.body.priority as 'high' | 'medium' | 'low';
    }
    if (req.body?.dueLabel !== undefined) {
      patch.dueLabel = req.body.dueLabel ? String(req.body.dueLabel) : null;
    }
    const updated = db.updateTask(req.params.id, patch);
    if (!updated) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }
    res.json(updated);
  });

  router.post('/commitments/:id/resolve', (req: Request, res: Response) => {
    const ok = db.resolveCommitment(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Commitment not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/commitments/:id/reopen', (req: Request, res: Response) => {
    const ok = db.reopenCommitment(req.params.id);
    if (!ok) {
      res.status(404).json({ error: 'Commitment not found' });
      return;
    }
    res.json({ ok: true });
  });

  router.post('/commitments/:id/nudge', (req: Request, res: Response) => {
    const draft = db.createNudgeForCommitment(req.params.id);
    if (!draft) {
      res.status(404).json({ error: 'Commitment not found' });
      return;
    }
    res.json({ ok: true, draft });
  });

  // =========================================================================
  // SETTINGS, DEMO CONTROLS & UNDO
  // =========================================================================

  router.get('/settings', (_req: Request, res: Response) => {
    const settings = db.getAppSettings();
    const shabbosStatus = db.getShabbosStatus();
    res.json({ settings, shabbosStatus, ...settings });
  });

  router.patch('/settings', (req: Request, res: Response) => {
    const body = req.body ?? {};
    if (typeof body.anthropicApiKey === 'string') {
      const trimmed = body.anthropicApiKey.trim();
      if (trimmed.length === 0) {
        db.deleteSetting(SETTING_KEYS.ANTHROPIC_API_KEY);
      } else {
        db.setSetting(SETTING_KEYS.ANTHROPIC_API_KEY, trimmed);
      }
    }
    if (typeof body.claudeModel === 'string' && body.claudeModel.trim()) {
      db.setSetting(SETTING_KEYS.CLAUDE_MODEL, body.claudeModel.trim());
    }
    if (typeof body.googleClientId === 'string') {
      const trimmed = body.googleClientId.trim();
      if (trimmed.length === 0) {
        db.deleteSetting('googleClientId');
      } else {
        db.setSetting('googleClientId', trimmed);
      }
    }
    if (typeof body.googleClientSecret === 'string') {
      const trimmed = body.googleClientSecret.trim();
      if (trimmed.length === 0) {
        db.deleteSetting('googleClientSecret');
      } else {
        db.setSetting('googleClientSecret', trimmed);
      }
    }
    if (typeof body.shabbosGuardEnabled === 'boolean') {
      db.setSetting(
        SETTING_KEYS.SHABBOS_GUARD_ENABLED,
        body.shabbosGuardEnabled ? 'true' : 'false',
      );
    }
    if (typeof body.shabbosTimezone === 'string' && body.shabbosTimezone.trim()) {
      db.setSetting(SETTING_KEYS.SHABBOS_TIMEZONE, sanitizeTimezone(body.shabbosTimezone));
    }
    if (typeof body.demoMode === 'boolean') {
      db.setDemoMode(body.demoMode);
    }
    if (body.theme === 'dark' || body.theme === 'light') {
      db.setSetting(SETTING_KEYS.THEME, 'light');
    }

    const settings = db.getAppSettings();
    const shabbosStatus = db.getShabbosStatus();
    res.json({ settings, shabbosStatus, ...settings });
  });

  router.post('/demo/reset', (_req: Request, res: Response) => {
    db.setSetting(SETTING_KEYS.DEMO_MODE, 'true');
    db.seedDemoData();
    res.json({ ok: true, demoMode: true });
  });

  router.post('/demo/toggle', (req: Request, res: Response) => {
    const enabled =
      typeof req.body?.enabled === 'boolean'
        ? req.body.enabled
        : typeof req.body?.demoMode === 'boolean'
          ? req.body.demoMode
          : !db.isDemoMode();
    db.setDemoMode(enabled);
    res.json({ ok: true, demoMode: db.isDemoMode() });
  });

  router.post('/undo/:undoId', (req: Request, res: Response) => {
    const result = db.undoAction(req.params.undoId);
    if (!result.ok) {
      res.status(404).json(result);
      return;
    }
    res.json(result);
  });

  return router;
}
