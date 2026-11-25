import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Crosshair,
  GitBranch,
  Maximize2,
  Search,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type {
  ConstellationLink,
  ConstellationNode,
  EmailThread,
  GmailAccount,
} from '../../lib/types';
import {
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  CENTER_X,
  CENTER_Y,
  ORBIT_RINGS,
  buildFilamentCurves,
  layoutConstellationNodes,
  layoutFloatingLabels,
} from './constellationGeometry';
import { ConstellationTooltip } from './ConstellationTooltip';

export interface ConstellationLensProps {
  nodes: ConstellationNode[];
  links: ConstellationLink[];
  threadsById: Record<string, EmailThread>;
  accounts: GmailAccount[];
  selectedAccountId: string;
  selectedThreadId: string | null;
  highlightedThreadIds?: string[] | null;
  onSelectThread: (threadId: string) => void;
  onSweepPerimeter: (threadIds: string[]) => void | Promise<void>;
  onAskHighlight: (query: string) => void | Promise<void>;
}

const SPOTLIGHT_PRESETS = [
  { label: 'Contracts & money', query: 'Everything involving contracts, invoices, or money' },
  { label: 'Due this week', query: 'Urgent items with deadlines this week' },
  { label: 'Travel & events', query: 'Flights, venues, or upcoming events' },
];

const RADIAL_SPOKE_ANGLES = Array.from({ length: 12 }, (_, i) => (i * Math.PI) / 6);

export const ConstellationLens: React.FC<ConstellationLensProps> = ({
  nodes,
  links,
  threadsById,
  accounts,
  selectedAccountId,
  selectedThreadId,
  highlightedThreadIds,
  onSelectThread,
  onSweepPerimeter,
  onAskHighlight,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerSize, setContainerSize] = useState({ width: 1120, height: 760 });
  const [localAccountId, setLocalAccountId] = useState<string>(selectedAccountId || 'all');
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(
    null,
  );

  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [hoveredLinkIdx, setHoveredLinkIdx] = useState<number | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: 0, y: 0 });
  const [crossAccountOnly, setCrossAccountOnly] = useState(false);

  const [spotlightInput, setSpotlightInput] = useState('');
  const [activeSpotlightQuery, setActiveSpotlightQuery] = useState('');
  const [spotlightLoading, setSpotlightLoading] = useState(false);
  const [isSweeping, setIsSweeping] = useState(false);

  // Sync local account pill selection whenever global Sidebar filter changes
  useEffect(() => {
    setLocalAccountId(selectedAccountId || 'all');
  }, [selectedAccountId]);

  // Track container dimensions for crisp tooltip clamping
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const visibleNodes = useMemo(() => {
    if (!localAccountId || localAccountId === 'all') return nodes;
    return nodes.filter((n) => n.accountId === localAccountId);
  }, [nodes, localAccountId]);

  const positionedNodes = useMemo(
    () => layoutConstellationNodes(visibleNodes),
    [visibleNodes],
  );

  const positionedById = useMemo(() => {
    const map = new Map(positionedNodes.map((p) => [p.node.threadId, p]));
    return map;
  }, [positionedNodes]);

  const visibleLinks = useMemo(() => {
    return links.filter((link) => {
      if (crossAccountOnly && !link.crossAccount) return false;
      return (
        positionedById.has(link.sourceThreadId) &&
        positionedById.has(link.targetThreadId)
      );
    });
  }, [links, positionedById, crossAccountOnly]);

  const filamentCurves = useMemo(
    () => buildFilamentCurves(visibleLinks, positionedById),
    [visibleLinks, positionedById],
  );

  const crossAccountLinkCount = useMemo(
    () => visibleLinks.filter((l) => l.crossAccount).length,
    [visibleLinks],
  );

  const perimeterNodes = useMemo(
    () => positionedNodes.filter((p) => p.node.ring === 'perimeter'),
    [positionedNodes],
  );

  const spotlightSet = useMemo(() => {
    if (!highlightedThreadIds) return null;
    if (highlightedThreadIds.length === 0 && !activeSpotlightQuery) return null;
    return new Set(highlightedThreadIds);
  }, [highlightedThreadIds, activeSpotlightQuery]);

  // Compute connected cluster for hovered node or hovered filament
  const activeClusterIds = useMemo(() => {
    if (hoveredLinkIdx !== null && filamentCurves[hoveredLinkIdx]) {
      const curve = filamentCurves[hoveredLinkIdx];
      return new Set([curve.link.sourceThreadId, curve.link.targetThreadId]);
    }
    const focusId = hoveredNodeId;
    if (!focusId) return null;
    const set = new Set<string>([focusId]);
    for (const link of visibleLinks) {
      if (link.sourceThreadId === focusId) set.add(link.targetThreadId);
      if (link.targetThreadId === focusId) set.add(link.sourceThreadId);
    }
    return set;
  }, [hoveredNodeId, hoveredLinkIdx, filamentCurves, visibleLinks]);

  const hoveredPositioned = hoveredNodeId
    ? positionedById.get(hoveredNodeId) ?? null
    : null;

  const hoveredNodeLinks = useMemo(() => {
    if (!hoveredNodeId) return [];
    return visibleLinks
      .filter(
        (l) =>
          l.sourceThreadId === hoveredNodeId ||
          l.targetThreadId === hoveredNodeId,
      )
      .map((link) => {
        const peerId =
          link.sourceThreadId === hoveredNodeId
            ? link.targetThreadId
            : link.sourceThreadId;
        return {
          link,
          peerNode: positionedById.get(peerId)?.node,
        };
      });
  }, [hoveredNodeId, visibleLinks, positionedById]);

  const accountCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const n of nodes) {
      counts[n.accountId] = (counts[n.accountId] ?? 0) + 1;
    }
    return counts;
  }, [nodes]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button, input, form, [data-orb="true"]')) {
      return;
    }
    setIsDragging(true);
    dragOriginRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setPointerPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    if (!isDragging || !dragOriginRef.current) return;
    const dx = e.clientX - dragOriginRef.current.x;
    const dy = e.clientY - dragOriginRef.current.y;
    setPan({
      x: Math.max(-340, Math.min(340, dragOriginRef.current.panX + dx)),
      y: Math.max(-240, Math.min(240, dragOriginRef.current.panY + dy)),
    });
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragOriginRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('input')) return;
    const factor = e.deltaY < 0 ? 1.09 : 0.92;
    setZoom((prev) => Number(Math.max(0.68, Math.min(2.2, prev * factor)).toFixed(2)));
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleFocusCore = () => {
    setZoom(1.52);
    setPan({ x: 0, y: 0 });
  };

  const handleRunSpotlight = async (queryText: string) => {
    const trimmed = queryText.trim();
    if (!trimmed) {
      handleClearSpotlight();
      return;
    }
    setSpotlightInput(trimmed);
    setActiveSpotlightQuery(trimmed);
    setSpotlightLoading(true);
    try {
      await onAskHighlight(trimmed);
    } finally {
      setSpotlightLoading(false);
    }
  };

  const handleClearSpotlight = () => {
    setSpotlightInput('');
    setActiveSpotlightQuery('');
    void onAskHighlight('');
  };

  const handleSweep = async () => {
    if (perimeterNodes.length === 0 || isSweeping) return;
    const targetIds = perimeterNodes.map((p) => p.node.threadId);
    setIsSweeping(true);
    window.setTimeout(async () => {
      try {
        await onSweepPerimeter(targetIds);
      } finally {
        setIsSweeping(false);
      }
    }, 460);
  };

  const hoveredCurve =
    hoveredLinkIdx !== null ? filamentCurves[hoveredLinkIdx] ?? null : null;

  const floatingLabels = useMemo(() => {
    const candidates: {
      pos: (typeof positionedNodes)[number];
      shiftX: number;
      shiftY: number;
      opacity: number;
      emphasized: boolean;
    }[] = [];

    for (const pos of positionedNodes) {
      const { node } = pos;
      const isSelected = selectedThreadId === node.threadId;
      const isHovered = hoveredNodeId === node.threadId;
      const isPerimeter = node.ring === 'perimeter';
      const isSpotlightMatch = spotlightSet ? spotlightSet.has(node.threadId) : false;
      const isCluster = activeClusterIds !== null && activeClusterIds.has(node.threadId);

      const shouldLabel =
        node.ring === 'core' ||
        isHovered ||
        isSelected ||
        isSpotlightMatch ||
        isCluster;

      if (!shouldLabel) continue;
      if (isSweeping && isPerimeter) continue;

      let opacity = 1;
      if (spotlightSet) {
        opacity = isSpotlightMatch ? 1 : 0.15;
      } else if (activeClusterIds) {
        opacity = isCluster ? 1 : 0.24;
      }

      candidates.push({
        pos,
        shiftX: 0,
        shiftY: 0,
        opacity,
        emphasized: isHovered || isSelected || isSpotlightMatch,
      });
    }

    return layoutFloatingLabels(candidates, positionedNodes);
  }, [
    positionedNodes,
    selectedThreadId,
    hoveredNodeId,
    spotlightSet,
    activeClusterIds,
    isSweeping,
  ]);

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      onWheel={handleWheel}
      onDoubleClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, input, [data-orb="true"]')) {
          handleResetView();
        }
      }}
      className={`relative h-full w-full select-none overflow-hidden bg-[var(--bg-canvas)] ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
    >
      {/* Ambient Radial Space Atmosphere */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_48%,rgba(56,189,248,0.09)_0%,rgba(139,92,246,0.04)_28%,transparent_66%)] dark:bg-[radial-gradient(circle_at_50%_48%,rgba(56,189,248,0.13)_0%,rgba(124,58,237,0.06)_30%,rgba(6,9,17,0)_68%)]"
      />

      {/* TOP FLOATING HUD */}
      <div className="pointer-events-none absolute inset-x-4 top-4 z-20 flex flex-wrap items-start justify-between gap-3">
        {/* Left Stack: Constellation Identity + Compact Orbital Legend */}
        <div className="pointer-events-auto flex flex-col items-start gap-2">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-900/[0.09] bg-white/85 px-3.5 py-2 shadow-sm backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0C111E]/85">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-900 dark:text-white">
                  Constellation
                </span>
                <span className="font-mono-num rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                  {positionedNodes.length} orbs
                </span>
              </div>
              <div className="font-mono-num text-[10.5px] text-slate-500 dark:text-slate-400">
                {crossAccountLinkCount} cross-account filament
                {crossAccountLinkCount === 1 ? '' : 's'}
              </div>
            </div>
          </div>

          <div className="hidden rounded-2xl border border-slate-900/[0.08] bg-white/80 px-3 py-2 text-[10.5px] backdrop-blur-xl lg:block dark:border-white/[0.08] dark:bg-[#0C111E]/80">
            <div className="space-y-1 text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500 shadow-[0_0_8px_#F43F5E]" />
                <span>Core = Urgent decisions</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-0.5 w-3.5 shrink-0 rounded-full bg-gradient-to-r from-sky-400 to-amber-400" />
                <span>Cross-account filament</span>
              </div>
            </div>
            <div className="mt-1.5 border-t border-slate-900/[0.07] pt-1.5 text-[9.5px] text-slate-400 dark:border-white/[0.07] dark:text-slate-500">
              Drag to pan, scroll to zoom, click orb
            </div>
          </div>
        </div>

        {/* Center: Account Spectrum Filter Pills */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-1 rounded-2xl border border-slate-900/[0.09] bg-white/85 p-1 shadow-sm backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0C111E]/85">
          <button
            type="button"
            onClick={() => setLocalAccountId('all')}
            className={`rounded-xl px-3 py-1.5 text-[11.5px] font-semibold transition-all ${
              localAccountId === 'all'
                ? 'bg-slate-900 text-white shadow-sm dark:bg-white/15 dark:text-white'
                : 'text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.06] dark:hover:text-slate-100'
            }`}
          >
            All ({nodes.length})
          </button>

          {accounts.map((acc) => {
            const active = localAccountId === acc.id;
            return (
              <button
                key={acc.id}
                type="button"
                onClick={() => setLocalAccountId(acc.id)}
                className={`inline-flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-[11.5px] font-medium transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-sm dark:bg-white/15 dark:text-white'
                    : 'text-slate-600 hover:bg-slate-900/[0.05] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.06] dark:hover:text-white'
                }`}
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    backgroundColor: acc.color,
                    boxShadow: active ? `0 0 8px ${acc.color}` : undefined,
                  }}
                />
                <span>{acc.label}</span>
                <span className="font-mono-num text-[10px] opacity-65">
                  {accountCounts[acc.id] ?? 0}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right: Zoom / Focus / Filament Toggle / Sweep Perimeter */}
        <div className="pointer-events-auto flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-2xl border border-slate-900/[0.09] bg-white/85 p-1 shadow-sm backdrop-blur-xl dark:border-white/[0.1] dark:bg-[#0C111E]/85">
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Number(Math.max(0.68, z - 0.16).toFixed(2)))
              }
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="font-mono-num rounded-lg px-2 py-1 text-[11px] font-medium text-slate-700 transition-colors hover:bg-slate-900/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]"
              title="Reset zoom and pan"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() =>
                setZoom((z) => Number(Math.min(2.2, z + 0.16).toFixed(2)))
              }
              className="rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-900 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-slate-900/[0.1] dark:bg-white/[0.1]" />
            <button
              type="button"
              onClick={handleFocusCore}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title="Focus on Urgent Core"
            >
              <Crosshair className="h-3.5 w-3.5 text-rose-500" />
              <span className="hidden xl:inline">Core</span>
            </button>
            <button
              type="button"
              onClick={() => setCrossAccountOnly((v) => !v)}
              className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors ${
                crossAccountOnly
                  ? 'bg-violet-500/20 text-violet-700 dark:text-violet-300'
                  : 'text-slate-600 hover:bg-slate-900/[0.06] dark:text-slate-300 dark:hover:bg-white/[0.08]'
              }`}
              title="Toggle cross-account filaments only"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span className="hidden xl:inline">Bridges</span>
            </button>
            <button
              type="button"
              onClick={handleResetView}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-900/[0.06] hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/[0.08] dark:hover:text-white"
              title="Fit universe"
              aria-label="Fit universe"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            disabled={perimeterNodes.length === 0 || isSweeping}
            onClick={handleSweep}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-500/30 bg-amber-500/15 px-3.5 py-2 text-[12px] font-semibold text-amber-800 shadow-sm backdrop-blur-xl transition-all hover:border-amber-500/50 hover:bg-amber-500/20 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 dark:border-amber-400/25 dark:bg-amber-400/15 dark:text-amber-200 dark:hover:border-amber-400/45 dark:hover:bg-amber-400/25"
          >
            <Trash2 className={`h-3.5 w-3.5 ${isSweeping ? 'animate-bounce' : ''}`} />
            <span>{isSweeping ? 'Sweeping...' : 'Sweep Perimeter'}</span>
            <span className="font-mono-num rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10.5px]">
              {perimeterNodes.length}
            </span>
          </button>
        </div>
      </div>

      {/* MAIN INTERACTIVE SVG UNIVERSE */}
      <div className="flex h-full w-full items-center justify-center px-4 pb-[108px] pt-[70px]">
        <svg
          viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
          className="h-full w-full max-h-full max-w-full overflow-visible"
          role="img"
          aria-label="Interactive 2D spatial email gravity constellation"
        >
          <defs>
            {/* Core gravity glow */}
            <radialGradient id="prism-core-nebula" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#F43F5E" stopOpacity="0.24" />
              <stop offset="45%" stopColor="#38BDF8" stopOpacity="0.11" />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
            </radialGradient>

            {/* Soft luminous glow filter for filaments and core orbs */}
            <filter id="prism-orb-glow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="4.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <filter id="prism-filament-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="2.6" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Dynamic linear gradients for every filament curve */}
            {filamentCurves.map((curve) => (
              <linearGradient
                key={curve.gradientId}
                id={curve.gradientId}
                gradientUnits="userSpaceOnUse"
                x1={curve.source.x}
                y1={curve.source.y}
                x2={curve.target.x}
                y2={curve.target.y}
              >
                <stop offset="0%" stopColor={curve.source.node.accountColor} />
                <stop offset="100%" stopColor={curve.target.node.accountColor} />
              </linearGradient>
            ))}

            {/* Specular sphere overlay */}
            <radialGradient id="prism-orb-specular" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.65" />
              <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.28" />
            </radialGradient>
          </defs>

          <g
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: `${CENTER_X}px ${CENTER_Y}px`,
              transition: isDragging
                ? 'none'
                : 'transform 260ms cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Subtle Architectural Radial Spokes */}
            <g className="text-slate-900/[0.06] dark:text-slate-300/[0.06]">
              {RADIAL_SPOKE_ANGLES.map((angle, i) => {
                const x2 = CENTER_X + Math.cos(angle) * 332;
                const y2 = CENTER_Y + Math.sin(angle) * 332;
                return (
                  <line
                    key={i}
                    x1={CENTER_X}
                    y1={CENTER_Y}
                    x2={x2}
                    y2={y2}
                    stroke="currentColor"
                    strokeWidth={i % 3 === 0 ? 1 : 0.65}
                    strokeDasharray={i % 3 === 0 ? undefined : '2 6'}
                  />
                );
              })}
            </g>

            {/* Core Nebula Glow */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={124}
              fill="url(#prism-core-nebula)"
            />

            {/* Sweeping Pulse Ring when Sweep Perimeter triggers */}
            {isSweeping && (
              <motion.circle
                cx={CENTER_X}
                cy={CENTER_Y}
                initial={{ r: 266, opacity: 0.85, strokeWidth: 4 }}
                animate={{ r: 380, opacity: 0, strokeWidth: 1 }}
                transition={{ duration: 0.48, ease: 'easeOut' }}
                fill="none"
                stroke="#F59E0B"
              />
            )}

            {/* 4 Luminous Concentric Orbital Rings + Crisp Monospace Labels */}
            {ORBIT_RINGS.map((ring) => {
              const isCore = ring.key === 'core';
              const isPerimeter = ring.key === 'perimeter';
              return (
                <g key={ring.key}>
                  <circle
                    cx={CENTER_X}
                    cy={CENTER_Y}
                    r={ring.outerRadius}
                    fill="none"
                    className={
                      isCore
                        ? 'stroke-rose-500/35 dark:stroke-rose-400/35'
                        : isPerimeter
                          ? 'stroke-slate-900/[0.11] dark:stroke-slate-400/[0.14]'
                          : 'stroke-slate-900/[0.12] dark:stroke-sky-200/[0.14]'
                    }
                    strokeWidth={isCore ? 1.35 : 1}
                    strokeDasharray={isPerimeter ? '4 6' : isCore ? undefined : '1.5 5'}
                  />

                  {/* Crisp Monospace Ring Header Label along top vertical axis */}
                  <g transform={`translate(${CENTER_X}, ${CENTER_Y - ring.outerRadius})`}>
                    <rect
                      x={-68}
                      y={-10}
                      width={136}
                      height={18}
                      rx={9}
                      className="fill-[#F8F7F4]/95 stroke-slate-900/[0.08] dark:fill-[#070B14]/95 dark:stroke-white/[0.09]"
                      strokeWidth={0.8}
                    />
                    <text
                      x={0}
                      y={2.5}
                      textAnchor="middle"
                      className="font-mono-num fill-slate-600 text-[8.5px] font-semibold tracking-[0.14em] dark:fill-slate-400"
                    >
                      {ring.code} {ring.label}
                    </text>
                  </g>
                </g>
              );
            })}

            {/* Center Gravity Singularity Mark */}
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={4}
              className="fill-rose-500/70 dark:fill-rose-400/80"
            />
            <circle
              cx={CENTER_X}
              cy={CENTER_Y}
              r={10}
              fill="none"
              className="stroke-rose-500/30 dark:stroke-rose-400/30"
              strokeWidth={1}
            />

            {/* CROSS-ACCOUNT & CONTEXTUAL FILAMENTS */}
            <g>
              {filamentCurves.map((curve, idx) => {
                const isDirectHover = hoveredLinkIdx === idx;
                const isClusterMember =
                  activeClusterIds !== null &&
                  activeClusterIds.has(curve.link.sourceThreadId) &&
                  activeClusterIds.has(curve.link.targetThreadId);

                const matchesSpotlight =
                  !spotlightSet ||
                  (spotlightSet.has(curve.link.sourceThreadId) &&
                    spotlightSet.has(curve.link.targetThreadId));

                let opacity = curve.link.crossAccount ? 0.62 : 0.28;
                if (spotlightSet) {
                  opacity = matchesSpotlight ? 0.85 : 0.08;
                }
                if (activeClusterIds) {
                  opacity = isClusterMember || isDirectHover ? 0.96 : 0.1;
                }

                return (
                  <g key={`${curve.link.sourceThreadId}-${curve.link.targetThreadId}-${idx}`}>
                    {/* Invisible wider hit-target for effortless filament hovering */}
                    <path
                      d={curve.pathD}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={14}
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredLinkIdx(idx)}
                      onMouseLeave={() => setHoveredLinkIdx(null)}
                    />
                    {/* Luminous Filament Arc */}
                    <path
                      d={curve.pathD}
                      fill="none"
                      stroke={`url(#${curve.gradientId})`}
                      strokeWidth={
                        isDirectHover || isClusterMember
                          ? 2.8
                          : curve.link.crossAccount
                            ? 1.9
                            : 1.15
                      }
                      strokeDasharray={curve.link.crossAccount ? undefined : '4 4'}
                      strokeLinecap="round"
                      opacity={opacity}
                      filter={
                        curve.link.crossAccount || isClusterMember || isDirectHover
                          ? 'url(#prism-filament-glow)'
                          : undefined
                      }
                      style={{ transition: 'opacity 200ms ease, stroke-width 200ms ease' }}
                    />
                    {/* Subtle Luminous Bridge Node on Cross-Account Filaments */}
                    {curve.link.crossAccount && (
                      <circle
                        cx={curve.midX}
                        cy={curve.midY}
                        r={isDirectHover || isClusterMember ? 3.8 : 2.4}
                        fill="#FFFFFF"
                        stroke={curve.source.node.accountColor}
                        strokeWidth={1.4}
                        opacity={opacity}
                        className="pointer-events-none"
                      />
                    )}
                  </g>
                );
              })}
            </g>

            {/* THREAD ORBS LAYER */}
            <g>
              {positionedNodes.map((pos) => {
                const { node, x, y, orbRadius } = pos;
                const isSelected = selectedThreadId === node.threadId;
                const isHovered = hoveredNodeId === node.threadId;
                const isPerimeter = node.ring === 'perimeter';
                const isHighUrgency = node.ring === 'core' || node.urgencyScore >= 80;
                const isSpotlightMatch = spotlightSet ? spotlightSet.has(node.threadId) : false;

                let nodeOpacity = 1;
                if (spotlightSet) {
                  nodeOpacity = isSpotlightMatch ? 1 : 0.15;
                } else if (activeClusterIds) {
                  nodeOpacity = activeClusterIds.has(node.threadId) ? 1 : 0.24;
                }

                // Sweep outward vector when sweeping perimeter
                const sweepShiftX = isSweeping && isPerimeter ? Math.cos(pos.angleRad) * 140 : 0;
                const sweepShiftY = isSweeping && isPerimeter ? Math.sin(pos.angleRad) * 140 : 0;

                return (
                  <g
                    key={node.threadId}
                    data-orb="true"
                    transform={`translate(${(x + sweepShiftX).toFixed(1)}, ${(y + sweepShiftY).toFixed(1)})`}
                    opacity={isSweeping && isPerimeter ? 0 : nodeOpacity}
                    style={{
                      transition:
                        'transform 440ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease',
                    }}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNodeId(node.threadId)}
                    onMouseLeave={() =>
                      setHoveredNodeId((prev) =>
                        prev === node.threadId ? null : prev,
                      )
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectThread(node.threadId);
                    }}
                  >
                    {/* Pulsing Halo for Unread Urgent Nodes */}
                    {node.isUnread && isHighUrgency && (
                      <motion.circle
                        cx={0}
                        cy={0}
                        fill="none"
                        stroke={node.accountColor}
                        strokeWidth={1.6}
                        initial={{ r: orbRadius + 2, opacity: 0.7 }}
                        animate={{
                          r: [orbRadius + 2, orbRadius + 13, orbRadius + 2],
                          opacity: [0.65, 0.05, 0.65],
                        }}
                        transition={{
                          duration: 2.8,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                      />
                    )}

                    {/* Spotlight Focus Ring */}
                    {isSpotlightMatch && (
                      <motion.circle
                        cx={0}
                        cy={0}
                        fill="none"
                        stroke="#38BDF8"
                        strokeWidth={2}
                        strokeDasharray="4 3"
                        initial={{ r: orbRadius + 5, opacity: 0 }}
                        animate={{ r: orbRadius + 8, opacity: 0.95 }}
                      />
                    )}

                    {/* Selected Reticle Ring */}
                    {(isSelected || isHovered) && (
                      <circle
                        cx={0}
                        cy={0}
                        r={orbRadius + 5.5}
                        fill="none"
                        stroke={node.accountColor}
                        strokeWidth={isSelected ? 2 : 1.4}
                        strokeDasharray={isSelected ? undefined : '3 3'}
                        opacity={0.95}
                      />
                    )}

                    {/* Ambient Colored Halo */}
                    <circle
                      cx={0}
                      cy={0}
                      r={orbRadius + 4}
                      fill={node.accountColor}
                      opacity={isHovered || isSelected || isSpotlightMatch ? 0.3 : 0.14}
                    />

                    {/* Main Luminous Orb Body */}
                    <circle
                      cx={0}
                      cy={0}
                      r={orbRadius}
                      fill={node.accountColor}
                      filter={isHighUrgency || isSpotlightMatch ? 'url(#prism-orb-glow)' : undefined}
                      className="stroke-white/85 dark:stroke-[#060911]/85"
                      strokeWidth={1.6}
                    />

                    {/* Glassy Specular Gradient Overlay */}
                    <circle
                      cx={0}
                      cy={0}
                      r={orbRadius - 0.5}
                      fill="url(#prism-orb-specular)"
                    />

                    {/* Unread Crisp Center Beacon */}
                    {node.isUnread && (
                      <circle cx={0} cy={0} r={2.3} fill="#FFFFFF" opacity={0.92} />
                    )}
                  </g>
                );
              })}
            </g>

            {/* TOPMOST FLOATING LABELS LAYER (ALWAYS ABOVE ALL ORBS) */}
            <g className="pointer-events-none">
              {floatingLabels.map((lbl) => {
                const centerX = lbl.boxX + lbl.boxWidth / 2;
                const centerY = lbl.boxY + lbl.boxHeight / 2;
                const dist = Math.hypot(centerX - lbl.orbX, centerY - lbl.orbY);
                const anchorX = Math.max(
                  lbl.boxX + 4,
                  Math.min(lbl.boxX + lbl.boxWidth - 4, lbl.orbX),
                );
                const anchorY = Math.max(
                  lbl.boxY + 2,
                  Math.min(lbl.boxY + lbl.boxHeight - 2, lbl.orbY),
                );

                return (
                  <g
                    key={`label-${lbl.threadId}`}
                    opacity={lbl.opacity}
                    style={{ transition: 'opacity 200ms ease' }}
                  >
                    {dist > lbl.orbRadius + 10 && (
                      <line
                        x1={lbl.orbX}
                        y1={lbl.orbY}
                        x2={anchorX}
                        y2={anchorY}
                        stroke={lbl.accountColor}
                        strokeOpacity={lbl.emphasized ? 0.6 : 0.32}
                        strokeWidth={0.9}
                      />
                    )}
                    <rect
                      x={lbl.boxX}
                      y={lbl.boxY}
                      width={lbl.boxWidth}
                      height={lbl.boxHeight}
                      rx={9.5}
                      className="fill-[#FFFFFF]/95 stroke-slate-900/15 dark:fill-[#0B101D]/95 dark:stroke-white/15"
                      strokeWidth={lbl.emphasized ? 1.1 : 0.85}
                    />
                    <circle
                      cx={lbl.boxX + 8.5}
                      cy={lbl.boxY + lbl.boxHeight / 2}
                      r={2.2}
                      fill={lbl.accountColor}
                    />
                    <text
                      x={lbl.boxX + 14.5}
                      y={lbl.boxY + 13}
                      className="fill-slate-900 text-[9.5px] font-semibold tracking-[-0.01em] dark:fill-slate-100"
                    >
                      {lbl.text}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Floating Midpoint Reason Badge for Hovered Filament (Topmost) */}
            {hoveredCurve && (
              <g
                transform={`translate(${hoveredCurve.midX}, ${hoveredCurve.midY})`}
                className="pointer-events-none"
              >
                <rect
                  x={-118}
                  y={-15}
                  width={236}
                  height={28}
                  rx={14}
                  className="fill-white/95 stroke-violet-500/40 dark:fill-[#0F1627]/95 dark:stroke-violet-400/45"
                  strokeWidth={1}
                />
                <text
                  x={0}
                  y={3}
                  textAnchor="middle"
                  className="fill-slate-900 text-[10.5px] font-semibold dark:fill-violet-100"
                >
                  {hoveredCurve.link.crossAccount ? 'Cross-Account: ' : ''}
                  {hoveredCurve.link.reason.length > 34
                    ? `${hoveredCurve.link.reason.slice(0, 33)}...`
                    : hoveredCurve.link.reason}
                </text>
              </g>
            )}
          </g>
        </svg>
      </div>

      {/* Frosted-Glass Hover Inspection Card */}
      <AnimatePresence>
        {hoveredPositioned && !isDragging && (
          <ConstellationTooltip
            node={hoveredPositioned.node}
            thread={threadsById[hoveredPositioned.node.threadId]}
            relatedLinks={hoveredNodeLinks}
            screenX={pointerPos.x}
            screenY={pointerPos.y}
            containerWidth={containerSize.width}
            containerHeight={containerSize.height}
          />
        )}
      </AnimatePresence>

      {/* BOTTOM-CENTER FLOATING CLAUDE SPOTLIGHT BAR */}
      <div className="pointer-events-none absolute inset-x-4 bottom-5 z-20 flex justify-center">
        <div className="pointer-events-auto w-full max-w-[600px] space-y-2">
          {/* Quick Spotlight Presets */}
          {!spotlightSet && (
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {SPOTLIGHT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => handleRunSpotlight(preset.query)}
                  className="rounded-full border border-slate-900/[0.09] bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-600 shadow-sm backdrop-blur-xl transition-all hover:border-sky-500/40 hover:text-sky-700 dark:border-white/[0.1] dark:bg-[#0D1322]/85 dark:text-slate-300 dark:hover:border-sky-400/40 dark:hover:text-sky-200"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          )}

          {/* Spotlight Command Capsule */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleRunSpotlight(spotlightInput);
            }}
            className="flex items-center gap-2 rounded-2xl border border-slate-900/[0.12] bg-white/95 px-3.5 py-2 shadow-[0_14px_38px_-12px_rgba(15,23,42,0.22)] backdrop-blur-2xl transition-all focus-within:border-sky-500/50 dark:border-white/[0.14] dark:bg-[#0D1322]/95 dark:shadow-[0_18px_46px_-12px_rgba(0,0,0,0.85)] dark:focus-within:border-sky-400/50"
          >
            <Sparkles
              className={`h-4 w-4 shrink-0 text-sky-500 dark:text-sky-400 ${
                spotlightLoading ? 'animate-pulse' : ''
              }`}
            />
            <input
              type="text"
              value={spotlightInput}
              onChange={(e) => setSpotlightInput(e.target.value)}
              placeholder='Claude Spotlight: "Everything involving contracts or money"...'
              className="min-w-0 flex-1 bg-transparent text-[13px] text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white dark:placeholder:text-slate-500"
            />

            {spotlightSet && (
              <span className="font-mono-num shrink-0 rounded-full border border-sky-500/30 bg-sky-500/15 px-2 py-0.5 text-[11px] font-semibold text-sky-700 dark:border-sky-400/30 dark:text-sky-300">
                {spotlightSet.size} illuminated
              </span>
            )}

            {(spotlightSet || spotlightInput) && (
              <button
                type="button"
                onClick={handleClearSpotlight}
                className="inline-flex items-center gap-1 rounded-xl border border-slate-900/[0.08] bg-slate-900/[0.04] px-2.5 py-1.5 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-slate-900/[0.08] hover:text-slate-950 dark:border-white/[0.09] dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/[0.1] dark:hover:text-white"
              >
                <X className="h-3 w-3" />
                <span>Clear</span>
              </button>
            )}

            <button
              type="submit"
              disabled={spotlightLoading || !spotlightInput.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-[12px] font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-sky-500 dark:text-slate-950 dark:hover:bg-sky-400"
            >
              <Search className="h-3.5 w-3.5" />
              <span>{spotlightLoading ? 'Scanning' : 'Spotlight'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
