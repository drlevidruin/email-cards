import { ChevronRight } from 'lucide-react';
import { navigate } from '../router';
import { minutesToday, repliesToday, handledToday, useProgressLog } from '../lib/progress';
import type { NextRow } from '../lib/finish';
import type { StackId } from '../lib/stacks';
import { Confetti } from './Confetti';
import { Ring } from './Ring';
import { StreakStrip } from './StreakStrip';
import './FinishCard.css';

export type { NextRow };

interface Props {
  stack: StackId;
  account: string;
  kicker: string;
  /** The user's own last move emptied the stack: the ring fills, the check draws, confetti. Otherwise it shows finished at rest. */
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

function stats(stack: StackId, account: string): string {
  const handled = handledToday(stack, account);
  const replies = repliesToday(stack, account);
  const parts: string[] = [];
  if (handled > 0) parts.push(`${handled} handled`);
  if (replies > 0) parts.push(`${replies} ${replies === 1 ? 'reply' : 'replies'}`);
  if (handled > 0) parts.push(duration(minutesToday(stack, account)));
  return parts.join(' · ');
}

/** What shows when a stack is empty: the ring completes, a check draws, and the way on. */
export function FinishCard({ stack, account, kicker, celebrate, dayClear, next }: Props) {
  useProgressLog();
  const line = stats(stack, account);
  const [first, ...rest] = next.filter((r) => r.label !== 'Goals');
  const goals = next.find((r) => r.label === 'Goals');
  const more = [...rest, ...(goals ? [goals] : [])];
  return (
    <article className="card finish">
      {celebrate && <Confetti />}
      <div className="finish__body">
        <p className="finish__kicker">{kicker}</p>
        <h1 className="finish__title">All clear</h1>
        <div className="finish__ring">
          <Ring value={1} check rest={!celebrate} />
        </div>
        {line && <p className="finish__stats">{line}</p>}
        {stack === 'needs-you' && dayClear && (
          <div className="finish__streak">
            <StreakStrip pop={celebrate} />
          </div>
        )}
      </div>
      <div className="finish__next">
        {first && (
          <button className="btn btn--primary finish__primary" onClick={() => navigate(first.path)}>
            Next: {first.label}
          </button>
        )}
        {more.length > 0 && (
          <ul className="finish__list">
            {more.map((row) => (
              <li key={row.path}>
                <button className="finish__row" onClick={() => navigate(row.path)}>
                  <span className="finish__row-label">{row.label}</span>
                  {row.count !== undefined && <span className="finish__row-count">{row.count}</span>}
                  <ChevronRight size={18} strokeWidth={2} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  );
}
