import { applySkips, buildStack, type DeckItem, type StackId } from './stacks';
import { useStore } from '../store';

/** The cards of a stack in deck order, the same as the deck shows them (skips and handled cards applied). */
export function useDeckItems(stack: StackId): { items: DeckItem[]; todayShowing: boolean } {
  const store = useStore();
  const { data, account, status } = store;
  const session = store.session(stack);
  const items = data ? applySkips(buildStack(stack, data, account).filter((i) => !session.dismissed.has(i.id)), session.skipped) : [];
  const todayShowing = status === 'ready' && stack === 'needs-you' && !session.todayDone && items.length > 0;
  return { items, todayShowing };
}
