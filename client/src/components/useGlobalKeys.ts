import { useEffect, useRef } from 'react';
import { navigate } from '../router';

interface Opts {
  onShortcuts: () => void;
  /** The composer screens own the keyboard. */
  off: boolean;
}

const GO: Record<string, string> = { t: '/goals', i: '/cards/needs-you', d: '/drafts' };

/**
 * The keys that work anywhere, when no field has focus: / Search, C New email,
 * G then T To-do, G then I Needs you, G then D Drafts, ? the shortcut sheet.
 * It listens first (capture), so `G T` never also does the deck's To-do move.
 */
export function useGlobalKeys({ onShortcuts, off }: Opts) {
  const pending = useRef(0);
  const latest = useRef({ onShortcuts, off });
  latest.current = { onShortcuts, off };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (latest.current.off || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target;
      if (el instanceof HTMLElement && (el.closest('input, textarea, select, [contenteditable="true"]') || el.isContentEditable)) return;
      const key = e.key.toLowerCase();
      const waiting = Date.now() < pending.current;
      pending.current = 0;
      const modal = !!document.querySelector('[aria-modal="true"]');
      const eat = () => {
        e.preventDefault();
        e.stopPropagation();
      };
      if (modal) {
        // A sheet is open: its own keys stay as they are
      } else if (e.key === '?') {
        eat();
        latest.current.onShortcuts();
      } else if (waiting) {
        // G then a letter: a destination, or nothing. It never falls through to the deck.
        eat();
        if (GO[key]) navigate(GO[key]);
      } else if (key === 'g') {
        eat();
        pending.current = Date.now() + 1200;
      } else if (e.key === '/') {
        eat();
        navigate('/ask');
      } else if (key === 'c') {
        eat();
        navigate('/new');
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
}
