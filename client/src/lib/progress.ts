import { useSyncExternalStore } from 'react';
import { isSnapshot } from './snapshot';
import type { StackId } from './stacks';

/**
 * What got done, kept on this device by local day. It drives the Today card, the segmented bar,
 * the finish card and the streak. It never leaves the browser.
 */
interface Move {
  /** Thread id, or a sender's email. */
  id: string;
  stack: StackId;
  account: string;
  reply: boolean;
  /** What was done with the card: Done, To-do, Later, Allowed, Blocked or Newsletters. Missing on older logs, which read as Done. */
  kind?: string;
  at: number;
}

interface Day {
  /** Only today keeps its moves; earlier days keep just whether they were clear. */
  moves: Move[];
  /** Needs you reached zero on this day, across every account. */
  clear: boolean;
  /** When each stack first showed a card today (the Start press for Needs you). */
  starts: Partial<Record<StackId, number>>;
}

interface Log {
  days: Record<string, Day>;
  seeded: boolean;
  /** The first card was nudged (older logs). Counts as the right move taught. */
  nudged: boolean;
  /** Moves the first-session nudges have shown: right, left, up, down. */
  taught: string[];
  /** The id of the browser session the log was first used in. Teaching nudges show only in that session. */
  firstSession: string;
}

const KEY = 'email_cards_progress_v1';
const SNAPSHOT_KEY = 'email_cards_snapshot_progress';
const DAY_MS = 86_400_000;

let cache: Log | null = null;
let cacheKey = '';
let version = 0;
const listeners = new Set<() => void>();

const storageKey = () => (isSnapshot() ? SNAPSHOT_KEY : KEY);

export function dayKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function shift(d: Date, days: number): Date {
  const n = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12);
  n.setTime(n.getTime() + days * DAY_MS);
  return n;
}

const isSaturday = (d: Date) => d.getDay() === 6;
const today = () => dayKey(new Date());

function read(): Log {
  const key = storageKey();
  if (cache && cacheKey === key) return cache;
  let log: Log = { days: {}, seeded: false, nudged: false, taught: [], firstSession: '' };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Log>;
      if (parsed && typeof parsed === 'object' && parsed.days) {
        const days: Record<string, Day> = {};
        const latest = today();
        for (const [k, v] of Object.entries(parsed.days)) {
          // Progress saved before the demo clock was pinned can hold days after today: ignore them
          if (k > latest) continue;
          days[k] = { moves: Array.isArray(v?.moves) ? v.moves : [], clear: !!v?.clear, starts: v?.starts ?? {} };
        }
        log = { days, seeded: !!parsed.seeded, nudged: !!parsed.nudged, taught: Array.isArray(parsed.taught) ? parsed.taught : [], firstSession: typeof parsed.firstSession === 'string' ? parsed.firstSession : '' };
      }
    }
  } catch {
    // A broken log starts over
  }
  cacheKey = key;
  cache = log;
  return log;
}

function write(): void {
  const log = read();
  const t = today();
  for (const k of Object.keys(log.days)) if (k !== t) log.days[k] = { moves: [], clear: log.days[k].clear, starts: {} };
  try {
    window.localStorage.setItem(storageKey(), JSON.stringify({ days: log.days, seeded: log.seeded, nudged: log.nudged, taught: log.taught, firstSession: log.firstSession }));
  } catch {
    // Storage may be blocked; the log still works until the page closes
  }
  version += 1;
  listeners.forEach((l) => l());
}

function day(key = today()): Day {
  const log = read();
  if (!log.days[key]) log.days[key] = { moves: [], clear: false, starts: {} };
  return log.days[key];
}

/** Sample mode only: the four days before today (Saturdays skipped) count as clear, so the demo shows a streak. */
export function seedSample(): void {
  if (isSnapshot()) return;
  const log = read();
  if (log.seeded) return;
  log.seeded = true;
  let d = shift(new Date(), -1);
  let n = 0;
  while (n < 4) {
    if (!isSaturday(d)) {
      day(dayKey(d)).clear = true;
      n += 1;
    }
    d = shift(d, -1);
  }
  write();
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Re-render when the log changes. Call it in any component that reads the log. */
export function useProgressLog(): number {
  return useSyncExternalStore(subscribe, () => version);
}

const inAccount = (m: Move, account: string) => account === 'all' || m.account === account;
const todayMoves = (stack: StackId, account: string) =>
  (read().days[today()]?.moves ?? []).filter((m) => m.stack === stack && inAccount(m, account));

export function handledToday(stack: StackId, account: string): number {
  return todayMoves(stack, account).length;
}

export function repliesToday(stack: StackId, account: string): number {
  return todayMoves(stack, account).filter((m) => m.reply).length;
}

/** Note when a stack first showed a card today, which starts its clock. */
export function markStart(stack: StackId): void {
  const d = day();
  if (!d.starts[stack]) {
    d.starts[stack] = Date.now();
    write();
  }
}

export interface MoveSpec {
  id: string;
  stack: StackId;
  account: string;
  reply?: boolean;
  kind?: string;
}

export function logMoves(specs: MoveSpec[]): void {
  if (specs.length === 0) return;
  const d = day();
  const now = Date.now();
  for (const s of specs) {
    if (!d.starts[s.stack]) d.starts[s.stack] = now;
    d.moves.push({ id: s.id, stack: s.stack, account: s.account, reply: !!s.reply, kind: s.kind, at: now });
  }
  write();
}

/** Undo and a failed save take back exactly the moves of the cards they put back. */
export function logUndone(stack: StackId, ids: string[]): void {
  const d = day();
  const before = d.moves.length;
  for (const id of ids) {
    for (let i = d.moves.length - 1; i >= 0; i -= 1) {
      if (d.moves[i].stack === stack && d.moves[i].id === id) {
        d.moves.splice(i, 1);
        break;
      }
    }
  }
  if (stack === 'needs-you') d.clear = false;
  if (d.moves.length !== before || stack === 'needs-you') write();
}

export function markClear(): void {
  const d = day();
  if (!d.clear) {
    d.clear = true;
    write();
  }
}

export function isClearToday(): boolean {
  return !!read().days[today()]?.clear;
}

const GAP_CAP_MS = 3 * 60_000;

/** Active minutes in a stack today: the gaps between its moves, each capped at 3 minutes, the first from the stack's start. */
export function minutesToday(stack: StackId, account: string): number {
  const d = read().days[today()];
  if (!d) return 0;
  // Walk every move in the stack from its start; a gap counts only when the move that closes it is in the filtered account
  const moves = todayMoves(stack, 'all').sort((a, b) => a.at - b.at);
  let prev = d.starts[stack] ?? moves[0]?.at ?? 0;
  let total = 0;
  for (const m of moves) {
    if (inAccount(m, account)) total += Math.min(Math.max(0, m.at - prev), GAP_CAP_MS);
    prev = m.at;
  }
  return total / 60_000;
}

/** Settings Reset: today starts over. The earlier days, and the sample seed, stay. */
export function resetToday(): void {
  const log = read();
  delete log.days[today()];
  seedSample();
  write();
}

/** The moves the first-session nudges have already shown. Someone who saw the old single nudge has had the right move. */
export function taughtMoves(): string[] {
  const log = read();
  return log.nudged && !log.taught.includes('right') ? ['right', ...log.taught] : log.taught;
}

const SESSION_KEY = 'email_cards_session';

/** An id for this browser session (a tab), kept in sessionStorage. */
function sessionId(): string {
  try {
    let id = window.sessionStorage.getItem(SESSION_KEY);
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      window.sessionStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return 'none';
  }
}

/** True in the session the log was first used in (or before any session has been saved). Later sessions do not match it. */
export function isFirstSession(): boolean {
  const first = read().firstSession;
  return !first || first === sessionId();
}

/** Save this session's id as the first one, unless an earlier session already holds that place. */
export function claimFirstSession(): void {
  const log = read();
  if (log.firstSession) return;
  log.firstSession = sessionId();
  write();
}

export function markTaught(dir: string): void {
  const log = read();
  if (!log.taught.includes(dir)) log.taught = [...log.taught, dir];
  if (dir === 'right') log.nudged = true;
  write();
}

/** The cards handled in a stack today, newest first, each with what was done to it. */
export function recentMoves(stack: StackId, account: string, n: number): { id: string; kind: string }[] {
  return todayMoves(stack, account)
    .sort((a, b) => b.at - a.at)
    .slice(0, n)
    .map((m) => ({ id: m.id, kind: m.kind ?? 'Done' }));
}

/** How many of each move today in a stack, in the order they first happened: `[['Done', 2], ['Later', 1]]`. */
export function moveCounts(stack: StackId, account: string): [string, number][] {
  const out = new Map<string, number>();
  for (const m of todayMoves(stack, account).sort((a, b) => a.at - b.at)) out.set(m.kind ?? 'Done', (out.get(m.kind ?? 'Done') ?? 0) + 1);
  return [...out.entries()];
}

export type WeekDot = { letter: string; state: 'clear' | 'today' | 'today-clear' | 'open' | 'rest' };

/** The last seven days ending today, oldest first. A day counts when Needs you reached zero that day. Saturday is a rest day: it shows as a dash and is left out of the count and the total. */
export function lastSeven(): { dots: WeekDot[]; clear: number; days: number } {
  const log = read();
  const now = new Date();
  const letters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  let clear = 0;
  let days = 0;
  const dots = Array.from({ length: 7 }, (_, i): WeekDot => {
    const d = shift(now, i - 6);
    const letter = letters[d.getDay()];
    if (isSaturday(d)) return { letter, state: 'rest' };
    days += 1;
    const isClear = !!log.days[dayKey(d)]?.clear;
    if (isClear) clear += 1;
    if (i === 6) return { letter, state: isClear ? 'today-clear' : 'today' };
    return { letter, state: isClear ? 'clear' : 'open' };
  });
  return { dots, clear, days };
}

export function estimateMinutes(stack: StackId, left: number): number {
  return Math.max(1, Math.ceil((left * (stack === 'needs-you' ? 30 : 15)) / 60));
}
