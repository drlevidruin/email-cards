import { useEffect } from 'react';
import { useStore } from '../store';
import { useRoute, goBack } from '../router';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useVisualViewport } from '../lib/useViewport';
import { ReplyComposer } from '../components/ReplyComposer';
import { ThreadView } from '../components/ThreadView';
import './ReplyScreen.css';

export function ReplyScreen({ threadId }: { threadId: string }) {
  const { data, status, dismissToast } = useStore();
  const route = useRoute();
  const desktop = useIsDesktop();
  const vh = useVisualViewport();

  // A toast left over from the deck would cover the Claude field.
  useEffect(() => dismissToast(), [dismissToast]);

  const thread = data?.threads.find((t) => t.id === threadId);
  useEffect(() => {
    if (status === 'ready' && !thread) goBack();
  }, [status, thread]);
  if (!thread) return <div className="reply" />;

  // With the keyboard open the home-indicator inset is covered, so the composer drops it.
  const keyboard = !!vh && window.innerHeight - vh.h > 100;
  const composer = <ReplyComposer key={thread.id} thread={thread} qa={route.query.get('qa') ?? undefined} draftId={route.query.get('draft') ?? undefined} desktop={desktop} fromDeck={route.query.get('from') === 'deck'} fromRead={route.query.get('from') === 'read'} fresh={route.query.get('fresh') === '1'} direct={route.query.get('direct') === '1'} own={route.query.get('own') === '1'} />;
  if (!desktop) {
    return (
      <div className={`reply reply--phone${keyboard ? ' reply--kb' : ''}`} style={vh ? { height: vh.h, top: vh.top } : undefined}>
        {composer}
      </div>
    );
  }
  return (
    <div className="reply reply--desk">
      <div className="reply__card">
        <div className="reply__left">{composer}</div>
        <div className="reply__right">
          <ThreadView threadId={thread.id} />
        </div>
      </div>
    </div>
  );
}
