import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { EmailAttachment } from '../lib/types';
import { safePreview } from '../lib/safePreview';
import './ImageViewer.css';

/** A full-screen viewer for the pictures of one email. The one dark surface in the app. */
export function ImageViewer({ pictures, index, onIndex, onClose }: { pictures: EmailAttachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const swipe = useRef<number | null>(null);
  const many = pictures.length > 1;
  const at = Math.min(Math.max(index, 0), pictures.length - 1);
  const go = (step: number) => {
    if (!many) return;
    onIndex((at + step + pictures.length) % pictures.length);
  };

  // Focus the close button on open, give focus back to the picture's button on close, and lock the page's scroll
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = was;
      opener?.focus?.();
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const pic = pictures[at];
  if (!pic) return null;
  return createPortal(
    <div
      className="iview"
      role="dialog"
      aria-modal="true"
      aria-label="Picture"
      onClick={(e) => {
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('iview__stage')) onClose();
      }}
      onTouchStart={(e) => {
        swipe.current = e.touches.length === 1 ? e.touches[0].clientX : null;
      }}
      onTouchEnd={(e) => {
        const from = swipe.current;
        swipe.current = null;
        if (from === null || !e.changedTouches[0]) return;
        const dx = e.changedTouches[0].clientX - from;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="iview__bar">
        <button ref={closeBtn} type="button" className="iview__btn" aria-label="Close" onClick={onClose}>
          <X size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="iview__title">
          <span className="iview__name">{pic.filename}</span>
          {many && <span className="iview__count">{`${at + 1} of ${pictures.length}`}</span>}
        </div>
        <span className="iview__gap" aria-hidden="true" />
      </div>
      <div className="iview__stage">
        <img className="iview__img" src={safePreview(pic.previewUrl)} alt="" />
      </div>
      {many && (
        <>
          <button type="button" className="iview__nav iview__nav--prev" aria-label="Previous picture" onClick={() => go(-1)}>
            <ChevronLeft size={24} strokeWidth={2} aria-hidden="true" />
          </button>
          <button type="button" className="iview__nav iview__nav--next" aria-label="Next picture" onClick={() => go(1)}>
            <ChevronRight size={24} strokeWidth={2} aria-hidden="true" />
          </button>
        </>
      )}
    </div>,
    document.body
  );
}
