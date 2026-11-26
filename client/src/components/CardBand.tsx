import type { ReactNode } from 'react';
import type { EmailThread } from '../lib/types';
import { dueText, isHot } from '../lib/time';
import { formatCurrency } from '../lib/utils';
import './CardBand.css';

export function hasBand(thread: EmailThread): boolean {
  return !!thread.distilledAsk || !!thread.receiptInfo;
}

/** The part of the card that never scrolls: the Goal, or the amount on a receipt. */
export function CardBand({ thread, bookmark }: { thread: EmailThread; bookmark: ReactNode }) {
  if (thread.distilledAsk) {
    const hot = isHot(thread.deadlineLabel);
    return (
      <header className="band">
        <div className="band__row">
          <span className="band__label">Goal</span>
          {thread.deadlineLabel && (
            <>
              <span className="band__sep" aria-hidden="true">·</span>
              <span className={`band__due${hot ? ' band__due--hot' : ''}`}>{dueText(thread.deadlineLabel)}</span>
            </>
          )}
          <span className="band__grow" />
          {bookmark}
        </div>
        <p className="band__goal">{thread.distilledAsk}</p>
      </header>
    );
  }
  const ri = thread.receiptInfo;
  if (!ri) return null;
  return (
    <header className="band band--receipt">
      <div className="band__row">
        <span className="band__amount">{formatCurrency(ri.amount, ri.currency)}</span>
        {bookmark}
      </div>
      <p className="band__line">{[ri.vendor, ri.category].filter(Boolean).join(' · ')}</p>
    </header>
  );
}
