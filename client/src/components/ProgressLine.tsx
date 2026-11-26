import './ProgressLine.css';

export function ProgressLine({ cleared, total }: { cleared: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (cleared / total) * 100) : 0;
  return (
    <div className="progress" role="presentation">
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
