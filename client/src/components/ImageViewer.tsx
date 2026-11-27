import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Share, X } from 'lucide-react';
import type { EmailAttachment } from '../lib/types';
import { loadPictureBlob, pictureBlob, pictureSrc } from '../lib/pictures';
import { backdropOpacity, clampView, doubleTapView, flickSpeed, PINCH_SNAP, pinchEndView, pinchView, shareFileName, shouldDismiss, type Box, type Point, type View } from '../lib/zoomMath';
import './ImageViewer.css';

const IDENTITY: View = { s: 1, x: 0, y: 0 };
const MOVE_SLOP = 8;

type Mode = 'none' | 'undecided' | 'pan' | 'pinch' | 'swipe' | 'dismiss';

/** A full-screen viewer for the pictures of one email. The one dark surface in the app. */
export function ImageViewer({ pictures, index, onIndex, onClose }: { pictures: EmailAttachment[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const shadeRef = useRef<HTMLDivElement>(null);
  const many = pictures.length > 1;
  const at = Math.min(Math.max(index, 0), pictures.length - 1);
  const go = (step: number) => {
    if (!many) return;
    onIndex((at + step + pictures.length) % pictures.length);
  };
  const pic = pictures[at];

  // The latest go and onClose, for the listeners that are set up once
  const live = useRef({ go, onClose, many });
  live.current = { go, onClose, many };

  // The picture's place on screen lives here, not in React state, and is written in an animation frame
  const view = useRef<View>(IDENTITY);
  const fade = useRef(1);
  const animate = useRef(false);
  const frame = useRef(0);
  const suppressClick = useRef(false);
  const lastTouchAt = useRef(0);

  const paint = () => {
    frame.current = 0;
    const img = imgRef.current;
    const shade = shadeRef.current;
    if (!img) return;
    const v = view.current;
    const slow = animate.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    animate.current = false;
    const tr = slow ? 'transform 180ms ease-out' : 'none';
    const op = slow ? 'opacity 180ms ease-out' : 'none';
    img.style.transition = tr;
    img.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`;
    if (shade) {
      shade.style.transition = op;
      shade.style.opacity = String(fade.current);
    }
    if (stageRef.current) stageRef.current.style.cursor = v.s > 1 ? 'grab' : '';
  };
  const schedule = (withTransition = false) => {
    if (withTransition) animate.current = true;
    if (!frame.current) frame.current = requestAnimationFrame(paint);
  };

  // A new picture starts at 1x
  useEffect(() => {
    view.current = IDENTITY;
    fade.current = 1;
    schedule();
  }, [at]);

  // Focus the close button on open, give focus back to the picture's button on close, and lock the page's scroll
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const was = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtn.current?.focus();
    return () => {
      document.body.style.overflow = was;
      opener?.focus?.();
      if (frame.current) cancelAnimationFrame(frame.current);
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

  // The viewer has its own history entry, so Back (the left-edge swipe too) closes it and does not leave the chat.
  // Closing any other way goes back once, so no viewer entry is left behind.
  useEffect(() => {
    const token = `iview-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const here = window.location.hash.replace(/^#/, '') || '/';
    const deep = typeof window.history.state?.i === 'number' ? window.history.state.i : 0;
    window.history.pushState({ i: deep + 1, from: here, iview: token }, '', window.location.href);
    let left = false;
    const onPop = () => {
      // Landing on this entry again (Forward) is not leaving it
      if (window.history.state?.iview === token) return;
      left = true;
      live.current.onClose();
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (!left && window.history.state?.iview === token) window.history.back();
    };
  }, []);

  // iOS Safari starts its own page zoom on a pinch: stop it while the viewer is open
  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    return () => {
      document.removeEventListener('gesturestart', stop);
      document.removeEventListener('gesturechange', stop);
    };
  }, []);

  // Touch, mouse and wheel on the stage. Set up once; they read the latest values through refs.
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    const box = (): Box => {
      const img = imgRef.current;
      return { iw: img?.offsetWidth ?? 0, ih: img?.offsetHeight ?? 0, sw: stage.clientWidth, sh: stage.clientHeight };
    };
    const centred = (cx: number, cy: number): Point => {
      const r = stage.getBoundingClientRect();
      return { x: cx - r.left - r.width / 2, y: cy - r.top - r.height / 2 };
    };
    const midOf = (a: Touch, b: Touch) => centred((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2);
    const gap = (a: Touch, b: Touch) => Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1;
    const markMoved = () => {
      suppressClick.current = true;
    };
    let releaseTimer = 0;
    const clearReleaseTimer = () => {
      if (releaseTimer) window.clearTimeout(releaseTimer);
      releaseTimer = 0;
    };
    const releaseClick = () => {
      clearReleaseTimer();
      releaseTimer = window.setTimeout(() => {
        releaseTimer = 0;
        suppressClick.current = false;
      }, 400);
    };
    const toggleZoom = (cx: number, cy: number) => {
      view.current = doubleTapView(view.current, centred(cx, cy), box());
      schedule(true);
    };

    // One gesture at a time, kept here
    let mode: Mode = 'none';
    let moved = false;
    let startX = 0;
    let startY = 0;
    let base: View = IDENTITY;
    let pinchFrom: Point = { x: 0, y: 0 };
    let pinchGap = 1;
    let lastY = 0;
    let lastT = 0;
    let vy = 0;
    let tapAt = 0;
    let imgTapAt = 0;
    let tapX = 0;
    let tapY = 0;

    const beginOne = (t: Touch, t0: number) => {
      startX = t.clientX;
      startY = t.clientY;
      base = view.current;
      lastY = t.clientY;
      lastT = t0;
      vy = 0;
      mode = view.current.s > 1 ? 'pan' : 'undecided';
    };

    const onTouchStart = (e: TouchEvent) => {
      lastTouchAt.current = Date.now();
      clearReleaseTimer();
      suppressClick.current = false;
      if (e.touches.length === 1) {
        moved = false;
        beginOne(e.touches[0], e.timeStamp);
      } else if (e.touches.length === 2) {
        // Two fingers: a pinch. The first finger's touchstart was left alone, so the press and hold menu stays.
        e.preventDefault();
        moved = true;
        markMoved();
        mode = 'pinch';
        base = view.current;
        pinchFrom = midOf(e.touches[0], e.touches[1]);
        pinchGap = gap(e.touches[0], e.touches[1]);
        fade.current = 1;
        schedule();
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (mode === 'pinch' && e.touches.length >= 2) {
        e.preventDefault();
        view.current = pinchView(base, pinchFrom, midOf(e.touches[0], e.touches[1]), gap(e.touches[0], e.touches[1]) / pinchGap, box());
        schedule();
        return;
      }
      if (e.touches.length !== 1 || mode === 'none' || mode === 'pinch') return;
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      const now = e.timeStamp;
      if (now - lastT > 0) vy = (t.clientY - lastY) / (now - lastT);
      lastY = t.clientY;
      lastT = now;
      if (!moved && Math.hypot(dx, dy) > MOVE_SLOP) {
        moved = true;
        markMoved();
        if (mode === 'undecided') {
          if (Math.abs(dx) > Math.abs(dy)) mode = live.current.many ? 'swipe' : 'none';
          else mode = dy > 0 ? 'dismiss' : 'none';
        }
      }
      if (!moved) return;
      if (mode === 'pan') {
        e.preventDefault();
        view.current = clampView({ s: base.s, x: base.x + dx, y: base.y + dy }, box());
        schedule();
      } else if (mode === 'dismiss') {
        e.preventDefault();
        view.current = { s: 1, x: dx, y: Math.max(0, dy) };
        fade.current = backdropOpacity(dy);
        schedule();
      } else if (mode === 'swipe') {
        e.preventDefault();
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        // A finger lifted during a pinch: carry on as a pan with the one left
        if (mode === 'pinch' && e.touches.length === 1) {
          beginOne(e.touches[0], e.timeStamp);
          moved = true;
          if (view.current.s < PINCH_SNAP) {
            view.current = IDENTITY;
            mode = 'none';
            schedule(true);
          }
        }
        return;
      }
      const t = e.changedTouches[0];
      const was = mode;
      mode = 'none';
      if (was === 'pinch') {
        view.current = pinchEndView(view.current);
        schedule(true);
        releaseClick();
        return;
      }
      if (was === 'dismiss') {
        if (shouldDismiss(view.current.y, flickSpeed(vy, lastT, e.timeStamp))) {
          live.current.onClose();
        } else {
          view.current = IDENTITY;
          fade.current = 1;
          schedule(true);
        }
        releaseClick();
        return;
      }
      if (was === 'swipe' && t) {
        const dx = t.clientX - startX;
        if (Math.abs(dx) > 50) live.current.go(dx < 0 ? 1 : -1);
        releaseClick();
        return;
      }
      if (moved) {
        releaseClick();
        return;
      }
      // A tap. Two close together on the picture zoom it.
      const nowTap = Date.now();
      if (t && e.target === imgRef.current) {
        const nowMs = Date.now();
        imgTapAt = nowMs;
        if (nowMs - tapAt < 320 && Math.hypot(t.clientX - tapX, t.clientY - tapY) < 40) {
          tapAt = 0;
          toggleZoom(t.clientX, t.clientY);
          // The taps' own clicks must not close the viewer
          markMoved();
          releaseClick();
          return;
        }
        tapAt = nowMs;
        tapX = t.clientX;
        tapY = t.clientY;
      } else {
        tapAt = 0;
        // A second tap of a double tap that lands just off a thin picture is not a tap on the dark area
        if (nowTap - imgTapAt < 320) {
          markMoved();
          releaseClick();
        }
      }
    };

    const onTouchCancel = () => {
      const was = mode;
      mode = 'none';
      view.current = clampView(view.current, box());
      if (was === 'pinch') view.current = pinchEndView(view.current);
      if (view.current.s <= 1) fade.current = 1;
      schedule(true);
    };

    // Mouse: drag to move when zoomed, double click to zoom, wheel to zoom
    let dragging = false;
    let mouseStartX = 0;
    let mouseStartY = 0;
    let mouseBase: View = IDENTITY;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || Date.now() - lastTouchAt.current < 700) return;
      clearReleaseTimer();
      suppressClick.current = false;
      if (view.current.s <= 1) return;
      e.preventDefault();
      dragging = true;
      moved = false;
      mouseStartX = e.clientX;
      mouseStartY = e.clientY;
      mouseBase = view.current;
      stage.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - mouseStartX;
      const dy = e.clientY - mouseStartY;
      if (!moved && Math.hypot(dx, dy) > 4) {
        moved = true;
        markMoved();
      }
      view.current = clampView({ s: mouseBase.s, x: mouseBase.x + dx, y: mouseBase.y + dy }, box());
      schedule();
    };
    const onMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      if (moved) releaseClick();
      schedule();
    };
    const onDblClick = (e: MouseEvent) => {
      if (Date.now() - lastTouchAt.current < 700 || e.target !== imgRef.current) return;
      toggleZoom(e.clientX, e.clientY);
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = view.current.s * Math.exp(-e.deltaY * 0.01);
      view.current = pinchView(view.current, centred(e.clientX, e.clientY), centred(e.clientX, e.clientY), next / view.current.s, box());
      schedule();
    };
    const noDrag = (e: Event) => e.preventDefault();

    stage.addEventListener('touchstart', onTouchStart, { passive: false });
    stage.addEventListener('touchmove', onTouchMove, { passive: false });
    stage.addEventListener('touchend', onTouchEnd, { passive: false });
    stage.addEventListener('touchcancel', onTouchCancel);
    stage.addEventListener('mousedown', onMouseDown);
    stage.addEventListener('dblclick', onDblClick);
    stage.addEventListener('wheel', onWheel, { passive: false });
    stage.addEventListener('dragstart', noDrag);
    const onResize = () => {
      view.current = clampView(view.current, box());
      schedule();
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      stage.removeEventListener('touchstart', onTouchStart);
      stage.removeEventListener('touchmove', onTouchMove);
      stage.removeEventListener('touchend', onTouchEnd);
      stage.removeEventListener('touchcancel', onTouchCancel);
      stage.removeEventListener('mousedown', onMouseDown);
      stage.removeEventListener('dblclick', onDblClick);
      stage.removeEventListener('wheel', onWheel);
      stage.removeEventListener('dragstart', noDrag);
      clearReleaseTimer();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pic ? 'on' : 'off']);

  // A picture that is really an SVG is never offered for sharing, whatever its name or declared type says
  const [, setLoaded] = useState(0);
  const isSvg = !!pic && ((pictureSrc(pic) ?? '').toLowerCase().startsWith('data:image/svg') || pictureBlob(pic)?.type === 'image/svg+xml');
  // Share: offered only when this browser can share this picture as a file
  const canShareType = useMemo(() => {
    if (!pic || typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
    try {
      return navigator.canShare({ files: [new File([''], shareFileName(pic.filename, pic.mimeType), { type: pic.mimeType })] });
    } catch {
      return false;
    }
  }, [pic]);
  const shareable = canShareType && !isSvg;
  // The Blob is fetched when the picture shows, so the tap itself has nothing to wait for
  useEffect(() => {
    if (!pic || pictureBlob(pic)) return;
    void loadPictureBlob(pic).then((b) => {
      if (b) setLoaded((n) => n + 1);
    });
  }, [pic]);
  const share = () => {
    if (!pic) return;
    // No await before navigator.share: iOS Safari refuses a share that does not start inside the tap
    const blob = pictureBlob(pic);
    if (!blob) return;
    const type = blob.type.startsWith('image/') ? blob.type : pic.mimeType;
    const file = new File([blob], shareFileName(pic.filename, type), { type });
    try {
      if (!navigator.canShare?.({ files: [file] })) return;
      navigator.share({ files: [file] }).catch(() => undefined);
    } catch {
      // A browser that refused the share is not an error to show
    }
  };

  if (!pic) return null;
  return createPortal(
    <div
      className="iview"
      role="dialog"
      aria-modal="true"
      aria-label="Picture"
      onClick={(e) => {
        if (suppressClick.current) return;
        if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('iview__stage')) onClose();
      }}
    >
      <div ref={shadeRef} className="iview__shade" />
      <div className="iview__bar">
        <button ref={closeBtn} type="button" className="iview__btn" aria-label="Close" onClick={onClose}>
          <X size={24} strokeWidth={2} aria-hidden="true" />
        </button>
        <div className="iview__title">
          {(pic.alt || !pic.inline) && <span className="iview__name">{pic.alt || pic.filename}</span>}
          {many && <span className="iview__count">{`${at + 1} of ${pictures.length}`}</span>}
        </div>
        {shareable ? (
          <button type="button" className="iview__btn" aria-label="Share picture" onClick={share}>
            <Share size={22} strokeWidth={2} aria-hidden="true" />
          </button>
        ) : (
          <span className="iview__gap" aria-hidden="true" />
        )}
      </div>
      <div ref={stageRef} className="iview__stage">
        <img ref={imgRef} className="iview__img" src={pictureSrc(pic)} alt={pic.alt ?? ''} />
      </div>
      <div className="iview__foot" />
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
