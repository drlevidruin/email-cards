import { goalCount } from './goals';
import { stackCounts, stackLabel, STACKS, type StackId } from './stacks';
import type { Data } from '../storeTypes';

export interface NextRow {
  path: string;
  label: string;
  count?: number;
}

const MAIN: StackId[] = ['needs-you', 'new-senders', 'newsletters', 'receipts'];

export interface FinishInfo {
  /** Small line over All clear: Inbox, the account, or the stack. */
  kicker: string;
  next: NextRow[];
  /** Needs you is empty in every account, whichever account is showing. */
  needsYouClear: boolean;
}

/** What the finish card needs: the way on, its kicker, and whether the day is really clear. */
export function finishInfo(data: Data, stack: StackId, account: string): FinishInfo {
  const counts = stackCounts(data.threads, data.screener, account);
  const lead = (['new-senders', 'newsletters', 'receipts'] as StackId[]).find((id) => id !== stack && counts[id] > 0);
  const others = STACKS.filter((s) => s.id !== stack && s.id !== lead && counts[s.id] > 0);
  const next: NextRow[] = [...(lead ? [lead] : []), ...others.map((s) => s.id)].map((id) => ({
    path: `/cards/${id}`,
    label: stackLabel(id),
    count: counts[id],
  }));
  next.push({ path: '/goals', label: 'Goals', count: goalCount(data, account) });
  const mainEmpty = MAIN.every((id) => counts[id] === 0);
  const label = account === 'all' ? 'Inbox' : data.accounts.find((a) => a.id === account)?.label ?? stackLabel(stack);
  return {
    kicker: mainEmpty ? label : stackLabel(stack),
    next,
    needsYouClear: stackCounts(data.threads, data.screener, 'all')['needs-you'] === 0,
  };
}
