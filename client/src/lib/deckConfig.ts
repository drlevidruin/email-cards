import type { BarVariant, Dir } from '../components/ActionBar';
import type { BadgeLabels } from '../components/SwipeBadge';
import type { StackId } from './stacks';

export interface DeckConfig {
  isSender: boolean;
  /** Newsletters and Receipts: no answers, so Done is the primary action. */
  noReplies: boolean;
  onTodo: boolean;
  variant: BarVariant;
  /** Directions that do something. */
  enabled: Dir[];
  /** Directions that fly the card out. The others hold it for a sheet. */
  flyDirs: Dir[];
  /** The stamp for each direction. */
  labels: BadgeLabels;
  /** Thread cards in this deck show answer rows. */
  answers: boolean;
}

/** What a deck offers: its bar, its moves, its stamps and whether its cards carry answers. */
export function deckConfig(stack: StackId): DeckConfig {
  const isSender = stack === 'new-senders';
  const noReplies = stack === 'newsletters' || stack === 'receipts';
  const onTodo = stack === 'bookmarked';
  // On the To-do deck the card is already on To-do, so up does nothing
  const enabled: Dir[] = onTodo ? ['left', 'right', 'down'] : ['left', 'right', 'up', 'down'];
  const labels: BadgeLabels = isSender
    ? { right: 'Allow', left: 'Block', up: 'Newsletters', down: 'Skip' }
    : onTodo
      ? { right: 'Done', left: 'Later', down: 'Skip' }
      : { right: 'Done', left: 'Later', up: 'To-do', down: 'Skip' };
  return {
    isSender,
    noReplies,
    onTodo,
    variant: isSender ? 'senders' : noReplies ? 'plain' : onTodo ? 'todo' : 'default',
    enabled,
    // Done, To-do, Skip and the sender moves fly the card out. Later opens its sheet first and the card waits.
    flyDirs: isSender ? enabled : ['right', 'up', 'down'],
    labels,
    answers: !isSender && !noReplies,
  };
}
