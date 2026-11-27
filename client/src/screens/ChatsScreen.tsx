import { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Bell, BellOff, ChevronLeft, Mail, MailOpen, Pin, PinOff, ArchiveRestore, Search, Settings, SquarePen } from 'lucide-react';
import { navigate } from '../router';
import { useStore } from '../store';
import { buildChats, type Chat } from '../lib/chats';
import { api } from '../lib/api';
import { archiveChat, setUnread, toggleMute, togglePin, unarchiveChat, useChatPrefs } from '../lib/chatPrefs';
import { isArchived, sortChats } from '../lib/chatPrefsCore';
import { useDrafts } from '../lib/chatDraft';
import { useLoadedCount } from '../lib/useChatThreads';
import { peekThread } from '../lib/threadCache';
import { demoNote } from '../lib/sample';
import { CATEGORY_LABEL, CATEGORY_ORDER, type Category } from '../lib/categories';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useViewportVars } from '../lib/useViewportVars';
import { Sheet } from '../components/Sheet';
import { ChatRow, type RowAct, type Side } from './ChatRow';
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

/** The app's home: a list of chats, one per person, and on a laptop the open chat beside it. */
export function ChatsScreen({ activeKey, archivedView }: { activeKey?: string; archivedView?: boolean }) {
  useViewportVars();
  const store = useStore();
  const { data, status } = store;
  const desktop = useIsDesktop();
  const drafts = useDrafts();
  const prefs = useChatPrefs();
  const [chosen, setChosen] = useState<Tab>('all');
  const pills = useRef(new Map<Tab, HTMLButtonElement>());
  const [q, setQ] = useState('');
  const loaded = useLoadedCount(data?.threads ?? []);
  const chats = useMemo(
    () => (data ? buildChats(data, peekThread, Date.now()) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, loaded]
  );
  const archivedOf = (c: Chat) => isArchived(prefs, c.key, c.lastAt);
  const live = useMemo(
    () => chats.filter((c) => !isArchived(prefs, c.key, c.lastAt)),
    [chats, prefs]
  );
  const archivedChats = useMemo(
    () => sortChats(chats.filter((c) => isArchived(prefs, c.key, c.lastAt)), prefs),
    [chats, prefs]
  );
  const tabs = useMemo(() => {
    const out: { id: Tab; label: string; unread: number }[] = [{ id: 'all', label: 'All', unread: 0 }];
    const add = (id: Tab, label: string) => {
      const inTab = live.filter((c) => matches(id, c));
      if (inTab.length > 0) out.push({ id, label, unread: inTab.filter((c) => c.unread > 0 && !(c.key in prefs.muted)).length });
    };
    add('needs', 'Needs reply');
    for (const id of CATEGORY_ORDER) add(id, CATEGORY_LABEL[id]);
    return out;
  }, [live, prefs]);
  // A tab whose last chat has left goes back to All
  const tab: Tab = tabs.some((t) => t.id === chosen) ? chosen : 'all';
  const needle = q.trim().toLowerCase();
  const rows = useMemo(() => {
    // Search also finds archived chats
    const pool = (needle ? chats : live).filter((c) => matches(tab, c));
    return sortChats(pool.filter((c) => !needle || `${c.name} ${c.email} ${c.preview}`.toLowerCase().includes(needle)), prefs);
  }, [chats, live, tab, needle, prefs]);
  const sum = useMemo(() => (tab === 'bills' ? receiptLine(live.filter((c) => matches(tab, c))) : null), [tab, live]);
  useEffect(() => {
    pills.current.get(tab)?.scrollIntoView?.({ inline: 'nearest', block: 'nearest' });
  }, [tab]);
  const note = demoNote();
  const active = activeKey ? chats.find((c) => c.key === activeKey) : undefined;
  // A chat that is not there (a wrong address, or a sender just blocked) returns to the list
  useEffect(() => {
    if (activeKey && status === 'ready' && !active) navigate('/chats', { replace: true });
  }, [activeKey, status, active]);
  // Opening a chat clears its hand-set unread mark
  useEffect(() => {
    if (activeKey) setUnread(activeKey, false);
  }, [activeKey]);

  // One row open at a time
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [openSide, setOpenSide] = useState<Side | null>(null);
  const onSide = (key: string, side: Side | null) => {
    setOpenKey(side ? key : null);
    setOpenSide(side);
  };
  useEffect(() => {
    if (!openKey) return;
    const away = (e: PointerEvent) => {
      const li = (e.target as Element | null)?.closest?.('.chatswipe');
      if (li?.getAttribute('data-key') !== openKey) onSide(openKey, null);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [openKey]);
  // Leaving a view closes the row
  useEffect(() => {
    onSide('', null);
  }, [archivedView, tab, needle]);

  const [menu, setMenu] = useState<Chat | null>(null);
  const openMenu = (c: Chat) => {
    onSide(c.key, null);
    setMenu(c);
  };

  const markRead = (c: Chat) => {
    for (const t of c.threads) {
      if (!t.isUnread) continue;
      store.patchThread(t.id, { isUnread: false });
      void api.markReadThread(t.id, false).catch(() => undefined);
    }
    setUnread(c.key, false);
  };
  const act = (what: RowAct, c: Chat) => {
    if (what === 'pin') {
      const was = c.key in prefs.pinned;
      if (!togglePin(c.key)) store.showToast('You can pin up to 3 chats');
      else store.showToast(was ? 'Unpinned' : 'Pinned');
    } else if (what === 'mute') {
      const was = c.key in prefs.muted;
      toggleMute(c.key);
      store.showToast(was ? 'Unmuted' : 'Muted');
    } else if (what === 'read') {
      if (c.unread > 0 || c.key in prefs.unread) {
        markRead(c);
        store.showToast('Marked as read');
      } else {
        setUnread(c.key, true);
        store.showToast('Marked as unread');
      }
    } else if (archivedOf(c)) {
      unarchiveChat(c.key);
      store.showToast('Back in your chats');
    } else {
      archiveChat(c.key);
      store.offerUndo('Archived', async () => unarchiveChat(c.key));
    }
  };

  const rowFor = (c: Chat) => (
    <ChatRow
      key={c.key}
      chat={c}
      active={desktop && c.key === activeKey}
      draft={drafts[c.key]?.text ?? ''}
      pinned={c.key in prefs.pinned}
      muted={c.key in prefs.muted}
      marked={c.key in prefs.unread}
      archived={archivedOf(c)}
      showArchived={!!needle && archivedOf(c)}
      side={openKey === c.key ? openSide : null}
      onSide={onSide}
      onMenu={openMenu}
      onAct={act}
    />
  );

  const menuRows = (c: Chat) => {
    const pinned = c.key in prefs.pinned;
    const muted = c.key in prefs.muted;
    const asRead = c.unread > 0 || c.key in prefs.unread;
    const arch = archivedOf(c);
    const row = (what: RowAct, icon: JSX.Element, label: string) => (
      <button
        key={what}
        className="moresheet__row"
        onClick={() => {
          setMenu(null);
          act(what, c);
        }}
      >
        {icon}
        <span>{label}</span>
      </button>
    );
    const ic = { size: 22, strokeWidth: 1.75, 'aria-hidden': true } as const;
    return [
      row('pin', pinned ? <PinOff {...ic} /> : <Pin {...ic} />, pinned ? 'Unpin chat' : 'Pin chat'),
      row('mute', muted ? <Bell {...ic} /> : <BellOff {...ic} />, muted ? 'Unmute' : 'Mute'),
      row('read', asRead ? <MailOpen {...ic} /> : <Mail {...ic} />, asRead ? 'Mark as read' : 'Mark as unread'),
      row('archive', arch ? <ArchiveRestore {...ic} /> : <Archive {...ic} />, arch ? 'Unarchive chat' : 'Archive chat'),
    ];
  };

  const closeRow = () => onSide('', null);

  return (
    <div className={`chatapp chatapp--${activeKey ? 'open' : 'list'}`}>
      {archivedView ? (
        <section className="chatlist" aria-label="Archived chats">
          <header className="chatlist__head chatlist__head--back">
            <button className="chatapp__icon" aria-label="Back to chats" onClick={() => navigate('/chats')}>
              <ChevronLeft size={26} strokeWidth={1.75} />
            </button>
            <h1 className="chatlist__title">Archived</h1>
          </header>
          <p className="chatlist__quiet">A new email brings a chat back to your chats.</p>
          <div className="chatlist__scroll" onScroll={closeRow}>
            {status === 'ready' && archivedChats.length === 0 && <p className="chatlist__empty chatlist__empty--ink">No archived chats</p>}
            <ul>{archivedChats.map(rowFor)}</ul>
          </div>
        </section>
      ) : (
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
          <div className="chatlist__scroll" onScroll={closeRow}>
            {status === 'ready' && rows.length === 0 && !(tab === 'all' && !needle && archivedChats.length > 0) && <p className="chatlist__empty">No chats here</p>}
            <ul>
              {tab === 'all' && !needle && archivedChats.length > 0 && (
                <li>
                  <button className="chatarch" onClick={() => navigate('/chats/archived')}>
                    <span className="chatarch__icon">
                      <Archive size={22} strokeWidth={1.75} aria-hidden="true" />
                    </span>
                    <span className="chatarch__name">Archived</span>
                    <span className="chatarch__n">{archivedChats.length}</span>
                  </button>
                </li>
              )}
              {rows.map(rowFor)}
            </ul>
          </div>
        </section>
      )}
      <section className="chatpane" aria-label="Chat">
        {active ? <ChatScreen key={active.key} chat={active} desktop={desktop} /> : <p className="chatpane__empty">{activeKey && status !== 'ready' ? '' : 'Pick a chat'}</p>}
      </section>
      {menu && (
        <Sheet title={menu.name} onClose={() => setMenu(null)} className="moresheet">
          {menuRows(menu)}
        </Sheet>
      )}
    </div>
  );
}
