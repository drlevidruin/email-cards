import { useRef, type ReactNode } from 'react';
import { useDialog } from './useDialog';
import { Check, Clock, FileText, Inbox, ListChecks, Mail, Newspaper, Receipt, Settings, SquarePen, UserPlus, X, type LucideIcon } from 'lucide-react';
import { api, isStaticDemoMode } from '../lib/api';
import { snapshotLabel } from '../lib/snapshot';
import { todoCounts } from '../lib/todo';
import { stackCounts, type StackId } from '../lib/stacks';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import './Menu.css';

interface Props {
  current: StackId;
  onClose: () => void;
}

const STACK_ROWS: { id: StackId; label: string; Icon: LucideIcon }[] = [
  { id: 'needs-you', label: 'Needs you', Icon: Inbox },
  { id: 'new-senders', label: 'New senders', Icon: UserPlus },
  { id: 'newsletters', label: 'Newsletters', Icon: Newspaper },
  { id: 'receipts', label: 'Receipts', Icon: Receipt },
  { id: 'later', label: 'Later', Icon: Clock },
];

export function Menu({ current, onClose }: Props) {
  const { data, account, setAccount, resetSessions, reload } = useStore();
  const route = useRoute();

  const box = useRef<HTMLElement>(null);
  useDialog(box, onClose);

  if (!data) return null;
  const counts = stackCounts(data, account);
  const open = todoCounts(data, account).open;
  const drafts = data.drafts.filter((d) => d.status !== 'sent').length;
  // The deck the menu was opened from is the current place, unless a page sits on top of it
  const onDeck = route.segments[0] === 'cards';
  const go = (path: string) => {
    onClose();
    navigate(path);
  };

  const reset = async () => {
    await api.resetDemo();
    resetSessions();
    await reload();
    onClose();
    navigate('/cards/needs-you');
  };

  const row = (key: string, icon: ReactNode, label: string, onClick: () => void, opts: { count?: number; here?: boolean; end?: ReactNode } = {}) => (
    <li key={key}>
      <button className={`menu__row${opts.here ? ' is-current' : ''}`} onClick={onClick}>
        <span className="menu__icon">{icon}</span>
        <span className="t-callout menu__row-label">{label}</span>
        {opts.end}
        {opts.count ? <span className="t-subhead t-num menu__count">{opts.count}</span> : null}
      </button>
    </li>
  );
  const icon = (I: LucideIcon) => <I size={22} strokeWidth={1.75} />;
  const tick = (on: boolean) => (on ? <Check size={18} strokeWidth={1.75} className="menu__check" /> : null);

  return (
    <div className="menu-scrim" onClick={onClose}>
      <nav ref={box} className="menu" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="menu__head">
          <h2 className="t-headline menu__brand">Email Cards</h2>
          <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>
        {data.accounts.length > 1 && (
          <ul className="menu__group">
            {row('all', <span className="menu__dot menu__dot--all" />, 'All accounts', () => setAccount('all'), { end: tick(account === 'all') })}
            {data.accounts.map((a) =>
              row(a.id, <span className="menu__dot" style={{ background: a.color }} />, a.label, () => setAccount(a.id), { end: tick(account === a.id) })
            )}
          </ul>
        )}
        <ul className="menu__group">
          {STACK_ROWS.map((s) => row(s.id, icon(s.Icon), s.label, () => go(`/cards/${s.id}`), { count: counts[s.id], here: onDeck && s.id === current }))}
        </ul>
        <ul className="menu__group">
          {row('todo', icon(ListChecks), 'To-do', () => go('/goals'), { count: open })}
          {row('drafts', icon(FileText), 'Drafts', () => go('/drafts'), { count: drafts })}
          {row('all-mail', icon(Mail), 'All mail', () => go('/all'))}
          {row('new', icon(SquarePen), 'New email', () => go('/new'))}
        </ul>
        <ul className="menu__group">{row('settings', icon(Settings), 'Settings', () => go('/settings'))}</ul>
        {(data.settings.demoMode || isStaticDemoMode()) && (
          <div className="t-footnote menu__demo">
            <span>{snapshotLabel() ?? 'Demo data'}</span>
            <button className="btn btn--text" onClick={() => void reset()}>
              Reset
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
