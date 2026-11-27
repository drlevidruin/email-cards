import { isStaticDemoMode } from './api';
import { isSnapshot } from './snapshot';

/** The public sample inbox: the static demo, and not a private snapshot of someone's real mail. */
export const isSampleInbox = (): boolean => isStaticDemoMode() && !isSnapshot();

/** The note a chat screen shows when nothing real goes out: the sample inbox, or a saved copy of someone's mail. */
export const demoNote = (): string | null => (isSnapshot() ? 'Saved copy of your mail. Nothing is sent.' : isSampleInbox() ? 'Sample inbox. Nothing is really sent.' : null);
