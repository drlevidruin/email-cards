import { streak, week } from '../lib/progress';
import { useStreakOn } from '../lib/prefs';
import './StreakStrip.css';

/** This week as seven dots, Sunday first, with the streak to the right. Nothing when the streak is off in Settings. */
export function StreakStrip({ pop }: { pop?: boolean }) {
  const on = useStreakOn();
  if (!on) return null;
  const n = streak();
  return (
    <div className="streak" role="group" aria-label="This week">
      <div className="streak__dots">
        {week().map((d, i) => (
          <div key={i} className="streak__day">
            <span className={`streak__dot streak__dot--${d.state}${pop && d.state === 'today-clear' ? ' is-pop' : ''}`} />
            <span className="streak__letter t-caption">{d.letter}</span>
          </div>
        ))}
      </div>
      {n >= 2 && <span className="streak__count t-footnote">{n} day streak</span>}
    </div>
  );
}
