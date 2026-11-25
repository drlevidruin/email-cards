import React, { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Clock,
  Star,
  Sparkles,
  Search,
  ShieldAlert,
  Check,
  VolumeX,
  BookOpen,
  X,
  Receipt,
} from 'lucide-react';
import type {
  CustomView,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  PriorityBucket,
  ScreenerSender,
  ShabbosStatus,
} from '../../lib/types';
import { ThreadReader } from './ThreadReader';
import { cn, formatCurrency, formatRelativeTime } from '../../lib/utils';

interface StreamLensProps {
  threads: EmailThread[];
  tasks: ExtractedTask[];
  accounts: GmailAccount[];
  screener: ScreenerSender[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  activeView: CustomView | null;
  onClearView: () => void;
  nlFilterState: { query: string; explanation: string; threadIds: string[] } | null;
  onClearNlFilter: () => void;
  selectedThreadId: string | null;
  onSelectThread: (threadId: string) => void;
  shabbosStatus: ShabbosStatus | null;
  onArchiveThread: (threadId: string) => Promise<void>;
  onSnoozeThread: (threadId: string, until?: string) => Promise<void>;
  onToggleStar: (threadId: string, nextStarred: boolean) => Promise<void>;
  onToggleRead: (threadId: string, nextUnread: boolean) => Promise<void>;
  onChangeBucket: (threadId: string, bucket: PriorityBucket) => Promise<void>;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
  onScreenerDecision: (email: string, decision: 'approved' | 'feed' | 'muted') => Promise<void>;
  onRefreshData: () => Promise<void>;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

type StreamFilter = 'all' | 'decision' | 'waiting' | 'feed' | 'paper_trail' | 'starred' | 'archived';

const GROUP_ORDER: { bucket: PriorityBucket; title: string; accent: string }[] = [
  { bucket: 'decision', title: 'NOW / DECISIONS', accent: '#F87171' },
  { bucket: 'waiting', title: 'WAITING', accent: '#60A5FA' },
  { bucket: 'feed', title: 'FEED', accent: '#A78BFA' },
  { bucket: 'paper_trail', title: 'PAPER TRAIL', accent: '#34D399' },
];

export const StreamLens: React.FC<StreamLensProps> = ({
  threads,
  tasks,
  accounts,
  screener,
  selectedAccountId,
  onSelectAccount,
  activeView,
  onClearView,
  nlFilterState,
  onClearNlFilter,
  selectedThreadId,
  onSelectThread,
  shabbosStatus,
  onArchiveThread,
  onSnoozeThread,
  onToggleStar,
  onToggleRead,
  onChangeBucket,
  onToggleTask,
  onScreenerDecision,
  onRefreshData,
  onToast,
}) => {
  const [bucketFilter, setBucketFilter] = useState<StreamFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [screenerOpen, setScreenerOpen] = useState(false);
  const [focusReplyNonce, setFocusReplyNonce] = useState(0);

  const pendingScreener = useMemo(
    () =>
      screener.filter(
        (s) =>
          s.status === 'pending' &&
          (selectedAccountId === 'all' || s.accountId === selectedAccountId)
      ),
    [screener, selectedAccountId]
  );

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return threads
      .filter((t) => {
        if (selectedAccountId !== 'all' && t.accountId !== selectedAccountId) return false;

        if (nlFilterState) {
          return nlFilterState.threadIds.includes(t.id);
        }

        if (activeView) {
          if (activeView.threadIds && activeView.threadIds.length > 0) {
            return activeView.threadIds.includes(t.id);
          }
          const spec = activeView.filterSpec || {};
          if (typeof spec.bucket === 'string' && t.bucket !== spec.bucket) return false;
          if (typeof spec.accountId === 'string' && t.accountId !== spec.accountId) return false;
          if (spec.hasReceipt && !t.receiptInfo) return false;
          if (spec.unreadOnly && !t.isUnread) return false;
          return !t.isArchived;
        }

        if (bucketFilter === 'archived') return t.isArchived || t.bucket === 'archived';
        if (t.isArchived || t.bucket === 'archived' || t.bucket === 'screener') return false;
        if (bucketFilter === 'starred') return t.isStarred;
        if (bucketFilter !== 'all' && t.bucket !== bucketFilter) return false;

        if (q) {
          const hay = [
            t.subject,
            t.snippet,
            t.distilledAsk || '',
            t.accountLabel,
            ...t.participants.map((p) => `${p.name} ${p.email}`),
          ]
            .join(' ')
            .toLowerCase();
          return hay.includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        if (bucketFilter === 'all') {
          const order = { decision: 0, waiting: 1, feed: 2, paper_trail: 3, screener: 4, archived: 5 };
          if (order[a.bucket] !== order[b.bucket]) return order[a.bucket] - order[b.bucket];
          if (b.urgencyScore !== a.urgencyScore) return b.urgencyScore - a.urgencyScore;
        }
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });
  }, [threads, selectedAccountId, bucketFilter, searchQuery, activeView, nlFilterState]);

  // Auto-select first thread if current selection isn't visible
  useEffect(() => {
    if (
      filteredThreads.length > 0 &&
      (!selectedThreadId || !filteredThreads.some((t) => t.id === selectedThreadId))
    ) {
      onSelectThread(filteredThreads[0].id);
    }
  }, [filteredThreads, selectedThreadId, onSelectThread]);

  // Superhuman / Linear J, K, E, H, R keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
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
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (filteredThreads.length === 0) return;
      const idx = filteredThreads.findIndex((t) => t.id === selectedThreadId);

      if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault();
        const next = filteredThreads[Math.min(idx + 1, filteredThreads.length - 1)] || filteredThreads[0];
        onSelectThread(next.id);
      } else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = filteredThreads[Math.max(idx - 1, 0)] || filteredThreads[0];
        onSelectThread(prev.id);
      } else if (key === 'e' && selectedThreadId) {
        e.preventDefault();
        const nextThread = filteredThreads[idx + 1] || filteredThreads[idx - 1];
        void onArchiveThread(selectedThreadId).then(() => {
          if (nextThread) onSelectThread(nextThread.id);
        });
      } else if (key === 'h' && selectedThreadId) {
        e.preventDefault();
        const tomorrow = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
        void onSnoozeThread(selectedThreadId, tomorrow);
      } else if (key === 'r' && selectedThreadId) {
        e.preventDefault();
        setFocusReplyNonce((n) => n + 1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filteredThreads, selectedThreadId, onSelectThread, onArchiveThread, onSnoozeThread]);

  const groupedThreads = useMemo(() => {
    if (bucketFilter !== 'all' || nlFilterState || activeView) {
      return [
        {
          bucket: 'decision' as PriorityBucket,
          title: nlFilterState
            ? `CLAUDE FILTER (${filteredThreads.length})`
            : activeView
              ? activeView.name.toUpperCase()
              : bucketFilter.replace('_', ' ').toUpperCase(),
          accent: '#60A5FA',
          items: filteredThreads,
        },
      ];
    }

    return GROUP_ORDER.map((group) => ({
      ...group,
      items: filteredThreads.filter((t) => t.bucket === group.bucket),
    })).filter((g) => g.items.length > 0);
  }, [filteredThreads, bucketFilter, nlFilterState, activeView]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === selectedThreadId) || null,
    [threads, selectedThreadId]
  );

  return (
    <div className="h-full flex overflow-hidden">
      {/* Left Thread Stream Pane */}
      <div
        className="w-[345px] xl:w-[375px] 2xl:w-[435px] flex-shrink-0 h-full border-r flex flex-col overflow-hidden"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-canvas)',
        }}
      >
        {/* Account Filter Tabs + Search */}
        <div className="p-3 border-b space-y-2.5 flex-shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <button
              type="button"
              onClick={() => onSelectAccount('all')}
              className={cn(
                'px-2.5 py-1 rounded-lg text-[11.5px] font-medium flex-shrink-0 transition-colors border',
                selectedAccountId === 'all'
                  ? 'bg-[var(--bg-active)] border-[var(--border-strong)]'
                  : 'border-transparent hover:bg-[var(--bg-hover)]'
              )}
              style={{
                color: selectedAccountId === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              }}
            >
              All ({threads.filter((t) => !t.isArchived && t.bucket !== 'screener').length})
            </button>
            {accounts.map((acc) => {
              const active = selectedAccountId === acc.id;
              return (
                <button
                  key={acc.id}
                  type="button"
                  onClick={() => onSelectAccount(active ? 'all' : acc.id)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[11.5px] font-medium flex items-center gap-1.5 flex-shrink-0 transition-colors border',
                    active
                      ? 'border-[var(--border-strong)] bg-[var(--bg-active)]'
                      : 'border-transparent hover:bg-[var(--bg-hover)]'
                  )}
                  style={{ color: active ? 'var(--text-primary)' : 'var(--text-secondary)' }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: acc.color }} />
                  {acc.label}
                </button>
              );
            })}
          </div>

          {/* Search & Bucket Tabs */}
          <div className="flex items-center gap-2">
            <div
              className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <Search className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter stream..."
                className="flex-1 bg-transparent text-[12px] focus:outline-none placeholder:text-[var(--text-muted)]"
                style={{ color: 'var(--text-primary)' }}
              />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')}>
                  <X className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'decision', label: 'Decisions' },
                { id: 'waiting', label: 'Waiting' },
                { id: 'feed', label: 'Feed' },
                { id: 'paper_trail', label: 'Receipts' },
                { id: 'starred', label: 'Starred' },
                { id: 'archived', label: 'Archived' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setBucketFilter(f.id)}
                className={cn(
                  'px-2 py-1 rounded-md text-[11px] font-medium flex-shrink-0 transition-colors',
                  bucketFilter === f.id ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                )}
                style={{
                  color: bucketFilter === f.id ? 'var(--text-primary)' : 'var(--text-muted)',
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Claude NL-Filter / Active Custom View Banner */}
        {(nlFilterState || activeView) && (
          <div className="px-3.5 py-2 border-b bg-violet-500/10 border-violet-500/25 flex items-center justify-between gap-2 flex-shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11.5px] font-semibold text-violet-300">
                <Sparkles className="w-3 h-3" />
                {nlFilterState ? `Claude Filter: "${nlFilterState.query}"` : `View: ${activeView?.name}`}
              </div>
              {nlFilterState && (
                <div className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
                  {nlFilterState.explanation}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={nlFilterState ? onClearNlFilter : onClearView}
              className="px-2 py-1 rounded-md text-[11px] font-medium bg-white/10 hover:bg-white/15 flex-shrink-0"
              style={{ color: 'var(--text-primary)' }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Quick Screener Strip */}
        {pendingScreener.length > 0 && (
          <div
            className="border-b flex-shrink-0"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-elevated)',
            }}
          >
            <button
              type="button"
              onClick={() => setScreenerOpen((v) => !v)}
              className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-[var(--bg-hover)] transition-colors"
            >
              <div className="flex items-center gap-2 text-[12px] font-medium" style={{ color: 'var(--text-primary)' }}>
                <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {pendingScreener.length} first-time{' '}
                  {pendingScreener.length === 1 ? 'sender' : 'senders'} in Screener
                </span>
              </div>
              <span className="text-[11px] text-sky-400 font-medium">
                {screenerOpen ? 'Hide' : 'Review'}
              </span>
            </button>

            {screenerOpen && (
              <div className="px-3 pb-3 space-y-2 max-h-[210px] overflow-y-auto">
                {pendingScreener.map((s) => (
                  <div
                    key={s.email}
                    className="p-2.5 rounded-xl border space-y-1.5"
                    style={{
                      backgroundColor: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {s.name}
                        </div>
                        <div className="text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                          {s.sampleSubject}
                        </div>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 flex-shrink-0">
                        AI: {s.aiRecommendation}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void onScreenerDecision(s.email, 'approved')}
                        className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 flex items-center justify-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Allow
                      </button>
                      <button
                        type="button"
                        onClick={() => void onScreenerDecision(s.email, 'feed')}
                        className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-violet-500/15 text-violet-300 hover:bg-violet-500/25 flex items-center justify-center gap-1"
                      >
                        <BookOpen className="w-3 h-3" />
                        Feed
                      </button>
                      <button
                        type="button"
                        onClick={() => void onScreenerDecision(s.email, 'muted')}
                        className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-rose-500/15 text-rose-500 dark:text-rose-400 hover:bg-rose-500/25 flex items-center justify-center gap-1"
                      >
                        <VolumeX className="w-3 h-3" />
                        Mute
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Grouped Thread List */}
        <div className="flex-1 overflow-y-auto">
          {groupedThreads.length === 0 ? (
            <div className="py-16 px-6 text-center space-y-2">
              <div className="font-editorial text-[22px]" style={{ color: 'var(--text-primary)' }}>
                Inbox zero in this view
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                No matching threads. Clear filters or switch lenses to explore other accounts.
              </p>
            </div>
          ) : (
            groupedThreads.map((group) => (
              <div key={group.title}>
                {/* Sticky Priority Group Header */}
                <div
                  className="sticky top-0 z-10 px-3.5 py-1.5 border-b flex items-center justify-between backdrop-blur-md"
                  style={{
                    backgroundColor: 'var(--bg-glass)',
                    borderColor: 'var(--border-subtle)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: group.accent }}
                    />
                    <span
                      className="text-[10px] font-semibold tracking-[0.14em]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {group.title}
                    </span>
                  </div>
                  <span className="font-mono-num text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    {group.items.length}
                  </span>
                </div>

                {/* Rows */}
                <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                  {group.items.map((thread) => {
                    const isSelected = thread.id === selectedThreadId;
                    const sender =
                      thread.participants.find(
                        (p) => p.email.toLowerCase() !== thread.accountEmail.toLowerCase()
                      )?.name ||
                      thread.participants[0]?.name ||
                      thread.accountLabel;

                    return (
                      <div
                        key={thread.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => onSelectThread(thread.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            onSelectThread(thread.id);
                          }
                        }}
                        className={cn(
                          'group relative px-3.5 py-3 cursor-pointer transition-colors',
                          isSelected ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                        )}
                      >
                        {/* Left Account Color Spine */}
                        <span
                          className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-opacity"
                          style={{
                            backgroundColor: thread.accountColor,
                            opacity: isSelected ? 1 : 0.45,
                          }}
                        />

                        {/* Row 1: Sender + Badges + Time */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {thread.isUnread && (
                              <span
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ backgroundColor: 'var(--accent-prism)' }}
                              />
                            )}
                            <span
                              className={cn(
                                'text-[12.5px] truncate',
                                thread.isUnread ? 'font-semibold' : 'font-medium'
                              )}
                              style={{ color: 'var(--text-primary)' }}
                            >
                              {sender}
                            </span>
                            {thread.messageCount > 1 && (
                              <span
                                className="font-mono-num text-[10px] px-1 rounded"
                                style={{
                                  backgroundColor: 'var(--bg-elevated)',
                                  color: 'var(--text-muted)',
                                }}
                              >
                                {thread.messageCount}
                              </span>
                            )}
                            <span
                              className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                              style={{
                                backgroundColor: `${thread.accountColor}18`,
                                color: thread.accountColor,
                              }}
                            >
                              {thread.accountLabel}
                            </span>
                          </div>

                          {/* Timestamp or Quick Hover Actions */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <span
                              className="font-mono-num text-[10.5px] group-hover:hidden"
                              style={{ color: 'var(--text-muted)' }}
                            >
                              {formatRelativeTime(thread.lastMessageAt)}
                            </span>
                            <div className="hidden group-hover:flex items-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onArchiveThread(thread.id);
                                }}
                                className="p-1 rounded hover:bg-white/10"
                                style={{ color: 'var(--text-secondary)' }}
                                title="Archive (E)"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const tomorrow = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
                                  void onSnoozeThread(thread.id, tomorrow);
                                }}
                                className="p-1 rounded hover:bg-white/10"
                                style={{ color: 'var(--text-secondary)' }}
                                title="Snooze (H)"
                              >
                                <Clock className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void onToggleStar(thread.id, !thread.isStarred);
                                }}
                                className="p-1 rounded hover:bg-white/10"
                                title="Star"
                              >
                                <Star
                                  className={cn(
                                    'w-3.5 h-3.5',
                                    thread.isStarred
                                      ? 'text-amber-400 fill-amber-400'
                                      : 'text-[var(--text-secondary)]'
                                  )}
                                />
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Row 2: Subject + Urgency / Deadline / Receipt */}
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div
                            className={cn(
                              'text-[13px] truncate',
                              thread.isUnread ? 'font-semibold' : 'font-medium'
                            )}
                            style={{ color: 'var(--text-primary)' }}
                          >
                            {thread.subject}
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {thread.deadlineLabel && (
                              <span className="font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-rose-500/15 text-rose-400">
                                {thread.deadlineLabel}
                              </span>
                            )}
                            {thread.receiptInfo && (
                              <span className="inline-flex items-center gap-0.5 font-mono-num text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                                <Receipt className="w-2.5 h-2.5" />
                                {formatCurrency(thread.receiptInfo.amount, thread.receiptInfo.currency)}
                              </span>
                            )}
                            {thread.urgencyScore >= 75 && (
                              <span
                                className={cn(
                                  'font-mono-num text-[10px] px-1.5 py-0.5 rounded font-semibold',
                                  thread.urgencyScore >= 85
                                    ? 'bg-rose-500/20 text-rose-500 dark:text-rose-400'
                                    : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                                )}
                              >
                                {thread.urgencyScore}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Row 3: Inline AI Distilled Ask or Snippet */}
                        {thread.distilledAsk ? (
                          <div className="flex items-start gap-1.5 text-[11.5px] leading-snug">
                            <Sparkles className="w-3 h-3 text-sky-400 mt-0.5 flex-shrink-0" />
                            <span
                              className="line-clamp-1 font-medium"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              {thread.distilledAsk}
                            </span>
                          </div>
                        ) : (
                          <div
                            className="text-[11.5px] line-clamp-1"
                            style={{ color: 'var(--text-muted)' }}
                          >
                            {thread.snippet}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Keyboard Shortcut Footer */}
        <div
          className="px-3.5 py-1.5 border-t flex items-center justify-between text-[10.5px] flex-shrink-0"
          style={{
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
            backgroundColor: 'var(--bg-rail)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <span>
              <strong className="font-mono-num">J/K</strong> Move
            </span>
            <span>
              <strong className="font-mono-num">E</strong> Archive
            </span>
            <span>
              <strong className="font-mono-num">H</strong> Snooze
            </span>
            <span>
              <strong className="font-mono-num">R</strong> Reply
            </span>
          </div>
          <span className="font-mono-num">{filteredThreads.length} shown</span>
        </div>
      </div>

      {/* Right Crystal Thread Reader Split Pane */}
      <div className="flex-1 min-w-0 h-full">
        <ThreadReader
          threadId={selectedThreadId}
          fallbackThread={activeThread}
          allThreads={threads}
          allTasks={tasks}
          accounts={accounts}
          shabbosStatus={shabbosStatus}
          mode="pane"
          focusReplyNonce={focusReplyNonce}
          onSelectThread={onSelectThread}
          onArchive={onArchiveThread}
          onSnooze={onSnoozeThread}
          onToggleStar={onToggleStar}
          onToggleRead={onToggleRead}
          onChangeBucket={onChangeBucket}
          onToggleTask={onToggleTask}
          onRefreshData={onRefreshData}
          onToast={onToast}
        />
      </div>
    </div>
  );
};
