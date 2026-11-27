import { isStaticDemoMode } from './api';
import { isSnapshot } from './snapshot';

/** The public sample inbox: the static demo, and not a private snapshot of someone's real mail. */
export const isSampleInbox = (): boolean => isStaticDemoMode() && !isSnapshot();
