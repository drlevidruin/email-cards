import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Settings, SquarePen } from 'lucide-react';
import { navigate } from '../router';
import { useStore } from '../store';
import { buildChats, oneLine, type Chat } from '../lib/chats';
import { useDrafts } from '../lib/chatDraft';
import { useLoadedCount } from '../lib/useChatThreads';
import { peekThread } from '../lib/threadCache';
import { relativeTime } from '../lib/time';
import { isSampleInbox } from '../lib/sample';
import { useIsDesktop } from '../lib/useIsDesktop';
import { Avatar, AvatarPair } from '../components/Avatar';
import { ChatScreen } from './ChatScreen';
import './ChatsScreen.css';

type Filter = 'all' | 'unread' | 'needs' | 'updates';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'needs', label: 'Needs reply' },
  { id: 'updates', label: 'Updates' },
];

const pass: Record<Filter, (c: Chat) => boolean> = {
  all: () => true,
  unread: (c) => c.unread > 0,
  needs: (c) => c.needsReply,
  updates: (c) => c.isUpdate,
};

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
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const loaded = useLoadedCount(data?.threads ?? []);
  const chats = useMemo(
    () => (data ? buildChats(data, peekThread, Date.now()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, loaded]
  );
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return chats.filter((c) => pass[filter](c) && (!needle || `${c.name} ${c.email} ${c.preview}`.toLowerCase().includes(needle)));
  }, [chats, filter, q]);
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
        <div className="chatlist__filters" role="group" aria-label="Filter">
          {FILTERS.map((f) => (
            <button key={f.id} className={`chatpillbtn${filter === f.id ? ' chatpillbtn--on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        {isSampleInbox() && <p className="chatlist__sample">Sample inbox. Nothing is really sent.</p>}
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
