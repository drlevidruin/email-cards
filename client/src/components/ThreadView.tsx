import { useEffect, useState } from 'react';
import { Paperclip } from 'lucide-react';
import type { EmailMessage, EmailThread } from '../lib/types';
import { findQuote } from '../lib/highlight';
import { loadThread } from '../lib/threadCache';
import { formatBytes, formatClockTime } from '../lib/utils';
import { isSampleInbox } from '../lib/sample';
import './ThreadView.css';

interface Props {
  threadId: string;
  hideSubject?: boolean;
  /** The Goal's source sentence; marked in the newest message. */
  quote?: string | null;
  /** A promise sentence: opens and marks the user's sent message that holds it. */
  promise?: string | null;
}

function Marked({ text, quote }: { text: string; quote?: string | null }) {
  const at = findQuote(text, quote);
  if (!at) return <>{text}</>;
  return (
    <>
      {text.slice(0, at[0])}
      <mark className="tv__mark">{text.slice(at[0], at[1])}</mark>
      {text.slice(at[1])}
    </>
  );
}

export function ThreadView({ threadId, hideSubject, quote, promise }: Props) {
  const [thread, setThread] = useState<EmailThread | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    let live = true;
    setThread(null);
    setFailed(false);
    setOpen(new Set());
    loadThread(threadId).then(
      (t) => live && setThread(t),
      () => live && setFailed(true)
    );
    return () => {
      live = false;
    };
  }, [threadId]);

  if (failed) return <p className="tv__error">Mail did not load</p>;
  if (!thread) return <div className="tv" />;

  const messages: EmailMessage[] = [...(thread.messages ?? [])].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );

  const promiseAt = promise
    ? messages.findIndex((m) => m.isOutbound && findQuote(m.bodyText, promise))
    : -1;

  return (
    <div className="tv">
      {!hideSubject && <h2 className="tv__subject">{thread.subject}</h2>}
      {messages.length === 0 && <p className="tv__body">{thread.snippet}</p>}
      {messages.map((m, i) => {
        const expanded = i === messages.length - 1 || i === promiseAt || open.has(m.id);
        if (!expanded) {
          return (
            <button
              key={m.id}
              className="tv__collapsed"
              onClick={() => setOpen((s) => new Set(s).add(m.id))}
            >
              <span className="tv__collapsed-head">
                <span className="tv__collapsed-name">{m.fromName}</span>
                <span className="tv__time">{formatClockTime(m.sentAt)}</span>
              </span>
              <span className="tv__snippet">{m.snippet}</span>
            </button>
          );
        }
        return (
          <section key={m.id} className="tv__message">
            <div className="tv__head">
              <span className="tv__name">{m.fromName}</span>
              <span className="tv__time">{formatClockTime(m.sentAt)}</span>
            </div>
            <div className="tv__to">to {m.toEmails.join(', ')}</div>
            <div className="tv__body">
              <Marked text={m.bodyText} quote={i === promiseAt ? promise : i === messages.length - 1 && promiseAt < 0 ? quote : null} />
            </div>
            {m.attachments.length > 0 && (
              <ul className="tv__files">
                {m.attachments.map((a) => (
                  <li key={a.id} className="tv__file">
                    <Paperclip size={18} strokeWidth={1.75} />
                    <span className="tv__file-name">{a.filename}</span>
                    <span className="tv__file-size">{formatBytes(a.sizeBytes)}</span>
                  </li>
                ))}
              </ul>
            )}
            {m.attachments.length > 0 && isSampleInbox() && <p className="t-footnote tv__sample">Sample inbox. There is no real file to open.</p>}
          </section>
        );
      })}
    </div>
  );
}
