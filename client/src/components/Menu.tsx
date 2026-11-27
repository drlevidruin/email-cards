import { useRef } from 'react';
import { useDialog } from './useDialog';
import { X } from 'lucide-react';
import { api, isStaticDemoMode } from '../lib/api';
import { snapshotLabel } from '../lib/snapshot';
import { useHint } from '../lib/navHints';
import { todoCounts } from '../lib/todo';
import { stackCounts, type StackId } from '../lib/stacks';
import { AccountPicker, NavRow } from './NavRows';
import { PILE_ROWS } from './Rail';
import { navigate, useRoute } from '../router';
import { useStore } from '../store';
import './Menu.css';

interface Props {
  current: StackId;
  onClose: () => void;
}

export function Menu({ current, onClose }: Props) {
  const { data, account, resetSessions, reload } = useStore();
  const route = useRoute();
  const hint = useHint();

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

  return (
    <div className="menu-scrim" onClick={onClose}>
      <nav ref={box} className="menu" role="dialog" aria-modal="true" aria-label="Menu" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <div className="menu__head">
          <h2 className="t-headline menu__brand">Email Chat</h2>
          <button className="icon-btn" aria-label="Close menu" onClick={onClose}>
            <X size={22} strokeWidth={1.75} />
          </button>
        </div>
        <ul className="menu__group">
          <NavRow label="New email" onClick={() => go('/new')} />
        </ul>
        <ul className="menu__group">
          {PILE_ROWS.map((s) => (
            <NavRow key={s.id} list hint={hint(s.id)} label={s.label} count={counts[s.id]} here={onDeck && s.id === current} onClick={() => go(`/cards/${s.id}`)} />
          ))}
        </ul>
        <ul className="menu__group menu__group--gap">
          <NavRow list hint={hint('todo')} label="To-do" count={open} onClick={() => go('/goals')} />
          <NavRow list hint={hint('drafts')} label="Drafts" count={drafts} onClick={() => go('/drafts')} />
          <NavRow list hint={hint('all')} label="All mail" onClick={() => go('/all')} />
        </ul>
        <div className="menu__end">
          <AccountPicker />
          <ul>
            <NavRow label="How it works" onClick={() => go('/how')} />
            <NavRow label="Search" onClick={() => go('/ask')} />
            <NavRow label="Settings" onClick={() => go('/settings')} />
          </ul>
        </div>
        {(data.settings.demoMode || isStaticDemoMode()) && (
          <div className="t-footnote menu__demo">
            <span>{snapshotLabel() ?? 'Sample inbox'}</span>
            <button className="btn btn--text" onClick={() => void reset()}>
              Start over
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
