import React from 'react';
import { motion } from 'framer-motion';
import { Clock, Link2, MessageSquare, Sparkles, Zap } from 'lucide-react';
import type {
  ConstellationLink,
  ConstellationNode,
  EmailThread,
} from '../../lib/types';
import { RING_MAP } from './constellationGeometry';

export interface ConstellationTooltipProps {
  node: ConstellationNode;
  thread?: EmailThread;
  relatedLinks: {
    link: ConstellationLink;
    peerNode?: ConstellationNode;
  }[];
  screenX: number;
  screenY: number;
  containerWidth: number;
  containerHeight: number;
}

export const ConstellationTooltip: React.FC<ConstellationTooltipProps> = ({
  node,
  thread,
  relatedLinks,
  screenX,
  screenY,
  containerWidth,
  containerHeight,
}) => {
  const cardWidth = 316;
  const approxHeight = relatedLinks.length > 0 ? 235 : 185;
  const margin = 16;

  // Position smoothly to right of cursor, flipping left when near right edge
  let left = screenX + 20;
  if (left + cardWidth > containerWidth - margin) {
    left = screenX - cardWidth - 20;
  }
  left = Math.max(margin, Math.min(containerWidth - cardWidth - margin, left));

  let top = screenY - approxHeight / 2;
  top = Math.max(76, Math.min(containerHeight - approxHeight - 86, top));

  const ringDef = RING_MAP[node.ring] ?? RING_MAP.outer;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.14 }}
      style={{ left, top, width: cardWidth }}
      className="pointer-events-none absolute z-30 rounded-2xl border border-slate-900/[0.12] bg-white/95 p-4 shadow-[0_20px_50px_-14px_rgba(15,23,42,0.28)] backdrop-blur-2xl dark:border-white/[0.14] dark:bg-[#0D1322]/95 dark:shadow-[0_22px_60px_-14px_rgba(0,0,0,0.88)]"
    >
      {/* Top Badges */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-900/[0.08] bg-slate-900/[0.04] px-2 py-0.5 text-[10.5px] font-semibold text-slate-800 dark:border-white/[0.1] dark:bg-white/[0.06] dark:text-slate-100">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: node.accountColor }}
          />
          <span>{node.accountLabel}</span>
        </span>

        <div className="flex items-center gap-1.5">
          <span className="font-mono-num rounded-full bg-slate-900/[0.05] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-600 dark:bg-white/[0.06] dark:text-slate-300">
            {ringDef.label}
          </span>
          <span className="font-mono-num inline-flex items-center gap-0.5 text-[10.5px] font-semibold text-slate-700 dark:text-slate-200">
            <Zap className="h-2.5 w-2.5 text-amber-500" />
            {node.urgencyScore}
          </span>
        </div>
      </div>

      {/* Sender + Subject */}
      <div className="mt-2.5 flex items-center justify-between gap-2 text-[11.5px] text-slate-500 dark:text-slate-400">
        <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
          {node.fromName}
        </span>
        <span className="font-mono-num inline-flex shrink-0 items-center gap-1">
          <MessageSquare className="h-3 w-3 opacity-70" />
          {node.messageCount}
        </span>
      </div>

      <h4 className="mt-1 line-clamp-2 text-[13.5px] font-semibold leading-snug text-slate-950 dark:text-white">
        {node.subject}
      </h4>

      {/* Distilled Ask */}
      {node.distilledAsk && (
        <div className="mt-2 rounded-xl border border-sky-500/20 bg-sky-500/[0.07] px-2.5 py-2 text-[11.5px] leading-snug text-slate-700 dark:border-sky-400/20 dark:bg-sky-400/[0.08] dark:text-sky-100">
          <div className="mb-0.5 flex items-center gap-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-sky-700 dark:text-sky-300">
            <Sparkles className="h-2.5 w-2.5" />
            <span>Distilled Ask</span>
          </div>
          <p className="line-clamp-2">{node.distilledAsk}</p>
        </div>
      )}

      {/* Deadline if present */}
      {thread?.deadlineLabel && (
        <div className="mt-2 inline-flex items-center gap-1 rounded-full border border-rose-500/25 bg-rose-500/10 px-2 py-0.5 text-[10.5px] font-medium text-rose-700 dark:border-rose-400/25 dark:text-rose-300">
          <Clock className="h-3 w-3" />
          <span>{thread.deadlineLabel}</span>
        </div>
      )}

      {/* Connected Filaments */}
      {relatedLinks.length > 0 && (
        <div className="mt-2.5 space-y-1 border-t border-slate-900/[0.08] pt-2 dark:border-white/[0.08]">
          {relatedLinks.slice(0, 2).map(({ link, peerNode }, idx) => (
            <div
              key={idx}
              className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-300"
            >
              <Link2 className="mt-0.5 h-3 w-3 shrink-0 text-violet-500 dark:text-violet-400" />
              <div className="min-w-0">
                <span className="font-semibold text-violet-700 dark:text-violet-300">
                  {link.crossAccount ? 'Cross-account: ' : 'Linked: '}
                </span>
                <span>{link.reason}</span>
                {peerNode && (
                  <span className="block truncate text-[10px] text-slate-400 dark:text-slate-500">
                    {peerNode.accountLabel}: {peerNode.subject}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-900/[0.06] pt-2 text-[10px] font-medium text-slate-400 dark:border-white/[0.06] dark:text-slate-500">
        <span>Click orb to inspect in Crystal Reader</span>
        {node.isUnread && (
          <span className="font-mono-num text-sky-600 dark:text-sky-400">
            UNREAD
          </span>
        )}
      </div>
    </motion.div>
  );
};
