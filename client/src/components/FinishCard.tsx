import { ChevronRight } from 'lucide-react';
import { navigate } from '../router';
import { minutesToday, moveCounts, repliesToday, handledToday, useProgressLog } from '../lib/progress';
import type { NextRow } from '../lib/finish';
import type { StackId } from '../lib/stacks';
import { dueBits, todoCounts } from '../lib/todo';
import { useStore } from '../store';
import { FinishPile } from './FinishPile';
import { StreakStrip } from './StreakStrip';
import './FinishCard.css';

export type { NextRow };

interface Props {
  stack: StackId;
  account: string;
  kicker: string;
  /** The user's own last move emptied the stack: the pile settles in and the check pops. Otherwise it shows finished at rest. */
  celebrate: boolean;
  /** Needs you is empty in every account, so the streak is real. */
  dayClear: boolean;
  next: NextRow[];
}

export function duration(mins: number): string {
  if (mins < 1) return 'under a minute';
  const total = Math.round(mins);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** What each move is called in the moves line, with where it went. */
const MOVE_WORDS: Record<string, string> = {
  Done: 'done',
  Later: 'later',
  'To-do': 'on your To-do',
  Blocked: 'blocked',
  Allowed: 'allowed',
  Moved: 'to Newsletters',
};

/** `2 allowed \u00B7 1 to Newsletters \u00B7 1 blocked`: the moves as a lower-case sentence with their destinations. */
export function movesLine(moves: [string, number][]): string {
  return moves.map(([k, n]) => `${n} ${MOVE_WORDS[k] ?? k.toLowerCase()}`).join(' \u00B7 ');
}

/** Handled time over handled cards, to the nearest 5 seconds. Nothing under 3 cards. */
function pace(handled: number, mins: number): string | null {
  if (handled < 3) return null;
  const secs = Math.max(5, Math.round((mins * 60) / handled / 5) * 5);
  return secs < 90 ? `About ${secs} seconds a card` : `About ${Math.round(secs / 60)} min a card`;
}

/** What shows when a stack is empty: the pile you just cleared, the honest count of what is still on your list, and the way on. */
export function FinishCard({ stack, account, kicker, celebrate, dayClear, next }: Props) {
  useProgressLog();
  const { data } = useStore();
  const handled = handledToday(stack, account);
  const replies = repliesToday(stack, account);
  const mins = minutesToday(stack, account);
  const counts = data ? todoCounts(data, account) : null;
  const bits = counts ? dueBits(counts) : '';
  const [first, ...rest] = next;
  const speed = pace(handled, mins);
  const moves = moveCounts(stack, account);
  const todoRow = !!counts && counts.open > 0;
  return (
    <section className="finish">
      <div className="finish__body">
        <FinishPile stack={stack} account={account} celebrate={celebrate} />
        <p className="t-footnote finish__kicker">{kicker}</p>
        <h1 className="t-title finish__title">All clear</h1>
        {handled > 0 && (
          <p className="t-subhead finish__stats">
            {replies > 0 ? `${replies} ${replies === 1 ? 'reply' : 'replies'} in ` : 'In '}
            {duration(mins)}
          </p>
        )}
        {speed && <p className="t-footnote finish__pace">{speed}</p>}
        {moves.length > 0 && <p className="t-footnote finish__pace">{movesLine(moves)}</p>}
      </div>
      <div className="finish__week">
        <StreakStrip pop={celebrate && stack === 'needs-you' && dayClear} />
      </div>
      {(todoRow || rest.length > 0) && (
        <ul className="finish__list">
          {todoRow && (
            <li>
              <button className="finish__row" onClick={() => navigate('/goals')}>
                <span className="t-callout finish__row-label">Still on your To-do</span>
                <span className="t-subhead t-num finish__row-count">{bits ? `${counts?.open} · ${bits}` : counts?.open}</span>
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </li>
          )}
          {rest.map((row) => (
            <li key={row.path}>
              <button className="finish__row" onClick={() => navigate(row.path)}>
                <span className="t-callout finish__row-label">{row.label}</span>
                {row.count !== undefined && <span className="t-subhead t-num finish__row-count">{row.count}</span>}
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {first && (
        <div className="finish__action">
          <button className="finish__primary" onClick={() => navigate(first.path)}>
            Next: {first.label}
            {first.count !== undefined && <span className="finish__primary-count t-num"> {first.count}</span>}
          </button>
        </div>
      )}
    </section>
  );
}
