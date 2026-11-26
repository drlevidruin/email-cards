import type { BootstrapPayload, EmailThread, ScreenerSender } from './lib/types';

export type CountKey = 'replied' | 'done' | 'later' | 'bookmarked' | 'blocked' | 'allowed' | 'moved';

export interface Session {
  dismissed: Set<string>;
  counts: Record<CountKey, number>;
  coverPending: boolean | null;
  /** The Today card has been dealt with this session (Start was pressed). */
  todayDone: boolean;
}

export interface Toast {
  id: number;
  text: string;
  undoable: boolean;
}

export interface Exiting {
  thread: EmailThread;
}

export type Data = Omit<BootstrapPayload, 'rules' | 'customViews' | 'briefing'>;

export interface Snap {
  threads: EmailThread[];
  screener: ScreenerSender[];
}

export interface UndoEntry {
  sessionKey: string;
  ids: string[];
  count: CountKey;
  n: number;
  run: () => Promise<unknown>;
}
