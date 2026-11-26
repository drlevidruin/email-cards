import { Fragment, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../lib/api';
import { buildGoals, type GoalRow } from '../lib/goals';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import './GoalsScreen.css';

type Phase = 'checked' | 'fading';

export function GoalsScreen() {
  const store = useStore();
  const { data, account } = store;
  const [phase, setPhase] = useState<Record<string, Phase>>({});
  const goals = useMemo(() => (data ? buildGoals(data, account) : null), [data, account]);

  const mark = (key: string, p: Phase | null) =>
    setPhase((s) => {
      const next = { ...s };
      if (p) next[key] = p;
      else delete next[key];
      return next;
    });

  const finish = async (row: GoalRow) => {
    const thread = data?.threads.find((t) => t.id === row.threadId);
    try {
      if (row.kind === 'bookmark') {
        if (thread) await store.done(thread, null);
      } else if (row.kind === 'commitment') {
        await api.resolveCommitment(row.id);
        store.patchData((d) => ({ ...d, commitments: d.commitments.map((c) => (c.id === row.id ? { ...c, status: 'resolved' } : c)) }));
        store.showToast('Marked done');
      } else {
        await api.updateTask(row.id, { completed: true });
        store.patchData((d) => ({ ...d, tasks: d.tasks.map((k) => (k.id === row.id ? { ...k, completed: true } : k)) }));
        store.offerUndo('Marked done', async () => {
          await api.updateTask(row.id, { completed: false });
        });
      }
    } catch {
      store.showToast(NOT_SAVED);
      void store.refresh();
    }
    mark(row.key, null);
  };

  const check = (row: GoalRow) => {
    if (phase[row.key]) return;
    mark(row.key, 'checked');
    window.setTimeout(() => mark(row.key, 'fading'), 300);
    window.setTimeout(() => void finish(row), 500);
  };

  const nudge = async (row: GoalRow) => {
    try {
      const res = await api.nudgeCommitment(row.id);
      if (!res.draft) throw new Error('no draft');
      navigate(`/reply/${row.threadId}?draft=${res.draft.id}&fresh=1`);
    } catch {
      store.showToast(NOT_SAVED);
    }
  };

  const group = (title: string, rows: GoalRow[], withNudge = false) => (
    <section className="goals__col">
      <h2 className="list-heading">{title}</h2>
      {rows.length === 0 ? (
        <div className="list-empty">Nothing open</div>
      ) : (
        <ul className="list">
          {rows.map((row) => (
            <li key={row.key} className={`list__row goal${phase[row.key] === 'fading' ? ' is-fading' : ''}`}>
              <button
                className={`goal__check${phase[row.key] ? ' is-on' : ''}`}
                aria-label={`Mark done: ${row.title}`}
                onClick={() => check(row)}
              >
                <span>{phase[row.key] && <Check size={16} strokeWidth={2.5} />}</span>
              </button>
              <button className="list__text goal__text" onClick={() => navigate(`/read/${row.threadId}`)}>
                <div className="list__title">{row.title}</div>
                {row.meta.length > 0 && (
                  <div className="list__meta">
                    {row.meta.map((m, i) => (
                      <Fragment key={m.text}>
                        {i > 0 && ' · '}
                        <span className={m.hot ? 'list__hot' : undefined}>{m.text}</span>
                      </Fragment>
                    ))}
                  </div>
                )}
              </button>
              {withNudge && (
                <button className="btn btn--secondary btn--small" onClick={() => void nudge(row)}>
                  Nudge
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );

  return (
    <PageShell title="Goals" canvas>
      {goals && (
        <div className="goals">
          {group('Bookmarked', goals.bookmarked)}
          {group('You owe', goals.owe)}
          {group('Waiting on', goals.waiting, true)}
        </div>
      )}
    </PageShell>
  );
}
