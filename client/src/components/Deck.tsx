import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import type { DeckItem } from '../lib/stacks';
import type { EmailThread, GmailAccount } from '../lib/types';
import type { Dir } from './ActionBar';
import { EmailCard } from './EmailCard';
import { ScreenerCard } from './ScreenerCard';
import { Stamps } from './Stamps';
import './Deck.css';

export interface DeckHandle {
  trigger: (dir: Dir) => void;
  /** Fly the top card out, then run after(). */
  flyOut: (dir: Dir, after: () => void) => void;
}

interface Props {
  items: DeckItem[];
  /** Id of a card that should leave to the right as soon as it shows (a reply was just sent). */
  exitingId?: string;
  /** The two swipe directions that do something. */
  enabled: Dir[];
  /** Swipes that fly the card out. A swipe left in the other stacks opens the Later sheet and the card stays. */
  flyDirs: Dir[];
  labels: { left: string; right: string };
  desktop: boolean;
  /** Stacks that do not reply from the card (newsletters, receipts). */
  noReplies?: boolean;
  accounts?: GmailAccount[];
  onBookmark?: (thread: EmailThread) => void;
  onDirection: (dir: Dir, item: DeckItem) => void;
  onActive: (dir: Dir | null) => void;
  onExitDone: () => void;
  /** Once, on the very first card ever: it slides a little to the right and back, to show the swipe. */
  nudge?: boolean;
  onNudged?: () => void;
}

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;
const COMMIT_OFFSET = 110;
const COMMIT_VELOCITY = 600;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const Deck = forwardRef<DeckHandle, Props>(function Deck(props, ref) {
  const { items, exitingId, enabled, flyDirs, labels, desktop, noReplies, accounts, onBookmark, onDirection, onActive, onExitDone, nudge, onNudged } = props;
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const busy = useRef(false);
  const moved = useRef(0);
  const topId = items[0]?.id;

  const progress = useTransform([x, y], ([lx, ly]: number[]) => Math.min(1, Math.hypot(lx, ly) / 180));
  const nextScale = useTransform(progress, [0, 1], [0.96, 1]);
  const nextY = useTransform(progress, [0, 1], [10, 0]);
  // The next card stays a blank white card at rest and fills in as the top card leaves.
  const nextInk = useTransform(progress, [0.5, 1], [0, 1]);
  const sliverScale = useTransform(progress, [0, 1], [0.92, 0.96]);
  const sliverY = useTransform(progress, [0, 1], [20, 10]);
  const rotate = useTransform(x, [-300, 300], reduced ? [0, 0] : [-6, 6]);
  // While the first-card nudge plays, its Done stamp shows at full strength instead of the 40% a 44px slide would give.
  const nudging = useMotionValue(0);
  const stamps = {
    right: useTransform([x, nudging], ([v, n]: number[]) => (n ? clamp01(v / 6) : clamp01(v / COMMIT_OFFSET))),
    left: useTransform(x, (v) => clamp01(-v / COMMIT_OFFSET)),
  };

  // A new top card starts from rest; reset before paint so it never shows at the old offset.
  useLayoutEffect(() => {
    x.set(0);
    y.set(0);
    fade.set(1);
    busy.current = false;
  }, [topId, x, y, fade]);

  const springBack = useCallback(() => {
    void animate(x, 0, SPRING);
    void animate(y, 0, SPRING);
  }, [x, y]);

  const flyOut = useCallback(
    async (dir: Dir, after: () => void) => {
      if (busy.current) return;
      busy.current = true;
      const far = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] }[dir];
      const opts = { duration: reduced ? 0.15 : 0.25, ease: [0.2, 0.8, 0.2, 1] as [number, number, number, number] };
      if (reduced) await animate(fade, 0, opts);
      else {
        await animate(
          far[0] !== 0 ? x : y,
          (far[0] !== 0 ? far[0] : far[1]) * Math.max(window.innerWidth, window.innerHeight),
          opts
        );
      }
      after();
    },
    [x, y, fade, reduced]
  );

  const trigger = useCallback(
    (dir: Dir) => {
      const top = items[0];
      if (!top || busy.current) return;
      if (!enabled.includes(dir)) return;
      if (flyDirs.includes(dir)) void flyOut(dir, () => onDirection(dir, top));
      else {
        springBack();
        onDirection(dir, top);
      }
    },
    [items, enabled, flyDirs, flyOut, springBack, onDirection]
  );

  useImperativeHandle(ref, () => ({ trigger, flyOut: (d, a) => void flyOut(d, a) }), [trigger, flyOut]);

  useLayoutEffect(() => {
    if (exitingId && topId === exitingId) {
      const t = window.setTimeout(() => void flyOut('right', onExitDone), 80);
      return () => window.clearTimeout(t);
    }
  }, [exitingId, topId, flyOut, onExitDone]);

  useEffect(() => {
    if (!nudge || !topId || reduced) return;
    const t = window.setTimeout(async () => {
      if (busy.current || moved.current > 0) return;
      onNudged?.();
      nudging.set(1);
      await animate(x, 44, { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] });
      if (!busy.current && moved.current === 0) await animate(x, 0, { duration: 0.45, ease: [0.2, 0.8, 0.2, 1] });
      nudging.set(0);
    }, 900);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge, topId, reduced, x, nudging]);

  const dirOf = (info: PanInfo): Dir => (info.offset.x > 0 ? 'right' : 'left');

  const onDrag = (_: unknown, info: PanInfo) => {
    moved.current = Math.max(moved.current, Math.abs(info.offset.x));
    const d = dirOf(info);
    onActive(Math.abs(info.offset.x) > 40 && enabled.includes(d) ? d : null);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    onActive(null);
    const d = dirOf(info);
    const off = Math.abs(info.offset.x);
    const vel = Math.abs(info.velocity.x);
    // A fast release only counts when it moves the way the card was dragged. A flick back toward the middle always springs back.
    const fast = vel > COMMIT_VELOCITY;
    const sameWay = Math.sign(info.velocity.x) === Math.sign(info.offset.x);
    const commit = fast ? sameWay && off > 24 : off > COMMIT_OFFSET;
    if (commit && enabled.includes(d)) trigger(d);
    else springBack();
  };

  return (
    <div className="deck">
      {items.slice(0, 3).map((item, role) => {
        const account = accounts && accounts.length > 1 ? accounts.find((a) => a.id === (item.type === 'thread' ? item.thread.accountId : item.sender.accountId)) : undefined;
        const top = role === 0;
        const overlay: ReactNode = top ? <Stamps opacity={stamps} labels={labels} accent="right" /> : null;
        const body =
          role === 2 ? null : item.type === 'thread' ? (
            <EmailCard thread={item.thread} desktop={desktop} account={account} overlay={overlay} noReplies={noReplies} onBookmark={top ? onBookmark : undefined} fromDeck />
          ) : (
            <ScreenerCard sender={item.sender} account={account} desktop={desktop} overlay={overlay} />
          );
        const behind = top ? {} : { inert: '' as unknown as boolean, 'aria-hidden': true };
        return (
          <motion.div
            key={item.id}
            className={`deck__card${top ? ' deck__card--top' : ' deck__card--behind'}${role === 2 ? ' deck__card--sliver' : ''}`}
            style={
              top
                ? { x, y, rotate, opacity: fade, zIndex: 3 }
                : role === 1
                  ? { scale: nextScale, y: nextY, zIndex: 2 }
                  : { scale: sliverScale, y: sliverY, zIndex: 1 }
            }
            drag={top ? 'x' : false}
            dragMomentum={false}
            dragElastic={1}
            onDrag={top ? onDrag : undefined}
            onDragEnd={top ? onDragEnd : undefined}
            onPointerDownCapture={top ? () => (moved.current = 0) : undefined}
            onClickCapture={
              top
                ? (e) => {
                    if (moved.current > 8) {
                      e.stopPropagation();
                      e.preventDefault();
                    }
                  }
                : undefined
            }
            {...behind}
          >
            {role === 1 ? <motion.div className="deck__fill" style={{ opacity: nextInk }}>{body}</motion.div> : body}
          </motion.div>
        );
      })}
    </div>
  );
});
