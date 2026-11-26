import { useRef, useState, type ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../lib/api';
import type { ActionProposal, AgentChatMessage } from '../lib/types';
import { counterpart } from '../lib/stacks';
import { dueText, isHot } from '../lib/time';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import './AskScreen.css';

const SUGGESTIONS = ['What needs me today?', 'Archive every newsletter', 'Find the Stowe cabin email'];

function message(role: AgentChatMessage['role'], content: string): AgentChatMessage {
  return { id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role, content, timestamp: new Date().toISOString() };
}

export function AskScreen() {
  const store = useStore();
  const { chat, setChat, account } = store;
  // The field keeps the question you asked; only the latest answer shows
  const [text, setText] = useState(() => [...chat].reverse().find((m) => m.role === 'user')?.content ?? '');
  const [waiting, setWaiting] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const busy = useRef(false);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || waiting) return;
    const history = chat.map(({ role, content }) => ({ role, content }));
    setChat((c) => [...c, message('user', q)]);
    setText(q);
    setWaiting(true);
    try {
      const reply = await api.agentChat({ message: q, history, selectedAccountId: account });
      setChat((c) => [...c, reply]);
    } catch {
      setChat((c) => [...c, message('assistant', 'That did not work. Try again.')]);
    }
    setWaiting(false);
  };

  // Emptying the field starts over
  const change = (value: string) => {
    setText(value);
    if (!value && chat.length > 0 && !waiting) setChat([]);
  };

  const patchProposal = (id: string, patch: Partial<ActionProposal> | null) =>
    setChat((c) => c.map((m) => (m.proposal?.id === id ? { ...m, proposal: patch ? { ...m.proposal!, ...patch } : undefined } : m)));

  const doIt = async (p: ActionProposal) => {
    if (busy.current) return;
    busy.current = true;
    setRunning(p.id);
    try {
      await api.executeProposal(p.id);
      patchProposal(p.id, { status: 'executed' });
      await store.refresh();
      store.offerUndo(p.title, async () => {
        await api.undoProposal(p.id);
        patchProposal(p.id, { status: 'pending' });
      });
    } catch {
      store.showToast(NOT_SAVED);
    }
    busy.current = false;
    setRunning(null);
  };

  const cite = (c: { threadId: string; subject: string; accountLabel: string }) => {
    const t = store.data?.threads.find((x) => x.id === c.threadId);
    if (!t) return { title: c.subject, who: c.accountLabel, due: null as string | null, hot: false };
    return {
      title: t.distilledAsk || t.subject,
      who: counterpart(t).name,
      due: t.deadlineLabel ? dueText(t.deadlineLabel) : null,
      hot: isHot(t.deadlineLabel),
    };
  };

  const proposal = (p: ActionProposal) => {
    const shown = p.targetThreadsPreview.slice(0, 5);
    const more = p.targetThreadIds.length - shown.length;
    return (
      <div className="ask__proposal">
        <h3 className="ask__proposal-title">{p.title}</h3>
        <ul>
          {shown.map((t) => (
            <li key={t.id} className="ask__preview">
              <span className="ask__preview-from">{t.fromName}</span>
              <span className="ask__preview-subject">{t.subject}</span>
            </li>
          ))}
        </ul>
        {more > 0 && <div className="ask__more">and {more} more</div>}
        {p.status === 'executed' ? (
          <div className="ask__done">Done</div>
        ) : (
          <div className="ask__proposal-actions">
            <button className="btn btn--primary ask__btn" disabled={running !== null} onClick={() => void doIt(p)}>
              Do it
            </button>
            <button className="btn btn--secondary ask__btn" onClick={() => patchProposal(p.id, null)}>
              Not now
            </button>
          </div>
        )}
      </div>
    );
  };

  const field = (
    <form
      className="search ask__form"
      onSubmit={(e) => {
        e.preventDefault();
        void send(text);
      }}
    >
      <Search size={18} strokeWidth={1.75} />
      <input value={text} onChange={(e) => change(e.target.value)} placeholder="Search or ask" aria-label="Search or ask" autoFocus enterKeyHint="search" />
      {text && (
        <button type="button" className="search__clear" aria-label="Clear" onClick={() => change('')}>
          <X size={18} strokeWidth={1.75} />
        </button>
      )}
    </form>
  );

  // The latest answer, its rows grouped when the answer has groups
  const answer = [...chat].reverse().find((m) => m.role === 'assistant');
  const rows = answer?.citations ?? [];
  const grouped = rows.some((c) => c.group);
  const row = (c: { threadId: string; subject: string; accountLabel: string }) => {
    const r = cite(c);
    return (
      <li key={c.threadId}>
        <button className="list__row ask__cite" onClick={() => navigate(`/read/${c.threadId}`)}>
          <span className="t-callout ask__cite-subject">{r.title}</span>
          <span className="t-footnote ask__cite-account">
            {r.who}
            {r.due && (
              <>
                {' \u00B7 '}
                <span className={r.hot ? 'list__hot' : undefined}>{r.due}</span>
              </>
            )}
          </span>
        </button>
      </li>
    );
  };
  const section = (label: string | null, items: ReactNode) => (
    <section className="ask__section">
      {label && <h2 className="list-heading ask__label">{label}</h2>}
      <ul className="list list--desk ask__cites">{items}</ul>
    </section>
  );
  const moreRow = answer?.more && (
    <li key="more">
      <button className="list__row ask__cite" onClick={() => navigate(answer.more!.path)}>
        <span className="t-callout ask__cite-subject">and {answer.more.count} more</span>
      </button>
    </li>
  );

  return (
    <PageShell title="Search" canvas fill>
      <div className="ask">
        {field}
        <div className="ask__scroll">
          {!answer && !waiting ? (
            <ul className="list list--desk ask__suggestions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button className="list__row ask__suggestion" onClick={() => void send(s)}>
                    <span className="t-subhead">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : waiting ? (
            <div className="ask__dots" aria-label="Searching">
              <span />
              <span />
              <span />
            </div>
          ) : (
            answer && (
              <div className="ask__answer">
                <p className="t-body ask__text">{answer.content}</p>
                {grouped ? (
                  <>
                    {rows.some((c) => c.group === 'due') &&
                      section('Due today', rows.filter((c) => c.group === 'due').map(row))}
                    {(rows.some((c) => c.group !== 'due') || moreRow) &&
                      section('Needs you', [...rows.filter((c) => c.group !== 'due').map(row), moreRow])}
                  </>
                ) : (
                  (rows.length > 0 || moreRow) && section(null, [...rows.map(row), moreRow])
                )}
                {answer.proposal && proposal(answer.proposal)}
                {answer.createdDraft && (
                  <div className="ask__saved">
                    <span>Draft saved</span>
                    <button className="btn btn--text" onClick={() => navigate('/drafts')}>
                      Open
                    </button>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      </div>
    </PageShell>
  );
}
