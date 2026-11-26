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
  nudged: boolean;
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
  let log: Log = { days: {}, seeded: false, nudged: false };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Log>;
      if (parsed && typeof parsed === 'object' && parsed.days) {
        const days: Record<string, Day> = {};
        for (const [k, v] of Object.entries(parsed.days)) {
          days[k] = { moves: Array.isArray(v?.moves) ? v.moves : [], clear: !!v?.clear, starts: v?.starts ?? {} };
        }
        log = { days, seeded: !!parsed.seeded, nudged: !!parsed.nudged };
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
    window.localStorage.setItem(storageKey(), JSON.stringify({ days: log.days, seeded: log.seeded, nudged: log.nudged }));
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
}

export function logMoves(specs: MoveSpec[]): void {
  if (specs.length === 0) return;
  const d = day();
  const now = Date.now();
  for (const s of specs) {
    if (!d.starts[s.stack]) d.starts[s.stack] = now;
    d.moves.push({ id: s.id, stack: s.stack, account: s.account, reply: !!s.reply, at: now });
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

export function nudgeSeen(): boolean {
  return read().nudged;
}

export function markNudged(): void {
  read().nudged = true;
  write();
}

/** Days in a row on which Needs you reached zero, counting back from today (or from yesterday while today is open). Saturdays count for nothing and against nothing. */
export function streak(): number {
  const log = read();
  let d = new Date();
  if (!log.days[dayKey(d)]?.clear) d = shift(d, -1);
  let n = 0;
  for (let i = 0; i < 400; i += 1) {
    if (isSaturday(d)) {
      d = shift(d, -1);
      continue;
    }
    if (!log.days[dayKey(d)]?.clear) break;
    n += 1;
    d = shift(d, -1);
  }
  return n;
}

export type WeekDot = { letter: string; state: 'clear' | 'today' | 'today-clear' | 'open' | 'future' };

/** Sunday to Friday of this week. */
export function week(): WeekDot[] {
  const log = read();
  const now = new Date();
  const letters = ['S', 'M', 'T', 'W', 'T', 'F'];
  return letters.map((letter, i) => {
    const d = shift(now, i - now.getDay());
    const clear = !!log.days[dayKey(d)]?.clear;
    if (i === now.getDay()) return { letter, state: clear ? 'today-clear' : 'today' };
    if (i > now.getDay()) return { letter, state: 'future' };
    return { letter, state: clear ? 'clear' : 'open' };
  });
}

export function estimateMinutes(stack: StackId, left: number): number {
  return Math.max(1, Math.ceil((left * (stack === 'needs-you' ? 30 : 15)) / 60));
}
