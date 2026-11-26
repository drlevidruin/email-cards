import './Ring.css';

const SIZE = 132;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * The finish ring. At rest it is full with a check in an accent disc. On a real finish it closes from `from` to full in 600ms,
 * the check draws, and one soft glow grows behind it and fades. Reduced motion shows the rest state.
 */
export function Ring({ from, celebrate }: { from: number; celebrate: boolean }) {
  const start = Math.max(0, Math.min(1, from));
  return (
    <div className={`ring${celebrate ? ' ring--go' : ''}`} style={{ width: SIZE, height: SIZE }}>
      <span className="ring__glow" aria-hidden="true" />
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" stroke="var(--accent-soft)" strokeWidth={STROKE} />
        <circle
          className="ring__fill"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={0}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ ['--ring-c' as string]: C, ['--ring-from' as string]: C * (1 - start) }}
        />
      </svg>
      <span className="ring__disc" aria-hidden="true">
        <svg className="ring__check" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 9 17l-5-5" pathLength={1} />
        </svg>
      </span>
    </div>
  );
}
