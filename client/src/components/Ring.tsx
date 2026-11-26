import type { ReactNode } from 'react';
import './Ring.css';

const SIZE = 168;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/** The progress ring. With `check` it fills to complete and draws a check inside; with `rest` it shows that finished state at once, without the motion. */
export function Ring({ value, check, rest, children }: { value: number; check?: boolean; rest?: boolean; children?: ReactNode }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="ring" style={{ width: SIZE, height: SIZE }}>
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
        <circle
          className={`ring__fill${check && !rest ? ' ring__fill--grow' : ''}`}
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - v)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ ['--ring-c' as string]: C }}
        />
        {check && <path className={`ring__check${rest ? ' ring__check--rest' : ''}`} d="M58 86 78 106 112 66" fill="none" stroke="var(--accent)" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" pathLength={1} />}
      </svg>
      {children && <div className="ring__center">{children}</div>}
    </div>
  );
}
