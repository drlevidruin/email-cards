import type { ReactNode } from 'react';
import { useRoute } from '../router';
import { isStackId, type StackId } from '../lib/stacks';
import { useIsWide } from '../lib/useIsDesktop';
import { Rail, type Here } from './Rail';
import { SidePanel } from './SidePanel';
import './DesktopShell.css';

/** Which rail row the route is on, and which deck (if any) its side panel follows. */
function where(head: string | undefined, arg: string | undefined, from: string | null): { here: Here; deck: StackId | null } {
  const deck = head === 'cards' && isStackId(arg) ? arg : head === 'read' && isStackId(from ?? undefined) ? (from as StackId) : null;
  if (head === 'read' && from === 'goals') return { here: 'todo', deck: null };
  if (deck) return { here: deck === 'bookmarked' ? 'todo' : deck, deck };
  switch (head) {
    case 'goals': return { here: 'todo', deck: null };
    case 'drafts': return { here: 'drafts', deck: null };
    case 'all': return { here: 'all', deck: null };
    case 'ask': return { here: 'search', deck: null };
    case 'settings': return { here: 'settings', deck: null };
    default: return { here: null, deck: null };
  }
}

/** On a laptop every route sits in this: the rail, the content, and on the decks a side panel. */
export function DesktopShell({ children }: { children: ReactNode }) {
  const { segments, query } = useRoute();
  const wide = useIsWide();
  const { here, deck } = where(segments[0], segments[1], query.get('from'));
  return (
    <div className={`dshell${deck && wide ? ' dshell--panel' : ''}`}>
      <div className="dshell__rail">
        <Rail here={here} />
      </div>
      <div className="dshell__main">{children}</div>
      {deck && wide && (
        <div className="dshell__panel">
          <SidePanel stack={deck} />
        </div>
      )}
    </div>
  );
}
