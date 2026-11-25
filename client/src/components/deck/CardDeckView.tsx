import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  Bookmark,
  Check,
  CheckCircle2,
  Clock,
  Mail,
  Newspaper,
  Reply,
  RotateCcw,
  Sparkles,
  VolumeX,
} from 'lucide-react';
import type {
  DraftTone,
  EmailThread,
  GmailAccount,
  ScreenerSender,
} from '../../lib/types';
import {
  isActivelySnoozed,
  isPriorityCard,
  isReceiptCard,
  sortThreadsForDeck,
} from './deckUtils';
import { SwipeEmailCard, type SwipeDirection } from './SwipeEmailCard';
import { SwipeScreenerCard } from './SwipeScreenerCard';

export type DeckFilter =
  | 'priority'
  | 'bookmarked'
  | 'screener'
  | 'newsletters'
  | 'receipts'
  | 'all';

export interface CardDeckViewProps {
  threads: EmailThread[];
  screener: ScreenerSender[];
  accounts: GmailAccount[];
  selectedAccountId: string;
  activeFilter?: DeckFilter;
  onFilterChange?: (filter: DeckFilter) => void;
  focusMode?: boolean;
  onOpenThread: (threadId: string, startReply?: boolean) => void;
  onArchiveThread: (threadId: string) => Promise<void>;
  onSnoozeThread: (threadId: string, preset?: string) => Promise<void>;
  onBookmarkThread: (threadId: string) => Promise<void>;
  onQuickDraft: (
    threadId: string,
    instruction: string,
    tone?: DraftTone,
  ) => Promise<void>;
  onScreenerDecision: (
    email: string,
    decision: 'approved' | 'feed' | 'muted',
  ) => Promise<void>;
  onUndoLast: () => Promise<boolean>;
  canUndo: boolean;
  onAskClaudeAboutThread: (thread: EmailThread) => void;
  onOpenDrafts: () => void;
}

interface SessionUndoEntry {
  kind: 'reply' | 'bookmark' | 'archive' | 'snooze';
  threadId: string;
}

export const CardDeckView: React.FC<CardDeckViewProps> = ({
  threads,
  screener,
  accounts,
  selectedAccountId,
  activeFilter,
  onFilterChange,
  focusMode = true,
  onOpenThread,
  onArchiveThread,
  onSnoozeThread,
  onBookmarkThread,
  onQuickDraft,
  onScreenerDecision,
  onUndoLast,
  canUndo,
  onAskClaudeAboutThread,
  onOpenDrafts,
}) => {
  const [internalFilter, setInternalFilter] = useState<DeckFilter>('priority');
  const activeTab: DeckFilter = activeFilter ?? internalFilter;
  const setActiveTab = useCallback(
    (next: DeckFilter) => {
      setInternalFilter(next);
      onFilterChange?.(next);
    },
    [onFilterChange],
  );
  const [exitingDirection, setExitingDirection] =
    useState<SwipeDirection | null>(null);
  const [repliedDismissedIds, setRepliedDismissedIds] = useState<string[]>([]);
  const [bookmarkedAdvanceIds, setBookmarkedAdvanceIds] = useState<string[]>(
    [],
  );
  const [inFlightIds, setInFlightIds] = useState<string[]>([]);
  const [sessionUndoLog, setSessionUndoLog] = useState<SessionUndoEntry[]>([]);
  const [sessionCleared, setSessionCleared] = useState(0);
  const [undoing, setUndoing] = useState(false);

  const lockRef = useRef(false);

  const isAllAccounts = !selectedAccountId || selectedAccountId === 'all';
  const accountsById = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts],
  );

  // Active threads scoped to account (excludes archived, actively snoozed, and replied-this-session)
  const accountScopedThreads = useMemo(
    () =>
      threads.filter(
        (t) =>
          !t.isArchived &&
          !isActivelySnoozed(t) &&
          !inFlightIds.includes(t.id) &&
          !repliedDismissedIds.includes(t.id) &&
          (isAllAccounts || t.accountId === selectedAccountId),
      ),
    [
      threads,
      inFlightIds,
      repliedDismissedIds,
      isAllAccounts,
      selectedAccountId,
    ],
  );

  // Threads still pending in normal triage stacks (advances past cards swiped up to Bookmark)
  const triageThreads = useMemo(
    () =>
      accountScopedThreads.filter((t) => !bookmarkedAdvanceIds.includes(t.id)),
    [accountScopedThreads, bookmarkedAdvanceIds],
  );

  const pendingScreeners = useMemo(
    () =>
      screener.filter(
        (s) =>
          s.status === 'pending' &&
          !inFlightIds.includes(s.email) &&
          (isAllAccounts || s.accountId === selectedAccountId),
      ),
    [screener, inFlightIds, isAllAccounts, selectedAccountId],
  );

  const decks = useMemo(() => {
    const priority = sortThreadsForDeck(triageThreads.filter(isPriorityCard));
    const bookmarked = sortThreadsForDeck(
      accountScopedThreads.filter((t) => t.isStarred),
    );
    const newsletters = sortThreadsForDeck(
      triageThreads.filter((t) => t.bucket === 'feed'),
    );
    const receipts = sortThreadsForDeck(triageThreads.filter(isReceiptCard));
    const all = sortThreadsForDeck(triageThreads);
    return { priority, bookmarked, newsletters, receipts, all };
  }, [triageThreads, accountScopedThreads]);

  const activeEmailDeck =
    activeTab === 'priority'
      ? decks.priority
      : activeTab === 'bookmarked'
        ? decks.bookmarked
        : activeTab === 'newsletters'
          ? decks.newsletters
          : activeTab === 'receipts'
            ? decks.receipts
            : activeTab === 'all'
              ? decks.all
              : [];

  const isScreenerTab = activeTab === 'screener';
  const remainingCount = isScreenerTab
    ? pendingScreeners.length
    : activeEmailDeck.length;

  const topThread = !isScreenerTab ? activeEmailDeck[0] ?? null : null;
  const topScreener = isScreenerTab ? pendingScreeners[0] ?? null : null;
  const nextCardsCount = Math.max(0, Math.min(2, remainingCount - 1));

  const totalForProgress = Math.max(1, remainingCount + sessionCleared);
  const progressPercent =
    remainingCount === 0
      ? 100
      : Math.min(100, Math.round((sessionCleared / totalForProgress) * 100));

  const tabs: { id: DeckFilter; label: string; count: number }[] = [
    { id: 'priority', label: 'Priority', count: decks.priority.length },
    { id: 'bookmarked', label: 'Bookmarked', count: decks.bookmarked.length },
    { id: 'screener', label: 'First-Time', count: pendingScreeners.length },
    { id: 'newsletters', label: 'Newsletters', count: decks.newsletters.length },
    { id: 'receipts', label: 'Receipts', count: decks.receipts.length },
    { id: 'all', label: 'All', count: decks.all.length },
  ];

  const handleEmailSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!topThread || lockRef.current) return;
      lockRef.current = true;
      const target = topThread;
      setExitingDirection(direction);

      window.setTimeout(async () => {
        if (direction === 'right') {
          setRepliedDismissedIds((prev) =>
            prev.includes(target.id) ? prev : [...prev, target.id],
          );
          setSessionUndoLog((prev) => [
            ...prev,
            { kind: 'reply', threadId: target.id },
          ]);
          setSessionCleared((c) => c + 1);
          setExitingDirection(null);
          lockRef.current = false;
          onOpenThread(target.id, true);
          return;
        }

        if (direction === 'up') {
          // Swipe UP -> Bookmark / Star and advance deck
          setBookmarkedAdvanceIds((prev) =>
            prev.includes(target.id) ? prev : [...prev, target.id],
          );
          setSessionUndoLog((prev) => [
            ...prev,
            { kind: 'bookmark', threadId: target.id },
          ]);
          setSessionCleared((c) => c + 1);
          setExitingDirection(null);
          lockRef.current = false;
          await onBookmarkThread(target.id);
          return;
        }

        // Left -> Archive, Down -> Snooze
        setInFlightIds((prev) => [...prev, target.id]);
        setSessionUndoLog((prev) => [
          ...prev,
          {
            kind: direction === 'left' ? 'archive' : 'snooze',
            threadId: target.id,
          },
        ]);
        setSessionCleared((c) => c + 1);
        setExitingDirection(null);
        lockRef.current = false;

        try {
          if (direction === 'left') {
            await onArchiveThread(target.id);
          } else {
            await onSnoozeThread(target.id, 'tomorrow');
          }
        } finally {
          setInFlightIds((prev) => prev.filter((id) => id !== target.id));
        }
      }, 235);
    },
    [
      topThread,
      onArchiveThread,
      onSnoozeThread,
      onBookmarkThread,
      onOpenThread,
    ],
  );

  const handleScreenerSwipe = useCallback(
    (direction: SwipeDirection) => {
      if (!topScreener || lockRef.current) return;
      lockRef.current = true;
      const target = topScreener;
      setExitingDirection(direction);

      const decision: 'approved' | 'feed' | 'muted' =
        direction === 'right' || direction === 'up'
          ? 'approved'
          : direction === 'down'
            ? 'feed'
            : 'muted';

      window.setTimeout(async () => {
        setInFlightIds((prev) => [...prev, target.email]);
        setSessionCleared((c) => c + 1);
        setExitingDirection(null);
        lockRef.current = false;

        try {
          await onScreenerDecision(target.email, decision);
          if (direction === 'up' && target.threadIds.length > 0) {
            await onBookmarkThread(target.threadIds[0]);
          }
        } finally {
          setInFlightIds((prev) => prev.filter((e) => e !== target.email));
        }
      }, 235);
    },
    [topScreener, onScreenerDecision, onBookmarkThread],
  );

  const handleUndo = useCallback(async () => {
    if (undoing) return;
    const lastLocal = sessionUndoLog[sessionUndoLog.length - 1];

    // If most recent gesture was a local Reply advance, pop it right back onto the deck
    if (lastLocal?.kind === 'reply') {
      setSessionUndoLog((prev) => prev.slice(0, -1));
      setRepliedDismissedIds((prev) =>
        prev.filter((id) => id !== lastLocal.threadId),
      );
      setSessionCleared((c) => Math.max(0, c - 1));
      return;
    }

    if (canUndo) {
      setUndoing(true);
      try {
        const ok = await onUndoLast();
        if (ok) {
          if (lastLocal) {
            setSessionUndoLog((prev) => prev.slice(0, -1));
            setBookmarkedAdvanceIds((prev) =>
              prev.filter((id) => id !== lastLocal.threadId),
            );
            setRepliedDismissedIds((prev) =>
              prev.filter((id) => id !== lastLocal.threadId),
            );
          }
          setSessionCleared((c) => Math.max(0, c - 1));
          return;
        }
      } finally {
        setUndoing(false);
      }
    }

    // Fallback: restore any locally dismissed card
    if (repliedDismissedIds.length > 0) {
      setRepliedDismissedIds((prev) => prev.slice(0, -1));
      setSessionUndoLog((prev) => prev.slice(0, -1));
      setSessionCleared((c) => Math.max(0, c - 1));
    } else if (bookmarkedAdvanceIds.length > 0) {
      setBookmarkedAdvanceIds((prev) => prev.slice(0, -1));
      setSessionUndoLog((prev) => prev.slice(0, -1));
      setSessionCleared((c) => Math.max(0, c - 1));
    }
  }, [
    undoing,
    sessionUndoLog,
    canUndo,
    onUndoLast,
    repliedDismissedIds.length,
    bookmarkedAdvanceIds.length,
  ]);

  // Keyboard shortcuts: ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Space/Enter, Z
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (isScreenerTab) handleScreenerSwipe('left');
        else handleEmailSwipe('left');
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (isScreenerTab) handleScreenerSwipe('right');
        else handleEmailSwipe('right');
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (isScreenerTab) handleScreenerSwipe('up');
        else handleEmailSwipe('up');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (isScreenerTab) handleScreenerSwipe('down');
        else handleEmailSwipe('down');
      } else if ((e.key === ' ' || e.key === 'Enter') && topThread) {
        if (target && target.tagName === 'BUTTON') return;
        e.preventDefault();
        onOpenThread(topThread.id, false);
      } else if (e.key === 'z' || e.key === 'Z') {
        if (
          canUndo ||
          repliedDismissedIds.length > 0 ||
          bookmarkedAdvanceIds.length > 0
        ) {
          e.preventDefault();
          void handleUndo();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    isScreenerTab,
    topThread,
    canUndo,
    repliedDismissedIds.length,
    bookmarkedAdvanceIds.length,
    handleEmailSwipe,
    handleScreenerSwipe,
    handleUndo,
    onOpenThread,
  ]);

  const undoAvailable =
    canUndo ||
    repliedDismissedIds.length > 0 ||
    bookmarkedAdvanceIds.length > 0;
  const otherTabsWithItems = tabs.filter(
    (t) => t.id !== activeTab && t.count > 0,
  );

  return (
    <div
      className={`relative flex w-full flex-col overflow-x-hidden overflow-y-auto bg-[#F5F4F0] ${
        focusMode
          ? 'min-h-[100dvh] items-center justify-center px-3 pb-5 pt-14 sm:px-8 sm:py-8'
          : 'h-full px-3 py-4 sm:px-8 sm:py-5'
      }`}
    >
      {/* FOCUS MODE: Whisper-thin 3px top edge progress line + ultra-quiet top-right counter */}
      {focusMode && (
        <>
          <div
            aria-hidden="true"
            className="fixed left-0 right-0 top-0 z-20 h-[3px] bg-[#E5E7EB]/80"
          >
            <motion.div
              className="h-full bg-[#2563EB]/80"
              initial={false}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            />
          </div>

          <div
            aria-live="polite"
            className="font-mono-num fixed right-3.5 top-3.5 z-20 rounded-full border border-gray-200/80 bg-white/90 px-3 py-1.5 text-[12px] font-medium text-gray-500 shadow-sm backdrop-blur-sm sm:right-5 sm:top-5 sm:px-3.5 sm:py-2 sm:text-[13px]"
          >
            {remainingCount > 0 ? `1 / ${remainingCount}` : 'All caught up'}
          </div>
        </>
      )}

      <div
        className={`mx-auto flex w-full max-w-[900px] flex-col items-center ${
          focusMode ? 'justify-center' : 'flex-1'
        }`}
      >
        {/* Non-focus fallback: filter pill strip + inline progress bar */}
        {!focusMode && (
          <div className="w-full space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                role="tablist"
                aria-label="Email Cards filter"
                className="flex flex-wrap items-center gap-1 rounded-2xl border border-[#E5E7EB] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                {tabs.map((tab) => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      role="tab"
                      aria-selected={isActive}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[13px] font-semibold transition-all ${
                        isActive
                          ? 'bg-[#111827] text-white shadow-sm'
                          : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                      }`}
                    >
                      {tab.id === 'bookmarked' && (
                        <Bookmark
                          className={`h-3.5 w-3.5 ${
                            isActive
                              ? 'fill-amber-300 text-amber-300'
                              : 'text-amber-500'
                          }`}
                        />
                      )}
                      <span>{tab.label}</span>
                      <span
                        className={`font-mono-num rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : tab.id === 'bookmarked' && tab.count > 0
                              ? 'bg-amber-100 text-amber-800'
                              : tab.id === 'screener' && tab.count > 0
                                ? 'bg-indigo-100 text-indigo-700'
                                : 'bg-[#F3F4F6] text-[#6B7280]'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 text-[13px] font-medium text-[#6B7280]">
                {remainingCount > 0 ? (
                  <span>
                    <strong className="font-mono-num font-semibold text-[#111827]">
                      1 of {remainingCount}
                    </strong>{' '}
                    remaining
                  </span>
                ) : (
                  <span className="font-semibold text-emerald-700">
                    All caught up
                  </span>
                )}
              </div>
            </div>

            <div className="h-[3px] w-full overflow-hidden rounded-full bg-[#E5E7EB]">
              <motion.div
                className="h-full rounded-full bg-[#2563EB]"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
              />
            </div>
          </div>
        )}

        {/* 2. TRUE TINDER 4-DIRECTION CARD STACK WITH SUBTLE EDGE HINTS */}
        <div
          className={`relative flex w-full flex-col items-center justify-center ${
            focusMode ? 'py-2' : 'mt-5 flex-1 pb-4'
          }`}
        >
          {remainingCount === 0 ? (
            /* Sunlit "All Caught Up" Card */
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.28 }}
              className="w-full max-w-[580px] rounded-[24px] border border-[#E5E7EB] bg-white px-8 py-12 text-center shadow-[0_18px_48px_-14px_rgba(15,23,42,0.10)]"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-[24px] font-semibold tracking-[-0.02em] text-[#111827]">
                All caught up
              </h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-[#4B5563]">
                {activeTab === 'bookmarked'
                  ? 'Swipe up on any email card to bookmark it here for quick follow-up.'
                  : sessionCleared > 0
                    ? `You cleared ${sessionCleared} ${sessionCleared === 1 ? 'card' : 'cards'} in this session. Everything here is handled.`
                    : 'Zero cards waiting in this stack right now. Enjoy the quiet.'}
              </p>

              <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={onOpenDrafts}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#2563EB] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-sm transition-colors hover:bg-[#1D4ED8]"
                >
                  <Mail className="h-4 w-4" />
                  <span>Review Drafts</span>
                </button>

                {otherTabsWithItems.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTab(t.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#374151] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
                  >
                    <span>{t.label}</span>
                    <span className="font-mono-num rounded-full bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] text-[#4B5563]">
                      {t.count}
                    </span>
                  </button>
                ))}

                {undoAvailable && (
                  <button
                    type="button"
                    onClick={() => void handleUndo()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] px-3.5 py-2.5 text-[13.5px] font-medium text-[#4B5563] transition-colors hover:bg-[#F3F4F6] hover:text-[#111827]"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Undo Last</span>
                  </button>
                )}
              </div>
            </motion.div>
          ) : (
            <div className="flex w-full flex-col items-center">
              {/* TOP EDGE HINT: ↑ Bookmark */}
              <button
                type="button"
                onClick={() =>
                  isScreenerTab
                    ? handleScreenerSwipe('up')
                    : handleEmailSwipe('up')
                }
                className="mb-2 inline-flex items-center gap-1 rounded-full border border-amber-200/80 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-amber-300 hover:bg-amber-50 sm:mb-3 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs"
              >
                <span>↑</span>
                <span>{isScreenerTab ? 'Bookmark & Approve' : 'Bookmark'}</span>
              </button>

              {/* MIDDLE ROW: Left Edge Hint + Physical Card Stack + Right Edge Hint */}
              <div className="flex w-full items-center justify-center md:gap-5">
                {/* LEFT EDGE HINT: ← Archive / Mute */}
                <button
                  type="button"
                  onClick={() =>
                    isScreenerTab
                      ? handleScreenerSwipe('left')
                      : handleEmailSwipe('left')
                  }
                  className="hidden shrink-0 items-center gap-1.5 rounded-full border border-rose-200/80 bg-white/90 px-3 py-1.5 text-[12px] font-semibold text-rose-600 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-rose-300 hover:bg-rose-50 md:flex"
                >
                  <span>←</span>
                  <span>{isScreenerTab ? 'Mute' : 'Archive'}</span>
                </button>

                {/* CENTER PHYSICAL STACK */}
                <div className="relative w-[calc(100vw-24px)] max-w-[580px] pb-5 sm:w-full sm:pb-7">
                  {/* Background stacked card #3 (deepest) */}
                  {nextCardsCount >= 2 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-5 top-0 rounded-[22px] border border-[#E5E7EB] bg-white shadow-[0_8px_24px_-12px_rgba(15,23,42,0.08)] sm:bottom-7 sm:rounded-[24px]"
                      style={{
                        transform: 'translateY(22px) scale(0.92)',
                        transformOrigin: 'bottom center',
                        opacity: 0.72,
                        zIndex: 1,
                      }}
                    />
                  )}

                  {/* Background stacked card #2 (middle) */}
                  {nextCardsCount >= 1 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 bottom-5 top-0 rounded-[22px] border border-[#E5E7EB] bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.10)] sm:bottom-7 sm:rounded-[24px]"
                      style={{
                        transform: 'translateY(11px) scale(0.96)',
                        transformOrigin: 'bottom center',
                        opacity: 0.92,
                        zIndex: 2,
                      }}
                    />
                  )}

                  {/* Active Top Draggable Card */}
                  <div className="relative z-10 w-full">
                    {isScreenerTab && topScreener ? (
                      <SwipeScreenerCard
                        key={topScreener.email}
                        sender={topScreener}
                        account={accountsById.get(topScreener.accountId)}
                        exitingDirection={exitingDirection}
                        onSwipe={handleScreenerSwipe}
                      />
                    ) : topThread ? (
                      <SwipeEmailCard
                        key={topThread.id}
                        thread={topThread}
                        exitingDirection={exitingDirection}
                        onSwipe={handleEmailSwipe}
                        onOpenThread={onOpenThread}
                        onQuickDraft={onQuickDraft}
                        onOpenDrafts={onOpenDrafts}
                      />
                    ) : null}
                  </div>
                </div>

                {/* RIGHT EDGE HINT: Reply / Approve → */}
                <button
                  type="button"
                  onClick={() =>
                    isScreenerTab
                      ? handleScreenerSwipe('right')
                      : handleEmailSwipe('right')
                  }
                  className={`hidden shrink-0 items-center gap-1.5 rounded-full border bg-white/90 px-3 py-1.5 text-[12px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors md:flex ${
                    isScreenerTab
                      ? 'border-emerald-200/80 text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
                      : 'border-blue-200/80 text-blue-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span>{isScreenerTab ? 'Approve' : 'Reply'}</span>
                  <span>→</span>
                </button>
              </div>

              {/* BOTTOM EDGE HINT: ↓ Snooze / To Feed */}
              <button
                type="button"
                onClick={() =>
                  isScreenerTab
                    ? handleScreenerSwipe('down')
                    : handleEmailSwipe('down')
                }
                className="mt-1 inline-flex items-center gap-1 rounded-full border border-violet-200/80 bg-white/90 px-2.5 py-0.5 text-[11px] font-semibold text-violet-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-violet-300 hover:bg-violet-50 sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs"
              >
                <span>↓</span>
                <span>{isScreenerTab ? 'Send to Feed' : 'Snooze'}</span>
              </button>
            </div>
          )}

          {/* 3. TACTILE ACTION BAR BELOW THE CARD STACK */}
          {remainingCount > 0 && (
            <div className="mt-3.5 w-full max-w-[calc(100vw-24px)] sm:mt-5 sm:max-w-none">
              {isScreenerTab ? (
                <div className="flex flex-nowrap items-center justify-center gap-1.5 sm:flex-wrap sm:gap-2.5">
                  <button
                    type="button"
                    disabled={!undoAvailable || undoing}
                    onClick={() => void handleUndo()}
                    className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#E5E7EB] bg-white px-2 py-2 text-[10px] font-semibold text-[#4B5563] shadow-sm transition-all hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-[13.5px]"
                    title="Undo last action (Z)"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span>Undo</span>
                    <kbd className="kbd-chip hidden sm:inline-block">Z</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScreenerSwipe('left')}
                    className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-rose-200 bg-white px-2 py-2 text-[10px] font-semibold text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                  >
                    <VolumeX className="h-4 w-4 shrink-0" />
                    <span>Mute</span>
                    <kbd className="kbd-chip hidden sm:inline-block">←</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScreenerSwipe('down')}
                    className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-violet-200 bg-white px-2 py-2 text-[10px] font-semibold text-violet-700 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                  >
                    <Newspaper className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap">Feed</span>
                    <kbd className="kbd-chip hidden sm:inline-block">↓</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScreenerSwipe('up')}
                    className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-amber-200 bg-white px-2 py-2 text-[10px] font-semibold text-amber-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                  >
                    <Bookmark className="h-4 w-4 shrink-0" />
                    <span className="sm:hidden">Save</span>
                    <span className="hidden sm:inline">Bookmark</span>
                    <kbd className="kbd-chip hidden sm:inline-block">↑</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleScreenerSwipe('right')}
                    className="inline-flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#059669] px-2 py-2 text-[10px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(5,150,105,0.45)] transition-all hover:bg-[#047857] active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-5 sm:py-2.5 sm:text-[13.5px]"
                  >
                    <Check className="h-4 w-4 shrink-0" />
                    <span>Approve</span>
                    <kbd className="font-mono-num hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white sm:inline-block">
                      →
                    </kbd>
                  </button>
                </div>
              ) : (
                <div className="flex flex-nowrap items-center justify-center gap-1.5 sm:flex-wrap sm:gap-2.5">
                  <button
                    type="button"
                    disabled={!undoAvailable || undoing}
                    onClick={() => void handleUndo()}
                    className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-[#E5E7EB] bg-white px-1.5 py-2 text-[10px] font-semibold text-[#4B5563] shadow-sm transition-all hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-[13.5px]"
                    title="Undo last action (Z)"
                  >
                    <RotateCcw className="h-4 w-4 shrink-0" />
                    <span>Undo</span>
                    <kbd className="kbd-chip hidden sm:inline-block">Z</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEmailSwipe('left')}
                    className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-rose-200 bg-white px-1.5 py-2 text-[10px] font-semibold text-rose-600 shadow-sm transition-all hover:border-rose-300 hover:bg-rose-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                    title="Archive (Swipe Left)"
                  >
                    <Archive className="h-4 w-4 shrink-0" />
                    <span>Archive</span>
                    <kbd className="kbd-chip hidden sm:inline-block">←</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEmailSwipe('down')}
                    className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-violet-200 bg-white px-1.5 py-2 text-[10px] font-semibold text-violet-700 shadow-sm transition-all hover:border-violet-300 hover:bg-violet-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                    title="Snooze to tomorrow (Swipe Down)"
                  >
                    <Clock className="h-4 w-4 shrink-0" />
                    <span>Snooze</span>
                    <kbd className="kbd-chip hidden sm:inline-block">↓</kbd>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEmailSwipe('up')}
                    className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-amber-200 bg-white px-1.5 py-2 text-[10px] font-semibold text-amber-700 shadow-sm transition-all hover:border-amber-300 hover:bg-amber-50 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-4 sm:py-2.5 sm:text-[13.5px]"
                    title="Bookmark email (Swipe Up)"
                  >
                    <Bookmark className="h-4 w-4 shrink-0" />
                    <span className="sm:hidden">Save</span>
                    <span className="hidden sm:inline">Bookmark</span>
                    <kbd className="kbd-chip hidden sm:inline-block">↑</kbd>
                  </button>

                  {topThread && (
                    <button
                      type="button"
                      onClick={() => onAskClaudeAboutThread(topThread)}
                      className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border border-indigo-200 bg-indigo-50 px-1.5 py-2 text-[10px] font-semibold text-indigo-700 shadow-sm transition-all hover:border-indigo-300 hover:bg-indigo-100 active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3.5 sm:py-2.5 sm:text-[13.5px]"
                      title="Ask Claude about this email"
                    >
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span className="sm:hidden">Claude</span>
                      <span className="hidden sm:inline">Ask Claude</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleEmailSwipe('right')}
                    className="inline-flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl bg-[#2563EB] px-1.5 py-2 text-[10px] font-semibold text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.45)] transition-all hover:bg-[#1D4ED8] active:scale-[0.97] sm:flex-none sm:flex-row sm:gap-1.5 sm:px-5 sm:py-2.5 sm:text-[13.5px]"
                    title="Reply (Swipe Right)"
                  >
                    <Reply className="h-4 w-4 shrink-0" />
                    <span>Reply</span>
                    <kbd className="font-mono-num hidden rounded bg-white/20 px-1.5 py-0.5 text-[10px] text-white sm:inline-block">
                      →
                    </kbd>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
