import type { BootstrapPayload, CommitmentItem, EmailThread, ScreenerSender } from './lib/types';

export type CountKey = 'replied' | 'done' | 'later' | 'bookmarked' | 'blocked' | 'allowed' | 'moved';

export interface Session {
  dismissed: Set<string>;
  /** Cards sent to the back of this stack, in the order they were skipped. */
  skipped: string[];
  counts: Record<CountKey, number>;
  coverPending: boolean | null;
  /** The Today card has been dealt with this session (Start was pressed). */
  todayDone: boolean;
}

export interface Toast {
  id: number;
  text: string;
  undoable: boolean;
  /** Stays up with no timer until a new message, Undo, or leaving the screen. */
  sticky?: boolean;
}

/** How long an ordinary message stays up. The timer and the Undo time line both read this. */
export const TOAST_MS = 6000;

export interface Exiting {
  thread: EmailThread;
}

export type Data = Omit<BootstrapPayload, 'rules' | 'customViews' | 'briefing'>;

export interface Snap {
  threads: EmailThread[];
  screener: ScreenerSender[];
  commitments: CommitmentItem[];
}

export interface UndoEntry {
  sessionKey: string;
  ids: string[];
  count: CountKey;
  n: number;
  run: () => Promise<unknown>;
}
