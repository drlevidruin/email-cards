import { motion, type MotionValue } from 'framer-motion';
import type { Dir } from './ActionBar';
import './Card.css';

interface Props {
  opacity: Record<Dir, MotionValue<number>>;
  labels: Partial<Record<Dir, string>>;
  accent: Dir;
}

export function Stamps({ opacity, labels, accent }: Props) {
  return (
    <>
      {(Object.keys(labels) as Dir[]).map((dir) => (
        <motion.div
          key={dir}
          className={`stamp stamp--${dir}${dir === accent ? ' stamp--accent' : ''}`}
          style={{ opacity: opacity[dir] }}
          aria-hidden="true"
        >
          {labels[dir]}
        </motion.div>
      ))}
    </>
  );
}
