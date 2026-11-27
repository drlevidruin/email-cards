import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search, Settings, SquarePen } from 'lucide-react';
import { navigate } from '../router';
import { useStore } from '../store';
import { buildChats, oneLine, type Chat } from '../lib/chats';
import { useDrafts } from '../lib/chatDraft';
import { useLoadedCount } from '../lib/useChatThreads';
import { peekThread } from '../lib/threadCache';
import { relativeTime } from '../lib/time';
import { demoNote } from '../lib/sample';
import { CATEGORY_LABEL, CATEGORY_ORDER, type Category } from '../lib/categories';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Avatar, AvatarPair } from '../components/Avatar';
import { ChatScreen } from './ChatScreen';
import './ChatsScreen.css';

type Tab = 'all' | 'needs' | Category;

const matches = (tab: Tab, c: Chat) => (tab === 'all' ? true : tab === 'needs' ? c.needsReply : c.category === tab);

/** Receipts in the chats of the Bills tab: how many and the total, when they share one currency. */
function receiptLine(chats: Chat[]): string | null {
  const receipts = chats.flatMap((c) => c.threads.filter((t) => t.receiptInfo));
  if (receipts.length === 0) return null;
  const currencies = new Set(receipts.map((t) => t.receiptInfo!.currency));
  if (currencies.size !== 1) return null;
  let total: string;
  try {
    total = new Intl.NumberFormat('en-US', { style: 'currency', currency: [...currencies][0] }).format(receipts.reduce((a, t) => a + t.receiptInfo!.amount, 0));
  } catch {
    return null;
  }
  return `${receipts.length} ${receipts.length === 1 ? 'receipt' : 'receipts'} \u00B7 ${total}`;
}

function Row({ chat, open, draft }: { chat: Chat; open: boolean; draft: string }) {
  const unread = chat.unread > 0;
  const showDraft = !!draft.trim() && !open;
  return (
    <li>
      <button className={`chatrow${open ? ' chatrow--open' : ''}`} onClick={() => navigate(`/chat/${encodeURIComponent(chat.key)}`)}>
        {chat.isGroup ? <AvatarPair people={chat.people} /> : <Avatar name={chat.name} email={chat.email} tone="hue" />}
        <span className="chatrow__main">
          <span className="chatrow__top">
            <span className="chatrow__name">{chat.name}</span>
            {chat.isNew && <span className="chatrow__new">New</span>}
            <span className={`chatrow__time${unread ? ' chatrow__time--unread' : ''}`}>{relativeTime(chat.lastAt)}</span>
          </span>
          <span className="chatrow__bottom">
            <span className="chatrow__preview">
              {showDraft ? (
                <>
                  <span className="chatrow__draft">Draft: </span>
                  {oneLine(draft)}
                </>
              ) : (
                <>
                  {chat.lastMine && <Check className="chatrow__check" size={16} strokeWidth={2} aria-label="Sent" />}
                  {chat.lastMine ? `You: ${chat.preview}` : chat.preview}
                </>
              )}
            </span>
            {unread && (
              <span className="chatrow__badge" aria-label={`${chat.unread} unread`}>
                {chat.unread}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

/** The app's home: a list of chats, one per person, and on a laptop the open chat beside it. */
export function ChatsScreen({ activeKey }: { activeKey?: string }) {
  const { data, status } = useStore();
  const desktop = useIsDesktop();
  const drafts = useDrafts();
  const [chosen, setChosen] = useState<Tab>('all');
  const pills = useRef(new Map<Tab, HTMLButtonElement>());
  const [q, setQ] = useState('');
  const loaded = useLoadedCount(data?.threads ?? []);
  const chats = useMemo(
    () => (data ? buildChats(data, peekThread, Date.now()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, loaded]
  );
  const tabs = useMemo(() => {
    const out: { id: Tab; label: string; unread: number }[] = [{ id: 'all', label: 'All', unread: 0 }];
    const add = (id: Tab, label: string) => {
      const inTab = chats.filter((c) => matches(id, c));
      if (inTab.length > 0) out.push({ id, label, unread: inTab.filter((c) => c.unread > 0).length });
    };
    add('needs', 'Needs reply');
    for (const id of CATEGORY_ORDER) add(id, CATEGORY_LABEL[id]);
    return out;
  }, [chats]);
  // A tab whose last chat has left goes back to All
  const tab: Tab = tabs.some((t) => t.id === chosen) ? chosen : 'all';
  const inTab = useMemo(() => chats.filter((c) => matches(tab, c)), [chats, tab]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inTab.filter((c) => !needle || `${c.name} ${c.email} ${c.preview}`.toLowerCase().includes(needle));
  }, [inTab, q]);
  const sum = useMemo(() => (tab === 'bills' ? receiptLine(inTab) : null), [tab, inTab]);
  useEffect(() => {
    pills.current.get(tab)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [tab]);
  const note = demoNote();
  const active = activeKey ? chats.find((c) => c.key === activeKey) : undefined;
  // A chat that is not there (a wrong address, or a sender just blocked) returns to the list
  useEffect(() => {
    if (activeKey && status === 'ready' && !active) navigate('/chats', { replace: true });
  }, [activeKey, status, active]);

  return (
    <div className={`chatapp chatapp--${activeKey ? 'open' : 'list'}`}>
      <section className="chatlist" aria-label="Chats">
        <header className="chatlist__head">
          <h1 className="chatlist__title">Chats</h1>
          <button className="chatapp__icon" aria-label="New message" onClick={() => navigate('/new')}>
            <SquarePen size={22} strokeWidth={1.75} />
          </button>
          <button className="chatapp__icon" aria-label="Settings" onClick={() => navigate('/settings')}>
            <Settings size={22} strokeWidth={1.75} />
          </button>
        </header>
        <label className="chatlist__search">
          <Search size={18} strokeWidth={1.75} aria-hidden="true" />
          <input type="search" placeholder="Search" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="chatlist__filters" role="group" aria-label="Categories">
          {tabs.map((t) => (
            <button
              key={t.id}
              ref={(el) => {
                if (el) pills.current.set(t.id, el);
                else pills.current.delete(t.id);
              }}
              className={`chatpillbtn${tab === t.id ? ' chatpillbtn--on' : ''}`}
              aria-pressed={tab === t.id}
              aria-label={t.unread > 0 ? `${t.label}, ${t.unread} unread` : t.label}
              onClick={() => setChosen(t.id)}
            >
              {t.label}
              {t.unread > 0 && <span className="chatpillbtn__n" aria-hidden="true">{t.unread}</span>}
            </button>
          ))}
        </div>
        {sum && <p className="chatlist__sum">{sum}</p>}
        {note && <p className="chatlist__sample">{note}</p>}
        <div className="chatlist__scroll">
          {status === 'ready' && rows.length === 0 && <p className="chatlist__empty">No chats here</p>}
          <ul>
            {rows.map((c) => (
              <Row key={c.key} chat={c} open={desktop && c.key === activeKey} draft={drafts[c.key]?.text ?? ''} />
            ))}
          </ul>
        </div>
      </section>
      <section className="chatpane" aria-label="Chat">
        {active ? <ChatScreen key={active.key} chat={active} desktop={desktop} /> : <p className="chatpane__empty">{activeKey && status !== 'ready' ? '' : 'Pick a chat'}</p>}
      </section>
    </div>
  );
}
