import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock,
  Handshake,
  Hourglass,
  Sparkles,
} from 'lucide-react';
import type { CommitmentItem, DraftTone } from '../../lib/types';

export interface CommitmentRadarProps {
  commitments: CommitmentItem[];
  onOpenThread: (threadId: string) => void;
  onQuickDraft: (
    threadId: string,
    instruction: string,
    tone?: DraftTone,
  ) => void | Promise<void>;
  onResolveCommitment: (commitmentId: string) => void | Promise<void>;
  onNudgeCommitment: (commitmentId: string) => void | Promise<void>;
}

export const CommitmentRadar: React.FC<CommitmentRadarProps> = ({
  commitments,
  onOpenThread,
  onQuickDraft,
  onResolveCommitment,
  onNudgeCommitment,
}) => {
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [draftingId, setDraftingId] = useState<string | null>(null);
  const [justNudged, setJustNudged] = useState<Record<string, boolean>>({});
  const [justDrafted, setJustDrafted] = useState<Record<string, boolean>>({});

  const openItems = commitments.filter((c) => c.status !== 'resolved');
  const youPromised = openItems.filter((c) => c.direction === 'you_promised');
  const waitingOnThem = openItems.filter((c) => c.direction === 'waiting_on_them');
  const resolvedCount = commitments.filter((c) => c.status === 'resolved').length;

  const handleNudge = async (item: CommitmentItem) => {
    setNudgingId(item.id);
    try {
      await onNudgeCommitment(item.id);
      setJustNudged((prev) => ({ ...prev, [item.id]: true }));
    } finally {
      setNudgingId(null);
    }
  };

  const handleFollowUp = async (item: CommitmentItem) => {
    setDraftingId(item.id);
    try {
      await onQuickDraft(
        item.threadId,
        `Follow up on my commitment: ${item.summary}. Confirm current progress and next step.`,
        'warm',
      );
      setJustDrafted((prev) => ({ ...prev, [item.id]: true }));
    } finally {
      setDraftingId(null);
    }
  };

  return (
    <section id="pulse-commitments" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
              Commitment Radar
            </h2>
            <span className="font-mono-num rounded-full border border-slate-900/[0.08] bg-slate-900/[0.03] px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.05] dark:text-slate-300">
              {openItems.length} open
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            Promises you made and responses you are waiting on across merged Gmail accounts.
          </p>
        </div>

        {resolvedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{resolvedCount} resolved</span>
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left Column: You Promised */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-900/[0.08] bg-white/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-white/[0.08] dark:bg-[#0D121D]/90">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-amber-500/80 via-amber-400/40 to-transparent"
          />

          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <Handshake className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                You Promised
              </h3>
            </div>
            <span className="font-mono-num rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">
              {youPromised.length}
            </span>
          </div>

          {youPromised.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-900/[0.08] px-4 py-6 text-center text-[12.5px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
              Every outbound promise is cleared.
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {youPromised.map((item) => {
                  const drafted = justDrafted[item.id];
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-slate-900/[0.07] bg-slate-900/[0.015] p-3.5 transition-colors hover:border-amber-500/30 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:border-amber-400/25"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.accountColor }}
                          />
                          <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                            {item.counterpartyName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.accountLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-num inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-medium text-amber-700 dark:text-amber-300">
                            <Clock className="h-2.5 w-2.5" />
                            {item.daysOpen}d open
                          </span>
                          {item.dueLabel && (
                            <span className="font-mono-num text-[10.5px] text-slate-500 dark:text-slate-400">
                              {item.dueLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-[13px] leading-snug text-slate-700 dark:text-slate-200">
                        {item.summary}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenThread(item.threadId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-900/[0.09] bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.04] dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                        >
                          <span>Open Thread</span>
                          <ArrowUpRight className="h-3 w-3 opacity-70" />
                        </button>

                        <button
                          type="button"
                          disabled={draftingId === item.id}
                          onClick={() => handleFollowUp(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11.5px] font-medium text-amber-800 transition-colors hover:bg-amber-500/20 disabled:opacity-60 dark:border-amber-400/25 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>
                            {draftingId === item.id
                              ? 'Drafting...'
                              : drafted
                                ? 'Follow-up Queued'
                                : 'Draft Follow-up'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onResolveCommitment(item.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Mark Done</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right Column: Waiting On Others */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-900/[0.08] bg-white/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] dark:border-white/[0.08] dark:bg-[#0D121D]/90">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-sky-500/80 via-sky-400/40 to-transparent"
          />

          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Hourglass className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-[13.5px] font-semibold text-slate-900 dark:text-slate-100">
                Waiting On Others
              </h3>
            </div>
            <span className="font-mono-num rounded-full bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
              {waitingOnThem.length}
            </span>
          </div>

          {waitingOnThem.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-900/[0.08] px-4 py-6 text-center text-[12.5px] text-slate-500 dark:border-white/[0.08] dark:text-slate-400">
              Nobody owes you a pending reply right now.
            </div>
          ) : (
            <div className="space-y-2.5">
              <AnimatePresence initial={false}>
                {waitingOnThem.map((item) => {
                  const nudged = item.status === 'nudged' || justNudged[item.id];
                  return (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      className="rounded-xl border border-slate-900/[0.07] bg-slate-900/[0.015] p-3.5 transition-colors hover:border-sky-500/30 dark:border-white/[0.07] dark:bg-white/[0.025] dark:hover:border-sky-400/25"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: item.accountColor }}
                          />
                          <span className="text-[12.5px] font-semibold text-slate-900 dark:text-slate-100">
                            {item.counterpartyName}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400">
                            {item.accountLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="font-mono-num inline-flex items-center gap-1 rounded-full bg-sky-500/15 px-2 py-0.5 text-[10.5px] font-medium text-sky-700 dark:text-sky-300">
                            <Clock className="h-2.5 w-2.5" />
                            {item.daysOpen}d waiting
                          </span>
                          {item.dueLabel && (
                            <span className="font-mono-num text-[10.5px] text-slate-500 dark:text-slate-400">
                              {item.dueLabel}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="mt-2 text-[13px] leading-snug text-slate-700 dark:text-slate-200">
                        {item.summary}
                      </p>

                      <div className="mt-3 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={nudgingId === item.id}
                          onClick={() => handleNudge(item)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-60 ${
                            nudged
                              ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300'
                              : 'border-sky-500/30 bg-sky-500/15 text-sky-700 hover:bg-sky-500/20 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-200 dark:hover:bg-sky-400/25'
                          }`}
                        >
                          <BellRing className="h-3 w-3" />
                          <span>
                            {nudgingId === item.id
                              ? 'Queuing Nudge...'
                              : nudged
                                ? 'Nudge Queued in Dock'
                                : 'Draft Polite Nudge'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenThread(item.threadId)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-900/[0.09] bg-white px-2.5 py-1 text-[11.5px] font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.04] dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-200 dark:hover:bg-white/[0.08]"
                        >
                          <span>Thread</span>
                          <ArrowUpRight className="h-3 w-3 opacity-70" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onResolveCommitment(item.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium text-emerald-700 transition-colors hover:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-400/15"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Resolve</span>
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
