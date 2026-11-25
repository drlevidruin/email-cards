import React, { useState } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from 'framer-motion';
import {
  ArrowUpRight,
  Bookmark,
  CheckCircle2,
  Clock,
  FileText,
  Receipt,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import type { DraftTone, EmailThread, QuickActionChip } from '../../lib/types';
import {
  formatCurrency,
  formatDeadlineLabel,
  formatTimeAgo,
  getAvatarPalette,
  getCardQuickDraftChips,
  getInitials,
  getPrimarySender,
  getReadablePreview,
  getToneForChip,
} from './deckUtils';

export type SwipeDirection = 'left' | 'right' | 'up' | 'down';

export interface SwipeEmailCardProps {
  thread: EmailThread;
  exitingDirection: SwipeDirection | null;
  onSwipe: (direction: SwipeDirection) => void;
  onOpenThread: (threadId: string, startReply?: boolean) => void;
  onQuickDraft: (
    threadId: string,
    instruction: string,
    tone?: DraftTone,
  ) => Promise<void>;
  onOpenDrafts: () => void;
}

const SWIPE_X_THRESHOLD = 95;
const SWIPE_Y_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 420;

export const SwipeEmailCard: React.FC<SwipeEmailCardProps> = ({
  thread,
  exitingDirection,
  onSwipe,
  onOpenThread,
  onQuickDraft,
  onOpenDrafts,
}) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const rotate = useTransform(x, [-280, 0, 280], [-12, 0, 12]);
  const archiveStampOpacity = useTransform(x, [-130, -32], [1, 0]);
  const replyStampOpacity = useTransform(x, [32, 130], [0, 1]);
  const bookmarkStampOpacity = useTransform(y, [-115, -30], [1, 0]);
  const snoozeStampOpacity = useTransform(y, [30, 115], [0, 1]);

  const [busyChipId, setBusyChipId] = useState<string | null>(null);
  const [quickNoteOpen, setQuickNoteOpen] = useState(false);
  const [quickNoteText, setQuickNoteText] = useState('');
  const [isDraftingNote, setIsDraftingNote] = useState(false);
  const [draftSavedLabel, setDraftSavedLabel] = useState<string | null>(null);

  const sender = getPrimarySender(thread);
  const avatar = getAvatarPalette(sender.email || sender.name);
  const deadline = formatDeadlineLabel(thread.deadlineLabel);
  const isUrgentDecision =
    thread.bucket === 'decision' || thread.urgencyScore >= 75;
  const quickChips = getCardQuickDraftChips(thread);
  const previewText = getReadablePreview(thread);
  const isNewsletter = thread.bucket === 'feed';
  const summaryText =
    thread.distilledAsk ||
    (thread.aiSummaryBullets && thread.aiSummaryBullets[0]) ||
    null;

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

  const handleQuickChip = async (chip: QuickActionChip) => {
    setBusyChipId(chip.id);
    try {
      await onQuickDraft(
        thread.id,
        chip.draftHint || chip.label,
        getToneForChip(chip),
      );
      setDraftSavedLabel('Draft saved to Drafts');
    } finally {
      setBusyChipId(null);
    }
  };

  const handleQuickNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = quickNoteText.trim();
    if (!trimmed || isDraftingNote) return;
    setIsDraftingNote(true);
    try {
      await onQuickDraft(thread.id, trimmed, 'direct');
      setQuickNoteText('');
      setQuickNoteOpen(false);
      setDraftSavedLabel('Draft saved to Drafts');
    } finally {
      setIsDraftingNote(false);
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
      drag={!exitingDirection && !quickNoteOpen}
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
      {/* Subtle top account color hairline */}
      <div
        aria-hidden="true"
        className="h-[3px] w-full"
        style={{ backgroundColor: thread.accountColor }}
      />

      {/* STAMP: LEFT -> ARCHIVE (crisp rose/slate) */}
      <motion.div
        style={{
          opacity: exitingDirection === 'left' ? 1 : archiveStampOpacity,
        }}
        className="pointer-events-none absolute right-6 top-7 z-30 rotate-[12deg] rounded-xl border-[3px] border-rose-500 bg-white/95 px-4 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-rose-600 shadow-sm"
      >
        ARCHIVE
      </motion.div>

      {/* STAMP: RIGHT -> REPLY (crisp royal blue) */}
      <motion.div
        style={{
          opacity: exitingDirection === 'right' ? 1 : replyStampOpacity,
        }}
        className="pointer-events-none absolute left-6 top-7 z-30 -rotate-[12deg] rounded-xl border-[3px] border-blue-600 bg-white/95 px-4 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-blue-600 shadow-sm"
      >
        REPLY
      </motion.div>

      {/* STAMP: UP -> BOOKMARK (crisp gold) */}
      <motion.div
        style={{
          opacity: exitingDirection === 'up' ? 1 : bookmarkStampOpacity,
        }}
        className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 rounded-xl border-[3px] border-amber-500 bg-white/95 px-5 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-amber-600 shadow-sm"
      >
        BOOKMARK
      </motion.div>

      {/* STAMP: DOWN -> SNOOZE (crisp violet) */}
      <motion.div
        style={{
          opacity: exitingDirection === 'down' ? 1 : snoozeStampOpacity,
        }}
        className="pointer-events-none absolute left-1/2 top-8 z-30 -translate-x-1/2 rounded-xl border-[3px] border-violet-600 bg-white/95 px-5 py-1.5 text-[20px] font-extrabold tracking-[0.14em] text-violet-700 shadow-sm"
      >
        SNOOZE
      </motion.div>

      {/* CARD CONTENT */}
      <div className="p-5 sm:p-7">
        {/* 1. Top Row: Sender + Account Pill + Deadline / Starred */}
        <div className="flex flex-wrap items-start justify-between gap-2.5 sm:gap-3">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div
              className="flex h-9 w-9 sm:h-11 sm:w-11 shrink-0 items-center justify-center rounded-full border text-[12.5px] sm:text-[13.5px] font-bold tracking-tight"
              style={{
                backgroundColor: avatar.bg,
                color: avatar.text,
                borderColor: avatar.border,
              }}
            >
              {getInitials(sender.name)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="truncate text-[14.5px] sm:text-[15px] font-semibold text-[#111827]">
                  {sender.name}
                </span>
                <span className="shrink-0 text-[12px] sm:text-[12.5px] font-medium text-[#6B7280]">
                  {formatTimeAgo(thread.lastMessageAt)}
                </span>
              </div>
              <div className="truncate text-[12px] sm:text-[12.5px] text-[#6B7280]">
                {sender.email}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {thread.isStarred && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11px] sm:text-[11.5px] font-semibold text-amber-700">
                <Bookmark className="h-3 w-3 fill-amber-500 text-amber-600" />
                <span>Bookmarked</span>
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11.5px] sm:text-[12px] font-medium text-[#374151]">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: thread.accountColor }}
              />
              <span>{thread.accountLabel}</span>
            </span>

            {deadline && (
              <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 sm:px-2.5 sm:py-1 text-[11.5px] sm:text-[12px] font-semibold text-rose-700">
                <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
                <span>{deadline}</span>
              </span>
            )}
          </div>
        </div>

        {/* 2. Large, Crisp Subject Line */}
        <h2 className="mt-3.5 sm:mt-5 text-[19px] sm:text-[22px] font-semibold leading-[1.26] sm:leading-[1.28] tracking-[-0.02em] text-[#111827]">
          {thread.subject}
        </h2>

        {/* 3. Highlighted "What they need" Summary Box */}
        {summaryText && (
          <div
            className={`mt-3 sm:mt-4 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3.5 ${
              isUrgentDecision
                ? 'border-[#FDE68A] bg-[#FEFCE8]'
                : 'border-[#E2E8F0] bg-[#F8FAFC]'
            }`}
          >
            <div
              className={`mb-1 flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-bold uppercase tracking-[0.09em] ${
                isUrgentDecision ? 'text-amber-800' : 'text-slate-500'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{isUrgentDecision ? 'What they need' : 'Quick summary'}</span>
            </div>
            <p className="text-[14px] sm:text-[15px] font-medium leading-[1.45] sm:leading-[1.48] text-[#111827]">
              {summaryText}
            </p>
          </div>
        )}

        {/* 4. Receipt Pill (if receiptInfo exists) */}
        {thread.receiptInfo && (
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 sm:px-3.5 sm:py-2.5">
            <div className="flex items-center gap-2 text-[13px] sm:text-[13.5px] font-medium text-[#111827]">
              <Receipt className="h-4 w-4 text-emerald-700" />
              <span>{thread.receiptInfo.vendor}</span>
              {thread.receiptInfo.invoiceNumber && (
                <span className="font-mono-num rounded border border-emerald-200 bg-white px-1.5 py-0.5 text-[11px] text-[#4B5563]">
                  {thread.receiptInfo.invoiceNumber}
                </span>
              )}
              <span className="text-[12px] text-[#4B5563]">
                ({thread.receiptInfo.category})
              </span>
            </div>
            <span className="font-mono-num text-[14.5px] sm:text-[15px] font-bold text-emerald-800">
              {formatCurrency(
                thread.receiptInfo.amount,
                thread.receiptInfo.currency,
              )}
            </span>
          </div>
        )}

        {/* 5. Clean Readable Email Preview or Newsletter 2-Bullet Takeaways */}
        <div className="mt-3 sm:mt-4">
          {isNewsletter &&
          thread.aiSummaryBullets &&
          thread.aiSummaryBullets.length > 0 ? (
            <ul className="space-y-1.5 sm:space-y-2 text-[14px] sm:text-[15px] leading-[1.52] sm:leading-[1.58] text-[#374151]">
              {thread.aiSummaryBullets.slice(0, 2).map((bullet, idx) => (
                <li key={idx} className="flex items-start gap-2.5">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: thread.accountColor }}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="line-clamp-3 sm:line-clamp-4 text-[14.5px] sm:text-[15px] leading-[1.55] sm:leading-[1.6] text-[#374151]">
              {previewText}
            </p>
          )}

          {/* Read Full Thread Link */}
          <div
            className="mt-2.5 sm:mt-3.5 flex items-center justify-between gap-2"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => onOpenThread(thread.id, false)}
              className="inline-flex items-center gap-1.5 text-[13px] sm:text-[13.5px] font-semibold text-[#2563EB] transition-colors hover:text-[#1D4ED8]"
            >
              <FileText className="h-3.5 w-3.5" />
              <span>
                Read full thread ({thread.messageCount}{' '}
                {thread.messageCount === 1 ? 'message' : 'messages'})
              </span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 6. Bottom Quick Reply Chips + Optional Inline Claude Note */}
        <div
          className="mt-3.5 sm:mt-5 border-t border-[#F3F4F6] pt-3 sm:pt-4"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {draftSavedLabel ? (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-[13px] font-medium text-emerald-800">
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>{draftSavedLabel}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onOpenDrafts}
                  className="rounded-lg bg-emerald-700 px-2.5 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-800"
                >
                  Open Drafts
                </button>
                <button
                  type="button"
                  onClick={() => setDraftSavedLabel(null)}
                  className="text-emerald-700 hover:text-emerald-900"
                  aria-label="Dismiss notice"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {quickChips.map((chip) => {
                  const isBusy = busyChipId === chip.id;
                  const label = /^draft:/i.test(chip.label)
                    ? chip.label
                    : `Draft: ${chip.label}`;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleQuickChip(chip)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1.5 text-[12.5px] font-semibold text-[#1D4ED8] transition-all hover:border-[#93C5FD] hover:bg-[#DBEAFE] active:scale-[0.98] disabled:opacity-60"
                    >
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span>{isBusy ? 'Drafting...' : label}</span>
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setQuickNoteOpen((prev) => !prev)}
                  className="ml-auto inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#4B5563] transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
                >
                  <span>
                    {quickNoteOpen ? 'Cancel' : 'Quick note to Claude...'}
                  </span>
                </button>
              </div>

              {quickNoteOpen && (
                <form
                  onSubmit={handleQuickNoteSubmit}
                  className="flex items-center gap-2 rounded-xl border border-[#D1D5DB] bg-[#F9FAFB] px-3 py-1.5 focus-within:border-[#2563EB] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-100"
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0 text-[#2563EB]" />
                  <input
                    type="text"
                    autoFocus
                    value={quickNoteText}
                    onChange={(e) => setQuickNoteText(e.target.value)}
                    placeholder='e.g. "Yes for Thursday at 2pm"'
                    className="min-w-0 flex-1 bg-transparent text-[13.5px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!quickNoteText.trim() || isDraftingNote}
                    className="inline-flex items-center gap-1 rounded-lg bg-[#2563EB] px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-[#1D4ED8] disabled:opacity-45"
                  >
                    <Send className="h-3 w-3" />
                    <span>{isDraftingNote ? 'Drafting' : 'Draft'}</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
};
