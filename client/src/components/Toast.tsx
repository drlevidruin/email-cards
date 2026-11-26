import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { useStore } from '../store';
import { useRoute } from '../router';
import './Toast.css';

const DESKTOP = 900;

/** Where an element sits in the layout, ignoring the deck card's scale and offset, so a card still settling gives its final place at once. */
function layoutTop(el: HTMLElement | Element): number {
  const deck = document.querySelector<HTMLElement>('.deck');
  let y = 0;
  let node: HTMLElement | null = el as HTMLElement;
  while (node && node !== deck) {
    y += node.offsetTop;
    node = node.offsetParent as HTMLElement | null;
  }
  return node && deck ? deck.getBoundingClientRect().top + y : el.getBoundingClientRect().top;
}

/** Where the toast goes so it never sits on a button. Undefined means the CSS default. */
function place(toast: HTMLElement | null, exiting: boolean): CSSProperties | undefined {
  const desktop = window.innerWidth >= DESKTOP;
  // The card that stays on top: not the one flying out after a sent reply
  const cards = [...document.querySelectorAll<HTMLElement>('.deck__card:not(.deck__card--sliver)')];
  const tray = cards[exiting ? 1 : 0]?.querySelector('.tray');
  const bar = document.querySelector('.actionbar');
  if (desktop && toast) {
    // Bottom left, when the toast's real box clears both the card column and the action bar
    const box = { l: 32, r: 32 + toast.offsetWidth, t: window.innerHeight - 32 - toast.offsetHeight, b: window.innerHeight - 32 };
    const hits = (r?: DOMRect) => !!r && box.l < r.right + 8 && box.r > r.left - 8 && box.t < r.bottom + 8 && box.b > r.top - 8;
    const col = document.querySelector('.cards__col')?.getBoundingClientRect();
    if (!hits(col) && !hits(bar?.getBoundingClientRect())) return undefined;
    // (Falls through to sit above the tray or the bar, or low when there is neither.)
  }
  const anchor = tray ?? bar;
  // No tray and no bar (Today, finish, cover): sit low
  if (!anchor) return { bottom: 'calc(20px + env(safe-area-inset-bottom))', ...(desktop ? { justifyContent: 'center' } : {}) };
  const top = tray ? layoutTop(tray) : anchor.getBoundingClientRect().top;
  return { bottom: Math.round(window.innerHeight - top + 12), ...(desktop ? { justifyContent: 'center' } : {}) };
}

/** Places the toast while it is up, and again when the top card changes or the window resizes. */
function usePlace(active: boolean, id: number | undefined, exiting: boolean, el: RefObject<HTMLElement | null>): CSSProperties | undefined {
  const [style, setStyle] = useState<CSSProperties>();
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
    const host = document.querySelector('.cards__deck');
    const watch = new MutationObserver(again);
    if (host) watch.observe(host, { childList: true, subtree: true });
    return () => {
      window.removeEventListener('resize', again);
      watch.disconnect();
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [active, id]);
  useLayoutEffect(() => {
    if (!active) {
      setStyle(undefined);
      return;
    }
    const next = place(el.current, exiting);
    setStyle((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
  }, [active, id, exiting, tick, el]);
  return style;
}

export function Toast() {
  const { toast, undo, exiting } = useStore();
  const box = useRef<HTMLDivElement>(null);
  const route = useRoute();
  const head = route.segments[0];
  const withBar = head === 'cards' || head === 'read';
  const style = usePlace(withBar && !!toast, toast?.id, !!exiting, box);
  if (!toast) return null;
  // Screens with a bottom input would have the toast cover it or sit behind the keyboard.
  const onTop = head === 'ask' || head === 'new' || head === 'reply';
  return (
    <div className={`toast-wrap${withBar ? ' toast-wrap--bar' : ''}${onTop ? ' toast-wrap--top' : ''}`} style={style}>
      <div className="toast" role="status" key={toast.id} ref={box}>
        <span className="toast__text">{toast.text}</span>
        {toast.undoable && (
          <button className="toast__undo" onClick={() => void undo()}>
            Undo
          </button>
        )}
      </div>
    </div>
  );
}
