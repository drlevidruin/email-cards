import type { EmailMessage, EmailThread, ScreenerSender } from './types';
import { attachmentLine } from './pictureData';
import type { Data } from '../storeTypes';
import { buildStack } from './stacks';
import { groupName, othersOf, type Person } from './people';
import { dropSignature } from './signature';
import { skim } from './skim';
import { firstName } from './utils';
import { chatCategory, looksBulk, type Category } from './categories';
import { companyName, groupThreads } from './orgChats';
import { cleanEmailText, realSubject, shortenLinks } from './cleanText';
import { isLiveMode } from './liveMode';

export interface Chat {
  key: string;
  name: string;
  email: string;
  /** Everyone else in the chat. */
  people: Person[];
  isGroup: boolean;
  threads: EmailThread[];
  lastAt: string;
  preview: string;
  /** The newest message is mine. */
  lastMine: boolean;
  unread: number;
  needsReply: boolean;
  isUpdate: boolean;
  /** The kind of mail the chat's newest thread is. */
  category: Category;
  isNew: boolean;
  /** One company: every sender address of one organization shares this chat. */
  isCompany?: boolean;
  /** The organization's domain, for a company chat. */
  domain?: string;
}

const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/** The email as a bubble shows it: no quoted earlier email at its end, no hello, no sign-off. */
export function bubbleText(body: string, name?: string): string {
  const whole = cleanEmailText(body).trim();
  const lines = whole.split('\n');
  const bottom = () => lines.length - 1;
  // An answer written under one quoted email: drop the attribution line and the quote, keep the answer
  const isQ = (l: string) => /^\s*>/.test(l);
  const first = lines.findIndex(isQ);
  if (first >= 0) {
    let last = first;
    for (let i = first; i < lines.length; i++) if (isQ(lines[i])) last = i;
    let oneRun = true;
    for (let i = first; i <= last; i++) if (!isQ(lines[i]) && lines[i].trim() !== '') oneRun = false;
    const before = lines.slice(0, first).filter((l) => l.trim() !== '');
    const attrib =
      before.length === 0 ||
      (before.length === 1 && /wrote:\s*$/i.test(before[0])) ||
      (before.length === 2 && /^\s*On\s/.test(before[0]) && !/wrote:/i.test(before[0]) && /wrote:\s*$/i.test(before[1]));
    if (oneRun && attrib && lines.slice(last + 1).some((l) => l.trim() !== '')) lines.splice(0, last + 1);
  }
  // Only the quoted block at the very end goes: from the bottom, blank lines and > lines
  let quoted = false;
  while (lines.length && (lines[bottom()].trim() === '' || /^\s*>/.test(lines[bottom()]))) {
    if (/^\s*>/.test(lines[bottom()])) quoted = true;
    lines.pop();
  }
  if (lines.length && (quoted || /^\s*On\s.+wrote:\s*$/i.test(lines[bottom()])) && /wrote:\s*$/i.test(lines[bottom()])) {
    lines.pop();
    if (lines.length && /^\s*On\s/.test(lines[bottom()]) && !/wrote:/i.test(lines[bottom()])) lines.pop();
  }
  const kept = lines.join('\n').trim() || whole;
  const skimmed = skim(kept);
  const out = name ? dropSignature(skimmed, name) : skimmed;
  return out.trim() ? out : kept;
}

/** What the list shows for an email with no words of its own: Photo, 2 photos, or the first filename. */
export function attachmentPreview(msg: EmailMessage): string {
  return attachmentLine(msg.attachments ?? []);
}

import { oneLine, cutText } from './preview';
export { oneLine, cutText, PREVIEW_MAX } from './preview';

export function newestOf(t: EmailThread): EmailMessage | undefined {
  return (t.messages ?? []).reduce<EmailMessage | undefined>((a, m) => (!a || ts(m.sentAt) > ts(a.sentAt) ? m : a), undefined);
}

/** Every address of mine: each account's, plus the thread's own. */
export function mineOf(accounts: { email: string }[], thread?: EmailThread): Set<string> {
  const out = new Set(accounts.map((a) => a.email.toLowerCase()));
  if (thread) out.add(thread.accountEmail.toLowerCase());
  return out;
}

/** One other person: their address. Two or more: "g:" and the sorted addresses. */
export function keyOf(people: { email: string }[]): string {
  const list = [...new Set(people.map((p) => p.email.toLowerCase()).filter(Boolean))].sort();
  return list.length >= 2 ? `g:${list.join(',')}` : list[0] ?? '';
}

export function chatKey(t: EmailThread, mine: Set<string>): string {
  return keyOf(othersOf(t, mine));
}

export const isUpdateThread = (t: EmailThread) => t.bucket === 'feed' || t.bucket === 'paper_trail' || !!t.receiptInfo;

/** Every thread the app has loaded, grouped by the person on the other end. `full` gives a thread with its messages when one has loaded. */
export function buildChats(data: Pick<Data, 'threads' | 'screener' | 'commitments' | 'tasks' | 'accounts'>, full: (id: string) => EmailThread | undefined, now = Date.now()): Chat[] {
  const muted = new Set(data.screener.filter((s) => s.status === 'muted').map((s) => s.email.toLowerCase()));
  const pending = new Map<string, ScreenerSender>(data.screener.filter((s) => s.status === 'pending').map((s) => [s.email.toLowerCase(), s]));
  const groups = groupThreads({
    threads: data.threads,
    mine: (t) => mineOf(data.accounts, t),
    muted,
    isUpdate: isUpdateThread,
    looksBulk,
  });
  for (const [key, s] of pending) {
    const listed = [...groups.values()].some((g) => g.people.some((p) => p.email.toLowerCase() === key));
    if (!groups.has(key) && !listed) groups.set(key, { key, people: [{ name: s.name || s.email, email: s.email }], threads: [], company: false });
  }
  const out: Chat[] = [];
  for (const [key, g] of groups) {
    const isGroup = !g.company && g.people.length >= 2;
    const threads = [...g.threads].sort((a, b) => ts(a.lastMessageAt) - ts(b.lastMessageAt));
    const sender = isGroup || g.company ? undefined : pending.get(key);
    const newest = threads[threads.length - 1];
    const msg = newest ? newestOf(full(newest.id) ?? newest) : undefined;
    const words = msg ? bubbleText(cutText(msg.bodyText, 4000), msg.fromName) : newest?.snippet ?? sender?.sampleSnippet ?? '';
    const text = (!words.trim() && msg ? attachmentPreview(msg) : words) || (newest ? oneLine(realSubject(newest.subject)) : '');
    const lastMine = !!msg?.isOutbound;
    const who = isGroup && msg && !lastMine ? `${firstName(msg.fromName || msg.fromEmail)}: ` : '';
    // A company chat shows the subject of its newest email; its body only when there is no subject
    const subject = g.company && newest ? oneLine(realSubject(newest.subject) || realSubject(msg?.subject)) : '';
    const newestFirst = [...threads].reverse();
    const people = g.company ? orderedSenders(g.people, newestFirst) : g.people;
    const name = isGroup
      ? groupName(g.people)
      : g.company
      ? companyName(senderNames(people, threads), g.domain ?? '')
      : g.people[0].name || g.people[0].email;
    out.push({
      key,
      name,
      email: people[0].email,
      people,
      isGroup,
      threads,
      lastAt: newest?.lastMessageAt ?? sender?.firstSeenAt ?? '',
      preview: subject || oneLine(shortenLinks(who + text)),
      lastMine,
      unread: threads.filter((t) => t.isUnread).length,
      needsReply: !g.company && (!!openAsk(threads) || (isLiveMode() && threads.some(liveNeedsReply))),
      isUpdate: threads.length > 0 && threads.every(isUpdateThread),
      category: chatCategory(threads, isUpdateThread, { senderEmail: isGroup ? undefined : people[0].email, isGroup }),
      isNew: !!sender,
      ...(g.company ? { isCompany: true, domain: g.domain } : {}),
    });
  }
  return out.sort((a, b) => ts(b.lastAt) - ts(a.lastAt));
}

/** A company chat's sender addresses, the newest sender first. */
function orderedSenders(people: Person[], newestFirst: EmailThread[]): Person[] {
  const rank = (p: Person) => {
    const i = newestFirst.findIndex((t) => t.participants.some((x) => x.email.toLowerCase() === p.email.toLowerCase()));
    return i < 0 ? newestFirst.length : i;
  };
  return [...people].sort((a, b) => rank(a) - rank(b));
}

/** The display names a company chat's senders use, oldest first (so the newest is last). */
function senderNames(people: Person[], threads: EmailThread[]): { name: string }[] {
  const out: { name: string }[] = [];
  for (const t of threads) {
    for (const p of t.participants) {
      if (people.some((x) => x.email.toLowerCase() === (p.email || '').toLowerCase())) out.push({ name: p.name || '' });
    }
  }
  return out;
}

/** Live Gmail has no written ask: a thread a person wrote last (bucket decision), not archived, needs a reply. */
const liveNeedsReply = (t: EmailThread) => !t.isArchived && t.bucket === 'decision';

/** The chat's open asks, most urgent first: a thread that is not archived, has an ask, and is not a newsletter or receipt. */
export function openAsk(threads: EmailThread[]): EmailThread | undefined {
  return threads
    .filter((t) => !t.isArchived && t.bucket !== 'archived' && !!t.distilledAsk && !isUpdateThread(t))
    .sort((a, b) => b.urgencyScore - a.urgencyScore || ts(b.lastMessageAt) - ts(a.lastMessageAt))[0];
}

/** The thread the chat's ask bar shows, else the newest thread of the chat that the Needs you stack would show. */
export function replyThread(chat: Chat, data: Pick<Data, 'threads' | 'screener' | 'commitments' | 'tasks'>): EmailThread | undefined {
  const ask = openAsk(chat.threads);
  if (ask) return ask;
  const needs = new Set(buildStack('needs-you', data, 'all').map((i) => i.id));
  return [...chat.threads].reverse().find((t) => needs.has(t.id));
}
