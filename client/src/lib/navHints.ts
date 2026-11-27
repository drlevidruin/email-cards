import { isFirstSession } from './onboarding';
import { useProgressLog } from './progress';

/** The one line under each pile's name, in the menu, the rail and How it works. */
export const PLACES: { key: string; label: string; line: string }[] = [
  { key: 'needs-you', label: 'Needs you', line: 'Emails waiting on an answer from you' },
  { key: 'new-senders', label: 'New senders', line: 'People writing to you for the first time' },
  { key: 'newsletters', label: 'Newsletters', line: 'Things you signed up for' },
  { key: 'receipts', label: 'Receipts', line: 'Orders, bills and bookings' },
  { key: 'later', label: 'Later', line: 'Emails you put off, until their time' },
  { key: 'todo', label: 'To-do', line: 'Emails you marked to work on' },
  { key: 'drafts', label: 'Drafts', line: 'Replies you started' },
  { key: 'all', label: 'All mail', line: 'Everything, newest first' },
];

/** The line for a row, in the first session only. */
export function useHint(): (key: string) => string | undefined {
  useProgressLog();
  const first = isFirstSession();
  return (key) => (first ? PLACES.find((p) => p.key === key)?.line : undefined);
}
