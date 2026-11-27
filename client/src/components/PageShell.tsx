import { useState, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { cameFrom, goBack } from '../router';
import { placeName } from '../lib/placeName';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useVisualViewport } from '../lib/useViewport';
import './PageShell.css';

interface Props {
  title?: string;
  /** Phone: fixed element under the body, such as the action bar. */
  footer?: ReactNode;
  /** Controls at the right end of the header (phone) or beside the title (desktop). */
  right?: ReactNode;
  /** White lists on the grey canvas, instead of a white page. */
  canvas?: boolean;
  /** The body does not scroll; the screen fills it (chat, forms). Follows the keyboard on phones. */
  fill?: boolean;
  /** No header and no title: the screen draws its own (New email). */
  bare?: boolean;
  children?: ReactNode;
}

/** The title is large on the page and shrinks into the header once it scrolls away, as on iOS. */
const COLLAPSE_AT = 36;

export function PageShell({ title, footer, right, canvas, fill, bare, children }: Props) {
  const desktop = useIsDesktop();
  const vv = useVisualViewport();
  const [collapsed, setCollapsed] = useState(false);
  const cls = ['page', canvas && 'page--canvas', fill && 'page--fill'].filter(Boolean).join(' ');
  const showTitle = !!title && !bare;
  return (
    <div className={cls} style={fill && !desktop && vv ? { height: vv.h, top: vv.top } : undefined}>
      {!desktop && !bare && (
        <header className={`page__bar${collapsed ? ' is-collapsed' : ''}`}>
          <button className="page__back t-subhead" onClick={goBack}>
            <ChevronLeft size={22} strokeWidth={1.75} />
            {placeName(cameFrom() ?? '/chats')}
          </button>
          {title && <h2 className="page__bar-title t-headline">{title}</h2>}
          {right && <div className="page__bar-right">{right}</div>}
        </header>
      )}
      <main className="page__body" onScroll={(e) => setCollapsed(e.currentTarget.scrollTop > COLLAPSE_AT)}>
        <div className="page__inner">
          {showTitle && (
            <div className="page__titlerow">
              <h1 className="page__title t-display">{title}</h1>
              {desktop && right}
            </div>
          )}
          {children}
        </div>
      </main>
      {footer}
    </div>
  );
}
