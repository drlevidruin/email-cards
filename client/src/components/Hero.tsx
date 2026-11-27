import type { EmailThread, ScreenerSender } from '../lib/types';
import { formatCurrency } from '../lib/utils';
import { cleanSubject } from '../lib/stacks';
import { dueText, isHot } from '../lib/time';
import './Hero.css';

/** The deadline in words, in the footnote size: emerald, red when due today or overdue, grey for Waiting. Nothing without a deadline. */
export function DueLine({ label, className }: { label?: string | null; className?: string }) {
  if (!label) return null;
  const tone = isHot(label) ? ' dueline--hot' : /^waiting/i.test(label) ? ' dueline--quiet' : '';
  return <div className={`dueline t-footnote${tone}${className ? ` ${className}` : ''}`}>{dueText(label)}</div>;
}

/** What a card is about, in the largest type: the Goal, the amount on a receipt, or the subject. */
export function heroKind(thread: EmailThread, goalFirst = false): 'receipt' | 'goal' | 'subject' {
  // On the To-do deck a thread's Goal is why it is there, even when it is also a receipt
  if (thread.receiptInfo && !(goalFirst && thread.distilledAsk)) return 'receipt';
  return thread.distilledAsk ? 'goal' : 'subject';
}

export function Hero({ thread, goalFirst }: { thread: EmailThread; goalFirst?: boolean }) {
  const kind = heroKind(thread, goalFirst);
  const ri = thread.receiptInfo;
  if (kind === 'receipt' && ri) {
    return (
      <div className="hero">
        <DueLine label={thread.deadlineLabel} />
        <div className="hero__label t-caption hero__label--quiet">{ri.category}</div>
        <p className="hero__text t-title t-num">{formatCurrency(ri.amount, ri.currency)}</p>
      </div>
    );
  }
  if (kind === 'goal') {
    return (
      <div className="hero">
        <DueLine label={thread.deadlineLabel} />
        <p className="hero__text t-title voice">{thread.distilledAsk}</p>
      </div>
    );
  }
  return (
    <div className="hero">
      <DueLine label={thread.deadlineLabel} />
      <p className="hero__text t-title">{cleanSubject(thread.subject)}</p>
    </div>
  );
}

/** The hero of a new-sender card: the question the card asks, then the address and why it is new. */
export function SenderHero({ sender }: { sender: ScreenerSender }) {
  const who = sender.name && sender.name !== sender.email ? sender.name : 'this sender';
  return (
    <div className="hero">
      <div className="hero__label hero__label--quiet t-caption">New sender</div>
      <p className="hero__text t-title voice">Allow {who}?</p>
      <p className="hero__addr t-subhead">{sender.email}</p>
      <p className="hero__reason t-subhead">{sender.aiReason}</p>
    </div>
  );
}
