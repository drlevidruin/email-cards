import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArrowUpRight,
  BellRing,
  Bookmark,
  BookOpen,
  Check,
  Clock,
  Handshake,
  Hourglass,
  Receipt,
  Reply,
  Search,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import type {
  CommitmentItem,
  EmailThread,
  GmailAccount,
} from '../../lib/types';
import {
  estimateReadingMinutes,
  formatCurrency,
  formatDeadlineLabel,
  formatShortDate,
  formatTimeAgo,
  getAvatarPalette,
  getInitials,
  getPrimarySender,
  isActivelySnoozed,
  isReceiptCard,
  sortThreadsForDeck,
} from './deckUtils';

export interface BrowseListViewProps {
  threads: EmailThread[];
  commitments: CommitmentItem[];
  accounts: GmailAccount[];
  selectedAccountId: string;
  onOpenThread: (threadId: string, startReply?: boolean) => void;
  onArchiveThread: (threadId: string) => Promise<void>;
  onSnoozeThread: (threadId: string, preset?: string) => Promise<void>;
  onResolveCommitment: (id: string) => Promise<void>;
  onNudgeCommitment: (id: string) => Promise<void>;
  onAskAgent: (prompt: string) => void;
}

type BrowseTab =
  | 'inbox'
  | 'bookmarked'
  | 'commitments'
  | 'newsletters'
  | 'receipts';

export const BrowseListView: React.FC<BrowseListViewProps> = ({
  threads,
  commitments,
  accounts,
  selectedAccountId,
  onOpenThread,
  onArchiveThread,
  onSnoozeThread,
  onResolveCommitment,
  onNudgeCommitment,
  onAskAgent,
}) => {
  const [activeTab, setActiveTab] = useState<BrowseTab>('inbox');
  const [searchQuery, setSearchQuery] = useState('');
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const [nudgedMap, setNudgedMap] = useState<Record<string, boolean>>({});

  const isAllAccounts = !selectedAccountId || selectedAccountId === 'all';
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const scopedThreads = useMemo(
    () =>
      threads.filter(
        (t) =>
          !t.isArchived &&
          !isActivelySnoozed(t) &&
          (isAllAccounts || t.accountId === selectedAccountId),
      ),
    [threads, isAllAccounts, selectedAccountId],
  );

  const scopedCommitments = useMemo(
    () =>
      commitments.filter(
        (c) =>
          c.status !== 'resolved' &&
          (isAllAccounts || c.accountId === selectedAccountId),
      ),
    [commitments, isAllAccounts, selectedAccountId],
  );

  const matchesSearch = (thread: EmailThread): boolean => {
    if (!normalizedQuery) return true;
    const sender = getPrimarySender(thread);
    const haystack = [
      thread.subject,
      thread.snippet,
      thread.distilledAsk ?? '',
      sender.name,
      sender.email,
      thread.accountLabel,
      thread.receiptInfo?.vendor ?? '',
      thread.receiptInfo?.invoiceNumber ?? '',
      thread.receiptInfo?.category ?? '',
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedQuery);
  };

  const inboxThreads = useMemo(
    () =>
      sortThreadsForDeck(
        scopedThreads.filter(
          (t) =>
            t.bucket !== 'feed' &&
            t.bucket !== 'paper_trail' &&
            t.bucket !== 'screener',
        ),
      ).filter(matchesSearch),
    [scopedThreads, normalizedQuery],
  );

  const bookmarkedThreads = useMemo(
    () =>
      sortThreadsForDeck(scopedThreads.filter((t) => t.isStarred)).filter(
        matchesSearch,
      ),
    [scopedThreads, normalizedQuery],
  );

  const newsletterThreads = useMemo(
    () =>
      scopedThreads
        .filter((t) => t.bucket === 'feed')
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        )
        .filter(matchesSearch),
    [scopedThreads, normalizedQuery],
  );

  const receiptThreads = useMemo(
    () =>
      scopedThreads
        .filter(isReceiptCard)
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt).getTime() -
            new Date(a.lastMessageAt).getTime(),
        )
        .filter(matchesSearch),
    [scopedThreads, normalizedQuery],
  );

  const filteredCommitments = useMemo(() => {
    if (!normalizedQuery) return scopedCommitments;
    return scopedCommitments.filter((c) =>
      `${c.counterpartyName} ${c.counterpartyEmail} ${c.summary} ${c.accountLabel}`
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [scopedCommitments, normalizedQuery]);

  const youPromised = useMemo(
    () => filteredCommitments.filter((c) => c.direction === 'you_promised'),
    [filteredCommitments],
  );

  const waitingOnThem = useMemo(
    () => filteredCommitments.filter((c) => c.direction === 'waiting_on_them'),
    [filteredCommitments],
  );

  const totalReceiptsSpend = useMemo(
    () =>
      receiptThreads.reduce(
        (sum, t) => sum + (t.receiptInfo?.amount ?? 0),
        0,
      ),
    [receiptThreads],
  );

  const handleNudge = async (id: string) => {
    setNudgingId(id);
    try {
      await onNudgeCommitment(id);
      setNudgedMap((prev) => ({ ...prev, [id]: true }));
    } finally {
      setNudgingId(null);
    }
  };

  const tabs: { id: BrowseTab; label: string; count: number }[] = [
    { id: 'inbox', label: 'Inbox', count: inboxThreads.length },
    { id: 'bookmarked', label: 'Bookmarked', count: bookmarkedThreads.length },
    {
      id: 'commitments',
      label: 'Waiting & Promises',
      count: filteredCommitments.length,
    },
    { id: 'newsletters', label: 'Newsletters', count: newsletterThreads.length },
    { id: 'receipts', label: 'Receipts', count: receiptThreads.length },
  ];

  return (
    <div className="h-full w-full overflow-x-hidden overflow-y-auto bg-[#F5F4F0] px-3 py-5 sm:px-8 sm:py-6">
      <div className="mx-auto max-w-[980px] space-y-5 sm:space-y-6 pb-12">
        {/* Top Tabs + Search Input */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div
            role="tablist"
            aria-label="Browse categories"
            className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto rounded-2xl border border-[#E5E7EB] bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)] md:flex-nowrap md:overflow-visible"
          >
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold transition-all ${
                    active
                      ? 'bg-[#111827] text-white shadow-sm'
                      : 'text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]'
                  }`}
                >
                  {tab.id === 'bookmarked' && (
                    <Bookmark
                      className={`h-3.5 w-3.5 ${
                        active ? 'fill-amber-300 text-amber-300' : 'text-amber-500'
                      }`}
                    />
                  )}
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono-num rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                      active
                        ? 'bg-white/20 text-white'
                        : tab.id === 'bookmarked' && tab.count > 0
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-[#F3F4F6] text-[#6B7280]'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative w-full md:w-56 lg:w-64 shrink-0">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter emails, people, vendors..."
              className="w-full rounded-2xl border border-[#E5E7EB] bg-white py-2 pl-10 pr-9 text-[13.5px] text-[#111827] shadow-[0_1px_2px_rgba(15,23,42,0.04)] placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#374151]"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: INBOX & TAB 1B: BOOKMARKED */}
        {(activeTab === 'inbox' || activeTab === 'bookmarked') && (
          <div className="space-y-3">
            {(activeTab === 'bookmarked' ? bookmarkedThreads : inboxThreads)
              .length === 0 ? (
              <div className="rounded-3xl border border-[#E5E7EB] bg-white px-6 py-14 text-center">
                <p className="text-[16px] font-semibold text-[#111827]">
                  {activeTab === 'bookmarked'
                    ? 'No bookmarked emails yet'
                    : 'No matching inbox threads'}
                </p>
                <p className="mt-1 text-[14px] text-[#6B7280]">
                  {activeTab === 'bookmarked'
                    ? 'Swipe up on any email card to save it here.'
                    : 'Try clearing your search or checking another account tab.'}
                </p>
              </div>
            ) : (
              (activeTab === 'bookmarked'
                ? bookmarkedThreads
                : inboxThreads
              ).map((thread) => {
                const sender = getPrimarySender(thread);
                const avatar = getAvatarPalette(sender.email || sender.name);
                const deadline = formatDeadlineLabel(thread.deadlineLabel);
                const summary =
                  thread.distilledAsk ||
                  thread.aiSummaryBullets?.[0] ||
                  thread.snippet;

                return (
                  <article
                    key={thread.id}
                    onClick={() => onOpenThread(thread.id, false)}
                    className="group cursor-pointer rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] transition-all hover:border-[#D1D5DB] hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-[12.5px] font-bold"
                          style={{
                            backgroundColor: avatar.bg,
                            color: avatar.text,
                            borderColor: avatar.border,
                          }}
                        >
                          {getInitials(sender.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[14.5px] font-semibold text-[#111827]">
                              {sender.name}
                            </span>
                            {thread.isUnread && (
                              <span className="h-2 w-2 shrink-0 rounded-full bg-[#2563EB]" />
                            )}
                            <span className="text-[12.5px] text-[#6B7280]">
                              {formatTimeAgo(thread.lastMessageAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[12px] text-[#6B7280]">
                            <span className="inline-flex items-center gap-1.5">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{ backgroundColor: thread.accountColor }}
                              />
                              <span className="font-medium text-[#374151]">
                                {thread.accountLabel}
                              </span>
                            </span>
                            {thread.messageCount > 1 && (
                              <span>({thread.messageCount} messages)</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {thread.isStarred && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-700">
                            <Bookmark className="h-3 w-3 fill-amber-500 text-amber-600" />
                            <span>Bookmarked</span>
                          </span>
                        )}
                        {deadline && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-rose-700">
                            <Clock className="h-3 w-3" />
                            <span>{deadline}</span>
                          </span>
                        )}
                        {thread.bucket === 'decision' && (
                          <span className="rounded-full border border-amber-200 bg-[#FEFCE8] px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800">
                            Decision
                          </span>
                        )}
                      </div>
                    </div>

                    <h3 className="mt-3 text-[17px] font-semibold leading-snug text-[#111827] group-hover:text-[#2563EB]">
                      {thread.subject}
                    </h3>
                    <p className="mt-1.5 line-clamp-2 text-[14.5px] leading-relaxed text-[#4B5563]">
                      {summary}
                    </p>

                    <div
                      className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F3F4F6] pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenThread(thread.id, true)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#EFF6FF] px-3 py-1.5 text-[12.5px] font-semibold text-[#1D4ED8] transition-colors hover:bg-[#DBEAFE]"
                        >
                          <Reply className="h-3.5 w-3.5" />
                          <span>Reply</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onSnoozeThread(thread.id, 'tomorrow')}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#4B5563] transition-colors hover:bg-[#F9FAFB] hover:text-[#111827]"
                        >
                          <Clock className="h-3.5 w-3.5" />
                          <span>Snooze</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void onArchiveThread(thread.id)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-medium text-emerald-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50"
                        >
                          <Archive className="h-3.5 w-3.5" />
                          <span>Archive</span>
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => onOpenThread(thread.id, false)}
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#6B7280] hover:text-[#111827]"
                      >
                        <span>Open</span>
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {/* TAB 2: WAITING & PROMISES */}
        {activeTab === 'commitments' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {/* You Promised */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                    <Handshake className="h-4 w-4" />
                  </span>
                  <h2 className="text-[15.5px] font-semibold text-[#111827]">
                    You Promised
                  </h2>
                </div>
                <span className="font-mono-num rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-semibold text-amber-800">
                  {youPromised.length}
                </span>
              </div>

              {youPromised.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center text-[14px] text-[#6B7280]">
                  No open promises left to fulfill.
                </div>
              ) : (
                youPromised.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: item.accountColor }}
                        />
                        <span className="text-[14.5px] font-semibold text-[#111827]">
                          {item.counterpartyName}
                        </span>
                        <span className="text-[12px] text-[#6B7280]">
                          {item.accountLabel}
                        </span>
                      </div>
                      <span className="font-mono-num rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800 border border-amber-200">
                        {item.daysOpen}d open
                      </span>
                    </div>

                    <p className="mt-2.5 text-[15px] leading-relaxed text-[#374151]">
                      {item.summary}
                    </p>
                    {item.dueLabel && (
                      <div className="mt-1.5 text-[12.5px] font-medium text-[#6B7280]">
                        Target: {item.dueLabel}
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-3">
                      <button
                        type="button"
                        onClick={() => onOpenThread(item.threadId, true)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#EFF6FF] px-3 py-1.5 text-[12.5px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
                      >
                        <Reply className="h-3.5 w-3.5" />
                        <span>Reply</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void onResolveCommitment(item.id)}
                        className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>Mark Done</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Waiting On Others */}
            <section className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                    <Hourglass className="h-4 w-4" />
                  </span>
                  <h2 className="text-[15.5px] font-semibold text-[#111827]">
                    Waiting On Others
                  </h2>
                </div>
                <span className="font-mono-num rounded-full bg-blue-100 px-2.5 py-0.5 text-[12px] font-semibold text-blue-800">
                  {waitingOnThem.length}
                </span>
              </div>

              {waitingOnThem.length === 0 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 text-center text-[14px] text-[#6B7280]">
                  Nobody owes you a pending response right now.
                </div>
              ) : (
                waitingOnThem.map((item) => {
                  const nudged = item.status === 'nudged' || nudgedMap[item.id];
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: item.accountColor }}
                          />
                          <span className="text-[14.5px] font-semibold text-[#111827]">
                            {item.counterpartyName}
                          </span>
                          <span className="text-[12px] text-[#6B7280]">
                            {item.accountLabel}
                          </span>
                        </div>
                        <span className="font-mono-num rounded-full bg-blue-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-blue-700 border border-blue-200">
                          {item.daysOpen}d waiting
                        </span>
                      </div>

                      <p className="mt-2.5 text-[15px] leading-relaxed text-[#374151]">
                        {item.summary}
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#F3F4F6] pt-3">
                        <button
                          type="button"
                          disabled={nudgingId === item.id}
                          onClick={() => void handleNudge(item.id)}
                          className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[12.5px] font-semibold transition-colors disabled:opacity-60 ${
                            nudged
                              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'bg-[#2563EB] text-white hover:bg-[#1D4ED8]'
                          }`}
                        >
                          <BellRing className="h-3.5 w-3.5" />
                          <span>
                            {nudgingId === item.id
                              ? 'Drafting Nudge...'
                              : nudged
                                ? 'Nudge Saved to Drafts'
                                : 'Draft Polite Nudge'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenThread(item.threadId, false)}
                          className="inline-flex items-center gap-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#4B5563] hover:bg-[#F9FAFB]"
                        >
                          <span>Thread</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void onResolveCommitment(item.id)}
                          className="ml-auto inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-[12.5px] font-semibold text-emerald-700 hover:bg-emerald-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Resolve</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </section>
          </div>
        )}

        {/* TAB 3: NEWSLETTERS */}
        {activeTab === 'newsletters' && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {newsletterThreads.length === 0 ? (
              <div className="col-span-full rounded-3xl border border-[#E5E7EB] bg-white px-6 py-14 text-center">
                <p className="text-[16px] font-semibold text-[#111827]">
                  No unread newsletters waiting
                </p>
              </div>
            ) : (
              newsletterThreads.map((thread) => {
                const sender = getPrimarySender(thread);
                const mins = estimateReadingMinutes(thread);
                const bullets =
                  thread.aiSummaryBullets && thread.aiSummaryBullets.length > 0
                    ? thread.aiSummaryBullets.slice(0, 2)
                    : [thread.snippet];

                return (
                  <article
                    key={thread.id}
                    onClick={() => onOpenThread(thread.id, false)}
                    className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] transition-all hover:border-[#D1D5DB] hover:shadow-[0_12px_28px_-12px_rgba(15,23,42,0.12)]"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 text-[12px] text-[#6B7280]">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-[#374151]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: thread.accountColor }}
                          />
                          <span className="truncate">{sender.name}</span>
                        </span>
                        <span className="font-mono-num shrink-0">
                          {mins} min read
                        </span>
                      </div>

                      <h3 className="mt-2.5 text-[18px] font-semibold leading-snug text-[#111827] group-hover:text-[#2563EB]">
                        {thread.subject}
                      </h3>

                      <ul className="mt-3 space-y-1.5 rounded-xl border border-[#F3F4F6] bg-[#F9FAFB] p-3.5 text-[14px] leading-relaxed text-[#374151]">
                        {bullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ backgroundColor: thread.accountColor }}
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div
                      className="mt-4 flex items-center justify-between border-t border-[#F3F4F6] pt-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="text-[12px] text-[#6B7280]">
                        {formatShortDate(thread.lastMessageAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void onArchiveThread(thread.id)}
                          className="rounded-xl border border-[#E5E7EB] px-2.5 py-1.5 text-[12px] font-medium text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
                        >
                          Archive
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenThread(thread.id, false)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-[#111827] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#1F2937]"
                        >
                          <BookOpen className="h-3.5 w-3.5" />
                          <span>Read</span>
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        )}

        {/* TAB 4: RECEIPTS */}
        {activeTab === 'receipts' && (
          <div className="space-y-4">
            {/* Clean Light Financial Summary Header */}
            <div className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-[0_2px_10px_-4px_rgba(15,23,42,0.06)] sm:flex-row sm:items-center">
              <div className="flex items-center gap-3.5">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Wallet className="h-5 w-5" />
                </span>
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#6B7280]">
                    Total Tracked Spend ({receiptThreads.length} receipts across{' '}
                    {accounts.length} accounts)
                  </div>
                  <div className="font-mono-num mt-0.5 text-[26px] font-bold tracking-tight text-[#111827]">
                    {formatCurrency(totalReceiptsSpend)}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  onAskAgent(
                    'Summarize my recent receipts, invoices, SaaS subscriptions, and travel expenses across all connected Gmail accounts.',
                  )
                }
                className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-[13px] font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
              >
                <Sparkles className="h-4 w-4" />
                <span>Ask Claude to Summarize Spend</span>
              </button>
            </div>

            {receiptThreads.length === 0 ? (
              <div className="rounded-3xl border border-[#E5E7EB] bg-white px-6 py-14 text-center text-[14.5px] text-[#6B7280]">
                No matching receipts or travel confirmations found.
              </div>
            ) : (
              <div className="space-y-2.5">
                {receiptThreads.map((thread) => {
                  const vendor =
                    thread.receiptInfo?.vendor || getPrimarySender(thread).name;
                  const amount = thread.receiptInfo?.amount;
                  const category = thread.receiptInfo?.category || 'Receipt';
                  const invoiceNo = thread.receiptInfo?.invoiceNumber;

                  return (
                    <article
                      key={thread.id}
                      onClick={() => onOpenThread(thread.id, false)}
                      className="group flex cursor-pointer flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_4px_rgba(15,23,42,0.04)] transition-all hover:border-[#D1D5DB] hover:shadow-[0_10px_24px_-12px_rgba(15,23,42,0.12)]"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] text-[#374151]">
                          <Receipt className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[15.5px] font-semibold text-[#111827] group-hover:text-[#2563EB]">
                              {vendor}
                            </span>
                            {invoiceNo && (
                              <span className="font-mono-num rounded bg-[#F3F4F6] px-1.5 py-0.5 text-[11px] font-medium text-[#4B5563]">
                                {invoiceNo}
                              </span>
                            )}
                            <span className="rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-0.5 text-[11px] font-medium text-[#4B5563]">
                              {category}
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-[13.5px] text-[#6B7280]">
                            {thread.subject}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-[12px] font-medium text-[#374151]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: thread.accountColor }}
                          />
                          <span>{thread.accountLabel}</span>
                        </span>

                        <span className="font-mono-num text-[12.5px] text-[#6B7280]">
                          {formatShortDate(thread.lastMessageAt)}
                        </span>

                        <span className="font-mono-num min-w-[84px] text-right text-[16px] font-bold text-[#111827]">
                          {typeof amount === 'number'
                            ? formatCurrency(
                                amount,
                                thread.receiptInfo?.currency || 'USD',
                              )
                            : 'Doc'}
                        </span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
