import { ArrowRight } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import type { EmailThread, GmailAccount } from '../lib/types';
import { cleanSubject, counterpart, replyActions } from '../lib/stacks';
import { dueText, isHot, relativeTime } from '../lib/time';
import { formatCurrency } from '../lib/utils';
import { navigate } from '../router';
import { Avatar } from './Avatar';
import { ThreadView } from './ThreadView';
import './Card.css';

interface Props {
  thread: EmailThread;
  desktop: boolean;
  /** Show the account label under the sender name instead of the email. */
  account?: GmailAccount;
  overlay?: ReactNode;
  /** Hide the built-in replies, for screens that act on this thread elsewhere. */
  noReplies?: boolean;
  /** The card sits in a deck, so a sent reply flies it off that deck. */
  fromDeck?: boolean;
}

export function EmailCard({ thread, desktop, account, overlay, noReplies, fromDeck }: Props) {
  const from = counterpart(thread);
  const replies = noReplies ? [] : replyActions(thread).slice(0, desktop ? 3 : 2);
  const hot = isHot(thread.deadlineLabel);
  const pane = useRef<HTMLDivElement>(null);
  // Framer listens for pointerdown on the deck card itself; stopping it here lets text in the pane be selected.
  useEffect(() => {
    const el = pane.current;
    if (!el) return;
    const stop = (e: Event) => e.stopPropagation();
    el.addEventListener('pointerdown', stop);
    return () => el.removeEventListener('pointerdown', stop);
  }, [desktop]);
  const bullets = thread.aiSummaryBullets.slice(0, 2);
  const ri = thread.receiptInfo;

  return (
    <article className="card">
      <div
        className={`card__main${desktop ? '' : ' card__main--tap'}`}
        onClick={desktop ? undefined : (e) => {
          if (!(e.target as HTMLElement).closest('button')) navigate(`/read/${thread.id}`);
        }}
      >
        <div className="card__sender">
          <Avatar name={from.name} />
          <div className="card__sender-text">
            <div className="card__name">{from.name}</div>
            <div className="card__meta">
              {account ? (
                <>
                  <span className="card__dot" style={{ background: account.color }} />
                  <span>{account.label}</span>
                </>
              ) : (
                <span>{from.email}</span>
              )}
            </div>
          </div>
          <span className="card__time">{relativeTime(thread.lastMessageAt)}</span>
        </div>

        <h2 className={`card__subject${thread.distilledAsk ? ' card__subject--quiet' : ''}`}>{cleanSubject(thread.subject)}</h2>

        {thread.distilledAsk ? (
          <div className="card__goal">
            <div className="card__goal-label">Goal</div>
            <p className="card__goal-text">{thread.distilledAsk}</p>
            {thread.deadlineLabel && (
              <div className={`card__deadline${hot ? ' card__deadline--hot' : ''}`}>{dueText(thread.deadlineLabel)}</div>
            )}
          </div>
        ) : (
          ri && (
            <div className="card__receipt">
              <div className="card__amount">{formatCurrency(ri.amount, ri.currency)}</div>
              <div className="card__receipt-line">
                {[ri.vendor, ri.category, ri.invoiceNumber].filter(Boolean).join(' · ')}
              </div>
            </div>
          )
        )}

        <div className="card__summary">
          {bullets.length > 0 ? bullets.map((b) => <p key={b}>{b}</p>) : <p>{thread.snippet}</p>}
        </div>
        {!desktop && (
          <button className="card__read" onClick={() => navigate(`/read/${thread.id}`)}>
            {thread.messageCount > 1 ? `Read all ${thread.messageCount} messages` : 'Read email'}
          </button>
        )}

        {replies.length > 0 && (
          <div className="card__replies">
            {replies.map((r) => (
              <button key={r.id} className="card__reply" onClick={() => navigate(`/reply/${thread.id}?qa=${r.id}${fromDeck ? '&from=deck' : ''}`)}>
                <span>{r.label}</span>
                <ArrowRight size={18} strokeWidth={2} />
              </button>
            ))}
          </div>
        )}
      </div>
      {desktop && (
        <div className="card__pane" ref={pane}>
          <ThreadView threadId={thread.id} hideSubject />
        </div>
      )}
      {overlay}
    </article>
  );
}
