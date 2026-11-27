import type { StackId } from '../lib/stacks';
import { navigate } from '../router';
import { NavRow } from './NavRows';
import './Rail.css';

export const PILE_ROWS: { id: StackId; label: string }[] = [
  { id: 'needs-you', label: 'Needs you' },
  { id: 'new-senders', label: 'New senders' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'later', label: 'Later' },
];

/** The place the screen is on, as a rail row id. */
export type Here = StackId | 'todo' | 'drafts' | 'all' | 'search' | 'settings' | 'how' | null;

/** The left rail on a laptop, for the screens that still open inside the old shell: the app name, Emails, New email and Settings. */
export function Rail({ here }: { here: Here }) {
  return (
    <nav className="rail" aria-label="Mail">
      <h2 className="t-headline rail__brand">Email Cards</h2>
      <ul>
        <NavRow label="Emails" onClick={() => navigate('/chats')} />
        <NavRow label="New email" cap="C" onClick={() => navigate('/new')} />
        <NavRow label="Settings" here={here === 'settings'} onClick={() => navigate('/settings')} />
      </ul>
    </nav>
  );
}
