import type { ShabbosStatus } from '../../shared/types.js';

interface LocalParts {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0 = Sun, 5 = Fri, 6 = Sat
  hour: number; // 0-23
  minute: number; // 0-59
}

interface HolidayRange {
  name: string;
  // Inclusive start (evening candle-lighting date YYYY-MM-DD) and end (nightfall date YYYY-MM-DD)
  startDate: string;
  endDate: string;
}

// Major Yom Tov dates (Diaspora schedule, 2025 through 2028).
// Windows begin at candle-lighting on startDate evening and conclude at nightfall on endDate.
const YOM_TOV_WINDOWS: HolidayRange[] = [
  // 2025
  { name: 'Pesach (First Days)', startDate: '2025-04-12', endDate: '2025-04-14' },
  { name: 'Pesach (Final Days)', startDate: '2025-04-18', endDate: '2025-04-20' },
  { name: 'Shavuot', startDate: '2025-06-01', endDate: '2025-06-03' },
  { name: 'Rosh Hashanah', startDate: '2025-09-22', endDate: '2025-09-24' },
  { name: 'Yom Kippur', startDate: '2025-10-01', endDate: '2025-10-02' },
  { name: 'Sukkot (First Days)', startDate: '2025-10-06', endDate: '2025-10-08' },
  { name: 'Shemini Atzeret / Simchat Torah', startDate: '2025-10-13', endDate: '2025-10-15' },
  // 2026
  { name: 'Pesach (First Days)', startDate: '2026-04-01', endDate: '2026-04-03' },
  { name: 'Pesach (Final Days)', startDate: '2026-04-07', endDate: '2026-04-09' },
  { name: 'Shavuot', startDate: '2026-05-21', endDate: '2026-05-23' },
  { name: 'Rosh Hashanah', startDate: '2026-09-11', endDate: '2026-09-13' },
  { name: 'Yom Kippur', startDate: '2026-09-20', endDate: '2026-09-21' },
  { name: 'Sukkot (First Days)', startDate: '2026-09-25', endDate: '2026-09-27' },
  { name: 'Shemini Atzeret / Simchat Torah', startDate: '2026-10-02', endDate: '2026-10-04' },
  // 2027
  { name: 'Pesach (First Days)', startDate: '2027-04-21', endDate: '2027-04-23' },
  { name: 'Pesach (Final Days)', startDate: '2027-04-27', endDate: '2027-04-29' },
  { name: 'Shavuot', startDate: '2027-06-10', endDate: '2027-06-12' },
  { name: 'Rosh Hashanah', startDate: '2027-10-01', endDate: '2027-10-03' },
  { name: 'Yom Kippur', startDate: '2027-10-10', endDate: '2027-10-11' },
  { name: 'Sukkot (First Days)', startDate: '2027-10-15', endDate: '2027-10-17' },
  { name: 'Shemini Atzeret / Simchat Torah', startDate: '2027-10-22', endDate: '2027-10-24' },
  // 2028
  { name: 'Pesach (First Days)', startDate: '2028-04-10', endDate: '2028-04-12' },
  { name: 'Pesach (Final Days)', startDate: '2028-04-16', endDate: '2028-04-18' },
  { name: 'Shavuot', startDate: '2028-05-30', endDate: '2028-06-01' },
  { name: 'Rosh Hashanah', startDate: '2028-09-20', endDate: '2028-09-22' },
  { name: 'Yom Kippur', startDate: '2028-09-29', endDate: '2028-09-30' },
  { name: 'Sukkot (First Days)', startDate: '2028-10-04', endDate: '2028-10-06' },
  { name: 'Shemini Atzeret / Simchat Torah', startDate: '2028-10-11', endDate: '2028-10-13' },
];

// Conservative candle-lighting (18 min before sunset) and Havdalah (50 min after sunset)
// approximate local wall-clock minutes by calendar month (1-indexed) for northern mid-latitudes.
const MONTHLY_CANDLE_LIGHTING: Record<number, [number, number]> = {
  1: [16, 25],
  2: [17, 0],
  3: [18, 35],
  4: [19, 10],
  5: [19, 40],
  6: [20, 0],
  7: [19, 55],
  8: [19, 25],
  9: [18, 40],
  10: [17, 50],
  11: [16, 15],
  12: [16, 10],
};

const MONTHLY_HAVDALAH: Record<number, [number, number]> = {
  1: [17, 45],
  2: [18, 15],
  3: [19, 50],
  4: [20, 25],
  5: [21, 0],
  6: [21, 20],
  7: [21, 15],
  8: [20, 40],
  9: [19, 55],
  10: [19, 5],
  11: [17, 30],
  12: [17, 25],
};

const WEEKDAY_MAP: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function sanitizeTimezone(tz?: string): string {
  const candidate = (tz || 'America/New_York').trim();
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date());
    return candidate;
  } catch {
    return 'America/New_York';
  }
}

function getLocalParts(date: Date, timezone: string): LocalParts {
  const safeTz = sanitizeTimezone(timezone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: safeTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  const rawHour = Number(map.hour ?? '0');
  return {
    year: Number(map.year ?? '2026'),
    month: Number(map.month ?? '1'),
    day: Number(map.day ?? '1'),
    weekday: WEEKDAY_MAP[map.weekday ?? 'Sun'] ?? 0,
    hour: rawHour === 24 ? 0 : rawHour,
    minute: Number(map.minute ?? '0'),
  };
}

// Converts a wall-clock local date/time in `timezone` into a UTC Date object
// using iterative offset refinement so DST transitions stay accurate.
function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  let guessMs = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  for (let i = 0; i < 3; i++) {
    const actual = getLocalParts(new Date(guessMs), timezone);
    const actualAsUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      0,
      0,
    );
    const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
    const diffMs = desiredAsUtc - actualAsUtc;
    if (diffMs === 0) break;
    guessMs += diffMs;
  }
  return new Date(guessMs);
}

function addCalendarDays(
  year: number,
  month: number,
  day: number,
  deltaDays: number,
): { year: number; month: number; day: number } {
  const d = new Date(Date.UTC(year, month - 1, day + deltaDays, 12, 0, 0));
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

function parseYmd(ymd: string): { year: number; month: number; day: number } {
  const [y, m, d] = ymd.split('-').map(Number);
  return { year: y, month: m, day: d };
}

interface ComputedWindow {
  start: Date;
  end: Date;
  label: string;
}

function buildWeeklyShabbosWindow(
  friday: { year: number; month: number; day: number },
  timezone: string,
): ComputedWindow {
  const saturday = addCalendarDays(friday.year, friday.month, friday.day, 1);
  const [cH, cM] = MONTHLY_CANDLE_LIGHTING[friday.month] ?? [17, 30];
  const [hH, hM] = MONTHLY_HAVDALAH[saturday.month] ?? [18, 45];
  const start = zonedWallClockToUtc(friday.year, friday.month, friday.day, cH, cM, timezone);
  const end = zonedWallClockToUtc(saturday.year, saturday.month, saturday.day, hH, hM, timezone);
  return { start, end, label: 'Shabbos' };
}

function buildHolidayWindow(h: HolidayRange, timezone: string): ComputedWindow {
  const s = parseYmd(h.startDate);
  const e = parseYmd(h.endDate);
  const [cH, cM] = MONTHLY_CANDLE_LIGHTING[s.month] ?? [17, 30];
  const [hH, hM] = MONTHLY_HAVDALAH[e.month] ?? [18, 45];
  return {
    start: zonedWallClockToUtc(s.year, s.month, s.day, cH, cM, timezone),
    end: zonedWallClockToUtc(e.year, e.month, e.day, hH, hM, timezone),
    label: h.name,
  };
}

function getCandidateWindows(referenceDate: Date, timezone: string): ComputedWindow[] {
  const local = getLocalParts(referenceDate, timezone);
  const windows: ComputedWindow[] = [];

  // Previous, current, and next Friday relative to local weekday
  const daysUntilFriday = (5 - local.weekday + 7) % 7;
  const candidateFridays = [
    addCalendarDays(local.year, local.month, local.day, daysUntilFriday - 7),
    addCalendarDays(local.year, local.month, local.day, daysUntilFriday),
    addCalendarDays(local.year, local.month, local.day, daysUntilFriday + 7),
  ];

  for (const fri of candidateFridays) {
    windows.push(buildWeeklyShabbosWindow(fri, timezone));
  }

  for (const holiday of YOM_TOV_WINDOWS) {
    const win = buildHolidayWindow(holiday, timezone);
    // Include holidays within +/- 400 days of referenceDate
    const diffDays = Math.abs(win.start.getTime() - referenceDate.getTime()) / (86400 * 1000);
    if (diffDays <= 400) {
      windows.push(win);
    }
  }

  // Sort chronologically and merge overlapping or contiguous windows (e.g. Shabbos + Yom Tov)
  windows.sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: ComputedWindow[] = [];
  for (const win of windows) {
    const prev = merged[merged.length - 1];
    if (prev && win.start.getTime() <= prev.end.getTime() + 60 * 60 * 1000) {
      if (win.end.getTime() > prev.end.getTime()) {
        prev.end = win.end;
      }
      if (!prev.label.includes(win.label)) {
        prev.label = `${prev.label} & ${win.label}`;
      }
    } else {
      merged.push({ ...win });
    }
  }

  return merged;
}

export interface RestrictionCheck {
  restricted: boolean;
  reason?: string;
  windowStart: string;
  windowEnd: string;
  windowLabel: string;
}

export function isOutboundRestricted(
  date: Date = new Date(),
  timezone = 'America/New_York',
): RestrictionCheck {
  const safeTz = sanitizeTimezone(timezone);
  const windows = getCandidateWindows(date, safeTz);
  const nowMs = date.getTime();

  for (const win of windows) {
    if (nowMs >= win.start.getTime() && nowMs < win.end.getTime()) {
      return {
        restricted: true,
        reason: `${win.label} outbound hold is active in ${safeTz}. Messages will be released automatically after Havdalah.`,
        windowStart: win.start.toISOString(),
        windowEnd: win.end.toISOString(),
        windowLabel: win.label,
      };
    }
  }

  const upcoming = windows.find((w) => w.start.getTime() > nowMs) ?? windows[windows.length - 1];
  return {
    restricted: false,
    windowStart: upcoming.start.toISOString(),
    windowEnd: upcoming.end.toISOString(),
    windowLabel: upcoming.label,
  };
}

export function getShabbosStatus(
  enabled: boolean,
  timezone = 'America/New_York',
  heldCount = 0,
  now: Date = new Date(),
): ShabbosStatus {
  const safeTz = sanitizeTimezone(timezone);
  const check = isOutboundRestricted(now, safeTz);
  return {
    enabled,
    isCurrentlyRestricted: enabled && check.restricted,
    nextWindowStart: check.windowStart,
    nextWindowEnd: check.windowEnd,
    timezone: safeTz,
    heldCount,
    reason: enabled
      ? check.restricted
        ? check.reason
        : `Next hold window: ${check.windowLabel}`
      : 'Shabbos and Yom Tov outbound guard is paused',
  };
}

export function startShabbosReleaseLoop(
  releaseFn: () => Promise<void> | void,
  intervalMs = 60_000,
): NodeJS.Timeout {
  const timer = setInterval(() => {
    Promise.resolve(releaseFn()).catch((err) => {
      console.error('[shabbos-guard] Background release error:', err);
    });
  }, intervalMs);
  timer.unref();
  return timer;
}
