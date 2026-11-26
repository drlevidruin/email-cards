import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, type ReactNode } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';
import type { DeckItem } from '../lib/stacks';
import type { GmailAccount } from '../lib/types';
import { useCardGesture } from '../lib/useCardGesture';
import type { Dir } from './ActionBar';
import { EmailCard } from './EmailCard';
import { ScreenerCard } from './ScreenerCard';
import { FORCE, SwipePills, SwipeWash, type BadgeLabels } from './SwipeBadge';
import './Deck.css';

export interface DeckHandle {
  trigger: (dir: Dir) => void;
  /** Fly the top card out, then run after(). */
  flyOut: (dir: Dir, after: () => void) => void;
  /** Bring a card that was held for a sheet back to the middle. */
  release: () => void;
}

interface Props {
  items: DeckItem[];
  /** Id of a card that should leave to the right as soon as it shows (a reply was just sent). */
  exitingId?: string;
  /** Directions that do something. */
  enabled: Dir[];
  /** Directions that fly the card out. The others hold it for a sheet. */
  flyDirs: Dir[];
  labels: BadgeLabels;
  accounts?: GmailAccount[];
  onDirection: (dir: Dir, item: DeckItem) => void;
  onOpen: (item: DeckItem) => void;
  onActive: (dir: Dir | null, past?: boolean) => void;
  onExitDone: () => void;
  /** The To-do deck: cards show their Goal first. */
  goalFirst?: boolean;
  /** First session only: the move this card shows by sliding a little that way and back, with its pill. */
  nudge?: Dir | null;
  onNudged?: (dir: Dir) => void;
}

const SPRING = { type: 'spring', stiffness: 500, damping: 40 } as const;
const EASE = [0.2, 0.8, 0.2, 1] as [number, number, number, number];

export const Deck = forwardRef<DeckHandle, Props>(function Deck(props, ref) {
  const { items, exitingId, enabled, flyDirs, labels, accounts, onDirection, onOpen, onActive, onExitDone, nudge, onNudged, goalFirst } = props;
  const reduced = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const fade = useMotionValue(1);
  const nudging = useMotionValue(0);
  // The direction a button or key is flying the card toward: its badge shows filled at once
  const force = useMotionValue(0);
  const busy = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const top = items[0];
  const topId = top?.id;
  const topRef = useRef(top);
  topRef.current = top;

  const lift = useTransform([x, y], ([lx, ly]: number[]) => Math.min(1, Math.hypot(lx, ly) / 160));
  const nextScale = useTransform(lift, [0, 1], [0.96, 1]);
  const nextY = useTransform(lift, [0, 1], [10, 0]);
  // The card behind stays blank at rest and fills in as the top card leaves.
  const nextInk = useTransform(lift, [0.5, 1], [0, 1]);
  const rotate = useTransform(x, [-300, 300], reduced ? [0, 0] : [-7, 7]);
  const scale = useTransform(y, [-200, 0, 200], reduced ? [1, 1, 1] : [0.97, 1, 0.97]);

  const settle = useCallback(() => {
    x.set(0);
    y.set(0);
    fade.set(1);
    force.set(0);
    busy.current = false;
  }, [x, y, fade, force]);

  // A new top card starts from rest; reset before paint so it never shows at the old offset.


  const springBack = useCallback(() => {
    void animate(x, 0, SPRING);
    void animate(y, 0, SPRING);
  }, [x, y]);

  const flyOut = useCallback(
    async (dir: Dir, after: () => void) => {
      if (busy.current) return;
      busy.current = true;
      onActive(null);
      force.set(FORCE[dir]);
      const sign = dir === 'left' || dir === 'up' ? -1 : 1;
      const opts = { duration: reduced ? 0.15 : 0.25, ease: EASE };
      if (reduced) await animate(fade, 0, opts);
      else await animate(dir === 'left' || dir === 'right' ? x : y, sign * Math.max(window.innerWidth, window.innerHeight), opts);
      // Back to rest, unseen, before the next card renders, so its stamps never start from the old offset
      const id = topRef.current?.id;
      fade.set(0);
      x.set(0);
      y.set(0);
      force.set(0);
      after();
      // The same card is still on top (the only card was skipped, or a save failed): show it again from the middle
      window.setTimeout(() => {
        if (topRef.current?.id !== id) return;
        settle();
        fade.set(0);
        void animate(fade, 1, { duration: 0.2 });
      }, 60);
    },
    [x, y, fade, force, reduced, onActive, settle]
  );

  const trigger = useCallback(
    (dir: Dir) => {
      if (!top || busy.current || !enabled.includes(dir)) return;
      if (!flyDirs.includes(dir)) {
        // Later: the card springs back to the middle, the way a cancelled drag does, and waits under the sheet
        springBack();
        onDirection(dir, top);
        return;
      }
      void flyOut(dir, () => onDirection(dir, top));
    },
    [top, enabled, flyDirs, flyOut, onDirection, springBack]
  );

  useImperativeHandle(ref, () => ({ trigger, flyOut: (d, a) => void flyOut(d, a), release: springBack }), [trigger, flyOut, springBack]);

  useLayoutEffect(() => {
    if (exitingId && topId === exitingId) {
      const t = window.setTimeout(() => void flyOut('right', onExitDone), 80);
      return () => window.clearTimeout(t);
    }
  }, [exitingId, topId, flyOut, onExitDone]);

  // Each of the first four cards nudges once, 1.2s after it settles. Any touch or key cancels it, and a cancelled
  // nudge stays cancelled for that card. Once the card has slid out it always slides back, unless a drag has started.
  const nudgedCard = useRef<string | null>(null);
  const cancelledCard = useRef<string | null>(null);
  const nudgeStop = useRef<(() => void) | null>(null);
  const isDragging = useRef<() => boolean>(() => false);
  useEffect(() => {
    if (!nudge || !topId || reduced || nudgedCard.current === topId || cancelledCard.current === topId) return;
    const cancel = () => {
      cancelledCard.current = topId;
    };
    window.addEventListener('keydown', cancel, true);
    window.addEventListener('pointerdown', cancel, true);
    const t = window.setTimeout(async () => {
      if (busy.current || cancelledCard.current === topId) return;
      nudgedCard.current = topId;
      onNudged?.(nudge);
      const axis = nudge === 'left' || nudge === 'right' ? x : y;
      const sign = nudge === 'left' || nudge === 'up' ? -1 : 1;
      // Resolves true when the slide finishes, false when a touch on the card stops it
      const slide = (to: number) =>
        new Promise<boolean>((done) => {
          const ctl = animate(axis, to, { duration: 0.45, ease: EASE });
          nudgeStop.current = () => {
            ctl.stop();
            done(false);
          };
          void ctl.then(() => done(true));
        });
      nudging.set(FORCE[nudge]);
      const out = await slide(sign * 44);
      if (out && !busy.current && !isDragging.current()) await slide(0);
      nudgeStop.current = null;
      nudging.set(0);
    }, 1200);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', cancel, true);
      window.removeEventListener('pointerdown', cancel, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge, topId, reduced, x, y, nudging]);

  const gesture = useCardGesture({
    x,
    y,
    nudging,
    el: card,
    enabled,
    blocked: () => {
      // A touch on the card ends a nudge in flight; the drag or the tap takes over from where it is
      cancelledCard.current = topRef.current?.id ?? null;
      nudgeStop.current?.();
      nudgeStop.current = null;
      nudging.set(0);
      return busy.current;
    },
    onActive,
    onCommit: trigger,
    onSpring: springBack,
    onTap: () => {
      // A tap that stopped a nudge halfway must not leave the card off center
      if (x.get() || y.get()) springBack();
      if (top) onOpen(top);
    },
  });
  isDragging.current = gesture.isDragging;

  // A new top card starts from rest; reset before paint so it never shows at the old offset, and drop any drag still live.
  const resetGesture = useRef(gesture.reset);
  resetGesture.current = gesture.reset;
  useLayoutEffect(() => {
    settle();
    resetGesture.current();
  }, [topId, settle]);

  const render = (item: DeckItem, isTop: boolean): ReactNode => {
    const accountId = item.type === 'thread' ? item.thread.accountId : item.sender.accountId;
    const account = accounts && accounts.length > 1 ? accounts.find((a) => a.id === accountId) : undefined;
    const overlay = isTop ? <SwipeWash progress={gesture.progress} labels={labels} force={force} nudging={nudging} /> : null;
    return item.type === 'thread' ? (
      <EmailCard thread={item.thread} account={account} overlay={overlay} goalFirst={goalFirst} />
    ) : (
      <ScreenerCard sender={item.sender} account={account} overlay={overlay} />
    );
  };

  const next = items[1];
  return (
    <div className="deck">
      {next && (
        <motion.div key={next.id} className="deck__card deck__card--behind" style={{ scale: nextScale, y: nextY, zIndex: 1 }} aria-hidden="true" {...{ inert: '' as unknown as boolean }}>
          <motion.div className="deck__fill" style={{ opacity: nextInk }}>
            {render(next, false)}
          </motion.div>
        </motion.div>
      )}
      {top && (
        <motion.div
          key={top.id}
          ref={card}
          className="deck__card deck__card--top"
          style={{ x, y, rotate, scale, opacity: fade, zIndex: 3 }}
          {...gesture.handlers}
        >
          {render(top, true)}
        </motion.div>
      )}
      {top && <SwipePills progress={gesture.progress} labels={labels} force={force} />}
    </div>
  );
});
