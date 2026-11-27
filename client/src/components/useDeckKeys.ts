import { useEffect } from 'react';
import type { Dir } from './ActionBar';

interface Keys {
  /** Nothing but Z works while a sheet is open, a card is covered, or no card is up. */
  off: boolean;
  cards: boolean;
  onDir: (dir: Dir) => void;
  onOpen: () => void;
  /** 1 or 2 opens that answer, R opens `Write my own`. */
  onAnswer: (key: '1' | '2' | 'r') => void;
  onUndo: () => void;
  /** The phone menu. Not on a laptop, where the rail is always there. */
  onMenu?: () => void;
  /** New senders: A allows, B blocks, N sends to Newsletters. */
  senders?: boolean;
}

const DIRS: Record<string, Dir> = { arrowright: 'right', e: 'right', arrowleft: 'left', h: 'left', arrowup: 'up', t: 'up', arrowdown: 'down', j: 'down' };
const SENDER_DIRS: Record<string, Dir> = { arrowright: 'right', a: 'right', arrowleft: 'left', b: 'left', arrowup: 'up', n: 'up', arrowdown: 'down', j: 'down' };

/** The deck's keyboard: arrows or E H T J move the card (A B N on New senders), Enter or Space opens it, 1 and 2 open an answer, R writes your own, Z undoes. */
export function useDeckKeys(k: Keys) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      if (el instanceof HTMLElement) {
        if (el.closest('input, textarea, select, [contenteditable="true"]') || el.isContentEditable) return;
        if ((e.key === 'Enter' || e.key === ' ') && el.closest('button, a')) return;
      }
      if (k.off || e.metaKey || e.ctrlKey || e.altKey) return;
      // A dialog (the shortcut sheet) is open: the cards wait
      if (document.querySelector('[aria-modal="true"]')) return;
      const key = e.key.toLowerCase();
      if (key === 'z') return k.onUndo();
      // A held key moves one card, not a row of them
      if (e.repeat) {
        if (k.cards) e.preventDefault();
        return;
      }
      if (!k.cards) return;
      const dir = (k.senders ? SENDER_DIRS : DIRS)[key];
      if (dir) {
        e.preventDefault();
        k.onDir(dir);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        k.onOpen();
      } else if (key === 'r' || key === '1' || key === '2') {
        e.preventDefault();
        k.onAnswer(key);
      } else if (key === 'm') k.onMenu?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
}
