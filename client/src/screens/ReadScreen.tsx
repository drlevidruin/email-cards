import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useStore } from '../store';
import { cameFrom, goBack, navigate, useRoute } from '../router';
import { placeName } from '../lib/placeName';
import { isStackId, type StackId } from '../lib/stacks';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar } from '../components/ActionBar';
import { Reader } from '../components/Reader';
import { PageShell } from '../components/PageShell';
import { ThreadView } from '../components/ThreadView';
import { useThreadActions } from '../components/useThreadActions';
import { useBarKeys } from '../components/useBarKeys';
import '../components/Reader.css';
import './ReadScreen.css';

/** Opened from a deck card: the reader slides up over that deck. */
function DeckRead({ threadId, stack, senderEmail }: { threadId: string; stack: StackId; senderEmail?: string }) {
  const { data, status } = useStore();
  const thread = data?.threads.find((t) => t.id === threadId);
  useEffect(() => {
    if (status === 'ready' && !thread) navigate(`/cards/${stack}`, { replace: true });
  }, [status, thread, stack]);
  return thread ? <Reader thread={thread} stack={stack} senderEmail={senderEmail} /> : null;
}

/** Opened from the To-do page: the reader slides up over that page, with no deck behind it. */
function TodoRead({ threadId }: { threadId: string }) {
  const { data, status } = useStore();
  const thread = data?.threads.find((t) => t.id === threadId);
  useEffect(() => {
    if (status === 'ready' && !thread) navigate('/goals', { replace: true });
  }, [status, thread]);
  const promise = data?.commitments.find((c) => c.threadId === threadId && c.direction === 'you_promised' && c.status !== 'resolved')?.promiseQuote;
  return thread ? <Reader thread={thread} stack={null} promise={promise} /> : null;
}

export function ReadScreen({ threadId }: { threadId: string }) {
  const { query } = useRoute();
  const from = query.get('from') ?? undefined;
  if (from === 'goals') return <TodoRead threadId={threadId} />;
  if (isStackId(from)) return <DeckRead threadId={threadId} stack={from} senderEmail={query.get('sender') ?? undefined} />;
  return <PlainRead threadId={threadId} />;
}

function PlainRead({ threadId }: { threadId: string }) {
  const store = useStore();
  const desktop = useIsDesktop();
  const thread = store.data?.threads.find((t) => t.id === threadId);
  const prev = useRef<boolean | undefined>(undefined);

  // Done or a sent reply archives the thread; leave the reader when that happens.
  // Only an open to archived change counts, so reloading on an archived email stays put.
  useEffect(() => {
    if (prev.current === false && thread?.isArchived) goBack();
    prev.current = thread?.isArchived;
  }, [thread?.isArchived]);

  // An address that matches no email goes to the cards.
  useEffect(() => {
    if (store.status === 'ready' && !thread) navigate('/cards/needs-you', { replace: true });
  }, [store.status, thread]);

  const { act, sheet, sheetOpen } = useThreadActions(thread, true);
  useBarKeys('default', act, sheetOpen);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetOpen) goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);
  if (!thread) return desktop ? null : <PageShell />;

  if (desktop) {
    return (
      <div className="reader reader--desk" role="dialog" aria-label="Email">
        <div className="reader__col">
          <header className="reader__top">
            <button className="reader__back t-callout" onClick={goBack}>
              <ChevronLeft size={22} strokeWidth={1.75} />
              {placeName(cameFrom() ?? '/cards/needs-you')}
            </button>
          </header>
          <div className="reader__actions">
            <ActionBar variant="default" active={null} onAction={act} todoOn={thread.isStarred} />
          </div>
          <div className="reader__scroll">
            <ThreadView threadId={thread.id} />
          </div>
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <PageShell
      footer={
        <div className="read__bar">
          <ActionBar variant="default" active={null} onAction={act} todoOn={thread.isStarred} />
        </div>
      }
    >
      <ThreadView threadId={thread.id} />
      {sheet}
    </PageShell>
  );
}
