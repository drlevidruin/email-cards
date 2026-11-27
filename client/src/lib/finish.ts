import { stackCounts, stackLabel, type StackId } from './stacks';
import type { Data } from '../storeTypes';

export interface NextRow {
  path: string;
  label: string;
  count?: number;
}

export interface FinishInfo {
  /** The stacks that still have cards, the one to do next first. To-do is not here: the finish card shows it as its own line. */
  next: NextRow[];
  /** Needs you is empty in every account, whichever account is showing. */
  needsYouClear: boolean;
}

/** What the finish card needs: the way on, its kicker, and whether the day is really clear. */
export function finishInfo(data: Data, stack: StackId, account: string): FinishInfo {
  const counts = stackCounts(data, account);
  // Needs you comes first whenever it still has cards and is not the pile on screen; then the three sorted piles, then Later
  const order: StackId[] = ['needs-you', 'new-senders', 'newsletters', 'receipts', 'later'];
  const next: NextRow[] = order
    .filter((id) => id !== stack && counts[id] > 0)
    .map((id) => ({ path: `/cards/${id}`, label: stackLabel(id), count: counts[id] }));
  return {
    next,
    needsYouClear: stackCounts(data, 'all')['needs-you'] === 0,
  };
}
