import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { useStore } from '../store';
import './NavRows.css';

interface RowProps {
  label: string;
  count?: number;
  cap?: string;
  /** A line of the contents: its count is a numeral at the left, and a row with none leaves that column empty. */
  list?: boolean;
  /** The one line under the name, in the first session. */
  hint?: string;
  /** The line as a hover title, for a row that shows no hint. */
  title?: string;
  here?: boolean;
  onClick: () => void;
}

/** One line of the way around the app: a serif count at the left for the piles, the words, and a key cap if it has one. No icon. */
export function NavRow({ label, count, cap, list, hint, title, here, onClick }: RowProps) {
  return (
    <li>
      <button className={`navrow${here ? ' is-current' : ''}`} title={title} aria-current={here ? 'page' : undefined} onClick={onClick}>
        {list && <span className="voice t-num navrow__num">{count !== undefined && count > 0 ? count : ''}</span>}
        <span className="navrow__text">
          <span className="t-subhead navrow__label">{label}</span>
          {hint && <span className="t-footnote navrow__hint">{hint}</span>}
        </span>
        {cap && <kbd className="keycap">{cap}</kbd>}
      </button>
    </li>
  );
}

/** The accounts as one row, `All accounts` with an up-down chevron. It opens a menu of the accounts with their colors and a check on the current one. */
export function AccountPicker() {
  const { data, account, setAccount } = useStore();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    };
    window.addEventListener('pointerdown', away);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', away);
      window.removeEventListener('keydown', key, true);
    };
  }, [open]);
  if (!data || data.accounts.length < 2) return null;
  const current = account === 'all' ? 'All accounts' : data.accounts.find((a) => a.id === account)?.label ?? 'All accounts';
  const pick = (id: string) => {
    setAccount(id);
    setOpen(false);
  };
  const item = (id: string, label: string, color: string) => (
    <li key={id}>
      <button className="acct__item" role="menuitemradio" aria-checked={account === id} onClick={() => pick(id)}>
        <span className="acct__dot" style={{ background: color }} />
        <span className="t-subhead acct__name">{label}</span>
        {account === id && <Check size={16} strokeWidth={1.75} />}
      </button>
    </li>
  );
  return (
    <div className="acct" ref={box}>
      {open && (
        <ul className="acct__menu" role="menu" aria-label="Accounts">
          {item('all', 'All accounts', 'var(--ink-4)')}
          {data.accounts.map((a) => item(a.id, a.label, a.color))}
        </ul>
      )}
      <button className="navrow acct__row" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <span className="navrow__text">
          <span className="t-subhead navrow__label">{current}</span>
        </span>
        <ChevronsUpDown size={14} strokeWidth={1.75} className="acct__chev" />
      </button>
    </div>
  );
}
