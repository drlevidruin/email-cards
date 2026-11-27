import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, type LucideIcon } from 'lucide-react';
import type { Taught } from '../lib/onboarding';
import './CardPointer.css';

const ICONS: Partial<Record<Taught, LucideIcon>> = { right: ArrowRight, left: ArrowLeft, up: ArrowUp, down: ArrowDown, 's-right': ArrowRight, 's-left': ArrowLeft, 's-up': ArrowUp };

/** What each move does, said after the way to do it. */
const RESULT: Record<string, { button: string; says: string }> = {
  right: { button: 'Done', says: 'it leaves your inbox.' },
  left: { button: 'Later', says: 'you pick when it comes back.' },
  up: { button: 'To-do', says: 'it waits on your To-do list.' },
  down: { button: 'Skip', says: 'it goes to the back of the pile.' },
  's-right': { button: 'Allow', says: 'their emails go to Needs you.' },
  's-left': { button: 'Block', says: "you won't see their emails again." },
  's-up': { button: 'Newsletter', says: 'their emails go to Newsletters.' },
};

/** What the pointer says. */
export function pointerText(move: Taught, desktop: boolean): string {
  if (move === 'answer') return `${desktop ? 'Click an answer or press 1' : 'Tap an answer'}. You see the reply before anything is sent.`;
  if (move === 'open') return desktop ? 'Click the card, or press Enter, to read the whole email.' : 'Tap the card to read the whole email.';
  const r = RESULT[move];
  const dir = move.replace('s-', '');
  return `${desktop ? `Press the ${dir} arrow or click` : `Swipe ${dir} or tap`} ${r.button}: ${r.says}`;
}

/** One short line between the card and the action bar, for the first cards only: it says what to do and what happens. */
export function CardPointer({ move, desktop }: { move: Taught; desktop: boolean }) {
  const Icon = ICONS[move];
  const text = pointerText(move, desktop);
  // A button's name never breaks across two lines
  const word = RESULT[move]?.button;
  const at = word ? text.indexOf(word) : -1;
  return (
    <p className="pointer voice" key={move}>
      <span className="pointer__text">
        {Icon && <Icon className="pointer__icon" size={16} strokeWidth={1.75} aria-hidden="true" />}
        {at < 0 ? (
          text
        ) : (
          <>
            {text.slice(0, at)}
            <span className="pointer__word">{word}</span>
            {text.slice(at + word.length)}
          </>
        )}
      </span>
    </p>
  );
}
