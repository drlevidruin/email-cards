import { ChevronRight } from 'lucide-react';
import { navigate } from '../router';
import type { Session } from '../store';
import './FinishScreen.css';

export interface NextRow {
  path: string;
  label: string;
  count?: number;
}

const WORDS: [keyof Session['counts'], string][] = [
  ['replied', 'replied'],
  ['done', 'done'],
  ['later', 'later'],
  ['bookmarked', 'bookmarked'],
  ['blocked', 'blocked'],
  ['allowed', 'allowed'],
  ['moved', 'moved'],
];

export function FinishScreen({ label, counts, next }: { label: string; counts: Session['counts']; next: NextRow[] }) {
  const summary = WORDS.filter(([k]) => counts[k] > 0)
    .map(([k, w]) => `${counts[k]} ${w}`)
    .join(', ');
  return (
    <div className="finish">
      <div className="finish__mark">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path className="finish__check" d="M20 6 9 17l-5-5" />
        </svg>
      </div>
      <h1 className="finish__title">{label} is clear</h1>
      {summary && <p className="finish__summary">{summary}</p>}
      <h2 className="finish__next">Next</h2>
      <ul className="finish__list">
        {next.map((row) => (
          <li key={row.path}>
            <button className="finish__row" onClick={() => navigate(row.path)}>
              <span className="finish__row-label">{row.label}</span>
              {row.count !== undefined && <span className="finish__row-count">{row.count}</span>}
              <ChevronRight size={18} strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
