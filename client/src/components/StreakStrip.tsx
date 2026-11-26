import { streak, week } from '../lib/progress';
import './StreakStrip.css';

/** `4-day streak` over a strip of Sunday to Friday. */
export function StreakStrip({ pop }: { pop?: boolean }) {
  const n = streak();
  const days = week();
  return (
    <div className="streak">
      {n > 0 && <p className="streak__count">{n}-day streak</p>}
      <div className="streak__dots" style={n > 0 ? undefined : { marginTop: 0 }}>
        {days.map((d, i) => (
          <div key={i} className="streak__day">
            <span className={`streak__dot streak__dot--${d.state}${pop && d.state === 'today-clear' ? ' is-pop' : ''}`} />
            <span className="streak__letter">{d.letter}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
