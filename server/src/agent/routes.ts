// Express Router for /api/agent/* endpoints (Claude AI Inbox Agent + Intelligence Engine)

import { Router, type Request, type Response } from 'express';
import type {
  AgentChatRequest,
  DraftReplyRequest,
  NlFilterRequest,
  TestKeyRequest,
} from '../../../shared/types.js';
import {
  sanitizeNoEmDashes,
  testAnthropicKey,
} from './claudeClient.js';
import {
  buildConstellationGraph,
  draftReplyForThread,
  generateBriefing,
  localSearchThreads,
  nlFilterThreads,
  summarizeThread,
} from './intelligence.js';
import {
  executeActionProposal,
  listProposals,
  runAgentChat,
  undoActionProposal,
} from './tools.js';
import type { AgentContext } from './types.js';

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return sanitizeNoEmDashes(err.message);
  return 'Unexpected agent error';
}

export function createAgentRouter(ctx: AgentContext): Router {
  const router = Router();

  // GET /api/agent/briefing (?refresh=1&accountId=...)
  router.get('/briefing', async (req: Request, res: Response) => {
    try {
      const refresh =
        req.query.refresh === '1' || req.query.refresh === 'true';
      const accountId =
        typeof req.query.accountId === 'string'
          ? req.query.accountId
          : undefined;
      const briefing = await generateBriefing(ctx, { refresh, accountId });
      res.json(briefing);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // POST /api/agent/chat
  router.post('/chat', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Partial<AgentChatRequest>;
      if (typeof body.message !== 'string' || !body.message.trim()) {
        res.status(400).json({ error: 'message is required' });
        return;
      }
      const reply = await runAgentChat(ctx, {
        message: body.message,
        history: Array.isArray(body.history) ? body.history : undefined,
        selectedAccountId:
          typeof body.selectedAccountId === 'string'
            ? body.selectedAccountId
            : undefined,
        activeThreadId:
          typeof body.activeThreadId === 'string'
            ? body.activeThreadId
            : undefined,
      });
      res.json(reply);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // POST /api/agent/draft-reply
  router.post('/draft-reply', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Partial<DraftReplyRequest>;
      if (typeof body.threadId !== 'string' || !body.threadId.trim()) {
        res.status(400).json({ error: 'threadId is required' });
        return;
      }
      const draft = await draftReplyForThread(ctx, {
        threadId: body.threadId.trim(),
        instruction:
          typeof body.instruction === 'string' ? body.instruction : undefined,
        tone: body.tone,
      });
      res.json(draft);
    } catch (err) {
      const msg = getErrorMessage(err);
      res
        .status(msg.toLowerCase().includes('not found') ? 404 : 500)
        .json({ error: msg });
    }
  });

  // POST /api/agent/summarize/:threadId
  router.post('/summarize/:threadId', async (req: Request, res: Response) => {
    try {
      const threadId = req.params.threadId;
      if (!threadId) {
        res.status(400).json({ error: 'threadId is required' });
        return;
      }
      const result = await summarizeThread(ctx, threadId);
      res.json(result);
    } catch (err) {
      const msg = getErrorMessage(err);
      res
        .status(msg.toLowerCase().includes('not found') ? 404 : 500)
        .json({ error: msg });
    }
  });

  // POST /api/agent/nl-filter and /api/agent/highlight
  const handleNlFilter = async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Partial<NlFilterRequest>;
      const query = typeof body.query === 'string' ? body.query : '';
      const accountId =
        typeof body.accountId === 'string' ? body.accountId : undefined;
      const result = await nlFilterThreads(ctx, query, accountId);
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };
  router.post('/nl-filter', handleNlFilter);
  router.post('/highlight', handleNlFilter);

  // GET /api/agent/constellation and /api/agent/constellation-graph
  const handleConstellation = async (req: Request, res: Response) => {
    try {
      const accountId =
        typeof req.query.accountId === 'string'
          ? req.query.accountId
          : 'all';
      const graph = await buildConstellationGraph(ctx, accountId);
      res.json(graph);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  };
  router.get('/constellation', handleConstellation);
  router.get('/constellation-graph', handleConstellation);

  // Proposals: list, execute, undo
  router.get('/proposals', async (_req: Request, res: Response) => {
    try {
      const proposals = await listProposals();
      res.json({ proposals });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  router.post(
    '/proposals/:id/execute',
    async (req: Request, res: Response) => {
      try {
        const result = await executeActionProposal(ctx, req.params.id);
        res.json(result);
      } catch (err) {
        const msg = getErrorMessage(err);
        res
          .status(msg.toLowerCase().includes('not found') ? 404 : 400)
          .json({ error: msg });
      }
    }
  );

  router.post('/proposals/:id/undo', async (req: Request, res: Response) => {
    try {
      const result = await undoActionProposal(ctx, req.params.id);
      res.json(result);
    } catch (err) {
      const msg = getErrorMessage(err);
      res
        .status(msg.toLowerCase().includes('not found') ? 404 : 400)
        .json({ error: msg });
    }
  });

  // Agent Rules CRUD: GET, POST, PATCH, DELETE
  router.get('/rules', async (_req: Request, res: Response) => {
    try {
      const rules = await ctx.getRules();
      res.json(rules);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  router.post('/rules', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as {
        name?: string;
        naturalLanguage?: string;
        enabled?: boolean;
      };
      const naturalLanguage =
        typeof body.naturalLanguage === 'string'
          ? sanitizeNoEmDashes(body.naturalLanguage.trim())
          : '';
      if (!naturalLanguage) {
        res.status(400).json({ error: 'naturalLanguage is required' });
        return;
      }
      const name =
        typeof body.name === 'string' && body.name.trim()
          ? sanitizeNoEmDashes(body.name.trim())
          : naturalLanguage.split(/\s+/).slice(0, 4).join(' ');

      const [threads, accounts] = await Promise.all([
        ctx.getThreads({ includeArchived: false }),
        ctx.getAccounts(),
      ]);
      const matchCount = localSearchThreads(
        threads,
        accounts,
        naturalLanguage
      ).threads.length;

      const created = await ctx.saveRule({
        name,
        naturalLanguage,
        enabled: body.enabled ?? true,
        matchCount,
      });
      res.status(201).json(created);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  router.patch('/rules/:id', async (req: Request, res: Response) => {
    try {
      const id = req.params.id;
      const body = (req.body ?? {}) as {
        name?: string;
        naturalLanguage?: string;
        enabled?: boolean;
      };

      const hasTextPatch =
        typeof body.name === 'string' ||
        typeof body.naturalLanguage === 'string';

      let updated = null;
      if (hasTextPatch && ctx.updateRule) {
        updated = await ctx.updateRule(id, {
          name:
            typeof body.name === 'string'
              ? sanitizeNoEmDashes(body.name.trim())
              : undefined,
          naturalLanguage:
            typeof body.naturalLanguage === 'string'
              ? sanitizeNoEmDashes(body.naturalLanguage.trim())
              : undefined,
          enabled:
            typeof body.enabled === 'boolean' ? body.enabled : undefined,
        });
      } else {
        updated = await ctx.toggleRule(
          id,
          typeof body.enabled === 'boolean' ? body.enabled : undefined
        );
      }

      if (!updated) {
        res.status(404).json({ error: `Rule not found: ${id}` });
        return;
      }
      res.json(updated);
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  router.delete('/rules/:id', async (req: Request, res: Response) => {
    try {
      const deleted = await ctx.deleteRule(req.params.id);
      if (!deleted) {
        res.status(404).json({ error: `Rule not found: ${req.params.id}` });
        return;
      }
      res.json({ ok: true, id: req.params.id });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // POST /api/agent/test-key
  router.post('/test-key', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Partial<TestKeyRequest>;
      const result = await testAnthropicKey(
        typeof body.apiKey === 'string' ? body.apiKey : '',
        typeof body.model === 'string' ? body.model : undefined
      );
      res.json(result);
    } catch (err) {
      res.status(500).json({
        ok: false,
        message: getErrorMessage(err),
        model: 'claude-sonnet-4-20250514',
      });
    }
  });

  return router;
}
