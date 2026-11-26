import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react';
import { useStore } from '../store';
import { TOAST_MS } from '../storeTypes';
import './Toast.css';

interface Spot {
  style: CSSProperties;
}

/** The toast sits at the bottom: 12px above the action bar on a deck screen, else 16px above the bottom edge. It never covers the top bar or a title. */
function place(): Spot {
  const bars = [...document.querySelectorAll('.actionbar')];
  const bar = bars[bars.length - 1]?.getBoundingClientRect();
  const main = document.querySelector('.dshell__main')?.getBoundingClientRect();
  const desktop = window.matchMedia('(min-width: 1024px)').matches;
  if (bar && bar.height > 0 && main && desktop) {
    // On a laptop every toast with a bar sits in one place: centered in the content, 12px above where the deck's bar stands (64px tall, 16px off the bottom)
    return { style: { top: 'auto', bottom: 16 + 64 + 12, left: Math.round(main.left), right: Math.round(window.innerWidth - main.right) } };
  }
  if (bar && bar.height > 0) {
    return {
      style: { top: 'auto', bottom: Math.round(window.innerHeight - bar.top + 12), left: Math.round(bar.left), right: Math.round(window.innerWidth - bar.right) },
    };
  }
  // The To-do page keeps Tackle, and the finish keeps Next, at the bottom of the phone: the toast rides above it
  const foot = [...document.querySelectorAll('.todo__tackle, .finish__primary')].map((el) => el.getBoundingClientRect()).find((r) => r.height > 0 && r.top > window.innerHeight / 2);
  return {
    style: {
      top: 'auto',
      bottom: foot ? Math.round(window.innerHeight - foot.top + 12) : 'calc(16px + env(safe-area-inset-bottom))',
      left: main ? Math.round(main.left) : 0,
      right: main ? Math.round(window.innerWidth - main.right) : 0,
    },
  };
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
    <div className="toast-wrap" style={spot?.style}>
      <div className="toast" role="status" key={toast.id}>
        <span className="toast__text t-subhead">{toast.text}</span>
        {toast.undoable && (
          <button className="toast__undo t-callout" onClick={() => void undo()}>
            Undo
          </button>
        )}
        {toast.undoable && !toast.sticky && <span className="toast__time" style={{ '--toast-ms': `${TOAST_MS}ms` } as CSSProperties} />}
      </div>
    </div>
  );
}
