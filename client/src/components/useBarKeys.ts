import { useEffect, useRef } from 'react';
import { BAR_KEY, barActions, type BarAction, type BarVariant } from './ActionBar';

/** The action bar's keys (E H T R, or A B N on a new sender) for a screen that shows the bar. */
export function useBarKeys(variant: BarVariant, onAction: (action: BarAction) => void, off = false) {
  const latest = useRef({ variant, onAction, off });
  latest.current = { variant, onAction, off };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement && (el.closest('input, textarea, select, [contenteditable="true"]') || el.isContentEditable)) return;
      if (latest.current.off || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toUpperCase();
      const hit = barActions(latest.current.variant).find((a) => BAR_KEY[a] === key);
      if (!hit) return;
      e.preventDefault();
      latest.current.onAction(hit);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
