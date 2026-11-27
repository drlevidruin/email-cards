import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, ListChecks, type LucideIcon } from 'lucide-react';
import { useIsDesktop } from '../lib/useIsDesktop';
import './ActionBar.css';

/** Swipes and the directions a card can be dragged. */
export type Dir = 'left' | 'right' | 'up' | 'down';
export type BarAction = 'later' | 'todo' | 'skip' | 'reply' | 'done' | 'block' | 'newsletters' | 'allow';
/** `todo` is the To-do deck: the card is already on To-do, so no To-do button. */
export type BarVariant = 'default' | 'plain' | 'senders' | 'todo';

interface Item {
  action: BarAction;
  label: string;
  /** The arrow that shows the direction this move goes. */
  dir?: Dir;
  primary?: boolean;
}

const ARROWS: Record<Dir, LucideIcon> = { left: ArrowLeft, up: ArrowUp, down: ArrowDown, right: ArrowRight };

const LATER: Item = { action: 'later', label: 'Later', dir: 'left' };
const TODO: Item = { action: 'todo', label: 'To-do', dir: 'up' };
const SKIP: Item = { action: 'skip', label: 'Skip', dir: 'down' };
const DONE: Item = { action: 'done', label: 'Done', dir: 'right', primary: true };

/** The deck's bar: the four moves, each drawn as the direction it goes. */
const DECK: Record<BarVariant, Item[]> = {
  default: [LATER, TODO, SKIP, DONE],
  plain: [LATER, TODO, SKIP, DONE],
  todo: [LATER, SKIP, DONE],
  senders: [
    { action: 'block', label: 'Block', dir: 'left' },
    { action: 'newsletters', label: 'Newsletter', dir: 'up' },
    SKIP,
    { action: 'allow', label: 'Allow', dir: 'right', primary: true },
  ],
};

/** The reader's bar: words only, Reply stays here. */
const READER: Record<BarVariant, Item[]> = {
  default: [{ action: 'later', label: 'Later' }, { action: 'todo', label: 'To-do' }, { action: 'reply', label: 'Reply' }, { action: 'done', label: 'Done', primary: true }],
  plain: [{ action: 'later', label: 'Later' }, { action: 'todo', label: 'To-do' }, { action: 'done', label: 'Done', primary: true }],
  todo: [{ action: 'later', label: 'Later' }, { action: 'reply', label: 'Reply' }, { action: 'done', label: 'Done', primary: true }],
  senders: [{ action: 'block', label: 'Block' }, { action: 'newsletters', label: 'Newsletter' }, { action: 'allow', label: 'Allow', primary: true }],
};

const BY_DIR: Record<BarVariant, Partial<Record<Dir, BarAction>>> = {
  default: { left: 'later', up: 'todo', down: 'skip', right: 'done' },
  plain: { left: 'later', up: 'todo', down: 'skip', right: 'done' },
  todo: { left: 'later', down: 'skip', right: 'done' },
  senders: { left: 'block', up: 'newsletters', down: 'skip', right: 'allow' },
};

/** The key that does each action. */
export const BAR_KEY: Record<BarAction, string> = { later: 'H', todo: 'T', skip: 'J', reply: 'R', done: 'E', block: 'B', newsletters: 'N', allow: 'A' };

/** The actions the reader's bar shows, in order. */
export function barActions(variant: BarVariant): BarAction[] {
  return READER[variant].map((b) => b.action);
}

/** The bar button a drag in this direction would commit. */
export function actionForDir(variant: BarVariant, dir: Dir): BarAction | undefined {
  return BY_DIR[variant][dir];
}

interface Props {
  variant: BarVariant;
  /** The direction a card is being dragged toward, if any. */
  active: Dir | null;
  /** The drag is past the commit point: the button deepens. */
  past?: boolean;
  onAction: (action: BarAction) => void;
  /** The email is already on To-do: the button says so and pressing it takes the email off. */
  todoOn?: boolean;
  /** The reader's bar: words only, with Reply. */
  reader?: boolean;
  /** The card shows answer rows, so the answers are the primary action and Done is ink. */
  answers?: boolean;
}

export function ActionBar({ variant, active, past, onAction, todoOn, reader, answers }: Props) {
  const lit = active ? BY_DIR[variant][active] : undefined;
  const desktop = useIsDesktop();
  return (
    <div className={`actionbar actionbar--${variant} no-select`}>
      {(reader ? READER : DECK)[variant].map(({ action, label, dir, primary }) => {
        const on = action === 'todo' && !!todoOn;
        const accent = !!primary && (reader || variant === 'senders' || !answers);
        const Arrow = dir ? ARROWS[dir] : null;
        const key = desktop && (reader || action !== 'reply') ? BAR_KEY[action] : null;
        return (
          <button
            key={action}
            className={`actionbar__btn${on ? ' is-on' : ''}${accent ? ' actionbar__btn--primary' : ''}${lit === action ? (past ? ' is-active is-past' : ' is-active') : ''}`}
            aria-pressed={action === 'todo' && reader ? on : undefined}
            aria-label={on ? 'On To-do' : undefined}
            onClick={() => onAction(action)}
          >
            {dir !== 'right' && Arrow && <Arrow className="actionbar__arrow" size={18} strokeWidth={2} aria-hidden="true" />}
            <span className="actionbar__label t-callout">
              {on && reader ? <ListChecks size={18} strokeWidth={2} aria-hidden="true" /> : null}
              {label}
              {key && <kbd className="keycap actionbar__cap">{key}</kbd>}
            </span>
            {dir === 'right' && Arrow && <Arrow className="actionbar__arrow" size={18} strokeWidth={2} aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
