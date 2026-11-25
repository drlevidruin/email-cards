import React, { useEffect, useState } from 'react';
import { X, Send, Sparkles, Shield, Loader2, CheckCircle2 } from 'lucide-react';
import type { GmailAccount, ShabbosStatus } from '../../lib/types';
import { api } from '../../lib/api';

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  accounts: GmailAccount[];
  defaultAccountId?: string;
  shabbosStatus: ShabbosStatus | null;
  onSentOrSaved: () => Promise<void>;
  onToast: (message: string, tone?: 'default' | 'success' | 'warning') => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  open,
  onClose,
  accounts,
  defaultAccountId,
  shabbosStatus,
  onSentOrSaved,
  onToast,
}) => {
  const [accountId, setAccountId] = useState('');
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [polishing, setPolishing] = useState(false);
  const [sending, setSending] = useState(false);
  const [overrideShabbos, setOverrideShabbos] = useState(false);

  useEffect(() => {
    if (open) {
      const preferred =
        accounts.find((a) => a.id === defaultAccountId)?.id || accounts[0]?.id || '';
      setAccountId(preferred);
      setOverrideShabbos(false);
    }
  }, [open, accounts, defaultAccountId]);

  if (!open) return null;

  const selectedAccount = accounts.find((a) => a.id === accountId) || accounts[0];
  const isRestricted = Boolean(shabbosStatus?.enabled && shabbosStatus?.isCurrentlyRestricted);

  const handleAiAssist = async () => {
    const prompt = aiPrompt.trim() || subject.trim() || body.trim();
    if (!prompt || polishing) return;
    setPolishing(true);
    try {
      const res = await api.agentChat({
        message: body.trim()
          ? `Polish this email body to be crisp, warm, and clear (return only the email body text): "${body}" with goal: "${aiPrompt || 'Make concise and executive'}"`
          : `Write a concise, clear professional email about: "${prompt}". Subject: "${subject || 'Quick note'}". Return only the email body.`,
      });
      if (res.content) {
        setBody(res.content);
        setAiPrompt('');
      }
    } catch {
      if (!body.trim()) {
        setBody(
          `Hi,\n\nQuick note regarding ${subject || prompt}: I wanted to follow up and align on next steps. Let me know what timing works best on your end.\n\nBest,\n${selectedAccount?.displayName || 'Alex'}`
        );
      }
    } finally {
      setPolishing(false);
    }
  };

  const parseEmails = (raw: string) =>
    raw
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.includes('@'));

  const resetAndClose = () => {
    setTo('');
    setCc('');
    setSubject('');
    setBody('');
    setAiPrompt('');
    onClose();
  };

  const handleSaveToDock = async () => {
    if (!selectedAccount) return;
    setSending(true);
    try {
      await api.createDraft({
        accountId: selectedAccount.id,
        toEmails: parseEmails(to),
        ccEmails: parseEmails(cc),
        subject: subject.trim() || '(No Subject)',
        bodyText: body,
        status: 'pending_approval',
        createdBy: 'user',
      });
      await onSentOrSaved();
      onToast('Saved to Drafts', 'success');
      resetAndClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Could not save draft', 'warning');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;
    const recipients = parseEmails(to);
    if (recipients.length === 0) {
      onToast('Add at least one recipient email address', 'warning');
      return;
    }
    setSending(true);
    try {
      const draft = await api.createDraft({
        accountId: selectedAccount.id,
        toEmails: recipients,
        ccEmails: parseEmails(cc),
        subject: subject.trim() || '(No Subject)',
        bodyText: body,
        status: 'draft',
        createdBy: 'user',
      });
      const res = await api.sendDraft(draft.id, { overrideShabbos });
      await onSentOrSaved();
      if (res.heldByShabbos || res.status === 'held_shabbos') {
        onToast('Held by Shabbos Guard in Drafts until Havdalah', 'warning');
      } else {
        onToast(`Sent from ${selectedAccount.label}`, 'success');
      }
      resetAndClose();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Send failed', 'warning');
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/25 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <form
        onSubmit={(e) => void handleSend(e)}
        className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto rounded-2xl bg-white border border-gray-200 flex flex-col"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: selectedAccount?.color || '#2563EB' }}
            />
            <span className="text-[15px] font-bold text-gray-900">New Email</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-900 hover:bg-gray-100"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Fields */}
        <div className="divide-y divide-gray-200">
          <div className="px-5 py-2.5 flex items-center gap-3">
            <span className="text-[12.5px] font-medium text-gray-500 w-14 flex-shrink-0">From</span>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className="flex-1 bg-white text-[13.5px] font-medium text-gray-900 focus:outline-none"
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.label} ({acc.email})
                </option>
              ))}
            </select>
          </div>

          <div className="px-5 py-2.5 flex items-center gap-3">
            <span className="text-[12.5px] font-medium text-gray-500 w-14 flex-shrink-0">To</span>
            <input
              type="text"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="flex-1 bg-transparent text-[13.5px] text-gray-900 focus:outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="px-5 py-2.5 flex items-center gap-3">
            <span className="text-[12.5px] font-medium text-gray-500 w-14 flex-shrink-0">CC</span>
            <input
              type="text"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="Optional CC addresses"
              className="flex-1 bg-transparent text-[13.5px] text-gray-900 focus:outline-none placeholder:text-gray-400"
            />
          </div>

          <div className="px-5 py-2.5 flex items-center gap-3">
            <span className="text-[12.5px] font-medium text-gray-500 w-14 flex-shrink-0">
              Subject
            </span>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Clear, concise subject"
              className="flex-1 bg-transparent text-[13.5px] font-semibold text-gray-900 focus:outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Body */}
        <div className="p-5 space-y-3">
          <textarea
            rows={8}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Write your email, or ask Claude below to draft or polish..."
            className="w-full bg-transparent text-[15px] leading-relaxed text-gray-800 resize-none focus:outline-none placeholder:text-gray-400"
          />

          {/* AI Draft / Polish Bar */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 border border-gray-200">
            <Sparkles className="w-4 h-4 text-indigo-600 flex-shrink-0" />
            <input
              type="text"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void handleAiAssist();
                }
              }}
              placeholder="Ask Claude to draft or polish (e.g. 'Invite Jordan to coffee Thursday 10am')"
              className="flex-1 bg-transparent text-[12.5px] text-gray-900 focus:outline-none placeholder:text-gray-400"
            />
            <button
              type="button"
              disabled={polishing}
              onClick={() => void handleAiAssist()}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 flex items-center gap-1 transition-colors"
            >
              {polishing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
              {body.trim() ? 'Polish' : 'Draft'}
            </button>
          </div>

          {isRestricted && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3 text-[12.5px]">
              <div className="flex items-center gap-2 text-amber-800">
                <Shield className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  Shabbos Guard is active: sending will hold in Drafts until after Havdalah.
                </span>
              </div>
              <label className="flex items-center gap-1.5 text-[12px] font-medium text-amber-900 cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={overrideShabbos}
                  onChange={(e) => setOverrideShabbos(e.target.checked)}
                />
                Override
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSaveToDock()}
            className="px-3.5 py-2 rounded-xl border border-gray-300 bg-white hover:bg-gray-100 text-[12.5px] font-medium text-gray-700 flex items-center gap-1.5 transition-colors"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-gray-500" />
            Save to Drafts
          </button>

          <button
            type="submit"
            disabled={sending}
            className="px-4 py-2 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5 disabled:opacity-50 transition-colors"
          >
            {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            {isRestricted && !overrideShabbos ? 'Hold Until Havdalah' : 'Send Email'}
          </button>
        </div>
      </form>
    </div>
  );
};
