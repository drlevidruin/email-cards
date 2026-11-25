import type { EmailThread, DraftTone, QuickActionChip } from '../../lib/types';

export function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const absMin = Math.floor(Math.abs(diffMs) / 60000);
  if (absMin < 1) return 'Just now';
  if (absMin < 60) return `${absMin}m ago`;
  const hours = Math.floor(absMin / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCurrency(amount: number, currency = 'USD'): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
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

export function getPrimarySender(thread: EmailThread): { name: string; email: string } {
  if (thread.participants && thread.participants.length > 0) {
    return thread.participants[0];
  }
  if (thread.messages && thread.messages.length > 0) {
    const latestInbound = [...thread.messages].reverse().find((m) => !m.isOutbound);
    const chosen = latestInbound ?? thread.messages[thread.messages.length - 1];
    return { name: chosen.fromName, email: chosen.fromEmail };
  }
  return { name: thread.accountLabel, email: thread.accountEmail };
}

export interface UrgencyVisual {
  tier: 'critical' | 'elevated' | 'calm';
  label: string;
  edgeGradient: string;
  glowColor: string;
  badgeClass: string;
  dotColor: string;
}

export function getUrgencyVisual(score: number): UrgencyVisual {
  if (score >= 85) {
    return {
      tier: 'critical',
      label: 'Urgent',
      edgeGradient: 'linear-gradient(180deg, #FB7185 0%, #F43F5E 55%, #E11D48 100%)',
      glowColor: 'rgba(244, 63, 94, 0.22)',
      badgeClass:
        'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/25',
      dotColor: '#F43F5E',
    };
  }
  if (score >= 65) {
    return {
      tier: 'elevated',
      label: 'Priority',
      edgeGradient: 'linear-gradient(180deg, #FBBF24 0%, #F59E0B 55%, #D97706 100%)',
      glowColor: 'rgba(245, 158, 11, 0.20)',
      badgeClass:
        'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
      dotColor: '#F59E0B',
    };
  }
  return {
    tier: 'calm',
    label: 'Action',
    edgeGradient: 'linear-gradient(180deg, #38BDF8 0%, #0EA5E9 55%, #0284C7 100%)',
    glowColor: 'rgba(56, 189, 248, 0.18)',
    badgeClass:
      'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/25',
    dotColor: '#38BDF8',
  };
}

export function getToneForChip(chip: QuickActionChip): DraftTone {
  switch (chip.kind) {
    case 'approve':
      return 'executive';
    case 'schedule':
      return 'warm';
    case 'nudge':
      return 'warm';
    case 'reply':
    default:
      return 'direct';
  }
}

export function getFallbackQuickActions(thread: EmailThread): QuickActionChip[] {
  if (thread.quickActions && thread.quickActions.length > 0) {
    return thread.quickActions;
  }
  return [
    {
      id: `${thread.id}-approve`,
      label: 'Approve & Draft',
      kind: 'approve',
      draftHint: 'Approve the request clearly and outline the immediate next step.',
    },
    {
      id: `${thread.id}-schedule`,
      label: 'Suggest Times',
      kind: 'schedule',
      draftHint: 'Suggest two concrete 30-minute time slots later this week.',
    },
  ];
}

export function getTimeOfDayGreeting(decisionCount: number): string {
  const hour = new Date().getHours();
  const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (decisionCount === 0) {
    return `${period}. Your decision deck is clear.`;
  }
  if (decisionCount === 1) {
    return `${period}. One decision needs your voice.`;
  }
  const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
  const countLabel = decisionCount < words.length ? words[decisionCount] : String(decisionCount);
  return `${period}. ${countLabel.charAt(0).toUpperCase() + countLabel.slice(1)} decisions need your voice.`;
}
