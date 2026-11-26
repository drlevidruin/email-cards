import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useStore } from '../store';
import './Toast.css';

interface Spot {
  style: CSSProperties;
  /** Sits under the top bar and slides down, because there is no action bar to sit above. */
  top: boolean;
}

/** The toast never covers a button. Above the action bar when there is one, else 12px under the top bar and progress line. */
function place(): Spot {
  const bars = [...document.querySelectorAll('.actionbar')];
  const bar = bars[bars.length - 1]?.getBoundingClientRect();
  const main = document.querySelector('.dshell__main')?.getBoundingClientRect();
  if (bar && bar.height > 0 && main && window.matchMedia('(min-width: 1024px)').matches) {
    // On a laptop every toast with a bar sits in one place: centered in the content, 12px above where the deck's bar stands (76px tall, 16px off the bottom)
    return { top: false, style: { top: 'auto', bottom: 16 + 76 + 12, left: Math.round(main.left), right: Math.round(window.innerWidth - main.right) } };
  }
  if (bar && bar.height > 0) {
    return {
      top: false,
      style: { top: 'auto', bottom: Math.round(window.innerHeight - bar.top + 12), left: Math.round(bar.left), right: Math.round(window.innerWidth - bar.right) },
    };
  }
  const anchors = [...document.querySelectorAll('.topbar, .segbar, .page__bar')]
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.height > 0 && r.bottom < window.innerHeight / 2);
  const under = anchors.length ? Math.max(...anchors.map((r) => r.bottom)) + 12 : 12;
  const style: CSSProperties = {
    top: anchors.length ? Math.round(under) : 'calc(12px + env(safe-area-inset-top))',
    bottom: 'auto',
    left: main ? Math.round(main.left) : 0,
    right: main ? Math.round(window.innerWidth - main.right) : 0,
  };
  return { top: true, style };
}

/** Places the toast while it is up, and again when the screen changes or the window resizes. */
function usePlace(active: boolean, id: number | undefined): Spot | undefined {
  const [spot, setSpot] = useState<Spot>();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let timer = 0;
    const again = () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      raf = requestAnimationFrame(() => setTick((n) => n + 1));
      // Once the next card has finished settling into place
      timer = window.setTimeout(() => setTick((n) => n + 1), 320);
    };
    window.addEventListener('resize', again);
    window.addEventListener('hashchange', again);
    const watch = new MutationObserver(again);
    watch.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', again);
      window.removeEventListener('hashchange', again);
      watch.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [active, id]);
  useLayoutEffect(() => {
    if (!active) {
      setSpot(undefined);
      return;
    }
    const next = place();
    setSpot((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [active, id, tick]);
  return spot;
}

export function Toast() {
  const { toast, undo } = useStore();
  const spot = usePlace(!!toast, toast?.id);
  if (!toast) return null;
  return (
    <div className={`toast-wrap${spot?.top ? ' toast-wrap--top' : ''}`} style={spot?.style}>
      <div className="toast" role="status" key={toast.id}>
        <span className="toast__text t-subhead">{toast.text}</span>
        {toast.undoable && (
          <button className="toast__undo t-callout" onClick={() => void undo()}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
