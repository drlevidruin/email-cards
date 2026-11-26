import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { handledToday, useProgressLog } from '../lib/progress';
import { counterpart, stackCounts, type DeckItem, type StackId } from '../lib/stacks';
import { dueParts, isUrgent } from '../lib/time';
import { dueBits, todoCounts } from '../lib/todo';
import { navigate } from '../router';
import { useStore } from '../store';
import './TodayCard.css';

const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const PILES: { id: StackId; label: string }[] = [
  { id: 'new-senders', label: 'New senders' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
];

interface Props {
  /** Needs you, in deck order. */
  items: DeckItem[];
  account: string;
  keys: boolean;
  onStart: () => void;
  onOpen: (item: DeckItem) => void;
}

/** The first screen of the day: how many need you, the first few as an agenda, what is sorted for you, and the way in. */
export function TodayCard({ items, account, keys, onStart, onOpen }: Props) {
  useProgressLog();
  const { data } = useStore();
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

  const left = items.length;
  const handled = handledToday('needs-you', account);
  const counts = data ? todoCounts(data, account) : null;
  const piles = data ? stackCounts(data, account) : null;
  const drafts = data ? data.drafts.filter((d) => d.status !== 'sent').length : 0;
  const links = [
    counts && counts.open > 0 && { label: 'To-do', value: [counts.open, dueBits(counts)].filter(Boolean).join(' · '), path: '/goals' },
    drafts > 0 && { label: 'Drafts', value: String(drafts), path: '/drafts' },
  ].filter(Boolean) as { label: string; value: string; path: string }[];

  // As many of the first cards as fit, at least 1, never more than 5
  const region = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [clip, setClip] = useState<number | null>(null);
  const shown = items.filter((i) => i.type === 'thread').slice(0, 5);
  const ids = shown.map((i) => i.id).join('|');
  useLayoutEffect(() => {
    const box = region.current;
    const ul = list.current;
    if (!box || !ul) return;
    const root = box.parentElement as HTMLElement;
    const measure = () => {
      const rows = [...ul.children] as HTMLElement[];
      // Room is what the rest of the page leaves over, so the list ends one section gap above Sorted for you
      const cs = getComputedStyle(root);
      let others = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      for (const c of [...root.children] as HTMLElement[]) {
        if (c === box) {
          others += parseFloat(getComputedStyle(c).marginTop);
        } else {
          const m = getComputedStyle(c);
          others += c.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
        }
      }
      const room = root.clientHeight - others - (label.current?.offsetHeight ?? 0) - 8;
      let used = 0;
      let n = 0;
      for (const r of rows) {
        if (used + r.offsetHeight > room && n >= 1) break;
        used += r.offsetHeight;
        n += 1;
      }
      setClip((prev) => (prev === used ? prev : used));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    return () => ro.disconnect();
  }, [ids, links.length]);

  return (
    <section className="today">
      <div className="today__head">
        <p className="t-footnote today__date">{dateLine()}</p>
        <h1 className="t-display today__count">{handled > 0 ? `${left} left` : `${left} need you`}</h1>
      </div>
      <div className="today__first" ref={region}>
        <h2 className="t-footnote today__label" ref={label}>First up</h2>
        <ul className="today__group" ref={list} style={clip === null ? undefined : { maxHeight: clip }}>
          {shown.map((item) => {
            if (item.type !== 'thread') return null;
            const t = item.thread;
            const due = dueParts(t.deadlineLabel);
            return (
              <li key={item.id}>
                <button className="today__row" onClick={() => onOpen(item)}>
                  <span className="today__due">
                    {due ? (
                      <>
                        <span className={`t-footnote today__day${isUrgent(t.deadlineLabel) ? ' today__day--hot' : ''}`}>{due.day}</span>
                        {due.time && <span className="t-footnote t-num today__time">{due.time}</span>}
                      </>
                    ) : (
                      <span className="t-footnote today__time">Anytime</span>
                    )}
                  </span>
                  <span className="today__text">
                    <span className="t-callout today__goal">{t.distilledAsk || t.subject}</span>
                    <span className="t-footnote today__from">{counterpart(t).name}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {piles && (
        <>
          <h2 className="t-footnote today__label today__label--sorted">Sorted for you</h2>
          <div className="today__piles">
            {PILES.map((p) => {
              const n = piles[p.id];
              return (
                <button key={p.id} className={`today__pile${n === 0 ? ' is-empty' : ''}`} disabled={n === 0} onClick={() => navigate(`/cards/${p.id}`)}>
                  <span className="t-title-2 t-num today__pile-n">{n}</span>
                  <span className="t-footnote today__pile-name">{p.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
      {links.length > 0 && (
        <ul className="today__group today__links">
          {links.map((l) => (
            <li key={l.path}>
              <button className="today__link" onClick={() => navigate(l.path)}>
                <span className="t-callout today__link-label">{l.label}</span>
                <span className="t-subhead t-num today__link-value">{l.value}</span>
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="today__action">
        <button className="today__start" onClick={onStart}>
          <span>{handled > 0 ? 'Continue' : 'Start'}</span>
          <span className="today__start-count t-num">{`${left} ${left === 1 ? 'card' : 'cards'}`}</span>
        </button>
      </div>
    </section>
  );
}
