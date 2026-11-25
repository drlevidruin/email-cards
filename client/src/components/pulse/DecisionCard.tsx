import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Send,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { DraftTone, EmailThread, QuickActionChip } from '../../lib/types';
import {
  formatRelativeTime,
  getFallbackQuickActions,
  getInitials,
  getPrimarySender,
  getToneForChip,
  getUrgencyVisual,
} from './pulseUtils';

export interface DecisionCardProps {
  thread: EmailThread;
  index: number;
  onOpenThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void | Promise<void>;
  onSnoozeThread: (threadId: string, until?: string) => void | Promise<void>;
  onQuickDraft: (
    threadId: string,
    instruction: string,
    tone?: DraftTone,
  ) => void | Promise<void>;
}

const TONE_OPTIONS: { id: DraftTone; label: string }[] = [
  { id: 'direct', label: 'Direct' },
  { id: 'warm', label: 'Warm' },
  { id: 'executive', label: 'Exec' },
];

export const DecisionCard: React.FC<DecisionCardProps> = ({
  thread,
  index,
  onOpenThread,
  onArchiveThread,
  onSnoozeThread,
  onQuickDraft,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [replyInput, setReplyInput] = useState('');
  const [selectedTone, setSelectedTone] = useState<DraftTone>('direct');
  const [busyChipId, setBusyChipId] = useState<string | null>(null);
  const [isDraftingInline, setIsDraftingInline] = useState(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [showSnoozeMenu, setShowSnoozeMenu] = useState(false);

  const urgency = getUrgencyVisual(thread.urgencyScore);
  const sender = getPrimarySender(thread);
  const actions = getFallbackQuickActions(thread);
  const bullets =
    thread.aiSummaryBullets && thread.aiSummaryBullets.length > 0
      ? thread.aiSummaryBullets.slice(0, 3)
      : [thread.snippet];

  const primaryActionChips = actions.filter(
    (a) => a.kind !== 'snooze' && a.kind !== 'archive',
  );

  const triggerDraft = async (
    instruction: string,
    tone: DraftTone,
    chipId?: string,
  ) => {
    if (!instruction.trim()) return;
    if (chipId) setBusyChipId(chipId);
    else setIsDraftingInline(true);

    try {
      await onQuickDraft(thread.id, instruction.trim(), tone);
      setDraftNotice('Draft queued in Approval Dock');
      if (!chipId) setReplyInput('');
      window.setTimeout(() => {
        setDraftNotice((prev) =>
          prev === 'Draft queued in Approval Dock' ? null : prev,
        );
      }, 3600);
    } finally {
      setBusyChipId(null);
      setIsDraftingInline(false);
    }
  };

  const handleChipClick = async (chip: QuickActionChip) => {
    if (chip.kind === 'archive') {
      await onArchiveThread(thread.id);
      return;
    }
    if (chip.kind === 'snooze') {
      setShowSnoozeMenu((prev) => !prev);
      return;
    }
    const hint = chip.draftHint || chip.label;
    await triggerDraft(hint, getToneForChip(chip), chip.id);
  };

  const handleSnoozeOption = async (hoursFromNow: number) => {
    setShowSnoozeMenu(false);
    const target = new Date(Date.now() + hoursFromNow * 3600 * 1000).toISOString();
    await onSnoozeThread(thread.id, target);
  };

  const handleInlineSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyInput.trim() || isDraftingInline) return;
    await triggerDraft(replyInput, selectedTone);
  };

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, y: -6 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.04, 0.24), ease: [0.22, 1, 0.36, 1] }}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-900/[0.09] bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_28px_-14px_rgba(15,23,42,0.10)] backdrop-blur-xl transition-all duration-200 hover:border-slate-900/[0.16] dark:border-white/[0.08] dark:bg-[#0F1420]/90 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_14px_34px_-16px_rgba(0,0,0,0.65)] dark:hover:border-white/[0.15]"
    >
      {/* Luminous urgency heat-edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-[3.5px]"
        style={{ background: urgency.edgeGradient }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-8 top-0 h-32 w-32 rounded-full opacity-55 blur-2xl transition-opacity duration-300 group-hover:opacity-80 dark:opacity-75"
        style={{ background: urgency.glowColor }}
      />

      <div className="relative p-5 pb-4 pl-6">
        {/* Top Metadata Row */}
        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2.5">
            {/* Sender avatar */}
            <div
              className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold tracking-tight text-slate-800 dark:text-slate-100"
              style={{
                borderColor: `${thread.accountColor}55`,
                background: `linear-gradient(135deg, ${thread.accountColor}28, ${thread.accountColor}08)`,
              }}
            >
              {getInitials(sender.name)}
              {thread.isUnread && (
                <span
                  className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-[#0F1420]"
                  style={{ backgroundColor: urgency.dotColor }}
                />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  {sender.name}
                </span>
                {thread.messageCount > 1 && (
                  <span className="font-mono-num rounded bg-slate-900/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-400">
                    {thread.messageCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: thread.accountColor }}
                  />
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {thread.accountLabel}
                  </span>
                </span>
                <span className="opacity-40">/</span>
                <span className="font-mono-num">{formatRelativeTime(thread.lastMessageAt)}</span>
              </div>
            </div>
          </div>

          {/* Right badges: Deadline + Urgency score + Open button */}
          <div className="flex items-center gap-1.5">
            {thread.deadlineLabel && (
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${urgency.badgeClass}`}
              >
                <Clock className="h-3 w-3 shrink-0" />
                <span>{thread.deadlineLabel}</span>
              </span>
            )}

            <span
              title={`Urgency score ${thread.urgencyScore} out of 100`}
              className="font-mono-num inline-flex items-center gap-1 rounded-full border border-slate-900/[0.08] bg-slate-900/[0.03] px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-300"
            >
              <Zap className="h-2.5 w-2.5" style={{ color: urgency.dotColor }} />
              {thread.urgencyScore}
            </span>

            <button
              type="button"
              onClick={() => onOpenThread(thread.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-colors hover:border-slate-900/[0.08] hover:bg-slate-900/[0.04] hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/[0.1] dark:hover:bg-white/[0.06] dark:hover:text-white"
              title="Open thread in Crystal Reader"
              aria-label={`Open ${thread.subject}`}
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Distilled Ask Hero */}
        <button
          type="button"
          onClick={() => onOpenThread(thread.id)}
          className="block w-full text-left focus:outline-none"
        >
          <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
            <Sparkles className="h-3 w-3 text-sky-500 dark:text-sky-400" />
            <span>Distilled Ask</span>
          </div>
          <h3 className="text-[15.5px] font-semibold leading-[1.38] tracking-[-0.01em] text-slate-950 transition-colors group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-200">
            {thread.distilledAsk || thread.subject}
          </h3>
          {thread.distilledAsk && (
            <p className="mt-1.5 truncate text-[12.5px] text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-600 dark:text-slate-300">Re:</span>{' '}
              {thread.subject}
            </p>
          )}
        </button>

        {/* Expandable 2-Bullet AI Context */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                expanded ? 'rotate-180' : ''
              }`}
            />
            <span>
              {expanded ? 'Hide brief context' : `${bullets.length} key takeaways`}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {expanded && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="mt-2.5 space-y-1.5 overflow-hidden rounded-xl border border-slate-900/[0.06] bg-slate-900/[0.025] px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-700 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-slate-300"
              >
                {bullets.map((bullet, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full opacity-75"
                      style={{ backgroundColor: thread.accountColor }}
                    />
                    <span>{bullet}</span>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        {/* One-Click Smart Action Chips */}
        <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
          {primaryActionChips.slice(0, 3).map((chip, idx) => {
            const isBusy = busyChipId === chip.id;
            const isPrimary = idx === 0;
            return (
              <button
                key={chip.id}
                type="button"
                disabled={isBusy}
                onClick={() => handleChipClick(chip)}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] font-medium transition-all active:scale-[0.98] disabled:opacity-60 ${
                  isPrimary
                    ? 'border-sky-500/30 bg-sky-500/15 text-sky-700 hover:bg-sky-500/20 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:hover:bg-sky-400/20'
                    : 'border-slate-900/[0.09] bg-slate-900/[0.03] text-slate-700 hover:border-slate-900/[0.18] hover:bg-slate-900/[0.06] dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-white/[0.16] dark:hover:bg-white/[0.08]'
                }`}
              >
                <Sparkles className="h-3 w-3 shrink-0 opacity-80" />
                <span>{isBusy ? 'Drafting...' : chip.label}</span>
              </button>
            );
          })}

          {/* Snooze chip with inline quick presets */}
          {showSnoozeMenu ? (
            <div className="inline-flex items-center gap-1 rounded-lg border border-sky-500/30 bg-sky-500/[0.08] px-1.5 py-0.5 dark:border-sky-400/25 dark:bg-sky-400/[0.08]">
              {[
                { label: '+3h', hours: 3 },
                { label: 'Tomorrow', hours: 18 },
                { label: 'Next wk', hours: 120 },
              ].map((opt) => (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => handleSnoozeOption(opt.hours)}
                  className="rounded-md px-1.5 py-1 text-[11px] font-medium text-sky-800 transition-colors hover:bg-sky-500/20 dark:text-sky-200 dark:hover:bg-sky-400/20"
                >
                  {opt.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setShowSnoozeMenu(false)}
                className="rounded-md px-1.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSnoozeMenu(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-900/[0.09] bg-slate-900/[0.02] px-2.5 py-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:border-slate-900/[0.16] hover:bg-slate-900/[0.05] hover:text-slate-900 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.15] dark:hover:bg-white/[0.07] dark:hover:text-white"
            >
              <CalendarClock className="h-3.5 w-3.5 opacity-75" />
              <span>Snooze</span>
            </button>
          )}

          {/* Done / Archive chip */}
          <button
            type="button"
            onClick={() => onArchiveThread(thread.id)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/20 bg-emerald-500/[0.08] px-2.5 py-1.5 text-[12px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/[0.16] dark:border-emerald-400/20 dark:bg-emerald-400/[0.08] dark:text-emerald-300 dark:hover:bg-emerald-400/[0.16]"
          >
            <Check className="h-3.5 w-3.5" />
            <span>Done</span>
          </button>
        </div>
      </div>

      {/* Inline 1-Line Instant AI Reply Bar */}
      <div className="relative border-t border-slate-900/[0.06] bg-slate-900/[0.02] px-4 py-2.5 pl-6 dark:border-white/[0.06] dark:bg-black/20">
        {draftNotice ? (
          <div className="flex items-center justify-between gap-2 py-0.5 text-[12px] font-medium text-emerald-700 dark:text-emerald-300">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>{draftNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => setDraftNotice(null)}
              className="text-[11px] opacity-75 hover:opacity-100"
            >
              Draft another
            </button>
          </div>
        ) : (
          <form onSubmit={handleInlineSubmit} className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-violet-500 dark:text-violet-400" />
            <input
              type="text"
              value={replyInput}
              onChange={(e) => setReplyInput(e.target.value)}
              placeholder='Instruct Claude (e.g. "Yes, Thu 2pm")'
              className="min-w-0 flex-1 bg-transparent text-[12.5px] text-slate-800 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <div className="hidden items-center rounded-md border border-slate-900/[0.08] bg-white/70 p-0.5 sm:flex dark:border-white/[0.07] dark:bg-white/[0.03]">
              {TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTone(t.id)}
                  className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                    selectedTone === t.id
                      ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white'
                      : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!replyInput.trim() || isDraftingInline}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1 text-[11.5px] font-medium text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-white/15 dark:text-white dark:hover:bg-white/20"
            >
              <Send className="h-3 w-3" />
              <span>{isDraftingInline ? 'Drafting' : 'Draft'}</span>
            </button>
          </form>
        )}
      </div>
    </motion.article>
  );
};
