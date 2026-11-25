import crypto from 'node:crypto';
import type {
  EmailAttachment,
  EmailMessage,
  EmailThread,
  GmailAccount,
} from '../../shared/types.js';
import { classifySyncedThread } from './classifier.js';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export const GOOGLE_REDIRECT_URI = 'http://localhost:3456/api/auth/google/callback';

const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.compose',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

export interface OAuthCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

export function buildGoogleAuthUrl(clientId: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: GMAIL_SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthCredentials> {
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google token exchange failed: ${String(data.error_description || data.error || res.statusText)}`,
    );
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    accessToken: String(data.access_token),
    refreshToken: data.refresh_token ? String(data.refresh_token) : undefined,
    expiryDate: Date.now() + expiresIn * 1000,
  };
}

export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<OAuthCredentials> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data.access_token) {
    throw new Error(
      `Google token refresh failed: ${String(data.error_description || data.error || res.statusText)}`,
    );
  }

  const expiresIn = Number(data.expires_in ?? 3600);
  return {
    accessToken: String(data.access_token),
    refreshToken,
    expiryDate: Date.now() + expiresIn * 1000,
  };
}

export async function ensureFreshAccessToken(
  creds: OAuthCredentials,
  clientId: string,
  clientSecret: string,
  onRefreshed: (next: OAuthCredentials) => void,
): Promise<string> {
  const needsRefresh =
    !creds.accessToken || (creds.expiryDate && Date.now() > creds.expiryDate - 120_000);
  if (!needsRefresh) {
    return creds.accessToken;
  }
  if (!creds.refreshToken) {
    throw new Error('Google OAuth token expired and no refresh token is stored. Please reconnect.');
  }
  const refreshed = await refreshAccessToken(creds.refreshToken, clientId, clientSecret);
  onRefreshed(refreshed);
  return refreshed.accessToken;
}

export async function fetchGoogleUserProfile(
  accessToken: string,
): Promise<{ email: string; name: string; picture?: string }> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok || !data.email) {
    throw new Error(`Failed to fetch Google user profile: ${res.statusText}`);
  }
  return {
    email: String(data.email),
    name: String(data.name || String(data.email).split('@')[0]),
    picture: data.picture ? String(data.picture) : undefined,
  };
}

interface GmailPayloadPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPayloadPart[];
}

interface GmailApiMessage {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPayloadPart;
}

interface GmailApiThread {
  id: string;
  messages?: GmailApiMessage[];
}

function decodeBase64Url(input?: string): string {
  if (!input) return '';
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  return Buffer.from(normalized + '='.repeat(padLen), 'base64').toString('utf8');
}

function encodeBase64Url(input: string): string {
  return Buffer.from(input, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function extractMimeParts(payload?: GmailPayloadPart): {
  text: string;
  html?: string;
  attachments: EmailAttachment[];
} {
  let text = '';
  let html: string | undefined;
  const attachments: EmailAttachment[] = [];

  function walk(part?: GmailPayloadPart): void {
    if (!part) return;
    const mime = (part.mimeType || '').toLowerCase();

    if (part.filename && part.filename.length > 0) {
      attachments.push({
        id: part.body?.attachmentId || crypto.randomUUID(),
        filename: part.filename,
        mimeType: part.mimeType || 'application/octet-stream',
        sizeBytes: Number(part.body?.size ?? 0),
      });
    } else if (mime === 'text/plain' && part.body?.data && !text) {
      text = decodeBase64Url(part.body.data);
    } else if (mime === 'text/html' && part.body?.data && !html) {
      html = decodeBase64Url(part.body.data);
    }

    if (Array.isArray(part.parts)) {
      for (const child of part.parts) {
        walk(child);
      }
    }
  }

  walk(payload);
  if (!text && html) {
    text = stripHtmlToText(html);
  }
  return { text, html, attachments };
}

function getHeader(headers: { name: string; value: string }[] | undefined, name: string): string {
  if (!headers) return '';
  const target = name.toLowerCase();
  return headers.find((h) => h.name.toLowerCase() === target)?.value ?? '';
}

function parseAddress(raw: string): { name: string; email: string } {
  const angle = raw.match(/^(?:"?([^"]*?)"?\s*)?<([^>]+)>/);
  if (angle) {
    const email = angle[2].trim();
    const name = angle[1]?.trim() || email.split('@')[0];
    return { name, email };
  }
  const email = raw.trim();
  return { name: email.split('@')[0] || 'Unknown', email };
}

function parseAddressList(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split(',')
    .map((part) => parseAddress(part).email)
    .filter(Boolean);
}

export async function syncGmailOAuthAccount(
  accessToken: string,
  account: GmailAccount,
  maxThreads = 35,
): Promise<{ threads: EmailThread[]; messages: EmailMessage[]; externalMap: Map<string, string> }> {
  const listRes = await fetch(
    `${GMAIL_API_BASE}/threads?maxResults=${Math.min(maxThreads, 50)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const listData = (await listRes.json()) as {
    threads?: { id: string }[];
    error?: { message?: string };
  };
  if (!listRes.ok) {
    throw new Error(
      `Gmail API list threads failed: ${listData.error?.message || listRes.statusText}`,
    );
  }

  const threadStubs = listData.threads ?? [];
  const threads: EmailThread[] = [];
  const allMessages: EmailMessage[] = [];
  const externalMap = new Map<string, string>();

  // Fetch thread payloads in bounded parallel batches of 8
  const batchSize = 8;
  for (let i = 0; i < threadStubs.length; i += batchSize) {
    const chunk = threadStubs.slice(i, i + batchSize);
    const results = await Promise.all(
      chunk.map(async (stub) => {
        const res = await fetch(`${GMAIL_API_BASE}/threads/${stub.id}?format=full`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) return null;
        return (await res.json()) as GmailApiThread;
      }),
    );

    for (const rawThread of results) {
      if (!rawThread || !rawThread.messages || rawThread.messages.length === 0) continue;

      const localThreadId = `goauth_${account.id}_${rawThread.id}`;
      externalMap.set(localThreadId, rawThread.id);
      const threadLabels = new Set<string>();
      const parsedMessages: EmailMessage[] = [];
      let threadSubject = '(No subject)';

      for (const msg of rawThread.messages) {
        for (const lbl of msg.labelIds ?? []) {
          threadLabels.add(lbl);
        }
        const headers = msg.payload?.headers;
        const from = parseAddress(getHeader(headers, 'From'));
        const toEmails = parseAddressList(getHeader(headers, 'To'));
        const ccEmails = parseAddressList(getHeader(headers, 'Cc'));
        const subject = getHeader(headers, 'Subject') || threadSubject;
        if (subject && threadSubject === '(No subject)') {
          threadSubject = subject;
        }
        const { text, html, attachments } = extractMimeParts(msg.payload);
        const sentAt = msg.internalDate
          ? new Date(Number(msg.internalDate)).toISOString()
          : new Date().toISOString();
        const isUnread = (msg.labelIds ?? []).includes('UNREAD');
        const isOutbound =
          (msg.labelIds ?? []).includes('SENT') ||
          from.email.toLowerCase() === account.email.toLowerCase();

        parsedMessages.push({
          id: `gmsg_${account.id}_${msg.id}`,
          threadId: localThreadId,
          accountId: account.id,
          externalId: msg.id,
          fromName: from.name,
          fromEmail: from.email,
          toEmails: toEmails.length > 0 ? toEmails : [account.email],
          ccEmails: ccEmails.length > 0 ? ccEmails : undefined,
          subject,
          snippet: msg.snippet || text.slice(0, 160),
          bodyText: text || msg.snippet || '',
          bodyHtml: html,
          sentAt,
          isUnread,
          isOutbound,
          attachments,
        });
      }

      const classified = classifySyncedThread(
        account,
        localThreadId,
        threadSubject,
        parsedMessages,
        Array.from(threadLabels),
      );
      threads.push(classified);
      allMessages.push(...parsedMessages);
    }
  }

  return { threads, messages: allMessages, externalMap };
}

export async function sendGmailOAuthMessage(
  accessToken: string,
  opts: {
    fromEmail: string;
    fromName?: string;
    toEmails: string[];
    ccEmails?: string[];
    subject: string;
    bodyText: string;
    externalThreadId?: string;
  },
): Promise<{ id: string; threadId: string }> {
  const fromHeader = opts.fromName ? `"${opts.fromName}" <${opts.fromEmail}>` : opts.fromEmail;
  const lines = [
    `From: ${fromHeader}`,
    `To: ${opts.toEmails.join(', ')}`,
    ...(opts.ccEmails && opts.ccEmails.length > 0 ? [`Cc: ${opts.ccEmails.join(', ')}`] : []),
    `Subject: ${opts.subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    opts.bodyText,
  ];
  const raw = encodeBase64Url(lines.join('\r\n'));

  const payload: Record<string, string> = { raw };
  if (opts.externalThreadId) {
    payload.threadId = opts.externalThreadId;
  }

  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as { id?: string; threadId?: string; error?: { message?: string } };
  if (!res.ok || !data.id) {
    throw new Error(`Gmail API send failed: ${data.error?.message || res.statusText}`);
  }
  return { id: data.id, threadId: data.threadId || '' };
}

export async function modifyGmailOAuthThread(
  accessToken: string,
  externalThreadId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = [],
): Promise<void> {
  const res = await fetch(`${GMAIL_API_BASE}/threads/${externalThreadId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gmail API modify failed (${res.status}): ${errBody}`);
  }
}

export function renderOAuthCallbackHtml(
  success: boolean,
  payload: { email?: string; accountId?: string; error?: string },
): string {
  const safeMessage = success
    ? `Connected ${payload.email ?? 'Gmail account'} to Prism.`
    : `Connection error: ${payload.error ?? 'Unable to complete Google OAuth'}`;
  const serialized = JSON.stringify({
    type: 'prism-oauth-complete',
    success,
    email: payload.email ?? null,
    accountId: payload.accountId ?? null,
    error: payload.error ?? null,
  });

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Prism Gmail Connection</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f4f0;
      color: #111827;
      font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif;
    }
    .card {
      max-width: 420px;
      padding: 32px;
      border-radius: 20px;
      background: #ffffff;
      border: 1px solid #e5e7eb;
      text-align: center;
      box-shadow: 0 18px 48px -14px rgba(15, 23, 42, 0.12);
    }
    .badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      margin-bottom: 14px;
      background: ${success ? '#ecfdf5' : '#fff1f2'};
      color: ${success ? '#059669' : '#e11d48'};
      border: 1px solid ${success ? '#a7f3d0' : '#fecdd3'};
    }
    h1 { font-size: 20px; margin: 0 0 10px; font-weight: 600; color: #111827; }
    p { font-size: 14px; color: #4b5563; margin: 0; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${success ? 'Connected' : 'Error'}</div>
    <h1>${success ? 'Gmail Account Linked' : 'Google Sign-In Failed'}</h1>
    <p>${safeMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>
    <p style="margin-top: 14px; font-size: 12px; opacity: 0.7;">This window will close automatically.</p>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage(${serialized}, '*');
      }
    } catch (e) {}
    setTimeout(function () { window.close(); }, ${success ? 1200 : 3500});
  </script>
</body>
</html>`;
}
