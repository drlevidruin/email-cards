import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  Newspaper,
  ShieldCheck,
  Sparkles,
  VolumeX,
} from 'lucide-react';
import type { ScreenerSender } from '../../lib/types';
import { getInitials } from './pulseUtils';

export interface ScreenerStripProps {
  screener: ScreenerSender[];
  onScreenerDecision: (
    email: string,
    decision: 'approved' | 'feed' | 'muted',
  ) => void | Promise<void>;
}

function getRecommendationMeta(rec: ScreenerSender['aiRecommendation']) {
  if (rec === 'approve') {
    return {
      label: 'Recommended: Approve',
      pillClass:
        'border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-300',
    };
  }
  if (rec === 'feed') {
    return {
      label: 'Recommended: Route to Feed',
      pillClass:
        'border-sky-500/30 bg-sky-500/15 text-sky-700 dark:border-sky-400/25 dark:bg-sky-400/15 dark:text-sky-300',
    };
  }
  return {
    label: 'Recommended: Mute',
    pillClass:
      'border-rose-500/30 bg-rose-500/15 text-rose-700 dark:border-rose-400/25 dark:bg-rose-400/15 dark:text-rose-300',
  };
}

export const ScreenerStrip: React.FC<ScreenerStripProps> = ({
  screener,
  onScreenerDecision,
}) => {
  const [busyEmail, setBusyEmail] = useState<string | null>(null);
  const pending = screener.filter((s) => s.status === 'pending');

  const handleDecision = async (
    email: string,
    decision: 'approved' | 'feed' | 'muted',
  ) => {
    setBusyEmail(email);
    try {
      await onScreenerDecision(email, decision);
    } finally {
      setBusyEmail(null);
    }
  };

  if (pending.length === 0) {
    return (
      <section className="flex items-center justify-between rounded-2xl border border-slate-900/[0.07] bg-white/75 px-4 py-3 dark:border-white/[0.07] dark:bg-[#0D121D]/70">
        <div className="flex items-center gap-2.5 text-[12.5px] text-slate-600 dark:text-slate-300">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span className="font-medium text-slate-800 dark:text-slate-100">
            First-Time Sender Gatekeeper is clear.
          </span>
          <span className="hidden text-slate-500 sm:inline dark:text-slate-400">
            Unknown senders will wait here before touching your inbox.
          </span>
        </div>
        <span className="font-mono-num rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
          0 waiting
        </span>
      </section>
    );
  }

  return (
    <section id="pulse-screener" className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-violet-500 dark:text-violet-400" />
            <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-slate-900 dark:text-white">
              First-Time Sender Screener
            </h2>
            <span className="font-mono-num rounded-full border border-violet-500/25 bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
              {pending.length} new
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-slate-500 dark:text-slate-400">
            Unknown voices held at the door. Decide once and Prism remembers forever.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-4">
        <AnimatePresence initial={false}>
          {pending.map((sender) => {
            const rec = getRecommendationMeta(sender.aiRecommendation);
            const isBusy = busyEmail === sender.email;
            return (
              <motion.div
                key={sender.email}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.94, y: -6 }}
                transition={{ duration: 0.22 }}
                className="flex flex-col justify-between rounded-2xl border border-slate-900/[0.08] bg-white/90 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition-colors hover:border-slate-900/[0.15] dark:border-white/[0.08] dark:bg-[#0E1320]/90 dark:hover:border-white/[0.14]"
              >
                <div>
                  {/* Sender Identity */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold text-slate-800 dark:text-slate-100"
                        style={{
                          borderColor: `${sender.accountColor}55`,
                          background: `${sender.accountColor}18`,
                        }}
                      >
                        {getInitials(sender.name)}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100">
                          {sender.name}
                        </div>
                        <div className="font-mono-num truncate text-[10.5px] text-slate-500 dark:text-slate-400">
                          {sender.domain}
                        </div>
                      </div>
                    </div>
                    <span
                      className="mt-1 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: sender.accountColor }}
                      title={sender.email}
                    />
                  </div>

                  {/* Claude Recommendation Pill */}
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold ${rec.pillClass}`}
                    >
                      <Sparkles className="h-2.5 w-2.5" />
                      <span>{rec.label}</span>
                    </span>
                  </div>

                  {/* Sample Subject & AI Reason */}
                  <p className="mt-2.5 line-clamp-1 text-[12.5px] font-medium text-slate-900 dark:text-slate-100">
                    {sender.sampleSubject}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                    {sender.aiReason || sender.sampleSnippet}
                  </p>
                </div>

                {/* 3 Instant Tactile Decision Buttons */}
                <div className="mt-4 grid grid-cols-3 gap-1.5 border-t border-slate-900/[0.06] pt-3 dark:border-white/[0.06]">
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDecision(sender.email, 'approved')}
                    className={`inline-flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[10.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
                      sender.aiRecommendation === 'approve'
                        ? 'border-emerald-500/35 bg-emerald-500/15 text-emerald-800 hover:bg-emerald-500/20 dark:border-emerald-400/30 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25'
                        : 'border-slate-900/[0.08] bg-slate-900/[0.02] text-slate-700 hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-emerald-400/30 dark:hover:text-emerald-200'
                    }`}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span className="truncate">Allow</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDecision(sender.email, 'feed')}
                    className={`inline-flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[10.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
                      sender.aiRecommendation === 'feed'
                        ? 'border-sky-500/35 bg-sky-500/15 text-sky-800 hover:bg-sky-500/20 dark:border-sky-400/30 dark:bg-sky-400/15 dark:text-sky-200 dark:hover:bg-sky-400/25'
                        : 'border-slate-900/[0.08] bg-slate-900/[0.02] text-slate-700 hover:border-sky-500/30 hover:bg-sky-500/10 hover:text-sky-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-sky-400/30 dark:hover:text-sky-200'
                    }`}
                  >
                    <Newspaper className="h-3.5 w-3.5" />
                    <span className="truncate">To Feed</span>
                  </button>

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleDecision(sender.email, 'muted')}
                    className={`inline-flex flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[10.5px] font-semibold transition-all active:scale-[0.97] disabled:opacity-50 ${
                      sender.aiRecommendation === 'mute'
                        ? 'border-rose-500/35 bg-rose-500/15 text-rose-800 hover:bg-rose-500/20 dark:border-rose-400/30 dark:bg-rose-400/15 dark:text-rose-200 dark:hover:bg-rose-400/25'
                        : 'border-slate-900/[0.08] bg-slate-900/[0.02] text-slate-700 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-700 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-rose-400/30 dark:hover:text-rose-200'
                    }`}
                  >
                    <VolumeX className="h-3.5 w-3.5" />
                    <span className="truncate">Mute</span>
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </section>
  );
};
