import { useRef } from 'react';
import './SegmentBar.css';

const MAX_SEGMENTS = 24;

/** One segment per card. A plain bar past 24 cards. */
export function SegmentBar({ handled, total }: { handled: number; total: number }) {
  // Only the segment that just turned on pulses. An Undo turns one off quietly, and a new total (another stack or filter) starts still.
  const last = useRef({ done: Math.min(handled, total), total, pulse: -1 });
  const now = Math.min(handled, total);
  if (last.current.total !== total) last.current = { done: now, total, pulse: -1 };
  else if (last.current.done !== now) last.current = { done: now, total, pulse: now > last.current.done ? now - 1 : -1 };
  const pulse = last.current.pulse;
  if (total <= 0) return <div className="segbar segbar--empty" role="presentation" />;
  const done = Math.min(handled, total);
  if (total > MAX_SEGMENTS) {
    return (
      <div className="segbar segbar--plain" role="presentation">
        <div className="segbar__fill" style={{ width: `${(done / total) * 100}%` }} />
      </div>
    );
  }
  return (
    <div className="segbar" role="presentation">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`segbar__seg${i < done ? ' is-on' : ''}${i === pulse ? ' is-new' : ''}`} />
      ))}
    </div>
  );
}
