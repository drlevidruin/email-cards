import type { EmailMessage, EmailThread, ScreenerSender } from './types';
import { attachmentLine } from './pictureData';
import type { Data } from '../storeTypes';
import { buildStack } from './stacks';
import { groupName, othersOf, type Person } from './people';
import { dropSignature } from './signature';
import { skim } from './skim';
import { firstName } from './utils';
import { chatCategory, type Category } from './categories';
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
}

const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/** The email as a bubble shows it: no quoted earlier email at its end, no hello, no sign-off. */
export function bubbleText(body: string, name?: string): string {
  const whole = body.replace(/\r/g, '').trim();
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
  const groups = new Map<string, { people: Person[]; threads: EmailThread[] }>();
  for (const t of data.threads) {
    const people = othersOf(t, mineOf(data.accounts, t));
    const key = keyOf(people);
    if (!key) continue;
    if (people.length < 2 && muted.has(key)) continue;
    const g = groups.get(key) ?? { people, threads: [] };
    g.threads.push(t);
    groups.set(key, g);
  }
  for (const [key, s] of pending) {
    if (!groups.has(key)) groups.set(key, { people: [{ name: s.name || s.email, email: s.email }], threads: [] });
  }
  const out: Chat[] = [];
  for (const [key, g] of groups) {
    const isGroup = g.people.length >= 2;
    const threads = [...g.threads].sort((a, b) => ts(a.lastMessageAt) - ts(b.lastMessageAt));
    const sender = isGroup ? undefined : pending.get(key);
    const newest = threads[threads.length - 1];
    const msg = newest ? newestOf(full(newest.id) ?? newest) : undefined;
    const words = msg ? bubbleText(cutText(msg.bodyText, 4000), msg.fromName) : newest?.snippet ?? sender?.sampleSnippet ?? '';
    const text = !words.trim() && msg ? attachmentPreview(msg) : words;
    const lastMine = !!msg?.isOutbound;
    const who = isGroup && msg && !lastMine ? `${firstName(msg.fromName || msg.fromEmail)}: ` : '';
    out.push({
      key,
      name: isGroup ? groupName(g.people) : g.people[0].name || g.people[0].email,
      email: g.people[0].email,
      people: g.people,
      isGroup,
      threads,
      lastAt: newest?.lastMessageAt ?? sender?.firstSeenAt ?? '',
      preview: oneLine(who + text),
      lastMine,
      unread: threads.filter((t) => t.isUnread).length,
      needsReply: !!openAsk(threads) || (isLiveMode() && threads.some(liveNeedsReply)),
      isUpdate: threads.length > 0 && threads.every(isUpdateThread),
      category: chatCategory(threads, isUpdateThread, { senderEmail: isGroup ? undefined : g.people[0].email, isGroup }),
      isNew: !!sender,
    });
  }
  return out.sort((a, b) => ts(b.lastAt) - ts(a.lastAt));
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
