import { ChevronRight, PenLine, Reply } from 'lucide-react';
import { useSyncExternalStore } from 'react';
import { replyActions } from '../lib/stacks';
import type { EmailThread } from '../lib/types';
import { useIsDesktop } from '../lib/useIsDesktop';
import './CardAnswers.css';

/** A row's id: a ready answer's chip id, or one of these two. */
export const OWN = '@own';
export const CHOOSE = '@choose';

const SHORT = '(max-height: 599px)';
const useShortWindow = (): boolean =>
  useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(SHORT);
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia(SHORT).matches
  );

/** Where a row goes: the reply editor with that answer in it, the editor empty, or the chooser. */
export function answerPath(threadId: string, qa: string): string {
  if (qa === CHOOSE || !qa) return `/reply/${threadId}?from=deck`;
  if (qa === OWN) return `/reply/${threadId}?own=1&direct=1&from=deck`;
  return `/reply/${threadId}?qa=${encodeURIComponent(qa)}&direct=1&from=deck`;
}

/** Whether the card has at least one ready answer. The accent, the Done button and the pointer's answer lesson all follow this. */
export function hasReady(thread: EmailThread): boolean {
  return replyActions(thread).length > 0;
}

/** The rows a card offers, in order: the first two ready answers, then your own. A row is the accent only when it is a ready answer. */
export function answerRows(thread: EmailThread, short: boolean): { id: string; label: string; ready: boolean; key: string }[] {
  const ready = replyActions(thread).slice(0, 2);
  if (short) return [{ id: CHOOSE, label: 'Reply', ready: ready.length > 0, key: 'R' }];
  if (ready.length === 0) return [{ id: CHOOSE, label: 'Write a reply', ready: false, key: 'R' }];
  return [...ready.map((c, i) => ({ id: c.id, label: c.label, ready: true, key: String(i + 1) })), { id: OWN, label: 'Write my own', ready: false, key: 'R' }];
}

/** The answer a key opens: 1 and 2 the ready answers, R the last row. */
export function answerForKey(thread: EmailThread, key: '1' | '2' | 'r'): string | null {
  const rows = answerRows(thread, false);
  if (key === 'r') return rows[rows.length - 1].id;
  const row = rows[Number(key) - 1];
  return row && row.id !== OWN && row.id !== CHOOSE ? row.id : null;
}

/** When a tap on a row was last acted on by the deck's own gesture; the click that follows that tap must not act again. */
let tapped = 0;
export const markTapped = (): void => {
  tapped = Date.now();
};
const justTapped = (): boolean => Date.now() - tapped < 700;

interface Props {
  thread: EmailThread;
  /** A row pressed from the keyboard or an assistive tool. A touch or click is read by the card's own gesture. */
  onAnswer?: (qa: string) => void;
}

/** The card's answers: one row for each ready reply and one for your own. A tap opens the editor with that answer in it; nothing is sent. */
export function CardAnswers({ thread, onAnswer }: Props) {
  const desktop = useIsDesktop();
  const short = useShortWindow();
  const rows = answerRows(thread, short);
  return (
    <div className="answers">
      {rows.map((r) => (
        <button key={r.id} className={`answers__row${r.ready ? ' answers__row--ready' : ''}`} data-answer={r.id} onClick={() => !justTapped() && onAnswer?.(r.id)}>
          {r.ready ? <Reply className="answers__icon answers__icon--ready" size={18} strokeWidth={2.25} aria-hidden="true" /> : <PenLine className="answers__icon" size={18} strokeWidth={2} aria-hidden="true" />}
          <span className={`answers__label${r.ready ? ' answers__label--ready' : ''}`}>{r.label}</span>
          {desktop ? <kbd className="keycap answers__cap">{r.key}</kbd> : <ChevronRight className="answers__go" size={18} strokeWidth={2} aria-hidden="true" />}
        </button>
      ))}
    </div>
  );
}
