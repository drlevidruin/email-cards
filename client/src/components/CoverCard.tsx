import { useLayoutEffect, useRef, useState } from 'react';
import type { EmailThread } from '../lib/types';
import { cleanSubject, counterpart } from '../lib/stacks';
import { estimateMinutes } from '../lib/progress';
import { formatCurrency } from '../lib/utils';
import { downloadText, receiptsCsv } from '../lib/csv';
import './CoverCard.css';

interface Props {
  kind: 'newsletters' | 'receipts';
  threads: EmailThread[];
  onArchiveAll: () => void;
  onOneByOne: () => void;
}

interface Row {
  key: string;
  name: string;
  /** The count of a sender's issues, or the amount of a receipt. */
  right: string;
  sub: string;
}

const monthOf = (t: EmailThread) => {
  const d = new Date(t.lastMessageAt);
  return `${d.getFullYear()}-${d.getMonth()}`;
};

function newsletterRows(threads: EmailThread[]): Row[] {
  // Threads arrive newest first, so a sender's first thread is their newest
  const bySender = new Map<string, { name: string; count: number; newest: string }>();
  for (const t of threads) {
    const who = counterpart(t);
    const key = who.email.toLowerCase() || who.name;
    const g = bySender.get(key);
    if (g) g.count += 1;
    else bySender.set(key, { name: who.name, count: 1, newest: cleanSubject(t.subject) });
  }
  return [...bySender.entries()].map(([key, g]) => ({ key, name: g.name, right: g.count > 1 ? String(g.count) : '', sub: g.newest }));
}

function receiptRows(threads: EmailThread[]): Row[] {
  return threads.map((t) => ({
    key: t.id,
    name: t.receiptInfo?.vendor || counterpart(t).name,
    right: t.receiptInfo ? formatCurrency(t.receiptInfo.amount, t.receiptInfo.currency) : '',
    sub: new Date(t.lastMessageAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}

export function CoverCard({ kind, threads, onArchiveAll, onOneByOne }: Props) {
  const receipts = kind === 'receipts';
  const all = receipts ? receiptRows(threads) : newsletterRows(threads);
  // As many rows as fit, then `and N more`
  const body = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<{ n: number; px: number } | null>(null);
  const rendered = all.slice(0, 14);
  useLayoutEffect(() => {
    const box = body.current;
    const ul = list.current;
    if (!box || !ul) return;
    const measure = () => {
      const rows = [...ul.children] as HTMLElement[];
      const top = ul.getBoundingClientRect().top - box.getBoundingClientRect().top;
      const pack = (room: number) => {
        let used = 0;
        let n = 0;
        for (const r of rows) {
          if (used + r.offsetHeight > room) break;
          used += r.offsetHeight;
          n += 1;
        }
        return { n, px: used };
      };
      const free = box.clientHeight - top;
      let out = pack(free);
      // Leave room for the `and N more` line
      if (out.n < all.length) out = pack(free - 28);
      setFit((prev) => (prev && prev.n === out.n && prev.px === out.px ? prev : out));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [all.length]);
  const shownCount = fit?.n ?? rendered.length;
  const total = threads.reduce((sum, t) => sum + (t.receiptInfo?.amount ?? 0), 0);
  const months = new Set(threads.map(monthOf));
  const now = new Date();
  const sameMonth = months.size === 1;
  const thisMonth = sameMonth && months.has(`${now.getFullYear()}-${now.getMonth()}`);
  const when = sameMonth ? (thisMonth ? ' this month' : ` in ${new Date(threads[0].lastMessageAt).toLocaleDateString('en-US', { month: 'long' })}`) : '';
  return (
    <article className="card cover">
      <div className="cover__body" ref={body}>
        {receipts ? (
          <>
            <h2 className="t-display t-num cover__hero">{formatCurrency(total, 'USD')}</h2>
            <p className="t-subhead cover__sub">
              {threads.length} receipts{when}
            </p>
          </>
        ) : (
          <>
            <h2 className="t-title cover__hero">{threads.length} newsletters</h2>
            <p className="t-subhead cover__sub">About {estimateMinutes(kind, threads.length)} min</p>
          </>
        )}
        <ul className="cover__list" ref={list} style={fit ? { maxHeight: fit.px } : undefined}>
          {rendered.map((r) => (
            <li key={r.key} className="cover__row">
              <span className="cover__main">
                <span className="t-callout cover__name">{r.name}</span>
                <span className="t-footnote cover__note">{r.sub}</span>
              </span>
              <span className={`t-callout t-num cover__right${receipts ? ' cover__right--ink' : ''}`}>{r.right}</span>
            </li>
          ))}
        </ul>
        {fit && all.length > shownCount && <p className="t-footnote cover__more">and {all.length - shownCount} more</p>}
      </div>
      <div className="cover__actions">
        <button className="btn btn--primary cover__btn" onClick={onArchiveAll}>
          Archive all {threads.length}
        </button>
        <div className="cover__pair">
          <button className="btn btn--secondary cover__btn" onClick={onOneByOne}>
            One at a time
          </button>
          {receipts && (
            <button
              className="btn btn--secondary cover__btn"
              onClick={() => {
                const { name, text } = receiptsCsv(threads);
                downloadText(name, text);
              }}
            >
              Export CSV
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
