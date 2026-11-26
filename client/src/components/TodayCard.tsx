import { useEffect } from 'react';
import { estimateMinutes, handledToday, useProgressLog } from '../lib/progress';
import { Ring } from './Ring';
import { StreakStrip } from './StreakStrip';
import './TodayCard.css';

const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

/** The first card of a session: what is waiting, how long it takes, and the day's progress. */
export function TodayCard({ left, account, keys, onStart }: { left: number; account: string; keys: boolean; onStart: () => void }) {
  useProgressLog();
  // Enter and the right arrow start, the same as the button
  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key !== 'Enter' && e.key !== 'ArrowRight') return;
      const el = e.target;
      if (el instanceof HTMLElement && el.closest('input, textarea, select, [contenteditable="true"], a')) return;
      if (e.key === 'Enter' && el instanceof HTMLElement && el.closest('button')) return;
      e.preventDefault();
      onStart();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [keys, onStart]);
  const handled = handledToday('needs-you', account);
  const total = handled + left;
  const minutes = estimateMinutes('needs-you', left);
  return (
    <article className="card today">
      <div className="today__body">
        <p className="today__date">{dateLine()}</p>
        <h1 className="today__count">{handled > 0 ? `${left} left` : `${left} need you`}</h1>
        <p className="today__time">About {minutes} min</p>
        <div className="today__ring">
          <Ring value={total > 0 ? handled / total : 0}>
            {handled} of {total}
          </Ring>
        </div>
        <StreakStrip />
      </div>
      <div className="today__action">
        <button className="btn btn--primary today__start" onClick={onStart}>
          {handled > 0 ? 'Continue' : 'Start'}
        </button>
      </div>
    </article>
  );
}
