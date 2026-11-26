import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { estimateMinutes, handledToday, useProgressLog } from '../lib/progress';
import { counterpart, type DeckItem } from '../lib/stacks';
import { isUrgent, shortDue } from '../lib/time';
import { dueBits, todoCounts } from '../lib/todo';
import { navigate } from '../router';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import { StreakStrip } from './StreakStrip';
import './TodayCard.css';

const dateLine = () => new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

interface Props {
  /** Needs you, in deck order. */
  items: DeckItem[];
  account: string;
  keys: boolean;
  onStart: () => void;
  onOpen: (item: DeckItem) => void;
}

/** The first screen of the day: how many need you, how long it takes, the first three, and the way in. */
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
  const minutes = estimateMinutes('needs-you', left);
  const counts = data ? todoCounts(data, account) : null;
  const drafts = data ? data.drafts.filter((d) => d.status !== 'sent').length : 0;
  const links = [
    counts && counts.open > 0 && { label: 'To-do', value: [counts.open, dueBits(counts)].filter(Boolean).join(' · '), path: '/goals' },
    drafts > 0 && { label: 'Drafts', value: String(drafts), path: '/drafts' },
  ].filter(Boolean) as { label: string; value: string; path: string }[];

  // As many of the first cards as fit, never fewer than 3, never more than 5
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
    const measure = () => {
      const rows = [...ul.children] as HTMLElement[];
      const room = box.clientHeight - (label.current?.offsetHeight ?? 0) - 8;
      let used = 0;
      let n = 0;
      for (const r of rows) {
        if (used + r.offsetHeight > room && n >= 3) break;
        used += r.offsetHeight;
        n += 1;
      }
      setClip((prev) => (prev === used ? prev : used));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [ids, links.length]);

  return (
    <section className="today">
      <div className="today__head">
        <p className="t-footnote today__date">{dateLine()}</p>
        <h1 className="t-display today__count">{handled > 0 ? `${left} left` : `${left} need you`}</h1>
        <p className="t-subhead today__time">About {minutes} min</p>
      </div>
      <div className="today__first" ref={region}>
        <h2 className="t-footnote today__label" ref={label}>First up</h2>
        <ul className="today__group" ref={list} style={clip === null ? undefined : { maxHeight: clip }}>
          {shown.map((item) => {
            if (item.type !== 'thread') return null;
            const t = item.thread;
            const due = t.deadlineLabel;
            return (
              <li key={item.id}>
                <button className="today__row" onClick={() => onOpen(item)}>
                  <Avatar name={counterpart(t).name} card />
                  <span className="today__text">
                    <span className="t-callout today__goal">{t.distilledAsk || t.subject}</span>
                    <span className="t-footnote today__from">
                      {counterpart(t).name}
                      {due && (
                        <>
                          {' · '}
                          <span className={isUrgent(due) ? 'today__hot' : undefined}>{shortDue(due)}</span>
                        </>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
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
      <div className="today__week">
        <StreakStrip />
      </div>
      <div className="today__action">
        <button className="today__start" onClick={onStart}>
          {handled > 0 ? 'Continue' : 'Start'}
        </button>
      </div>
    </section>
  );
}
