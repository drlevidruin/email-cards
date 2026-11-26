import { Ban, Check, Clock, ListChecks, Newspaper, Reply, type LucideIcon } from 'lucide-react';
import { useIsDesktop } from '../lib/useIsDesktop';
import './ActionBar.css';

/** Swipes and the directions a card can be dragged. */
export type Dir = 'left' | 'right' | 'up' | 'down';
export type BarAction = 'later' | 'todo' | 'reply' | 'done' | 'block' | 'newsletters' | 'allow';
/** `todo` is the To-do deck: the card is already on To-do, so no To-do button. */
export type BarVariant = 'default' | 'plain' | 'senders' | 'todo';

interface Item {
  action: BarAction;
  label: string;
  Icon: LucideIcon;
  primary?: boolean;
}

const BUTTONS: Record<BarVariant, Item[]> = {
  default: [
    { action: 'later', label: 'Later', Icon: Clock },
    { action: 'todo', label: 'To-do', Icon: ListChecks },
    { action: 'reply', label: 'Reply', Icon: Reply },
    { action: 'done', label: 'Done', Icon: Check, primary: true },
  ],
  plain: [
    { action: 'later', label: 'Later', Icon: Clock },
    { action: 'todo', label: 'To-do', Icon: ListChecks },
    { action: 'done', label: 'Done', Icon: Check, primary: true },
  ],
  todo: [
    { action: 'later', label: 'Later', Icon: Clock },
    { action: 'reply', label: 'Reply', Icon: Reply },
    { action: 'done', label: 'Done', Icon: Check, primary: true },
  ],
  senders: [
    { action: 'block', label: 'Block', Icon: Ban },
    { action: 'newsletters', label: 'Newsletters', Icon: Newspaper },
    { action: 'allow', label: 'Allow', Icon: Check, primary: true },
  ],
};

const BY_DIR: Record<BarVariant, Partial<Record<Dir, BarAction>>> = {
  default: { left: 'later', up: 'todo', right: 'done' },
  plain: { left: 'later', up: 'todo', right: 'done' },
  todo: { left: 'later', right: 'done' },
  senders: { left: 'block', up: 'newsletters', right: 'allow' },
};

/** The key that does each action. */
export const BAR_KEY: Record<BarAction, string> = { later: 'H', todo: 'T', reply: 'R', done: 'E', block: 'B', newsletters: 'N', allow: 'A' };

/** The actions a bar shows, in order. */
export function barActions(variant: BarVariant): BarAction[] {
  return BUTTONS[variant].map((b) => b.action);
}

/** The bar button a drag in this direction would commit. */
export function actionForDir(variant: BarVariant, dir: Dir): BarAction | undefined {
  return BY_DIR[variant][dir];
}

interface Props {
  variant: BarVariant;
  /** The direction a card is being dragged toward, if any. */
  active: Dir | null;
  /** The drag is past the commit point: the button fills in its action's color. */
  past?: boolean;
  onAction: (action: BarAction) => void;
  /** The email is already on To-do: the button says so, in the accent, and pressing it takes the email off. */
  todoOn?: boolean;
}

export function ActionBar({ variant, active, past, onAction, todoOn }: Props) {
  const lit = active ? BY_DIR[variant][active] : undefined;
  const desktop = useIsDesktop();
  return (
    <div className={`actionbar actionbar--${variant} no-select`}>
      {BUTTONS[variant].map(({ action, label: base, Icon, primary }) => {
        const on = action === 'todo' && !!todoOn;
        const label = on ? 'On To-do' : base;
        return (
        <button
          key={action}
          className={`actionbar__btn${on ? ' is-on' : ''}${primary ? ' actionbar__btn--primary' : ''}${action === 'block' ? ' actionbar__btn--danger' : ''}${lit === action ? (past ? ' is-active is-past' : ' is-active') : ''}`}
          onClick={() => onAction(action)}
        >
          <span className="actionbar__icon">
            <Icon size={22} strokeWidth={1.75} />
          </span>
          <span className="actionbar__label t-caption">
            {label}
            {desktop && <kbd className="keycap actionbar__cap">{BAR_KEY[action]}</kbd>}
          </span>
        </button>
        );
      })}
    </div>
  );
}
