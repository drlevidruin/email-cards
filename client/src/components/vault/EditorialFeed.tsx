import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Archive,
  BookOpen,
  CheckCheck,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { EmailThread } from '../../lib/types';
import {
  estimateReadingMinutes,
  extractPublicationName,
  formatShortDate,
  getEditorialTakeaways,
} from './vaultUtils';

export interface EditorialFeedProps {
  threads: EmailThread[];
  onOpenThread: (threadId: string) => void;
  onArchiveThreads: (threadIds: string[]) => void | Promise<void>;
}

export const EditorialFeed: React.FC<EditorialFeedProps> = ({
  threads,
  onOpenThread,
  onArchiveThreads,
}) => {
  const [filterMode, setFilterMode] = useState<'all' | 'unread'>('all');
  const [sweeping, setSweeping] = useState(false);

  const sortedThreads = useMemo(
    () =>
      [...threads].sort(
        (a, b) =>
          new Date(b.lastMessageAt).getTime() -
          new Date(a.lastMessageAt).getTime(),
      ),
    [threads],
  );

  const unreadCount = useMemo(
    () => sortedThreads.filter((t) => t.isUnread).length,
    [sortedThreads],
  );

  const readThreads = useMemo(
    () => sortedThreads.filter((t) => !t.isUnread),
    [sortedThreads],
  );

  const visibleThreads = useMemo(
    () =>
      filterMode === 'unread'
        ? sortedThreads.filter((t) => t.isUnread)
        : sortedThreads,
    [sortedThreads, filterMode],
  );

  const todayFormatted = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
      }),
    [],
  );

  const handleSweepRead = async () => {
    const targets =
      readThreads.length > 0
        ? readThreads.map((t) => t.id)
        : visibleThreads.map((t) => t.id);
    if (targets.length === 0 || sweeping) return;
    setSweeping(true);
    try {
      await onArchiveThreads(targets);
    } finally {
      setSweeping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Magazine Masthead Subbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-900/[0.08] pb-4 dark:border-white/[0.08]">
        <div className="flex flex-wrap items-center gap-3">
          <div className="font-mono-num text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            Edition / {todayFormatted}
          </div>
          <div className="h-3.5 w-px bg-slate-900/[0.12] dark:bg-white/[0.12]" />
          <div className="flex items-center gap-1 rounded-xl border border-slate-900/[0.08] bg-white/80 p-0.5 dark:border-white/[0.08] dark:bg-white/[0.03]">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                filterMode === 'all'
                  ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              All ({sortedThreads.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('unread')}
              className={`rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
                filterMode === 'unread'
                  ? 'bg-slate-900 text-white dark:bg-white/15 dark:text-white'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              Unread ({unreadCount})
            </button>
          </div>
        </div>

        <button
          type="button"
          disabled={sortedThreads.length === 0 || sweeping}
          onClick={handleSweepRead}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-900/[0.1] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-900/[0.18] hover:bg-slate-50 hover:text-slate-950 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/[0.1] dark:bg-white/[0.05] dark:text-slate-200 dark:hover:border-white/[0.18] dark:hover:bg-white/[0.1] dark:hover:text-white"
        >
          <CheckCheck className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400" />
          <span>
            {sweeping
              ? 'Sweeping...'
              : readThreads.length > 0
                ? `Sweep Read Feed (${readThreads.length})`
                : `Sweep Feed (${visibleThreads.length})`}
          </span>
        </button>
      </div>

      {/* Magazine Editorial Grid */}
      {visibleThreads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-900/[0.12] bg-white/60 px-6 py-16 text-center dark:border-white/[0.1] dark:bg-[#0D121E]/60">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
            <BookOpen className="h-6 w-6" />
          </div>
          <h3 className="font-editorial mt-4 text-[30px] text-slate-900 dark:text-white">
            Every edition is read and shelved.
          </h3>
          <p className="mt-1.5 max-w-md text-[13px] text-slate-500 dark:text-slate-400">
            Incoming newsletters across your Gmail accounts will arrive here calmly, distilled into 30-second briefings.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
          <AnimatePresence initial={false}>
            {visibleThreads.map((thread, idx) => {
              const isLeadStory = idx === 0 && visibleThreads.length >= 3;
              const publication = extractPublicationName(thread);
              const readMinutes = estimateReadingMinutes(thread);
              const takeaways = getEditorialTakeaways(thread);

              return (
                <motion.article
                  key={thread.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.26, delay: Math.min(idx * 0.04, 0.2) }}
                  className={`prism-hairline-top group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-900/[0.09] bg-white/95 p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_14px_34px_-18px_rgba(15,23,42,0.12)] transition-all duration-200 hover:border-slate-900/[0.18] dark:border-white/[0.08] dark:bg-[#0E1320]/95 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_42px_-20px_rgba(0,0,0,0.75)] dark:hover:border-white/[0.16] ${
                    isLeadStory ? 'xl:col-span-2' : ''
                  }`}
                >
                  {/* Soft Editorial Ambient Tint for Lead Edition */}
                  {isLeadStory && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full opacity-20 blur-3xl dark:opacity-25"
                      style={{ backgroundColor: thread.accountColor }}
                    />
                  )}

                  <div className="relative space-y-4">
                    {/* Publication Masthead Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: thread.accountColor }}
                        />
                        <span className="truncate text-[11.5px] font-semibold uppercase tracking-[0.11em] text-slate-800 dark:text-slate-200">
                          {publication}
                        </span>
                        <span className="rounded-full border border-slate-900/[0.08] bg-slate-900/[0.03] px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-400">
                          {thread.accountLabel}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {thread.isUnread && (
                          <span className="font-mono-num rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-300">
                            New
                          </span>
                        )}
                        <span className="font-mono-num inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <Clock className="h-3 w-3 opacity-70" />
                          {readMinutes} min read
                        </span>
                      </div>
                    </div>

                    {/* Dramatic Editorial Serif Headline */}
                    <button
                      type="button"
                      onClick={() => onOpenThread(thread.id)}
                      className="block w-full text-left focus:outline-none"
                    >
                      <h3
                        className={`font-editorial font-normal tracking-[-0.015em] text-slate-950 transition-colors group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-200 ${
                          isLeadStory
                            ? 'text-[30px] leading-[1.09] sm:text-[34px]'
                            : 'text-[24px] leading-[1.14]'
                        }`}
                      >
                        {thread.subject}
                      </h3>
                      <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
                        {thread.snippet}
                      </p>
                    </button>

                    {/* 30-Second AI Key Takeaways */}
                    <div className="rounded-2xl border border-slate-900/[0.06] bg-slate-900/[0.025] p-4 dark:border-white/[0.07] dark:bg-white/[0.03]">
                      <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                        <Sparkles className="h-3 w-3 text-violet-500 dark:text-violet-400" />
                        <span>30-Second Key Takeaways</span>
                      </div>
                      <ul
                        className={`space-y-2 text-[12.5px] leading-relaxed text-slate-700 dark:text-slate-200 ${
                          isLeadStory ? 'sm:grid sm:grid-cols-2 sm:gap-x-5 sm:space-y-0' : ''
                        }`}
                      >
                        {takeaways.map((point, i) => (
                          <li key={i} className="flex items-start gap-2.5">
                            <span
                              className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full opacity-80"
                              style={{ backgroundColor: thread.accountColor }}
                            />
                            <span>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="relative mt-5 flex items-center justify-between gap-2 border-t border-slate-900/[0.06] pt-4 dark:border-white/[0.06]">
                    <span className="font-mono-num text-[11px] text-slate-500 dark:text-slate-400">
                      {formatShortDate(thread.lastMessageAt)}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onArchiveThreads([thread.id])}
                        title="Archive edition"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-transparent text-slate-400 transition-colors hover:border-slate-900/[0.08] hover:bg-slate-900/[0.04] hover:text-slate-800 dark:text-slate-500 dark:hover:border-white/[0.1] dark:hover:bg-white/[0.06] dark:hover:text-slate-200"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenThread(thread.id)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-900/[0.1] bg-slate-900 px-3.5 py-1.5 text-[12px] font-semibold text-white transition-all hover:bg-slate-800 active:scale-[0.98] dark:border-white/[0.12] dark:bg-white/[0.09] dark:text-white dark:hover:bg-white/[0.16]"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>Read Full Edition</span>
                      </button>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
