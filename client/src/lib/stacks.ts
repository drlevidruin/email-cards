import type { EmailThread, ScreenerSender } from './types';
import type { Data } from '../storeTypes';
import { counterpart } from './people';
import { todoThreadIds } from './todo';

export { counterpart };

/** What a stack is built from. */
export type StackData = Pick<Data, 'threads' | 'screener' | 'commitments' | 'tasks'>;

export type StackId = 'needs-you' | 'new-senders' | 'newsletters' | 'receipts' | 'bookmarked' | 'later';

export const STACKS: { id: StackId; label: string }[] = [
  { id: 'needs-you', label: 'Needs you' },
  { id: 'new-senders', label: 'New senders' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'bookmarked', label: 'To-do' },
  { id: 'later', label: 'Later' },
];

export function isStackId(v: string | undefined): v is StackId {
  return STACKS.some((s) => s.id === v);
}

export function stackLabel(id: StackId): string {
  return STACKS.find((s) => s.id === id)?.label ?? '';
}

export type DeckItem =
  | { type: 'thread'; id: string; thread: EmailThread }
  | { type: 'sender'; id: string; sender: ScreenerSender };

const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);
const snoozed = (t: EmailThread, now: number) => !!t.isSnoozedUntil && ts(t.isSnoozedUntil) > now;
const newest = (a: EmailThread, b: EmailThread) => ts(b.lastMessageAt) - ts(a.lastMessageAt);

export function buildStack(id: StackId, data: StackData, account: string, now = Date.now()): DeckItem[] {
  const { threads, screener } = data;
  const inAccount = (accountId: string) => account === 'all' || accountId === account;
  if (id === 'new-senders') {
    return screener
      .filter((s) => s.status === 'pending' && inAccount(s.accountId))
      .map((sender) => ({ type: 'sender', id: sender.email, sender }));
  }

  // A thread with an open To-do row lives there, not in Needs you
  const onTodo = todoThreadIds(data, account);
  const live = threads.filter((t) => !t.isArchived && t.bucket !== 'archived' && inAccount(t.accountId));
  let list: EmailThread[];
  switch (id) {
    case 'needs-you':
      list = live
        .filter(
          (t) =>
            !snoozed(t, now) &&
            !onTodo.includes(t.id) &&
            (t.bucket === 'decision' ||
              t.bucket === 'waiting' ||
              (t.isUnread && !['feed', 'paper_trail', 'screener'].includes(t.bucket)))
        )
        .sort((a, b) => b.urgencyScore - a.urgencyScore || newest(a, b));
      break;
    case 'newsletters':
      list = live.filter((t) => t.bucket === 'feed' && !snoozed(t, now) && !onTodo.includes(t.id)).sort(newest);
      break;
    case 'receipts':
      list = live.filter((t) => (t.bucket === 'paper_trail' || !!t.receiptInfo) && !snoozed(t, now) && !onTodo.includes(t.id)).sort(newest);
      break;
    case 'bookmarked':
      list = onTodo.flatMap((tid) => live.filter((t) => t.id === tid));
      break;
    default:
      list = live.filter((t) => snoozed(t, now)).sort((a, b) => ts(a.isSnoozedUntil) - ts(b.isSnoozedUntil));
  }
  return list.map((thread) => ({ type: 'thread', id: thread.id, thread }));
}

/** Skipped cards go to the end, in the order they were skipped. */
export function applySkips(items: DeckItem[], skipped: string[]): DeckItem[] {
  if (skipped.length === 0) return items;
  const out = items.filter((i) => !skipped.includes(i.id));
  for (const id of skipped) {
    const hit = items.find((i) => i.id === id);
    if (hit) out.push(hit);
  }
  return out;
}

export function stackCounts(data: StackData, account: string): Record<StackId, number> {
  const out = {} as Record<StackId, number>;
  for (const s of STACKS) out[s.id] = buildStack(s.id, data, account).length;
  return out;
}

/** Reply actions are every quick action that is not archive or snooze. */
export function replyActions(thread: EmailThread) {
  return thread.quickActions.filter((a) => a.kind !== 'archive' && a.kind !== 'snooze');
}

export function cleanSubject(subject: string): string {
  return subject.replace(/^((re|fwd?):\s*)+/i, '');
}
