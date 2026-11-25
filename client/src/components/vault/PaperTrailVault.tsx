import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Archive,
  ArrowUpRight,
  FileText,
  Paperclip,
  Plane,
  Receipt,
  Search,
  Sparkles,
  Wallet,
  X,
} from 'lucide-react';
import type { EmailThread, GmailAccount } from '../../lib/types';
import {
  PAPER_TRAIL_CATEGORIES,
  type PaperTrailCategory,
  buildPaperTrailRecord,
  formatFileSize,
  formatMoney,
  formatShortDate,
} from './vaultUtils';

export interface PaperTrailVaultProps {
  threads: EmailThread[];
  accounts: GmailAccount[];
  onOpenThread: (threadId: string) => void;
  onArchiveThreads: (threadIds: string[]) => void | Promise<void>;
  onAskAgent: (prompt: string) => void;
}

function getCategoryPillClass(cat: string): string {
  switch (cat) {
    case 'Travel':
      return 'border-sky-500/25 bg-sky-500/10 text-sky-700 dark:border-sky-400/25 dark:text-sky-300';
    case 'SaaS & Cloud':
      return 'border-violet-500/25 bg-violet-500/10 text-violet-700 dark:border-violet-400/25 dark:text-violet-300';
    case 'Invoices':
      return 'border-amber-500/25 bg-amber-500/10 text-amber-800 dark:border-amber-400/25 dark:text-amber-300';
    default:
      return 'border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/25 dark:text-emerald-300';
  }
}

export const PaperTrailVault: React.FC<PaperTrailVaultProps> = ({
  threads,
  accounts,
  onOpenThread,
  onArchiveThreads,
  onAskAgent,
}) => {
  const [selectedCategory, setSelectedCategory] =
    useState<PaperTrailCategory>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const records = useMemo(
    () =>
      threads
        .map(buildPaperTrailRecord)
        .sort(
          (a, b) =>
            new Date(b.thread.lastMessageAt).getTime() -
            new Date(a.thread.lastMessageAt).getTime(),
        ),
    [threads],
  );

  // Dynamic KPIs computed across all filtered accounts
  const kpis = useMemo(() => {
    let totalSpend = 0;
    let activeInvoices = 0;
    let travelCount = 0;
    let totalDocuments = 0;
    const spendByAccount = new Map<string, { label: string; color: string; total: number }>();

    for (const rec of records) {
      if (rec.amount !== null) {
        totalSpend += rec.amount;
        const prev = spendByAccount.get(rec.thread.accountId) ?? {
          label: rec.thread.accountLabel,
          color: rec.thread.accountColor,
          total: 0,
        };
        prev.total += rec.amount;
        spendByAccount.set(rec.thread.accountId, prev);
      }
      if (rec.isInvoiceOrReceipt) activeInvoices += 1;
      if (rec.isTravel) travelCount += 1;
      totalDocuments += rec.attachments.length;
    }

    const largest = [...records]
      .filter((r) => r.amount !== null)
      .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))[0];

    return {
      totalSpend,
      activeInvoices,
      travelCount,
      totalDocuments,
      largest,
      spendByAccount: Array.from(spendByAccount.values()),
    };
  }, [records]);

  const categoryCounts = useMemo(() => {
    const counts: Record<PaperTrailCategory, number> = {
      All: records.length,
      Invoices: 0,
      'SaaS & Cloud': 0,
      Travel: 0,
      Purchases: 0,
      Attachments: 0,
    };
    for (const rec of records) {
      counts[rec.category] += 1;
      if (rec.attachments.length > 0) counts.Attachments += 1;
    }
    return counts;
  }, [records]);

  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return records.filter((rec) => {
      if (selectedCategory === 'Attachments') {
        if (rec.attachments.length === 0) return false;
      } else if (selectedCategory !== 'All' && rec.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      const haystack = [
        rec.vendor,
        rec.invoiceNumber ?? '',
        rec.category,
        rec.thread.subject,
        rec.thread.accountLabel,
        rec.attachments.map((a) => a.filename).join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [records, selectedCategory, searchQuery]);

  const featuredCards = useMemo(
    () => filteredRecords.filter((r) => r.amount !== null).slice(0, 3),
    [filteredRecords],
  );

  const handleSummarizeSpend = () => {
    onAskAgent(
      'Summarize my Paper Trail spend, invoices, SaaS subscriptions, and travel confirmations across all Gmail accounts. Break down totals by account and flag anything worth reviewing.',
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. Top KPI Strip */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {/* Total Tracked Spend */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="relative overflow-hidden rounded-2xl border border-slate-900/[0.09] bg-white/95 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0E1320]/95"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
              Total Tracked Spend
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Wallet className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="font-mono-num mt-2.5 text-[28px] font-semibold leading-none tracking-tight text-slate-950 dark:text-white">
            {formatMoney(kpis.totalSpend)}
          </div>
          {/* Multi-account spend bar */}
          <div className="mt-3.5 space-y-1.5">
            <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-slate-900/[0.06] dark:bg-white/[0.07]">
              {kpis.spendByAccount.length > 0 && kpis.totalSpend > 0 ? (
                kpis.spendByAccount.map((seg) => (
                  <div
                    key={seg.label}
                    style={{
                      width: `${Math.max(6, (seg.total / kpis.totalSpend) * 100)}%`,
                      backgroundColor: seg.color,
                    }}
                    title={`${seg.label}: ${formatMoney(seg.total)}`}
                  />
                ))
              ) : (
                <div className="w-full bg-emerald-500/30" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
              {kpis.spendByAccount.map((seg) => (
                <span key={seg.label} className="inline-flex items-center gap-1">
                  <span
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span>{seg.label}</span>
                </span>
              ))}
              {kpis.spendByAccount.length === 0 && (
                <span>Across {accounts.length} Gmail accounts</span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Active Invoices / Receipts */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.04 }}
          className="rounded-2xl border border-slate-900/[0.09] bg-white/95 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0E1320]/95"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
              Invoices & Receipts
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <Receipt className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="font-mono-num mt-2.5 text-[28px] font-semibold leading-none text-slate-950 dark:text-white">
            {kpis.activeInvoices}
          </div>
          <p className="mt-3 truncate text-[11.5px] text-slate-500 dark:text-slate-400">
            {kpis.largest
              ? `Largest: ${kpis.largest.vendor} (${formatMoney(kpis.largest.amount ?? 0)})`
              : 'Auto-extracted from incoming billing emails'}
          </p>
        </motion.div>

        {/* Travel & Confirmations */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
          className="rounded-2xl border border-slate-900/[0.09] bg-white/95 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0E1320]/95"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
              Travel & Confirmations
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
              <Plane className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="font-mono-num mt-2.5 text-[28px] font-semibold leading-none text-slate-950 dark:text-white">
            {kpis.travelCount}
          </div>
          <p className="mt-3 text-[11.5px] text-slate-500 dark:text-slate-400">
            Itineraries, hotels & flight confirmations indexed
          </p>
        </motion.div>

        {/* Documents & Attachments */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.12 }}
          className="rounded-2xl border border-slate-900/[0.09] bg-white/95 p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0E1320]/95"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-500 dark:text-slate-400">
              Documents & PDFs
            </span>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500/15 text-violet-600 dark:text-violet-400">
              <Paperclip className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="font-mono-num mt-2.5 text-[28px] font-semibold leading-none text-slate-950 dark:text-white">
            {kpis.totalDocuments}
          </div>
          <p className="mt-3 text-[11.5px] text-slate-500 dark:text-slate-400">
            Statements, PDFs & downloadable attachments
          </p>
        </motion.div>
      </div>

      {/* 2. Filter Chips + Search + Claude Spend Summary CTA */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {PAPER_TRAIL_CATEGORIES.map((category) => {
            const active = selectedCategory === category;
            const count = categoryCounts[category];
            return (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12px] font-medium transition-all ${
                  active
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-white/20 dark:bg-white/15 dark:text-white'
                    : 'border-slate-900/[0.08] bg-white/80 text-slate-600 hover:border-slate-900/[0.16] hover:text-slate-950 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-white/[0.16] dark:hover:text-white'
                }`}
              >
                <span>{category}</span>
                <span
                  className={`font-mono-num text-[10.5px] ${
                    active ? 'opacity-80' : 'opacity-55'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:w-64 sm:flex-none">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search vendor, invoice #, PDF..."
              className="w-full rounded-xl border border-slate-900/[0.09] bg-white/90 py-1.5 pl-8 pr-7 text-[12.5px] text-slate-900 placeholder:text-slate-400 focus:border-sky-500/45 focus:outline-none dark:border-white/[0.09] dark:bg-[#0D121E]/90 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleSummarizeSpend}
            className="prism-refraction-pill inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-[12px] font-semibold text-slate-900 transition-all hover:brightness-110 active:scale-[0.98] dark:text-sky-100"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-600 dark:text-sky-300" />
            <span>Ask Claude to Summarize Spend</span>
          </button>
        </div>
      </div>

      {/* 3. Visual Receipt Highlight Cards */}
      {featuredCards.length > 0 && (
        <div className="grid grid-cols-1 gap-3.5 md:grid-cols-3">
          {featuredCards.map((rec) => (
            <button
              key={rec.thread.id}
              type="button"
              onClick={() => onOpenThread(rec.thread.id)}
              className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-900/[0.08] bg-white/95 p-4 text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-all hover:border-slate-900/[0.18] hover:shadow-md dark:border-white/[0.08] dark:bg-[#0E1320]/90 dark:hover:border-white/[0.16]"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-[12px] font-bold text-slate-900 dark:text-white"
                    style={{
                      borderColor: `${rec.thread.accountColor}45`,
                      background: `${rec.thread.accountColor}18`,
                    }}
                  >
                    {rec.vendor.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[13.5px] font-semibold text-slate-950 group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
                      {rec.vendor}
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: rec.thread.accountColor }}
                      />
                      <span>{rec.thread.accountLabel}</span>
                      {rec.invoiceNumber && (
                        <>
                          <span className="opacity-40">/</span>
                          <span className="font-mono-num">{rec.invoiceNumber}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <span className="font-mono-num shrink-0 text-[16px] font-semibold text-slate-950 dark:text-white">
                  {formatMoney(rec.amount ?? 0, rec.currency)}
                </span>
              </div>

              <div className="mt-3.5 flex items-center justify-between gap-2 border-t border-dashed border-slate-900/[0.08] pt-3 dark:border-white/[0.08]">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10.5px] font-medium ${getCategoryPillClass(
                    rec.category,
                  )}`}
                >
                  {rec.category}
                </span>
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span className="font-mono-num">
                    {formatShortDate(rec.thread.lastMessageAt)}
                  </span>
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* 4. Structured Financial Ledger Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-900/[0.09] bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-white/[0.08] dark:bg-[#0D121E]/95">
        <div className="flex items-center justify-between border-b border-slate-900/[0.07] px-5 py-3.5 dark:border-white/[0.07]">
          <div className="flex items-center gap-2">
            <h3 className="text-[13.5px] font-semibold text-slate-900 dark:text-white">
              Structured Paper Trail Ledger
            </h3>
            <span className="font-mono-num rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[10.5px] font-medium text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
              {filteredRecords.length} record{filteredRecords.length === 1 ? '' : 's'}
            </span>
          </div>
          <span className="text-[11.5px] text-slate-500 dark:text-slate-400">
            Click any row to open original email & attachments
          </span>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="px-6 py-14 text-center text-[13px] text-slate-500 dark:text-slate-400">
            No matching receipts, travel confirmations, or documents found for this filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-900/[0.06] bg-slate-900/[0.02] text-[10.5px] font-semibold uppercase tracking-[0.1em] text-slate-500 dark:border-white/[0.06] dark:bg-white/[0.02] dark:text-slate-400">
                  <th className="py-3 pl-5 pr-3">Vendor & Subject</th>
                  <th className="px-3 py-3">Category</th>
                  <th className="px-3 py-3">Account</th>
                  <th className="px-3 py-3">Attachments</th>
                  <th className="px-3 py-3">Date</th>
                  <th className="py-3 pl-3 pr-5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/[0.05] dark:divide-white/[0.05]">
                {filteredRecords.map((rec) => (
                  <tr
                    key={rec.thread.id}
                    onClick={() => onOpenThread(rec.thread.id)}
                    className="group cursor-pointer transition-colors hover:bg-slate-900/[0.025] dark:hover:bg-white/[0.035]"
                  >
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold text-slate-800 dark:text-slate-100"
                          style={{
                            borderColor: `${rec.thread.accountColor}45`,
                            background: `${rec.thread.accountColor}16`,
                          }}
                        >
                          {rec.vendor.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-semibold text-slate-950 group-hover:text-sky-700 dark:text-slate-100 dark:group-hover:text-sky-300">
                              {rec.vendor}
                            </span>
                            {rec.invoiceNumber && (
                              <span className="font-mono-num shrink-0 rounded bg-slate-900/[0.05] px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-white/[0.07] dark:text-slate-300">
                                {rec.invoiceNumber}
                              </span>
                            )}
                          </div>
                          <div className="max-w-sm truncate text-[11.5px] text-slate-500 dark:text-slate-400">
                            {rec.thread.subject}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3.5">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getCategoryPillClass(
                          rec.category,
                        )}`}
                      >
                        {rec.category}
                      </span>
                    </td>

                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-slate-900/[0.02] px-2.5 py-0.5 text-[11px] font-medium text-slate-700 dark:border-white/[0.08] dark:bg-white/[0.04] dark:text-slate-200">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: rec.thread.accountColor }}
                        />
                        <span>{rec.thread.accountLabel}</span>
                      </span>
                    </td>

                    <td className="px-3 py-3.5">
                      {rec.attachments.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1">
                          {rec.attachments.slice(0, 2).map((att) => (
                            <span
                              key={att.id}
                              className="inline-flex max-w-[155px] items-center gap-1 rounded-md border border-slate-900/[0.08] bg-slate-900/[0.03] px-2 py-0.5 text-[10.5px] font-medium text-slate-600 dark:border-white/[0.09] dark:bg-white/[0.04] dark:text-slate-300"
                              title={`${att.filename} (${formatFileSize(att.sizeBytes)})`}
                            >
                              <FileText className="h-3 w-3 shrink-0 text-violet-500 dark:text-violet-400" />
                              <span className="truncate">{att.filename}</span>
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 dark:text-slate-600">
                          Inline receipt
                        </span>
                      )}
                    </td>

                    <td className="font-mono-num whitespace-nowrap px-3 py-3.5 text-[11.5px] text-slate-500 dark:text-slate-400">
                      {formatShortDate(rec.thread.lastMessageAt)}
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-right">
                      <div className="inline-flex items-center justify-end gap-2">
                        <span className="font-mono-num text-[13.5px] font-semibold text-slate-950 dark:text-white">
                          {rec.amount !== null
                            ? formatMoney(rec.amount, rec.currency)
                            : 'Doc'}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void onArchiveThreads([rec.thread.id]);
                          }}
                          title="Archive from Vault"
                          className="rounded-lg p-1 text-slate-400 opacity-0 transition-all hover:bg-slate-900/[0.06] hover:text-slate-800 group-hover:opacity-100 dark:hover:bg-white/[0.08] dark:hover:text-white"
                        >
                          <Archive className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
