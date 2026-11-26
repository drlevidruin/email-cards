import { ChevronDown, Paperclip } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { EmailMessage, EmailThread, GmailAccount } from '../lib/types';
import { findQuote } from '../lib/highlight';
import { cleanSubject, counterpart } from '../lib/stacks';
import { relativeTime } from '../lib/time';
import { formatBytes, formatClockTime } from '../lib/utils';
import { Avatar } from './Avatar';
import './ThreadView.css';
import './CardEmail.css';

interface Props {
  thread: EmailThread;
  /** The thread with its messages, or null while it loads. */
  full: EmailThread | null;
  desktop: boolean;
  account?: GmailAccount;
  /** The bookmark button, when the card has no band to carry it. */
  bookmark: ReactNode;
  headline: boolean;
  /** Skip the sender row (the card already shows who it is from). */
  hideSender?: boolean;
  /** Skip the Goal highlight (the card shows no Goal). */
  noHighlight?: boolean;
}

function Body({ text, quote }: { text: string; quote?: string | null }) {
  const at = findQuote(text, quote);
  if (!at) return <>{text}</>;
  return (
    <>
      {text.slice(0, at[0])}
      <mark className="card__evidence">{text.slice(at[0], at[1])}</mark>
      {text.slice(at[1])}
    </>
  );
}

/** The one part of the card that scrolls: who it is from, the subject and the whole email. */
export function CardEmail({ thread, full, desktop, account, bookmark, headline, hideSender, noHighlight }: Props) {
  const from = counterpart(thread);
  const [showEarlier, setShowEarlier] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  // Framer listens for pointerdown on the deck card. A mouse on a desktop-width screen selects text here, so the
  // card does not drag. A finger or a pen at any width still swipes the card.
  useEffect(() => {
    const el = box.current;
    if (!el || !desktop) return;
    const stop = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') e.stopPropagation();
    };
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [desktop]);

  const messages: EmailMessage[] = [...(full?.messages ?? [])].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime()
  );
  const newest = messages[messages.length - 1];
  const earlier = messages.slice(0, -1).reverse();

  return (
    <div className="cardmail" ref={box}>
      {!hideSender && (
      <div className="cardmail__sender">
        <Avatar name={from.name} small />
        <div className="cardmail__who">
          <div className="cardmail__name">{from.name}</div>
          <div className="cardmail__meta">
            {account && (
              <>
                <span className="cardmail__dot" style={{ background: account.color }} />
                <span>{account.label}</span>
              </>
            )}
            <span>{relativeTime(thread.lastMessageAt)}</span>
          </div>
        </div>
        {bookmark}
      </div>
      )}

      <h2 className={`cardmail__subject${headline ? ' cardmail__subject--headline' : ''}${hideSender ? ' cardmail__subject--first' : ''}`}>{cleanSubject(thread.subject)}</h2>

      {newest?.isOutbound && <div className="cardmail__wrote">You wrote {formatClockTime(newest.sentAt)}</div>}
      <div className="cardmail__body">
        <Body text={newest ? newest.bodyText : thread.snippet} quote={newest && !noHighlight ? thread.goalQuote : null} />
      </div>

      {newest && newest.attachments.length > 0 && (
        <ul className="tv__files">
          {newest.attachments.map((a) => (
            <li key={a.id} className="tv__file">
              <Paperclip size={18} strokeWidth={2} />
              <span className="tv__file-name">{a.filename}</span>
              <span className="tv__file-size">{formatBytes(a.sizeBytes)}</span>
            </li>
          ))}
        </ul>
      )}

      {earlier.length > 0 && (
        <>
          <button className="cardmail__more" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)}>
            <span>{showEarlier ? 'Hide earlier messages' : `${earlier.length} earlier ${earlier.length === 1 ? 'message' : 'messages'}`}</span>
            <ChevronDown size={18} strokeWidth={2} className={showEarlier ? 'is-open' : ''} />
          </button>
          {showEarlier &&
            earlier.map((m) => (
              <section key={m.id} className="cardmail__earlier">
                <div className="cardmail__earlier-head">
                  {m.isOutbound ? 'You' : m.fromName} · {formatClockTime(m.sentAt)}
                </div>
                <div className="cardmail__earlier-body">{m.bodyText}</div>
              </section>
            ))}
        </>
      )}
    </div>
  );
}
