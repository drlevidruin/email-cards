import { useEffect, useRef, useState } from 'react';
import { isFirstSession, lessonFor, markTaught, taughtMoves, type Taught } from '../lib/onboarding';
import type { Dir } from './ActionBar';

const ORDER: Dir[] = ['right', 'left', 'up', 'down'];
const SENDER_ORDER: Taught[] = ['s-right', 's-left', 's-up'];

/** The first lesson this deck has that has not been taught: the answers, the four moves, then opening a card. New senders has its own three. */
export function nextPointer(enabled: Dir[], senders: boolean, answers: boolean): Taught | null {
  const taught = taughtMoves();
  if (senders) return SENDER_ORDER.find((m) => !taught.includes(m)) ?? null;
  if (answers && !taught.includes('answer')) return 'answer';
  return ORDER.find((d) => enabled.includes(d) && !taught.includes(d)) ?? (taught.includes('open') ? null : 'open');
}

interface Args {
  /** The card on top, or undefined when there is none. */
  topId: string | undefined;
  /** The card under it, if any. */
  nextId: string | undefined;
  /** The pile and the account filter the deck shows, as one string. */
  pile: string;
  /** The directions this deck has. */
  enabled: Dir[];
  /** The deck is showing a card with nothing over it. */
  ready: boolean;
  /** The deck is New senders. */
  senders: boolean;
  /** The top card shows answer rows. */
  answers: boolean;
}

/**
 * The pointer for the card on top. A card is given its pointer when it arrives and keeps it until it leaves. A lesson
 * counts as taught when the card that showed it leaves by an action; a card that Undo puts back over it, or a change of pile, does not count. The first session only, except New senders,
 * which teaches its three the first time a person meets that deck, in any session.
 */
export function useCardPointer({ topId, nextId, pile, enabled, ready, senders, answers }: Args): Taught | null {
  const [pin, setPin] = useState<{ id: string; move: Taught | null; pile: string }>({ id: '', move: null, pile: '' });
  const last = useRef(pin);
  last.current = pin;
  const dirs = enabled.join();
  useEffect(() => {
    if (!ready || !topId || last.current.id === topId) return;
    // The card that showed the last pointer has gone by an action. Undo putting a card back over it, or a change of pile, teaches nothing
    const prev = last.current;
    if (prev.move && prev.pile === pile && prev.id !== nextId) markTaught(prev.move);
    // A card that comes back keeps the lesson it had; only a new card is given the next one
    const move = lessonFor(topId, () => (senders || isFirstSession() ? nextPointer(dirs.split(',') as Dir[], senders, answers) : null));
    setPin({ id: topId, move, pile });
  }, [ready, topId, nextId, pile, dirs, senders, answers]);
  if (!ready || pin.id !== topId) return null;
  // A move the person has just made is taught: its line goes, even when the same card stays on top (Skip on the last card, a failed save)
  return pin.move && taughtMoves().includes(pin.move) ? null : pin.move;
}
