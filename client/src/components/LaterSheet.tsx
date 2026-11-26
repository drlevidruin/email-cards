import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, CalendarDays, CalendarRange, ChevronRight, Sunrise, Sunset, type LucideIcon } from 'lucide-react';
import { describeWake, laterOptions, type LaterOption } from '../lib/time';
import { Sheet } from './Sheet';

interface Props {
  onPick: (option: LaterOption) => void;
  onClose: () => void;
  /** The card's deadline, such as `Today 4:00 PM`. */
  due?: string | null;
}

const ICONS: Record<string, LucideIcon> = { 'before-due': CalendarClock, today: Sunset, tomorrow: Sunrise, monday: CalendarDays, 'next-week': CalendarRange };

/** `6:00 PM` when the label already names the day (Later today, Tomorrow, Monday); `Dec 3 8:00 AM` for Next week. */
function timeOf(o: LaterOption, now: Date): string {
  const w = describeWake(o.at, now);
  return w.replace(/^(today|tomorrow|sun|mon|tue|wed|thu|fri|sat)\s+/i, '').replace(/^./, (c) => c.toUpperCase());
}

/** `2026-11-27T08:00`, the shape a datetime-local field wants. */
function localValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function LaterSheet({ onPick, onClose, due }: Props) {
  const now = useMemo(() => new Date(), []);
  const options = useMemo(() => laterOptions(now, due), [now, due]);
  const [custom, setCustom] = useState(false);
  const [value, setValue] = useState(() => localValue(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 8)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input')) return;
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) onPick(options[n - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onPick]);

  const at = value ? new Date(value) : null;
  const valid = !!at && !Number.isNaN(at.getTime()) && at.getTime() > Date.now();
  const set = () => {
    if (!at || !valid) return;
    const w = describeWake(at);
    onPick({ id: 'custom', label: 'Pick a date and time', at, when: w.charAt(0).toUpperCase() + w.slice(1) });
  };

  return (
    <Sheet title="Later" onClose={onClose}>
      <div className="latergrid">
        {options.map((o) => {
          const Icon = ICONS[o.id] ?? CalendarDays;
          return (
            <button key={o.id} className="latertile" onClick={() => onPick(o)}>
              <Icon size={22} strokeWidth={1.75} />
              <span className="latertile__text">
                <span className="t-callout latertile__label">{o.label}</span>
                <span className="t-footnote latertile__time">
                  {o.showDay ? o.when : timeOf(o, now)}
                  {o.afterDue && <span className="latertile__late">{"after it's due"}</span>}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {custom ? (
        <div className="laterpick">
          <input type="datetime-local" className="laterpick__input" value={value} min={localValue(now)} onChange={(e) => setValue(e.target.value)} aria-label="Date and time" />
          <button className="btn btn--primary laterpick__set" disabled={!valid} onClick={set}>
            Set
          </button>
        </div>
      ) : (
        <button className="laterpick__row" onClick={() => setCustom(true)}>
          <span className="t-callout">Pick a date and time</span>
          <ChevronRight size={18} strokeWidth={1.75} />
        </button>
      )}
    </Sheet>
  );
}
