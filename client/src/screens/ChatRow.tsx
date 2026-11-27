import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent } from 'react';
import { Archive, ArchiveRestore, Bell, BellOff, Check, ChevronDown, Mail, MailOpen, Pin } from 'lucide-react';
import { navigate } from '../router';
import { oneLine, type Chat } from '../lib/chats';
import { relativeTime } from '../lib/time';
import { Avatar, AvatarPair } from '../components/Avatar';

export type Side = 'left' | 'right';
export type RowAct = 'archive' | 'mute' | 'pin' | 'read';

/** How far a tray opens, and how far a finger must go. */
const OPEN = 152;
const COMMIT = 60;
const LONG_SHARE = 0.6;
const FLICK = 0.4;
const SLOP = 8;
const HOLD_MS = 450;

const reduced = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Past the open width the row follows at a third of the finger's speed. */
function band(p: number): number {
  const a = Math.abs(p);
  if (a <= OPEN) return p;
  return Math.sign(p) * (OPEN + (a - OPEN) / 3);
}

interface Props {
  chat: Chat;
  /** The chat is the one open beside the list (laptop). */
  active: boolean;
  draft: string;
  pinned: boolean;
  muted: boolean;
  /** Marked unread by hand. */
  marked: boolean;
  archived: boolean;
  /** Show the small archive icon after the name (a search result that is archived). */
  showArchived: boolean;
  /** Which tray this row has open, if any. */
  side: Side | null;
  onSide: (key: string, side: Side | null) => void;
  onMenu: (chat: Chat) => void;
  onAct: (act: RowAct, chat: Chat) => void;
}

interface Gesture {
  id: number;
  sx: number;
  sy: number;
  x0: number;
  axis: '' | 'x' | 'y';
  moved: boolean;
  long: boolean;
  suppress: boolean;
  timer: number;
  lastX: number;
  lastT: number;
  v: number;
  finger: number;
  held: boolean;
}

const fresh = (): Gesture => ({ id: -1, sx: 0, sy: 0, x0: 0, axis: '', moved: false, long: false, suppress: false, timer: 0, lastX: 0, lastT: 0, v: 0, finger: 0, held: false });

export function ChatRow({ chat, active, draft, pinned, muted, marked, archived, showArchived, side, onSide, onMenu, onAct }: Props) {
  const wrap = useRef<HTMLLIElement>(null);
  const g = useRef<Gesture>(fresh());
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [long, setLong] = useState(false);
  const leaving = useRef(false);
  const unread = chat.unread > 0;
  const showDraft = !!draft.trim() && !active;
  const asRead = unread || marked;

  // The parent closes a tray (a tap elsewhere, a scroll, another row opening)
  useEffect(() => {
    if (g.current.axis === 'x' && dragging) return;
    if (leaving.current) return;
    setX(side === 'left' ? OPEN : side === 'right' ? -OPEN : 0);
    setLong(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [side]);

  useEffect(() => () => window.clearTimeout(g.current.timer), []);

  const width = () => wrap.current?.offsetWidth ?? 360;

  /** The row slides out, then its height closes, then the change is made. */
  const leave = (done: () => void) => {
    const li = wrap.current;
    if (!li || reduced()) {
      done();
      return;
    }
    leaving.current = true;
    onSide(chat.key, null);
    setLong(false);
    setX(li.offsetWidth);
    window.setTimeout(() => {
      const el = wrap.current;
      if (!el) return done();
      el.style.height = `${el.offsetHeight}px`;
      el.style.transition = 'height 180ms ease';
      requestAnimationFrame(() => {
        if (wrap.current) wrap.current.style.height = '0px';
      });
      window.setTimeout(() => {
        done();
        // A row that stays in the list (a search result) comes back as it was
        requestAnimationFrame(() => {
          leaving.current = false;
          if (wrap.current) {
            wrap.current.style.height = '';
            wrap.current.style.transition = '';
          }
          setX(0);
        });
      }, 190);
    }, 220);
  };

  const finish = (p: number, vx: number) => {
    const w = width();
    if (p > w * LONG_SHARE) {
      leave(() => onAct('archive', chat));
      return;
    }
    let target = 0;
    if (vx > FLICK) target = g.current.x0 < 0 ? 0 : OPEN;
    else if (vx < -FLICK) target = g.current.x0 > 0 ? 0 : -OPEN;
    else if (p > COMMIT) target = OPEN;
    else if (p < -COMMIT) target = -OPEN;
    setLong(false);
    setX(target);
    onSide(chat.key, target > 0 ? 'left' : target < 0 ? 'right' : null);
  };

  const down = (e: RPointerEvent<HTMLLIElement>) => {
    if (e.pointerType === 'mouse' || e.button !== 0) return;
    if (!(e.target as Element).closest('.chatrow') || leaving.current) return;
    const s = fresh();
    s.id = e.pointerId;
    s.sx = e.clientX;
    s.sy = e.clientY;
    s.x0 = x;
    s.lastX = e.clientX;
    s.lastT = e.timeStamp;
    s.finger = x;
    g.current = s;
    if (x === 0) {
      s.timer = window.setTimeout(() => {
        if (g.current !== s || s.axis) return;
        s.long = true;
        s.suppress = true;
        onMenu(chat);
      }, HOLD_MS);
    }
  };

  const move = (e: RPointerEvent<HTMLLIElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id || s.long) return;
    const dx = e.clientX - s.sx;
    const dy = e.clientY - s.sy;
    if (!s.axis) {
      if (Math.hypot(dx, dy) < SLOP) return;
      window.clearTimeout(s.timer);
      s.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (s.axis === 'x') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // The pointer is already gone
        }
        s.moved = true;
        s.suppress = true;
        setDragging(true);
      }
    }
    if (s.axis !== 'x') return;
    const p = s.x0 + dx;
    s.finger = p;
    const dt = e.timeStamp - s.lastT;
    if (dt > 0) s.v = (e.clientX - s.lastX) / dt;
    s.lastX = e.clientX;
    s.lastT = e.timeStamp;
    const isLong = p > width() * LONG_SHARE;
    setLong(isLong);
    setX(isLong ? p : band(p));
  };

  const up = (e: RPointerEvent<HTMLLIElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    window.clearTimeout(s.timer);
    if (s.axis === 'x') {
      setDragging(false);
      // A flick counts only if the finger was still moving when it lifted
      finish(s.finger, e.timeStamp - s.lastT < 80 ? s.v : 0);
    }
    s.id = -1;
  };

  const cancel = (e: RPointerEvent<HTMLLIElement>) => {
    const s = g.current;
    if (e.pointerId !== s.id) return;
    window.clearTimeout(s.timer);
    if (s.axis === 'x') {
      setDragging(false);
      finish(s.finger, 0);
    }
    s.id = -1;
  };

  const click = () => {
    const s = g.current;
    if (s.suppress) {
      s.suppress = false;
      return;
    }
    if (x !== 0 || side) {
      onSide(chat.key, null);
      return;
    }
    navigate(`/chat/${encodeURIComponent(chat.key)}`);
  };

  const menu = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (g.current.long) return;
    onMenu(chat);
  };

  const run = (act: RowAct) => {
    if (act === 'archive') {
      leave(() => onAct('archive', chat));
      return;
    }
    onSide(chat.key, null);
    onAct(act, chat);
  };

  const leftOpen = side === 'left';
  const rightOpen = side === 'right';
  const style = { '--w': `${Math.round(Math.abs(x))}px` } as CSSProperties;
  const ArchiveIcon = archived ? ArchiveRestore : Archive;

  return (
    <li
      ref={wrap}
      className={`chatswipe${long ? ' chatswipe--long' : ''}`}
      data-key={chat.key}
      style={style}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={cancel}
      onContextMenu={menu}
    >
      <div className="chatswipe__tray chatswipe__tray--left" aria-hidden={!leftOpen} style={{ visibility: x > 0 ? 'visible' : 'hidden' }}>
        <button type="button" className="chatswipe__btn chatswipe__btn--archive" tabIndex={leftOpen ? 0 : -1} onClick={() => run('archive')}>
          <ArchiveIcon size={22} strokeWidth={1.75} aria-hidden="true" />
          <span>{archived ? 'Unarchive' : 'Archive'}</span>
        </button>
        <button type="button" className="chatswipe__btn chatswipe__btn--mute" tabIndex={leftOpen ? 0 : -1} onClick={() => run('mute')}>
          {muted ? <Bell size={22} strokeWidth={1.75} aria-hidden="true" /> : <BellOff size={22} strokeWidth={1.75} aria-hidden="true" />}
          <span>{muted ? 'Unmute' : 'Mute'}</span>
        </button>
      </div>
      <div className="chatswipe__tray chatswipe__tray--right" aria-hidden={!rightOpen} style={{ visibility: x < 0 ? 'visible' : 'hidden' }}>
        <button type="button" className="chatswipe__btn chatswipe__btn--pin" tabIndex={rightOpen ? 0 : -1} onClick={() => run('pin')}>
          <Pin size={22} strokeWidth={1.75} aria-hidden="true" />
          <span>{pinned ? 'Unpin' : 'Pin'}</span>
        </button>
        <button type="button" className="chatswipe__btn chatswipe__btn--read" tabIndex={rightOpen ? 0 : -1} onClick={() => run('read')}>
          {asRead ? <MailOpen size={22} strokeWidth={1.75} aria-hidden="true" /> : <Mail size={22} strokeWidth={1.75} aria-hidden="true" />}
          <span>{asRead ? 'Read' : 'Unread'}</span>
        </button>
      </div>
      <button
        type="button"
        className={`chatrow${active ? ' chatrow--open' : ''}${dragging ? '' : ' chatrow--snap'}`}
        style={{ transform: x === 0 ? undefined : `translateX(${x}px)` }}
        onClick={click}
      >
        {chat.isGroup ? <AvatarPair people={chat.people} /> : <Avatar name={chat.name} email={chat.email} tone="hue" />}
        <span className="chatrow__main">
          <span className="chatrow__top">
            <span className="chatrow__name">{chat.name}</span>
            {showArchived && <Archive className="chatrow__arch" size={14} strokeWidth={1.75} aria-label="Archived" />}
            {chat.isNew && <span className="chatrow__new">New</span>}
            <span className={`chatrow__time${unread ? ' chatrow__time--unread' : ''}`}>{relativeTime(chat.lastAt)}</span>
          </span>
          <span className="chatrow__bottom">
            <span className="chatrow__preview">
              {showDraft ? (
                <>
                  <span className="chatrow__draft">Draft: </span>
                  {oneLine(draft)}
                </>
              ) : (
                <>
                  {chat.lastMine && <Check className="chatrow__check" size={16} strokeWidth={2} aria-label="Sent" />}
                  {chat.lastMine ? `You: ${chat.preview}` : chat.preview}
                </>
              )}
            </span>
            {muted && <BellOff className="chatrow__flag" size={15} strokeWidth={1.75} aria-label="Muted" />}
            {pinned && <Pin className="chatrow__flag chatrow__flag--pin" size={15} strokeWidth={1.75} aria-label="Pinned" />}
            {unread && (
              <span className={`chatrow__badge${muted ? ' chatrow__badge--muted' : ''}`} aria-label={`${chat.unread} unread`}>
                {chat.unread}
              </span>
            )}
            {!unread && marked && <span className={`chatrow__badge chatrow__badge--dot${muted ? ' chatrow__badge--muted' : ''}`} aria-label="Marked unread" />}
          </span>
        </span>
      </button>
      <button type="button" className="chatrow__more" aria-label="Chat options" onClick={() => onMenu(chat)}>
        <ChevronDown size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </li>
  );
}
