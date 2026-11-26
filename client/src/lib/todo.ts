import type { CommitmentItem, EmailThread } from './types';
import { counterpart } from './people';
import { dueTime, isDueToday, isOverdue, isUrgent } from './time';

/** What the To-do list is built from. */
interface TodoData {
  threads: EmailThread[];
  commitments: CommitmentItem[];
  tasks?: { threadId: string; completed: boolean; dueLabel?: string | null }[];
}

export interface TodoRow {
  key: string;
  threadId: string;
  /** Open promises on this thread (empty for a thread you moved to To-do). */
  commitmentIds: string[];
  title: string;
  /** The other person. */
  person: string;
  due?: string;
  overdue: boolean;
  dueToday: boolean;
  /** Overdue, or due within 3 hours. */
  urgent: boolean;
  promised: boolean;
  nudged?: boolean;
}

export interface Todo {
  /** What you owe: threads you moved here and promises you made. */
  open: TodoRow[];
  /** What others owe you. */
  waiting: TodoRow[];
}

export interface TodoCounts {
  open: number;
  dueToday: number;
  overdue: number;
  waiting: number;
}

function flags(due?: string | null) {
  return { due: due || undefined, overdue: isOverdue(due), dueToday: isDueToday(due), urgent: isUrgent(due) };
}

/** The one source for To-do. Every count in the app comes from here. */
export function buildTodo(data: TodoData, account: string): Todo {
  const inAccount = (id: string) => account === 'all' || id === account;
  const byId = new Map(data.threads.map((t) => [t.id, t]));
  const gone = (t?: EmailThread) => !!t && (t.isArchived || t.bucket === 'archived');
  // A thread put to sleep with Later leaves the list until it wakes
  const asleep = (t?: EmailThread) => !!t?.isSnoozedUntil && Date.parse(t.isSnoozedUntil) > Date.now();
  const promises = data.commitments.filter((c) => c.direction === 'you_promised' && c.status !== 'resolved' && inAccount(c.accountId));

  const rows = new Map<string, TodoRow>();
  for (const t of data.threads) {
    if (!t.isStarred || gone(t) || asleep(t) || !inAccount(t.accountId)) continue;
    const task = data.tasks?.find((k) => k.threadId === t.id && !k.completed && k.dueLabel);
    rows.set(t.id, {
      key: `t_${t.id}`,
      threadId: t.id,
      commitmentIds: [],
      title: t.distilledAsk || t.subject,
      person: counterpart(t).name,
      ...flags(t.deadlineLabel || task?.dueLabel),
      promised: false,
    });
  }
  for (const c of promises) {
    const thread = byId.get(c.threadId);
    if (gone(thread) || asleep(thread)) continue;
    const prev = rows.get(c.threadId);
    if (prev) {
      // One row per thread: the promise's words, the promise's due date
      prev.commitmentIds.push(c.id);
      prev.title = c.summary;
      prev.promised = true;
      if (c.dueLabel) Object.assign(prev, flags(c.dueLabel));
      continue;
    }
    const task = data.tasks?.find((k) => k.threadId === c.threadId && !k.completed && k.dueLabel);
    rows.set(c.threadId, {
      key: `t_${c.threadId}`,
      threadId: c.threadId,
      commitmentIds: [c.id],
      title: c.summary,
      person: c.counterpartyName,
      ...flags(c.dueLabel || thread?.deadlineLabel || task?.dueLabel),
      promised: true,
    });
  }

  // Overdue first, then soonest, undated last
  const open = [...rows.values()]
    .map((r, i) => ({ r, i, at: dueTime(r.due) }))
    .sort((a, b) => (a.at === b.at ? a.i - b.i : a.at < b.at ? -1 : 1))
    .map((x) => x.r);

  const waiting: TodoRow[] = data.commitments
    .filter((c) => c.direction === 'waiting_on_them' && c.status !== 'resolved' && inAccount(c.accountId))
    .map((c) => ({
      key: `w_${c.id}`,
      threadId: c.threadId,
      commitmentIds: [c.id],
      title: c.summary,
      person: c.counterpartyName,
      ...flags(c.dueLabel),
      promised: false,
      nudged: c.status === 'nudged',
    }));

  return { open, waiting };
}

export function todoCounts(data: TodoData, account: string): TodoCounts {
  const { open, waiting } = buildTodo(data, account);
  return {
    open: open.length,
    dueToday: open.filter((r) => r.dueToday && !r.overdue).length,
    overdue: open.filter((r) => r.overdue).length,
    waiting: waiting.length,
  };
}

/** The threads behind the open rows, in list order. */
export function todoThreadIds(data: TodoData, account: string): string[] {
  return buildTodo(data, account).open.map((r) => r.threadId);
}

/** `2 overdue · 2 due today`, or an empty string. */
export function dueBits(c: TodoCounts): string {
  return [c.overdue > 0 && `${c.overdue} overdue`, c.dueToday > 0 && `${c.dueToday} due today`].filter(Boolean).join(' · ');
}
