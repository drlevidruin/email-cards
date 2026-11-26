import { useEffect, useState } from 'react';
import type { EmailThread } from './types';
import { loadThread, peekThread } from './threadCache';

/** The full thread with its messages, or null until it has loaded. */
export function useThread(id: string | undefined): EmailThread | null {
  const [thread, setThread] = useState<EmailThread | null>(() => (id && peekThread(id)) || null);
  useEffect(() => {
    let live = true;
    const ready = id ? peekThread(id) : undefined;
    if (!id) setThread(null);
    else if (ready) setThread(ready);
    else {
      setThread(null);
      loadThread(id).then(
        (t) => live && setThread(t),
        () => undefined
      );
    }
    return () => {
      live = false;
    };
  }, [id]);
  return thread;
}
