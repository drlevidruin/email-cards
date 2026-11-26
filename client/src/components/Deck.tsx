import { forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type MotionValue,
  type PanInfo,
} from 'framer-motion';
import type { DeckItem } from '../lib/stacks';
import type { GmailAccount } from '../lib/types';
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
  enabled: Dir[];
  flyDirs: Dir[];
  labels: Partial<Record<Dir, string>>;
  accent: Dir;
  desktop: boolean;
  accounts?: GmailAccount[];
  onDirection: (dir: Dir, item: DeckItem) => void;
  onActive: (dir: Dir | null) => void;
  onExitDone: () => void;
}

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;
const COMMIT_OFFSET = 110;
const COMMIT_VELOCITY = 600;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

export const Deck = forwardRef<DeckHandle, Props>(function Deck(props, ref) {
  const { items, exitingId, enabled, flyDirs, labels, accent, desktop, accounts, onDirection, onActive, onExitDone } = props;
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
  const rotate = useTransform(x, [-300, 300], reduced ? [0, 0] : [-8, 8]);
  const stamps: Record<Dir, MotionValue<number>> = {
    right: useTransform(x, (v) => clamp01(v / COMMIT_OFFSET)),
    left: useTransform(x, (v) => clamp01(-v / COMMIT_OFFSET)),
    up: useTransform(y, (v) => clamp01(-v / COMMIT_OFFSET)),
    down: useTransform(y, (v) => clamp01(v / COMMIT_OFFSET)),
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

  const dirOf = (info: PanInfo): Dir | null => {
    const { x: ox, y: oy } = info.offset;
    return Math.abs(ox) >= Math.abs(oy) ? (ox > 0 ? 'right' : 'left') : oy > 0 ? 'down' : 'up';
  };

  const onDrag = (_: unknown, info: PanInfo) => {
    moved.current = Math.max(moved.current, Math.hypot(info.offset.x, info.offset.y));
    const d = dirOf(info);
    const far = Math.hypot(info.offset.x, info.offset.y) > 40;
    onActive(d && far && enabled.includes(d) ? d : null);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    onActive(null);
    const d = dirOf(info);
    if (!d) return springBack();
    const horizontal = d === 'left' || d === 'right';
    const off = Math.abs(horizontal ? info.offset.x : info.offset.y);
    const vel = Math.abs(horizontal ? info.velocity.x : info.velocity.y);
    const commit = off > COMMIT_OFFSET || (vel > COMMIT_VELOCITY && off > 24);
    if (commit && enabled.includes(d)) trigger(d);
    else springBack();
  };

  return (
    <div className="deck">
      {items.slice(0, 3).map((item, role) => {
        const account = accounts && accounts.length > 1 ? accounts.find((a) => a.id === (item.type === 'thread' ? item.thread.accountId : item.sender.accountId)) : undefined;
        const top = role === 0;
        const overlay: ReactNode = top ? <Stamps opacity={stamps} labels={labels} accent={accent} /> : null;
        const body =
          role === 2 ? null : item.type === 'thread' ? (
            <EmailCard thread={item.thread} desktop={desktop} account={account} overlay={overlay} fromDeck />
          ) : (
            <ScreenerCard sender={item.sender} desktop={desktop} account={account} overlay={overlay} />
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
            drag={top}
            dragDirectionLock
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
