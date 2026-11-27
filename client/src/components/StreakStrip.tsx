import { lastSeven } from '../lib/progress';
import { useStreakOn } from '../lib/prefs';
import './StreakStrip.css';

/** The last seven days as dots (`brand`: for the green field), and how many of them Needs you reached zero. Nothing when it is off in Settings. */
export function StreakStrip({ pop, brand }: { pop?: boolean; brand?: boolean }) {
  const on = useStreakOn();
  if (!on) return null;
  const { dots, clear, days } = lastSeven();
  return (
    <div className={`streak${brand ? ' streak--brand' : ''}`} role="group" aria-label={`Inbox cleared on ${clear} of the last ${days} days; Saturday is a rest day`}>
      <div className="streak__dots">
        {dots.map((d, i) => (
          <div key={i} className="streak__day">
            <span className={`streak__dot streak__dot--${d.state}${pop && d.state === 'today-clear' ? ' is-pop' : ''}`} />
            <span className="streak__letter t-caption">{d.letter}</span>
          </div>
        ))}
      </div>
      <span className="streak__count t-footnote">Cleared {clear} of {days} days</span>
    </div>
  );
}
