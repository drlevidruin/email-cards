import React, { useState } from 'react';
import {
  X,
  Send,
  Trash2,
  Shield,
  Clock,
  Sparkles,
  CheckCircle2,
  Loader2,
  ExternalLink,
  PenSquare,
} from 'lucide-react';
import type { DraftItem, GmailAccount, ShabbosStatus } from '../../lib/types';
import { api } from '../../lib/api';
import { cn, formatClockTime, formatRelativeTime } from '../../lib/utils';

interface ApprovalDockModalProps {
  open: boolean;
  mode?: 'page' | 'modal';
  onClose?: () => void;
  drafts: DraftItem[];
  accounts: GmailAccount[];
  selectedAccountId?: string;
  shabbosStatus: ShabbosStatus | null;
  onRefresh: () => Promise<void>;
  onOpenThread: (threadId: string) => void;
  onOpenCompose?: () => void;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

export const ApprovalDockModal: React.FC<ApprovalDockModalProps> = ({
  open,
  mode = 'page',
  onClose,
  drafts,
  accounts,
  selectedAccountId = 'all',
  shabbosStatus,
  onRefresh,
  onOpenThread,
  onOpenCompose,
  onToast,
}) => {
  const [editingBodies, setEditingBodies] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'held'>('all');

  if (!open) return null;

  const activeDrafts = drafts.filter(
    (d) =>
      d.status !== 'sent' &&
      (selectedAccountId === 'all' || d.accountId === selectedAccountId)
  );
  const filteredDrafts = activeDrafts.filter((d) => {
    if (filter === 'pending') return d.status === 'pending_approval' || d.status === 'draft';
    if (filter === 'held') return d.status === 'held_shabbos';
    return true;
  });

  const getAccount = (accountId: string) => accounts.find((a) => a.id === accountId);

  const handleApproveAndSend = async (draft: DraftItem, overrideShabbos = false) => {
    setBusyId(draft.id);
    try {
      const updatedBody = editingBodies[draft.id];
      if (updatedBody !== undefined && updatedBody !== draft.bodyText) {
        await api.updateDraft(draft.id, { bodyText: updatedBody });
      }
      const res = await api.sendDraft(draft.id, { overrideShabbos });
      await onRefresh();
      if (res.heldByShabbos || res.status === 'held_shabbos') {
        onToast('Held by Shabbos Guard until Havdalah', 'warning');
      } else {
        onToast(`Sent: ${draft.subject}`, 'success');
      }
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Failed to send draft', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  const handleScheduleTomorrow = async (draft: DraftItem) => {
    setBusyId(draft.id);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      await api.updateDraft(draft.id, {
        bodyText: editingBodies[draft.id] ?? draft.bodyText,
        scheduledFor: tomorrow.toISOString(),
        status: 'pending_approval',
      });
      await onRefresh();
      onToast('Scheduled for tomorrow at 9:00 AM', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not schedule draft', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  const handleDiscard = async (draft: DraftItem) => {
    setBusyId(draft.id);
    try {
      await api.deleteDraft(draft.id);
      await onRefresh();
      onToast('Draft discarded');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not discard draft', 'warning');
    } finally {
      setBusyId(null);
    }
  };

  const innerContent = (
    <div
      className={cn(
        mode === 'page'
          ? 'max-w-[780px] mx-auto px-4 sm:px-6 py-5 sm:py-8 space-y-5 sm:space-y-6'
          : 'flex-1 flex flex-col overflow-hidden'
      )}
    >
      {/* Header */}
      <div
        className={cn(
          'flex items-start justify-between gap-4',
          mode === 'modal' && 'px-6 py-4 border-b border-gray-200'
        )}
      >
        <div>
          <h1 className="text-[24px] font-bold tracking-tight text-gray-900">
            Drafts & Approval Dock
          </h1>
          <p className="text-[14px] text-gray-600 mt-1">
            Review, edit, and approve Claude replies and Shabbos-held messages. Nothing sends without your approval.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {mode === 'page' && onOpenCompose && (
            <button
              type="button"
              onClick={onOpenCompose}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <PenSquare className="w-3.5 h-3.5" />
              New Draft
            </button>
          )}
          {mode === 'modal' && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-3',
          mode === 'modal' && 'px-6 py-3 border-b border-gray-200 bg-gray-50'
        )}
      >
        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-white border border-gray-200 shadow-sm">
          {(
            [
              { id: 'all', label: `All (${activeDrafts.length})` },
              {
                id: 'pending',
                label: `Ready to Approve (${activeDrafts.filter((d) => d.status !== 'held_shabbos').length})`,
              },
              {
                id: 'held',
                label: `Shabbos Held (${activeDrafts.filter((d) => d.status === 'held_shabbos').length})`,
              },
            ] as const
          ).map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={() => setFilter(chip.id)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[12.5px] font-medium transition-colors',
                filter === chip.id
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {shabbosStatus?.enabled && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium border',
              shabbosStatus.isCurrentlyRestricted
                ? 'bg-amber-50 text-amber-800 border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            )}
          >
            <Shield className="w-3.5 h-3.5" />
            {shabbosStatus.isCurrentlyRestricted
              ? 'Shabbos Guard Holding Outbound'
              : 'Shabbos Guard Active'}
          </span>
        )}
      </div>

      {/* Draft Cards */}
      <div className={cn(mode === 'modal' ? 'flex-1 overflow-y-auto p-6 space-y-4' : 'space-y-4')}>
        {filteredDrafts.length === 0 ? (
          <div className="py-16 px-6 rounded-2xl bg-white border border-gray-200 text-center space-y-2.5 shadow-sm">
            <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div className="text-[16px] font-semibold text-gray-900">All drafts are clear</div>
            <p className="text-[13.5px] text-gray-500 max-w-[360px] mx-auto leading-relaxed">
              Use Quick Reply chips on any card or Claude tone buttons inside a thread to queue ready-to-approve drafts here.
            </p>
          </div>
        ) : (
          filteredDrafts.map((draft) => {
            const acc = getAccount(draft.accountId);
            const bodyVal = editingBodies[draft.id] ?? draft.bodyText;
            const isHeld = draft.status === 'held_shabbos';
            return (
              <div
                key={draft.id}
                className={cn(
                  'rounded-2xl bg-white border p-5 space-y-3.5 shadow-sm',
                  isHeld ? 'border-amber-300 ring-1 ring-amber-100' : 'border-gray-200'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {acc && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-gray-100 text-gray-800 border border-gray-200">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: acc.color }}
                          />
                          {acc.label}
                        </span>
                      )}
                      {draft.createdBy === 'agent' && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                          <Sparkles className="w-3 h-3" />
                          Claude {draft.tone ? `(${draft.tone})` : 'Draft'}
                        </span>
                      )}
                      {isHeld && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11.5px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                          <Shield className="w-3 h-3" />
                          Held for Shabbos
                        </span>
                      )}
                    </div>

                    <div className="text-[16px] font-semibold text-gray-900 leading-snug">
                      {draft.subject}
                    </div>
                    <div className="text-[12.5px] text-gray-500">
                      To: {draft.toEmails.join(', ') || '(No recipient)'} | Created{' '}
                      {formatRelativeTime(draft.createdAt)}
                    </div>
                  </div>

                  {draft.threadId && (
                    <button
                      type="button"
                      onClick={() => {
                        onOpenThread(draft.threadId!);
                        if (mode === 'modal' && onClose) onClose();
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-[12px] font-medium text-gray-600 inline-flex items-center gap-1 flex-shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Thread
                    </button>
                  )}
                </div>

                {draft.scheduledFor && (
                  <div className="text-[12px] font-mono-num flex items-center gap-1.5 text-amber-800 bg-amber-50 border border-amber-200 px-3 py-2 rounded-xl">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Scheduled release: {formatClockTime(draft.scheduledFor)}
                  </div>
                )}

                <textarea
                  rows={5}
                  value={bodyVal}
                  onChange={(e) =>
                    setEditingBodies((prev) => ({ ...prev, [draft.id]: e.target.value }))
                  }
                  className="w-full p-3.5 rounded-xl border border-gray-200 bg-gray-50/70 focus:bg-white text-[14.5px] leading-relaxed text-gray-900 resize-y focus:outline-none focus:border-blue-500"
                />

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    disabled={busyId === draft.id}
                    onClick={() => void handleDiscard(draft)}
                    className="px-3 py-1.5 rounded-lg text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 inline-flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Discard
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={busyId === draft.id}
                      onClick={() => void handleScheduleTomorrow(draft)}
                      className="px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-[12.5px] font-medium text-gray-700 inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      Tomorrow 9am
                    </button>
                    <button
                      type="button"
                      disabled={busyId === draft.id}
                      onClick={() => void handleApproveAndSend(draft, isHeld)}
                      className="px-4 py-2 rounded-xl text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 shadow-sm disabled:opacity-50 transition-colors"
                    >
                      {busyId === draft.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      {isHeld ? 'Send Now (Override)' : 'Approve & Send'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (mode === 'page') {
    return <div className="h-full overflow-y-auto">{innerContent}</div>;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-900/25 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[580px] h-full bg-white border-l border-gray-200 flex flex-col"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {innerContent}
      </div>
    </div>
  );
};
