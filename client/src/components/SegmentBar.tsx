import './SegmentBar.css';

interface Props {
  handled: number;
  total: number;
  /** Today, before the first card: the line takes its room but shows nothing. */
  hidden?: boolean;
  /** The finish: the line is full. */
  full?: boolean;
}

/** One continuous line that fills as cards are handled. */
export function SegmentBar({ handled, total, hidden, full }: Props) {
  const share = full ? 1 : total > 0 ? Math.min(handled, total) / total : 0;
  return (
    <div className={`segbar${hidden ? ' is-hidden' : ''}`} role="presentation">
      <div className="segbar__fill" style={{ width: `${share * 100}%` }} />
    </div>
  );
}
