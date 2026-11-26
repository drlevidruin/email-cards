import { ChevronLeft } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { goBack, navigate } from '../router';
import { counterpart, stackLabel, type StackId } from '../lib/stacks';
import { describeWake, relativeTime, type LaterOption } from '../lib/time';
import type { EmailThread } from '../lib/types';
import { useStore } from '../store';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar, type BarAction, type BarVariant } from './ActionBar';
import { useBarKeys } from './useBarKeys';
import { CardHeader } from './CardHeader';
import { Hero, SenderHero, heroKind } from './Hero';
import { LaterSheet } from './LaterSheet';
import { ThreadView } from './ThreadView';
import { cleanSubject } from '../lib/stacks';
import './Reader.css';

interface Props {
  thread: EmailThread;
  /** The deck it was opened from, or null when it was opened from the To-do page. */
  stack: StackId | null;
  /** The new sender being read, when the deck card was a sender. */
  senderEmail?: string;
}

/** The whole email, opened from a deck card. It slides up over the deck; an action here leaves with that card gone. */
export function Reader({ thread, stack, senderEmail }: Props) {
  const store = useStore();
  const desktop = useIsDesktop();
  const [later, setLater] = useState(false);
  const [leaving, setLeaving] = useState(false);
  // Set at once, so two presses in the same tick still count as one
  const left = useRef(false);
  const sender = senderEmail ? store.data?.screener.find((s) => s.email === senderEmail) : undefined;
  const multi = (store.data?.accounts.length ?? 0) > 1 && store.account === 'all';
  const account = multi ? store.data?.accounts.find((a) => a.id === (sender?.accountId ?? thread.accountId)) : undefined;
  const noReplies = stack === 'newsletters' || stack === 'receipts';
  const onTodo = stack === null || stack === 'bookmarked';
  const variant: BarVariant = sender ? 'senders' : noReplies ? 'plain' : onTodo ? 'todo' : 'default';
  const kind = heroKind(thread, onTodo);

  const close = () => {
    if (left.current) return;
    left.current = true;
    setLeaving(true);
    window.setTimeout(goBack, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 220);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !later) close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const onAction = (a: BarAction) => {
    if (left.current) return;
    if (sender) {
      void store.decide(sender, stack ?? 'needs-you', a === 'block' ? 'muted' : a === 'newsletters' ? 'feed' : 'approved');
      return close();
    }
    if (a === 'later') setLater(true);
    else if (a === 'reply') navigate(`/reply/${thread.id}?from=read`);
    else {
      if (a === 'done') void store.done(thread, stack);
      else void store.bookmark(thread, stack, true);
      close();
    }
  };

  useBarKeys(variant, onAction);

  const pick = (o: LaterOption) => {
    if (left.current) return;
    setLater(false);
    void store.later(thread, stack, o.at, describeWake(o.at));
    close();
  };

  return (
    <div className={`reader${desktop ? ' reader--desk' : ''}${leaving ? ' is-leaving' : ''}`} role="dialog" aria-label="Email">
      <div className="reader__col">
        <header className="reader__top">
          <button className="reader__back t-callout" onClick={close}>
            <ChevronLeft size={22} strokeWidth={1.75} />
            {stack ? stackLabel(stack) : 'To-do'}
          </button>
        </header>
        {desktop && (
          <div className="reader__actions">
            <ActionBar variant={variant} active={null} onAction={onAction} />
          </div>
        )}
        <div className="reader__scroll">
          <CardHeader name={sender ? sender.name : counterpart(thread).name} account={account} age={sender ? undefined : relativeTime(thread.lastMessageAt)} due={sender ? null : thread.deadlineLabel} />
          {sender ? <SenderHero sender={sender} /> : <Hero thread={thread} goalFirst={onTodo} />}
          <hr className="reader__rule" />
          {(sender || kind !== 'subject') && <h2 className="reader__subject t-headline">{cleanSubject(thread.subject)}</h2>}
          <ThreadView threadId={thread.id} hideSubject quote={sender || kind !== 'goal' ? null : thread.goalQuote} />
        </div>
        {!desktop && <ActionBar variant={variant} active={null} onAction={onAction} />}
      </div>
      {later && <LaterSheet onPick={pick} onClose={() => setLater(false)} />}
    </div>
  );
}
