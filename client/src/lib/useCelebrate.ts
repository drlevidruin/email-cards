import { useRef } from 'react';

/**
 * True only when the user's own move has just emptied this stack. A stack is armed while it holds cards; the first time it
 * is found empty after that, it celebrates once. Arriving at an empty stack any other way (a reload, coming back to it,
 * mail that cleared elsewhere) shows the finished state at rest.
 */
export function useCelebrate(key: string, hasCards: boolean, finished: boolean): boolean {
  // State for the current stack and filter only; a new key starts clean
  const s = useRef({ key, armed: false, won: false });
  if (s.current.key !== key) s.current = { key, armed: false, won: false };
  if (hasCards) s.current.armed = true;
  if (finished && s.current.armed) s.current = { key, armed: false, won: true };
  if (!finished) s.current.won = false;
  return finished && s.current.won;
}
