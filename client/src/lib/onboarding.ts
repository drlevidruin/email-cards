import { readLog, writeLog } from './progress';

/** The first-run part of the log: the welcome, the first Done, the moves a pointer has taught, and which browser session is the first. */

/** The moves the first-session nudges have already shown. Someone who saw the old single nudge has had the right move. */
export function taughtMoves(): string[] {
  const log = readLog();
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
  const first = readLog().firstSession;
  return !first || first === sessionId();
}

/** Save this session's id as the first one, unless an earlier session already holds that place. */
export function claimFirstSession(): void {
  const log = readLog();
  if (log.firstSession) return;
  log.firstSession = sessionId();
  writeLog();
}

/** What a pointer can teach: the answers, the four swipes, opening the card, and the three New senders moves (`s-`). */
export type Taught = 'answer' | 'right' | 'left' | 'up' | 'down' | 'open' | 's-right' | 's-left' | 's-up';

export const hasWelcomed = (): boolean => readLog().welcomed;

export function markWelcomed(): void {
  const log = readLog();
  if (log.welcomed) return;
  log.welcomed = true;
  writeLog();
}

/** True once, the first time Done is ever used: that Done explains itself. */
export function takeFirstDone(): boolean {
  const log = readLog();
  if (log.firstDone) return false;
  log.firstDone = true;
  writeLog();
  return true;
}

/** The lesson each card was given, kept while the page lives: a card that comes back (after a reply screen) keeps the lesson it had. */
const lessons = new Map<string, Taught | null>();

export function lessonFor(id: string, pick: () => Taught | null): Taught | null {
  if (!lessons.has(id)) lessons.set(id, pick());
  return lessons.get(id) ?? null;
}

/** Reset: the next person handed this device gets the welcome, the pointers and the first Done message again. */
export function resetOnboarding(): void {
  const log = readLog();
  log.welcomed = false;
  log.firstDone = false;
  log.nudged = false;
  log.taught = [];
  log.firstSession = '';
  lessons.clear();
  writeLog();
}

export function markTaught(dir: string): void {
  const log = readLog();
  if (!log.taught.includes(dir)) log.taught = [...log.taught, dir];
  if (dir === 'right') log.nudged = true;
  writeLog();
}

