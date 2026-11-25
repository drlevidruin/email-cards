import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Sparkles,
  Layers,
  List,
  FileEdit,
  PenSquare,
  Plus,
  Shield,
  RefreshCw,
  ArrowRight,
  Loader2,
  Mail,
} from 'lucide-react';
import type { EmailThread, GmailAccount, NlFilterResponse } from '../../lib/types';
import type { PrismViewId } from './TopBar';
import { api } from '../../lib/api';
import { cn, formatRelativeTime } from '../../lib/utils';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  threads: EmailThread[];
  accounts: GmailAccount[];
  onOpenThread: (threadId: string) => void;
  onSelectView: (view: PrismViewId) => void;
  onSelectAccount: (accountId: string) => void;
  onOpenCompose: () => void;
  onOpenConnectGmail: () => void;
  onOpenSettings: (tab?: 'claude' | 'shabbos' | 'demo') => void;
  onSyncAll: () => void;
  onApplyNlFilter: (query: string, res: NlFilterResponse) => void;
}

interface PaletteItem {
  id: string;
  group: 'Claude AI' | 'Emails' | 'Views' | 'Accounts' | 'Actions';
  title: string;
  subtitle?: string;
  badge?: string;
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  onClose,
  threads,
  accounts,
  onOpenThread,
  onSelectView,
  onSelectAccount,
  onOpenCompose,
  onOpenConnectGmail,
  onOpenSettings,
  onSyncAll,
  onApplyNlFilter,
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const [nlLoading, setNlLoading] = useState(false);
  const [nlError, setNlError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setNlError(null);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const runNlFilter = async (q: string) => {
    if (!q.trim() || nlLoading) return;
    setNlLoading(true);
    setNlError(null);
    try {
      const res = await api.nlFilter({ query: q.trim() });
      onApplyNlFilter(q.trim(), res);
      onClose();
    } catch (err) {
      setNlError(err instanceof Error ? err.message : 'Filter request failed');
    } finally {
      setNlLoading(false);
    }
  };

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const list: PaletteItem[] = [];

    if (q.length >= 3) {
      list.push({
        id: 'claude-nl-filter',
        group: 'Claude AI',
        title: `Ask Claude: "${query.trim()}"`,
        subtitle: 'Search across all merged Gmail accounts with natural language',
        badge: 'AI Search',
        icon: <Sparkles className="w-4 h-4 text-indigo-600" />,
        run: () => runNlFilter(query),
      });
    }

    const matchingThreads = threads
      .filter((t) => {
        if (!q) return !t.isArchived && t.bucket === 'decision';
        const hay = [
          t.subject,
          t.snippet,
          t.distilledAsk || '',
          t.accountLabel,
          ...t.participants.map((p) => `${p.name} ${p.email}`),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, q ? 6 : 4);

    for (const t of matchingThreads) {
      const sender = t.participants[0]?.name || t.accountLabel;
      list.push({
        id: `thread-${t.id}`,
        group: 'Emails',
        title: t.subject,
        subtitle: t.distilledAsk || `${sender}: ${t.snippet}`,
        badge: formatRelativeTime(t.lastMessageAt),
        icon: <Mail className="w-3.5 h-3.5" style={{ color: t.accountColor }} />,
        run: () => {
          onOpenThread(t.id);
          onClose();
        },
      });
    }

    const viewItems: PaletteItem[] = [
      {
        id: 'view-cards',
        group: 'Views',
        title: 'Go to Cards',
        subtitle: 'Swipe through priority emails one card at a time',
        badge: '1',
        icon: <Layers className="w-4 h-4 text-blue-600" />,
        run: () => {
          onSelectView('cards');
          onClose();
        },
      },
      {
        id: 'view-browse',
        group: 'Views',
        title: 'Go to Browse',
        subtitle: 'Browse inbox, promises, newsletters, and receipts',
        badge: '2',
        icon: <List className="w-4 h-4 text-emerald-600" />,
        run: () => {
          onSelectView('browse');
          onClose();
        },
      },
      {
        id: 'view-drafts',
        group: 'Views',
        title: 'Go to Drafts & Approval Dock',
        subtitle: 'Review AI drafts and Shabbos-held outbound sends',
        badge: '3',
        icon: <FileEdit className="w-4 h-4 text-amber-600" />,
        run: () => {
          onSelectView('drafts');
          onClose();
        },
      },
    ];

    const accountItems: PaletteItem[] = [
      {
        id: 'acc-all',
        group: 'Accounts',
        title: 'Show All Merged Inboxes',
        subtitle: `${accounts.length} connected accounts`,
        icon: <Layers className="w-4 h-4 text-gray-600" />,
        run: () => {
          onSelectAccount('all');
          onClose();
        },
      },
      ...accounts.map((acc) => ({
        id: `acc-${acc.id}`,
        group: 'Accounts' as const,
        title: `Filter Inbox: ${acc.label}`,
        subtitle: acc.email,
        icon: (
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: acc.color }}
          />
        ),
        run: () => {
          onSelectAccount(acc.id);
          onClose();
        },
      })),
    ];

    const actionItems: PaletteItem[] = [
      {
        id: 'act-compose',
        group: 'Actions',
        title: 'Compose New Email',
        subtitle: 'Send from any connected Gmail account',
        badge: 'C',
        icon: <PenSquare className="w-4 h-4 text-blue-600" />,
        run: () => {
          onClose();
          onOpenCompose();
        },
      },
      {
        id: 'act-connect',
        group: 'Actions',
        title: 'Connect Gmail Account',
        subtitle: '30-second App Password or Google OAuth2',
        icon: <Plus className="w-4 h-4 text-emerald-600" />,
        run: () => {
          onClose();
          onOpenConnectGmail();
        },
      },
      {
        id: 'act-shabbos',
        group: 'Actions',
        title: 'Shabbos & Yom Tov Guard Settings',
        subtitle: 'Manage automatic outbound hold windows and timezone',
        icon: <Shield className="w-4 h-4 text-emerald-600" />,
        run: () => {
          onClose();
          onOpenSettings('shabbos');
        },
      },
      {
        id: 'act-sync',
        group: 'Actions',
        title: 'Sync All Gmail Accounts Now',
        subtitle: 'Fetch latest messages across connected accounts',
        icon: <RefreshCw className="w-4 h-4 text-blue-600" />,
        run: () => {
          onSyncAll();
          onClose();
        },
      },
    ];

    const filterMeta = (arr: PaletteItem[]) =>
      q
        ? arr.filter(
            (i) =>
              i.title.toLowerCase().includes(q) || (i.subtitle || '').toLowerCase().includes(q)
          )
        : arr;

    list.push(...filterMeta(viewItems), ...filterMeta(accountItems), ...filterMeta(actionItems));
    return list;
  }, [
    query,
    threads,
    accounts,
    onOpenThread,
    onSelectView,
    onSelectAccount,
    onOpenCompose,
    onOpenConnectGmail,
    onOpenSettings,
    onSyncAll,
    onClose,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % Math.max(items.length, 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = items[activeIndex];
      if (target) void target.run();
    }
  };

  let lastGroup = '';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[8vh] sm:pt-[12vh] px-3 sm:px-4 bg-slate-900/25 backdrop-blur-[3px]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[620px] max-h-[82vh] flex flex-col rounded-2xl overflow-hidden bg-white border border-gray-200"
        style={{ boxShadow: 'var(--shadow-modal)' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-200">
          {nlLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 flex-shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search emails, ask Claude, or run an action..."
            className="flex-1 bg-transparent text-[14.5px] text-gray-900 focus:outline-none placeholder:text-gray-400"
          />
          <span className="kbd-chip">Esc</span>
        </div>

        {nlError && (
          <div className="px-4 py-2 text-[12.5px] text-rose-700 bg-rose-50 border-b border-rose-200">
            {nlError}
          </div>
        )}

        {/* Results */}
        <div className="max-h-[420px] overflow-y-auto p-2">
          {items.length === 0 ? (
            <div className="py-10 text-center text-[13.5px] text-gray-500">
              No matching emails or actions. Press Enter to ask Claude.
            </div>
          ) : (
            items.map((item, idx) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const isSelected = idx === activeIndex;
              return (
                <React.Fragment key={item.id}>
                  {showGroup && (
                    <div className="px-2.5 pt-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => void item.run()}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2.5 rounded-xl text-left transition-colors',
                      isSelected ? 'bg-blue-50/90' : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                      {item.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-medium text-gray-900 truncate">
                        {item.title}
                      </div>
                      {item.subtitle && (
                        <div className="text-[12px] text-gray-500 truncate">{item.subtitle}</div>
                      )}
                    </div>
                    {item.badge && <span className="kbd-chip flex-shrink-0">{item.badge}</span>}
                    {isSelected && <ArrowRight className="w-3.5 h-3.5 text-blue-600 flex-shrink-0" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-[11.5px] text-gray-500">
          <div className="flex items-center gap-3">
            <span>Up/Down to navigate</span>
            <span>Enter to select</span>
          </div>
          <span>Email Cards Search</span>
        </div>
      </div>
    </div>
  );
};
