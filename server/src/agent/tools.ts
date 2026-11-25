// Claude tool_use definitions, dry-run proposal lifecycle (with reversible undo),
// and the conversational Prism Inbox Agent (real Claude tool loop + rich local fallback).

import crypto from 'node:crypto';
import type {
  ActionProposal,
  AgentChatMessage,
  AgentChatRequest,
  AgentRule,
  BulkActionType,
  CustomView,
  DraftItem,
  DraftTone,
  EmailThread,
  ExtractedTask,
  PriorityBucket,
} from '../../../shared/types.js';
import {
  resolveClaudeConfig,
  runClaudeToolLoop,
  sanitizeNoEmDashes,
  type AnthropicMessage,
  type AnthropicToolDefinition,
} from './claudeClient.js';
import {
  draftReplyForThread,
  localSearchThreads,
  summarizeThread,
} from './intelligence.js';
import type { AgentContext, StoredProposal } from './types.js';

// In-memory proposal store (also mirrors to ctx.saveProposal / ctx.getProposal when provided)
const proposalMemoryStore = new Map<string, StoredProposal>();

function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function getPrimarySenderName(thread: EmailThread): string {
  const own = thread.accountEmail.toLowerCase();
  const ext = thread.participants.find((p) => p.email.toLowerCase() !== own);
  return ext?.name || ext?.email || thread.participants[0]?.name || 'Sender';
}

function toPublicProposal(stored: StoredProposal): ActionProposal {
  return {
    id: stored.id,
    title: stored.title,
    description: stored.description,
    actionType: stored.actionType,
    targetThreadIds: stored.targetThreadIds,
    targetThreadsPreview: stored.targetThreadsPreview,
    payload: stored.payload,
    status: stored.status,
  };
}

export async function createActionProposal(
  ctx: AgentContext,
  input: {
    title: string;
    description: string;
    actionType: BulkActionType;
    targetThreadIds: string[];
    payload?: Record<string, unknown>;
  }
): Promise<ActionProposal> {
  const allThreads = await ctx.getThreads({ includeArchived: true });
  const byId = new Map(allThreads.map((t) => [t.id, t]));

  const validTargets: EmailThread[] = [];
  const seen = new Set<string>();
  for (const id of input.targetThreadIds) {
    if (seen.has(id)) continue;
    const found = byId.get(id);
    if (found) {
      seen.add(id);
      validTargets.push(found);
    }
  }

  const stored: StoredProposal = {
    id: makeId('prop'),
    title: sanitizeNoEmDashes(input.title),
    description: sanitizeNoEmDashes(input.description),
    actionType: input.actionType,
    targetThreadIds: validTargets.map((t) => t.id),
    targetThreadsPreview: validTargets.slice(0, 8).map((t) => ({
      id: t.id,
      subject: t.subject,
      fromName: getPrimarySenderName(t),
      accountLabel: t.accountLabel,
    })),
    payload: input.payload,
    status: 'pending',
    undoId: null,
    createdAt: new Date().toISOString(),
    executedAt: null,
    undoneAt: null,
  };

  proposalMemoryStore.set(stored.id, stored);
  if (ctx.saveProposal) {
    await ctx.saveProposal(stored);
  }
  return toPublicProposal(stored);
}

async function loadProposal(
  ctx: AgentContext,
  proposalId: string
): Promise<StoredProposal | null> {
  const fromMem = proposalMemoryStore.get(proposalId);
  if (fromMem) return fromMem;
  if (ctx.getProposal) {
    const fromDb = await ctx.getProposal(proposalId);
    if (fromDb) {
      proposalMemoryStore.set(fromDb.id, fromDb);
      return fromDb;
    }
  }
  return null;
}

export async function listProposals(): Promise<ActionProposal[]> {
  return Array.from(proposalMemoryStore.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 25)
    .map(toPublicProposal);
}

export async function executeActionProposal(
  ctx: AgentContext,
  proposalId: string
): Promise<{
  proposal: ActionProposal;
  undoId: string;
  affectedCount: number;
  affectedThreadIds: string[];
}> {
  const stored = await loadProposal(ctx, proposalId);
  if (!stored) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }
  if (stored.status === 'executed' && stored.undoId) {
    return {
      proposal: toPublicProposal(stored),
      undoId: stored.undoId,
      affectedCount: stored.targetThreadIds.length,
      affectedThreadIds: stored.targetThreadIds,
    };
  }
  if (stored.targetThreadIds.length === 0) {
    throw new Error('Proposal has no target threads to modify.');
  }

  const result = await ctx.applyBulkAction(
    stored.actionType,
    stored.targetThreadIds,
    stored.payload
  );

  stored.status = 'executed';
  stored.undoId = result.undoId;
  stored.executedAt = new Date().toISOString();
  proposalMemoryStore.set(stored.id, stored);
  if (ctx.saveProposal) {
    await ctx.saveProposal(stored);
  }

  return {
    proposal: toPublicProposal(stored),
    undoId: result.undoId,
    affectedCount: result.affectedCount,
    affectedThreadIds: result.affectedThreadIds,
  };
}

export async function undoActionProposal(
  ctx: AgentContext,
  proposalId: string
): Promise<{
  proposal: ActionProposal;
  ok: boolean;
  restoredCount: number;
  message: string;
}> {
  const stored = await loadProposal(ctx, proposalId);
  if (!stored) {
    throw new Error(`Proposal not found: ${proposalId}`);
  }
  if (stored.status !== 'executed' || !stored.undoId) {
    return {
      proposal: toPublicProposal(stored),
      ok: false,
      restoredCount: 0,
      message: 'This proposal is not currently executed or cannot be undone.',
    };
  }

  const undoResult = await ctx.undoAction(stored.undoId);
  if (undoResult.ok) {
    stored.status = 'undone';
    stored.undoneAt = new Date().toISOString();
    proposalMemoryStore.set(stored.id, stored);
    if (ctx.saveProposal) {
      await ctx.saveProposal(stored);
    }
  }

  return {
    proposal: toPublicProposal(stored),
    ok: undoResult.ok,
    restoredCount: undoResult.restoredCount,
    message: sanitizeNoEmDashes(
      undoResult.message ||
        (undoResult.ok
          ? `Restored ${undoResult.restoredCount} threads to their previous state.`
          : 'Unable to undo this action.')
    ),
  };
}

// ---------------------------------------------------------------------------
// Anthropic Tool Definitions
// ---------------------------------------------------------------------------

export const AGENT_TOOLS: AnthropicToolDefinition[] = [
  {
    name: 'search_and_filter_threads',
    description:
      'Search and filter email threads across all connected Gmail accounts by natural-language query, priority bucket, account, unread status, deadlines, or financial receipts.',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Natural-language keywords, sender name, topic, vendor, or question to match.',
        },
        bucket: {
          type: 'string',
          enum: [
            'decision',
            'waiting',
            'feed',
            'paper_trail',
            'screener',
            'archived',
          ],
          description: 'Optional priority bucket filter.',
        },
        accountId: {
          type: 'string',
          description: 'Optional Gmail account ID to restrict search.',
        },
        unreadOnly: {
          type: 'boolean',
          description: 'If true, only include unread threads.',
        },
        hasDeadline: {
          type: 'boolean',
          description: 'If true, only include threads with a deadline.',
        },
        hasReceipt: {
          type: 'boolean',
          description: 'If true, only include threads with extracted receipts or invoices.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of matching threads to return (default 15).',
        },
      },
    },
  },
  {
    name: 'propose_bulk_action',
    description:
      'Create a safe DRY-RUN bulk action proposal (archive, label, move_bucket, snooze, or mark_read) for user approval. NEVER auto-executes destructive changes: the user reviews the preview and clicks Execute, with one-click Undo.',
    input_schema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short imperative title, e.g. "Archive 5 read newsletters".',
        },
        description: {
          type: 'string',
          description: 'Clear 1-sentence explanation of what will happen and that it is reversible.',
        },
        actionType: {
          type: 'string',
          enum: ['archive', 'label', 'move_bucket', 'snooze', 'mark_read'],
          description: 'The bulk action type to preview.',
        },
        targetThreadIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Exact thread IDs returned by search_and_filter_threads.',
        },
        payload: {
          type: 'object',
          description:
            'Optional action payload: { label: string } for label, { bucket: PriorityBucket } for move_bucket, { until: ISOString } for snooze.',
        },
      },
      required: ['title', 'description', 'actionType', 'targetThreadIds'],
    },
  },
  {
    name: 'draft_reply',
    description:
      'Draft a tailored reply to a specific email thread and place it in the Approval Dock. NEVER sends automatically.',
    input_schema: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The target email thread ID.',
        },
        instruction: {
          type: 'string',
          description: 'What the reply should communicate.',
        },
        tone: {
          type: 'string',
          enum: ['direct', 'warm', 'executive', 'decline'],
          description: 'Desired reply tone (default: direct).',
        },
      },
      required: ['threadId'],
    },
  },
  {
    name: 'create_custom_view',
    description:
      'Save a reusable Smart View in the left sidebar matching a natural-language query or explicit list of threads.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short label for the Smart View (2 to 4 words).',
        },
        icon: {
          type: 'string',
          description: 'Lucide icon name such as "sparkles", "receipt", "clock", "briefcase", "plane", "star".',
        },
        queryDescription: {
          type: 'string',
          description: 'Natural-language description of what this view collects.',
        },
        threadIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional matched thread IDs.',
        },
      },
      required: ['name', 'queryDescription'],
    },
  },
  {
    name: 'create_agent_rule',
    description:
      'Create an ongoing Natural-Language Agent Rule that automatically triages or routes matching future emails.',
    input_schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Short rule title.',
        },
        naturalLanguage: {
          type: 'string',
          description: 'Plain-English rule instruction, e.g. "Route all software receipts to Paper Trail and mark read".',
        },
      },
      required: ['name', 'naturalLanguage'],
    },
  },
  {
    name: 'extract_tasks',
    description:
      'Analyze an email thread to extract a crisp distilled ask, summary bullets, and actionable follow-up tasks.',
    input_schema: {
      type: 'object',
      properties: {
        threadId: {
          type: 'string',
          description: 'The thread ID to analyze.',
        },
      },
      required: ['threadId'],
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Execution State Collector
// ---------------------------------------------------------------------------

interface ChatTurnArtifacts {
  citationsMap: Map<
    string,
    { threadId: string; subject: string; accountLabel: string }
  >;
  toolTrace: { tool: string; summary: string }[];
  proposal?: ActionProposal;
  createdDraft?: DraftItem;
  createdView?: CustomView;
  createdRule?: AgentRule;
}

async function executeAgentTool(
  ctx: AgentContext,
  toolName: string,
  input: Record<string, unknown>,
  artifacts: ChatTurnArtifacts,
  defaultAccountId?: string
): Promise<{ result: unknown; isError?: boolean }> {
  const addCitation = (t: EmailThread) => {
    if (!artifacts.citationsMap.has(t.id)) {
      artifacts.citationsMap.set(t.id, {
        threadId: t.id,
        subject: t.subject,
        accountLabel: t.accountLabel,
      });
    }
  };

  switch (toolName) {
    case 'search_and_filter_threads': {
      const query = typeof input.query === 'string' ? input.query : '';
      const bucket =
        typeof input.bucket === 'string'
          ? (input.bucket as PriorityBucket)
          : undefined;
      const accountId =
        typeof input.accountId === 'string' && input.accountId !== 'all'
          ? input.accountId
          : defaultAccountId && defaultAccountId !== 'all'
            ? defaultAccountId
            : undefined;
      const unreadOnly = Boolean(input.unreadOnly);
      const hasDeadline = Boolean(input.hasDeadline);
      const hasReceipt = Boolean(input.hasReceipt);
      const limit =
        typeof input.limit === 'number' && input.limit > 0
          ? Math.min(25, Math.floor(input.limit))
          : 15;

      const [allThreads, accounts] = await Promise.all([
        ctx.getThreads({ includeArchived: bucket === 'archived' }),
        ctx.getAccounts(),
      ]);

      let candidates = allThreads;
      if (accountId) {
        candidates = candidates.filter((t) => t.accountId === accountId);
      }
      if (bucket) {
        candidates = candidates.filter((t) => t.bucket === bucket);
      } else {
        candidates = candidates.filter((t) => !t.isArchived);
      }
      if (unreadOnly) {
        candidates = candidates.filter((t) => t.isUnread);
      }
      if (hasDeadline) {
        candidates = candidates.filter(
          (t) => Boolean(t.deadlineLabel || t.deadlineAt)
        );
      }
      if (hasReceipt) {
        candidates = candidates.filter((t) => Boolean(t.receiptInfo));
      }

      if (query.trim()) {
        const searched = localSearchThreads(candidates, accounts, query);
        candidates = searched.threads;
      } else {
        candidates = [...candidates].sort(
          (a, b) => b.urgencyScore - a.urgencyScore
        );
      }

      const top = candidates.slice(0, limit);
      top.slice(0, 8).forEach(addCitation);

      artifacts.toolTrace.push({
        tool: 'search_and_filter_threads',
        summary: `Found ${candidates.length} matching threads${query ? ` for "${query}"` : ''}${bucket ? ` in ${bucket}` : ''}.`,
      });

      return {
        result: {
          totalMatched: candidates.length,
          threads: top.map((t) => ({
            id: t.id,
            accountLabel: t.accountLabel,
            fromName: getPrimarySenderName(t),
            subject: t.subject,
            bucket: t.bucket,
            urgencyScore: t.urgencyScore,
            isUnread: t.isUnread,
            deadlineLabel: t.deadlineLabel ?? null,
            distilledAsk: t.distilledAsk,
            receiptInfo: t.receiptInfo ?? null,
            snippet: t.snippet.slice(0, 140),
          })),
        },
      };
    }

    case 'propose_bulk_action': {
      const title =
        typeof input.title === 'string' && input.title.trim()
          ? input.title.trim()
          : 'Proposed inbox action';
      const description =
        typeof input.description === 'string' && input.description.trim()
          ? input.description.trim()
          : 'Dry-run preview ready for your confirmation. Reversible with one-click Undo.';
      const actionType = validateBulkActionType(input.actionType);
      const targetThreadIds = Array.isArray(input.targetThreadIds)
        ? input.targetThreadIds.filter((x): x is string => typeof x === 'string')
        : [];
      const payload =
        input.payload && typeof input.payload === 'object'
          ? (input.payload as Record<string, unknown>)
          : undefined;

      const proposal = await createActionProposal(ctx, {
        title,
        description,
        actionType,
        targetThreadIds,
        payload,
      });

      artifacts.proposal = proposal;
      for (const preview of proposal.targetThreadsPreview.slice(0, 5)) {
        if (!artifacts.citationsMap.has(preview.id)) {
          artifacts.citationsMap.set(preview.id, {
            threadId: preview.id,
            subject: preview.subject,
            accountLabel: preview.accountLabel,
          });
        }
      }

      artifacts.toolTrace.push({
        tool: 'propose_bulk_action',
        summary: `Created dry-run proposal "${proposal.title}" (${proposal.targetThreadIds.length} threads, pending approval).`,
      });

      return {
        result: {
          status: 'pending_user_confirmation',
          proposalId: proposal.id,
          actionType: proposal.actionType,
          targetCount: proposal.targetThreadIds.length,
          preview: proposal.targetThreadsPreview,
        },
      };
    }

    case 'draft_reply': {
      const threadId =
        typeof input.threadId === 'string' ? input.threadId.trim() : '';
      if (!threadId) {
        return {
          result: { error: 'threadId is required for draft_reply.' },
          isError: true,
        };
      }
      const instruction =
        typeof input.instruction === 'string' ? input.instruction : undefined;
      const tone = validateTone(input.tone);

      const draft = await draftReplyForThread(ctx, {
        threadId,
        instruction,
        tone,
      });

      const thread = await ctx.getThreadById(threadId);
      if (thread) addCitation(thread);

      artifacts.createdDraft = draft;
      artifacts.toolTrace.push({
        tool: 'draft_reply',
        summary: `Saved ${tone} reply draft for "${draft.subject}" to the Approval Dock.`,
      });

      return {
        result: {
          status: 'saved_to_approval_dock',
          draftId: draft.id,
          subject: draft.subject,
          toEmails: draft.toEmails,
          tone: draft.tone,
          bodyPreview: draft.bodyText.slice(0, 260),
        },
      };
    }

    case 'create_custom_view': {
      const name =
        typeof input.name === 'string' && input.name.trim()
          ? sanitizeNoEmDashes(input.name.trim())
          : 'Smart View';
      const icon =
        typeof input.icon === 'string' && input.icon.trim()
          ? input.icon.trim()
          : 'sparkles';
      const queryDescription =
        typeof input.queryDescription === 'string' && input.queryDescription.trim()
          ? sanitizeNoEmDashes(input.queryDescription.trim())
          : name;

      let threadIds = Array.isArray(input.threadIds)
        ? input.threadIds.filter((x): x is string => typeof x === 'string')
        : [];
      let filterSpec: Record<string, unknown> = { query: queryDescription };

      if (threadIds.length === 0) {
        const [threads, accounts] = await Promise.all([
          ctx.getThreads({ includeArchived: false }),
          ctx.getAccounts(),
        ]);
        const matched = localSearchThreads(threads, accounts, queryDescription);
        threadIds = matched.threads.map((t) => t.id);
        filterSpec = matched.filterSpec;
        matched.threads.slice(0, 5).forEach(addCitation);
      }

      const view = await ctx.saveCustomView({
        name,
        icon,
        queryDescription,
        filterSpec,
        threadIds,
      });

      artifacts.createdView = view;
      artifacts.toolTrace.push({
        tool: 'create_custom_view',
        summary: `Created Smart View "${view.name}" matching ${threadIds.length} threads.`,
      });

      return {
        result: {
          viewId: view.id,
          name: view.name,
          matchedCount: threadIds.length,
        },
      };
    }

    case 'create_agent_rule': {
      const name =
        typeof input.name === 'string' && input.name.trim()
          ? sanitizeNoEmDashes(input.name.trim())
          : 'Inbox Automation Rule';
      const naturalLanguage =
        typeof input.naturalLanguage === 'string' && input.naturalLanguage.trim()
          ? sanitizeNoEmDashes(input.naturalLanguage.trim())
          : name;

      const [threads, accounts] = await Promise.all([
        ctx.getThreads({ includeArchived: false }),
        ctx.getAccounts(),
      ]);
      const matchCount = localSearchThreads(
        threads,
        accounts,
        naturalLanguage
      ).threads.length;

      const rule = await ctx.saveRule({
        name,
        naturalLanguage,
        enabled: true,
        matchCount,
      });

      artifacts.createdRule = rule;
      artifacts.toolTrace.push({
        tool: 'create_agent_rule',
        summary: `Saved active Agent Rule "${rule.name}" (${matchCount} current matches).`,
      });

      return {
        result: {
          ruleId: rule.id,
          name: rule.name,
          enabled: rule.enabled,
          matchCount: rule.matchCount,
        },
      };
    }

    case 'extract_tasks': {
      const threadId =
        typeof input.threadId === 'string' ? input.threadId.trim() : '';
      if (!threadId) {
        return {
          result: { error: 'threadId is required for extract_tasks.' },
          isError: true,
        };
      }

      const summary = await summarizeThread(ctx, threadId);
      const thread = await ctx.getThreadById(threadId);
      if (thread) addCitation(thread);

      artifacts.toolTrace.push({
        tool: 'extract_tasks',
        summary: `Extracted ${summary.extractedTasks.length} tasks and ${summary.aiSummaryBullets.length} key points.`,
      });

      return {
        result: {
          threadId: summary.threadId,
          distilledAsk: summary.distilledAsk,
          aiSummaryBullets: summary.aiSummaryBullets,
          tasks: summary.extractedTasks,
        },
      };
    }

    default:
      return {
        result: { error: `Unknown tool: ${toolName}` },
        isError: true,
      };
  }
}

function validateBulkActionType(raw: unknown): BulkActionType {
  if (
    raw === 'archive' ||
    raw === 'label' ||
    raw === 'move_bucket' ||
    raw === 'snooze' ||
    raw === 'mark_read'
  ) {
    return raw;
  }
  return 'archive';
}

function validateTone(raw: unknown): DraftTone {
  if (
    raw === 'direct' ||
    raw === 'warm' ||
    raw === 'executive' ||
    raw === 'decline'
  ) {
    return raw;
  }
  return 'direct';
}

// ---------------------------------------------------------------------------
// Conversational Agent Entrypoint (Claude Tool Loop + Local Intelligence Fallback)
// ---------------------------------------------------------------------------

export async function runAgentChat(
  ctx: AgentContext,
  req: AgentChatRequest
): Promise<AgentChatMessage> {
  const userMessage = (req.message ?? '').trim();
  if (!userMessage) {
    return {
      id: makeId('msg'),
      role: 'assistant',
      content:
        'Ask me anything about your merged Gmail accounts: prioritize decisions, audit receipts and spend, draft a reply, build a Smart View, or preview a bulk cleanup.',
      timestamp: new Date().toISOString(),
    };
  }

  const [accounts, activeThreads, commitments, shabbos, claudeConfig] =
    await Promise.all([
      ctx.getAccounts(),
      ctx.getThreads({ includeArchived: false }),
      ctx.getCommitments(),
      ctx.getShabbosStatus(),
      resolveClaudeConfig(ctx),
    ]);

  const activeThread = req.activeThreadId
    ? await ctx.getThreadById(req.activeThreadId)
    : null;

  const artifacts: ChatTurnArtifacts = {
    citationsMap: new Map(),
    toolTrace: [],
  };

  if (claudeConfig.apiKey) {
    try {
      const accountSummary = accounts
        .map((a) => `${a.label} (${a.email}, id=${a.id}, unread=${a.unreadCount})`)
        .join('; ');

      const decisionCount = activeThreads.filter(
        (t) => t.bucket === 'decision'
      ).length;
      const openPromises = commitments.filter(
        (c) => c.status !== 'resolved' && c.direction === 'you_promised'
      ).length;
      const waitingOn = commitments.filter(
        (c) => c.status !== 'resolved' && c.direction === 'waiting_on_them'
      ).length;

      const activeThreadNote = activeThread
        ? `\nCurrently open thread in reader: id="${activeThread.id}", subject="${activeThread.subject}", account="${activeThread.accountLabel}", from="${getPrimarySenderName(activeThread)}", ask="${activeThread.distilledAsk ?? 'none'}".`
        : '';

      const scopeNote =
        req.selectedAccountId && req.selectedAccountId !== 'all'
          ? `\nActive account filter: ${req.selectedAccountId}.`
          : '\nActive account filter: All merged Gmail accounts.';

      const shabbosNote = shabbos.enabled
        ? `\nShabbos & Yom Tov Guard: ENABLED (${shabbos.isCurrentlyRestricted ? 'currently holding outbound sends until ' + shabbos.nextWindowEnd : 'next window ' + shabbos.nextWindowStart}).`
        : '';

      const systemPrompt = [
        'You are Prism Claude, an executive multi-account Gmail agent inside Prism Mail.',
        `Connected accounts: ${accountSummary || 'None'}.`,
        `Live pulse: ${activeThreads.length} active threads, ${decisionCount} decisions, ${openPromises} promises you made, ${waitingOn} threads waiting on others.${scopeNote}${activeThreadNote}${shabbosNote}`,
        'Rules you MUST follow:',
        '1. Use your tools to inspect real threads before answering specific inbox questions. Never invent emails or thread IDs.',
        '2. For ANY bulk modification (archive, mark read, snooze, label, move), ALWAYS call propose_bulk_action to create a dry-run preview. Never claim changes are already applied.',
        '3. For ANY reply or email draft, ALWAYS call draft_reply so the draft lands in the Approval Dock. Never claim an email was sent.',
        '4. Be concise, sharp, scannable, and executive. Use crisp markdown bullets when listing multiple threads.',
        '5. STRICT STYLE RULE: NEVER use em dashes or en dashes anywhere. Use colons, commas, or hyphens instead.',
      ].join('\n');

      const historyMessages: AnthropicMessage[] = (req.history ?? [])
        .slice(-8)
        .filter((h) => h.content && h.content.trim().length > 0)
        .map((h) => ({
          role: h.role,
          content: h.content.slice(0, 1500),
        }));

      historyMessages.push({ role: 'user', content: userMessage });

      const loopResult = await runClaudeToolLoop({
        apiKey: claudeConfig.apiKey,
        model: claudeConfig.model,
        system: systemPrompt,
        messages: historyMessages,
        tools: AGENT_TOOLS,
        maxIterations: 5,
        maxTokens: 1500,
        onToolCall: (name, input) =>
          executeAgentTool(ctx, name, input, artifacts, req.selectedAccountId),
      });

      const citations = Array.from(artifacts.citationsMap.values()).slice(0, 8);

      return {
        id: makeId('msg'),
        role: 'assistant',
        content: sanitizeNoEmDashes(loopResult.text),
        citations: citations.length > 0 ? citations : undefined,
        proposal: artifacts.proposal,
        createdDraft: artifacts.createdDraft,
        createdView: artifacts.createdView,
        createdRule: artifacts.createdRule,
        toolTrace:
          artifacts.toolTrace.length > 0 ? artifacts.toolTrace : undefined,
        timestamp: new Date().toISOString(),
      };
    } catch {
      // Fall back smoothly to local intelligence mode without breaking the user flow
      artifacts.citationsMap.clear();
      artifacts.toolTrace.length = 0;
    }
  }

  return runLocalAgentChat(ctx, req, {
    accounts,
    activeThreads,
    commitments,
    activeThread,
    artifacts,
  });
}

// ---------------------------------------------------------------------------
// Rich Local Intelligence Agent (Zero API Key Out-of-the-Box Mode)
// ---------------------------------------------------------------------------

async function runLocalAgentChat(
  ctx: AgentContext,
  req: AgentChatRequest,
  state: {
    accounts: Awaited<ReturnType<AgentContext['getAccounts']>>;
    activeThreads: EmailThread[];
    commitments: Awaited<ReturnType<AgentContext['getCommitments']>>;
    activeThread: EmailThread | null;
    artifacts: ChatTurnArtifacts;
  }
): Promise<AgentChatMessage> {
  const { accounts, activeThreads, commitments, activeThread, artifacts } = state;
  const q = req.message.trim().toLowerCase();

  const scopedThreads =
    req.selectedAccountId && req.selectedAccountId !== 'all'
      ? activeThreads.filter((t) => t.accountId === req.selectedAccountId)
      : activeThreads;

  const finalize = (content: string): AgentChatMessage => {
    const citations = Array.from(artifacts.citationsMap.values()).slice(0, 8);
    return {
      id: makeId('msg'),
      role: 'assistant',
      content: sanitizeNoEmDashes(content),
      citations: citations.length > 0 ? citations : undefined,
      proposal: artifacts.proposal,
      createdDraft: artifacts.createdDraft,
      createdView: artifacts.createdView,
      createdRule: artifacts.createdRule,
      toolTrace: artifacts.toolTrace.length > 0 ? artifacts.toolTrace : undefined,
      timestamp: new Date().toISOString(),
    };
  };

  // Intent 1: Create Agent Rule
  if (
    /\b(create|add|set up|make|new)\s+(an?\s+)?(agent\s+)?rule\b/.test(q) ||
    /^(whenever|always|auto-route|auto-archive|every time)\b/.test(q)
  ) {
    const cleaned = req.message
      .replace(/^(create|add|set up|make)\s+(an?\s+)?(agent\s+)?rule(\s+to|\s+that|:)?\s*/i, '')
      .trim();
    const ruleName = deriveShortTitle(cleaned || req.message, 'Smart Triage Rule');
    await executeAgentTool(
      ctx,
      'create_agent_rule',
      {
        name: ruleName,
        naturalLanguage: cleaned || req.message,
      },
      artifacts,
      req.selectedAccountId
    );
    const rule = artifacts.createdRule;
    return finalize(
      `Created a new Agent Rule: **${rule?.name}**.\n\n- Instruction: "${rule?.naturalLanguage}"\n- Current matches across your inbox: ${rule?.matchCount ?? 0}\n- Status: Enabled (you can toggle or edit it anytime in the Rules tab).`
    );
  }

  // Intent 2: Create Smart View
  if (/\b(create|save|make|build|new)\s+(a\s+)?(smart\s+|custom\s+)?view\b/.test(q)) {
    const queryDesc = req.message
      .replace(/^(create|save|make|build|new)\s+(a\s+)?(smart\s+|custom\s+)?view(\s+for|\s+of|\s+named|:)?\s*/i, '')
      .trim();
    const viewName = deriveShortTitle(queryDesc || 'Priority View', 'Smart View');
    const icon = pickIconForQuery(queryDesc || q);

    await executeAgentTool(
      ctx,
      'create_custom_view',
      {
        name: viewName,
        icon,
        queryDescription: queryDesc || req.message,
      },
      artifacts,
      req.selectedAccountId
    );
    const view = artifacts.createdView;
    const count = view?.threadIds?.length ?? 0;
    return finalize(
      `Saved a new Smart View called **${view?.name}** in your sidebar.\n\n- Query: "${view?.queryDescription}"\n- Matching threads right now: ${count}\n\nClick any cited thread below or open the view from the left Prism rail.`
    );
  }

  // Intent 3: Bulk Action Dry-Run Proposal (archive, sweep, clean, mark read, snooze, move, label)
  if (
    /\b(archive|sweep|clean up|cleanup|clear out|mark.*read|snooze|move.*to|label.*as)\b/.test(q)
  ) {
    let actionType: BulkActionType = 'archive';
    let payload: Record<string, unknown> | undefined;

    if (/\bmark.*read\b/.test(q)) {
      actionType = 'mark_read';
    } else if (/\bsnooze\b/.test(q)) {
      actionType = 'snooze';
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
      tomorrow.setHours(9, 0, 0, 0);
      payload = { until: tomorrow.toISOString() };
    } else if (/\bmove.*feed\b/.test(q)) {
      actionType = 'move_bucket';
      payload = { bucket: 'feed' };
    } else if (/\bmove.*paper\s*trail\b/.test(q)) {
      actionType = 'move_bucket';
      payload = { bucket: 'paper_trail' };
    } else if (/\blabel\b/.test(q)) {
      actionType = 'label';
      const labelMatch = req.message.match(/label\s+(?:as\s+)?["']?([a-zA-Z0-9 _-]{2,24})["']?/i);
      payload = { label: labelMatch ? labelMatch[1].trim() : 'Reviewed' };
    }

    // Determine target threads cleanly
    let searchBucket: PriorityBucket | undefined;
    let searchQuery = '';
    if (/\b(newsletter|newsletters|feed|promo|promos|clutter|noise|perimeter)\b/.test(q)) {
      searchBucket = 'feed';
    } else if (/\b(receipt|receipts|invoice|invoices|paper trail)\b/.test(q)) {
      searchBucket = 'paper_trail';
    } else if (/\b(screener|cold|unknown)\b/.test(q)) {
      searchBucket = 'screener';
    } else if (/\b(waiting)\b/.test(q)) {
      searchBucket = 'waiting';
    } else {
      searchQuery = req.message.replace(
        /\b(please|can you|preview|dry run|dry-run|archive|sweep|clean up|cleanup|clear out|mark|all|as|read|snooze|old)\b/gi,
        ' '
      ).trim();
    }

    const searchOutcome = await executeAgentTool(
      ctx,
      'search_and_filter_threads',
      {
        query: searchQuery || undefined,
        bucket: searchBucket,
        unreadOnly: actionType === 'mark_read' ? true : undefined,
        limit: 12,
      },
      artifacts,
      req.selectedAccountId
    );

    const matched = (
      searchOutcome.result as { threads: { id: string }[] }
    ).threads;

    // Fallback: if archiving "old" or generic clutter matched 0, target feed/low-urgency items
    let targetIds = matched.map((t) => t.id);
    if (targetIds.length === 0 && actionType === 'archive') {
      targetIds = scopedThreads
        .filter((t) => t.bucket === 'feed' || t.urgencyScore < 40)
        .slice(0, 8)
        .map((t) => t.id);
    }

    if (targetIds.length === 0) {
      return finalize(
        'I searched your active threads and did not find any matching items for that bulk action. Try naming a category like "newsletters", "receipts", or a specific sender.'
      );
    }

    const verbLabel: Record<BulkActionType, string> = {
      archive: 'Archive',
      mark_read: 'Mark as read',
      snooze: 'Snooze until tomorrow 9:00 AM',
      move_bucket: `Move to ${String(payload?.bucket ?? 'feed')}`,
      label: `Apply label "${String(payload?.label ?? 'Reviewed')}"`,
    };

    const scopeLabel = searchBucket
      ? searchBucket.replace('_', ' ')
      : searchQuery
        ? `matching "${searchQuery}"`
        : 'low-priority';

    await executeAgentTool(
      ctx,
      'propose_bulk_action',
      {
        title: `${verbLabel[actionType]} ${targetIds.length} ${scopeLabel} ${targetIds.length === 1 ? 'thread' : 'threads'}`,
        description: `Dry-run preview ready. Confirm with Execute to apply this change across your inbox, with instant one-click Undo.`,
        actionType,
        targetThreadIds: targetIds,
        payload,
      },
      artifacts,
      req.selectedAccountId
    );

    return finalize(
      `Prepared a reversible dry-run proposal to **${verbLabel[actionType].toLowerCase()} ${targetIds.length} ${targetIds.length === 1 ? 'thread' : 'threads'}**.\n\nNothing has been modified yet. Review the preview card below and click **Execute** to apply (you can click **Undo** immediately afterward).`
    );
  }

  // Intent 4: Draft a Reply (Approval Dock, never auto-sends)
  if (/\b(draft|reply|respond|write back|nudge|decline|tell them)\b/.test(q)) {
    const tone: DraftTone = /\bdecline|pass|no thanks|turn down\b/.test(q)
      ? 'decline'
      : /\bwarm|friendly|kind|thank\b/.test(q)
        ? 'warm'
        : /\bexecutive|brief|formal|concise\b/.test(q)
          ? 'executive'
          : 'direct';

    let targetThread: EmailThread | null = activeThread;
    if (!targetThread) {
      const searched = localSearchThreads(scopedThreads, accounts, req.message);
      targetThread =
        searched.threads[0] ??
        scopedThreads
          .filter((t) => t.bucket === 'decision')
          .sort((a, b) => b.urgencyScore - a.urgencyScore)[0] ??
        scopedThreads[0] ??
        null;
    }

    if (!targetThread) {
      return finalize(
        'Open a thread or name a sender and I will draft a tailored reply into your Approval Dock.'
      );
    }

    const instructionMatch = req.message.match(
      /(?:saying|that|to say|tell them|mentioning)\s+(.+)$/i
    );
    const instruction = instructionMatch ? instructionMatch[1].trim() : undefined;

    await executeAgentTool(
      ctx,
      'draft_reply',
      {
        threadId: targetThread.id,
        tone,
        instruction,
      },
      artifacts,
      req.selectedAccountId
    );

    const draft = artifacts.createdDraft;
    return finalize(
      `Drafted a **${tone}** reply for **${targetThread.subject}** (${targetThread.accountLabel}) and queued it in your **Approval Dock**.\n\n- To: ${draft?.toEmails.join(', ')}\n- Status: Pending your review (never sent automatically)\n\nPreview:\n> ${(draft?.bodyText ?? '').split('\n').slice(0, 3).join('\n> ')}`
    );
  }

  // Intent 5: Extract Tasks / Summarize Active Thread
  if (
    (/\b(extract tasks|action items|to-do|todo|tasks)\b/.test(q) && activeThread) ||
    (/\b(summarize this|tldr|tl;dr|what is the ask)\b/.test(q) && activeThread)
  ) {
    const outcome = await executeAgentTool(
      ctx,
      'extract_tasks',
      { threadId: activeThread.id },
      artifacts,
      req.selectedAccountId
    );
    const data = outcome.result as {
      distilledAsk: string | null;
      aiSummaryBullets: string[];
      tasks: ExtractedTask[];
    };

    const bulletLines = data.aiSummaryBullets.map((b) => `- ${b}`).join('\n');
    const taskLines =
      data.tasks.length > 0
        ? `\n\n**Extracted Tasks:**\n${data.tasks.map((t) => `- [${t.priority.toUpperCase()}] ${t.title}${t.dueLabel ? ` (${t.dueLabel})` : ''}`).join('\n')}`
        : '';

    return finalize(
      `**${activeThread.subject}** (${activeThread.accountLabel})\n\n${data.distilledAsk ? `**Distilled Ask:** ${data.distilledAsk}\n\n` : ''}**Key Points:**\n${bulletLines}${taskLines}`
    );
  }

  // Intent 6: Financial Spend / Receipts / Invoices Summary
  if (
    /\b(spend|spent|receipt|receipts|invoice|invoices|cost|budget|money|expenses|paper trail|vault)\b/.test(q)
  ) {
    await executeAgentTool(
      ctx,
      'search_and_filter_threads',
      { hasReceipt: true, limit: 15 },
      artifacts,
      req.selectedAccountId
    );

    const receiptThreads = scopedThreads.filter((t) => Boolean(t.receiptInfo));
    if (receiptThreads.length === 0) {
      return finalize(
        'No extracted receipts or invoices were found in the current account scope.'
      );
    }

    const total = receiptThreads.reduce(
      (sum, t) => sum + (t.receiptInfo?.amount ?? 0),
      0
    );
    const byCategory = new Map<string, number>();
    for (const t of receiptThreads) {
      if (!t.receiptInfo) continue;
      const cat = t.receiptInfo.category || 'General';
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + t.receiptInfo.amount);
    }

    const sortedItems = [...receiptThreads].sort(
      (a, b) => (b.receiptInfo?.amount ?? 0) - (a.receiptInfo?.amount ?? 0)
    );

    const itemLines = sortedItems
      .slice(0, 6)
      .map(
        (t) =>
          `- **${t.receiptInfo!.vendor}**: $${t.receiptInfo!.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (${t.receiptInfo!.category}, ${t.accountLabel})${t.receiptInfo!.invoiceNumber ? ` #${t.receiptInfo!.invoiceNumber}` : ''}`
      )
      .join('\n');

    const catLines = Array.from(byCategory.entries())
      .sort((a, b) => b[1] - a[1])
      .map(
        ([cat, amt]) =>
          `${cat}: $${amt.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      )
      .join(' | ');

    return finalize(
      `Tracked **$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}** across **${receiptThreads.length}** receipts and invoices.\n\n**By Category:** ${catLines}\n\n**Largest Items:**\n${itemLines}`
    );
  }

  // Intent 7: Priorities / Open Asks & Deadlines / Commitments
  if (
    /\b(priorit|top|brief|summary|summarize|overview|morning|today|open asks|deadlines|what needs|attention|commitments|promised|waiting on)\b/.test(q)
  ) {
    await executeAgentTool(
      ctx,
      'search_and_filter_threads',
      { bucket: 'decision', limit: 8 },
      artifacts,
      req.selectedAccountId
    );

    const decisions = scopedThreads
      .filter((t) => t.bucket === 'decision')
      .sort((a, b) => b.urgencyScore - a.urgencyScore);

    const openPromises = commitments.filter(
      (c) =>
        c.status !== 'resolved' &&
        c.direction === 'you_promised' &&
        (!req.selectedAccountId ||
          req.selectedAccountId === 'all' ||
          c.accountId === req.selectedAccountId)
    );
    const waitingItems = commitments.filter(
      (c) =>
        c.status !== 'resolved' &&
        c.direction === 'waiting_on_them' &&
        (!req.selectedAccountId ||
          req.selectedAccountId === 'all' ||
          c.accountId === req.selectedAccountId)
    );

    const decisionLines = decisions
      .slice(0, 5)
      .map(
        (t) =>
          `- **${t.subject}** (${t.accountLabel}, urgency ${t.urgencyScore}${t.deadlineLabel ? `, due ${t.deadlineLabel}` : ''}): ${t.distilledAsk ?? t.snippet}`
      )
      .join('\n');

    const promiseSection =
      openPromises.length > 0
        ? `\n\n**You Promised (${openPromises.length}):**\n${openPromises
            .slice(0, 3)
            .map(
              (c) =>
                `- ${c.counterpartyName}: ${c.summary} (${c.dueLabel}, open ${c.daysOpen}d)`
            )
            .join('\n')}`
        : '';

    const waitingSection =
      waitingItems.length > 0
        ? `\n\n**Waiting On Others (${waitingItems.length}):**\n${waitingItems
            .slice(0, 3)
            .map(
              (c) =>
                `- ${c.counterpartyName}: ${c.summary} (waiting ${c.daysOpen}d)`
            )
            .join('\n')}`
        : '';

    return finalize(
      `Here is your live priority readout across ${req.selectedAccountId && req.selectedAccountId !== 'all' ? 'the selected account' : `${accounts.length} merged Gmail accounts`}:\n\n**Top Decisions (${decisions.length}):**\n${decisionLines || '- No urgent decisions waiting right now.'}${promiseSection}${waitingSection}\n\nAsk me to draft a reply to any item above, or add your Anthropic API key in Settings for live Claude Sonnet/Opus reasoning.`
    );
  }

  // Default Intent: Semantic Multi-Account Search & Answer
  await executeAgentTool(
    ctx,
    'search_and_filter_threads',
    { query: req.message, limit: 8 },
    artifacts,
    req.selectedAccountId
  );

  const searched = localSearchThreads(scopedThreads, accounts, req.message);
  if (searched.threads.length === 0) {
    return finalize(
      `${searched.explanation}\n\nTry asking:\n- "Summarize my top priorities"\n- "Find all open asks and deadlines"\n- "Summarize my recent spend and invoices"\n- "Archive old newsletters (preview)"`
    );
  }

  const lines = searched.threads
    .slice(0, 6)
    .map(
      (t) =>
        `- **${t.subject}** (${t.accountLabel}, from ${getPrimarySenderName(t)}${t.deadlineLabel ? `, ${t.deadlineLabel}` : ''}): ${t.distilledAsk ?? t.snippet}`
    )
    .join('\n');

  return finalize(
    `${searched.explanation}\n\n${lines}\n\nClick any cited thread below to inspect it in the Crystal Reader, or ask me to draft a reply or preview a bulk action on these threads.`
  );
}

function deriveShortTitle(text: string, fallback: string): string {
  const words = text
    .replace(/[^\w\s-]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4);
  const trailingJunk = new Set([
    'to', 'for', 'of', 'in', 'on', 'with', 'and', 'or', 'the', 'a', 'an', 'as', 'from',
  ]);
  while (words.length > 1 && trailingJunk.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  if (words.length === 0) return fallback;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function pickIconForQuery(q: string): string {
  const lower = q.toLowerCase();
  if (/receipt|invoice|spend|money|bill/.test(lower)) return 'receipt';
  if (/travel|flight|hotel|trip/.test(lower)) return 'plane';
  if (/urgent|deadline|today|priority/.test(lower)) return 'clock';
  if (/contract|legal|deal|investor|venture/.test(lower)) return 'briefcase';
  if (/newsletter|digest|feed/.test(lower)) return 'newspaper';
  return 'sparkles';
}
