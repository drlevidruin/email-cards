import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, Loader2, Menu, RefreshCw } from 'lucide-react';
import type {
  ActionProposal,
  AgentChatMessage,
  AgentRule,
  AppSettings,
  CommitmentItem,
  DraftItem,
  DraftTone,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  NlFilterResponse,
  PriorityBucket,
  ScreenerSender,
  ShabbosStatus,
  UndoToastItem,
} from './lib/types';
import { api } from './lib/api';
import {
  TopBar,
  type DeckCounts,
  type DeckFilter,
  type PrismViewId,
} from './components/shell/TopBar';
import { CommandPalette } from './components/shell/CommandPalette';
import { UndoToast } from './components/shell/UndoToast';
import { ThreadReader } from './components/stream/ThreadReader';
import { ApprovalDockModal } from './components/stream/ApprovalDockModal';
import { AgentRail } from './components/agent/AgentRail';
import { ConnectGmailModal } from './components/modals/ConnectGmailModal';
import { SettingsModal } from './components/modals/SettingsModal';
import { ComposeModal } from './components/modals/ComposeModal';
import { CardDeckView } from './components/deck/CardDeckView';
import { BrowseListView } from './components/deck/BrowseListView';
import {
  isActivelySnoozed,
  isPriorityCard,
  isReceiptCard,
} from './components/deck/deckUtils';

type UndoEntry =
  | { kind: 'server'; undoId: string; label: string }
  | { kind: 'bookmark'; threadId: string; prevStarred: boolean; label: string }
  | { kind: 'unarchive'; threadId: string; label: string };

const DECK_FILTER_LABELS: Record<DeckFilter, string> = {
  priority: 'Priority',
  bookmarked: 'Bookmarked',
  screener: 'First-Time',
  newsletters: 'Newsletters',
  receipts: 'Receipts',
  all: 'All',
};

function resolveSnoozeIso(preset?: string): string {
  if (preset && !Number.isNaN(Date.parse(preset))) {
    return new Date(preset).toISOString();
  }
  const now = new Date();
  if (preset === 'later') {
    return new Date(now.getTime() + 4 * 3600 * 1000).toISOString();
  }
  if (preset === 'next_week') {
    const next = new Date(now.getTime() + 72 * 3600 * 1000);
    next.setHours(9, 0, 0, 0);
    return next.toISOString();
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow.toISOString();
}

export const App: React.FC = () => {
  // Core domain state
  const [accounts, setAccounts] = useState<GmailAccount[]>([]);
  const [threads, setThreads] = useState<EmailThread[]>([]);
  const [commitments, setCommitments] = useState<CommitmentItem[]>([]);
  const [screener, setScreener] = useState<ScreenerSender[]>([]);
  const [tasks, setTasks] = useState<ExtractedTask[]>([]);
  const [drafts, setDrafts] = useState<DraftItem[]>([]);
  const [rules, setRules] = useState<AgentRule[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [shabbosStatus, setShabbosStatus] = useState<ShabbosStatus | null>(null);

  // Navigation & ADHD Focus Mode state (Cards default, menu hidden by default)
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<PrismViewId>('cards');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('priority');
  const [menuOpen, setMenuOpen] = useState(false);

  // Slide-over Thread Reader drawer state
  const [drawerThreadId, setDrawerThreadId] = useState<string | null>(null);
  const [drawerStartReply, setDrawerStartReply] = useState(false);

  // Modals & Claude drawer
  const [commandOpen, setCommandOpen] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'claude' | 'shabbos' | 'demo'>('claude');

  const [agentRailOpen, setAgentRailOpen] = useState(false);
  const [agentRailTab, setAgentRailTab] = useState<'chat' | 'rules'>('chat');
  const [focusedAgentThread, setFocusedAgentThread] = useState<EmailThread | null>(null);
  const [agentMessages, setAgentMessages] = useState<AgentChatMessage[]>([]);
  const [agentThinking, setAgentThinking] = useState(false);

  // Undo stack & async flags
  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [toasts, setToasts] = useState<UndoToastItem[]>([]);

  // Enforce bright sunlit light mode unconditionally
  useEffect(() => {
    const html = document.documentElement;
    html.classList.remove('dark');
    html.classList.add('light');
  }, []);

  const pushToast = useCallback(
    (
      message: string,
      options?: {
        detail?: string;
        undoId?: string;
        proposalId?: string;
        onUndo?: () => Promise<void> | void;
        tone?: 'default' | 'success' | 'warning';
      }
    ) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [
        ...prev.slice(-1),
        {
          id,
          message,
          detail: options?.detail,
          undoId: options?.undoId,
          proposalId: options?.proposalId,
          onUndo: options?.onUndo,
          tone: options?.tone || 'default',
        },
      ]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 5500);
    },
    []
  );

  const simpleToast = useCallback(
    (message: string, tone?: 'default' | 'success' | 'warning') => {
      pushToast(message, { tone });
    },
    [pushToast]
  );

  const loadBootstrap = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const data = await api.bootstrap();
      setAccounts(data.accounts || []);
      setThreads(data.threads || []);
      setCommitments(data.commitments || []);
      setScreener(data.screener || []);
      setTasks(data.tasks || []);
      setDrafts(data.drafts || []);
      setRules(data.rules || []);
      setSettings(data.settings || null);
      setShabbosStatus(data.shabbosStatus || null);
    } catch (err) {
      if (!opts?.silent) {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to reach Email Cards local server on port 3456.'
        );
      }
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  // View & filter switchers with clean auto-hide in Focus Mode
  const handleSelectView = useCallback((view: PrismViewId) => {
    setActiveView(view);
    setMenuOpen(false);
  }, []);

  const handleSelectAccount = useCallback((accountId: string) => {
    setSelectedAccountId(accountId);
    setMenuOpen(false);
  }, []);

  const handleDeckFilterChange = useCallback((filter: DeckFilter) => {
    setDeckFilter(filter);
    setMenuOpen(false);
  }, []);

  // Global keyboard shortcuts (Cmd+K, Cmd+J, C, M, 1-3, Esc)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping = Boolean(
        target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable)
      );

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setMenuOpen(false);
        setCommandOpen((v) => !v);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setMenuOpen(false);
        setAgentRailOpen((v) => !v);
        return;
      }

      if (e.key === 'Escape') {
        if (commandOpen) {
          setCommandOpen(false);
        } else if (composeOpen) {
          setComposeOpen(false);
        } else if (connectOpen) {
          setConnectOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (menuOpen) {
          setMenuOpen(false);
        } else if (drawerThreadId) {
          setDrawerThreadId(null);
          setDrawerStartReply(false);
        } else if (agentRailOpen) {
          setAgentRailOpen(false);
        }
        return;
      }

      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      const anyModalOpen = commandOpen || composeOpen || connectOpen || settingsOpen;
      if (anyModalOpen) return;

      const lower = e.key.toLowerCase();
      if (lower === 'm' && activeView === 'cards') {
        e.preventDefault();
        setMenuOpen((v) => !v);
      } else if (e.key === '1') {
        e.preventDefault();
        setActiveView('cards');
        setMenuOpen(false);
      } else if (e.key === '2') {
        e.preventDefault();
        setActiveView('browse');
        setMenuOpen(false);
      } else if (e.key === '3') {
        e.preventDefault();
        setActiveView('drafts');
        setMenuOpen(false);
      } else if (lower === 'c') {
        e.preventDefault();
        setMenuOpen(false);
        setComposeOpen(true);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeView,
    commandOpen,
    composeOpen,
    connectOpen,
    settingsOpen,
    menuOpen,
    drawerThreadId,
    agentRailOpen,
  ]);

  // Derived maps & counts
  const threadsById = useMemo(() => {
    const map: Record<string, EmailThread> = {};
    for (const t of threads) map[t.id] = t;
    return map;
  }, [threads]);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) || null,
    [accounts, selectedAccountId]
  );

  const totalUnread = useMemo(
    () => threads.filter((t) => !t.isArchived && t.isUnread).length,
    [threads]
  );

  const pendingDraftsCount = useMemo(
    () =>
      drafts.filter(
        (d) =>
          d.status !== 'sent' &&
          (selectedAccountId === 'all' || d.accountId === selectedAccountId)
      ).length,
    [drafts, selectedAccountId]
  );

  const deckCounts = useMemo<DeckCounts>(() => {
    const isAll = selectedAccountId === 'all';
    const scopedActive = threads.filter(
      (t) =>
        !t.isArchived &&
        !isActivelySnoozed(t) &&
        (isAll || t.accountId === selectedAccountId)
    );
    const pendingScreener = screener.filter(
      (s) => s.status === 'pending' && (isAll || s.accountId === selectedAccountId)
    );
    return {
      priority: scopedActive.filter(isPriorityCard).length,
      bookmarked: scopedActive.filter((t) => t.isStarred).length,
      screener: pendingScreener.length,
      newsletters: scopedActive.filter((t) => t.bucket === 'feed').length,
      receipts: scopedActive.filter(isReceiptCard).length,
      all: scopedActive.length,
    };
  }, [threads, screener, selectedAccountId]);

  // Open Thread Reader drawer (supports startReply from swipe right)
  const handleOpenThread = useCallback(
    (threadId: string, startReply = false) => {
      setMenuOpen(false);
      const target = threadsById[threadId];
      if (target && target.isUnread) {
        setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, isUnread: false } : t)));
        void api.markReadThread(threadId, false).catch(() => {});
      }
      setDrawerStartReply(Boolean(startReply));
      setDrawerThreadId(threadId);
    },
    [threadsById]
  );

  // Reversible Card Actions
  const handleArchiveThread = useCallback(
    async (threadId: string) => {
      const target = threadsById[threadId];
      const label = target?.subject || 'email';
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isArchived: true, bucket: 'archived' } : t))
      );
      if (drawerThreadId === threadId) {
        setDrawerThreadId(null);
        setDrawerStartReply(false);
      }
      try {
        const res = await api.archiveThread(threadId);
        const entry: UndoEntry = res.undoId
          ? { kind: 'server', undoId: res.undoId, label }
          : { kind: 'unarchive', threadId, label };
        setUndoStack((prev) => [...prev.slice(-19), entry]);
        pushToast(`Archived "${label}"`, {
          undoId: res.undoId,
          onUndo: res.undoId
            ? undefined
            : async () => {
                await api.unarchiveThread(threadId);
                await loadBootstrap({ silent: true });
              },
        });
        await loadBootstrap({ silent: true });
      } catch (err) {
        await loadBootstrap({ silent: true });
        simpleToast(err instanceof Error ? err.message : 'Archive failed', 'warning');
      }
    },
    [threadsById, drawerThreadId, pushToast, loadBootstrap, simpleToast]
  );

  const handleSnoozeThread = useCallback(
    async (threadId: string, preset?: string) => {
      const targetUntil = resolveSnoozeIso(preset);
      const target = threadsById[threadId];
      const label = target?.subject || 'email';
      setThreads((prev) =>
        prev.map((t) =>
          t.id === threadId ? { ...t, isSnoozedUntil: targetUntil, bucket: 'waiting' } : t
        )
      );
      if (drawerThreadId === threadId) {
        setDrawerThreadId(null);
        setDrawerStartReply(false);
      }
      try {
        const res = await api.snoozeThread(threadId, targetUntil);
        if (res.undoId) {
          setUndoStack((prev) => [
            ...prev.slice(-19),
            { kind: 'server', undoId: res.undoId!, label },
          ]);
        }
        pushToast(`Snoozed "${label}"`, {
          undoId: res.undoId,
        });
        await loadBootstrap({ silent: true });
      } catch (err) {
        await loadBootstrap({ silent: true });
        simpleToast(err instanceof Error ? err.message : 'Snooze failed', 'warning');
      }
    },
    [threadsById, drawerThreadId, pushToast, loadBootstrap, simpleToast]
  );

  const handleBookmarkThread = useCallback(
    async (threadId: string) => {
      const target = threadsById[threadId];
      const prevStarred = Boolean(target?.isStarred);
      const label = target?.subject || 'email';
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isStarred: true } : t))
      );
      try {
        await api.starThread(threadId, true);
        const entry: UndoEntry = { kind: 'bookmark', threadId, prevStarred, label };
        setUndoStack((prev) => [...prev.slice(-19), entry]);
        pushToast(`Bookmarked "${label}"`, {
          tone: 'success',
          onUndo: async () => {
            setThreads((prev) =>
              prev.map((t) => (t.id === threadId ? { ...t, isStarred: prevStarred } : t))
            );
            await api.starThread(threadId, prevStarred);
            setUndoStack((prev) =>
              prev.filter((u) => !(u.kind === 'bookmark' && u.threadId === threadId))
            );
            await loadBootstrap({ silent: true });
          },
        });
      } catch (err) {
        await loadBootstrap({ silent: true });
        simpleToast(err instanceof Error ? err.message : 'Could not bookmark email', 'warning');
      }
    },
    [threadsById, pushToast, loadBootstrap, simpleToast]
  );

  const handleToggleStar = useCallback(
    async (threadId: string, nextStarred: boolean) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isStarred: nextStarred } : t))
      );
      try {
        await api.starThread(threadId, nextStarred);
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap]
  );

  const handleToggleRead = useCallback(
    async (threadId: string, nextUnread: boolean) => {
      setThreads((prev) =>
        prev.map((t) => (t.id === threadId ? { ...t, isUnread: nextUnread } : t))
      );
      try {
        await api.markReadThread(threadId, nextUnread);
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap]
  );

  const handleChangeBucket = useCallback(
    async (threadId: string, bucket: PriorityBucket) => {
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, bucket } : t)));
      try {
        await api.moveThreadBucket(threadId, bucket);
        await loadBootstrap({ silent: true });
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap]
  );

  const handleToggleTask = useCallback(
    async (taskId: string, completed: boolean) => {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed } : t)));
      try {
        await api.updateTask(taskId, { completed });
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap]
  );

  // Quick Draft, Screener, Commitments
  const handleQuickDraft = useCallback(
    async (threadId: string, instruction: string, tone?: DraftTone) => {
      try {
        await api.draftReply({ threadId, instruction, tone: tone || 'direct' });
        await loadBootstrap({ silent: true });
        pushToast('Claude drafted a reply in Drafts', {
          detail: 'Open Menu > Drafts anytime to review and send',
          tone: 'success',
        });
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Quick draft failed', 'warning');
      }
    },
    [loadBootstrap, pushToast, simpleToast]
  );

  const handleScreenerDecision = useCallback(
    async (email: string, decision: 'approved' | 'feed' | 'muted') => {
      setScreener((prev) => prev.map((s) => (s.email === email ? { ...s, status: decision } : s)));
      try {
        const res = await api.decideScreener(email, decision);
        if (res.undoId) {
          setUndoStack((prev) => [
            ...prev.slice(-19),
            { kind: 'server', undoId: res.undoId!, label: email },
          ]);
        }
        const label =
          decision === 'approved'
            ? 'Approved sender'
            : decision === 'feed'
              ? 'Moved to Newsletters'
              : 'Muted sender';
        pushToast(`${label}: ${email}`, { undoId: res.undoId, tone: 'success' });
        await loadBootstrap({ silent: true });
      } catch (err) {
        await loadBootstrap({ silent: true });
        simpleToast(err instanceof Error ? err.message : 'Screener update failed', 'warning');
      }
    },
    [pushToast, loadBootstrap, simpleToast]
  );

  const handleResolveCommitment = useCallback(
    async (commitmentId: string) => {
      setCommitments((prev) =>
        prev.map((c) => (c.id === commitmentId ? { ...c, status: 'resolved' } : c))
      );
      try {
        await api.resolveCommitment(commitmentId);
        simpleToast('Marked as resolved', 'success');
        await loadBootstrap({ silent: true });
      } catch (err) {
        await loadBootstrap({ silent: true });
        simpleToast(err instanceof Error ? err.message : 'Could not resolve commitment', 'warning');
      }
    },
    [loadBootstrap, simpleToast]
  );

  const handleNudgeCommitment = useCallback(
    async (commitmentId: string) => {
      try {
        await api.nudgeCommitment(commitmentId);
        await loadBootstrap({ silent: true });
        setActiveView('drafts');
        setMenuOpen(false);
        simpleToast('Polite follow-up draft created in Drafts', 'success');
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Could not create nudge draft', 'warning');
      }
    },
    [loadBootstrap, simpleToast]
  );

  // Undo last card action (Z key or Undo button on deck)
  const handleUndoLast = useCallback(async (): Promise<boolean> => {
    if (undoStack.length === 0) return false;
    const entry = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    try {
      if (entry.kind === 'server') {
        await api.undo(entry.undoId);
        setToasts((prev) => prev.filter((t) => t.undoId !== entry.undoId));
      } else if (entry.kind === 'bookmark') {
        setThreads((prev) =>
          prev.map((t) => (t.id === entry.threadId ? { ...t, isStarred: entry.prevStarred } : t))
        );
        await api.starThread(entry.threadId, entry.prevStarred);
      } else if (entry.kind === 'unarchive') {
        await api.unarchiveThread(entry.threadId);
      }
      await loadBootstrap({ silent: true });
      simpleToast(`Restored "${entry.label}"`, 'success');
      return true;
    } catch (err) {
      simpleToast(err instanceof Error ? err.message : 'Undo failed', 'warning');
      return false;
    }
  }, [undoStack, loadBootstrap, simpleToast]);

  // Claude Assistant Drawer
  const handleSendAgentMessage = useCallback(
    async (text: string, explicitThreadId?: string) => {
      const userMsg: AgentChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: text,
        timestamp: new Date().toISOString(),
      };
      setAgentMessages((prev) => [...prev, userMsg]);
      setAgentThinking(true);
      try {
        const history = [...agentMessages, userMsg]
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content }));
        const reply = await api.agentChat({
          message: text,
          history,
          selectedAccountId: selectedAccountId === 'all' ? undefined : selectedAccountId,
          activeThreadId: explicitThreadId || focusedAgentThread?.id || drawerThreadId || undefined,
        });
        setAgentMessages((prev) => [...prev, reply]);
        if (reply.createdDraft || reply.createdView || reply.createdRule) {
          await loadBootstrap({ silent: true });
        }
      } catch (err) {
        setAgentMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            content:
              err instanceof Error
                ? `I ran into an issue reaching Claude: ${err.message}`
                : 'Unable to reach Claude right now.',
            timestamp: new Date().toISOString(),
          },
        ]);
      } finally {
        setAgentThinking(false);
      }
    },
    [agentMessages, selectedAccountId, focusedAgentThread, drawerThreadId, loadBootstrap]
  );

  const handleAskClaudeAboutThread = useCallback((thread: EmailThread) => {
    setMenuOpen(false);
    setFocusedAgentThread(thread);
    setAgentRailTab('chat');
    setAgentRailOpen(true);
  }, []);

  const handleAskAgentPrompt = useCallback(
    (prompt: string) => {
      setMenuOpen(false);
      setAgentRailTab('chat');
      setAgentRailOpen(true);
      void handleSendAgentMessage(prompt);
    },
    [handleSendAgentMessage]
  );

  const handleApplyNlFilter = useCallback(
    (query: string, res: NlFilterResponse) => {
      if (res.threadIds.length === 1) {
        handleOpenThread(res.threadIds[0], false);
        return;
      }
      const citations = res.threadIds
        .map((id) => threadsById[id])
        .filter(Boolean)
        .slice(0, 8)
        .map((t) => ({
          threadId: t.id,
          subject: t.subject,
          accountLabel: t.accountLabel,
        }));
      setAgentMessages((prev) => [
        ...prev,
        {
          id: `nl-user-${Date.now()}`,
          role: 'user',
          content: query,
          timestamp: new Date().toISOString(),
        },
        {
          id: `nl-assistant-${Date.now()}`,
          role: 'assistant',
          content:
            citations.length > 0
              ? `${res.explanation} Found ${res.threadIds.length} matching emails. Click any card below to read.`
              : `No matching emails found for "${query}".`,
          citations,
          timestamp: new Date().toISOString(),
        },
      ]);
      setAgentRailTab('chat');
      setAgentRailOpen(true);
    },
    [handleOpenThread, threadsById]
  );

  const handleExecuteProposal = useCallback(
    async (proposal: ActionProposal) => {
      try {
        await api.executeProposal(proposal.id);
        setAgentMessages((prev) =>
          prev.map((m) =>
            m.proposal && m.proposal.id === proposal.id
              ? { ...m, proposal: { ...m.proposal, status: 'executed' } }
              : m
          )
        );
        await loadBootstrap({ silent: true });
        pushToast(`Executed: ${proposal.title}`, {
          proposalId: proposal.id,
          tone: 'success',
        });
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Proposal execution failed', 'warning');
      }
    },
    [loadBootstrap, pushToast, simpleToast]
  );

  const handleUndoProposal = useCallback(
    async (proposal: ActionProposal) => {
      try {
        await api.undoProposal(proposal.id);
        setToasts((prev) => prev.filter((t) => t.proposalId !== proposal.id));
        setAgentMessages((prev) =>
          prev.map((m) =>
            m.proposal && m.proposal.id === proposal.id
              ? { ...m, proposal: { ...m.proposal, status: 'undone' } }
              : m
          )
        );
        await loadBootstrap({ silent: true });
        simpleToast('Proposal undone and emails restored', 'success');
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Could not undo proposal', 'warning');
      }
    },
    [loadBootstrap, simpleToast]
  );

  const handleUndoToast = useCallback(
    async (toast: UndoToastItem) => {
      setToasts((prev) =>
        prev.filter(
          (t) =>
            t.id !== toast.id &&
            (!toast.proposalId || t.proposalId !== toast.proposalId) &&
            (!toast.undoId || t.undoId !== toast.undoId)
        )
      );
      try {
        if (toast.proposalId) {
          await api.undoProposal(toast.proposalId);
          setAgentMessages((prev) =>
            prev.map((m) =>
              m.proposal && m.proposal.id === toast.proposalId
                ? { ...m, proposal: { ...m.proposal, status: 'undone' } }
                : m
            )
          );
        } else if (toast.undoId) {
          await api.undo(toast.undoId);
          setUndoStack((prev) =>
            prev.filter((u) => !(u.kind === 'server' && u.undoId === toast.undoId))
          );
        } else if (toast.onUndo) {
          await toast.onUndo();
        }
        await loadBootstrap({ silent: true });
        simpleToast('Action undone', 'success');
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Undo failed', 'warning');
      }
    },
    [loadBootstrap, simpleToast]
  );

  // Agent Rules
  const handleCreateRule = useCallback(
    async (name: string, naturalLanguage: string) => {
      try {
        await api.createRule({ name, naturalLanguage });
        await loadBootstrap({ silent: true });
        simpleToast(`Rule "${name}" added`, 'success');
      } catch (err) {
        simpleToast(err instanceof Error ? err.message : 'Could not add rule', 'warning');
      }
    },
    [loadBootstrap, simpleToast]
  );

  const handleToggleRule = useCallback(
    async (id: string, enabled: boolean) => {
      setRules((prev) => prev.map((r) => (r.id === id ? { ...r, enabled } : r)));
      try {
        await api.updateRule(id, { enabled });
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap]
  );

  const handleDeleteRule = useCallback(
    async (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id));
      try {
        await api.deleteRule(id);
        simpleToast('Rule removed');
      } catch {
        await loadBootstrap({ silent: true });
      }
    },
    [loadBootstrap, simpleToast]
  );

  // Sync
  const handleSyncAll = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await api.syncAllAccounts();
      await loadBootstrap({ silent: true });
      simpleToast('All Gmail accounts synced', 'success');
    } catch (err) {
      simpleToast(err instanceof Error ? err.message : 'Sync failed', 'warning');
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing, loadBootstrap, simpleToast]);

  const openSettingsAt = useCallback((tab: 'claude' | 'shabbos' | 'demo' = 'claude') => {
    setMenuOpen(false);
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  // Quiet context label for the floating Menu pill when a non-default account/deck is active
  const menuContextParts: string[] = [];
  if (selectedAccount) menuContextParts.push(selectedAccount.label);
  if (deckFilter !== 'priority') menuContextParts.push(DECK_FILTER_LABELS[deckFilter]);

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F4F0] gap-3">
        <div className="w-11 h-11 rounded-2xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
        </div>
        <div className="text-center space-y-1">
          <div className="text-[18px] font-bold text-gray-900">Loading Email Cards</div>
          <div className="text-[13px] text-gray-500">Preparing your merged Gmail deck...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#F5F4F0] p-6">
        <div className="max-w-[440px] w-full rounded-2xl p-6 bg-white border border-gray-200 shadow-lg space-y-4 text-center">
          <AlertCircle className="w-8 h-8 text-rose-600 mx-auto" />
          <div className="text-[20px] font-bold text-gray-900">Waiting for Email Cards Server</div>
          <p className="text-[13.5px] leading-relaxed text-gray-600">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadBootstrap()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#F5F4F0] text-gray-900">
      {/* Persistent TopBar ONLY on Browse or Drafts (hidden on Cards for zero-distraction ADHD focus) */}
      {activeView !== 'cards' && (
        <TopBar
          activeView={activeView}
          onSelectView={handleSelectView}
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelectAccount={handleSelectAccount}
          totalUnread={totalUnread}
          draftsCount={pendingDraftsCount}
          onOpenConnectGmail={() => setConnectOpen(true)}
          onOpenCommandPalette={() => setCommandOpen(true)}
          onOpenCompose={() => setComposeOpen(true)}
          agentRailOpen={agentRailOpen}
          onToggleAgentRail={() => setAgentRailOpen((v) => !v)}
          onOpenSettings={openSettingsAt}
          isSyncing={isSyncing}
          onSyncAll={() => void handleSyncAll()}
          claudeConfigured={Boolean(settings?.anthropicApiKeyConfigured)}
          shabbosStatus={shabbosStatus}
        />
      )}

      {/* Whisper-Clean Floating Menu Pill on Cards Focus Mode */}
      {activeView === 'cards' && !menuOpen && (
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="fixed top-3.5 left-3.5 sm:top-5 sm:left-5 z-30 inline-flex items-center gap-2 rounded-full bg-white/90 hover:bg-white border border-gray-200/80 shadow-sm px-3 sm:px-3.5 py-2 text-[13px] font-medium text-gray-700 hover:text-gray-900 transition-all backdrop-blur-sm max-w-[calc(100vw-110px)]"
          title="Open menu (M)"
          aria-label="Open Menu"
        >
          <Menu className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <span>Menu</span>
          {menuContextParts.length > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12px] text-gray-500 font-normal truncate">
              {selectedAccount && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: selectedAccount.color }}
                />
              )}
              <span className="truncate">· {menuContextParts.join(' · ')}</span>
            </span>
          )}
          {pendingDraftsCount > 0 && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
              title={`${pendingDraftsCount} pending drafts`}
            />
          )}
        </button>
      )}

      {/* Slide-Down White Menu Overlay on Cards View */}
      <AnimatePresence>
        {activeView === 'cards' && menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-40 bg-slate-900/15 backdrop-blur-[2px]"
            onClick={() => setMenuOpen(false)}
          >
            <motion.div
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className="max-h-[85vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <TopBar
                overlayMode
                onCloseOverlay={() => setMenuOpen(false)}
                activeView={activeView}
                onSelectView={handleSelectView}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onSelectAccount={handleSelectAccount}
                totalUnread={totalUnread}
                draftsCount={pendingDraftsCount}
                deckFilter={deckFilter}
                onSelectDeckFilter={handleDeckFilterChange}
                deckCounts={deckCounts}
                onOpenConnectGmail={() => {
                  setMenuOpen(false);
                  setConnectOpen(true);
                }}
                onOpenCommandPalette={() => {
                  setMenuOpen(false);
                  setCommandOpen(true);
                }}
                onOpenCompose={() => {
                  setMenuOpen(false);
                  setComposeOpen(true);
                }}
                agentRailOpen={agentRailOpen}
                onToggleAgentRail={() => {
                  setMenuOpen(false);
                  setAgentRailOpen((v) => !v);
                }}
                onOpenSettings={openSettingsAt}
                isSyncing={isSyncing}
                onSyncAll={() => void handleSyncAll()}
                claudeConfigured={Boolean(settings?.anthropicApiKeyConfigured)}
                shabbosStatus={shabbosStatus}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacious Light Stage + Optional Right Claude Drawer */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        <main className="flex-1 min-w-0 h-full overflow-hidden relative">
          {activeView === 'cards' && (
            <div className="h-full overflow-y-auto">
              <CardDeckView
                threads={threads}
                screener={screener}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                activeFilter={deckFilter}
                onFilterChange={handleDeckFilterChange}
                focusMode={true}
                onOpenThread={handleOpenThread}
                onArchiveThread={handleArchiveThread}
                onSnoozeThread={handleSnoozeThread}
                onBookmarkThread={handleBookmarkThread}
                onQuickDraft={handleQuickDraft}
                onScreenerDecision={handleScreenerDecision}
                onUndoLast={handleUndoLast}
                canUndo={undoStack.length > 0}
                onAskClaudeAboutThread={handleAskClaudeAboutThread}
                onOpenDrafts={() => handleSelectView('drafts')}
              />
            </div>
          )}

          {activeView === 'browse' && (
            <div className="h-full overflow-y-auto">
              <BrowseListView
                threads={threads}
                commitments={commitments}
                accounts={accounts}
                selectedAccountId={selectedAccountId}
                onOpenThread={handleOpenThread}
                onArchiveThread={handleArchiveThread}
                onSnoozeThread={handleSnoozeThread}
                onResolveCommitment={handleResolveCommitment}
                onNudgeCommitment={handleNudgeCommitment}
                onAskAgent={handleAskAgentPrompt}
              />
            </div>
          )}

          {activeView === 'drafts' && (
            <ApprovalDockModal
              open
              mode="page"
              drafts={drafts}
              accounts={accounts}
              selectedAccountId={selectedAccountId}
              shabbosStatus={shabbosStatus}
              onRefresh={() => loadBootstrap({ silent: true })}
              onOpenThread={(id) => handleOpenThread(id, false)}
              onOpenCompose={() => setComposeOpen(true)}
              onToast={simpleToast}
            />
          )}

          {/* Slide-Over Pure White Thread Reader & Reply Sheet */}
          <AnimatePresence>
            {drawerThreadId && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="absolute inset-0 z-30 flex justify-end bg-slate-900/20 backdrop-blur-[2px]"
                onClick={() => {
                  setDrawerThreadId(null);
                  setDrawerStartReply(false);
                }}
              >
                <motion.div
                  initial={{ x: 48, opacity: 0.7 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 48, opacity: 0 }}
                  transition={{ type: 'spring', stiffness: 390, damping: 35 }}
                  className="w-full sm:max-w-[560px] lg:max-w-[660px] h-full bg-white sm:border-l border-gray-200 overflow-hidden"
                  style={{ boxShadow: 'var(--shadow-modal)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <ThreadReader
                    threadId={drawerThreadId}
                    fallbackThread={threadsById[drawerThreadId] || null}
                    allThreads={threads}
                    allTasks={tasks}
                    accounts={accounts}
                    shabbosStatus={shabbosStatus}
                    mode="drawer"
                    autoFocusReply={drawerStartReply}
                    onClose={() => {
                      setDrawerThreadId(null);
                      setDrawerStartReply(false);
                    }}
                    onSelectThread={(id) => {
                      setDrawerStartReply(false);
                      setDrawerThreadId(id);
                    }}
                    onArchive={handleArchiveThread}
                    onSnooze={handleSnoozeThread}
                    onToggleStar={handleToggleStar}
                    onToggleRead={handleToggleRead}
                    onChangeBucket={handleChangeBucket}
                    onToggleTask={handleToggleTask}
                    onRefreshData={() => loadBootstrap({ silent: true })}
                    onToast={simpleToast}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Right Slide-Over Claude Assistant Drawer (closed by default) */}
        <AgentRail
          open={agentRailOpen}
          initialTab={agentRailTab}
          focusedThread={focusedAgentThread}
          onClearFocusedThread={() => setFocusedAgentThread(null)}
          onClose={() => setAgentRailOpen(false)}
          messages={agentMessages}
          isThinking={agentThinking}
          onSendMessage={(text) => handleSendAgentMessage(text)}
          onExecuteProposal={handleExecuteProposal}
          onUndoProposal={handleUndoProposal}
          onOpenThread={(id) => handleOpenThread(id, false)}
          onOpenDrafts={() => handleSelectView('drafts')}
          onOpenSettings={openSettingsAt}
          rules={rules}
          onCreateRule={handleCreateRule}
          onToggleRule={handleToggleRule}
          onDeleteRule={handleDeleteRule}
          settings={settings}
        />
      </div>

      {/* Modals */}
      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        threads={threads}
        accounts={accounts}
        onOpenThread={(id) => handleOpenThread(id, false)}
        onSelectView={handleSelectView}
        onSelectAccount={handleSelectAccount}
        onOpenCompose={() => setComposeOpen(true)}
        onOpenConnectGmail={() => setConnectOpen(true)}
        onOpenSettings={openSettingsAt}
        onSyncAll={() => void handleSyncAll()}
        onApplyNlFilter={handleApplyNlFilter}
      />

      <ConnectGmailModal
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        accounts={accounts}
        settings={settings}
        onAccountsChanged={() => loadBootstrap({ silent: true })}
        onToast={simpleToast}
      />

      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        shabbosStatus={shabbosStatus}
        accounts={accounts}
        onSettingsUpdated={() => loadBootstrap({ silent: true })}
        onToast={simpleToast}
      />

      <ComposeModal
        open={composeOpen}
        onClose={() => setComposeOpen(false)}
        accounts={accounts}
        defaultAccountId={selectedAccountId === 'all' ? undefined : selectedAccountId}
        shabbosStatus={shabbosStatus}
        onSentOrSaved={() => loadBootstrap({ silent: true })}
        onToast={simpleToast}
      />

      <UndoToast
        toasts={toasts}
        onUndo={(toast) => void handleUndoToast(toast)}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
};
