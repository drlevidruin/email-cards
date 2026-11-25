import React from 'react';
import {
  Activity,
  Sparkles,
  Inbox,
  BookOpen,
  Plus,
  CheckCircle2,
  SlidersHorizontal,
  Shield,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Layers,
  Wand2,
  Filter,
} from 'lucide-react';
import type {
  AgentRule,
  CustomView,
  DraftItem,
  GmailAccount,
  LensId,
  ShabbosStatus,
} from '../../lib/types';
import { cn } from '../../lib/utils';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeLens: LensId;
  onSelectLens: (lens: LensId) => void;
  accounts: GmailAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  decisionCount: number;
  totalUnread: number;
  vaultCount: number;
  drafts: DraftItem[];
  customViews: CustomView[];
  activeViewId: string | null;
  onSelectCustomView: (view: CustomView | null) => void;
  rules: AgentRule[];
  onOpenRules: () => void;
  onOpenConnectGmail: () => void;
  onOpenApprovalDock: () => void;
  onOpenSettings: (tab?: 'claude' | 'shabbos' | 'demo') => void;
  shabbosStatus: ShabbosStatus | null;
  demoMode: boolean;
  onToggleDemo: () => void;
}

const LENSES: {
  id: LensId;
  label: string;
  subtitle: string;
  shortcut: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'pulse', label: 'The Pulse', subtitle: 'Executive brief', shortcut: '1', icon: Activity },
  {
    id: 'constellation',
    label: 'Constellation',
    subtitle: 'Spatial gravity',
    shortcut: '2',
    icon: Sparkles,
  },
  { id: 'stream', label: 'The Stream', subtitle: 'Triage inbox', shortcut: '3', icon: Inbox },
  { id: 'vault', label: 'Digest & Vault', subtitle: 'Feed & receipts', shortcut: '4', icon: BookOpen },
];

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeLens,
  onSelectLens,
  accounts,
  selectedAccountId,
  onSelectAccount,
  decisionCount,
  totalUnread,
  vaultCount,
  drafts,
  customViews,
  activeViewId,
  onSelectCustomView,
  rules,
  onOpenRules,
  onOpenConnectGmail,
  onOpenApprovalDock,
  onOpenSettings,
  shabbosStatus,
  demoMode,
  onToggleDemo,
}) => {
  const pendingDrafts = drafts.filter(
    (d) => d.status === 'pending_approval' || d.status === 'held_shabbos' || d.status === 'draft'
  );
  const heldShabbosCount = drafts.filter((d) => d.status === 'held_shabbos').length;
  const enabledRulesCount = rules.filter((r) => r.enabled).length;

  const lensBadge = (id: LensId): number | null => {
    if (id === 'pulse') return decisionCount > 0 ? decisionCount : null;
    if (id === 'stream') return totalUnread > 0 ? totalUnread : null;
    if (id === 'vault') return vaultCount > 0 ? vaultCount : null;
    return null;
  };

  return (
    <aside
      className={cn(
        'h-full flex-shrink-0 flex flex-col border-r transition-all duration-200 select-none',
        collapsed ? 'w-[68px]' : 'w-[244px]'
      )}
      style={{
        backgroundColor: 'var(--bg-rail)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Brand Header */}
      <div className="h-14 px-3.5 flex items-center justify-between border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <button
          type="button"
          onClick={() => onSelectLens('pulse')}
          className="flex items-center gap-2.5 group focus:outline-none min-w-0"
          title="Prism Mail"
        >
          <div className="relative w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 prism-refraction-pill shadow-sm">
            <svg viewBox="0 0 28 28" className="w-5 h-5" fill="none">
              <defs>
                <linearGradient id="prismFace" x1="4" y1="3" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#60A5FA" />
                  <stop offset="52%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#F59E0B" />
                </linearGradient>
              </defs>
              <path
                d="M14 3.5L24.5 22.5H3.5L14 3.5Z"
                stroke="url(#prismFace)"
                strokeWidth="1.9"
                strokeLinejoin="round"
                fill="url(#prismFace)"
                fillOpacity="0.14"
              />
              <path
                d="M14 3.5L17.6 22.5"
                stroke="url(#prismFace)"
                strokeWidth="1.2"
                strokeOpacity="0.7"
              />
              <path
                d="M20.5 15.5L26 13.5M21.8 18L26.5 17.5M22.5 20.5L26.2 21.5"
                stroke="url(#prismFace)"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeOpacity="0.85"
              />
            </svg>
          </div>
          {!collapsed && (
            <div className="flex flex-col items-start leading-none truncate">
              <span
                className="text-[13px] font-semibold tracking-[0.2em]"
                style={{ color: 'var(--text-primary)' }}
              >
                PRISM
              </span>
              <span
                className="text-[10px] tracking-wide mt-0.5"
                style={{ color: 'var(--text-muted)' }}
              >
                Mail Intelligence
              </span>
            </div>
          )}
        </button>

        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md transition-colors hover:bg-white/5"
          style={{ color: 'var(--text-muted)' }}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>

      {/* Scrollable Navigation Body */}
      <div className="flex-1 overflow-y-auto px-2.5 py-3 space-y-5">
        {/* 4 Signature Lenses */}
        <div>
          {!collapsed && (
            <div
              className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: 'var(--text-muted)' }}
            >
              Lenses
            </div>
          )}
          <nav className="space-y-0.5">
            {LENSES.map((lens) => {
              const Icon = lens.icon;
              const isActive = activeLens === lens.id && !activeViewId;
              const count = lensBadge(lens.id);
              return (
                <button
                  key={lens.id}
                  type="button"
                  onClick={() => {
                    onSelectCustomView(null);
                    onSelectLens(lens.id);
                  }}
                  title={`${lens.label} (${lens.shortcut})`}
                  className={cn(
                    'w-full relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-all duration-150 group',
                    collapsed ? 'justify-center px-0' : '',
                    isActive ? 'prism-refraction-pill' : 'border border-transparent hover:bg-[var(--bg-hover)]'
                  )}
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[2.5px] rounded-r-full"
                      style={{
                        background:
                          'linear-gradient(180deg, var(--accent-prism), var(--accent-violet))',
                      }}
                    />
                  )}
                  <Icon
                    className={cn(
                      'w-[16px] h-[16px] flex-shrink-0 transition-colors',
                      isActive ? 'text-sky-400' : 'text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]'
                    )}
                  />
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[13px] font-medium leading-tight truncate"
                          style={{
                            color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {lens.label}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {count !== null && (
                          <span
                            className="font-mono-num text-[11px] font-medium px-1.5 py-0.5 rounded-md"
                            style={{
                              backgroundColor: isActive
                                ? 'rgba(96, 165, 250, 0.18)'
                                : 'var(--bg-elevated)',
                              color: isActive ? 'var(--accent-prism)' : 'var(--text-secondary)',
                            }}
                          >
                            {count}
                          </span>
                        )}
                        <span className="kbd-chip">{lens.shortcut}</span>
                      </div>
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Merged Accounts */}
        <div>
          {!collapsed && (
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--text-muted)' }}
              >
                Merged Inboxes
              </span>
              <span className="font-mono-num text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {accounts.length}
              </span>
            </div>
          )}

          <div className="space-y-0.5">
            {/* All Accounts merged pill */}
            <button
              type="button"
              onClick={() => onSelectAccount('all')}
              title="All Merged Inboxes"
              className={cn(
                'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                collapsed ? 'justify-center px-0' : '',
                selectedAccountId === 'all'
                  ? 'bg-[var(--bg-active)]'
                  : 'hover:bg-[var(--bg-hover)]'
              )}
            >
              <Layers className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--accent-prism)' }} />
              {!collapsed && (
                <>
                  <span
                    className="flex-1 text-[12.5px] font-medium truncate"
                    style={{
                      color:
                        selectedAccountId === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    }}
                  >
                    All Inboxes
                  </span>
                  {totalUnread > 0 && (
                    <span
                      className="font-mono-num text-[11px]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      {totalUnread}
                    </span>
                  )}
                </>
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
                    'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors group',
                    collapsed ? 'justify-center px-0' : '',
                    isSelected ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                  )}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: acc.color,
                      boxShadow: isSelected ? `0 0 10px ${acc.color}` : `0 0 0 2px ${acc.color}25`,
                    }}
                  />
                  {!collapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <div
                          className="text-[12.5px] font-medium truncate leading-tight"
                          style={{
                            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          {acc.label}
                        </div>
                        <div
                          className="text-[10.5px] truncate"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {acc.email}
                        </div>
                      </div>
                      {acc.unreadCount > 0 && (
                        <span
                          className="font-mono-num text-[11px] flex-shrink-0"
                          style={{ color: isSelected ? acc.color : 'var(--text-muted)' }}
                        >
                          {acc.unreadCount}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}

            <button
              type="button"
              onClick={onOpenConnectGmail}
              title="Connect Gmail Account"
              className={cn(
                'w-full mt-1 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium border border-dashed transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-hover)]',
                collapsed ? 'justify-center px-0' : ''
              )}
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <Plus className="w-3.5 h-3.5 flex-shrink-0" />
              {!collapsed && <span>Connect Gmail</span>}
            </button>
          </div>
        </div>

        {/* Approval Dock */}
        <div>
          <button
            type="button"
            onClick={onOpenApprovalDock}
            title="Approval Dock: AI drafts & held sends"
            className={cn(
              'w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 border transition-all',
              collapsed ? 'justify-center px-0' : '',
              pendingDrafts.length > 0
                ? 'border-amber-500/25 bg-amber-500/10 hover:bg-amber-500/15'
                : 'border-[var(--border-subtle)] hover:bg-[var(--bg-hover)]'
            )}
          >
            <CheckCircle2
              className={cn(
                'w-4 h-4 flex-shrink-0',
                pendingDrafts.length > 0 ? 'text-amber-400' : 'text-[var(--text-muted)]'
              )}
            />
            {!collapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <div
                    className="text-[12.5px] font-medium truncate"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Approval Dock
                  </div>
                  <div className="text-[10.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                    {heldShabbosCount > 0
                      ? `${heldShabbosCount} Shabbos-held`
                      : pendingDrafts.length > 0
                        ? 'Drafts ready to review'
                        : 'All clear'}
                  </div>
                </div>
                {pendingDrafts.length > 0 && (
                  <span className="font-mono-num text-[11px] font-semibold px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-400">
                    {pendingDrafts.length}
                  </span>
                )}
              </>
            )}
          </button>
        </div>

        {/* Smart Views & Agent Rules */}
        {!collapsed && (
          <div>
            <div className="px-2 mb-1.5 flex items-center justify-between">
              <span
                className="text-[10px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: 'var(--text-muted)' }}
              >
                Views & Rules
              </span>
            </div>
            <div className="space-y-0.5">
              {customViews.map((view) => {
                const isViewActive = activeViewId === view.id;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => {
                      onSelectCustomView(isViewActive ? null : view);
                      onSelectLens('stream');
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                      isViewActive ? 'bg-[var(--bg-active)]' : 'hover:bg-[var(--bg-hover)]'
                    )}
                  >
                    <Filter
                      className="w-3.5 h-3.5 flex-shrink-0"
                      style={{ color: isViewActive ? 'var(--accent-violet)' : 'var(--text-muted)' }}
                    />
                    <span
                      className="flex-1 text-[12px] truncate"
                      style={{
                        color: isViewActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {view.name}
                    </span>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={onOpenRules}
                className="w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--bg-hover)]"
              >
                <Wand2 className="w-3.5 h-3.5 flex-shrink-0 text-violet-400" />
                <span className="flex-1 text-[12px] truncate" style={{ color: 'var(--text-secondary)' }}>
                  Agent Rules
                </span>
                <span className="font-mono-num text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {enabledRulesCount}
                </span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Status Bar */}
      <div
        className="p-2.5 border-t space-y-1.5"
        style={{ borderColor: 'var(--border-subtle)' }}
      >
        {!collapsed && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleDemo}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                borderColor: 'var(--border-subtle)',
                color: demoMode ? 'var(--accent-prism)' : 'var(--accent-emerald)',
              }}
              title="Toggle Demo showcase dataset vs Live-only Gmail"
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor: demoMode ? 'var(--accent-prism)' : 'var(--accent-emerald)',
                }}
              />
              <span>{demoMode ? 'Demo + Live' : 'Live Only'}</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenSettings('shabbos')}
              className={cn(
                'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium border transition-colors',
                shabbosStatus?.isCurrentlyRestricted
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : shabbosStatus?.enabled
                    ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-400'
                    : 'border-[var(--border-subtle)] text-[var(--text-muted)] hover:bg-[var(--bg-hover)]'
              )}
              title="Shabbos & Yom Tov Outbound Guard"
            >
              <Shield className="w-3 h-3" />
              <span>{shabbosStatus?.isCurrentlyRestricted ? 'Holding' : 'Guard'}</span>
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenSettings('claude')}
          title="Settings: Claude AI, Shabbos Guard, Data"
          className={cn(
            'w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition-colors hover:bg-[var(--bg-hover)]',
            collapsed ? 'justify-center px-0' : ''
          )}
          style={{ color: 'var(--text-secondary)' }}
        >
          {collapsed ? <Settings className="w-4 h-4" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
          {!collapsed && <span className="flex-1 text-left">Settings</span>}
        </button>
      </div>
    </aside>
  );
};
