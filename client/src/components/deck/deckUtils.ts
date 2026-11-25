import type {
  DraftTone,
  EmailThread,
  QuickActionChip,
} from '../../lib/types';

export function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const mins = Math.floor(Math.abs(diffMs) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `$${amount.toFixed(2)}`;
  }
}

export function getInitials(name: string): string {
  const cleaned = name.replace(/["'<>]/g, '').trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function getPrimarySender(thread: EmailThread): {
  name: string;
  email: string;
} {
  if (thread.participants && thread.participants.length > 0) {
    return thread.participants[0];
  }
  if (thread.messages && thread.messages.length > 0) {
    const latestInbound = [...thread.messages]
      .reverse()
      .find((m) => !m.isOutbound);
    const msg = latestInbound ?? thread.messages[thread.messages.length - 1];
    return { name: msg.fromName, email: msg.fromEmail };
  }
  return { name: thread.accountLabel, email: thread.accountEmail };
}

export function formatDeadlineLabel(label?: string | null): string | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;
  if (/^due\b/i.test(trimmed)) return trimmed;
  return `Due ${trimmed}`;
}

export function getToneForChip(chip: QuickActionChip): DraftTone {
  switch (chip.kind) {
    case 'approve':
      return 'executive';
    case 'schedule':
    case 'nudge':
      return 'warm';
    case 'reply':
    default:
      return 'direct';
  }
}

export function getCardQuickDraftChips(thread: EmailThread): QuickActionChip[] {
  const draftable = (thread.quickActions ?? []).filter(
    (c) => c.kind !== 'archive' && c.kind !== 'snooze',
  );
  if (draftable.length > 0) return draftable.slice(0, 2);
  if (thread.bucket === 'decision') {
    return [
      {
        id: `${thread.id}-approve`,
        label: 'Draft: Approve & confirm',
        kind: 'approve',
        draftHint: 'Approve clearly and confirm the immediate next step.',
      },
      {
        id: `${thread.id}-schedule`,
        label: 'Draft: Suggest times',
        kind: 'schedule',
        draftHint: 'Suggest two short time windows later this week.',
      },
    ];
  }
  return [
    {
      id: `${thread.id}-ack`,
      label: 'Draft: Quick thanks',
      kind: 'reply',
      draftHint: 'Send a brief, warm acknowledgment confirming I saw this.',
    },
  ];
}

export function getReadablePreview(thread: EmailThread): string {
  const latestMessage =
    thread.messages && thread.messages.length > 0
      ? thread.messages[thread.messages.length - 1]
      : null;
  const raw = latestMessage?.bodyText?.trim() || thread.snippet || '';
  return raw
    .replace(/\r\n/g, '\n')
    .replace(/\n{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isActivelySnoozed(thread: EmailThread): boolean {
  if (!thread.isSnoozedUntil) return false;
  const untilMs = new Date(thread.isSnoozedUntil).getTime();
  return Number.isFinite(untilMs) && untilMs > Date.now();
}

export function isPriorityCard(thread: EmailThread): boolean {
  if (thread.isArchived || isActivelySnoozed(thread)) return false;
  if (thread.bucket === 'decision' || thread.bucket === 'waiting') return true;
  if (
    thread.isUnread &&
    thread.bucket !== 'feed' &&
    thread.bucket !== 'paper_trail' &&
    thread.bucket !== 'screener'
  ) {
    return true;
  }
  return false;
}

export function isReceiptCard(thread: EmailThread): boolean {
  if (thread.isArchived || isActivelySnoozed(thread)) return false;
  if (thread.bucket === 'paper_trail') return true;
  if (thread.receiptInfo) return true;
  return false;
}

export function sortThreadsForDeck(threads: EmailThread[]): EmailThread[] {
  const bucketRank: Record<string, number> = {
    decision: 0,
    waiting: 1,
    paper_trail: 2,
    feed: 3,
    screener: 4,
    archived: 5,
  };

  return [...threads].sort((a, b) => {
    const rankDiff = (bucketRank[a.bucket] ?? 4) - (bucketRank[b.bucket] ?? 4);
    if (rankDiff !== 0) return rankDiff;
    if (b.urgencyScore !== a.urgencyScore) {
      return b.urgencyScore - a.urgencyScore;
    }
    return (
      new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime()
    );
  });
}

export function getAvatarPalette(seed: string): {
  bg: string;
  text: string;
  border: string;
} {
  const palettes = [
    { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    { bg: '#ECFDF5', text: '#047857', border: '#A7F3D0' },
    { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
    { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
    { bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
    { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
  ];
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return palettes[Math.abs(hash) % palettes.length];
}

export function estimateReadingMinutes(thread: EmailThread): number {
  const len =
    thread.messages?.reduce((acc, m) => acc + (m.bodyText?.length ?? 0), 0) ||
    thread.snippet.length * 4;
  return Math.max(2, Math.min(10, Math.round(len / 900)));
}
