import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Newspaper, Receipt } from 'lucide-react';
import type { EmailThread, GmailAccount } from '../../lib/types';
import { EditorialFeed } from './EditorialFeed';
import { PaperTrailVault } from './PaperTrailVault';
import { formatMoney, isPaperTrailThread } from './vaultUtils';

export interface VaultLensProps {
  threads: EmailThread[];
  accounts: GmailAccount[];
  selectedAccountId: string;
  onOpenThread: (threadId: string) => void;
  onArchiveThreads: (threadIds: string[]) => void | Promise<void>;
  onAskAgent: (prompt: string) => void;
}

type VaultTab = 'editorial' | 'paper_trail';

export const VaultLens: React.FC<VaultLensProps> = ({
  threads,
  accounts,
  selectedAccountId,
  onOpenThread,
  onArchiveThreads,
  onAskAgent,
}) => {
  const [activeTab, setActiveTab] = useState<VaultTab>('editorial');

  const isAllAccounts = !selectedAccountId || selectedAccountId === 'all';
  const activeAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  const scopedThreads = useMemo(
    () =>
      threads.filter(
        (t) =>
          !t.isArchived && (isAllAccounts || t.accountId === selectedAccountId),
      ),
    [threads, isAllAccounts, selectedAccountId],
  );

  const editorialThreads = useMemo(
    () => scopedThreads.filter((t) => t.bucket === 'feed'),
    [scopedThreads],
  );

  const paperTrailThreads = useMemo(
    () => scopedThreads.filter(isPaperTrailThread),
    [scopedThreads],
  );

  const totalSpend = useMemo(
    () =>
      paperTrailThreads.reduce(
        (acc, t) => acc + (t.receiptInfo?.amount ?? 0),
        0,
      ),
    [paperTrailThreads],
  );

  return (
    <div className="h-full w-full overflow-y-auto px-5 py-6 sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1280px] space-y-6 pb-10">
        {/* Top Masthead & Segmented Pill Switch */}
        <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="font-mono-num text-[10.5px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
                Lens 04 / Calm Reading & Financial Memory
              </span>
              {activeAccount && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-white/80 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-200">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: activeAccount.color }}
                  />
                  {activeAccount.label}
                </span>
              )}
            </div>
            <h1 className="font-editorial text-[36px] font-normal leading-[1.06] text-slate-950 sm:text-[42px] dark:text-white">
              {activeTab === 'editorial'
                ? 'The Editorial Feed'
                : 'The Paper Trail Vault'}
            </h1>
            <p className="text-[13.5px] text-slate-500 dark:text-slate-400">
              {activeTab === 'editorial'
                ? 'Newsletters and long-form dispatches transformed into a quiet magazine with 30-second AI takeaways.'
                : 'Every receipt, invoice, SaaS renewal, flight confirmation, and PDF unified into one searchable ledger.'}
            </p>
          </div>

          {/* Clean Segmented Pill Switch */}
          <div
            role="tablist"
            aria-label="Digest and Vault sections"
            className="inline-flex self-start rounded-2xl border border-slate-900/[0.09] bg-white/90 p-1 shadow-sm md:self-end dark:border-white/[0.1] dark:bg-[#0D121E]/95"
          >
            <button
              role="tab"
              aria-selected={activeTab === 'editorial'}
              type="button"
              onClick={() => setActiveTab('editorial')}
              className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold transition-colors ${
                activeTab === 'editorial'
                  ? 'text-white dark:text-white'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {activeTab === 'editorial' && (
                <motion.span
                  layoutId="vault-segmented-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-slate-900 shadow-sm dark:bg-white/[0.14]"
                />
              )}
              <Newspaper className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">The Editorial Feed</span>
              <span
                className={`font-mono-num relative z-10 rounded-full px-1.5 py-0.5 text-[10.5px] ${
                  activeTab === 'editorial'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900/[0.06] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                }`}
              >
                {editorialThreads.length}
              </span>
            </button>

            <button
              role="tab"
              aria-selected={activeTab === 'paper_trail'}
              type="button"
              onClick={() => setActiveTab('paper_trail')}
              className={`relative inline-flex items-center gap-2 rounded-xl px-4 py-2 text-[12.5px] font-semibold transition-colors ${
                activeTab === 'paper_trail'
                  ? 'text-white dark:text-white'
                  : 'text-slate-600 hover:text-slate-950 dark:text-slate-400 dark:hover:text-slate-100'
              }`}
            >
              {activeTab === 'paper_trail' && (
                <motion.span
                  layoutId="vault-segmented-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-slate-900 shadow-sm dark:bg-white/[0.14]"
                />
              )}
              <Receipt className="relative z-10 h-3.5 w-3.5" />
              <span className="relative z-10">The Paper Trail</span>
              <span
                className={`font-mono-num relative z-10 rounded-full px-1.5 py-0.5 text-[10.5px] ${
                  activeTab === 'paper_trail'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-900/[0.06] text-slate-600 dark:bg-white/[0.08] dark:text-slate-300'
                }`}
              >
                {totalSpend > 0 ? formatMoney(totalSpend) : paperTrailThreads.length}
              </span>
            </button>
          </div>
        </header>

        {/* Active Lens Panel */}
        <AnimatePresence mode="wait">
          {activeTab === 'editorial' ? (
            <motion.div
              key="editorial"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <EditorialFeed
                threads={editorialThreads}
                onOpenThread={onOpenThread}
                onArchiveThreads={onArchiveThreads}
              />
            </motion.div>
          ) : (
            <motion.div
              key="paper_trail"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2 }}
            >
              <PaperTrailVault
                threads={paperTrailThreads}
                accounts={accounts}
                onOpenThread={onOpenThread}
                onArchiveThreads={onArchiveThreads}
                onAskAgent={onAskAgent}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
