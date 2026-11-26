import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import { goBack } from '../router';
import { useIsDesktop } from '../lib/useIsDesktop';
import { useVisualViewport } from '../lib/useViewport';
import './PageShell.css';

interface Props {
  title?: string;
  /** Phone: fixed element under the body, such as the action bar. */
  footer?: ReactNode;
  /** Controls at the right end of the top bar. */
  right?: ReactNode;
  /** White lists on the grey canvas, instead of a white page. */
  canvas?: boolean;
  /** The body does not scroll; the screen fills it (chat, forms). Follows the keyboard on phones. */
  fill?: boolean;
  children?: ReactNode;
}

export function PageShell({ title, footer, right, canvas, fill, children }: Props) {
  const desktop = useIsDesktop();
  const vv = useVisualViewport();
  const cls = ['page', canvas && 'page--canvas', fill && 'page--fill'].filter(Boolean).join(' ');
  return (
    <div className={cls} style={fill && !desktop && vv ? { height: vv.h, top: vv.top } : undefined}>
      <header className="page__bar">
        <button className="icon-btn" aria-label="Back" onClick={goBack}>
          <ArrowLeft size={22} strokeWidth={2} />
        </button>
        {!desktop && title && <h1 className="page__bar-title">{title}</h1>}
        {right && <div className="page__bar-right">{right}</div>}
      </header>
      <main className="page__body">
        <div className="page__inner">
          {desktop && title && <h1 className="page__title">{title}</h1>}
          {children}
        </div>
      </main>
      {footer}
    </div>
  );
}
