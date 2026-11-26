import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Menu as MenuIcon, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { finishInfo } from '../lib/finish';
import { handledToday, markClear, markNudged, markStart, nudgeSeen, useProgressLog } from '../lib/progress';
import { buildStack, replyActions, stackCounts, stackLabel, type DeckItem, type StackId } from '../lib/stacks';
import { loadThread } from '../lib/threadCache';
import { describeWake, type LaterOption } from '../lib/time';
import type { EmailThread } from '../lib/types';
import { useCelebrate } from '../lib/useCelebrate';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar, type BarAction, type BarVariant, type Dir } from '../components/ActionBar';
import { CoverCard } from '../components/CoverCard';
import { Deck, type DeckHandle } from '../components/Deck';
import { FinishCard } from '../components/FinishCard';
import { LaterSheet } from '../components/LaterSheet';
import { Menu } from '../components/Menu';
import { SegmentBar } from '../components/SegmentBar';
import { TodayCard } from '../components/TodayCard';
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

  useProgressLog();
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
  // What was handled today (it survives a reload) plus what is left
  const handled = handledToday(stack, account);
  // A card that is still flying out after a sent reply counts as not yet handled; the bar and count tick when it leaves
  const shown = handled - (exitingItem ? 1 : 0);
  const total = handled + base.length;
  const cover = session.coverPending === true && !exitingItem && base.length > 0;
  const finished = status === 'ready' && base.length === 0 && !exitingItem;
  const today = status === 'ready' && stack === 'needs-you' && !session.todayDone && base.length > 0 && !exitingItem;

  const celebrate = useCelebrate(`${stack}|${account}`, status === 'ready' && !today && (base.length > 0 || !!exitingItem), finished);

  const isSender = stack === 'new-senders';
  const noReplies = stack === 'newsletters' || stack === 'receipts';
  const variant: BarVariant = isSender ? 'senders' : noReplies ? 'plain' : 'default';
  const enabled: Dir[] = ['left', 'right'];
  // Done and Allow and Block fly the card out. Later opens its sheet first, so the card stays until a time is picked.
  const flyDirs: Dir[] = isSender ? ['left', 'right'] : ['right'];
  const labels = isSender ? { right: 'Allow', left: 'Block' } : { right: 'Done', left: 'Later' };

  const overlay = menu || shortcuts || !!laterFor;
  const multi = (data?.accounts.length ?? 0) > 1 && account === 'all';

  // Load the first three cards' emails ahead of time, so a card shows its whole email at once.
  const ahead = items
    .slice(0, 3)
    .map((i) => (i.type === 'thread' ? i.id : i.sender.threadIds?.[0] ?? ''))
    .join('|');
  useEffect(() => {
    ahead.split('|').forEach((id) => {
      if (id) loadThread(id).catch(() => undefined);
    });
  }, [ahead]);

  // The day is clear only when Needs you is empty in every account, whichever account is showing
  useEffect(() => {
    if (finished && stack === 'needs-you' && data && stackCounts(data.threads, data.screener, 'all')['needs-you'] === 0) markClear();
  }, [finished, stack, data]);

  // A stack's clock starts the first time it shows a card or its cover (the Start press, on Needs you)
  const clockOn = status === 'ready' && base.length > 0 && !today;
  useEffect(() => {
    if (clockOn) markStart(stack);
  }, [clockOn, stack]);

  const start = useCallback(() => {
    session.todayDone = true;
    markStart(stack);
    store.touch();
  }, [session, stack, store]);

  const onDirection = useCallback(
    (dir: Dir, item: DeckItem) => {
      if (item.type === 'sender') {
        void store.decide(item.sender, stack, dir === 'left' ? 'muted' : 'approved');
        return;
      }
      if (dir === 'right') void store.done(item.thread, stack);
      else setLaterFor(item);
    },
    [store, stack]
  );

  const bookmark = useCallback(
    (t: EmailThread) => deck.current?.flyOut('up', () => void store.bookmark(t, stack, !t.isStarred)),
    [store, stack]
  );

  const reply = (t: EmailThread, qa?: string) => navigate(`/reply/${t.id}?${qa ? `qa=${qa}&` : ''}from=deck`);

  const onBar = (slot: BarAction) => {
    if (slot !== 'middle') return deck.current?.trigger(slot);
    const top = items[0];
    if (!top) return;
    if (top.type === 'sender') deck.current?.flyOut('down', () => void store.decide(top.sender, stack, 'feed'));
    else if (!noReplies) reply(top.thread);
  };

  const pickLater = (o: LaterOption) => {
    const item = laterFor;
    setLaterFor(null);
    if (!item || item.type !== 'thread') return;
    deck.current?.flyOut('left', () => void store.later(item.thread, stack, o.at, describeWake(o.at)));
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
      if (cover || finished || today) return;
      const top = items[0];
      const key = e.key.toLowerCase();
      if (e.key === 'ArrowRight' || (!isSender && key === 'e')) {
        e.preventDefault();
        deck.current?.trigger('right');
      } else if (e.key === 'ArrowLeft' || (!isSender && key === 'l')) {
        e.preventDefault();
        deck.current?.trigger('left');
      } else if (top?.type === 'thread' && !noReplies && (key === 'r' || e.key === 'Enter')) {
        e.preventDefault();
        reply(top.thread);
      } else if (top?.type === 'thread' && key === 'b') bookmark(top.thread);
      else if (key === 'm') setMenu(true);
      else if (e.key === '?') setShortcuts(true);
      else if (top?.type === 'thread' && !noReplies && /^[1-3]$/.test(e.key)) {
        const r = replyActions(top.thread)[Number(e.key) - 1];
        if (r) reply(top.thread, r.id);
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
    const info = finishInfo(data, stack, account);
    content = (
      <FinishCard
        stack={stack}
        account={account}
        kicker={info.kicker}
        celebrate={celebrate}
        dayClear={info.needsYouClear}
        next={info.next}
      />
    );
  } else if (today) {
    content = <TodayCard left={base.length} account={account} keys={!overlay} onStart={start} />;
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
        desktop={desktop}
        noReplies={noReplies}
        onBookmark={bookmark}
        accounts={multi ? data.accounts : undefined}
        onDirection={onDirection}
        onActive={setActive}
        onExitDone={store.clearExiting}
        nudge={!nudgeSeen() && !overlay}
        onNudged={markNudged}
      />
    );
  }

  const showBar = status === 'ready' && !finished && !cover && !today;
  const showCount = status === 'ready' && !finished && !cover && !today && total > 0;
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
          {showCount && (
            <span className="topbar__count">
              {Math.min(shown + 1, total)} of {total}
            </span>
          )}
        </TopBar>
        <SegmentBar handled={shown} total={total} />
        <div className="cards__deck">{content}</div>
        {showBar ? (
          <ActionBar
            variant={variant}
            active={active}
            onAction={onBar}
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
