import type {
  EmailAttachment,
  EmailMessage,
  EmailThread,
  GmailAccount,
  PriorityBucket,
  QuickActionChip,
  ReceiptInfo,
} from '../../shared/types.js';

// Lightweight local classifier applied to freshly synced live Gmail threads
// so they immediately light up Prism's Pulse, Constellation, Stream, and Vault lenses.
export function classifySyncedThread(
  account: GmailAccount,
  threadId: string,
  subject: string,
  messages: EmailMessage[],
  rawLabels: string[] = [],
): EmailThread {
  const sorted = [...messages].sort(
    (a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime(),
  );
  const latest = sorted[sorted.length - 1];
  const combinedText = `${subject} ${latest?.bodyText ?? latest?.snippet ?? ''}`;
  const lower = combinedText.toLowerCase();
  const fromLower = (latest?.fromEmail ?? '').toLowerCase();
  const upperLabels = rawLabels.map((l) => l.toUpperCase());

  const isArchived =
    upperLabels.length > 0 &&
    !upperLabels.includes('INBOX') &&
    !upperLabels.includes('SENT');
  const isUnread = sorted.some((m) => m.isUnread);
  const isStarred = upperLabels.includes('STARRED');

  // Extract dollar amount / receipt metadata if present
  const receiptInfo = detectReceipt(subject, latest?.bodyText ?? '', latest?.fromName ?? '', fromLower);
  const isNewsletter =
    upperLabels.includes('CATEGORY_PROMOTIONS') ||
    /unsubscribe|view in browser|weekly digest|edition #|substack|newsletter|morning brief/.test(
      lower,
    ) ||
    /newsletter|digest|noreply|news@|editorial@/.test(fromLower);

  const hasQuestionOrAsk =
    /\?|please confirm|can you|could you|let me know|need your|sign off|approve|by today|by tomorrow|eod|asap|deadline|rsvp/.test(
      lower,
    );
  const isWaitingOutbound = Boolean(latest?.isOutbound && sorted.length >= 1);

  let bucket: PriorityBucket = 'decision';
  let urgencyScore = 58;

  if (isArchived) {
    bucket = 'archived';
    urgencyScore = 15;
  } else if (receiptInfo) {
    bucket = 'paper_trail';
    urgencyScore = 32;
  } else if (isNewsletter) {
    bucket = 'feed';
    urgencyScore = 24;
  } else if (isWaitingOutbound) {
    bucket = 'waiting';
    urgencyScore = 60;
  } else if (hasQuestionOrAsk || isStarred) {
    bucket = 'decision';
    urgencyScore = isUnread ? 78 : 66;
    if (/urgent|asap|today|eod|deadline|contract|wire|sign/.test(lower)) {
      urgencyScore = Math.min(95, urgencyScore + 14);
    }
  } else {
    bucket = isUnread ? 'decision' : 'waiting';
    urgencyScore = isUnread ? 62 : 44;
  }

  const distilledAsk = extractDistilledAsk(subject, latest?.bodyText ?? latest?.snippet ?? '', bucket);
  const aiSummaryBullets = buildSummaryBullets(latest?.bodyText ?? latest?.snippet ?? '', subject);
  const quickActions = buildQuickActions(bucket, subject);

  const participantMap = new Map<string, { name: string; email: string }>();
  for (const m of sorted) {
    if (m.fromEmail) {
      participantMap.set(m.fromEmail.toLowerCase(), {
        name: m.fromName || m.fromEmail.split('@')[0],
        email: m.fromEmail,
      });
    }
  }

  const normalizedLabels = rawLabels
    .filter((l) => !['INBOX', 'UNREAD', 'STARRED', 'SENT', 'IMPORTANT'].includes(l.toUpperCase()))
    .slice(0, 4);

  return {
    id: threadId,
    accountId: account.id,
    accountColor: account.color,
    accountLabel: account.label,
    accountEmail: account.email,
    subject: subject || '(No subject)',
    snippet: (latest?.snippet || latest?.bodyText || '').slice(0, 180).replace(/\s+/g, ' ').trim(),
    participants: Array.from(participantMap.values()),
    messageCount: sorted.length,
    lastMessageAt: latest?.sentAt ?? new Date().toISOString(),
    isUnread,
    isStarred,
    isArchived,
    isSnoozedUntil: null,
    labels: normalizedLabels,
    bucket,
    urgencyScore,
    distilledAsk,
    aiSummaryBullets,
    deadlineAt: null,
    deadlineLabel: detectDeadlineLabel(lower),
    quickActions,
    receiptInfo,
    relatedThreadIds: [],
    senderTrust: isNewsletter ? 'feed' : 'approved',
  };
}

function detectReceipt(
  subject: string,
  body: string,
  fromName: string,
  fromEmail: string,
): ReceiptInfo | null {
  const combined = `${subject}\n${body}`;
  const lower = combined.toLowerCase();
  const isReceiptSignal =
    /receipt|invoice|order confirm|payment received|billing statement|itinerary|flight confirm|booking confirm|charged|amount due|total paid/.test(
      lower,
    );
  if (!isReceiptSignal) return null;

  const amountMatch = combined.match(/\$\s?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?|[0-9]+(?:\.[0-9]{2})?)/);
  const amount = amountMatch ? Number(amountMatch[1].replace(/,/g, '')) : 0;

  const invoiceMatch = combined.match(/(?:invoice|order|confirmation|ref)\s*#?:?\s*([A-Z0-9-]{4,20})/i);
  const vendor =
    fromName?.replace(/billing|receipts|no-reply|noreply|support/gi, '').trim() ||
    (fromEmail.split('@')[1]?.split('.')[0] ?? 'Vendor').replace(/^\w/, (c) => c.toUpperCase());

  let category = 'Purchases';
  if (/flight|airline|hotel|airbnb|delta|united|amtrak|itinerary|boarding/.test(lower)) {
    category = 'Travel';
  } else if (/aws|vercel|github|anthropic|openai|figma|linear|stripe|cloud|subscription/.test(lower)) {
    category = 'SaaS & Cloud';
  } else if (/invoice|retainer|net 15|net 30|statement/.test(lower)) {
    category = 'Invoices';
  }

  return {
    vendor: vendor || 'Merchant',
    amount,
    currency: 'USD',
    category,
    invoiceNumber: invoiceMatch?.[1],
  };
}

function extractDistilledAsk(subject: string, body: string, bucket: PriorityBucket): string | null {
  if (bucket === 'feed' || bucket === 'paper_trail' || bucket === 'archived') {
    return null;
  }
  const sentences = body
    .replace(/\r/g, '\n')
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 18 && s.length < 200);

  const askSentence = sentences.find(
    (s) =>
      s.endsWith('?') ||
      /please|could you|can you|confirm|approve|let me know|send over|review/.test(s.toLowerCase()),
  );
  if (askSentence) {
    return askSentence.slice(0, 140);
  }
  return `Review and respond to "${subject.slice(0, 80)}"`;
}

function buildSummaryBullets(body: string, subject: string): string[] {
  const clean = body
    .replace(/\r/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 25 && !line.startsWith('>') && !/^on .+ wrote:$/i.test(line));

  if (clean.length === 0) {
    return [`Thread regarding ${subject || 'incoming message'}.`];
  }
  return clean.slice(0, 2).map((line) => (line.length > 140 ? `${line.slice(0, 137)}...` : line));
}

function detectDeadlineLabel(lower: string): string | null {
  if (/today|eod|end of day|this afternoon/.test(lower)) return 'Today';
  if (/tomorrow/.test(lower)) return 'Tomorrow';
  if (/by friday|this friday/.test(lower)) return 'Friday';
  if (/by monday/.test(lower)) return 'Monday';
  return null;
}

function buildQuickActions(bucket: PriorityBucket, subject: string): QuickActionChip[] {
  if (bucket === 'decision') {
    return [
      { id: 'qa-reply', label: 'Draft Reply', kind: 'reply', draftHint: `Reply cleanly to "${subject}"` },
      { id: 'qa-approve', label: 'Confirm & Approve', kind: 'approve', draftHint: 'Confirm approval and next steps' },
      { id: 'qa-snooze', label: 'Snooze', kind: 'snooze' },
    ];
  }
  if (bucket === 'waiting') {
    return [
      { id: 'qa-nudge', label: 'Draft Follow-up', kind: 'nudge', draftHint: 'Write a brief, polite follow-up' },
      { id: 'qa-archive', label: 'Archive', kind: 'archive' },
    ];
  }
  return [{ id: 'qa-archive', label: 'Archive', kind: 'archive' }];
}

export function parseAttachmentsSummary(attachments: EmailAttachment[]): EmailAttachment[] {
  return attachments.map((a, idx) => ({
    id: a.id || `att-${idx + 1}`,
    filename: a.filename || `attachment-${idx + 1}`,
    mimeType: a.mimeType || 'application/octet-stream',
    sizeBytes: Number.isFinite(a.sizeBytes) ? a.sizeBytes : 0,
  }));
}
