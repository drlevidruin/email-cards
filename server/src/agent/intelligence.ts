// Intelligence engine: Briefing synthesis, Constellation layout & cross-account linking,
// Natural-language thread filtering, multi-tone reply drafting, and thread summarization.
// Every function runs instantly in Local Mode and upgrades seamlessly to Claude when configured.

import type {
  BriefingData,
  ConstellationGraph,
  ConstellationLink,
  ConstellationNode,
  DraftItem,
  DraftReplyRequest,
  DraftTone,
  EmailThread,
  ExtractedTask,
  GmailAccount,
  NlFilterResponse,
  PriorityBucket,
  SummarizeThreadResponse,
} from '../../../shared/types.js';
import {
  resolveClaudeConfig,
  sanitizeNoEmDashes,
  sendClaudeJson,
  sendClaudeMessage,
  extractTextFromBlocks,
} from './claudeClient.js';
import type { AgentContext } from './types.js';

interface BriefingCacheEntry {
  key: string;
  expiresAt: number;
  data: BriefingData;
}

let briefingCache: BriefingCacheEntry | null = null;
const BRIEFING_TTL_MS = 180_000;

const GENERIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'me.com',
  'proton.me',
  'protonmail.com',
  'fastmail.com',
  'hey.com',
]);

const STOPWORDS = new Set([
  'a', 'am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is',
  'it', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we',
  'about', 'after', 'again', 'against', 'all', 'also', 'and', 'any', 'are',
  'because', 'been', 'before', 'being', 'between', 'both', 'but', 'can',
  'could', 'did', 'does', 'doing', 'done', 'down', 'during', 'each', 'email',
  'emails', 'everything', 'find', 'for', 'from', 'fwd', 'get', 'got', 'have',
  'has', 'had', 'here', 'her', 'his', 'how', 'inbox', 'into', 'its', 'just',
  'know', 'like', 'list', 'look', 'mail', 'make', 'me', 'messages', 'more',
  'most', 'much', 'must', 'my', 'need', 'needs', 'new', 'not', 'now', 'off',
  'old', 'only', 'open', 'our', 'out', 'over', 'please', 'quick', 're',
  'really', 'regarding', 'reply', 'see', 'send', 'sent', 'should', 'show',
  'some', 'still', 'sure', 'take', 'than', 'that', 'the', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'thread', 'threads',
  'through', 'time', 'today', 'tomorrow', 'too', 'under', 'until', 'update',
  'very', 'want', 'was', 'week', 'were', 'what', 'when', 'where', 'which',
  'while', 'who', 'will', 'with', 'would', 'you', 'your',
]);

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function getTimeOfDayGreeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning.';
  if (hour < 17) return 'Good afternoon.';
  return 'Good evening.';
}

function extractDomain(email: string): string {
  const parts = email.toLowerCase().split('@');
  return parts.length === 2 ? parts[1].trim() : '';
}

function getSenderInfo(thread: EmailThread): { name: string; email: string } {
  const accountEmailLower = thread.accountEmail.toLowerCase();
  const external = thread.participants.find(
    (p) => p.email.toLowerCase() !== accountEmailLower
  );
  if (external) {
    return {
      name: external.name || external.email.split('@')[0],
      email: external.email,
    };
  }
  const first = thread.participants[0];
  if (first) {
    return {
      name: first.name || first.email.split('@')[0],
      email: first.email,
    };
  }
  return { name: 'Sender', email: thread.accountEmail };
}

function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

function formatMoney(amount: number, currency = 'USD'): string {
  const symbol = currency === 'EUR' ? 'EUR ' : currency === 'GBP' ? 'GBP ' : '$';
  return `${symbol}${amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

// ---------------------------------------------------------------------------
// 1. Executive Briefing (Pulse Lens)
// ---------------------------------------------------------------------------

export async function generateBriefing(
  ctx: AgentContext,
  options?: { refresh?: boolean; accountId?: string }
): Promise<BriefingData> {
  const accountFilter =
    options?.accountId && options.accountId !== 'all'
      ? options.accountId
      : undefined;

  const [allThreads, commitments, screener, claudeConfig] = await Promise.all([
    ctx.getThreads({ includeArchived: true }),
    ctx.getCommitments(),
    ctx.getScreener(),
    resolveClaudeConfig(ctx),
  ]);

  const scopedThreads = accountFilter
    ? allThreads.filter((t) => t.accountId === accountFilter)
    : allThreads;
  const activeThreads = scopedThreads.filter((t) => !t.isArchived);
  const scopedCommitments = accountFilter
    ? commitments.filter((c) => c.accountId === accountFilter)
    : commitments;
  const scopedScreener = accountFilter
    ? screener.filter((s) => s.accountId === accountFilter)
    : screener;

  const decisions = activeThreads
    .filter((t) => t.bucket === 'decision')
    .sort((a, b) => b.urgencyScore - a.urgencyScore);

  const openPromises = scopedCommitments.filter(
    (c) => c.status !== 'resolved' && c.direction === 'you_promised'
  );
  const waitingOnItems = scopedCommitments.filter(
    (c) => c.status !== 'resolved' && c.direction === 'waiting_on_them'
  );
  const waitingBucketCount = activeThreads.filter(
    (t) => t.bucket === 'waiting'
  ).length;
  const clearedNoise = scopedThreads.filter(
    (t) =>
      t.isArchived || t.bucket === 'feed' || t.bucket === 'paper_trail'
  ).length;
  const totalUnread = activeThreads.filter((t) => t.isUnread).length;
  const screenerPending = scopedScreener.filter(
    (s) => s.status === 'pending'
  ).length;

  const stats: BriefingData['stats'] = {
    decisions: decisions.length,
    waitingOn: waitingOnItems.length > 0 ? waitingOnItems.length : waitingBucketCount,
    youPromised: openPromises.length,
    clearedNoise,
    totalUnread,
    screenerPending,
  };

  const cacheKey = `${accountFilter ?? 'all'}:${claudeConfig.configured ? claudeConfig.model : 'local'}:${decisions.length}:${totalUnread}:${openPromises.length}:${waitingOnItems.length}:${screenerPending}`;
  if (
    !options?.refresh &&
    briefingCache &&
    briefingCache.key === cacheKey &&
    briefingCache.expiresAt > Date.now()
  ) {
    return briefingCache.data;
  }

  const localBriefing = buildLocalBriefing(
    stats,
    decisions,
    openPromises,
    waitingOnItems,
    activeThreads
  );

  if (!claudeConfig.apiKey) {
    briefingCache = {
      key: cacheKey,
      expiresAt: Date.now() + 30_000,
      data: localBriefing,
    };
    return localBriefing;
  }

  try {
    const validThreadIds = new Set(activeThreads.map((t) => t.id));
    const compactDecisions = decisions.slice(0, 7).map((t) => ({
      threadId: t.id,
      account: t.accountLabel,
      from: getSenderInfo(t).name,
      subject: t.subject,
      urgencyScore: t.urgencyScore,
      deadline: t.deadlineLabel ?? null,
      ask: t.distilledAsk ?? t.snippet,
    }));

    const compactCommitments = [...openPromises, ...waitingOnItems]
      .slice(0, 6)
      .map((c) => ({
        threadId: c.threadId,
        direction: c.direction,
        counterparty: c.counterpartyName,
        summary: c.summary,
        dueLabel: c.dueLabel,
        daysOpen: c.daysOpen,
      }));

    interface ClaudeBriefingPayload {
      greeting?: string;
      headline?: string;
      highlights?: {
        threadId: string;
        title: string;
        reason: string;
        urgency: 'high' | 'medium';
      }[];
    }

    const parsed = await sendClaudeJson<ClaudeBriefingPayload>({
      apiKey: claudeConfig.apiKey,
      model: claudeConfig.model,
      maxTokens: 700,
      temperature: 0.3,
      system:
        'You are Prism, a calm executive chief-of-staff synthesizing a unified multi-account Gmail inbox. Return ONLY valid JSON matching {"greeting": string, "headline": string, "highlights": [{"threadId": string, "title": string, "reason": string, "urgency": "high" | "medium"}]}. Strict style rule: NEVER use em dashes or en dashes; use colons, commas, or hyphens instead. Keep greeting to 1 crisp sentence (max 10 words). Keep headline to 1 sharp sentence summarizing what truly matters right now. Provide 3 to 4 highlights referencing ONLY threadIds present in the input.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({
            timeGreeting: getTimeOfDayGreeting(),
            stats,
            topDecisions: compactDecisions,
            openCommitments: compactCommitments,
          }),
        },
      ],
    });

    if (parsed && parsed.greeting && parsed.headline) {
      const sanitizedHighlights = (parsed.highlights ?? [])
        .filter((h) => h && validThreadIds.has(h.threadId))
        .slice(0, 4)
        .map((h) => ({
          threadId: h.threadId,
          title: sanitizeNoEmDashes(String(h.title)),
          reason: sanitizeNoEmDashes(String(h.reason)),
          urgency: h.urgency === 'high' ? ('high' as const) : ('medium' as const),
        }));

      const claudeBriefing: BriefingData = {
        greeting: sanitizeNoEmDashes(parsed.greeting),
        headline: sanitizeNoEmDashes(parsed.headline),
        stats,
        highlights:
          sanitizedHighlights.length > 0
            ? sanitizedHighlights
            : localBriefing.highlights,
        generatedBy: 'claude',
        generatedAt: new Date().toISOString(),
      };

      briefingCache = {
        key: cacheKey,
        expiresAt: Date.now() + BRIEFING_TTL_MS,
        data: claudeBriefing,
      };
      return claudeBriefing;
    }
  } catch {
    // Gracefully fall back to local briefing on any transient API error
  }

  briefingCache = {
    key: cacheKey,
    expiresAt: Date.now() + 30_000,
    data: localBriefing,
  };
  return localBriefing;
}

function buildLocalBriefing(
  stats: BriefingData['stats'],
  decisions: EmailThread[],
  openPromises: Awaited<ReturnType<AgentContext['getCommitments']>>,
  waitingOnItems: Awaited<ReturnType<AgentContext['getCommitments']>>,
  activeThreads: EmailThread[]
): BriefingData {
  const timeGreeting = getTimeOfDayGreeting();
  const urgentCount = decisions.filter((t) => t.urgencyScore >= 80).length;

  let greeting: string;
  if (decisions.length === 0) {
    greeting = `${timeGreeting} Your decision deck is completely clear.`;
  } else if (urgentCount >= 2) {
    greeting = `${timeGreeting} ${urgentCount} urgent decisions need your voice first.`;
  } else if (decisions.length === 1) {
    greeting = `${timeGreeting} One focused decision is waiting on you.`;
  } else {
    greeting = `${timeGreeting} ${decisions.length} decisions are ready for a quick call.`;
  }

  const parts: string[] = [];
  if (decisions.length > 0) {
    const lead = decisions[0];
    const deadlineText = lead.deadlineLabel ? ` (${lead.deadlineLabel})` : '';
    parts.push(`Lead priority: ${lead.subject}${deadlineText}`);
  }
  if (openPromises.length > 0) {
    parts.push(
      `${openPromises.length} open ${openPromises.length === 1 ? 'promise' : 'promises'} to close`
    );
  }
  if (waitingOnItems.length > 0) {
    parts.push(`${waitingOnItems.length} threads waiting on replies`);
  }
  if (stats.clearedNoise > 0) {
    parts.push(`${stats.clearedNoise} feed and receipt items quietly routed out of your way`);
  }

  const headline =
    parts.length > 0
      ? `${parts.join('. ')}.`
      : 'All connected Gmail accounts are calm and triaged.';

  const highlights: BriefingData['highlights'] = [];
  const usedIds = new Set<string>();

  for (const thread of decisions.slice(0, 3)) {
    usedIds.add(thread.id);
    const sender = getSenderInfo(thread);
    const deadlineSuffix = thread.deadlineLabel
      ? ` Due: ${thread.deadlineLabel}.`
      : '';
    highlights.push({
      threadId: thread.id,
      title: thread.subject,
      reason: sanitizeNoEmDashes(
        `${sender.name} (${thread.accountLabel}): ${thread.distilledAsk ?? thread.snippet}${deadlineSuffix}`
      ),
      urgency: thread.urgencyScore >= 80 ? 'high' : 'medium',
    });
  }

  for (const promise of openPromises) {
    if (highlights.length >= 4) break;
    if (usedIds.has(promise.threadId)) continue;
    const exists = activeThreads.some((t) => t.id === promise.threadId);
    if (!exists) continue;
    usedIds.add(promise.threadId);
    highlights.push({
      threadId: promise.threadId,
      title: `Promise to ${promise.counterpartyName}`,
      reason: sanitizeNoEmDashes(
        `${promise.summary} (${promise.dueLabel}, open ${promise.daysOpen}d).`
      ),
      urgency: promise.daysOpen >= 3 ? 'high' : 'medium',
    });
  }

  return {
    greeting: sanitizeNoEmDashes(greeting),
    headline: sanitizeNoEmDashes(headline),
    stats,
    highlights,
    generatedBy: 'local',
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// 2. Constellation Spatial Universe (Constellation Lens)
// ---------------------------------------------------------------------------

type RingName = ConstellationNode['ring'];

const RING_BANDS: Record<RingName, { min: number; max: number; phase: number }> = {
  core: { min: 0.16, max: 0.27, phase: -Math.PI / 2 },
  orbit: { min: 0.39, max: 0.51, phase: -Math.PI / 3 },
  outer: { min: 0.63, max: 0.75, phase: -Math.PI / 5 },
  perimeter: { min: 0.84, max: 0.94, phase: -Math.PI / 7 },
};

function assignRing(thread: EmailThread): RingName {
  if (thread.bucket === 'decision' || thread.urgencyScore >= 82) {
    return 'core';
  }
  if (thread.bucket === 'waiting' || thread.urgencyScore >= 56) {
    return 'orbit';
  }
  if (
    thread.bucket === 'paper_trail' ||
    thread.bucket === 'screener' ||
    thread.urgencyScore >= 32
  ) {
    return 'outer';
  }
  return 'perimeter';
}

function deriveThreadTags(thread: EmailThread): string[] {
  const tags: string[] = [];
  const hay = `${thread.subject} ${thread.snippet} ${thread.distilledAsk ?? ''} ${thread.labels.join(' ')}`.toLowerCase();

  if (thread.deadlineLabel) tags.push('Deadline');
  if (thread.receiptInfo) {
    tags.push(thread.receiptInfo.category || 'Receipt');
  }
  if (/(\bcontract|\bagreement|\bsign\b|\bsigned\b|\bsignature|\bnda\b|\blegal\b|\bmsa\b|\bvenue\b)/.test(hay)) tags.push('Contract');
  if (/(\binvoice|\bbudget|\bpayment|\bwire\b|\bspend|\bpricing|\$[0-9])/.test(hay)) tags.push('Finance');
  if (/(\bflight|\bhotel|\btravel|\bitinerary|\bboarding|\btrip\b)/.test(hay)) tags.push('Travel');
  if (/(\bdesign|\bfigma|\bbrand|\blaunch|\bprototype|\bproduct)/.test(hay)) tags.push('Product');
  if (/(\binvestor|\badvisor|\bboard\b|\bfund\b|\bventure|\bpitch\b|\blp\b)/.test(hay)) tags.push('Advisory');
  if (/(\bnewsletter|\bdigest|\bedition|\bweekly|\bissue\b)/.test(hay)) tags.push('Digest');

  if (tags.length === 0) {
    const bucketNames: Record<PriorityBucket, string> = {
      decision: 'Decision',
      waiting: 'Waiting',
      feed: 'Feed',
      paper_trail: 'Paper Trail',
      screener: 'Screener',
      archived: 'Archived',
    };
    tags.push(bucketNames[thread.bucket]);
  }

  return Array.from(new Set(tags)).slice(0, 4);
}

function extractSignificantTerms(thread: EmailThread): Set<string> {
  const text = `${thread.subject} ${thread.distilledAsk ?? ''} ${thread.receiptInfo?.vendor ?? ''}`;
  const tokens = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
  return new Set(tokens);
}

export async function buildConstellationGraph(
  ctx: AgentContext,
  accountId?: string
): Promise<ConstellationGraph> {
  const allThreads = await ctx.getThreads({ includeArchived: false });
  const scoped =
    accountId && accountId !== 'all'
      ? allThreads.filter((t) => t.accountId === accountId)
      : allThreads;

  const grouped: Record<RingName, EmailThread[]> = {
    core: [],
    orbit: [],
    outer: [],
    perimeter: [],
  };

  for (const thread of scoped) {
    grouped[assignRing(thread)].push(thread);
  }

  const nodes: ConstellationNode[] = [];
  const ringOrder: RingName[] = ['core', 'orbit', 'outer', 'perimeter'];

  for (const ring of ringOrder) {
    const ringThreads = grouped[ring].sort((a, b) => {
      if (a.accountId !== b.accountId) {
        return a.accountId.localeCompare(b.accountId);
      }
      if (b.urgencyScore !== a.urgencyScore) {
        return b.urgencyScore - a.urgencyScore;
      }
      return a.id.localeCompare(b.id);
    });

    const count = ringThreads.length;
    const band = RING_BANDS[ring];
    const span = band.max - band.min;

    ringThreads.forEach((thread, idx) => {
      const hash = stableHash(thread.id);
      const step = count > 0 ? (Math.PI * 2) / count : 0;
      const jitterFraction = ((hash % 1000) / 1000 - 0.5) * 0.28;
      const rawAngle = band.phase + idx * step + step * jitterFraction;
      const angle = Number(
        (((rawAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)).toFixed(4)
      );

      // Alternate inner/outer radial track inside the ring band to give labels breathing room
      const radialPattern =
        count <= 3
          ? 0.5
          : idx % 2 === 0
            ? 0.25 + ((hash % 17) / 100)
            : 0.72 + ((hash % 17) / 100);
      const radius = Number(
        Math.min(band.max, Math.max(band.min, band.min + span * radialPattern)).toFixed(4)
      );

      const sender = getSenderInfo(thread);
      nodes.push({
        threadId: thread.id,
        accountId: thread.accountId,
        accountColor: thread.accountColor,
        accountLabel: thread.accountLabel,
        subject: thread.subject,
        fromName: sender.name,
        distilledAsk: thread.distilledAsk,
        bucket: thread.bucket,
        urgencyScore: thread.urgencyScore,
        isUnread: thread.isUnread,
        messageCount: thread.messageCount,
        lastMessageAt: thread.lastMessageAt,
        ring,
        angle,
        radius,
        tags: deriveThreadTags(thread),
      });
    });
  }

  const links = buildConstellationLinks(scoped);
  return { nodes, links };
}

function buildConstellationLinks(threads: EmailThread[]): ConstellationLink[] {
  const byId = new Map(threads.map((t) => [t.id, t]));
  const ownEmails = new Set(threads.map((t) => t.accountEmail.toLowerCase()));
  const ownDomains = new Set(
    threads
      .map((t) => extractDomain(t.accountEmail))
      .filter((d) => d && !GENERIC_EMAIL_DOMAINS.has(d))
  );

  const seenPairs = new Set<string>();
  const links: ConstellationLink[] = [];

  const pairKey = (a: string, b: string): string =>
    a < b ? `${a}::${b}` : `${b}::${a}`;

  const addLink = (
    a: EmailThread,
    b: EmailThread,
    reason: string
  ): boolean => {
    if (a.id === b.id) return false;
    const key = pairKey(a.id, b.id);
    if (seenPairs.has(key)) return false;
    seenPairs.add(key);
    links.push({
      sourceThreadId: a.id,
      targetThreadId: b.id,
      reason: sanitizeNoEmDashes(reason),
      crossAccount: a.accountId !== b.accountId,
    });
    return true;
  };

  // Pass 1: Explicit relatedThreadIds from thread records
  for (const thread of threads) {
    for (const relId of thread.relatedThreadIds ?? []) {
      const target = byId.get(relId);
      if (!target) continue;
      const reason = describePairRelation(thread, target, ownEmails, ownDomains);
      addLink(thread, target, reason);
    }
  }

  // Pass 2: Infer cross-account & semantic links (shared contacts, org domains, entities)
  const termSets = new Map<string, Set<string>>();
  const termDocFreq = new Map<string, number>();
  for (const t of threads) {
    const terms = extractSignificantTerms(t);
    termSets.set(t.id, terms);
    for (const term of terms) {
      termDocFreq.set(term, (termDocFreq.get(term) ?? 0) + 1);
    }
  }

  interface CandidateLink {
    a: EmailThread;
    b: EmailThread;
    score: number;
    reason: string;
  }
  const candidates: CandidateLink[] = [];

  for (let i = 0; i < threads.length; i++) {
    for (let j = i + 1; j < threads.length; j++) {
      const a = threads[i];
      const b = threads[j];
      if (seenPairs.has(pairKey(a.id, b.id))) continue;

      const crossAccount = a.accountId !== b.accountId;

      // Shared external participant
      const aContacts = new Map(
        a.participants
          .filter((p) => !ownEmails.has(p.email.toLowerCase()))
          .map((p) => [p.email.toLowerCase(), p.name])
      );
      let sharedContactName: string | null = null;
      for (const p of b.participants) {
        const lower = p.email.toLowerCase();
        if (!ownEmails.has(lower) && aContacts.has(lower)) {
          sharedContactName = p.name || aContacts.get(lower) || lower;
          break;
        }
      }
      if (sharedContactName) {
        candidates.push({
          a,
          b,
          score: crossAccount ? 100 : 65,
          reason: crossAccount
            ? `Cross-account contact: ${sharedContactName}`
            : `Shared contact: ${sharedContactName}`,
        });
        continue;
      }

      // Shared external organization domain
      const aDomains = new Set(
        a.participants
          .map((p) => extractDomain(p.email))
          .filter(
            (d) => d && !GENERIC_EMAIL_DOMAINS.has(d) && !ownDomains.has(d)
          )
      );
      let sharedOrg: string | null = null;
      for (const p of b.participants) {
        const dom = extractDomain(p.email);
        if (dom && aDomains.has(dom)) {
          sharedOrg = dom;
          break;
        }
      }
      if (sharedOrg) {
        candidates.push({
          a,
          b,
          score: crossAccount ? 85 : 50,
          reason: crossAccount
            ? `Cross-account org: ${sharedOrg}`
            : `Same organization: ${sharedOrg}`,
        });
        continue;
      }

      // Shared vendor in receipt info
      if (
        a.receiptInfo?.vendor &&
        b.receiptInfo?.vendor &&
        a.receiptInfo.vendor.toLowerCase() === b.receiptInfo.vendor.toLowerCase()
      ) {
        candidates.push({
          a,
          b,
          score: crossAccount ? 80 : 45,
          reason: `Same vendor: ${a.receiptInfo.vendor}`,
        });
        continue;
      }

      // Shared rare significant topic keywords (appearing in <= 4 threads)
      const aTerms = termSets.get(a.id) ?? new Set<string>();
      const bTerms = termSets.get(b.id) ?? new Set<string>();
      const rareShared: string[] = [];
      for (const term of aTerms) {
        if (bTerms.has(term) && (termDocFreq.get(term) ?? 99) <= 4) {
          rareShared.push(term);
        }
      }
      if (rareShared.length >= 2 || (crossAccount && rareShared.length >= 1 && rareShared[0].length >= 6)) {
        const label = rareShared
          .slice(0, 2)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' & ');
        candidates.push({
          a,
          b,
          score: (crossAccount ? 60 : 30) + rareShared.length * 10,
          reason: crossAccount
            ? `Cross-account topic: ${label}`
            : `Related topic: ${label}`,
        });
      }
    }
  }

  candidates.sort((x, y) => y.score - x.score);
  const maxTotalLinks = Math.max(links.length + 8, 22);
  for (const c of candidates) {
    if (links.length >= maxTotalLinks) break;
    addLink(c.a, c.b, c.reason);
  }

  return links;
}

function describePairRelation(
  a: EmailThread,
  b: EmailThread,
  ownEmails: Set<string>,
  ownDomains: Set<string>
): string {
  const cross = a.accountId !== b.accountId;

  const aContacts = new Set(
    a.participants
      .filter((p) => !ownEmails.has(p.email.toLowerCase()))
      .map((p) => p.email.toLowerCase())
  );
  for (const p of b.participants) {
    if (aContacts.has(p.email.toLowerCase())) {
      return cross
        ? `Cross-account thread with ${p.name || p.email}`
        : `Same contact: ${p.name || p.email}`;
    }
  }

  const aTerms = extractSignificantTerms(a);
  const bTerms = extractSignificantTerms(b);
  const shared: string[] = [];
  for (const term of aTerms) {
    if (bTerms.has(term)) shared.push(term);
  }
  if (shared.length > 0) {
    const topic = shared
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' & ');
    return cross ? `Cross-account link: ${topic}` : `Related: ${topic}`;
  }

  const aDomains = new Set(
    a.participants
      .map((p) => extractDomain(p.email))
      .filter((d) => d && !GENERIC_EMAIL_DOMAINS.has(d) && !ownDomains.has(d))
  );
  for (const p of b.participants) {
    const dom = extractDomain(p.email);
    if (dom && aDomains.has(dom)) {
      return cross ? `Cross-account org: ${dom}` : `Same org: ${dom}`;
    }
  }

  return cross
    ? `Linked across ${a.accountLabel} & ${b.accountLabel}`
    : 'Related conversation';
}

// ---------------------------------------------------------------------------
// 3. Natural Language Filter / Constellation Spotlight
// ---------------------------------------------------------------------------

export interface LocalSearchResult {
  threads: EmailThread[];
  explanation: string;
  suggestedViewName: string;
  filterSpec: Record<string, unknown>;
}

export function localSearchThreads(
  threads: EmailThread[],
  accounts: GmailAccount[],
  query: string
): LocalSearchResult {
  const raw = query.trim();
  const q = raw.toLowerCase();

  if (!q) {
    return {
      threads: threads.filter((t) => !t.isArchived),
      explanation: 'Showing all active threads across connected accounts.',
      suggestedViewName: 'All Active Mail',
      filterSpec: { query: '' },
    };
  }

  const filterSpec: Record<string, unknown> = { query: raw };
  const reasons: string[] = [];

  // Detect account mentions
  const matchedAccountIds = new Set<string>();
  for (const acc of accounts) {
    const labelLower = acc.label.toLowerCase();
    const emailLower = acc.email.toLowerCase();
    const emailPrefix = emailLower.split('@')[0];
    if (
      (labelLower.length >= 3 && q.includes(labelLower)) ||
      q.includes(emailLower) ||
      (emailPrefix.length >= 4 && q.includes(emailPrefix))
    ) {
      matchedAccountIds.add(acc.id);
    }
  }
  if (matchedAccountIds.size > 0) {
    filterSpec.accountIds = Array.from(matchedAccountIds);
    const labels = accounts
      .filter((a) => matchedAccountIds.has(a.id))
      .map((a) => a.label);
    reasons.push(`account in [${labels.join(', ')}]`);
  }

  // Detect structured intents
  const wantsUrgent = /\b(urgent|priority|critical|asap|decision|decisions|important|action|now)\b/.test(q);
  const wantsDeadline = /\b(deadline|deadlines|due|today|tomorrow|this week|expiring|friday|monday)\b/.test(q);
  const wantsMoney = /\b(money|receipt|receipts|invoice|invoices|spend|spent|cost|budget|bill|bills|payment|payments|pricing|expense|expenses|dollar|dollars|\$)\b/.test(q);
  const wantsContract = /\b(contract|contracts|legal|nda|agreement|msa|sign|signature|venue|proposal|term sheet)\b/.test(q);
  const wantsNewsletter = /\b(newsletter|newsletters|feed|digest|digests|promo|promos|marketing|unsubscribe|noise|clutter|low priority|perimeter)\b/.test(q);
  const wantsWaiting = /\b(waiting|follow up|follow-up|followup|nudge|pending|promised|promise|commitments|open loop|open loops)\b/.test(q);
  const wantsScreener = /\b(screener|first-time|first time|unknown|cold|unapproved|new sender|new senders)\b/.test(q);
  const wantsTravel = /\b(travel|flight|flights|hotel|trip|itinerary|booking|airline|conference)\b/.test(q);
  const wantsUnread = /\bunread\b/.test(q);
  const wantsStarred = /\bstarred|flagged\b/.test(q);
  const wantsAttachments = /\b(attachment|attachments|pdf|file|files|document|documents|deck|spreadsheet)\b/.test(q);
  const wantsAsks = /\b(ask|asks|question|questions|request|requests|approve|approval|needs my)\b/.test(q);

  // Detect amount threshold: "over $100", "> 500", "under $50"
  const overMatch = q.match(/(?:over|above|more than|>=|>)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  const underMatch = q.match(/(?:under|below|less than|<=|<)\s*\$?\s*(\d+(?:,\d{3})*(?:\.\d+)?)/);
  const minAmount = overMatch ? Number(overMatch[1].replace(/,/g, '')) : null;
  const maxAmount = underMatch ? Number(underMatch[1].replace(/,/g, '')) : null;

  if (wantsUrgent) filterSpec.urgent = true;
  if (wantsDeadline) filterSpec.hasDeadline = true;
  if (wantsMoney) filterSpec.money = true;
  if (wantsContract) filterSpec.contract = true;
  if (wantsNewsletter) filterSpec.bucket = 'feed';
  if (wantsWaiting) filterSpec.waiting = true;
  if (wantsScreener) filterSpec.bucket = 'screener';
  if (wantsTravel) filterSpec.travel = true;
  if (wantsUnread) filterSpec.unreadOnly = true;
  if (wantsStarred) filterSpec.starredOnly = true;
  if (minAmount !== null) filterSpec.minAmount = minAmount;
  if (maxAmount !== null) filterSpec.maxAmount = maxAmount;

  // Free keywords (excluding intent trigger words and stopwords)
  const intentWords = new Set([
    'urgent', 'priority', 'critical', 'asap', 'decision', 'decisions', 'important',
    'action', 'deadline', 'deadlines', 'due', 'money', 'receipt', 'receipts',
    'invoice', 'invoices', 'spend', 'spent', 'cost', 'budget', 'bill', 'bills',
    'payment', 'payments', 'pricing', 'expense', 'expenses', 'dollar', 'dollars',
    'contract', 'contracts', 'newsletter', 'newsletters', 'feed', 'digest', 'digests',
    'promo', 'promos', 'marketing', 'noise', 'clutter', 'perimeter', 'waiting',
    'nudge', 'pending', 'promised', 'promise', 'commitments', 'screener', 'unknown',
    'travel', 'flight', 'flights', 'hotel', 'trip', 'unread', 'starred', 'flagged',
    'attachment', 'attachments', 'ask', 'asks', 'open', 'involving', 'archive',
    'clean', 'sweep', 'above', 'over', 'under', 'below', 'more', 'less', 'than',
    'everything', 'show', 'find', 'filter', 'highlight', 'emails', 'threads',
  ]);
  const freeTerms = q
    .replace(/[^a-z0-9@\s.-]/g, ' ')
    .split(/\s+/)
    .filter(
      (t) =>
        t.length >= 2 &&
        !STOPWORDS.has(t) &&
        !intentWords.has(t) &&
        !/^\d+$/.test(t) &&
        !accounts.some((a) => a.label.toLowerCase() === t)
    );

  const hasAnyStructuredIntent =
    wantsUrgent ||
    wantsDeadline ||
    wantsMoney ||
    wantsContract ||
    wantsNewsletter ||
    wantsWaiting ||
    wantsScreener ||
    wantsTravel ||
    wantsUnread ||
    wantsStarred ||
    wantsAttachments ||
    wantsAsks ||
    minAmount !== null ||
    maxAmount !== null;

  const activeThreads = threads.filter((t) => !t.isArchived);
  const scored: { thread: EmailThread; score: number }[] = [];

  for (const thread of activeThreads) {
    if (matchedAccountIds.size > 0 && !matchedAccountIds.has(thread.accountId)) {
      continue;
    }
    if (wantsUnread && !thread.isUnread) continue;
    if (wantsStarred && !thread.isStarred) continue;

    let score = 0;
    const participantText = thread.participants
      .map((p) => `${p.name} ${p.email}`)
      .join(' ');
    const messageBodyText = (thread.messages ?? [])
      .map((m) => m.bodyText)
      .join(' ');
    const fullText = `${thread.subject} ${thread.snippet} ${thread.distilledAsk ?? ''} ${thread.aiSummaryBullets.join(' ')} ${thread.labels.join(' ')} ${participantText} ${thread.receiptInfo?.vendor ?? ''} ${thread.receiptInfo?.category ?? ''} ${messageBodyText}`.toLowerCase();

    if (wantsUrgent) {
      if (thread.bucket === 'decision' || thread.urgencyScore >= 75) score += 30;
    }
    if (wantsDeadline) {
      if (thread.deadlineLabel || thread.deadlineAt) score += 35;
      if (q.includes('today') && thread.deadlineLabel?.toLowerCase().includes('today')) {
        score += 25;
      }
      if (q.includes('tomorrow') && thread.deadlineLabel?.toLowerCase().includes('tomorrow')) {
        score += 25;
      }
    }
    if (wantsMoney) {
      if (thread.receiptInfo) score += 40;
      if (thread.bucket === 'paper_trail') score += 20;
      if (/\$[0-9]|\b(invoice|invoices|budget|payment|payments|wire|pricing|billing|subscription|subscriptions|receipt|receipts)\b/.test(fullText)) {
        score += 25;
      }
    }
    if (minAmount !== null || maxAmount !== null) {
      const amount = thread.receiptInfo?.amount ?? extractDollarAmount(fullText);
      if (amount !== null) {
        const passMin = minAmount === null || amount >= minAmount;
        const passMax = maxAmount === null || amount <= maxAmount;
        if (passMin && passMax) {
          score += 50;
        } else {
          continue;
        }
      } else {
        continue;
      }
    }
    if (wantsContract) {
      if (/\b(contract|contracts|agreement|agreements|msa|nda|legal|venue|sign|signed|signing|signature|terms|proposal|redline|redlines)\b/.test(fullText)) {
        score += 40;
      }
    }
    if (wantsNewsletter) {
      if (thread.bucket === 'feed') score += 45;
      else if (thread.senderTrust === 'feed' || /\b(newsletter|newsletters|digest|edition|unsubscribe|weekly)\b/.test(fullText)) {
        score += 30;
      }
    }
    if (wantsWaiting) {
      if (thread.bucket === 'waiting') score += 40;
      if (/\b(waiting|follow up|following up|promised|circle back|checking in)\b/.test(fullText)) {
        score += 20;
      }
    }
    if (wantsScreener) {
      if (thread.bucket === 'screener' || thread.senderTrust === 'screener') {
        score += 45;
      }
    }
    if (wantsTravel) {
      if (
        thread.receiptInfo?.category.toLowerCase().includes('travel') ||
        /\b(flight|flights|hotel|airline|boarding|itinerary|booking|conference|travel|venue)\b/.test(fullText)
      ) {
        score += 40;
      }
    }
    if (wantsAttachments) {
      const hasAtt = (thread.messages ?? []).some((m) => m.attachments.length > 0);
      if (hasAtt || /\.(pdf|docx|xlsx)\b|\b(attached|attachment|attachments|deck|invoice)\b/.test(fullText)) {
        score += 35;
      }
    }
    if (wantsAsks) {
      if (thread.distilledAsk && thread.bucket === 'decision') score += 35;
      else if (thread.distilledAsk) score += 15;
    }

    // Free keyword matching
    let freeMatches = 0;
    for (const term of freeTerms) {
      if (thread.subject.toLowerCase().includes(term)) {
        score += 28;
        freeMatches++;
      } else if (participantText.toLowerCase().includes(term)) {
        score += 24;
        freeMatches++;
      } else if (fullText.includes(term)) {
        score += 14;
        freeMatches++;
      }
    }

    // If only account/unread/starred filters were specified, include all matching threads
    if (!hasAnyStructuredIntent && freeTerms.length === 0) {
      score += 20 + Math.round(thread.urgencyScore / 10);
    } else if (wantsUnread && !wantsUrgent && !wantsMoney && !wantsContract && !wantsNewsletter && !wantsWaiting && !wantsScreener && !wantsTravel && !wantsDeadline && !wantsAsks && freeTerms.length === 0) {
      score += 20 + Math.round(thread.urgencyScore / 10);
    } else if (wantsStarred && freeTerms.length === 0 && !wantsUrgent && !wantsMoney) {
      score += 20;
    }

    if (score > 0 && (freeTerms.length === 0 || freeMatches > 0 || hasAnyStructuredIntent)) {
      scored.push({ thread, score: score + thread.urgencyScore * 0.05 });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.map((s) => s.thread);

  if (wantsUrgent) reasons.push('high-priority decisions');
  if (wantsDeadline) reasons.push('upcoming deadlines');
  if (wantsMoney) reasons.push('receipts, invoices, or spend');
  if (wantsContract) reasons.push('contracts and agreements');
  if (wantsNewsletter) reasons.push('newsletters and feed');
  if (wantsWaiting) reasons.push('waiting and open loops');
  if (wantsScreener) reasons.push('first-time screener senders');
  if (wantsTravel) reasons.push('travel and bookings');
  if (wantsUnread) reasons.push('unread status');
  if (wantsAsks) reasons.push('open asks');
  if (freeTerms.length > 0) reasons.push(`keywords "${freeTerms.join(', ')}"`);

  const criteriaDesc = reasons.length > 0 ? reasons.join(', ') : `"${raw}"`;
  const explanation =
    matched.length > 0
      ? `Matched ${matched.length} ${matched.length === 1 ? 'thread' : 'threads'} based on ${criteriaDesc}.`
      : `No active threads matched ${criteriaDesc}. Try broadening your query or switching to All Accounts.`;

  const suggestedViewName = buildSuggestedViewName(raw);

  return {
    threads: matched,
    explanation: sanitizeNoEmDashes(explanation),
    suggestedViewName,
    filterSpec,
  };
}

function extractDollarAmount(text: string): number | null {
  const m = text.match(/\$\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  if (!m) return null;
  const val = Number(m[1].replace(/,/g, ''));
  return Number.isFinite(val) ? val : null;
}

function buildSuggestedViewName(query: string): string {
  const cleaned = query
    .replace(/^(show me|find|filter|highlight|list|all|everything involving|everything about|emails about|threads with)\s+/i, '')
    .trim();
  if (!cleaned) return 'Custom Smart View';
  const words = cleaned.split(/\s+/).slice(0, 4);
  const trailingJunk = new Set(['to', 'for', 'of', 'in', 'on', 'with', 'and', 'or', 'the', 'a', 'an']);
  while (words.length > 1 && trailingJunk.has(words[words.length - 1].toLowerCase())) {
    words.pop();
  }
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export async function nlFilterThreads(
  ctx: AgentContext,
  query: string,
  accountId?: string
): Promise<NlFilterResponse> {
  const [allThreads, accounts, claudeConfig] = await Promise.all([
    ctx.getThreads({ includeArchived: false }),
    ctx.getAccounts(),
    resolveClaudeConfig(ctx),
  ]);

  const scopedThreads =
    accountId && accountId !== 'all'
      ? allThreads.filter((t) => t.accountId === accountId)
      : allThreads;

  const localResult = localSearchThreads(scopedThreads, accounts, query);

  if (!claudeConfig.apiKey || !query.trim()) {
    return {
      threadIds: localResult.threads.map((t) => t.id),
      explanation: localResult.explanation,
      suggestedViewName: localResult.suggestedViewName,
      generatedBy: 'local',
    };
  }

  try {
    const validIds = new Set(scopedThreads.map((t) => t.id));
    const catalog = scopedThreads.slice(0, 60).map((t) => ({
      id: t.id,
      account: t.accountLabel,
      bucket: t.bucket,
      urgency: t.urgencyScore,
      unread: t.isUnread,
      from: getSenderInfo(t).name,
      subject: t.subject,
      ask: t.distilledAsk,
      deadline: t.deadlineLabel,
      receipt: t.receiptInfo
        ? `${t.receiptInfo.vendor} ${formatMoney(t.receiptInfo.amount, t.receiptInfo.currency)} (${t.receiptInfo.category})`
        : null,
      snippet: t.snippet.slice(0, 140),
    }));

    interface ClaudeFilterPayload {
      threadIds?: string[];
      explanation?: string;
      suggestedViewName?: string;
    }

    const parsed = await sendClaudeJson<ClaudeFilterPayload>({
      apiKey: claudeConfig.apiKey,
      model: claudeConfig.model,
      maxTokens: 600,
      temperature: 0.1,
      system:
        'You filter an email inbox using a natural language query. Return ONLY valid JSON: {"threadIds": string[], "explanation": string, "suggestedViewName": string}. Only include threadIds from the provided catalog. Never use em dashes.',
      messages: [
        {
          role: 'user',
          content: JSON.stringify({ query, threads: catalog }),
        },
      ],
    });

    if (parsed && Array.isArray(parsed.threadIds)) {
      const filteredIds = parsed.threadIds.filter((id) => validIds.has(id));
      return {
        threadIds: filteredIds,
        explanation: sanitizeNoEmDashes(
          parsed.explanation ||
            `Claude matched ${filteredIds.length} threads for "${query}".`
        ),
        suggestedViewName: sanitizeNoEmDashes(
          parsed.suggestedViewName || localResult.suggestedViewName
        ),
        generatedBy: 'claude',
      };
    }
  } catch {
    // Fall back cleanly to local semantic search
  }

  return {
    threadIds: localResult.threads.map((t) => t.id),
    explanation: localResult.explanation,
    suggestedViewName: localResult.suggestedViewName,
    generatedBy: 'local',
  };
}

// ---------------------------------------------------------------------------
// 4. Multi-Tone AI Reply Drafting (Saves to Approval Dock, NEVER auto-sends)
// ---------------------------------------------------------------------------

export async function draftReplyForThread(
  ctx: AgentContext,
  req: DraftReplyRequest
): Promise<DraftItem> {
  const thread = await ctx.getThreadById(req.threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${req.threadId}`);
  }

  const [accounts, claudeConfig] = await Promise.all([
    ctx.getAccounts(),
    resolveClaudeConfig(ctx),
  ]);

  const account = accounts.find((a) => a.id === thread.accountId);
  const tone: DraftTone = req.tone ?? 'direct';
  const instruction = (req.instruction ?? '').trim();

  // Pick reply recipient: latest inbound message sender, else external participant
  const messages = thread.messages ?? [];
  const lastInbound = [...messages].reverse().find((m) => !m.isOutbound);
  const fallbackSender = getSenderInfo(thread);
  const recipientEmail = lastInbound?.fromEmail || fallbackSender.email;
  const recipientName = lastInbound?.fromName || fallbackSender.name;
  const replySubject = /^re:/i.test(thread.subject)
    ? thread.subject
    : `Re: ${thread.subject}`;

  let bodyText = buildLocalDraftBody({
    thread,
    recipientName,
    tone,
    instruction,
    signature: account?.signature,
    senderDisplayName: account?.displayName ?? 'Alex',
  });

  if (claudeConfig.apiKey) {
    try {
      const messageContext = messages.slice(-4).map((m) => ({
        from: `${m.fromName} <${m.fromEmail}>`,
        sentAt: m.sentAt,
        body: m.bodyText.slice(0, 1200),
      }));

      const toneGuidance: Record<DraftTone, string> = {
        direct:
          'Direct, clear, zero filler, 2 to 4 crisp sentences that answer the core ask immediately.',
        warm:
          'Warm, human, appreciative, thoughtful while still clear on next steps.',
        executive:
          'Concise executive clarity: structured, decisive, crisp bullets if helpful, zero fluff.',
        decline:
          'Graceful, respectful, firm decline that preserves the relationship without over-explaining.',
      };

      const res = await sendClaudeMessage({
        apiKey: claudeConfig.apiKey,
        model: claudeConfig.model,
        maxTokens: 650,
        temperature: 0.4,
        system:
          'You draft ready-to-send email replies for Prism Mail. Output ONLY the plain-text email body (no subject line, no preamble, no markdown fences). Strict style invariant: NEVER use em dashes or en dashes; use colons, commas, or hyphens instead.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              senderIdentity: account
                ? {
                    name: account.displayName,
                    email: account.email,
                    label: account.label,
                    signature: account.signature ?? null,
                  }
                : null,
              replyingTo: { name: recipientName, email: recipientEmail },
              subject: thread.subject,
              distilledAsk: thread.distilledAsk,
              deadline: thread.deadlineLabel,
              tone,
              toneGuidance: toneGuidance[tone],
              userInstruction:
                instruction ||
                'Draft the most helpful, natural reply addressing the distilled ask directly.',
              recentMessages:
                messageContext.length > 0
                  ? messageContext
                  : [{ from: recipientName, body: thread.snippet }],
            }),
          },
        ],
      });

      const generated = extractTextFromBlocks(res.content);
      if (generated && generated.length >= 12) {
        bodyText = sanitizeNoEmDashes(generated);
      }
    } catch {
      // Retain high-quality local fallback draft
    }
  }

  const saved = await ctx.saveDraft({
    threadId: thread.id,
    accountId: thread.accountId,
    toEmails: [recipientEmail],
    subject: replySubject,
    bodyText: sanitizeNoEmDashes(bodyText),
    tone,
    status: 'pending_approval',
    scheduledFor: null,
    createdBy: 'agent',
  });

  return saved;
}

function buildLocalDraftBody(params: {
  thread: EmailThread;
  recipientName: string;
  tone: DraftTone;
  instruction: string;
  signature?: string;
  senderDisplayName: string;
}): string {
  const first = firstNameOf(params.recipientName);
  const ask = params.thread.distilledAsk || params.thread.subject;
  const signOffName = firstNameOf(params.senderDisplayName);
  const sig = params.signature?.trim()
    ? `\n\n${params.signature.trim()}`
    : `\n\nBest,\n${signOffName}`;

  if (params.instruction) {
    const cleanInstruction = params.instruction.replace(/\.$/, '');
    const normalizedSentence =
      cleanInstruction.charAt(0).toUpperCase() + cleanInstruction.slice(1);

    switch (params.tone) {
      case 'warm':
        return `Hi ${first},\n\nThanks so much for sending this over. ${normalizedSentence}. Let me know if anything else would be helpful on my end!${sig}`;
      case 'executive':
        return `${first},\n\nFollowing up on ${params.thread.subject}:\n- Decision: ${normalizedSentence}.\n- Next step: Please confirm once updated on your side.${sig}`;
      case 'decline':
        return `Hi ${first},\n\nThank you for reaching out about ${params.thread.subject}. ${normalizedSentence}, so I will need to pass on this for now. Wishing you the best with it and happy to stay in touch down the road.${sig}`;
      case 'direct':
      default:
        return `Hi ${first},\n\n${normalizedSentence}. Let me know if you need anything else from me to move forward.${sig}`;
    }
  }

  const deadlineNote = params.thread.deadlineLabel
    ? ` ahead of ${params.thread.deadlineLabel}`
    : '';

  switch (params.tone) {
    case 'warm':
      return `Hi ${first},\n\nThanks for the thoughtful note on ${params.thread.subject}. I reviewed the details around "${ask}" and everything looks solid on my side${deadlineNote}. Happy to jump on a quick call or finalize over email, whichever is easier for you.${sig}`;
    case 'executive':
      return `${first},\n\nReviewed ${params.thread.subject}.\n- Direction: Approved to proceed on "${ask}"${deadlineNote}.\n- Action needed: Please share the final confirmation once live.\n\nThanks,\n${signOffName}`;
    case 'decline':
      return `Hi ${first},\n\nThanks for thinking of me on ${params.thread.subject}. I took a close look, and given current commitments I will have to pass on this right now. Appreciate you sharing it and hope our paths cross on the next one.${sig}`;
    case 'direct':
    default:
      return `Hi ${first},\n\nThanks for flagging this. Looks good to move forward on "${ask}"${deadlineNote}. Send over the final step whenever ready and I will turn it around quickly.${sig}`;
  }
}

// ---------------------------------------------------------------------------
// 5. Thread Summarization & Task Extraction
// ---------------------------------------------------------------------------

export async function summarizeThread(
  ctx: AgentContext,
  threadId: string
): Promise<SummarizeThreadResponse> {
  const thread = await ctx.getThreadById(threadId);
  if (!thread) {
    throw new Error(`Thread not found: ${threadId}`);
  }

  const [existingTasks, claudeConfig] = await Promise.all([
    ctx.getTasks(threadId),
    resolveClaudeConfig(ctx),
  ]);

  let distilledAsk = thread.distilledAsk;
  let aiSummaryBullets =
    thread.aiSummaryBullets.length > 0
      ? [...thread.aiSummaryBullets]
      : buildLocalBullets(thread);
  let extractedTasks: ExtractedTask[] = [...existingTasks];
  let generatedBy: 'claude' | 'local' = 'local';

  if (claudeConfig.apiKey) {
    try {
      const messages = (thread.messages ?? []).slice(-6).map((m) => ({
        from: `${m.fromName} <${m.fromEmail}>`,
        sentAt: m.sentAt,
        body: m.bodyText.slice(0, 1500),
      }));

      interface ClaudeSummaryPayload {
        distilledAsk?: string | null;
        aiSummaryBullets?: string[];
        tasks?: {
          title: string;
          dueLabel?: string | null;
          priority: 'high' | 'medium' | 'low';
        }[];
      }

      const parsed = await sendClaudeJson<ClaudeSummaryPayload>({
        apiKey: claudeConfig.apiKey,
        model: claudeConfig.model,
        maxTokens: 700,
        temperature: 0.2,
        system:
          'You analyze an email thread and return ONLY valid JSON: {"distilledAsk": string | null, "aiSummaryBullets": string[], "tasks": [{"title": string, "dueLabel": string | null, "priority": "high" | "medium" | "low"}]}. Keep distilledAsk to 1 crisp sentence describing what the user needs to decide or do (or null if pure FYI). Provide 2 to 4 concise bullets. Extract only genuine actionable tasks. Never use em dashes.',
        messages: [
          {
            role: 'user',
            content: JSON.stringify({
              subject: thread.subject,
              accountLabel: thread.accountLabel,
              deadlineLabel: thread.deadlineLabel,
              messages:
                messages.length > 0
                  ? messages
                  : [{ from: getSenderInfo(thread).name, body: thread.snippet }],
            }),
          },
        ],
      });

      if (parsed && Array.isArray(parsed.aiSummaryBullets)) {
        distilledAsk = parsed.distilledAsk
          ? sanitizeNoEmDashes(parsed.distilledAsk)
          : null;
        aiSummaryBullets = parsed.aiSummaryBullets
          .slice(0, 4)
          .map((b) => sanitizeNoEmDashes(String(b)));
        generatedBy = 'claude';

        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          extractedTasks = await mergeExtractedTasks(
            ctx,
            thread,
            existingTasks,
            parsed.tasks
          );
        }
      }
    } catch {
      // Fall back to local extraction below
    }
  }

  if (generatedBy === 'local') {
    const localSummary = buildLocalThreadSummary(thread);
    distilledAsk = thread.distilledAsk ?? localSummary.distilledAsk;
    aiSummaryBullets =
      thread.aiSummaryBullets.length > 0
        ? thread.aiSummaryBullets
        : localSummary.bullets;

    if (extractedTasks.length === 0 && localSummary.suggestedTasks.length > 0) {
      extractedTasks = await mergeExtractedTasks(
        ctx,
        thread,
        existingTasks,
        localSummary.suggestedTasks
      );
    }
  }

  if (ctx.updateThreadIntelligence) {
    await ctx.updateThreadIntelligence(thread.id, {
      distilledAsk,
      aiSummaryBullets,
    });
  }

  return {
    threadId: thread.id,
    distilledAsk,
    aiSummaryBullets,
    extractedTasks,
    generatedBy,
  };
}

async function mergeExtractedTasks(
  ctx: AgentContext,
  thread: EmailThread,
  existingTasks: ExtractedTask[],
  proposed: {
    title: string;
    dueLabel?: string | null;
    priority: 'high' | 'medium' | 'low';
  }[]
): Promise<ExtractedTask[]> {
  const existingTitles = new Set(
    existingTasks.map((t) => t.title.trim().toLowerCase())
  );
  const result = [...existingTasks];

  for (const item of proposed.slice(0, 3)) {
    const cleanTitle = sanitizeNoEmDashes(item.title.trim());
    if (!cleanTitle || existingTitles.has(cleanTitle.toLowerCase())) continue;
    existingTitles.add(cleanTitle.toLowerCase());

    const draftTask: Omit<ExtractedTask, 'id'> = {
      threadId: thread.id,
      accountId: thread.accountId,
      title: cleanTitle,
      dueLabel: item.dueLabel ?? thread.deadlineLabel ?? null,
      completed: false,
      priority:
        item.priority === 'high' || item.priority === 'low'
          ? item.priority
          : 'medium',
    };

    if (ctx.saveTask) {
      const saved = await ctx.saveTask(draftTask);
      result.push(saved);
    } else {
      result.push({
        ...draftTask,
        id: `task_${thread.id}_${result.length + 1}`,
      });
    }
  }

  return result;
}

function buildLocalBullets(thread: EmailThread): string[] {
  const bullets: string[] = [];
  const sender = getSenderInfo(thread);

  if (thread.distilledAsk) {
    bullets.push(`Core ask from ${sender.name}: ${thread.distilledAsk}`);
  }
  if (thread.deadlineLabel) {
    bullets.push(`Time sensitivity: ${thread.deadlineLabel}.`);
  }
  if (thread.receiptInfo) {
    bullets.push(
      `Financial item: ${thread.receiptInfo.vendor} for ${formatMoney(thread.receiptInfo.amount, thread.receiptInfo.currency)} (${thread.receiptInfo.category}).`
    );
  }
  if (bullets.length < 2 && thread.snippet) {
    bullets.push(thread.snippet);
  }
  if (thread.messageCount > 1) {
    bullets.push(
      `Active conversation with ${thread.messageCount} messages in ${thread.accountLabel}.`
    );
  }

  return bullets.slice(0, 4).map(sanitizeNoEmDashes);
}

function buildLocalThreadSummary(thread: EmailThread): {
  distilledAsk: string | null;
  bullets: string[];
  suggestedTasks: {
    title: string;
    dueLabel?: string | null;
    priority: 'high' | 'medium' | 'low';
  }[];
} {
  const messages = thread.messages ?? [];
  const latestBody = messages[messages.length - 1]?.bodyText ?? thread.snippet;
  const sentences = latestBody
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 16 && s.length <= 220);

  const askSentence =
    sentences.find((s) =>
      /\?|please|could you|can you|need your|confirm|approve|sign|review|send over|let me know/i.test(
        s
      )
    ) ?? null;

  const distilledAsk = thread.distilledAsk ?? (askSentence ? sanitizeNoEmDashes(askSentence) : null);

  const bullets =
    thread.aiSummaryBullets.length > 0
      ? thread.aiSummaryBullets
      : buildLocalBullets(thread);

  const suggestedTasks: {
    title: string;
    dueLabel?: string | null;
    priority: 'high' | 'medium' | 'low';
  }[] = [];

  if (distilledAsk && (thread.bucket === 'decision' || thread.urgencyScore >= 70)) {
    suggestedTasks.push({
      title: `Respond to ${getSenderInfo(thread).name}: ${thread.subject}`,
      dueLabel: thread.deadlineLabel ?? null,
      priority: thread.urgencyScore >= 80 ? 'high' : 'medium',
    });
  } else if (thread.receiptInfo) {
    suggestedTasks.push({
      title: `Review ${thread.receiptInfo.vendor} ${formatMoney(thread.receiptInfo.amount, thread.receiptInfo.currency)} receipt`,
      dueLabel: thread.deadlineLabel ?? null,
      priority: 'low',
    });
  }

  return { distilledAsk, bullets, suggestedTasks };
}
