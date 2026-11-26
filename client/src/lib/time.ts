const DAY = 86400000;

export function relativeTime(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'Now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (d.getTime() >= startToday - DAY) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export interface LaterOption {
  id: string;
  label: string;
  at: Date;
  /** Result time as shown in the sheet, such as "Today 6:00 PM". */
  when: string;
}

function at(base: Date, addDays: number, hour: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + addDays, hour, 0, 0, 0);
}

function clock(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** Describes a wake time relative to now: "today 6:00 PM", "tomorrow 8:00 AM", "Mon 8:00 AM", "Dec 2 8:00 AM". */
export function describeWake(target: Date, now = new Date()): string {
  const days = Math.round((at(target, 0, 0).getTime() - at(now, 0, 0).getTime()) / DAY);
  if (days === 0) return `today ${clock(target)}`;
  if (days === 1) return `tomorrow ${clock(target)}`;
  if (days < 7) return `${target.toLocaleDateString('en-US', { weekday: 'short' })} ${clock(target)}`;
  return `${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${clock(target)}`;
}

export function laterOptions(now: Date): LaterOption[] {
  const candidates: { id: string; label: string; at: Date }[] = [];
  const hour = now.getHours() + now.getMinutes() / 60;
  if (hour < 20) {
    candidates.push({ id: 'today', label: 'Later today', at: at(now, 0, hour >= 15 ? 21 : 18) });
  }
  candidates.push({ id: 'tomorrow', label: 'Tomorrow', at: at(now, 1, 8) });
  const day = now.getDay();
  if ((day + 1) % 7 !== 1) {
    const untilMonday = ((8 - day) % 7) || 7;
    candidates.push({ id: 'monday', label: 'Monday', at: at(now, untilMonday, 8) });
  }
  candidates.push({ id: 'next-week', label: 'Next week', at: at(now, 7, 8) });

  const seen = new Set<number>();
  const out: LaterOption[] = [];
  for (const c of candidates) {
    const t = c.at.getTime();
    if (t <= now.getTime() || seen.has(t)) continue;
    seen.add(t);
    const w = describeWake(c.at, now);
    out.push({ ...c, when: w.charAt(0).toUpperCase() + w.slice(1) });
  }
  return out;
}

/** Red deadlines: due today or already overdue. */
export const isHot = (label?: string | null) => /^(today|overdue)/i.test(label || '');

/** One wording for every deadline: "Due today 4:00 PM", "Due tomorrow noon", "Due Thu 2:00 PM". */
export function dueText(label: string): string {
  if (/^(due|overdue)\b|waiting/i.test(label)) return label;
  return `Due ${label.replace(/^(today|tomorrow)\b/i, (w) => w.toLowerCase())}`;
}
