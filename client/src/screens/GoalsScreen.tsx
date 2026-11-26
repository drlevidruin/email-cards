import { Fragment, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { dueText, isHot } from '../lib/time';
import { buildTodo, dueBits, todoCounts, type TodoRow } from '../lib/todo';
import { navigate } from '../router';
import { useStore } from '../store';
import { useIsDesktop } from '../lib/useIsDesktop';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import './GoalsScreen.css';

type Phase = 'checked' | 'leaving';

/** To-do: what you owe (threads you moved here and promises you made) and what others owe you. Route id stays `goals`. */
export function GoalsScreen() {
  const store = useStore();
  const desktop = useIsDesktop();
  const { data, account } = store;
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const todo = useMemo(() => (data ? buildTodo(data, account) : null), [data, account]);
  const counts = useMemo(() => (data ? todoCounts(data, account) : null), [data, account]);

  const mark = (key: string, p: Phase | null) =>
    setPhase((s) => {
      const next = { ...s };
      if (p) next[key] = p;
      else delete next[key];
      return next;
    });

  // Checking a row is Done for its thread: unstar, resolve its promises, archive. Undo is in the toast.
  const finish = async (row: TodoRow) => {
    const thread = data?.threads.find((t) => t.id === row.threadId);
    try {
      if (thread) await store.done(thread, null);
      else for (const id of row.commitmentIds) await api.resolveCommitment(id);
      if (!thread) await store.refresh();
    } catch {
      store.showToast(NOT_SAVED);
      void store.refresh();
    }
    mark(row.key, null);
  };

  const check = (row: TodoRow) => {
    if (phase[row.key]) return;
    mark(row.key, 'checked');
    window.setTimeout(() => mark(row.key, 'leaving'), 220);
    window.setTimeout(() => void finish(row), 480);
  };

  const nudge = async (row: TodoRow) => {
    try {
      const res = await api.nudgeCommitment(row.commitmentIds[0]);
      if (!res.draft) throw new Error('no draft');
      navigate(`/reply/${row.threadId}?draft=${res.draft.id}&fresh=1`);
    } catch {
      store.showToast(NOT_SAVED);
    }
  };

  const meta = (row: TodoRow, extra: string[]) => {
    const bits: { text: string; hot?: boolean }[] = [{ text: row.person }];
    if (row.due) bits.push({ text: dueText(row.due), hot: isHot(row.due) });
    for (const e of extra) bits.push({ text: e });
    return (
      <div className="t-footnote todo__meta">
        {bits.map((m, i) => (
          <Fragment key={m.text}>
            {i > 0 && ' · '}
            <span className={m.hot ? 'todo__hot' : undefined}>{m.text}</span>
          </Fragment>
        ))}
      </div>
    );
  };

  const open = todo?.open ?? [];
  const bits = counts ? dueBits(counts) : '';
  return (
    <PageShell
      title="To-do"
      canvas
      right={
        desktop && open.length > 0 ? (
          <button className="todo__tackle todo__tackle--title t-callout" onClick={() => navigate('/cards/bookmarked')}>
            Tackle <span className="t-num">{open.length}</span>
          </button>
        ) : undefined
      }
      footer={
        !desktop && open.length > 0 ? (
          <div className="todo__foot">
            <button className="todo__tackle" onClick={() => navigate('/cards/bookmarked')}>
              Tackle <span className="t-num">{open.length}</span>
            </button>
          </div>
        ) : undefined
      }
    >
      <div className="todo">
        {open.length === 0 ? (
          <p className="t-subhead todo__sub">Nothing on your list</p>
        ) : (
          <p className="t-subhead todo__sub t-num">
            {open.length} open{bits ? ` · ${bits}` : ''}
          </p>
        )}
        {open.length > 0 && (
          <section className="todo__col">
            <ul className="todo__group">
              {open.map((row) => (
                <li key={row.key} className={`todo__item${phase[row.key] === 'leaving' ? ' is-leaving' : ''}`}>
                  <div className="todo__row">
                    <button className={`todo__check${phase[row.key] ? ' is-on' : ''}`} aria-label={`Done: ${row.title}`} onClick={() => check(row)}>
                      <span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" pathLength={1} />
                        </svg>
                      </span>
                    </button>
                    <button className="todo__text" onClick={() => navigate(`/read/${row.threadId}?from=goals`)}>
                      <span className="t-callout todo__name">{row.title}</span>
                      {meta(row, row.promised ? ['You promised'] : [])}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
        {todo && todo.waiting.length > 0 && (
          <section className="todo__col">
            <h2 className="list-heading todo__label">Waiting on</h2>
            <ul className="todo__group">
              {todo.waiting.map((row) => (
                <li key={row.key} className="todo__item">
                  <div className="todo__row">
                    <div className="todo__text todo__text--static">
                      <span className="t-callout todo__name">{row.title}</span>
                      {meta(row, row.nudged ? ['Nudged'] : [])}
                    </div>
                    <button className="t-callout todo__nudge" onClick={() => void nudge(row)}>
                      Nudge
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}
