import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { api } from '../lib/api';
import type { ActionProposal, AgentChatMessage } from '../lib/types';
import { counterpart } from '../lib/stacks';
import { dueText, isHot } from '../lib/time';
import { navigate } from '../router';
import { useStore } from '../store';
import { NOT_SAVED } from '../storeActions';
import { PageShell } from '../components/PageShell';
import '../components/List.css';
import '../components/ReplyComposer.css';
import './AskScreen.css';

const SUGGESTIONS = ['What needs me today?', 'Archive every newsletter', 'Find the Stowe cabin email'];

function message(role: AgentChatMessage['role'], content: string): AgentChatMessage {
  return { id: `${role}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, role, content, timestamp: new Date().toISOString() };
}

export function AskScreen() {
  const store = useStore();
  const { chat, setChat, account } = store;
  const [text, setText] = useState('');
  const [waiting, setWaiting] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [chat.length, waiting]);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || waiting) return;
    const history = chat.map(({ role, content }) => ({ role, content }));
    setChat((c) => [...c, message('user', q)]);
    setText('');
    setWaiting(true);
    try {
      const reply = await api.agentChat({ message: q, history, selectedAccountId: account });
      setChat((c) => [...c, reply]);
    } catch {
      setChat((c) => [...c, message('assistant', 'That did not work. Try again.')]);
    }
    setWaiting(false);
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
            <button className="btn btn--primary btn--small ask__btn" disabled={running !== null} onClick={() => void doIt(p)}>
              Do it
            </button>
            <button className="btn btn--secondary btn--small ask__btn" onClick={() => patchProposal(p.id, null)}>
              Not now
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <PageShell
      title="Ask Claude"
      canvas
      fill
      right={
        chat.length > 0 ? (
          <button className="btn btn--text" onClick={() => setChat([])}>
            New chat
          </button>
        ) : undefined
      }
    >
      <div className="ask">
        <div className="ask__scroll">
          {chat.length === 0 && !waiting ? (
            <ul className="list ask__suggestions">
              {SUGGESTIONS.map((s) => (
                <li key={s}>
                  <button className="list__row ask__suggestion" onClick={() => void send(s)}>
                    <span className="list__title">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ask__thread">
              {chat.map((m) =>
                m.role === 'user' ? (
                  <div key={m.id} className="ask__user">
                    {m.content}
                  </div>
                ) : (
                  <div key={m.id} className="ask__assistant">
                    <p className="ask__text">{m.content}</p>
                    {m.citations && m.citations.length > 0 && (
                      <ul className="list ask__cites">
                        {m.citations.map((c) => {
                          const row = cite(c);
                          return (
                            <li key={c.threadId}>
                              <button className="list__row ask__cite" onClick={() => navigate(`/read/${c.threadId}`)}>
                                <span className="ask__cite-subject">{row.title}</span>
                                <span className="ask__cite-account">
                                  {row.who}
                                  {row.due && (
                                    <>
                                      {' · '}
                                      <span className={row.hot ? 'list__hot' : undefined}>{row.due}</span>
                                    </>
                                  )}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                    {m.proposal && proposal(m.proposal)}
                    {m.createdDraft && (
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
              {waiting && (
                <div className="ask__dots" aria-label="Claude is typing">
                  <span />
                  <span />
                  <span />
                </div>
              )}
              <div ref={end} />
            </div>
          )}
        </div>
        <form
          className="composer__ask ask__form"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about your mail" aria-label="Ask about your mail" />
          {text.trim() && (
            <button type="submit" className="composer__ask-go" aria-label="Send">
              <ArrowUp size={20} strokeWidth={2} />
            </button>
          )}
        </form>
      </div>
    </PageShell>
  );
}
