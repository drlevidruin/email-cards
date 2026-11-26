import { Check, Clock, FileText, Inbox, ListChecks, Mail, Newspaper, Receipt, Search, Settings, SquarePen, UserPlus, type LucideIcon } from 'lucide-react';
import { stackCounts, type StackId } from '../lib/stacks';
import { todoCounts } from '../lib/todo';
import { navigate } from '../router';
import { useStore } from '../store';
import './Rail.css';

const STACK_ROWS: { id: StackId; label: string; Icon: LucideIcon }[] = [
  { id: 'needs-you', label: 'Needs you', Icon: Inbox },
  { id: 'new-senders', label: 'New senders', Icon: UserPlus },
  { id: 'newsletters', label: 'Newsletters', Icon: Newspaper },
  { id: 'receipts', label: 'Receipts', Icon: Receipt },
  { id: 'later', label: 'Later', Icon: Clock },
];

/** The place the screen is on, as a rail row id. */
export type Here = StackId | 'todo' | 'drafts' | 'all' | 'search' | 'settings' | null;

interface RowProps {
  Icon?: LucideIcon;
  label: string;
  count?: number;
  cap?: string;
  here?: boolean;
  /** An account row: the chosen one reads in ink with a check; it is not the place the pill marks. */
  chosen?: boolean;
  account?: boolean;
  dot?: string;
  onClick: () => void;
}

function Row({ Icon, label, count, cap, here, chosen, account, dot, onClick }: RowProps) {
  return (
    <li>
      <button
        className={`rail__row${here ? ' is-current' : ''}${chosen ? ' is-chosen' : ''}`}
        aria-current={here ? 'page' : undefined}
        aria-pressed={account ? !!chosen : undefined}
        onClick={onClick}
      >
        {Icon && <Icon size={18} strokeWidth={1.75} className="rail__icon" />}
        {dot && <span className="rail__dot" style={{ background: dot }} />}
        <span className="t-subhead rail__label">{label}</span>
        {cap && <kbd className="keycap">{cap}</kbd>}
        {count !== undefined && count > 0 && <span className="t-footnote t-num rail__count">{count}</span>}
        {chosen && <Check size={16} strokeWidth={1.75} className="rail__check" />}
      </button>
    </li>
  );
}

/** The left rail on a laptop: the way around the app. */
export function Rail({ here }: { here: Here }) {
  const { data, account, setAccount } = useStore();
  const counts = data ? stackCounts(data, account) : null;
  const open = data ? todoCounts(data, account).open : 0;
  const drafts = data ? data.drafts.filter((d) => d.status !== 'sent').length : 0;
  return (
    <nav className="rail" aria-label="Mail">
      <h2 className="t-headline rail__brand">Email Cards</h2>
      <button className="btn btn--secondary rail__new" onClick={() => navigate('/new')}>
        <SquarePen size={16} strokeWidth={1.75} />
        New email
      </button>
      {data && data.accounts.length > 1 && (
        <ul className="rail__group">
          <Row label="All accounts" dot="var(--ink-4)" account chosen={account === 'all'} onClick={() => setAccount('all')} />
          {data.accounts.map((a) => (
            <Row key={a.id} label={a.label} dot={a.color} account chosen={account === a.id} onClick={() => setAccount(a.id)} />
          ))}
        </ul>
      )}
      <ul className="rail__group">
        {STACK_ROWS.map((s) => (
          <Row key={s.id} Icon={s.Icon} label={s.label} count={counts?.[s.id]} here={here === s.id} onClick={() => navigate(`/cards/${s.id}`)} />
        ))}
      </ul>
      <ul className="rail__group rail__group--gap">
        <Row Icon={ListChecks} label="To-do" count={open} here={here === 'todo'} onClick={() => navigate('/goals')} />
        <Row Icon={FileText} label="Drafts" count={drafts} here={here === 'drafts'} onClick={() => navigate('/drafts')} />
        <Row Icon={Mail} label="All mail" here={here === 'all'} onClick={() => navigate('/all')} />
      </ul>
      <ul className="rail__group rail__group--end">
        <Row Icon={Search} label="Search" cap="/" here={here === 'search'} onClick={() => navigate('/ask')} />
        <Row Icon={Settings} label="Settings" here={here === 'settings'} onClick={() => navigate('/settings')} />
      </ul>
    </nav>
  );
}
