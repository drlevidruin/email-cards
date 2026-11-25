import React, { useEffect, useRef, useState } from 'react';
import {
  Sparkles,
  X,
  Send,
  Loader2,
  CheckCircle2,
  RotateCcw,
  FileText,
  Wand2,
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  Settings,
  Layers,
  Filter,
  Mail,
} from 'lucide-react';
import type {
  AgentChatMessage,
  AgentRule,
  ActionProposal,
  AppSettings,
  EmailThread,
} from '../../lib/types';
import { cn, formatRelativeTime } from '../../lib/utils';

interface AgentRailProps {
  open: boolean;
  initialTab?: 'chat' | 'rules';
  focusedThread?: EmailThread | null;
  onClearFocusedThread?: () => void;
  onClose: () => void;
  messages: AgentChatMessage[];
  isThinking: boolean;
  onSendMessage: (text: string) => Promise<void>;
  onExecuteProposal: (proposal: ActionProposal) => Promise<void>;
  onUndoProposal: (proposal: ActionProposal) => Promise<void>;
  onOpenThread: (threadId: string) => void;
  onOpenDrafts: () => void;
  onOpenSettings: (tab?: 'claude' | 'shabbos' | 'demo') => void;
  rules: AgentRule[];
  onCreateRule: (name: string, naturalLanguage: string) => Promise<void>;
  onToggleRule: (id: string, enabled: boolean) => Promise<void>;
  onDeleteRule: (id: string) => Promise<void>;
  settings: AppSettings | null;
}

const QUICK_PROMPTS = [
  'Summarize my top priorities today',
  'Find all open asks and deadlines',
  'Archive old newsletters (preview)',
  'Summarize receipts and total spend',
];

export const AgentRail: React.FC<AgentRailProps> = ({
  open,
  initialTab = 'chat',
  focusedThread,
  onClearFocusedThread,
  onClose,
  messages,
  isThinking,
  onSendMessage,
  onExecuteProposal,
  onUndoProposal,
  onOpenThread,
  onOpenDrafts,
  onOpenSettings,
  rules,
  onCreateRule,
  onToggleRule,
  onDeleteRule,
  settings,
}) => {
  const [tab, setTab] = useState<'chat' | 'rules'>(initialTab);
  const [input, setInput] = useState('');
  const [busyProposalId, setBusyProposalId] = useState<string | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [rulePrompt, setRulePrompt] = useState('');
  const [creatingRule, setCreatingRule] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isThinking, tab]);

  if (!open) return null;

  const claudeActive = Boolean(settings?.anthropicApiKeyConfigured);
  const modelShort = (settings?.claudeModel || 'claude-sonnet-4-20250514')
    .replace('claude-', 'Claude ')
    .replace(/-\d{8}$/, '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isThinking) return;
    setInput('');
    await onSendMessage(trimmed);
  };

  const handleProposalAction = async (proposal: ActionProposal, kind: 'execute' | 'undo') => {
    setBusyProposalId(proposal.id);
    try {
      if (kind === 'execute') {
        await onExecuteProposal(proposal);
      } else {
        await onUndoProposal(proposal);
      }
    } finally {
      setBusyProposalId(null);
    }
  };

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ruleName.trim() || !rulePrompt.trim() || creatingRule) return;
    setCreatingRule(true);
    try {
      await onCreateRule(ruleName.trim(), rulePrompt.trim());
      setRuleName('');
      setRulePrompt('');
    } finally {
      setCreatingRule(false);
    }
  };

  return (
    <aside className="fixed inset-0 sm:static sm:inset-auto w-full sm:w-[392px] flex-shrink-0 h-full bg-white sm:border-l border-gray-200 flex flex-col z-40 sm:z-20 shadow-lg">
      {/* Rail Header */}
      <div className="px-4 py-3.5 border-b border-gray-200 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="min-w-0">
            <div className="text-[14px] font-semibold text-gray-900 truncate">Claude Assistant</div>
            <button
              type="button"
              onClick={() => onOpenSettings('claude')}
              className="flex items-center gap-1.5 text-[11.5px] hover:underline truncate text-gray-500"
            >
              <span
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: claudeActive ? '#059669' : '#4F46E5' }}
              />
              <span className="truncate">
                {claudeActive ? modelShort : 'Local Mode (Add Claude API key)'}
              </span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onOpenSettings('claude')}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Configure Claude API Key"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors"
            title="Close Assistant (Cmd+J)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={cn(
            'flex-1 py-1.5 px-2.5 rounded-lg text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors',
            tab === 'chat'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
          Chat
        </button>
        <button
          type="button"
          onClick={() => setTab('rules')}
          className={cn(
            'flex-1 py-1.5 px-2.5 rounded-lg text-[12.5px] font-semibold flex items-center justify-center gap-1.5 transition-colors',
            tab === 'rules'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'text-gray-600 hover:text-gray-900'
          )}
        >
          <Wand2 className="w-3.5 h-3.5 text-blue-600" />
          Rules
          <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 leading-none">
            {rules.length}
          </span>
        </button>
      </div>

      {/* Focused Thread Banner */}
      {tab === 'chat' && focusedThread && (
        <div className="px-3.5 py-2.5 border-b border-blue-200 bg-blue-50/70 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Mail className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-blue-700">
                Focused Card
              </div>
              <div className="text-[12.5px] font-medium text-gray-900 truncate">
                {focusedThread.subject}
              </div>
            </div>
          </div>
          {onClearFocusedThread && (
            <button
              type="button"
              onClick={onClearFocusedThread}
              className="p-1 rounded-md text-blue-700 hover:bg-blue-100 flex-shrink-0"
              title="Clear thread focus"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {tab === 'chat' ? (
        <>
          {/* Chat Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 bg-[#FAF9F6]">
            {messages.length === 0 && (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-1.5">
                  <div className="text-[14px] font-semibold text-gray-900">
                    Ask across all your Gmail accounts
                  </div>
                  <p className="text-[13px] text-gray-600 leading-relaxed">
                    Summarize urgent asks, draft thoughtful replies to your Drafts queue, or preview bulk inbox cleanups with instant Undo.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-1">
                    Suggested Prompts
                  </div>
                  {(focusedThread
                    ? [
                        `Summarize this thread and tell me what they need`,
                        `Draft a crisp direct reply to this email`,
                        ...QUICK_PROMPTS.slice(0, 2),
                      ]
                    : QUICK_PROMPTS
                  ).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void onSendMessage(prompt)}
                      className="w-full text-left px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-[13px] text-gray-700 hover:text-gray-900 hover:border-blue-300 hover:bg-blue-50/30 transition-colors shadow-sm"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex flex-col gap-2',
                  msg.role === 'user' ? 'items-end' : 'items-start'
                )}
              >
                <div
                  className={cn(
                    'rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed max-w-[94%] whitespace-pre-wrap',
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-800 shadow-sm'
                  )}
                >
                  {msg.content}
                </div>

                {/* Tool Trace Chips */}
                {msg.toolTrace && msg.toolTrace.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[94%]">
                    {msg.toolTrace.map((trace, i) => (
                      <span
                        key={`${trace.tool}-${i}`}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono-num bg-gray-100 border border-gray-200 text-gray-600"
                      >
                        <Layers className="w-3 h-3 text-indigo-600" />
                        {trace.summary}
                      </span>
                    ))}
                  </div>
                )}

                {/* Clickable Thread Citations */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-w-[96%]">
                    {msg.citations.map((cite) => (
                      <button
                        key={cite.threadId}
                        type="button"
                        onClick={() => onOpenThread(cite.threadId)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] bg-white border border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-800 text-left max-w-full shadow-sm transition-colors"
                      >
                        <ExternalLink className="w-3 h-3 text-blue-600 flex-shrink-0" />
                        <span className="truncate max-w-[185px] font-medium">{cite.subject}</span>
                        <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 flex-shrink-0 leading-none">
                          {cite.accountLabel}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Dry-Run Action Proposal Card */}
                {msg.proposal && (
                  <div
                    className={cn(
                      'w-full rounded-2xl p-3.5 border space-y-2.5 shadow-sm',
                      msg.proposal.status === 'executed'
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : 'bg-white border-indigo-200'
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'text-[10.5px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full',
                            msg.proposal.status === 'executed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : msg.proposal.status === 'undone'
                                ? 'bg-gray-100 text-gray-600'
                                : 'bg-indigo-100 text-indigo-800'
                          )}
                        >
                          {msg.proposal.status === 'executed'
                            ? 'Executed'
                            : msg.proposal.status === 'undone'
                              ? 'Undone'
                              : 'Preview Proposal'}
                        </span>
                        <span className="font-mono-num text-[11.5px] text-gray-500">
                          {msg.proposal.targetThreadIds.length} emails
                        </span>
                      </div>
                      <div className="text-[13.5px] font-semibold text-gray-900 mt-1.5">
                        {msg.proposal.title}
                      </div>
                      <div className="text-[12px] text-gray-600 mt-0.5">
                        {msg.proposal.description}
                      </div>
                    </div>

                    {msg.proposal.targetThreadsPreview.length > 0 && (
                      <div className="space-y-1 max-h-[125px] overflow-y-auto pr-1">
                        {msg.proposal.targetThreadsPreview.slice(0, 5).map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => onOpenThread(item.id)}
                            className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200/70 text-[12px] text-left"
                          >
                            <span className="truncate font-medium text-gray-800">
                              {item.subject}
                            </span>
                            <span className="text-[11px] text-gray-500 flex-shrink-0">
                              {item.accountLabel}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      {msg.proposal.status === 'pending' && (
                        <button
                          type="button"
                          disabled={busyProposalId === msg.proposal.id}
                          onClick={() => void handleProposalAction(msg.proposal!, 'execute')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-colors disabled:opacity-60"
                        >
                          {busyProposalId === msg.proposal.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          Execute ({msg.proposal.targetThreadIds.length})
                        </button>
                      )}
                      {msg.proposal.status === 'executed' && (
                        <button
                          type="button"
                          disabled={busyProposalId === msg.proposal.id}
                          onClick={() => void handleProposalAction(msg.proposal!, 'undo')}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[12.5px] font-semibold bg-amber-100 text-amber-900 hover:bg-amber-200 transition-colors disabled:opacity-60"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Undo Action
                        </button>
                      )}
                      {msg.proposal.status === 'undone' && (
                        <span className="text-[12px] text-gray-500 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Changes restored cleanly.
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Created Draft Callout */}
                {msg.createdDraft && (
                  <button
                    type="button"
                    onClick={onOpenDrafts}
                    className="w-full p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100/70 text-left flex items-center gap-2.5 transition-colors"
                  >
                    <FileText className="w-4 h-4 text-amber-700 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-gray-900 truncate">
                        Draft queued in Drafts
                      </div>
                      <div className="text-[11.5px] text-gray-600 truncate">
                        {msg.createdDraft.subject}
                      </div>
                    </div>
                  </button>
                )}

                {/* Created View / Rule */}
                {msg.createdView && (
                  <div className="w-full p-3 rounded-xl border border-indigo-200 bg-indigo-50 flex items-center gap-2.5">
                    <Filter className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-gray-900 truncate">
                        Saved View: {msg.createdView.name}
                      </div>
                    </div>
                  </div>
                )}

                {msg.createdRule && (
                  <div className="w-full p-3 rounded-xl border border-emerald-200 bg-emerald-50 flex items-center gap-2.5">
                    <Wand2 className="w-4 h-4 text-emerald-700 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-gray-900 truncate">
                        Rule added: {msg.createdRule.name}
                      </div>
                      <div className="text-[11.5px] text-gray-600 truncate">
                        {msg.createdRule.naturalLanguage}
                      </div>
                    </div>
                  </div>
                )}

                <span className="text-[10.5px] font-mono-num text-gray-400 px-1">
                  {formatRelativeTime(msg.timestamp)}
                </span>
              </div>
            ))}

            {isThinking && (
              <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white border border-gray-200 text-[12.5px] text-gray-600 shadow-sm">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                <span>Claude is reading your inbox...</span>
              </div>
            )}
          </div>

          {/* Chat Input */}
          <form onSubmit={(e) => void handleSubmit(e)} className="p-3.5 border-t border-gray-200 bg-white">
            <div className="flex items-end gap-2 rounded-xl border border-gray-300 bg-white px-3 py-2 focus-within:border-blue-500 transition-colors">
              <textarea
                rows={2}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit(e);
                  }
                }}
                placeholder="Ask Claude about emails, draft a reply, or preview cleanup..."
                className="flex-1 bg-transparent resize-none text-[13.5px] leading-snug text-gray-900 focus:outline-none placeholder:text-gray-400"
              />
              <button
                type="submit"
                disabled={!input.trim() || isThinking}
                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 flex-shrink-0"
                title="Send prompt"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-400 px-0.5">
              <span>Bulk actions always preview first</span>
              <span>Drafts never auto-send</span>
            </div>
          </form>
        </>
      ) : (
        /* Rules Tab */
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#FAF9F6]">
          <form
            onSubmit={(e) => void handleAddRule(e)}
            className="p-4 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-2.5"
          >
            <div className="text-[13px] font-semibold text-gray-900">New Natural-Language Rule</div>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              placeholder="Rule name (e.g. Route Cloud Invoices)"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[13px] text-gray-900 focus:outline-none focus:border-blue-500"
            />
            <textarea
              rows={2}
              value={rulePrompt}
              onChange={(e) => setRulePrompt(e.target.value)}
              placeholder="Plain English: Move all invoices over $100 to Receipts and tag Finance"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-[12.5px] text-gray-900 resize-none focus:outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={!ruleName.trim() || !rulePrompt.trim() || creatingRule}
              className="w-full py-2 px-3 rounded-xl text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 disabled:opacity-45 transition-colors"
            >
              {creatingRule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Add Rule
            </button>
          </form>

          <div className="space-y-2.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 px-1">
              Active Automations ({rules.length})
            </div>
            {rules.length === 0 ? (
              <div className="p-5 text-center rounded-2xl bg-white border border-dashed border-gray-300 text-[13px] text-gray-500">
                No agent rules yet. Write one in plain English above.
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-2xl bg-white border border-gray-200 shadow-sm space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-semibold text-gray-900 truncate">
                      {rule.name}
                    </span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => void onToggleRule(rule.id, !rule.enabled)}
                        className={cn(
                          'w-9 h-[20px] rounded-full transition-colors relative flex items-center px-0.5',
                          rule.enabled ? 'bg-emerald-600' : 'bg-gray-300'
                        )}
                        title={rule.enabled ? 'Disable rule' : 'Enable rule'}
                      >
                        <span
                          className={cn(
                            'w-4 h-4 rounded-full bg-white transition-transform shadow-sm',
                            rule.enabled ? 'translate-x-[16px]' : 'translate-x-0'
                          )}
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDeleteRule(rule.id)}
                        className="p-1 rounded-lg text-gray-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                        title="Delete rule"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[12.5px] text-gray-600 leading-relaxed">
                    {rule.naturalLanguage}
                  </p>
                  <div className="text-[11px] font-mono-num text-gray-400">
                    Matched {rule.matchCount} emails
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
