import { useEffect, useRef } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useStore } from '../store';
import { goBack, navigate } from '../router';
import { useIsDesktop } from '../lib/useIsDesktop';
import { ActionBar } from '../components/ActionBar';
import { BookmarkButton } from '../components/BookmarkButton';
import { EmailCard } from '../components/EmailCard';
import { PageShell } from '../components/PageShell';
import { ThreadView } from '../components/ThreadView';
import { useThreadActions } from '../components/useThreadActions';
import { TopBar } from '../components/TopBar';
import './CardsScreen.css';
import './ReadScreen.css';

export function ReadScreen({ threadId }: { threadId: string }) {
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

  const { act, toggleBookmark, sheet, sheetOpen } = useThreadActions(thread, true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !sheetOpen) goBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sheetOpen]);
  if (!thread) return desktop ? null : <PageShell />;

  if (desktop) {
    const multi = (store.data?.accounts.length ?? 0) > 1 && store.account === 'all';
    return (
      <div className="cards">
        <div className="cards__col">
          <TopBar
            left={
              <button className="icon-btn" aria-label="Back" onClick={goBack}>
                <ArrowLeft size={22} strokeWidth={2} />
              </button>
            }
          />
          <div className="cards__deck">
            <EmailCard
              thread={thread}
              desktop
              account={multi ? store.data?.accounts.find((a) => a.id === thread.accountId) : undefined}
              noReplies
              onBookmark={toggleBookmark}
            />
          </div>
          <ActionBar variant="default" active={null} onAction={act} plainLabels />
        </div>
        {sheet}
      </div>
    );
  }

  return (
    <PageShell
      footer={
        <div className="read__bar">
          <ActionBar variant="default" active={null} onAction={act} plainLabels />
        </div>
      }
    >
      <div className="read__tools">
        <BookmarkButton on={thread.isStarred} onToggle={toggleBookmark} />
      </div>
      <ThreadView threadId={thread.id} />
      {sheet}
    </PageShell>
  );
}
