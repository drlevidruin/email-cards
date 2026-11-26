import { useRef } from 'react';
import { useDialog } from './useDialog';
import { Check, X } from 'lucide-react';
import { api, isStaticDemoMode } from '../lib/api';
import { goalCount } from '../lib/goals';
import { STACKS, stackCounts, type StackId } from '../lib/stacks';
import { navigate } from '../router';
import { useStore } from '../store';
import './Menu.css';

interface Props {
  current: StackId;
  onClose: () => void;
}

export function Menu({ current, onClose }: Props) {
  const { data, account, setAccount, resetSessions, reload } = useStore();

  const box = useRef<HTMLElement>(null);
  useDialog(box, onClose);

  if (!data) return null;
  const counts = stackCounts(data.threads, data.screener, account);
  const drafts = data.drafts.filter((d) => d.status !== 'sent').length;
  const goals = goalCount(data, account);
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

  const row = (label: string, path: string, count?: number) => (
    <li key={path}>
      <button className="menu__row" onClick={() => go(path)}>
        <span className="menu__row-label">{label}</span>
        {count ? <span className="menu__count">{count}</span> : null}
      </button>
    </li>
  );

  return (
    <div className="menu-scrim" onClick={onClose}>
      <nav ref={box} className="menu" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="menu__head">
          <h2 className="menu__brand">Email Cards</h2>
          <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
            <X size={22} strokeWidth={2} />
          </button>
        </div>
        <ul>
          <li>
            <button className="menu__row" onClick={() => setAccount('all')}>
              <span className="menu__row-label">All accounts</span>
              {account === 'all' && <Check size={18} strokeWidth={2} className="menu__check" />}
            </button>
          </li>
          {data.accounts.map((a) => (
            <li key={a.id}>
              <button className="menu__row" onClick={() => setAccount(a.id)}>
                <span className="menu__dot" style={{ background: a.color }} />
                <span className="menu__row-label">{a.label}</span>
                <span className="menu__email">{a.email}</span>
                {account === a.id && <Check size={18} strokeWidth={2} className="menu__check" />}
              </button>
            </li>
          ))}
        </ul>
        <h3 className="menu__heading">Stacks</h3>
        <ul>
          {STACKS.map((s) => (
            <li key={s.id}>
              <button
                className={`menu__row${s.id === current ? ' is-current' : ''}`}
                onClick={() => go(`/cards/${s.id}`)}
              >
                <span className="menu__row-label">{s.label}</span>
                {counts[s.id] > 0 && <span className="menu__count">{counts[s.id]}</span>}
              </button>
            </li>
          ))}
        </ul>
        <hr className="menu__rule" />
        <ul>
          {row('Goals', '/goals', goals)}
          {row('All mail', '/all')}
          {row('Drafts', '/drafts', drafts)}
          {row('Ask Claude', '/ask')}
          {row('New email', '/new')}
        </ul>
        <hr className="menu__rule" />
        <ul>
          {row('Settings', '/settings')}
        </ul>
        {(data.settings.demoMode || isStaticDemoMode()) && (
          <div className="menu__demo">
            <span>Demo data</span>
            <button className="btn btn--text" onClick={() => void reset()}>
              Reset
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
