import { stackCounts, type StackId } from '../lib/stacks';
import { todoCounts } from '../lib/todo';
import { navigate } from '../router';
import { useStore } from '../store';
import { AccountPicker, NavRow } from './NavRows';
import './Rail.css';

export const PILE_ROWS: { id: StackId; label: string }[] = [
  { id: 'needs-you', label: 'Needs you' },
  { id: 'new-senders', label: 'New senders' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'later', label: 'Later' },
];

/** The place the screen is on, as a rail row id. */
export type Here = StackId | 'todo' | 'drafts' | 'all' | 'search' | 'settings' | null;

/** The left rail on a laptop: the way around the app, in words and counts. */
export function Rail({ here }: { here: Here }) {
  const { data, account } = useStore();
  const counts = data ? stackCounts(data, account) : null;
  const open = data ? todoCounts(data, account).open : 0;
  const drafts = data ? data.drafts.filter((d) => d.status !== 'sent').length : 0;
  return (
    <nav className="rail" aria-label="Mail">
      <h2 className="t-headline rail__brand">Email Cards</h2>
      <ul>
        <NavRow label="New email" cap="C" onClick={() => navigate('/new')} />
      </ul>
      <ul className="rail__group">
        {PILE_ROWS.map((s) => (
          <NavRow key={s.id} label={s.label} count={counts?.[s.id]} here={here === s.id} onClick={() => navigate(`/cards/${s.id}`)} />
        ))}
      </ul>
      <ul className="rail__group rail__group--gap">
        <NavRow label="To-do" count={open} here={here === 'todo'} onClick={() => navigate('/goals')} />
        <NavRow label="Drafts" count={drafts} here={here === 'drafts'} onClick={() => navigate('/drafts')} />
        <NavRow label="All mail" here={here === 'all'} onClick={() => navigate('/all')} />
      </ul>
      <div className="rail__end">
        <AccountPicker />
        <ul>
          <NavRow label="Search" cap="/" here={here === 'search'} onClick={() => navigate('/ask')} />
          <NavRow label="Settings" here={here === 'settings'} onClick={() => navigate('/settings')} />
        </ul>
      </div>
    </nav>
  );
}
