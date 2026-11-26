import { useState, type ReactNode } from 'react';
import { goBack, navigate } from '../router';
import { buildStack } from '../lib/stacks';
import { describeWake, type LaterOption } from '../lib/time';
import type { EmailThread } from '../lib/types';
import { useStore } from '../store';
import type { BarAction } from './ActionBar';
import { LaterSheet } from './LaterSheet';

/** Only an email that is in the last deck counts toward that deck's progress. */
export function useInDeck(thread: EmailThread | undefined): boolean {
  const store = useStore();
  const { data, account, lastStack } = store;
  return (
    !!thread &&
    !!data &&
    !store.session(lastStack).dismissed.has(thread.id) &&
    buildStack(lastStack, data.threads, data.screener, account).some((i) => i.id === thread.id)
  );
}

/** The card actions for one open email (Read screen, All mail). */
export function useThreadActions(thread: EmailThread | undefined, leaveAfterMove: boolean): { act: (slot: BarAction) => void; toggleBookmark: () => void; sheet: ReactNode; sheetOpen: boolean } {
  const store = useStore();
  const [later, setLater] = useState(false);
  const { lastStack } = store;
  const inDeck = useInDeck(thread);
  const stack = inDeck ? lastStack : null;

  const toggleBookmark = () => {
    if (!thread) return;
    void store.bookmark(thread, stack, !thread.isStarred);
    if (leaveAfterMove) goBack();
  };

  const act = (slot: BarAction) => {
    if (!thread) return;
    if (slot === 'right') void store.done(thread, stack);
    else if (slot === 'left') setLater(true);
    else navigate(`/reply/${thread.id}?from=read`);
  };

  const pick = (o: LaterOption) => {
    setLater(false);
    if (!thread) return;
    void store.later(thread, stack, o.at, describeWake(o.at));
    if (leaveAfterMove) goBack();
  };

  return { act, toggleBookmark, sheetOpen: later, sheet: later ? <LaterSheet onPick={pick} onClose={() => setLater(false)} /> : null };
}
