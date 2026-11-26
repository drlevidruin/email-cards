import type { EmailThread, ScreenerSender } from './types';

export type StackId = 'needs-you' | 'new-senders' | 'newsletters' | 'receipts' | 'bookmarked' | 'later';

export const STACKS: { id: StackId; label: string }[] = [
  { id: 'needs-you', label: 'Needs you' },
  { id: 'new-senders', label: 'New senders' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'bookmarked', label: 'Bookmarked' },
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

export function buildStack(
  id: StackId,
  threads: EmailThread[],
  screener: ScreenerSender[],
  account: string,
  now = Date.now()
): DeckItem[] {
  const inAccount = (accountId: string) => account === 'all' || accountId === account;
  if (id === 'new-senders') {
    return screener
      .filter((s) => s.status === 'pending' && inAccount(s.accountId))
      .map((sender) => ({ type: 'sender', id: sender.email, sender }));
  }

  const live = threads.filter((t) => !t.isArchived && t.bucket !== 'archived' && inAccount(t.accountId));
  let list: EmailThread[];
  switch (id) {
    case 'needs-you':
      list = live
        .filter(
          (t) =>
            !snoozed(t, now) &&
            !t.isStarred &&
            (t.bucket === 'decision' ||
              t.bucket === 'waiting' ||
              (t.isUnread && !['feed', 'paper_trail', 'screener'].includes(t.bucket)))
        )
        .sort((a, b) => b.urgencyScore - a.urgencyScore || newest(a, b));
      break;
    case 'newsletters':
      list = live.filter((t) => t.bucket === 'feed' && !snoozed(t, now)).sort(newest);
      break;
    case 'receipts':
      list = live.filter((t) => (t.bucket === 'paper_trail' || !!t.receiptInfo) && !snoozed(t, now)).sort(newest);
      break;
    case 'bookmarked':
      list = live
        .filter((t) => t.isStarred)
        .sort((a, b) => (a.deadlineAt ? ts(a.deadlineAt) : Infinity) - (b.deadlineAt ? ts(b.deadlineAt) : Infinity));
      break;
    default:
      list = live.filter((t) => snoozed(t, now)).sort((a, b) => ts(a.isSnoozedUntil) - ts(b.isSnoozedUntil));
  }
  return list.map((thread) => ({ type: 'thread', id: thread.id, thread }));
}

export function stackCounts(
  threads: EmailThread[],
  screener: ScreenerSender[],
  account: string
): Record<StackId, number> {
  const out = {} as Record<StackId, number>;
  for (const s of STACKS) out[s.id] = buildStack(s.id, threads, screener, account).length;
  return out;
}

/** Reply actions are every quick action that is not archive or snooze. */
export function replyActions(thread: EmailThread) {
  return thread.quickActions.filter((a) => a.kind !== 'archive' && a.kind !== 'snooze');
}

export function counterpart(thread: EmailThread): { name: string; email: string } {
  const mine = thread.accountEmail.toLowerCase();
  return (
    thread.participants.find((p) => p.email.toLowerCase() !== mine) ||
    thread.participants[0] || { name: 'Unknown', email: '' }
  );
}

export function cleanSubject(subject: string): string {
  return subject.replace(/^((re|fwd?):\s*)+/i, '');
}
