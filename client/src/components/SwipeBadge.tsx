import { useRef, useState } from 'react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import type { Dir } from './ActionBar';
import './SwipeBadge.css';

export type BadgeLabels = Partial<Record<Dir, string>>;

/** What the force value holds while a button or key flies the card: 0 for none, else the direction's number. */
export const FORCE: Record<Dir, number> = { right: 1, left: 2, up: 3, down: 4 };

const TONE: Record<string, string> = { Done: 'accent', Allow: 'accent', Block: 'danger', Skip: 'quiet', Later: 'later', 'To-do': 'todo', Newsletters: 'todo', Newsletter: 'todo' };
const ORDER: Dir[] = ['right', 'left', 'up', 'down'];

interface Props {
  /** 0 to 1 toward the commit point, per direction. */
  progress: Record<Dir, MotionValue<number>>;
  labels: BadgeLabels;
  /** The direction a button or key is flying the card toward, or holding it for a sheet. */
  force: MotionValue<number>;
  /** 1 while a held stamp shows; the deck eases it to 0 when a sheet closes without a choice. */
  hold: MotionValue<number>;
}

function Stamp({ dir, label, progress, force, hold }: { dir: Dir; label: string; progress: MotionValue<number>; force: MotionValue<number>; hold: MotionValue<number> }) {
  // 0 to 1 as the card nears the commit point; a button or key press jumps straight to 1
  const level = useTransform([progress, force, hold], ([p, f, h]: number[]) => (f === FORCE[dir] ? h : p));
  const [solid, setSolid] = useState(false);
  useMotionValueEvent(level, 'change', (v) => setSolid(v >= 1));
  return (
    <motion.div className={`stamp stamp--${dir} stamp--${TONE[label] ?? 'ink'}${solid ? ' is-solid' : ''}`} style={{ opacity: level }} aria-hidden="true">
      {label}
    </motion.div>
  );
}

/** The white wash over the card's text. It rides on the card. */
export function SwipeWash({ progress, labels, force }: Omit<Props, 'hold'>) {
  // A direction that does nothing here (up on the To-do deck) shows no wash
  const on = useRef([1, 1, 1, 1]);
  on.current = ORDER.map((d) => (labels[d] ? 1 : 0));
  const wash = useTransform([progress.right, progress.left, progress.up, progress.down, force], (v: number[]) =>
    v[4] ? 0.4 : Math.max(v[0] * on.current[0], v[1] * on.current[1], v[2] * on.current[2], v[3] * on.current[3]) * 0.4
  );
  return <motion.div className="swipewash" style={{ opacity: wash }} aria-hidden="true" />;
}

/** The stamp that names the move. It sits on the card, so it rides and tilts with it. */
export function SwipeStamps({ progress, labels, force, hold }: Props) {
  return (
    <>
      {ORDER.filter((d) => labels[d]).map((d) => (
        <Stamp key={d} dir={d} label={labels[d] as string} progress={progress[d]} force={force} hold={hold} />
      ))}
    </>
  );
}
