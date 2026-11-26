import type { EmailThread } from './types';
import type { Data } from '../storeTypes';
import { counterpart } from './stacks';
import { dueText, isHot } from './time';

export interface GoalRow {
  key: string;
  kind: 'bookmark' | 'commitment' | 'task';
  /** Id of the thread, commitment or task this row stands for. */
  id: string;
  threadId: string;
  title: string;
  meta: { text: string; hot?: boolean }[];
  nudged?: boolean;
}

export interface Goals {
  bookmarked: GoalRow[];
  owe: GoalRow[];
  waiting: GoalRow[];
}

const due = (label?: string | null) => (label ? [{ text: dueText(label), hot: isHot(label) }] : []);

function bookmarkRow(t: EmailThread): GoalRow {
  const meta: GoalRow['meta'] = [{ text: counterpart(t).name }];
  meta.push(...due(t.deadlineLabel));
  return { key: `b_${t.id}`, kind: 'bookmark', id: t.id, threadId: t.id, title: t.distilledAsk || t.subject, meta };
}

export function buildGoals(data: Data, account: string): Goals {
  const inAccount = (id: string) => account === 'all' || id === account;
  const bookmarked = data.threads
    .filter((t) => t.isStarred && !t.isArchived && t.bucket !== 'archived' && inAccount(t.accountId))
    .map(bookmarkRow);

  const promised = data.commitments.filter((c) => c.direction === 'you_promised' && c.status !== 'resolved' && inAccount(c.accountId));
  const archivedIds = new Set(data.threads.filter((t) => t.isArchived || t.bucket === 'archived').map((t) => t.id));
  const covered = new Set([...promised.map((c) => c.threadId), ...bookmarked.map((r) => r.threadId)]);
  const owe: GoalRow[] = promised.map((c) => ({
    key: `c_${c.id}`,
    kind: 'commitment',
    id: c.id,
    threadId: c.threadId,
    title: c.summary,
    meta: [{ text: c.counterpartyName }, ...due(c.dueLabel)],
  }));
  // A task on a thread that already has a promise or a bookmark would show the same job twice.
  for (const k of data.tasks) {
    if (k.completed || !inAccount(k.accountId) || covered.has(k.threadId) || archivedIds.has(k.threadId)) continue;
    owe.push({
      key: `t_${k.id}`,
      kind: 'task',
      id: k.id,
      threadId: k.threadId,
      title: k.title,
      meta: due(k.dueLabel),
    });
  }

  const waiting: GoalRow[] = data.commitments
    .filter((c) => c.direction === 'waiting_on_them' && c.status !== 'resolved' && inAccount(c.accountId))
    .map((c) => ({
      key: `c_${c.id}`,
      kind: 'commitment',
      id: c.id,
      threadId: c.threadId,
      title: c.summary,
      meta: [{ text: c.counterpartyName }, ...due(c.dueLabel), ...(c.status === 'nudged' ? [{ text: 'Nudged' }] : [])],
      nudged: c.status === 'nudged',
    }));

  return { bookmarked, owe, waiting };
}

export function goalCount(data: Data, account: string): number {
  const g = buildGoals(data, account);
  return g.bookmarked.length + g.owe.length + g.waiting.length;
}
