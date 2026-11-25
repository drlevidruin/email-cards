import crypto from 'node:crypto';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import type {
  EmailAttachment,
  EmailMessage,
  EmailThread,
  GmailAccount,
} from '../../shared/types.js';
import { classifySyncedThread } from './classifier.js';

function cleanAppPassword(raw: string): string {
  return raw.replace(/\s+/g, '').trim();
}

function formatImapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const lower = msg.toLowerCase();
  if (
    lower.includes('authenticationfailed') ||
    lower.includes('invalid credentials') ||
    lower.includes('application-specific password') ||
    lower.includes('web login required') ||
    lower.includes('command failed')
  ) {
    return 'Gmail rejected the login. Make sure 2-Step Verification is enabled on your Google Account and enter a 16-character Google App Password (not your regular Gmail password).';
  }
  if (lower.includes('timeout') || lower.includes('econnrefused') || lower.includes('enotfound')) {
    return 'Could not reach imap.gmail.com:993. Check your internet connection and firewall settings.';
  }
  return `Gmail IMAP connection failed: ${msg}`;
}

export async function verifyGmailImapCredentials(
  email: string,
  appPassword: string,
): Promise<{ ok: true }> {
  const cleanPass = cleanAppPassword(appPassword);
  if (!email.includes('@')) {
    throw new Error('Please enter a valid Gmail email address.');
  }
  if (cleanPass.length < 12) {
    throw new Error(
      'Please enter your 16-character Google App Password from myaccount.google.com/apppasswords.',
    );
  }

  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  try {
    await client.connect();
    await client.logout();
  } catch (err) {
    throw new Error(formatImapError(err));
  }

  // Also verify SMTP auth so outbound sending works cleanly
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
  });
  try {
    await transporter.verify();
  } catch (err) {
    throw new Error(formatImapError(err));
  }

  return { ok: true };
}

function normalizeSubjectKey(subject: string): string {
  return subject
    .replace(/^(re|fwd|fw):\s*/gi, '')
    .trim()
    .toLowerCase();
}

export async function syncGmailImapAccount(
  email: string,
  appPassword: string,
  account: GmailAccount,
  maxMessages = 40,
): Promise<{ threads: EmailThread[]; messages: EmailMessage[] }> {
  const cleanPass = cleanAppPassword(appPassword);
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  const grouped = new Map<
    string,
    { subject: string; labels: Set<string>; messages: EmailMessage[] }
  >();

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true });
      const total = status.messages ?? 0;
      if (total === 0) {
        return { threads: [], messages: [] };
      }

      const startSeq = Math.max(1, total - maxMessages + 1);
      const range = `${startSeq}:${total}`;

      for await (const msg of client.fetch(range, {
        uid: true,
        flags: true,
        envelope: true,
        source: true,
        threadId: true,
      })) {
        const parsed = msg.source ? await simpleParser(msg.source) : null;
        const subject = parsed?.subject || msg.envelope?.subject || '(No subject)';
        const fromObj = parsed?.from?.value?.[0];
        const fromEmail =
          fromObj?.address ||
          msg.envelope?.from?.[0]?.address ||
          'unknown@sender.local';
        const fromName =
          fromObj?.name ||
          msg.envelope?.from?.[0]?.name ||
          fromEmail.split('@')[0];

        const toValues = parsed?.to
          ? Array.isArray(parsed.to)
            ? parsed.to.flatMap((a) => a.value)
            : parsed.to.value
          : [];
        const toEmails = toValues
          .map((v) => v.address)
          .filter((a): a is string => Boolean(a));

        const ccValues = parsed?.cc
          ? Array.isArray(parsed.cc)
            ? parsed.cc.flatMap((a) => a.value)
            : parsed.cc.value
          : [];
        const ccEmails = ccValues
          .map((v) => v.address)
          .filter((a): a is string => Boolean(a));

        const attachments: EmailAttachment[] = (parsed?.attachments ?? []).map((att, idx) => ({
          id: `imap-att-${msg.uid}-${idx}`,
          filename: att.filename || `attachment-${idx + 1}`,
          mimeType: att.contentType || 'application/octet-stream',
          sizeBytes: att.size || att.content?.length || 0,
        }));

        const bodyText =
          (parsed?.text || '').trim() ||
          (typeof parsed?.html === 'string'
            ? parsed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
            : '');
        const bodyHtml = typeof parsed?.html === 'string' ? parsed.html : undefined;
        const sentAt = (parsed?.date || msg.envelope?.date || new Date()).toISOString();

        const flags = msg.flags ?? new Set<string>();
        const isUnread = !flags.has('\\Seen');
        const isStarred = flags.has('\\Flagged');
        const isOutbound = fromEmail.toLowerCase() === account.email.toLowerCase();

        const threadGroupKey =
          msg.threadId ||
          crypto
            .createHash('sha1')
            .update(normalizeSubjectKey(subject))
            .digest('hex')
            .slice(0, 14);
        const localThreadId = `imap_${account.id}_${threadGroupKey}`;

        const entry = grouped.get(localThreadId) ?? {
          subject,
          labels: new Set<string>(['INBOX']),
          messages: [],
        };
        if (isUnread) entry.labels.add('UNREAD');
        if (isStarred) entry.labels.add('STARRED');

        entry.messages.push({
          id: `imsg_${account.id}_${msg.uid}`,
          threadId: localThreadId,
          accountId: account.id,
          externalId: String(msg.uid),
          fromName,
          fromEmail,
          toEmails: toEmails.length > 0 ? toEmails : [account.email],
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          snippet: bodyText.slice(0, 180).replace(/\s+/g, ' ').trim(),
          bodyText,
          bodyHtml,
          sentAt,
          isUnread,
          isOutbound,
          attachments,
        });
        grouped.set(localThreadId, entry);
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    throw new Error(formatImapError(err));
  }

  const threads: EmailThread[] = [];
  const allMessages: EmailMessage[] = [];
  for (const [threadId, group] of grouped.entries()) {
    const classified = classifySyncedThread(
      account,
      threadId,
      group.subject,
      group.messages,
      Array.from(group.labels),
    );
    threads.push(classified);
    allMessages.push(...group.messages);
  }

  threads.sort(
    (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
  );
  return { threads, messages: allMessages };
}

export async function sendGmailImapMessage(
  email: string,
  appPassword: string,
  opts: {
    fromName?: string;
    toEmails: string[];
    ccEmails?: string[];
    subject: string;
    bodyText: string;
  },
): Promise<{ messageId: string }> {
  const cleanPass = cleanAppPassword(appPassword);
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
  });

  const info = await transporter.sendMail({
    from: opts.fromName ? `"${opts.fromName}" <${email.trim()}>` : email.trim(),
    to: opts.toEmails.join(', '),
    cc: opts.ccEmails && opts.ccEmails.length > 0 ? opts.ccEmails.join(', ') : undefined,
    subject: opts.subject,
    text: opts.bodyText,
  });

  return { messageId: info.messageId || crypto.randomUUID() };
}

export async function updateGmailImapFlags(
  email: string,
  appPassword: string,
  uids: number[],
  action: 'archive' | 'mark_read' | 'mark_unread' | 'star' | 'unstar',
): Promise<void> {
  if (uids.length === 0) return;
  const cleanPass = cleanAppPassword(appPassword);
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: { user: email.trim(), pass: cleanPass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock('INBOX');
    try {
      const uidRange = uids.join(',');
      if (action === 'mark_read') {
        await client.messageFlagsAdd(uidRange, ['\\Seen'], { uid: true });
      } else if (action === 'mark_unread') {
        await client.messageFlagsRemove(uidRange, ['\\Seen'], { uid: true });
      } else if (action === 'star') {
        await client.messageFlagsAdd(uidRange, ['\\Flagged'], { uid: true });
      } else if (action === 'unstar') {
        await client.messageFlagsRemove(uidRange, ['\\Flagged'], { uid: true });
      } else if (action === 'archive') {
        await client.messageMove(uidRange, '[Gmail]/All Mail', { uid: true });
      }
    } finally {
      lock.release();
    }
    await client.logout();
  } catch (err) {
    console.warn('[gmail-imap] Flag update warning:', formatImapError(err));
  }
}
