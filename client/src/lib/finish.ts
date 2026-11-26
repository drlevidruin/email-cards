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
  /** The stacks that still have cards, the one to do next first. To-do is not here: the finish card shows it as its own line. */
  next: NextRow[];
  /** Needs you is empty in every account, whichever account is showing. */
  needsYouClear: boolean;
}

/** What the finish card needs: the way on, its kicker, and whether the day is really clear. */
export function finishInfo(data: Data, stack: StackId, account: string): FinishInfo {
  const counts = stackCounts(data, account);
  const lead = (['new-senders', 'newsletters', 'receipts'] as StackId[]).find((id) => id !== stack && counts[id] > 0);
  const others = STACKS.filter((s) => s.id !== stack && s.id !== lead && s.id !== 'bookmarked' && counts[s.id] > 0);
  const next: NextRow[] = [...(lead ? [lead] : []), ...others.map((s) => s.id)].map((id) => ({
    path: `/cards/${id}`,
    label: stackLabel(id),
    count: counts[id],
  }));
  const mainEmpty = MAIN.every((id) => counts[id] === 0);
  const label = account === 'all' ? 'Inbox' : data.accounts.find((a) => a.id === account)?.label ?? stackLabel(stack);
  return {
    kicker: mainEmpty ? label : stackLabel(stack),
    next,
    needsYouClear: stackCounts(data, 'all')['needs-you'] === 0,
  };
}
