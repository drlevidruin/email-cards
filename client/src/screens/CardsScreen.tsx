import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Menu as MenuIcon, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { goalCount } from '../lib/goals';
import { buildStack, replyActions, stackCounts, stackLabel, STACKS, type DeckItem, type StackId } from '../lib/stacks';
import { describeWake, type LaterOption } from '../lib/time';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar, type BarVariant, type Dir } from '../components/ActionBar';
import { CoverCard } from '../components/CoverCard';
import { Deck, type DeckHandle } from '../components/Deck';
import { FinishScreen, type NextRow } from '../components/FinishScreen';
import { LaterSheet } from '../components/LaterSheet';
import { Menu } from '../components/Menu';
import { ProgressLine } from '../components/ProgressLine';
import { ShortcutsDialog } from '../components/ShortcutsDialog';
import { TopBar } from '../components/TopBar';
import './CardsScreen.css';

export function CardsScreen({ stack }: { stack: StackId }) {
  const store = useStore();
  const { data, account, status } = store;
  const desktop = useIsDesktop();
  const deck = useRef<DeckHandle>(null);
  const [menu, setMenu] = useState(false);
  const [shortcuts, setShortcuts] = useState(false);
  const [laterFor, setLaterFor] = useState<DeckItem | null>(null);
  const [active, setActive] = useState<Dir | null>(null);

  const { setLastStack } = store;
  useEffect(() => setLastStack(stack), [stack, setLastStack]);

  const session = store.session(stack);
  const base = data
    ? buildStack(stack, data.threads, data.screener, account).filter((i) => !session.dismissed.has(i.id))
    : [];
  if (data && session.coverPending === null) {
    session.coverPending = (stack === 'newsletters' || stack === 'receipts') && base.length >= 3;
  }

  const exitingItem: DeckItem | null = store.exiting
    ? { type: 'thread', id: store.exiting.thread.id, thread: store.exiting.thread }
    : null;
  const items = exitingItem ? [exitingItem, ...base] : base;
  const cleared = session.dismissed.size;
  const total = cleared + base.length;
  const cover = session.coverPending === true && !exitingItem && base.length > 0;
  const finished = status === 'ready' && base.length === 0 && !exitingItem;

  const isSender = stack === 'new-senders';
  const variant: BarVariant = isSender ? 'senders' : stack === 'bookmarked' ? 'bookmarked' : 'default';
  const enabled: Dir[] = isSender ? ['left', 'down', 'right'] : ['left', 'down', 'up', 'right'];
  const flyDirs: Dir[] = isSender ? ['left', 'down', 'right'] : ['left', 'up'];
  const labels: Partial<Record<Dir, string>> = isSender
    ? { right: 'Allow', left: 'Block', down: 'Newsletters' }
    : { right: 'Reply', left: 'Done', up: stack === 'bookmarked' ? 'Unbookmark' : 'Bookmark', down: 'Later' };

  const overlay = menu || shortcuts || !!laterFor;
  const multi = (data?.accounts.length ?? 0) > 1 && account === 'all';

  const onDirection = useCallback(
    (dir: Dir, item: DeckItem) => {
      if (item.type === 'sender') {
        const d = dir === 'left' ? 'muted' : dir === 'down' ? 'feed' : 'approved';
        void store.decide(item.sender, stack, d);
        return;
      }
      const t = item.thread;
      if (dir === 'left') void store.done(t, stack);
      else if (dir === 'up') void store.bookmark(t, stack, stack !== 'bookmarked');
      else if (dir === 'right') navigate(`/reply/${t.id}?from=deck`);
      else setLaterFor(item);
    },
    [store, stack]
  );

  const pickLater = (o: LaterOption) => {
    const item = laterFor;
    setLaterFor(null);
    if (!item || item.type !== 'thread') return;
    deck.current?.flyOut('down', () => void store.later(item.thread, stack, o.at, describeWake(o.at)));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement) {
        if (el.closest('input, textarea, select, [contenteditable="true"]') || el.isContentEditable) return;
        if ((e.key === 'Enter' || e.key === ' ') && el.closest('button, a')) return;
      }
      if (overlay || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.toLowerCase() === 'z') {
        void store.undo();
        return;
      }
      if (cover || finished) return;
      const top = items[0];
      const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down', Enter: 'right' };
      if (map[e.key]) {
        e.preventDefault();
        deck.current?.trigger(map[e.key]);
      } else if (e.key.toLowerCase() === 'm') setMenu(true);
      else if (e.key === '?') setShortcuts(true);
      else if (top?.type === 'thread' && /^[1-3]$/.test(e.key)) {
        const r = replyActions(top.thread)[Number(e.key) - 1];
        if (r) navigate(`/reply/${top.id}?qa=${r.id}&from=deck`);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  let content;
  if (status === 'loading' || !data) {
    content = (
      <div className="deck-skeleton">
        {[60, 90, 75, 40].map((w) => (
          <div key={w} className="deck-skeleton__bar" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  } else if (status === 'error') {
    content = (
      <div className="deck-error">
        <h2>Mail did not load</h2>
        <button className="btn btn--primary" onClick={() => void store.reload()}>
          Try again
        </button>
      </div>
    );
  } else if (finished) {
    const counts = stackCounts(data.threads, data.screener, account);
    const next: NextRow[] = STACKS.filter((s) => s.id !== stack && counts[s.id] > 0).map((s) => ({
      path: `/cards/${s.id}`,
      label: s.label,
      count: counts[s.id],
    }));
    next.push({ path: '/goals', label: 'Goals', count: goalCount(data, account) });
    content = <FinishScreen label={stackLabel(stack)} counts={session.counts} next={next} />;
  } else if (cover) {
    const threads = base.flatMap((i) => (i.type === 'thread' ? [i.thread] : []));
    content = (
      <CoverCard
        kind={stack === 'receipts' ? 'receipts' : 'newsletters'}
        threads={threads}
        onArchiveAll={() => void store.archiveAll(threads, stack)}
        onOneByOne={() => {
          session.coverPending = false;
          store.touch();
        }}
      />
    );
  } else {
    content = (
      <Deck
        ref={deck}
        items={items}
        exitingId={exitingItem?.id}
        enabled={enabled}
        flyDirs={flyDirs}
        labels={labels}
        accent="right"
        desktop={desktop}
        accounts={multi ? data.accounts : undefined}
        onDirection={onDirection}
        onActive={setActive}
        onExitDone={store.clearExiting}
      />
    );
  }

  const showBar = status === 'ready' && !finished && !cover;
  return (
    <div className="cards">
      <div className="cards__col">
        <TopBar
          left={
            <button className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}>
              <MenuIcon size={22} strokeWidth={2} />
            </button>
          }
          right={
            <>
              {desktop && (
                <button className="icon-btn" aria-label="Shortcuts" onClick={() => setShortcuts(true)}>
                  <Keyboard size={22} strokeWidth={2} />
                </button>
              )}
              <button
                className="icon-btn"
                aria-label="Undo"
                style={{ visibility: store.canUndo ? 'visible' : 'hidden' }}
                onClick={() => void store.undo()}
              >
                <Undo2 size={22} strokeWidth={2} />
              </button>
            </>
          }
        >
          <span className="topbar__title">{stackLabel(stack)}</span>
          {status === 'ready' && <span className="topbar__count">{base.length} left</span>}
        </TopBar>
        <ProgressLine cleared={cleared} total={total} />
        <div className="cards__deck">{content}</div>
        {showBar ? (
          <ActionBar
            variant={variant}
            active={active}
            onAction={(d) => deck.current?.trigger(d)}
          />
        ) : (
          <div className="cards__bar-space" />
        )}
      </div>
      {menu && <Menu current={stack} onClose={() => setMenu(false)} />}
      {shortcuts && <ShortcutsDialog onClose={() => setShortcuts(false)} />}
      {laterFor && <LaterSheet onPick={pickLater} onClose={() => setLaterFor(null)} />}
    </div>
  );
}
