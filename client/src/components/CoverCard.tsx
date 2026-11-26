import type { EmailThread } from '../lib/types';
import { counterpart } from '../lib/stacks';
import { formatCurrency } from '../lib/utils';
import './CoverCard.css';

interface Props {
  kind: 'newsletters' | 'receipts';
  threads: EmailThread[];
  onArchiveAll: () => void;
  onOneByOne: () => void;
}

export function CoverCard({ kind, threads, onArchiveAll, onOneByOne }: Props) {
  const total = threads.reduce((sum, t) => sum + (t.receiptInfo?.amount ?? 0), 0);
  const shown = threads.slice(0, 6);
  return (
    <article className="card cover">
      <div className="cover__body">
        <h2 className="cover__title">
          {threads.length} {kind}
        </h2>
        {kind === 'receipts' && <p className="cover__total">{formatCurrency(total, 'USD')}</p>}
        <ul className="cover__list">
          {shown.map((t) => (
            <li key={t.id} className="cover__row">
              <span className="cover__from">{counterpart(t).name}</span>{' '}
              <span className="cover__subject">{t.subject}</span>
            </li>
          ))}
        </ul>
        {threads.length > shown.length && <p className="cover__more">and {threads.length - shown.length} more</p>}
      </div>
      <div className="cover__actions">
        <button className="btn btn--primary" onClick={onArchiveAll}>
          Archive all
        </button>
        <button className="btn btn--secondary" onClick={onOneByOne}>
          One at a time
        </button>
      </div>
    </article>
  );
}
