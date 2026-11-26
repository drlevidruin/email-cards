import { useCallback, useEffect, useRef, useState } from 'react';
import { Menu as MenuIcon, Search } from 'lucide-react';
import { useStore } from '../store';
import { navigate } from '../router';
import { finishInfo } from '../lib/finish';
import { handledToday, markClear, markNudged, markStart, nudgeSeen, useProgressLog } from '../lib/progress';
import { applySkips, buildStack, stackCounts, stackLabel, type DeckItem, type StackId } from '../lib/stacks';
import { loadThread } from '../lib/threadCache';
import { describeWake, type LaterOption } from '../lib/time';
import { useCelebrate } from '../lib/useCelebrate';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar, type BarAction, type BarVariant, type Dir } from '../components/ActionBar';
import type { BadgeLabels } from '../components/SwipeBadge';
import { useDeckKeys } from '../components/useDeckKeys';
import { CoverCard } from '../components/CoverCard';
import { Deck, type DeckHandle } from '../components/Deck';
import { FinishCard } from '../components/FinishCard';
import { LaterSheet } from '../components/LaterSheet';
import { Menu } from '../components/Menu';
import { SegmentBar } from '../components/SegmentBar';
import { TodayCard } from '../components/TodayCard';
import { TopBar } from '../components/TopBar';
import './CardsScreen.css';

/** `covered` means the reader is open over the deck: the deck stays put but takes no keys and shows no bar. */
export function CardsScreen({ stack, covered }: { stack: StackId; covered?: boolean }) {
  const store = useStore();
  const { data, account, status } = store;
  const desktop = useIsDesktop();
  const deck = useRef<DeckHandle>(null);
  const [menu, setMenu] = useState(false);
  const [laterFor, setLaterFor] = useState<DeckItem | null>(null);
  const [active, setActive] = useState<Dir | null>(null);
  const [past, setPast] = useState(false);
  const onActive = useCallback((dir: Dir | null, p?: boolean) => {
    setActive(dir);
    setPast(!!p);
  }, []);

  const { setLastStack } = store;
  useEffect(() => setLastStack(stack), [stack, setLastStack]);

  useProgressLog();
  const session = store.session(stack);
  const base = data
    ? applySkips(buildStack(stack, data, account).filter((i) => !session.dismissed.has(i.id)), session.skipped)
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
  const onTodo = stack === 'bookmarked';
  const variant: BarVariant = isSender ? 'senders' : noReplies ? 'plain' : onTodo ? 'todo' : 'default';
  // On the To-do deck the card is already on To-do, so up does nothing
  const enabled: Dir[] = onTodo ? ['left', 'right', 'down'] : ['left', 'right', 'up', 'down'];
  // Done, To-do, Skip and the sender moves fly the card out. Later opens its sheet first and the card waits.
  const flyDirs: Dir[] = isSender ? enabled : ['right', 'up', 'down'];
  const labels: BadgeLabels = isSender
    ? { right: 'Allow', left: 'Block', up: 'Newsletters', down: 'Skip' }
    : onTodo
      ? { right: 'Done', left: 'Later', down: 'Skip' }
      : { right: 'Done', left: 'Later', up: 'To-do', down: 'Skip' };

  const overlay = menu || !!laterFor || !!covered;
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
    if (finished && stack === 'needs-you' && data && stackCounts(data, 'all')['needs-you'] === 0) markClear();
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

  const skip = useCallback(
    (id: string) => {
      session.skipped = [...session.skipped.filter((s) => s !== id), id];
      store.touch();
      // Skip has its own Undo, so Z after a Skip brings the skipped card back, not the move before it
      store.offerUndo('Skipped', async () => {
        session.skipped = session.skipped.filter((s) => s !== id);
        store.touch();
      });
    },
    [session, store]
  );

  const onDirection = useCallback(
    (dir: Dir, item: DeckItem) => {
      if (dir === 'down') return skip(item.id);
      if (item.type === 'sender') {
        void store.decide(item.sender, stack, dir === 'left' ? 'muted' : dir === 'up' ? 'feed' : 'approved');
        return;
      }
      if (dir === 'right') void store.done(item.thread, stack);
      else if (dir === 'up') void store.bookmark(item.thread, stack, true);
      else setLaterFor(item);
    },
    [store, stack, skip]
  );

  const open = useCallback(
    (item: DeckItem) => {
      if (item.type === 'thread') navigate(`/read/${item.id}?from=${stack}`);
      else if (item.sender.threadIds?.[0]) navigate(`/read/${item.sender.threadIds[0]}?from=${stack}&sender=${encodeURIComponent(item.sender.email)}`);
    },
    [stack]
  );

  const reply = () => {
    const top = items[0];
    if (top?.type === 'thread' && !noReplies) navigate(`/reply/${top.id}?from=deck`);
  };

  const onBar = (action: BarAction) => {
    const dirs: Partial<Record<BarAction, Dir>> = { later: 'left', todo: 'up', done: 'right', block: 'left', newsletters: 'up', allow: 'right' };
    const dir = dirs[action];
    if (dir) deck.current?.trigger(dir);
    else reply();
  };

  const pickLater = (o: LaterOption) => {
    const item = laterFor;
    setLaterFor(null);
    if (!item || item.type !== 'thread') return;
    deck.current?.flyOut('left', () => void store.later(item.thread, stack, o.at, describeWake(o.at)));
  };

  const closeLater = () => {
    setLaterFor(null);
    deck.current?.release();
  };

  useDeckKeys({
    off: overlay,
    cards: !cover && !finished && !today,
    onDir: (dir) => deck.current?.trigger(dir),
    onOpen: () => items[0] && open(items[0]),
    onReply: reply,
    onUndo: () => void store.undo(),
    onMenu: desktop ? undefined : () => setMenu(true),
    senders: isSender,
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
    content = <TodayCard items={base} account={account} keys={!overlay} onStart={start} onOpen={open} />;
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
        accounts={multi ? data.accounts : undefined}
        onDirection={onDirection}
        onOpen={open}
        onActive={onActive}
        onExitDone={store.clearExiting}
        goalFirst={onTodo}
        nudge={!nudgeSeen() && !overlay}
        onNudged={markNudged}
      />
    );
  }

  const showBar = status === 'ready' && !finished && !cover && !today && !covered;
  const showCount = status === 'ready' && !finished && !cover && !today && total > 0;
  const live = status === 'ready' && !finished && !cover && !today;
  return (
    <div className={`cards${live ? ' cards--live' : ''}`}>
      <div className="cards__col">
        <TopBar
          left={
            desktop ? undefined : (
              <button className="icon-btn" aria-label="Menu" onClick={() => setMenu(true)}>
                <MenuIcon size={22} strokeWidth={1.75} />
              </button>
            )
          }
          right={
            desktop ? undefined : (
              <button className="icon-btn" aria-label="Search" onClick={() => navigate('/ask')}>
                <Search size={22} strokeWidth={1.75} />
              </button>
            )
          }
        >
          <span className="topbar__title t-headline">{stackLabel(stack)}</span>
          {showCount && (
            <span className="topbar__count t-footnote t-num">
              {Math.min(shown + 1, total)} of {total}
            </span>
          )}
        </TopBar>
        <SegmentBar handled={shown} total={total} />
        <div className={`cards__deck${today || finished ? ' cards__deck--today' : ''}`}>{content}</div>
        {showBar ? (
          <ActionBar variant={variant} active={active} past={past} onAction={onBar} />
        ) : (
          !today && !finished && <div className="cards__bar-space" />
        )}
      </div>
      {menu && !desktop && <Menu current={stack} onClose={() => setMenu(false)} />}
      {laterFor && <LaterSheet onPick={pickLater} onClose={closeLater} />}
    </div>
  );
}
