import { navigate } from '../router';
import type { EmailThread } from '../lib/types';
import { replyActions } from '../lib/stacks';
import './ReplyTray.css';

/** The built-in replies under the email. A grid on a phone, wrapping pills on a desktop. Never scrolls sideways. */
export function ReplyTray({ thread, fromDeck }: { thread: EmailThread; fromDeck?: boolean }) {
  const replies = replyActions(thread);
  if (replies.length === 0) return null;
  return (
    <div className="tray">
      {replies.map((r) => (
        <button key={r.id} className="tray__pill" onClick={() => navigate(`/reply/${thread.id}?qa=${r.id}${fromDeck ? '&from=deck' : ''}`)}>
          <span className="tray__label">{r.label}</span>
        </button>
      ))}
    </div>
  );
}
