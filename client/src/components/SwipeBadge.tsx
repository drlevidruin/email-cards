import { useRef, useState } from 'react';
import { Ban, Check, Clock, ChevronsDown, ListChecks, Newspaper, type LucideIcon } from 'lucide-react';
import { motion, useMotionValueEvent, useTransform, type MotionValue } from 'framer-motion';
import type { Dir } from './ActionBar';
import './SwipeBadge.css';

export type BadgeLabels = Partial<Record<Dir, string>>;

const ICONS: Record<string, LucideIcon> = {
  Done: Check,
  Allow: Check,
  Later: Clock,
  Block: Ban,
  'To-do': ListChecks,
  Newsletters: Newspaper,
  Skip: ChevronsDown,
};

/** What the force value holds while a button or key flies the card: 0 for none, else the direction's number. */
export const FORCE: Record<Dir, number> = { right: 1, left: 2, up: 3, down: 4 };

const TONE: Record<string, string> = { Done: 'accent', Allow: 'accent', Block: 'danger' };
const ORDER: Dir[] = ['right', 'left', 'up', 'down'];

interface Props {
  /** 0 to 1 toward the commit point, per direction. */
  progress: Record<Dir, MotionValue<number>>;
  labels: BadgeLabels;
  /** The direction a button or key is flying the card toward. */
  force: MotionValue<number>;
  /** 1 while the first-card nudge runs: the wash stays faint. */
  nudging?: MotionValue<number>;
}

function Pill({ dir, label, progress, force }: { dir: Dir; label: string; progress: MotionValue<number>; force: MotionValue<number> }) {
  // 0 to 1 as the card nears the commit point; a button or key press jumps straight to 1
  const level = useTransform([progress, force], ([p, f]: number[]) => (f === FORCE[dir] ? 1 : p));
  const scale = useTransform(level, (v) => 0.7 + 0.3 * v);
  const [filled, setFilled] = useState(false);
  useMotionValueEvent(level, 'change', (v) => setFilled(v >= 1));
  const Icon = ICONS[label];
  return (
    <motion.div className="swipeslot__item" style={{ opacity: level, scale }} aria-hidden="true">
      <div className={`swipepill swipepill--${TONE[label] ?? 'ink'}${filled ? ' is-filled' : ''}`}>
        <span className="swipepill__disc">{Icon && <Icon size={20} strokeWidth={1.75} />}</span>
        <span className="swipepill__label t-callout">{label}</span>
      </div>
    </motion.div>
  );
}

/** The white wash over the card's text. It rides on the card. */
export function SwipeWash({ progress, labels, force, nudging }: Props) {
  // A direction that does nothing here (up on the To-do deck) shows no wash
  const on = useRef([1, 1, 1, 1]);
  on.current = ORDER.map((d) => (labels[d] ? 1 : 0));
  const wash = useTransform(nudging ? [progress.right, progress.left, progress.up, progress.down, force, nudging] : [progress.right, progress.left, progress.up, progress.down, force], (v: number[]) => {
    const w = v[4] ? 0.4 : Math.max(v[0] * on.current[0], v[1] * on.current[1], v[2] * on.current[2], v[3] * on.current[3]) * 0.4;
    return v[5] ? Math.min(w, 0.15) : w;
  });
  return <motion.div className="swipewash" style={{ opacity: wash }} aria-hidden="true" />;
}

/** The pill that names the move. It sits in the middle of the deck, not on the card, so it holds still while the card moves. */
export function SwipePills({ progress, labels, force }: Props) {
  return (
    <div className="swipeslot">
      {ORDER.filter((d) => labels[d]).map((d) => (
        <Pill key={d} dir={d} label={labels[d] as string} progress={progress[d]} force={force} />
      ))}
    </div>
  );
}
