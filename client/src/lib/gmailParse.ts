import type { EmailAttachment, EmailMessage, EmailThread, PriorityBucket } from './types';

/**
 * Turns what Gmail's threads.get (format=full) answers into the app's own thread and messages.
 * Pure: no DOM, no window, no storage, so it also runs in Node. Nothing here ever throws on odd mail.
 */

export interface RawPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string }[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: RawPart[];
}

export interface RawMessage {
  id: string;
  threadId?: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: RawPart;
}

export interface RawThread {
  id: string;
  historyId?: string;
  messages?: RawMessage[];
}

export interface LiveAccountInfo {
  id: string;
  email: string;
  color: string;
  label: string;
}

export const BODY_CAP = 30000;

// ---------------------------------------------------------------- headers

type Headers = { name: string; value: string }[] | undefined;

export function headerOf(headers: Headers, name: string): string | undefined {
  const low = name.toLowerCase();
  return headers?.find((h) => h.name.toLowerCase() === low)?.value;
}

function headerMap(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of headers ?? []) {
    const k = h.name.toLowerCase();
    if (!(k in out)) out[k] = h.value;
  }
  return out;
}

// ---------------------------------------------------------------- bytes and text

/** base64url (or plain base64, with or without padding) to bytes. Bad input gives what could be read. */
export function base64urlBytes(data: string): Uint8Array {
  const clean = data.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const padded = clean + '='.repeat((4 - (clean.length % 4)) % 4);
  try {
    const raw = atob(padded);
    const out = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
    return out;
  } catch {
    return new Uint8Array(0);
  }
}

const decoders = new Map<string, TextDecoder | null>();

function decoderFor(charset: string | undefined): TextDecoder | null {
  const key = (charset ?? 'utf-8').trim().toLowerCase() || 'utf-8';
  if (decoders.has(key)) return decoders.get(key) ?? null;
  let d: TextDecoder | null = null;
  try {
    d = new TextDecoder(key);
  } catch {
    d = null;
  }
  decoders.set(key, d);
  return d;
}

/** Bytes to text in a charset. An unknown charset falls back to utf-8. Never throws. */
export function decodeBytes(bytes: Uint8Array, charset?: string): string {
  const d = decoderFor(charset) ?? decoderFor('utf-8');
  try {
    return (d ?? new TextDecoder()).decode(bytes);
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------- RFC 2047

function qBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (c === '_') out.push(0x20);
    else if (c === '=' && /^[0-9a-fA-F]{2}$/.test(text.slice(i + 1, i + 3))) {
      out.push(parseInt(text.slice(i + 1, i + 3), 16));
      i += 2;
    } else out.push(text.charCodeAt(i) & 0xff);
  }
  return out;
}

/** Decodes RFC 2047 encoded words (B and Q, any charset the platform knows). A word with an unknown charset or bad data stays as it was. */
export function decodeWords(input: string): string {
  if (!input.includes('=?')) return input;
  const re = /=\?([^?\s*]+)(?:\*[^?\s]*)?\?([bBqQ])\?([^?\s]*)\?=/g;
  let out = '';
  let last = 0;
  let run: { charset: string; bytes: number[] } | null = null;
  const flush = () => {
    if (run) out += decodeBytes(Uint8Array.from(run.bytes), run.charset);
    run = null;
  };
  for (let m = re.exec(input); m; m = re.exec(input)) {
    const gap = input.slice(last, m.index);
    last = m.index + m[0].length;
    const charset = m[1].toLowerCase();
    let bytes: number[] | null = null;
    if (decoderFor(charset)) {
      if (m[2].toLowerCase() === 'b') {
        const b = base64urlBytes(m[3]);
        bytes = b.length > 0 || m[3] === '' ? Array.from(b) : null;
      } else bytes = qBytes(m[3]);
    }
    if (!bytes) {
      flush();
      out += gap + m[0];
      continue;
    }
    // Words next to each other, with only space between them, join up: the space is dropped
    if (run && gap.trim() === '' && run.charset === charset) {
      run.bytes.push(...bytes);
      continue;
    }
    flush();
    out += gap;
    run = { charset, bytes };
  }
  flush();
  return out + input.slice(last);
}

// ---------------------------------------------------------------- addresses

export interface Addr {
  name: string;
  email: string;
}

function unquote(s: string): string {
  const t = s.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/\\(.)/g, '$1');
  return t;
}

/** Splits a header on the commas that are not inside quotes, angle brackets or comments. */
function splitTop(value: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let quoted = false;
  let angle = false;
  let paren = 0;
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (quoted) {
      cur += c;
      if (c === '\\' && i + 1 < value.length) cur += value[++i];
      else if (c === '"') quoted = false;
    } else if (paren > 0) {
      cur += c;
      if (c === '\\' && i + 1 < value.length) cur += value[++i];
      else if (c === '(') paren += 1;
      else if (c === ')') paren -= 1;
    } else if (c === '"') {
      quoted = true;
      cur += c;
    } else if (c === '(') {
      paren = 1;
      cur += c;
    } else if (c === '<') {
      angle = true;
      cur += c;
    } else if (c === '>') {
      angle = false;
      cur += c;
    } else if ((c === ',' || c === ';') && !angle) {
      parts.push(cur);
      cur = '';
    } else cur += c;
  }
  parts.push(cur);
  return parts;
}

/** Takes the comments out of a piece (outside quotes) and returns what is left. A comment is never used as a name. */
function splitComments(piece: string): { text: string } {
  let text = '';
  let quoted = false;
  for (let i = 0; i < piece.length; i += 1) {
    const c = piece[i];
    if (quoted) {
      text += c;
      if (c === '\\' && i + 1 < piece.length) text += piece[++i];
      else if (c === '"') quoted = false;
    } else if (c === '"') {
      quoted = true;
      text += c;
    } else if (c === '(') {
      let depth = 1;
      i += 1;
      for (; i < piece.length && depth > 0; i += 1) {
        const d = piece[i];
        if (d === '\\' && i + 1 < piece.length) i += 1;
        else if (d === '(') depth += 1;
        else if (d === ')') depth -= 1;
      }
      i -= 1;
    } else text += c;
  }
  return { text };
}

/** Every address in a From, To, Cc or Bcc header. Addresses are lowercased. A missing name is ''. */
export function parseAddresses(value: string | undefined): Addr[] {
  if (!value) return [];
  const out: Addr[] = [];
  for (const raw of splitTop(value)) {
    const { text } = splitComments(raw);
    // A group label ("Team: a@b") is dropped
    const piece = text.replace(/^\s*[^<>"@:]+:\s*(?=\S)/, '').trim();
    if (!piece) continue;
    let email = '';
    let name = '';
    const open = piece.lastIndexOf('<');
    const close = piece.indexOf('>', open + 1);
    if (open >= 0 && close > open) {
      email = piece.slice(open + 1, close);
      name = unquote(piece.slice(0, open));
    } else {
      email = unquote(piece);
    }
    email = email.replace(/^mailto:/i, '').replace(/\s+/g, '').toLowerCase();
    if (!/^[^@\s<>]+@[^@\s<>]+$/.test(email)) continue;
    name = decodeWords(name).replace(/\s+/g, ' ').trim();
    if (name.toLowerCase() === email) name = '';
    out.push({ name, email });
  }
  return out;
}

// ---------------------------------------------------------------- html to text

const NAMED: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", copy: '©', reg: '®', trade: '™',
  hellip: '…', mdash: '\u2014', ndash: '\u2013', lsquo: '‘', rsquo: '’', sbquo: '‚', ldquo: '“',
  rdquo: '”', bdquo: '„', bull: '•', middot: '·', euro: '€', pound: '£', yen: '¥',
  cent: '¢', deg: '°', times: '×', divide: '÷', laquo: '«', raquo: '»', sect: '§',
  para: '¶', plusmn: '±', frac12: '½', frac14: '¼', frac34: '¾', larr: '←', rarr: '→',
  zwnj: '‌', zwj: '‍', shy: '­', ensp: ' ', emsp: ' ', thinsp: ' ',
  eacute: 'é', egrave: 'è', agrave: 'à', aacute: 'á', uuml: 'ü', ouml: 'ö', auml: 'ä',
  ccedil: 'ç', ntilde: 'ñ', iacute: 'í', oacute: 'ó', uacute: 'ú',
};

/** Decodes the common named entities and every decimal and hex one, in a single pass (so &amp;lt; stays &lt;). */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]{1,9}));/g, (whole, dec, hex, name) => {
    if (name) return Object.hasOwn(NAMED, name) ? NAMED[name] : whole;
    const code = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) return '';
    try {
      return String.fromCodePoint(code);
    } catch {
      return '';
    }
  });
}

// Every pattern below stops at the next "<" or ">", so broken html (thousands of unclosed tags) is read in one pass, not once per tag.
const stripTags = (s: string) => s.replace(/<\/?[A-Za-z!][^<>]*>/g, '');

/** Lower case for ASCII letters only, so every index in the result is the same index in the original. */
const asciiLower = (s: string) => s.replace(/[A-Z]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 32));

/** Cuts out `open ... close` blocks by plain search. A block that never closes runs to the end (as a browser reads it), unless `keepOpen`. */
function cutBlocks(s: string, open: RegExp, close: string, keepOpen = false): string {
  const lower = asciiLower(s);
  let out = '';
  let from = 0;
  open.lastIndex = 0;
  for (;;) {
    const m = open.exec(lower);
    if (!m) break;
    const end = lower.indexOf(close, m.index + m[0].length);
    if (end < 0) {
      if (keepOpen) break;
      out += s.slice(from, m.index);
      return out;
    }
    out += s.slice(from, m.index);
    const tail = close.startsWith('</') && /^\s*>/.exec(lower.slice(end + close.length, end + close.length + 40));
    from = end + close.length + (tail ? tail[0].length : 0);
    open.lastIndex = from;
  }
  return out + s.slice(from);
}

/** The most html read from one message. Anything past it is not read. */
export const HTML_CAP = 200_000;

/** The plain text of an html email. No DOM: tags are cut out by pattern. Images are dropped and never loaded. */
export function htmlToText(html: string): string {
  let s = html.slice(0, HTML_CAP).replace(/\r/g, '');
  s = cutBlocks(s, /<!--/g, '-->');
  s = cutBlocks(s, /<head[\s>]/g, '</head', true);
  for (const tag of ['style', 'script', 'title']) s = cutBlocks(s, new RegExp(`<${tag}[\\s>]`, 'g'), `</${tag}`);
  // A link keeps its text; its address only when it has no text. A link body ends at the next link, so a missing </a> costs nothing more.
  s = s.replace(/<a\s([^<>]*)>((?:[^<]|<(?!\/?a[\s>]))*?)<\/a\s*>/gi, (_w, attrs: string, inner: string) => {
    const label = decodeEntities(stripTags(inner)).replace(/[\s \u200b-\u200d\u2060\ufeff]+/g, ' ').trim();
    if (label) return inner;
    const m = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(attrs);
    const href = decodeEntities((m?.[1] ?? m?.[2] ?? m?.[3] ?? '').trim());
    return /^(https?:|mailto:)/i.test(href) ? ` ${href} ` : '';
  });
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<hr\b[^<>]*>/gi, '\n');
  s = s.replace(/<li\b[^<>]*>/gi, '\n\u2022 ');
  s = s.replace(/<\/(p|div|li|tr|table|blockquote|h[1-6]|ul|ol)\s*>/gi, '\n');
  s = s.replace(/<\/t[dh]\s*>/gi, ' ');
  s = stripTags(s);
  s = decodeEntities(s);
  s = s.replace(/[​-‍⁠﻿­͏]/g, '');
  s = s.replace(/[ \t  - ]+/g, ' ');
  const lines = s.split('\n').map((l) => l.trim());
  const kept: string[] = [];
  for (const l of lines) {
    if (l === '•') continue;
    if (l === '' && kept.length > 0 && kept[kept.length - 1] === '') continue;
    kept.push(l);
  }
  // Items of one list sit on consecutive lines, with no blank line between them
  const tight = kept.filter((l, i) => !(l === '' && kept[i - 1]?.startsWith('\u2022') && kept[i + 1]?.startsWith('\u2022')));
  return tight.join('\n').trim();
}

// ---------------------------------------------------------------- bodies and files

const PICTURE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

function charsetOf(headers: Headers): string | undefined {
  const ct = headerOf(headers, 'content-type') ?? '';
  const m = /charset\s*=\s*"?([^";\s]+)"?/i.exec(ct);
  return m ? m[1] : undefined;
}

interface Walk {
  plain: string[];
  html: string[];
  files: RawPart[];
}

function walk(part: RawPart | undefined, out: Walk): void {
  if (!part) return;
  if (part.parts && part.parts.length > 0) {
    for (const p of part.parts) walk(p, out);
    return;
  }
  const mime = (part.mimeType ?? '').toLowerCase();
  const disp = (headerOf(part.headers, 'content-disposition') ?? '').toLowerCase();
  const isAttachment = !!part.filename || disp.startsWith('attachment');
  if (!isAttachment && (mime === 'text/plain' || mime === 'text/html') && typeof part.body?.data === 'string') {
    const text = decodeBytes(base64urlBytes(part.body.data), charsetOf(part.headers));
    (mime === 'text/plain' ? out.plain : out.html).push(text);
    return;
  }
  if (part.body?.attachmentId || part.filename) out.files.push(part);
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };

/** An attachment is known by its message and part (`messageId~pPartId`), not by the id Gmail uses to download it, which can change between reads. */
function attachmentsOf(messageId: string, files: RawPart[]): EmailAttachment[] {
  const out: EmailAttachment[] = [];
  for (const [index, part] of files.entries()) {
    const key = `${messageId}~p${part.partId ?? `i${index}`}`;
    const mime = (part.mimeType ?? 'application/octet-stream').toLowerCase();
    const aid = part.body?.attachmentId;
    const name = part.filename ?? '';
    const size = typeof part.body?.size === 'number' ? part.body.size : 0;
    if (PICTURE_TYPES.has(mime) && aid) {
      const disp = (headerOf(part.headers, 'content-disposition') ?? '').toLowerCase();
      const inline = !!headerOf(part.headers, 'content-id') || disp.startsWith('inline');
      out.push({ id: key, gmailAttachmentId: aid, filename: name || `image.${EXT[mime]}`, mimeType: mime, sizeBytes: size, inline });
    } else if (name) {
      out.push({ id: key, ...(aid ? { gmailAttachmentId: aid } : {}), filename: name, mimeType: mime, sizeBytes: size, inline: false });
    }
  }
  return out;
}

// ---------------------------------------------------------------- buckets

const BULK_SENDER = /^(?:no[-_.]?reply|do[-_.]?not[-_.]?reply|mailer-daemon|notifications?)(?:[-_.+@]|$)/;

export interface BucketInput {
  /** The newest message was sent by the owner. */
  outbound: boolean;
  fromEmail: string;
  /** Gmail label ids of the newest message. */
  labels: string[];
  /** Header values of the newest message, by lowercase name. */
  headers: Record<string, string>;
}

/** Whether the newest message is automatic or a mailing: a list header, a bulk precedence, an automatic sender, or a promotions, social or forums tab. */
export function isBulk(m: BucketInput): boolean {
  const h = m.headers;
  if (h['list-unsubscribe'] !== undefined) return true;
  if (/^(bulk|list|junk)\b/i.test((h['precedence'] ?? '').trim())) return true;
  const auto = (h['auto-submitted'] ?? '').trim().toLowerCase();
  if (auto && auto !== 'no') return true;
  const local = m.fromEmail.toLowerCase().split('@')[0];
  if (BULK_SENDER.test(local + '@')) return true;
  return m.labels.some((l) => l === 'CATEGORY_PROMOTIONS' || l === 'CATEGORY_SOCIAL' || l === 'CATEGORY_FORUMS');
}

/** Where one message puts a thread: mine (waiting 40), a mailing (feed 10), an update (paper_trail 30), or a person wrote (decision 70). */
export function bucketFor(m: BucketInput): { bucket: PriorityBucket; urgencyScore: number } {
  if (m.outbound) return { bucket: 'waiting', urgencyScore: 40 };
  if (isBulk(m)) return { bucket: 'feed', urgencyScore: 10 };
  if (m.labels.includes('CATEGORY_UPDATES')) return { bucket: 'paper_trail', urgencyScore: 30 };
  return { bucket: 'decision', urgencyScore: 70 };
}

/** Where a thread goes, given its messages oldest first. When the owner wrote last it is waiting (40), unless the newest message from someone else is a mailing or an update: then that message decides. */
export function threadBucket(msgs: BucketInput[]): { bucket: PriorityBucket; urgencyScore: number } {
  const last = msgs[msgs.length - 1];
  if (!last) return { bucket: 'waiting', urgencyScore: 40 };
  if (!last.outbound) return bucketFor(last);
  for (let i = msgs.length - 2; i >= 0; i -= 1) {
    const other = msgs[i];
    if (other.outbound) continue;
    if (isBulk(other) || other.labels.includes('CATEGORY_UPDATES')) return bucketFor(other);
    break;
  }
  return bucketFor(last);
}

const LABEL_NAMES: [string, string][] = [
  ['CATEGORY_PROMOTIONS', 'promotions'],
  ['CATEGORY_UPDATES', 'updates'],
  ['CATEGORY_SOCIAL', 'social'],
  ['CATEGORY_FORUMS', 'forums'],
  ['IMPORTANT', 'important'],
];

// ---------------------------------------------------------------- messages and threads

function parseMessage(raw: RawMessage, account: LiveAccountInfo, mine: Set<string>): EmailMessage {
  const headers = raw.payload?.headers;
  const labels = raw.labelIds ?? [];
  const from = parseAddresses(headerOf(headers, 'from'))[0];
  const to = parseAddresses(headerOf(headers, 'to')).map((a) => a.email);
  const cc = parseAddresses(headerOf(headers, 'cc')).map((a) => a.email);
  const bcc = parseAddresses(headerOf(headers, 'bcc')).map((a) => a.email);
  const w: Walk = { plain: [], html: [], files: [] };
  walk(raw.payload, w);
  const text = w.plain.length > 0 ? w.plain.join('\n\n') : w.html.map(htmlToText).filter(Boolean).join('\n\n');
  const internal = Number(raw.internalDate);
  const dateHeader = Date.parse(headerOf(headers, 'date') ?? '');
  const when = Number.isFinite(internal) && internal > 0 ? internal : Number.isFinite(dateHeader) ? dateHeader : 0;
  const fromEmail = from?.email ?? '';
  const msg: EmailMessage = {
    id: `${account.id}~${raw.id}`,
    threadId: `${account.id}~${raw.threadId ?? ''}`,
    accountId: account.id,
    externalId: raw.id,
    fromName: from?.name ?? '',
    fromEmail,
    toEmails: to,
    subject: decodeWords(headerOf(headers, 'subject') ?? '').replace(/\s+/g, ' ').trim(),
    snippet: decodeEntities(raw.snippet ?? ''),
    bodyText: text.slice(0, BODY_CAP),
    sentAt: new Date(when).toISOString(),
    isUnread: labels.includes('UNREAD'),
    isOutbound: labels.includes('SENT') || (fromEmail !== '' && mine.has(fromEmail)),
    attachments: attachmentsOf(raw.id, w.files),
  };
  if (cc.length > 0) msg.ccEmails = cc;
  if (bcc.length > 0) msg.bccEmails = bcc;
  return msg;
}

/** One Gmail thread (format=full) as the app's thread and its messages. */
export function parseThread(raw: RawThread, account: LiveAccountInfo, mine: string[]): { thread: EmailThread; messages: EmailMessage[] } {
  const own = new Set(mine.map((a) => a.toLowerCase()));
  own.add(account.email.toLowerCase());
  const rawMsgs = [...(raw.messages ?? [])].sort((a, b) => (Number(a.internalDate) || 0) - (Number(b.internalDate) || 0));
  const messages = rawMsgs.map((m) => parseMessage({ ...m, threadId: m.threadId ?? raw.id }, account, own));
  const newest = messages[messages.length - 1];
  const labelIds = new Set<string>();
  for (const m of rawMsgs) for (const l of m.labelIds ?? []) labelIds.add(l);
  const labels = LABEL_NAMES.filter(([id]) => labelIds.has(id)).map(([, name]) => name);

  const people = new Map<string, string>();
  const note = (list: Addr[]) => {
    for (const a of list) if (!people.has(a.email) || (!people.get(a.email) && a.name)) people.set(a.email, people.get(a.email) || a.name);
  };
  for (const m of rawMsgs) {
    const h = m.payload?.headers;
    note(parseAddresses(headerOf(h, 'from')));
    note(parseAddresses(headerOf(h, 'to')));
    note(parseAddresses(headerOf(h, 'cc')));
  }

  const kind = threadBucket(
    rawMsgs.map((r, i) => ({ outbound: messages[i].isOutbound, fromEmail: messages[i].fromEmail, labels: r.labelIds ?? [], headers: headerMap(r.payload?.headers) })),
  );

  const threadId = `${account.id}~${raw.id}`;
  const thread: EmailThread = {
    id: threadId,
    accountId: account.id,
    accountColor: account.color,
    accountLabel: account.label,
    accountEmail: account.email,
    subject: messages.find((m) => m.subject)?.subject || '(no subject)',
    snippet: newest?.snippet ?? '',
    participants: [...people].map(([email, name]) => ({ name, email })),
    messageCount: messages.length,
    lastMessageAt: newest?.sentAt ?? new Date(0).toISOString(),
    isUnread: messages.some((m) => m.isUnread && !m.isOutbound),
    isStarred: labelIds.has('STARRED'),
    isArchived: false,
    labels,
    bucket: kind.bucket,
    urgencyScore: kind.urgencyScore,
    distilledAsk: null,
    goalQuote: null,
    aiSummaryBullets: [],
    quickActions: [],
    relatedThreadIds: [],
    senderTrust: 'approved',
    receiptInfo: null,
    ...(raw.historyId ? { historyId: raw.historyId } : {}),
  };
  return { thread, messages };
}
