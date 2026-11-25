import React from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import { Globe, ShieldCheck, Sparkles } from 'lucide-react';
import type { GmailAccount, ScreenerSender } from '../../lib/types';
import { formatTimeAgo, getAvatarPalette, getInitials } from './deckUtils';
import type { SwipeDirection } from './SwipeEmailCard';

export interface SwipeScreenerCardProps {
  sender: ScreenerSender;
  account?: GmailAccount;
  exitingDirection: SwipeDirection | null;
  onSwipe: (direction: SwipeDirection) => void;
}

const SWIPE_X_THRESHOLD = 95;
const SWIPE_Y_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 420;

function getRecommendationStyle(rec: ScreenerSender['aiRecommendation']) {
  if (rec === 'approve') {
    return {
      title: 'Recommended: Approve to Inbox',
      boxClass: 'border-emerald-200 bg-emerald-50',
      labelClass: 'text-emerald-800',
    };
  }
  if (rec === 'feed') {
    return {
      title: 'Recommended: Send to Newsletters Feed',
      boxClass: 'border-blue-200 bg-blue-50',
      labelClass: 'text-blue-800',
    };
  }
  return {
    title: 'Recommended: Mute Sender',
    boxClass: 'border-rose-200 bg-rose-50',
    labelClass: 'text-rose-800',
  };
}

export const SwipeScreenerCard: React.FC<SwipeScreenerCardProps> = ({
  sender,
  account,
  exitingDirection,
  onSwipe,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-280, 0, 280], [-12, 0, 12]);
  const muteStampOpacity = useTransform(x, [-130, -32], [1, 0]);
  const approveStampOpacity = useTransform(x, [32, 130], [0, 1]);
  const bookmarkStampOpacity = useTransform(y, [-115, -30], [1, 0]);
  const feedStampOpacity = useTransform(y, [30, 115], [0, 1]);

  const avatar = getAvatarPalette(sender.email || sender.name);
  const rec = getRecommendationStyle(sender.aiRecommendation);

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) => {
    if (exitingDirection) return;
    const { offset, velocity } = info;
    const absX = Math.abs(offset.x);
    const absY = Math.abs(offset.y);

    if (absX >= absY) {
      if (offset.x <= -SWIPE_X_THRESHOLD || velocity.x <= -VELOCITY_THRESHOLD) {
        onSwipe('left');
        return;
      }
      if (offset.x >= SWIPE_X_THRESHOLD || velocity.x >= VELOCITY_THRESHOLD) {
        onSwipe('right');
        return;
      }
    } else {
      if (offset.y <= -SWIPE_Y_THRESHOLD || velocity.y <= -VELOCITY_THRESHOLD) {
        onSwipe('up');
        return;
      }
      if (offset.y >= SWIPE_Y_THRESHOLD || velocity.y >= VELOCITY_THRESHOLD) {
        onSwipe('down');
      }
    }
  };

  const exitTarget =
    exitingDirection === 'left'
      ? { x: -620, y: 20, rotate: -15, opacity: 0 }
      : exitingDirection === 'right'
        ? { x: 620, y: 20, rotate: 15, opacity: 0 }
        : exitingDirection === 'up'
          ? { x: 0, y: -520, scale: 0.94, opacity: 0 }
          : exitingDirection === 'down'
            ? { x: 0, y: 520, scale: 0.94, opacity: 0 }
            : { x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 };

  return (
    <motion.article
      style={
        exitingDirection
          ? { touchAction: 'none' }
          : { x, y, rotate, touchAction: 'none' }
      }
      initial={{ scale: 0.96, y: 14, opacity: 0.85 }}
      animate={exitTarget}
      transition={
        exitingDirection
          ? { duration: 0.26, ease: [0.22, 1, 0.36, 1] }
          : { type: 'spring', stiffness: 400, damping: 32 }
      }
      drag={!exitingDirection}
      dragSnapToOrigin
      dragElastic={0.85}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      className={`relative w-full touch-none select-none overflow-hidden rounded-[22px] sm:rounded-[24px] border border-[#E5E7EB] bg-white shadow-[0_18px_48px_-14px_rgba(15,23,42,0.12),0_2px_6px_-1px_rgba(15,23,42,0.05)] ${
        exitingDirection
          ? 'pointer-events-none'
          : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      <div
        aria-hidden="true"
        className="h-[3px] w-full"
        style={{ backgroundColor: sender.accountColor }}
      />

      {/* LEFT -> MUTE */}
      <motion.div
        style={{
          opacity: exitingDirection === 'left' ? 1 : muteStampOpacity,
        }}
        className="pointer-events-none absolute right-6 top-7 z-30 rotate-[12deg] rounded-xl border-[3px] border-rose-600 bg-white/95 px-4 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-rose-600 shadow-sm"
      >
        MUTE
      </motion.div>

      {/* RIGHT -> APPROVE */}
      <motion.div
        style={{
          opacity: exitingDirection === 'right' ? 1 : approveStampOpacity,
        }}
        className="pointer-events-none absolute left-6 top-7 z-30 -rotate-[12deg] rounded-xl border-[3px] border-emerald-600 bg-white/95 px-4 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-emerald-700 shadow-sm"
      >
        APPROVE
      </motion.div>

      {/* UP -> BOOKMARK & APPROVE */}
      <motion.div
        style={{
          opacity: exitingDirection === 'up' ? 1 : bookmarkStampOpacity,
        }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-xl border-[3px] border-amber-500 bg-white/95 px-5 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-amber-600 shadow-sm"
      >
        BOOKMARK
      </motion.div>

      {/* DOWN -> TO FEED */}
      <motion.div
        style={{
          opacity: exitingDirection === 'down' ? 1 : feedStampOpacity,
        }}
        className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2 rounded-xl border-[3px] border-violet-600 bg-white/95 px-5 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-violet-700 shadow-sm"
      >
        TO FEED
      </motion.div>

      <div className="p-5 sm:p-7">
        {/* Top Row: First-Time Badge + Account Pill */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 sm:px-3 sm:py-1 text-[11px] sm:text-[11.5px] font-bold uppercase tracking-[0.08em] text-indigo-700">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>First-Time Sender</span>
          </span>

          <div className="flex items-center gap-2">
            <span className="text-[12px] sm:text-[12.5px] text-[#6B7280]">
              First seen {formatTimeAgo(sender.firstSeenAt)}
            </span>
            {account && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-0.5 sm:py-1 text-[11.5px] sm:text-[12px] font-medium text-[#374151]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: sender.accountColor }}
                />
                <span>{account.label}</span>
              </span>
            )}
          </div>
        </div>

        {/* Sender Identity Hero */}
        <div className="mt-4 sm:mt-5 flex items-center gap-3 sm:gap-4">
          <div
            className="flex h-12 w-12 sm:h-14 sm:w-14 shrink-0 items-center justify-center rounded-2xl border text-[16px] sm:text-[18px] font-bold"
            style={{
              backgroundColor: avatar.bg,
              color: avatar.text,
              borderColor: avatar.border,
            }}
          >
            {getInitials(sender.name)}
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[19px] sm:text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">
              {sender.name}
            </h2>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5 sm:gap-2 text-[12.5px] sm:text-[13.5px] text-[#4B5563]">
              <span className="truncate">{sender.email}</span>
              <span className="inline-flex items-center gap-1 rounded-md bg-[#F3F4F6] px-2 py-0.5 text-[11.5px] sm:text-[12px] font-medium text-[#4B5563]">
                <Globe className="h-3 w-3" />
                {sender.domain}
              </span>
            </div>
          </div>
        </div>

        {/* Claude Recommendation Box */}
        <div className={`mt-4 sm:mt-5 rounded-2xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${rec.boxClass}`}>
          <div
            className={`mb-1 flex items-center gap-1.5 text-[11px] sm:text-[11.5px] font-bold uppercase tracking-[0.08em] ${rec.labelClass}`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{rec.title}</span>
          </div>
          <p className="text-[14px] sm:text-[14.5px] leading-[1.5] sm:leading-[1.55] text-[#1F2937]">
            {sender.aiReason}
          </p>
        </div>

        {/* Sample Message Preview */}
        <div className="mt-4 sm:mt-5 rounded-2xl border border-[#E5E7EB] bg-[#F9FAFB] p-3.5 sm:p-4">
          <div className="text-[10.5px] sm:text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
            Message Preview
          </div>
          <div className="mt-1 sm:mt-1.5 text-[15px] sm:text-[16px] font-semibold text-[#111827]">
            {sender.sampleSubject}
          </div>
          <p className="mt-1 sm:mt-1.5 line-clamp-3 sm:line-clamp-4 text-[14px] sm:text-[14.5px] leading-[1.52] sm:leading-[1.58] text-[#374151]">
            {sender.sampleSnippet}
          </p>
        </div>
      </div>
    </motion.article>
  );
};
