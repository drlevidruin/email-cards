import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Clock,
  Star,
  MailOpen,
  Mail,
  X,
  Sparkles,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Paperclip,
  Send,
  Shield,
  Loader2,
  Link2,
  CheckCircle2,
  Receipt,
  RefreshCw,
  Plus,
} from 'lucide-react';
import type {
  DraftItem,
  DraftTone,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  PriorityBucket,
  ShabbosStatus,
} from '../../lib/types';
import { api } from '../../lib/api';
import {
  cn,
  formatBytes,
  formatClockTime,
  formatCurrency,
  formatRelativeTime,
  getInitials,
  urgencyMeta,
} from '../../lib/utils';

interface ThreadReaderProps {
  threadId: string | null;
  fallbackThread?: EmailThread | null;
  allThreads: EmailThread[];
  allTasks: ExtractedTask[];
  accounts: GmailAccount[];
  shabbosStatus: ShabbosStatus | null;
  mode?: 'pane' | 'drawer';
  autoFocusReply?: boolean;
  focusReplyNonce?: number;
  onClose?: () => void;
  onSelectThread: (threadId: string) => void;
  onArchive: (threadId: string) => Promise<void>;
  onSnooze: (threadId: string, until?: string) => Promise<void>;
  onToggleStar: (threadId: string, nextStarred: boolean) => Promise<void>;
  onToggleRead: (threadId: string, nextUnread: boolean) => Promise<void>;
  onChangeBucket: (threadId: string, bucket: PriorityBucket) => Promise<void>;
  onToggleTask: (taskId: string, completed: boolean) => Promise<void>;
  onRefreshData: () => Promise<void>;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

const TONES: { id: DraftTone; label: string; hint: string }[] = [
  { id: 'direct', label: 'Direct', hint: 'Crisp and clear' },
  { id: 'warm', label: 'Warm', hint: 'Friendly and personal' },
  { id: 'executive', label: 'Executive', hint: 'Brief and decisive' },
  { id: 'decline', label: 'Decline', hint: 'Polite no' },
];

const BUCKET_OPTIONS: { id: PriorityBucket; label: string }[] = [
  { id: 'decision', label: 'Priority' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'feed', label: 'Newsletter' },
  { id: 'paper_trail', label: 'Receipt' },
];

export const ThreadReader: React.FC<ThreadReaderProps> = ({
  threadId,
  fallbackThread,
  allThreads,
  allTasks,
  accounts,
  shabbosStatus,
  mode = 'drawer',
  autoFocusReply = false,
  focusReplyNonce,
  onClose,
  onSelectThread,
  onArchive,
  onSnooze,
  onToggleStar,
  onToggleRead,
  onChangeBucket,
  onToggleTask,
  onRefreshData,
  onToast,
}) => {
  const [detailThread, setDetailThread] = useState<EmailThread | null>(fallbackThread || null);
  const [senderHistory, setSenderHistory] = useState<EmailThread[]>([]);
  const [threadTasks, setThreadTasks] = useState<ExtractedTask[]>([]);
  const [loading, setLoading] = useState(false);

  const [aiExpanded, setAiExpanded] = useState(true);
  const [summarizing, setSummarizing] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  // Composer state
  const [replyText, setReplyText] = useState('');
  const [instruction, setInstruction] = useState('');
  const [activeTone, setActiveTone] = useState<DraftTone | null>(null);
  const [activeDraft, setActiveDraft] = useState<DraftItem | null>(null);
  const [draftingTone, setDraftingTone] = useState<DraftTone | 'custom' | null>(null);
  const [sending, setSending] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  const replyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if ((autoFocusReply || focusReplyNonce) && threadId) {
      const timer = window.setTimeout(() => {
        replyRef.current?.focus();
      }, 160);
      return () => window.clearTimeout(timer);
    }
  }, [autoFocusReply, focusReplyNonce, threadId]);

  useEffect(() => {
    if (!threadId) {
      setDetailThread(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setReplyText('');
    setInstruction('');
    setActiveDraft(null);
    setActiveTone(null);
    setSnoozeOpen(false);

    if (fallbackThread) {
      setDetailThread(fallbackThread);
    }

    api
      .getThread(threadId)
      .then((res) => {
        if (cancelled) return;
        setDetailThread(res.thread);
        setSenderHistory(res.senderHistory || []);
        setThreadTasks(res.tasks || []);
      })
      .catch(() => {
        if (!cancelled && fallbackThread) {
          setDetailThread(fallbackThread);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  const thread = useMemo(() => {
    if (!detailThread && !fallbackThread) return null;
    if (!detailThread) return fallbackThread || null;
    if (!fallbackThread || fallbackThread.id !== detailThread.id) return detailThread;
    return {
      ...detailThread,
      isStarred: fallbackThread.isStarred,
      isUnread: fallbackThread.isUnread,
      isArchived: fallbackThread.isArchived,
      bucket: fallbackThread.bucket,
      distilledAsk: detailThread.distilledAsk ?? fallbackThread.distilledAsk,
      aiSummaryBullets:
        detailThread.aiSummaryBullets?.length > 0
          ? detailThread.aiSummaryBullets
          : fallbackThread.aiSummaryBullets,
    };
  }, [detailThread, fallbackThread]);

  const mergedTasks = useMemo(() => {
    if (!thread) return [];
    const byId = new Map<string, ExtractedTask>();
    for (const t of allTasks.filter((x) => x.threadId === thread.id)) byId.set(t.id, t);
    for (const t of threadTasks) byId.set(t.id, t);
    return Array.from(byId.values());
  }, [allTasks, threadTasks, thread]);

  const crossContextThreads = useMemo(() => {
    if (!thread) return [];
    const map = new Map<string, EmailThread>();
    for (const h of senderHistory) {
      if (h.id !== thread.id) map.set(h.id, h);
    }
    for (const relId of thread.relatedThreadIds || []) {
      const found = allThreads.find((t) => t.id === relId);
      if (found && found.id !== thread.id) map.set(found.id, found);
    }
    const primaryEmails = new Set(
      thread.participants
        .map((p) => p.email.toLowerCase())
        .filter((e) => e !== thread.accountEmail.toLowerCase())
    );
    for (const other of allThreads) {
      if (other.id === thread.id) continue;
      if (other.participants.some((p) => primaryEmails.has(p.email.toLowerCase()))) {
        map.set(other.id, other);
      }
    }
    return Array.from(map.values()).slice(0, 6);
  }, [thread, senderHistory, allThreads]);

  if (!threadId || !thread) {
    return null;
  }

  const urgency = urgencyMeta(thread.urgencyScore);
  const messages = thread.messages || [];
  const isRestricted = Boolean(shabbosStatus?.enabled && shabbosStatus?.isCurrentlyRestricted);

  const primaryReplyRecipient =
    messages.find((m) => !m.isOutbound)?.fromEmail ||
    thread.participants.find((p) => p.email.toLowerCase() !== thread.accountEmail.toLowerCase())
      ?.email ||
    thread.participants[0]?.email ||
    '';

  const handleSummarize = async () => {
    if (summarizing) return;
    setSummarizing(true);
    try {
      const res = await api.summarizeThread(thread.id);
      setDetailThread((prev) =>
        prev
          ? {
              ...prev,
              distilledAsk: res.distilledAsk,
              aiSummaryBullets: res.aiSummaryBullets,
            }
          : prev
      );
      if (res.extractedTasks?.length) {
        setThreadTasks(res.extractedTasks);
      }
      await onRefreshData();
      onToast(
        `Summary refreshed (${res.generatedBy === 'claude' ? 'Claude' : 'Local AI'})`,
        'success'
      );
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Summary failed', 'warning');
    } finally {
      setSummarizing(false);
    }
  };

  const handleDraftWithTone = async (tone?: DraftTone) => {
    setDraftingTone(tone || 'custom');
    try {
      const draft = await api.draftReply({
        threadId: thread.id,
        tone: tone || activeTone || 'direct',
        instruction: instruction.trim() || undefined,
      });
      setActiveDraft(draft);
      setActiveTone(tone || draft.tone || 'direct');
      setReplyText(draft.bodyText);
      await onRefreshData();
      onToast(`Drafted ${tone || 'custom'} reply and queued in Drafts`, 'success');
      setTimeout(() => replyRef.current?.focus(), 20);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Draft generation failed', 'warning');
    } finally {
      setDraftingTone(null);
    }
  };

  const handleSaveDraftToDock = async () => {
    if (!replyText.trim()) return;
    setSending(true);
    try {
      if (activeDraft) {
        await api.updateDraft(activeDraft.id, {
          bodyText: replyText,
          status: 'pending_approval',
        });
      } else {
        const created = await api.createDraft({
          threadId: thread.id,
          accountId: thread.accountId,
          toEmails: primaryReplyRecipient ? [primaryReplyRecipient] : [],
          subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
          bodyText: replyText,
          tone: activeTone || undefined,
          status: 'pending_approval',
          createdBy: 'user',
        });
        setActiveDraft(created);
      }
      await onRefreshData();
      onToast('Saved to Drafts for review', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save draft', 'warning');
    } finally {
      setSending(false);
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || sending) return;
    setSending(true);
    try {
      let draftId = activeDraft?.id;
      if (draftId) {
        await api.updateDraft(draftId, { bodyText: replyText });
      } else {
        const created = await api.createDraft({
          threadId: thread.id,
          accountId: thread.accountId,
          toEmails: primaryReplyRecipient ? [primaryReplyRecipient] : [],
          subject: thread.subject.startsWith('Re:') ? thread.subject : `Re: ${thread.subject}`,
          bodyText: replyText,
          tone: activeTone || undefined,
          status: 'draft',
          createdBy: 'user',
        });
        draftId = created.id;
      }

      const res = await api.sendDraft(draftId);
      setReplyText('');
      setInstruction('');
      setActiveDraft(null);
      await onRefreshData();
      const updated = await api.getThread(thread.id);
      setDetailThread(updated.thread);

      if (res.heldByShabbos || res.status === 'held_shabbos') {
        onToast('Held by Shabbos Guard in Drafts until Havdalah', 'warning');
      } else {
        onToast(`Reply sent from ${thread.accountLabel}`, 'success');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to send reply', 'warning');
    } finally {
      setSending(false);
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    try {
      const created = await api.createTask({
        threadId: thread.id,
        accountId: thread.accountId,
        title: newTaskTitle.trim(),
        priority: 'medium',
      });
      setThreadTasks((prev) => [...prev, created]);
      setNewTaskTitle('');
      setAddingTask(false);
      await onRefreshData();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not add task', 'warning');
    }
  };

  const triggerSnoozeOption = async (hoursFromNow: number, label: string) => {
    setSnoozeOpen(false);
    const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
    await onSnooze(thread.id, d.toISOString());
    onToast(`Snoozed until ${label}`);
  };

  const account = accounts.find((a) => a.id === thread.accountId);

  return (
    <div className="h-full flex flex-col overflow-hidden bg-white">
      {/* Top Toolbar */}
      <div className="px-4 sm:px-5 py-3 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0 bg-white">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold bg-gray-100 text-gray-800 border border-gray-200 flex-shrink-0">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: thread.accountColor }}
            />
            {thread.accountLabel}
          </span>
          <span className="text-[12px] text-gray-500 truncate hidden md:inline">
            {account?.email || thread.accountEmail}
          </span>

          <select
            value={thread.bucket}
            onChange={(e) => void onChangeBucket(thread.id, e.target.value as PriorityBucket)}
            className="px-2 py-1 rounded-lg border border-gray-200 bg-white text-[12px] font-medium text-gray-700 focus:outline-none focus:border-blue-500 cursor-pointer flex-shrink-0"
            title="Change folder bucket"
          >
            {BUCKET_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0 relative">
          <button
            type="button"
            onClick={() => void onArchive(thread.id)}
            className="px-2 sm:px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-[12px] font-medium text-gray-700 flex items-center gap-1.5 transition-colors whitespace-nowrap"
            title="Archive thread"
          >
            <Archive className="w-3.5 h-3.5 text-gray-600" />
            <span className="hidden sm:inline">Archive</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSnoozeOpen((v) => !v)}
              className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
              title="Snooze thread"
            >
              <Clock className="w-4 h-4" />
            </button>
            {snoozeOpen && (
              <div
                className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-gray-200 p-1.5 z-30 space-y-0.5"
                style={{ boxShadow: 'var(--shadow-modal)' }}
              >
                <button
                  type="button"
                  onClick={() => void triggerSnoozeOption(4, 'Later Today')}
                  className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] text-gray-800 hover:bg-gray-100"
                >
                  Later today (+4h)
                </button>
                <button
                  type="button"
                  onClick={() => void triggerSnoozeOption(20, 'Tomorrow 9:00 AM')}
                  className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] text-gray-800 hover:bg-gray-100"
                >
                  Tomorrow morning
                </button>
                <button
                  type="button"
                  onClick={() => void triggerSnoozeOption(72, 'Next Week')}
                  className="w-full text-left px-3 py-2 rounded-lg text-[12.5px] text-gray-800 hover:bg-gray-100"
                >
                  Next week (+3d)
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => void onToggleStar(thread.id, !thread.isStarred)}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            title={thread.isStarred ? 'Unstar' : 'Star'}
          >
            <Star
              className={cn(
                'w-4 h-4',
                thread.isStarred ? 'text-amber-500 fill-amber-400' : 'text-gray-500'
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => void onToggleRead(thread.id, !thread.isUnread)}
            className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
            title={thread.isUnread ? 'Mark as read' : 'Mark as unread'}
          >
            {thread.isUnread ? <MailOpen className="w-4 h-4" /> : <Mail className="w-4 h-4" />}
          </button>

          {mode === 'drawer' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="ml-1 p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
              title="Close reader (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Reading Area */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {/* Subject & Clear Metadata */}
        <div className="space-y-2.5">
          <h2 className="text-[22px] font-bold tracking-tight text-gray-900 leading-snug">
            {thread.subject}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-[12px]">
            <span
              className={cn(
                'font-medium px-2.5 py-0.5 rounded-full border',
                urgency.bg,
                urgency.border,
                urgency.color
              )}
            >
              {urgency.label}
            </span>
            {thread.deadlineLabel && (
              <span className="font-medium px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700">
                {/^due\b/i.test(thread.deadlineLabel)
                  ? thread.deadlineLabel
                  : `Due ${thread.deadlineLabel}`}
              </span>
            )}
            {thread.receiptInfo && (
              <span className="inline-flex items-center gap-1 font-mono-num font-medium px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                <Receipt className="w-3 h-3" />
                {thread.receiptInfo.vendor}:{' '}
                {formatCurrency(thread.receiptInfo.amount, thread.receiptInfo.currency)}
              </span>
            )}
            <span className="text-gray-500">
              {thread.messageCount} {thread.messageCount === 1 ? 'message' : 'messages'}
            </span>
          </div>
        </div>

        {/* Clean Soft-Tinted AI Brief & Tasks Box */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/90 overflow-hidden">
          <div className="px-4 py-2.5 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setAiExpanded((v) => !v)}
              className="flex items-center gap-2 text-left flex-1 min-w-0"
            >
              <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="text-[13px] font-semibold text-gray-900">AI Summary & Tasks</span>
              {aiExpanded ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>
            <button
              type="button"
              disabled={summarizing}
              onClick={() => void handleSummarize()}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-medium text-gray-600 hover:text-gray-900 hover:bg-white border border-transparent hover:border-gray-200 transition-colors"
              title="Refresh summary with Claude"
            >
              <RefreshCw className={cn('w-3 h-3', summarizing && 'animate-spin text-indigo-600')} />
              Refresh
            </button>
          </div>

          {aiExpanded && (
            <div className="px-4 pb-4 pt-2.5 space-y-3 border-t border-slate-200/80 bg-white">
              {thread.distilledAsk && (
                <div className="px-3.5 py-2.5 rounded-xl bg-amber-50/70 border border-amber-200/80">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-amber-800 block mb-0.5">
                    What they need
                  </span>
                  <div className="text-[14px] font-medium text-gray-900 leading-snug">
                    {thread.distilledAsk}
                  </div>
                </div>
              )}

              {thread.aiSummaryBullets && thread.aiSummaryBullets.length > 0 && (
                <ul className="space-y-1.5 text-[13.5px] text-gray-700">
                  {thread.aiSummaryBullets.map((b, i) => (
                    <li key={i} className="flex items-start gap-2.5 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Checkable Extracted Tasks */}
              <div className="pt-2.5 border-t border-gray-100 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                    Action Items ({mergedTasks.length})
                  </span>
                  <button
                    type="button"
                    onClick={() => setAddingTask((v) => !v)}
                    className="text-[12px] font-medium text-blue-600 hover:text-blue-700 inline-flex items-center gap-0.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add task
                  </button>
                </div>

                {mergedTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => void onToggleTask(task.id, !task.completed)}
                    className="w-full flex items-center gap-2.5 text-left py-1.5 px-2 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    {task.completed ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Square className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    )}
                    <span
                      className={cn(
                        'flex-1 text-[13px] text-gray-800',
                        task.completed && 'line-through text-gray-400'
                      )}
                    >
                      {task.title}
                    </span>
                    {task.dueLabel && (
                      <span className="font-mono-num text-[11px] text-gray-500">
                        {task.dueLabel}
                      </span>
                    )}
                  </button>
                ))}

                {addingTask && (
                  <form onSubmit={(e) => void handleAddTask(e)} className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      placeholder="New action item..."
                      autoFocus
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      Save
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Cross-Account Sender Context */}
        {crossContextThreads.length > 0 && (
          <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
              Related across your accounts ({crossContextThreads.length})
            </div>
            <div className="flex flex-wrap gap-1.5">
              {crossContextThreads.map((other) => (
                <button
                  key={other.id}
                  type="button"
                  onClick={() => onSelectThread(other.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 text-[12px] text-gray-800 transition-colors"
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: other.accountColor }}
                  />
                  <span className="text-[11px] font-semibold text-gray-600">
                    {other.accountLabel}
                  </span>
                  <span className="truncate max-w-[200px]">{other.subject}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages Conversation (15px crisp reading typography) */}
        <div className="space-y-3.5">
          {loading && messages.length === 0 ? (
            <div className="py-10 flex items-center justify-center gap-2 text-[13.5px] text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
              Loading full conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="p-5 rounded-2xl border border-gray-200 bg-gray-50 text-[15px] leading-relaxed text-gray-800">
              {thread.snippet}
            </div>
          ) : (
            messages.map((msg) => (
              <article
                key={msg.id}
                className={cn(
                  'rounded-2xl border p-5 space-y-3',
                  msg.isOutbound
                    ? 'bg-blue-50/40 border-blue-200/70'
                    : 'bg-white border-gray-200 shadow-sm'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-semibold flex-shrink-0 border',
                        msg.isOutbound
                          ? 'bg-blue-100 border-blue-200 text-blue-800'
                          : 'bg-gray-100 border-gray-200 text-gray-700'
                      )}
                    >
                      {getInitials(msg.fromName)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-semibold text-gray-900 truncate">
                          {msg.fromName}
                        </span>
                        {msg.isOutbound && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[12px] text-gray-500 truncate">
                        {msg.fromEmail} to {msg.toEmails.join(', ')}
                      </div>
                    </div>
                  </div>
                  <span
                    className="font-mono-num text-[11.5px] text-gray-500 flex-shrink-0"
                    title={formatClockTime(msg.sentAt)}
                  >
                    {formatRelativeTime(msg.sentAt)}
                  </span>
                </div>

                <div className="text-[15px] leading-[1.68] text-gray-800 whitespace-pre-wrap break-words">
                  {msg.bodyText || msg.snippet}
                </div>

                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                    {msg.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-200 text-[12px] text-gray-700"
                      >
                        <Paperclip className="w-3.5 h-3.5 text-blue-600" />
                        <span className="font-medium text-gray-900">{att.filename}</span>
                        <span className="font-mono-num text-[11px] text-gray-500">
                          {formatBytes(att.sizeBytes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))
          )}
        </div>
      </div>

      {/* Embedded AI Multi-Tone Reply Composer */}
      <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-t border-gray-200 bg-gray-50 space-y-2.5 flex-shrink-0">
        {/* Tone Chips + Quick Instruction */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12px] font-semibold text-gray-600 flex items-center gap-1 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Draft with Claude:
          </span>
          {TONES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={draftingTone !== null}
              onClick={() => void handleDraftWithTone(t.id)}
              title={t.hint}
              className={cn(
                'px-2.5 py-1 rounded-full text-[12px] font-medium border transition-colors flex items-center gap-1',
                activeTone === t.id
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100'
              )}
            >
              {draftingTone === t.id && <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />}
              {t.label}
            </button>
          ))}
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void handleDraftWithTone();
              }
            }}
            placeholder="Optional note (e.g. 'Yes for Thu 2pm')..."
            className="flex-1 min-w-[160px] px-3 py-1 rounded-lg border border-gray-200 bg-white text-[12.5px] text-gray-900 focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
          />
        </div>

        {/* Reply Editor */}
        <textarea
          ref={replyRef}
          rows={replyText ? 4 : 3}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder={`Write a reply to ${primaryReplyRecipient || 'sender'}, or click a Claude tone button above...`}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-300 bg-white text-[14.5px] leading-relaxed text-gray-900 resize-none focus:outline-none focus:border-blue-500 placeholder:text-gray-400"
        />

        {/* Send Bar */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-[12px] text-gray-500 min-w-0 flex-1">
            {isRestricted ? (
              <span className="inline-flex items-center gap-1.5 text-amber-700 font-medium truncate">
                <Shield className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span className="truncate">Shabbos Guard active: sends hold until Havdalah</span>
              </span>
            ) : (
              <span className="truncate" title={`Replying as ${thread.accountEmail}`}>
                From {thread.accountEmail}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 w-full sm:w-auto justify-end">
            <button
              type="button"
              disabled={!replyText.trim() || sending}
              onClick={() => void handleSaveDraftToDock()}
              className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-100 text-[12.5px] font-medium text-gray-700 disabled:opacity-45 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              Save to Drafts
            </button>
            <button
              type="button"
              disabled={!replyText.trim() || sending}
              onClick={() => void handleSendReply()}
              className="px-4 py-2 rounded-lg text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-45 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 shadow-sm transition-colors"
            >
              {sending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
              ) : (
                <Send className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {isRestricted ? 'Hold Until Havdalah' : 'Send Reply'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
