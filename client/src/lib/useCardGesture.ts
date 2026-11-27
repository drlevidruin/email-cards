import { useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import { useTransform, type MotionValue } from 'framer-motion';
import type { Dir } from '../components/ActionBar';

export const LOCK_PX = 10;
export const FLICK_PX_PER_S = 700;
const H_COMMIT = 0.3;
const V_COMMIT = 0.18;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

type Axis = 'x' | 'y';

interface Options {
  x: MotionValue<number>;
  y: MotionValue<number>;
  el: RefObject<HTMLElement | null>;
  enabled: Dir[];
  /** True while the card is flying out or held; the card ignores touches. */
  blocked: () => boolean;
  /** The direction being dragged toward, and whether the drag is past the commit point. */
  onActive: (dir: Dir | null, past?: boolean) => void;
  onCommit: (dir: Dir) => void;
  onSpring: () => void;
  /** A press that stayed put; the event says where, so the deck can see what is under the finger. */
  onTap: (e: ReactPointerEvent<HTMLElement>) => void;
}

/** Which way a drag that has locked to an axis is heading. */
function headed(axis: Axis, dx: number, dy: number): Dir {
  return axis === 'x' ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down';
}

/**
 * The card owns every touch. Nothing moves until the pointer has travelled 10px, then it locks to one axis and the
 * card follows on that axis only. A pointer that never travels 10px is a tap.
 */
export function useCardGesture(o: Options) {
  const { x, y, el, enabled, blocked, onActive, onCommit, onSpring, onTap } = o;
  const dims = useRef({ w: 360, h: 600 });
  const st = useRef<{ id: number; sx: number; sy: number; axis: Axis | null; trail: { t: number; x: number; y: number }[] } | null>(null);
  const dragged = useRef(false);

  const toward = (v: number, sign: number, full: number) => clamp01((sign * v) / full);
  const right = useTransform(x, (v) => toward(v, 1, dims.current.w * H_COMMIT));
  const left = useTransform(x, (v) => toward(v, -1, dims.current.w * H_COMMIT));
  const up = useTransform(y, (v) => toward(v, -1, dims.current.h * V_COMMIT));
  const down = useTransform(y, (v) => toward(v, 1, dims.current.h * V_COMMIT));

  const onPointerDown = (e: ReactPointerEvent<HTMLElement>) => {
    if (st.current || blocked() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const box = el.current;
    if (box) dims.current = { w: box.offsetWidth, h: box.offsetHeight };
    dragged.current = false;
    // The card keeps the pointer from the first touch, so a release outside it still ends the gesture
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // A pointer that is already gone cannot be captured.
    }
    st.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, axis: null, trail: [{ t: e.timeStamp, x: e.clientX, y: e.clientY }] };
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLElement>) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    // A mouse that is no longer pressed (released where no event reached us) ends the gesture without a move
    if (e.pointerType === 'mouse' && e.buttons === 0) return finish(e, true);
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.axis) {
      if (Math.hypot(dx, dy) < LOCK_PX) return;
      // Past 10px it locks to the larger axis
      s.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      dragged.current = true;
    }
    s.trail.push({ t: e.timeStamp, x: e.clientX, y: e.clientY });
    if (s.trail.length > 12) s.trail.shift();
    if (s.axis === 'x') x.set(dx);
    else y.set(dy);
    const dir = headed(s.axis, dx, dy);
    const far = s.axis === 'x' ? Math.abs(dx) >= dims.current.w * H_COMMIT : Math.abs(dy) >= dims.current.h * V_COMMIT;
    onActive(enabled.includes(dir) ? dir : null, far);
  };

  const finish = (e: ReactPointerEvent<HTMLElement>, cancelled: boolean) => {
    const s = st.current;
    if (!s || s.id !== e.pointerId) return;
    st.current = null;
    onActive(null);
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.axis) {
      // Only a press that stayed put is a tap
      if (!cancelled && Math.hypot(dx, dy) < LOCK_PX) onTap(e);
      return;
    }
    if (cancelled) return onSpring();
    // Speed over roughly the last 100ms
    const last = s.trail[s.trail.length - 1];
    const from = s.trail.find((p) => last.t - p.t <= 100) ?? s.trail[0];
    const span = Math.max(1, last.t - from.t) / 1000;
    const v = s.axis === 'x' ? (last.x - from.x) / span : (last.y - from.y) / span;
    const off = s.axis === 'x' ? dx : dy;
    const need = s.axis === 'x' ? dims.current.w * H_COMMIT : dims.current.h * V_COMMIT;
    // A flick only counts in the way the card was dragged; a flick back toward the middle springs back.
    const flick = Math.abs(v) > FLICK_PX_PER_S && Math.sign(v) === Math.sign(off) && Math.abs(off) > 24;
    const dir = headed(s.axis, dx, dy);
    if ((Math.abs(off) >= need || flick) && enabled.includes(dir)) onCommit(dir);
    else onSpring();
  };

  /** Drop a gesture in progress: a new top card never inherits a live drag. */
  const reset = () => {
    st.current = null;
    dragged.current = false;
  };

  return {
    reset,
    progress: { right, left, up, down } as Record<Dir, MotionValue<number>>,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: (e: ReactPointerEvent<HTMLElement>) => finish(e, false),
      onPointerCancel: (e: ReactPointerEvent<HTMLElement>) => finish(e, true),
      // A drag that ended on a card must not also click what is under the pointer
      onClickCapture: (e: { stopPropagation: () => void; preventDefault: () => void }) => {
        if (dragged.current) {
          e.stopPropagation();
          e.preventDefault();
          dragged.current = false;
        }
      },
    },
  };
}
