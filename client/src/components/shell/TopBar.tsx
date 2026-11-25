import React from 'react';
import {
  Search,
  PenSquare,
  Sparkles,
  Settings,
  Plus,
  Layers,
  List,
  FileEdit,
  RefreshCw,
  X,
} from 'lucide-react';
import type { GmailAccount, ShabbosStatus } from '../../lib/types';
import { cn } from '../../lib/utils';

export type PrismViewId = 'cards' | 'browse' | 'drafts';

export type DeckFilter =
  | 'priority'
  | 'bookmarked'
  | 'screener'
  | 'newsletters'
  | 'receipts'
  | 'all';

export interface DeckCounts {
  priority: number;
  bookmarked: number;
  screener: number;
  newsletters: number;
  receipts: number;
  all: number;
}

const DECK_FILTER_ITEMS: { id: DeckFilter; label: string }[] = [
  { id: 'priority', label: 'Priority' },
  { id: 'bookmarked', label: 'Bookmarked' },
  { id: 'screener', label: 'First-Time' },
  { id: 'newsletters', label: 'Newsletters' },
  { id: 'receipts', label: 'Receipts' },
  { id: 'all', label: 'All' },
];

interface TopBarProps {
  activeView: PrismViewId;
  onSelectView: (view: PrismViewId) => void;
  accounts: GmailAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  totalUnread: number;
  draftsCount: number;
  onOpenConnectGmail: () => void;
  onOpenCommandPalette: () => void;
  onOpenCompose: () => void;
  agentRailOpen: boolean;
  onToggleAgentRail: () => void;
  onOpenSettings: (tab?: 'claude' | 'shabbos' | 'demo') => void;
  isSyncing: boolean;
  onSyncAll: () => void;
  claudeConfigured: boolean;
  shabbosStatus: ShabbosStatus | null;
  overlayMode?: boolean;
  onCloseOverlay?: () => void;
  deckFilter?: DeckFilter;
  onSelectDeckFilter?: (filter: DeckFilter) => void;
  deckCounts?: DeckCounts;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeView,
  onSelectView,
  accounts,
  selectedAccountId,
  onSelectAccount,
  totalUnread,
  draftsCount,
  onOpenConnectGmail,
  onOpenCommandPalette,
  onOpenCompose,
  agentRailOpen,
  onToggleAgentRail,
  onOpenSettings,
  isSyncing,
  onSyncAll,
  claudeConfigured,
  shabbosStatus,
  overlayMode = false,
  onCloseOverlay,
  deckFilter = 'priority',
  onSelectDeckFilter,
  deckCounts,
}) => {
  const brandMark = (
    <button
      type="button"
      onClick={() => onSelectView('cards')}
      className="flex items-center gap-2 pr-1 focus:outline-none flex-shrink-0 group"
      title="Email Cards"
    >
      <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center transition-colors group-hover:bg-blue-100">
        <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
          <rect
            x="4.5"
            y="4"
            width="16"
            height="18"
            rx="3.5"
            fill="#DBEAFE"
            stroke="#2563EB"
            strokeWidth="1.4"
          />
          <rect
            x="7.5"
            y="6.5"
            width="16"
            height="18"
            rx="3.5"
            fill="#FFFFFF"
            stroke="#2563EB"
            strokeWidth="1.8"
          />
          <path
            d="M11 12.5h9M11 16.5h6"
            stroke="#2563EB"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <span className="text-[15px] font-bold tracking-tight text-gray-900 whitespace-nowrap">
        Email Cards
      </span>
    </button>
  );

  const accountPills = (
    <div className="flex items-center gap-1.5 min-w-0 max-w-full">
      <div className="flex items-center gap-1 overflow-x-auto py-0.5 min-w-0">
        <button
          type="button"
          onClick={() => onSelectAccount('all')}
          className={cn(
            'h-8 px-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors flex-shrink-0 border whitespace-nowrap',
            selectedAccountId === 'all'
              ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
              : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
          )}
        >
          <span>All</span>
          {totalUnread > 0 && (
            <span
              className={cn(
                'font-mono-num text-[10.5px] px-1.5 py-0.5 rounded-full leading-none',
                selectedAccountId === 'all'
                  ? 'bg-white/20 text-white'
                  : 'bg-gray-100 text-gray-600'
              )}
            >
              {totalUnread}
            </span>
          )}
        </button>

        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onSelectAccount(isSelected ? 'all' : acc.id)}
              title={`${acc.label}: ${acc.email}`}
              className={cn(
                'h-8 px-2 rounded-full text-[12px] font-medium inline-flex items-center gap-1.5 transition-colors flex-shrink-0 border whitespace-nowrap',
                isSelected
                  ? 'bg-blue-50 text-blue-900 border-blue-300 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
              )}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: acc.color }}
              />
              <span className="max-w-[82px] truncate">{acc.label}</span>
              {acc.unreadCount > 0 && (
                <span
                  className={cn(
                    'font-mono-num text-[10.5px]',
                    isSelected ? 'text-blue-700 font-semibold' : 'text-gray-500'
                  )}
                >
                  {acc.unreadCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Dedicated Unclipped + Gmail Trigger */}
      <button
        type="button"
        onClick={onOpenConnectGmail}
        className="h-8 px-2.5 rounded-full text-[12px] font-medium inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-dashed border-gray-300 transition-colors flex-shrink-0 whitespace-nowrap"
        title="Connect another Gmail account"
      >
        <Plus className="w-3.5 h-3.5 flex-shrink-0" />
        <span>Gmail</span>
      </button>
    </div>
  );

  const viewSwitcher = (
    <nav
      aria-label="Primary views"
      className="flex items-center p-1 rounded-xl bg-gray-100 border border-gray-200/80 flex-shrink-0 w-full lg:w-auto justify-center"
    >
      {(
        [
          { id: 'cards', label: 'Cards', icon: Layers, count: null },
          { id: 'browse', label: 'Browse', icon: List, count: null },
          {
            id: 'drafts',
            label: 'Drafts',
            icon: FileEdit,
            count: draftsCount > 0 ? draftsCount : null,
          },
        ] as const
      ).map((item) => {
        const Icon = item.icon;
        const active = activeView === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectView(item.id)}
            className={cn(
              'flex-1 lg:flex-initial justify-center h-8 px-3 rounded-lg text-[13px] font-semibold inline-flex items-center gap-1.5 transition-all whitespace-nowrap',
              active
                ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-900/5'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            <Icon className={cn('w-3.5 h-3.5', active ? 'text-blue-600' : 'text-gray-500')} />
            <span>{item.label}</span>
            {item.count !== null && (
              <span className="font-mono-num text-[11px] px-1.5 py-0.5 rounded-full leading-none bg-amber-100 text-amber-800">
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  const actionButtons = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <button
        type="button"
        onClick={onOpenCommandPalette}
        className="h-9 px-2.5 rounded-lg bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-600 hover:text-gray-900 text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
        title="Search & commands (Cmd+K)"
      >
        <Search className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
        <span className="hidden xl:inline">Search</span>
        <span className="kbd-chip hidden 2xl:inline">Cmd+K</span>
      </button>

      <button
        type="button"
        onClick={onToggleAgentRail}
        className={cn(
          'h-9 px-2.5 rounded-lg border text-[12.5px] font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap',
          agentRailOpen
            ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-sm'
            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
        )}
        title="Ask Claude (Cmd+J)"
      >
        <Sparkles
          className={cn(
            'w-3.5 h-3.5 flex-shrink-0',
            agentRailOpen ? 'text-indigo-600' : 'text-indigo-500'
          )}
        />
        <span className="hidden sm:inline">Ask Claude</span>
        <span
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ backgroundColor: claudeConfigured ? '#059669' : '#6366F1' }}
          title={claudeConfigured ? 'Live Claude API connected' : 'Local Intelligence ready'}
        />
      </button>

      <button
        type="button"
        onClick={onOpenCompose}
        className="h-9 px-2.5 sm:px-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12.5px] font-semibold inline-flex items-center gap-1.5 shadow-sm transition-colors whitespace-nowrap"
        title="Compose new email (C)"
      >
        <PenSquare className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="hidden sm:inline">Compose</span>
      </button>

      <button
        type="button"
        onClick={onSyncAll}
        disabled={isSyncing}
        className="hidden sm:inline-flex h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 items-center justify-center transition-colors disabled:opacity-50"
        title="Sync all Gmail accounts"
      >
        <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin text-blue-600')} />
      </button>

      <button
        type="button"
        onClick={() => onOpenSettings('claude')}
        className="relative h-9 w-9 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 hover:text-gray-900 inline-flex items-center justify-center transition-colors"
        title="Settings: Claude AI, Shabbos Guard, Demo data"
      >
        <Settings className="w-4 h-4" />
        {shabbosStatus?.isCurrentlyRestricted && (
          <span
            className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-white"
            title="Shabbos Guard is currently holding outbound sends"
          />
        )}
      </button>

      {overlayMode && onCloseOverlay && (
        <button
          type="button"
          onClick={onCloseOverlay}
          className="h-9 px-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-gray-900 text-[12.5px] font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap"
          title="Hide menu and return to focus mode (M or Esc)"
        >
          <X className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="hidden sm:inline">Hide</span>
        </button>
      )}
    </div>
  );

  return (
    <header
      className={cn(
        'flex-shrink-0 bg-white border-b border-gray-200 z-20 w-full',
        overlayMode && 'shadow-xl'
      )}
    >
      {/* Desktop Row 1 (>= lg) */}
      <div className="hidden lg:flex h-16 px-4 items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {brandMark}
          <div className="h-5 w-px bg-gray-200 flex-shrink-0" />
          {accountPills}
        </div>
        {viewSwitcher}
        {actionButtons}
      </div>

      {/* Mobile & Tablet Clean Stacked Layout (< lg, zero overflow at 390px) */}
      <div className="flex lg:hidden flex-col gap-2.5 px-3.5 py-3">
        <div className="flex items-center justify-between gap-2">
          {brandMark}
          {actionButtons}
        </div>
        {viewSwitcher}
        <div className="w-full overflow-x-auto">{accountPills}</div>
      </div>

      {/* Row 2 (Overlay Mode): Calm Deck Category Selector Strip */}
      {overlayMode && onSelectDeckFilter && deckCounts && (
        <div className="px-3.5 sm:px-4 py-2.5 bg-[#FAF9F6] border-t border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center flex-wrap sm:flex-nowrap gap-1.5 sm:gap-2 overflow-x-auto">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400 pr-1 flex-shrink-0">
              Deck
            </span>
            {DECK_FILTER_ITEMS.map((item) => {
              const active = deckFilter === item.id;
              const count = deckCounts[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectDeckFilter(item.id)}
                  className={cn(
                    'h-8 px-2.5 sm:px-3 rounded-full text-[12px] sm:text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-all flex-shrink-0 border whitespace-nowrap',
                    active
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  )}
                >
                  <span>{item.label}</span>
                  <span
                    className={cn(
                      'font-mono-num text-[10.5px] sm:text-[11px] px-1.5 py-0.5 rounded-full leading-none',
                      active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <span className="hidden lg:inline text-[11.5px] text-gray-400 flex-shrink-0 whitespace-nowrap">
            Press <span className="kbd-chip mx-0.5">M</span> or{' '}
            <span className="kbd-chip mx-0.5">Esc</span> to hide
          </span>
        </div>
      )}
    </header>
  );
};
