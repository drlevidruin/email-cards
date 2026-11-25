import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Compass,
  FileSpreadsheet,
  Inbox,
  Newspaper,
  RefreshCw,
  Send,
  Sparkles,
} from 'lucide-react';
import type {
  BriefingData,
  CommitmentItem,
  DraftTone,
  EmailThread,
  GmailAccount,
  LensId,
  ScreenerSender,
} from '../../lib/types';
import { DecisionCard } from './DecisionCard';
import { CommitmentRadar } from './CommitmentRadar';
import { ScreenerStrip } from './ScreenerStrip';
import {
  formatCurrency,
  formatRelativeTime,
  getTimeOfDayGreeting,
} from './pulseUtils';

export interface PulseLensProps {
  briefing: BriefingData | null;
  threads: EmailThread[];
  commitments: CommitmentItem[];
  screener: ScreenerSender[];
  accounts: GmailAccount[];
  selectedAccountId: string;
  onOpenThread: (threadId: string) => void;
  onArchiveThread: (threadId: string) => void | Promise<void>;
  onSnoozeThread: (threadId: string, until?: string) => void | Promise<void>;
  onQuickDraft: (
    threadId: string,
    instruction: string,
    tone?: DraftTone,
  ) => void | Promise<void>;
  onScreenerDecision: (
    email: string,
    decision: 'approved' | 'feed' | 'muted',
  ) => void | Promise<void>;
  onResolveCommitment: (commitmentId: string) => void | Promise<void>;
  onNudgeCommitment: (commitmentId: string) => void | Promise<void>;
  onSwitchLens: (lens: LensId) => void;
  onAskAgent: (prompt: string) => void;
  onRefreshBriefing: () => void | Promise<void>;
  refreshingBriefing: boolean;
}

const QUICK_ASK_PROMPTS = [
  'What needs my decision before 5 PM?',
  'Summarize open deals and contracts',
  'Who have I owed a reply to the longest?',
  'Audit my recent receipts and spend',
];

export const PulseLens: React.FC<PulseLensProps> = ({
  briefing,
  threads,
  commitments,
  screener,
  accounts,
  selectedAccountId,
  onOpenThread,
  onArchiveThread,
  onSnoozeThread,
  onQuickDraft,
  onScreenerDecision,
  onResolveCommitment,
  onNudgeCommitment,
  onSwitchLens,
  onAskAgent,
  onRefreshBriefing,
  refreshingBriefing,
}) => {
  const [askInput, setAskInput] = useState('');

  const isAllAccounts = !selectedAccountId || selectedAccountId === 'all';
  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const scopedThreads = useMemo(
    () =>
      threads.filter(
        (t) =>
          !t.isArchived && (isAllAccounts || t.accountId === selectedAccountId),
      ),
    [threads, isAllAccounts, selectedAccountId],
  );

  const decisionThreads = useMemo(
    () =>
      scopedThreads
        .filter((t) => t.bucket === 'decision')
        .sort((a, b) => b.urgencyScore - a.urgencyScore),
    [scopedThreads],
  );

  const scopedCommitments = useMemo(
    () =>
      commitments.filter(
        (c) => isAllAccounts || c.accountId === selectedAccountId,
      ),
    [commitments, isAllAccounts, selectedAccountId],
  );

  const scopedScreener = useMemo(
    () =>
      screener.filter(
        (s) => isAllAccounts || s.accountId === selectedAccountId,
      ),
    [screener, isAllAccounts, selectedAccountId],
  );

  const feedThreads = useMemo(
    () => scopedThreads.filter((t) => t.bucket === 'feed'),
    [scopedThreads],
  );

  const paperTrailThreads = useMemo(
    () =>
      scopedThreads.filter(
        (t) => t.bucket === 'paper_trail' || Boolean(t.receiptInfo),
      ),
    [scopedThreads],
  );

  const recentSpendTotal = useMemo(
    () =>
      paperTrailThreads.reduce(
        (sum, t) => sum + (t.receiptInfo?.amount ?? 0),
        0,
      ),
    [paperTrailThreads],
  );

  const openPromisedCount = useMemo(
    () =>
      scopedCommitments.filter(
        (c) => c.status !== 'resolved' && c.direction === 'you_promised',
      ).length,
    [scopedCommitments],
  );

  const openWaitingCount = useMemo(
    () =>
      scopedCommitments.filter(
        (c) => c.status !== 'resolved' && c.direction === 'waiting_on_them',
      ).length,
    [scopedCommitments],
  );

  const clearedNoiseCount = feedThreads.length + paperTrailThreads.length;

  const visibleHighlights = useMemo(() => {
    if (!briefing?.highlights?.length) return [];
    const scopedIds = new Set(scopedThreads.map((t) => t.id));
    return briefing.highlights.filter((h) => scopedIds.has(h.threadId)).slice(0, 3);
  }, [briefing, scopedThreads]);

  const greetingText =
    isAllAccounts && briefing?.greeting
      ? briefing.greeting
      : getTimeOfDayGreeting(decisionThreads.length);

  const headlineText =
    isAllAccounts && briefing?.headline
      ? briefing.headline
      : decisionThreads.length > 0
        ? `Prism distilled ${decisionThreads.length} priority decision${decisionThreads.length === 1 ? '' : 's'}, tracked ${openPromisedCount + openWaitingCount} open commitments, and quietly routed ${clearedNoiseCount} newsletters and receipts out of your way.`
        : `All priority decisions are clear${activeAccount ? ` in ${activeAccount.label}` : ''}. ${clearedNoiseCount} ambient digests and receipts remain organized in your Vault.`;

  const handleAskSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = askInput.trim();
    if (!trimmed) return;
    onAskAgent(trimmed);
    setAskInput('');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="h-full w-full overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1260px] space-y-8 pb-10">
        {/* 1. Ambient Executive Briefing Stage */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-slate-900/[0.09] bg-white/95 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_20px_50px_-24px_rgba(15,23,42,0.12)] sm:p-8 dark:border-white/[0.09] dark:bg-[#0D121E]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_24px_64px_-24px_rgba(0,0,0,0.85)]"
        >
          {/* Subtle Prismatic Aurora Backdrop */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-sky-500/[0.11] blur-3xl dark:bg-sky-400/[0.14]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-80 rounded-full bg-violet-500/[0.08] blur-3xl dark:bg-violet-500/[0.12]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-16 top-8 h-52 w-52 rounded-full bg-amber-500/[0.07] blur-3xl dark:bg-amber-400/[0.08]"
          />

          <div className="relative space-y-6">
            {/* Eyebrow & Refresh Action */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-900/[0.09] bg-slate-900/[0.03] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 dark:border-white/[0.1] dark:bg-white/[0.04] dark:text-slate-200">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-sky-500 dark:bg-sky-400" />
                  </span>
                  <span>The Pulse</span>
                </span>

                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-white/80 px-2.5 py-1 text-[11.5px] font-medium text-slate-600 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300">
                  {activeAccount ? (
                    <>
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: activeAccount.color }}
                      />
                      <span>{activeAccount.label}</span>
                    </>
                  ) : (
                    <>
                      <span className="flex -space-x-1">
                        {accounts.slice(0, 3).map((acc) => (
                          <span
                            key={acc.id}
                            className="h-2 w-2 rounded-full ring-1 ring-white dark:ring-[#0D121E]"
                            style={{ backgroundColor: acc.color }}
                          />
                        ))}
                      </span>
                      <span>
                        {accounts.length} Merged Gmail Account
                        {accounts.length === 1 ? '' : 's'}
                      </span>
                    </>
                  )}
                </span>

                {briefing && (
                  <span className="font-mono-num hidden items-center gap-1.5 text-[11px] text-slate-500 sm:inline-flex dark:text-slate-400">
                    <Sparkles className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                    <span>
                      {briefing.generatedBy === 'claude'
                        ? 'Synthesized by Claude'
                        : 'Instant Local Brief'}
                    </span>
                    <span className="opacity-40">/</span>
                    <span>{formatRelativeTime(briefing.generatedAt)}</span>
                  </span>
                )}
              </div>

              <button
                type="button"
                disabled={refreshingBriefing}
                onClick={() => onRefreshBriefing()}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-900/[0.1] bg-white/90 px-3.5 py-1.5 text-[12px] font-medium text-slate-700 shadow-sm transition-all hover:border-slate-900/[0.18] hover:bg-white hover:text-slate-950 active:scale-[0.98] disabled:opacity-60 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-white/[0.18] dark:hover:bg-white/[0.09] dark:hover:text-white"
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 text-sky-500 dark:text-sky-400 ${
                    refreshingBriefing ? 'animate-spin' : ''
                  }`}
                />
                <span>
                  {refreshingBriefing
                    ? 'Synthesizing...'
                    : 'Refresh Brief with Claude'}
                </span>
              </button>
            </div>

            {/* Editorial Greeting + Synthesized Headline */}
            <div className="max-w-3xl space-y-2.5">
              <h1 className="font-editorial text-[36px] font-normal leading-[1.06] tracking-[-0.015em] text-slate-950 sm:text-[44px] dark:text-white">
                {greetingText}
              </h1>
              <p className="text-[14.5px] leading-relaxed text-slate-600 sm:text-[15.5px] dark:text-slate-300">
                {headlineText}
              </p>
            </div>

            {/* Glowing Live Metric Pills */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => scrollToSection('pulse-decisions')}
                className="group flex items-center justify-between rounded-2xl border border-rose-500/20 bg-rose-500/[0.06] px-4 py-3 text-left transition-all hover:border-rose-500/35 hover:bg-rose-500/[0.10] dark:border-rose-400/20 dark:bg-rose-500/[0.07] dark:hover:border-rose-400/35"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-rose-700/80 dark:text-rose-300/80">
                    Decisions
                  </div>
                  <div className="font-mono-num mt-0.5 text-[24px] font-semibold leading-none text-slate-950 dark:text-white">
                    {decisionThreads.length}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.85)] transition-transform group-hover:scale-125" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('pulse-commitments')}
                className="group flex items-center justify-between rounded-2xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-left transition-all hover:border-amber-500/35 hover:bg-amber-500/[0.10] dark:border-amber-400/20 dark:bg-amber-500/[0.07] dark:hover:border-amber-400/35"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-800/80 dark:text-amber-300/85">
                    Open Promises
                  </div>
                  <div className="font-mono-num mt-0.5 text-[24px] font-semibold leading-none text-slate-950 dark:text-white">
                    {openPromisedCount}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.85)] transition-transform group-hover:scale-125" />
              </button>

              <button
                type="button"
                onClick={() => scrollToSection('pulse-commitments')}
                className="group flex items-center justify-between rounded-2xl border border-sky-500/20 bg-sky-500/[0.06] px-4 py-3 text-left transition-all hover:border-sky-500/35 hover:bg-sky-500/[0.10] dark:border-sky-400/20 dark:bg-sky-500/[0.07] dark:hover:border-sky-400/35"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-800/80 dark:text-sky-300/85">
                    Waiting On
                  </div>
                  <div className="font-mono-num mt-0.5 text-[24px] font-semibold leading-none text-slate-950 dark:text-white">
                    {openWaitingCount}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-sky-400 shadow-[0_0_12px_rgba(56,189,248,0.85)] transition-transform group-hover:scale-125" />
              </button>

              <button
                type="button"
                onClick={() => onSwitchLens('vault')}
                className="group flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 text-left transition-all hover:border-emerald-500/35 hover:bg-emerald-500/[0.10] dark:border-emerald-400/20 dark:bg-emerald-500/[0.07] dark:hover:border-emerald-400/35"
              >
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-emerald-800/80 dark:text-emerald-300/85">
                    Noise Auto-Cleared
                  </div>
                  <div className="font-mono-num mt-0.5 text-[24px] font-semibold leading-none text-slate-950 dark:text-white">
                    {clearedNoiseCount}
                  </div>
                </div>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.85)] transition-transform group-hover:scale-125" />
              </button>
            </div>

            {/* Quick Ask Claude Bar */}
            <div className="space-y-2.5 pt-1">
              <form
                onSubmit={handleAskSubmit}
                className="flex items-center gap-2.5 rounded-2xl border border-slate-900/[0.1] bg-slate-900/[0.025] px-4 py-2.5 transition-all focus-within:border-sky-500/45 focus-within:bg-white focus-within:shadow-[0_0_0_3px_rgba(56,189,248,0.12)] dark:border-white/[0.1] dark:bg-black/30 dark:focus-within:border-sky-400/45 dark:focus-within:bg-[#0B101B]"
              >
                <Sparkles className="h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400" />
                <input
                  type="text"
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  placeholder="Ask Claude across all accounts: triage, find deadlines, draft replies, or propose bulk cleanups..."
                  className="min-w-0 flex-1 bg-transparent text-[13.5px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder:text-slate-500"
                />
                <button
                  type="submit"
                  disabled={!askInput.trim()}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-35 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
                >
                  <span>Ask Claude</span>
                  <Send className="h-3 w-3" />
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5">
                {QUICK_ASK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => onAskAgent(prompt)}
                    className="rounded-full border border-slate-900/[0.08] bg-white/75 px-2.5 py-1 text-[11.5px] font-medium text-slate-600 transition-colors hover:border-sky-500/35 hover:bg-sky-500/[0.07] hover:text-sky-800 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-400 dark:hover:border-sky-400/30 dark:hover:bg-sky-400/[0.08] dark:hover:text-sky-200"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Briefing Highlights Strip */}
            {visibleHighlights.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 border-t border-slate-900/[0.06] pt-4 dark:border-white/[0.06]">
                <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">
                  Focus Radar:
                </span>
                {visibleHighlights.map((item) => (
                  <button
                    key={item.threadId}
                    type="button"
                    onClick={() => onOpenThread(item.threadId)}
                    className="inline-flex max-w-xs items-center gap-1.5 rounded-lg border border-slate-900/[0.07] bg-slate-900/[0.025] px-2.5 py-1 text-[11.5px] text-slate-700 transition-colors hover:border-sky-500/35 hover:text-sky-700 dark:border-white/[0.07] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-sky-400/35 dark:hover:text-sky-200"
                  >
                    <span
                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                        item.urgency === 'high' ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                    />
                    <span className="truncate font-medium">{item.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.section>

        {/* 2. Decision Deck */}
        <section id="pulse-decisions" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-slate-950 dark:text-white">
                  Decision Deck
                </h2>
                <span className="font-mono-num rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:border-rose-400/25 dark:text-rose-300">
                  {decisionThreads.length} active
                </span>
              </div>
              <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
                Ranked by urgency and deadline. Act directly from the card or instruct Claude in one line.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onSwitchLens('stream')}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-600 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
            >
              <span>View all in Stream</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {decisionThreads.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-900/[0.12] bg-white/60 px-6 py-14 text-center dark:border-white/[0.1] dark:bg-[#0D121E]/60">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-editorial mt-4 text-[28px] leading-tight text-slate-900 dark:text-white">
                Clear horizon. Zero pending decisions.
              </h3>
              <p className="mt-1.5 max-w-md text-[13px] text-slate-500 dark:text-slate-400">
                Every high-priority request in this view has been answered, snoozed, or archived.
              </p>
              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onSwitchLens('constellation')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.1] bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
                >
                  <Compass className="h-3.5 w-3.5 text-sky-500" />
                  <span>Explore Constellation</span>
                </button>
                <button
                  type="button"
                  onClick={() => onSwitchLens('stream')}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.1] bg-white px-3.5 py-2 text-[12.5px] font-medium text-slate-800 shadow-sm transition-colors hover:bg-slate-50 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-slate-100 dark:hover:bg-white/[0.1]"
                >
                  <Inbox className="h-3.5 w-3.5 text-violet-500" />
                  <span>Open Stream</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              className={`grid grid-cols-1 gap-4 ${
                decisionThreads.length > 1 ? 'xl:grid-cols-2' : ''
              }`}
            >
              <AnimatePresence initial={false}>
                {decisionThreads.map((thread, idx) => (
                  <DecisionCard
                    key={thread.id}
                    thread={thread}
                    index={idx}
                    onOpenThread={onOpenThread}
                    onArchiveThread={onArchiveThread}
                    onSnoozeThread={onSnoozeThread}
                    onQuickDraft={onQuickDraft}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>

        {/* 3. Commitment Radar */}
        <CommitmentRadar
          commitments={scopedCommitments}
          onOpenThread={onOpenThread}
          onQuickDraft={onQuickDraft}
          onResolveCommitment={onResolveCommitment}
          onNudgeCommitment={onNudgeCommitment}
        />

        {/* 4. First-Time Sender Screener Strip */}
        <ScreenerStrip
          screener={scopedScreener}
          onScreenerDecision={onScreenerDecision}
        />

        {/* 5. Silent Stream Dock */}
        <section className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-900/[0.08] bg-white/85 px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] md:flex-row md:items-center dark:border-white/[0.08] dark:bg-[#0D121D]/90">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Newspaper className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
                  Silent Feed
                </div>
                <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  <span className="font-mono-num">{feedThreads.length}</span>{' '}
                  newsletters auto-quieted
                </div>
              </div>
            </div>

            <div className="hidden h-7 w-px bg-slate-900/[0.08] sm:block dark:bg-white/[0.08]" />

            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <FileSpreadsheet className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.09em] text-slate-400 dark:text-slate-500">
                  Paper Trail Vault
                </div>
                <div className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                  <span className="font-mono-num">{paperTrailThreads.length}</span>{' '}
                  receipts & docs
                  {recentSpendTotal > 0 && (
                    <>
                      <span className="mx-1.5 opacity-40">/</span>
                      <span className="font-mono-num text-emerald-700 dark:text-emerald-300">
                        {formatCurrency(recentSpendTotal)}
                      </span>{' '}
                      <span className="font-normal text-slate-500 dark:text-slate-400">
                        tracked
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onSwitchLens('vault')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.1] bg-slate-900 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 dark:border-white/[0.12] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.14]"
            >
              <span>Open Digest & Vault</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onSwitchLens('stream')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.09] bg-white px-3.5 py-2 text-[12px] font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-slate-200 dark:hover:bg-white/[0.08]"
            >
              <span>Open Stream</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};
