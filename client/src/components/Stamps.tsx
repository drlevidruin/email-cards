import { Ban, Check, Clock, type LucideIcon } from 'lucide-react';
import { motion, type MotionValue } from 'framer-motion';
import './Card.css';

type Side = 'left' | 'right';

interface Props {
  opacity: Record<Side, MotionValue<number>>;
  labels: Record<Side, string>;
  accent: Side;
}

const ICONS: Record<string, LucideIcon> = { Done: Check, Allow: Check, Later: Clock, Block: Ban };

export function Stamps({ opacity, labels, accent }: Props) {
  return (
    <>
      {(['right', 'left'] as Side[]).map((side) => {
        const Icon = ICONS[labels[side]];
        return (
          <motion.div
            key={side}
            className={`stamp stamp--${side}${side === accent ? ' stamp--accent' : ''}`}
            style={{ opacity: opacity[side] }}
            aria-hidden="true"
          >
            {Icon && <Icon size={16} strokeWidth={2} />}
            {labels[side]}
          </motion.div>
        );
      })}
    </>
  );
}
