import { isSnapshot } from './snapshot';
import { isLiveMode } from './liveMode';

/** True when the mail on screen is the owner's real mail (a saved copy or live Gmail), not the public sample. */
export const isRealMail = (): boolean => isSnapshot() || isLiveMode();
