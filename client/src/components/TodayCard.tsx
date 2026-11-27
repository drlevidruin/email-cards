import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { handledToday, useProgressLog } from '../lib/progress';
import { isSampleInbox } from '../lib/sample';
import { counterpart, stackCounts, type DeckItem, type StackId } from '../lib/stacks';
import { dueParts, isUrgent } from '../lib/time';
import { todoCounts } from '../lib/todo';
import { navigate } from '../router';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useStore } from '../store';
import { DueLine } from './Hero';
import './TodayCard.css';

const dateLine = () => {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  return isSampleInbox() ? `Sample inbox · ${date}` : date;
};

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

/** The first screen of the day: how many need you, the deck to start, the next few, the piles sorted for you, and the way to To-do and Drafts. On a laptop the rail has the piles, so they are left off here. */
export function TodayCard({ items, account, keys, onStart, onOpen }: Props) {
  useProgressLog();
  const { data } = useStore();
  const desktop = useIsDesktop();
  // Enter and the right arrow start, the same as the deck
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
  // New senders, Newsletters and Receipts, then To-do and Drafts; a row with nothing in it is left out
  const links = [
    ...PILES.map((p) => ({ label: p.label, value: piles?.[p.id] ?? 0, path: `/cards/${p.id}` })),
    { label: 'To-do', value: counts?.open ?? 0, path: '/goals' },
    { label: 'Drafts', value: drafts, path: '/drafts' },
  ].filter((l) => l.value > 0 && !desktop);

  const first = items[0]?.type === 'thread' ? items[0].thread : null;
  const firstWho = items[0]?.type === 'thread' ? counterpart(items[0].thread).name : items[0]?.type === 'sender' ? items[0].sender.name : '';

  // The next cards, as many whole rows as fit, never more than 4; with no room the section goes
  const next = items.slice(1).filter((i) => i.type === 'thread').slice(0, 4);
  const root = useRef<HTMLElement>(null);
  const region = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [fit, setFit] = useState<{ n: number; px: number } | null>(null);
  const ids = next.map((i) => i.id).join('|');
  useLayoutEffect(() => {
    const page = root.current;
    const box = region.current;
    const ul = list.current;
    if (!page || !box || !ul) return;
    const measure = () => {
      const cs = getComputedStyle(page);
      // Room is what the rest of the page leaves over
      let others = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
      for (const c of [...page.children] as HTMLElement[]) {
        const m = getComputedStyle(c);
        others += (c === box ? 0 : c.offsetHeight) + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
      }
      const room = page.clientHeight - others - (label.current?.offsetHeight ?? 0) - 8;
      let used = 0;
      let n = 0;
      for (const r of [...ul.children] as HTMLElement[]) {
        if (used + r.offsetHeight > room) break;
        used += r.offsetHeight;
        n += 1;
      }
      setFit((prev) => (prev && prev.n === n && prev.px === used ? prev : { n, px: used }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(page);
    return () => ro.disconnect();
  }, [ids, links.length, counts?.dueToday, desktop]);

  const showNext = next.length > 0 && (fit === null || fit.n > 0);
  return (
    <section className="today" ref={root}>
      <div className="today__head">
        <p className="t-footnote today__date">{dateLine()}</p>
        <h1 className="t-display voice today__count">{handled > 0 ? `${left} left` : `${left} ${left === 1 ? 'email needs' : 'emails need'} you`}</h1>
      </div>
      {counts && counts.dueToday > 0 && (
        <button className="today__duetoday" onClick={() => navigate('/goals')}>
          <span className="t-subhead today__duetoday-n">{counts.dueToday} due today</span>
          <span className="t-subhead today__duetoday-rest">on your To-do</span>
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      )}
      <button className="today__stack" onClick={onStart} aria-label={`${handled > 0 ? 'Continue' : 'Start'}, ${left} ${left === 1 ? 'card' : 'cards'}`}>
        <span className="today__deck">
          {first && <DueLine label={first.deadlineLabel} />}
          <span className="t-title-2 voice today__goal">{first ? first.distilledAsk || first.subject : firstWho}</span>
          <span className="today__deckfoot">
            <span className="t-footnote today__from">{firstWho}</span>
            <span className="today__cap">
              <span className="t-callout">{handled > 0 ? 'Continue' : 'Start'}</span>
              <span className="t-callout today__cap-n t-num">{`${left} ${left === 1 ? 'card' : 'cards'}`}</span>
            </span>
          </span>
        </span>
      </button>
      <div className={`today__next${showNext ? '' : ' is-empty'}`} ref={region}>
        <h2 className="t-footnote today__label" ref={label}>Up next</h2>
        <ul className="today__rows" ref={list} style={fit === null ? undefined : { maxHeight: fit.px }}>
          {next.map((item) => {
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
                    <span className="t-callout today__rowgoal">{t.distilledAsk || t.subject}</span>
                    <span className="t-footnote today__from">{counterpart(t).name}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      {links.length > 0 && (
        <ul className="today__links">
          {links.map((l) => (
            <li key={l.path}>
              <button className="today__link" onClick={() => navigate(l.path)}>
                <span className="voice t-num today__link-num">{l.value}</span>
                <span className="t-callout today__link-label">{l.label}</span>
                <ChevronRight size={18} strokeWidth={1.75} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
