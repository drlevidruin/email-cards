import type { ReactNode } from 'react';
import type { EmailThread, GmailAccount } from '../lib/types';
import { useThread } from '../lib/useThread';
import { BookmarkButton } from './BookmarkButton';
import { CardBand, hasBand } from './CardBand';
import { CardEmail } from './CardEmail';
import { ReplyTray } from './ReplyTray';
import './Card.css';

interface Props {
  thread: EmailThread;
  desktop: boolean;
  /** Show the account label under the sender name. */
  account?: GmailAccount;
  overlay?: ReactNode;
  /** Hide the built-in replies, for stacks and screens that do not reply from the card. */
  noReplies?: boolean;
  /** The card sits in a deck, so a sent reply flies it off that deck. */
  fromDeck?: boolean;
  /** Called by the Bookmark toggle. Without it the toggle is not shown. */
  onBookmark?: (thread: EmailThread) => void;
}

export function EmailCard({ thread, desktop, account, overlay, noReplies, fromDeck, onBookmark }: Props) {
  const full = useThread(thread.id);
  const banded = hasBand(thread);
  const bookmark = onBookmark ? <BookmarkButton on={thread.isStarred} onToggle={() => onBookmark(thread)} /> : null;
  return (
    <article className="card">
      {banded && <CardBand thread={thread} bookmark={bookmark} />}
      <CardEmail
        key={thread.id}
        thread={thread}
        full={full}
        desktop={desktop}
        account={account}
        bookmark={banded ? null : bookmark}
        headline={!banded}
      />
      {!noReplies && <ReplyTray thread={thread} fromDeck={fromDeck} />}
      {overlay}
    </article>
  );
}
