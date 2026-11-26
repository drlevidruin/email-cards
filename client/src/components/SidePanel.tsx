import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { cleanSubject, counterpart, type DeckItem, type StackId } from '../lib/stacks';
import { isUrgent, shortDue } from '../lib/time';
import { buildTodo } from '../lib/todo';
import { useDeckItems } from '../lib/useDeckItems';
import { navigate } from '../router';
import { useStore } from '../store';
import { Avatar } from './Avatar';
import './SidePanel.css';

const SHOWN = 6;

interface Line {
  key: string;
  who: string;
  title: string;
  due?: string;
}

function lineOf(item: DeckItem): Line {
  if (item.type === 'sender') return { key: item.id, who: item.sender.name, title: item.sender.aiReason };
  const t = item.thread;
  return { key: item.id, who: counterpart(t).name, title: t.distilledAsk || cleanSubject(t.subject), due: t.deadlineLabel || undefined };
}

/** How many rows fit under the label, keeping room for the line or button after them. */
function useFit(aside: RefObject<HTMLElement>, list: RefObject<HTMLUListElement>, total: number, footer: number, key: string) {
  const [fit, setFit] = useState<{ n: number; px: number } | null>(null);
  useLayoutEffect(() => {
    const box = aside.current;
    const ul = list.current;
    if (!box || !ul) return;
    const measure = () => {
      const cs = getComputedStyle(box);
      const label = box.querySelector<HTMLElement>('.side__label');
      const room = box.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - (label ? label.offsetHeight + 8 : 0);
      const rows = [...ul.children] as HTMLElement[];
      const pick = (space: number) => {
        let used = 0;
        let n = 0;
        for (const r of rows) {
          if (used + r.offsetHeight > space) break;
          used += r.offsetHeight;
          n += 1;
        }
        return { n, px: used };
      };
      // Everything fits with no footer line, or as many as fit with one
      const all = pick(room);
      const next = all.n >= total && footer === 0 ? all : pick(room - footer - 8);
      setFit((prev) => (prev && prev.n === next.n && prev.px === next.px ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    return () => ro.disconnect();
  }, [aside, list, total, footer, key]);
  return fit;
}

function Rows({ lines, list, clip }: { lines: Line[]; list: RefObject<HTMLUListElement>; clip: number | null }) {
  return (
    <ul className="side__list" ref={list} style={clip === null ? undefined : { maxHeight: clip }}>
      {lines.map((l) => (
        <li key={l.key} className="side__row">
          <Avatar name={l.who} card />
          <span className="side__text">
            <span className="t-callout side__title">{l.title}</span>
            <span className="t-footnote side__meta">
              {l.who}
              {l.due && (
                <>
                  {' · '}
                  <span className={isUrgent(l.due) ? 'side__hot' : undefined}>{shortDue(l.due)}</span>
                </>
              )}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}

/** The right panel on a wide laptop: what comes next in this stack, or your To-do when the deck shows Today or the finish. */
export function SidePanel({ stack }: { stack: StackId }) {
  const { data, account, session } = useStoreView(stack);
  const { items, todayShowing } = useDeckItems(stack);
  const aside = useRef<HTMLElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const cover = session.coverPending === true;
  const first = cover ? 0 : 1;
  const rest = items.slice(first);
  const todo = useMemo(() => (data ? buildTodo(data, account).open : []), [data, account]);
  const showTodo = todayShowing || rest.length === 0;
  const lines: Line[] = showTodo
    ? todo.slice(0, SHOWN).map((r) => ({ key: r.key, who: r.person, title: r.title, due: r.due }))
    : rest.slice(0, SHOWN).map(lineOf);
  const total = showTodo ? todo.length : rest.length;
  const footer = showTodo ? (todo.length > 0 ? 40 : 0) : total > lines.length ? 26 : 0;
  const fit = useFit(aside, list, lines.length, footer, `${showTodo}|${lines.map((l) => l.key).join(',')}`);
  const shown = fit ? Math.min(fit.n, lines.length) : lines.length;
  const more = total - shown;

  if (showTodo) {
    return (
      <aside className="side" aria-label="To-do" ref={aside}>
        <h2 className="t-footnote side__label">To-do</h2>
        <Rows lines={lines} list={list} clip={fit ? fit.px : null} />
        {todo.length > 0 && (
          <button className="btn btn--text side__all t-callout" onClick={() => navigate('/goals')}>
            See all
          </button>
        )}
      </aside>
    );
  }
  return (
    <aside className="side" aria-label="Up next" ref={aside}>
      <h2 className="t-footnote side__label">Up next</h2>
      <Rows lines={lines} list={list} clip={fit ? fit.px : null} />
      {more > 0 && <p className="t-footnote side__more">and {more} more</p>}
    </aside>
  );
}

function useStoreView(stack: StackId) {
  const store = useStore();
  return { data: store.data, account: store.account, session: store.session(stack) };
}
