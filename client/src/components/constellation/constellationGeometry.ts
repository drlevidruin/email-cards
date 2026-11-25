import type { ConstellationLink, ConstellationNode } from '../../lib/types';

export const CANVAS_WIDTH = 1040;
export const CANVAS_HEIGHT = 720;
export const CENTER_X = CANVAS_WIDTH / 2;
export const CENTER_Y = CANVAS_HEIGHT / 2;

export type RingKey = ConstellationNode['ring'];

export interface RingDefinition {
  key: RingKey;
  code: string;
  label: string;
  subtitle: string;
  outerRadius: number;
  minRadius: number;
  maxRadius: number;
  accent: string;
}

export const ORBIT_RINGS: RingDefinition[] = [
  {
    key: 'core',
    code: '01',
    label: 'URGENT CORE',
    subtitle: 'Decisions needing immediate action',
    outerRadius: 96,
    minRadius: 50,
    maxRadius: 82,
    accent: '#FB7185',
  },
  {
    key: 'orbit',
    code: '02',
    label: 'ACTIVE ORBIT',
    subtitle: 'High-priority ongoing threads',
    outerRadius: 172,
    minRadius: 118,
    maxRadius: 156,
    accent: '#38BDF8',
  },
  {
    key: 'outer',
    code: '03',
    label: 'WAITING / FYI',
    subtitle: 'Open loops & reference context',
    outerRadius: 246,
    minRadius: 192,
    maxRadius: 230,
    accent: '#A78BFA',
  },
  {
    key: 'perimeter',
    code: '04',
    label: 'PERIMETER DRIFT',
    subtitle: 'Newsletters, receipts & ambient drift',
    outerRadius: 318,
    minRadius: 268,
    maxRadius: 304,
    accent: '#64748B',
  },
];

export const RING_MAP: Record<RingKey, RingDefinition> = {
  core: ORBIT_RINGS[0],
  orbit: ORBIT_RINGS[1],
  outer: ORBIT_RINGS[2],
  perimeter: ORBIT_RINGS[3],
};

export interface PositionedNode {
  node: ConstellationNode;
  x: number;
  y: number;
  orbRadius: number;
  angleRad: number;
  orbitDist: number;
}

function hashString(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

export function computeOrbRadius(node: ConstellationNode): number {
  const urgencyFactor = Math.max(0, Math.min(1, node.urgencyScore / 100));
  const activityFactor = Math.min(1, Math.log2(Math.max(1, node.messageCount) + 1) / 3);
  const ringBonus =
    node.ring === 'core' ? 4.2 : node.ring === 'orbit' ? 2.2 : node.ring === 'outer' ? 0.8 : 0;
  return Number((7.2 + urgencyFactor * 4.4 + activityFactor * 2.8 + ringBonus).toFixed(1));
}

export function layoutConstellationNodes(nodes: ConstellationNode[]): PositionedNode[] {
  // Group nodes by ring and distribute cleanly while respecting server angle hints
  const byRing: Record<RingKey, ConstellationNode[]> = {
    core: [],
    orbit: [],
    outer: [],
    perimeter: [],
  };

  for (const node of nodes) {
    const key: RingKey = byRing[node.ring] ? node.ring : 'outer';
    byRing[key].push(node);
  }

  const placed: PositionedNode[] = [];

  for (const ringDef of ORBIT_RINGS) {
    const group = [...byRing[ringDef.key]];
    if (group.length === 0) continue;

    // Sort by server angle hint (normalized) with deterministic hash tiebreaker
    group.sort((a, b) => {
      const angA = Number.isFinite(a.angle) ? a.angle : (hashString(a.threadId) % 360) * (Math.PI / 180);
      const angB = Number.isFinite(b.angle) ? b.angle : (hashString(b.threadId) % 360) * (Math.PI / 180);
      return angA - angB;
    });

    // Straddle the 12 o'clock meridian (-PI/2) symmetrically so no orb collides with ring header pills
    const step = (Math.PI * 2) / group.length;
    const fineStagger: Record<RingKey, number> = {
      core: 0,
      orbit: Math.min(0.1, step * 0.08),
      outer: -Math.min(0.1, step * 0.08),
      perimeter: 0,
    };
    const baseOffset = -Math.PI / 2 + step / 2 + fineStagger[ringDef.key];

    group.forEach((node, idx) => {
      const h = hashString(node.threadId);
      // Slight deterministic radial wave so orbs feel organic and avoid vertical label collisions
      const radialFraction =
        group.length === 1
          ? 0.45
          : ((idx % 2 === 0 ? 0.28 : 0.72) + ((h % 19) - 9) * 0.012);
      const clampedFraction = Math.max(0.14, Math.min(0.86, radialFraction));
      const orbitDist =
        ringDef.minRadius + clampedFraction * (ringDef.maxRadius - ringDef.minRadius);

      const evenAngle = baseOffset + idx * step;
      const jitter = (((h >> 4) % 100) / 100 - 0.5) * Math.min(0.16, step * 0.16);
      const angleRad = evenAngle + jitter;

      const x = CENTER_X + Math.cos(angleRad) * orbitDist;
      const y = CENTER_Y + Math.sin(angleRad) * orbitDist;

      placed.push({
        node,
        x,
        y,
        orbRadius: computeOrbRadius(node),
        angleRad,
        orbitDist,
      });
    });
  }

  // Gentle anti-collision relaxation pass inside ring boundaries
  for (let iter = 0; iter < 10; iter += 1) {
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        const a = placed[i];
        const b = placed[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.001;
        const minGap = a.orbRadius + b.orbRadius + 18;
        if (dist < minGap) {
          const push = (minGap - dist) * 0.45;
          const ux = dx / dist;
          const uy = dy / dist;
          a.x -= ux * push;
          a.y -= uy * push;
          b.x += ux * push;
          b.y += uy * push;
        }
      }
    }

    // Re-clamp each node gently into its assigned orbital band
    for (const item of placed) {
      const def = RING_MAP[item.node.ring] ?? RING_MAP.outer;
      const dx = item.x - CENTER_X;
      const dy = item.y - CENTER_Y;
      const dist = Math.hypot(dx, dy) || 1;
      const clamped = Math.max(def.minRadius, Math.min(def.maxRadius, dist));
      item.x = CENTER_X + (dx / dist) * clamped;
      item.y = CENTER_Y + (dy / dist) * clamped;
      item.orbitDist = clamped;
      item.angleRad = Math.atan2(dy, dx);
    }
  }

  return placed;
}

export interface FilamentCurve {
  link: ConstellationLink;
  source: PositionedNode;
  target: PositionedNode;
  pathD: string;
  midX: number;
  midY: number;
  gradientId: string;
}

export function buildFilamentCurves(
  links: ConstellationLink[],
  positionedById: Map<string, PositionedNode>,
): FilamentCurve[] {
  const curves: FilamentCurve[] = [];

  links.forEach((link, idx) => {
    const source = positionedById.get(link.sourceThreadId);
    const target = positionedById.get(link.targetThreadId);
    if (!source || !target) return;

    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const mx = (source.x + target.x) / 2;
    const my = (source.y + target.y) / 2;

    // Curve gracefully perpendicular to chord, bowed slightly away from dense center
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const toCenterX = mx - CENTER_X;
    const toCenterY = my - CENTER_Y;
    const sign = nx * toCenterX + ny * toCenterY >= 0 ? 1 : -1;
    const bend = Math.min(68, Math.max(24, len * 0.2));

    const cx = mx + nx * bend * sign;
    const cy = my + ny * bend * sign;

    // Quadratic bezier midpoint at t = 0.5
    const midX = 0.25 * source.x + 0.5 * cx + 0.25 * target.x;
    const midY = 0.25 * source.y + 0.5 * cy + 0.25 * target.y;

    curves.push({
      link,
      source,
      target,
      pathD: `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
      midX,
      midY,
      gradientId: `filament-grad-${idx}`,
    });
  });

  return curves;
}

export interface PlacedFloatingLabel {
  threadId: string;
  text: string;
  accountColor: string;
  orbX: number;
  orbY: number;
  orbRadius: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
  opacity: number;
  emphasized: boolean;
}

export function formatCompactOrbLabel(name: string, expanded: boolean): string {
  const cleaned = name.trim();
  if (expanded) {
    return cleaned.length > 20 ? `${cleaned.slice(0, 19)}...` : cleaned;
  }
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && cleaned.length > 12) {
    const compact = `${parts[0]} ${parts[parts.length - 1][0]}.`;
    return compact.length > 14 ? `${compact.slice(0, 13)}...` : compact;
  }
  return cleaned.length > 14 ? `${cleaned.slice(0, 13)}...` : cleaned;
}

export function layoutFloatingLabels(
  items: {
    pos: PositionedNode;
    shiftX: number;
    shiftY: number;
    opacity: number;
    emphasized: boolean;
  }[],
  allNodes: PositionedNode[],
): PlacedFloatingLabel[] {
  const height = 19;

  const boxes: PlacedFloatingLabel[] = items.map(({ pos, shiftX, shiftY, opacity, emphasized }) => {
    const ox = pos.x + shiftX;
    const oy = pos.y + shiftY;
    const text = formatCompactOrbLabel(pos.node.fromName, emphasized);
    const width = Math.max(54, Math.round(text.length * 6.0 + 20));

    // Place radially outward from center so Core labels fan cleanly outward into clear space
    const cos = Math.cos(pos.angleRad);
    const sin = Math.sin(pos.angleRad);
    let bx: number;
    let by: number;

    if (Math.abs(cos) < 0.28) {
      // Near top or bottom vertical axis: center horizontally and push outward vertically
      bx = ox - width / 2;
      by = sin >= 0 ? oy + pos.orbRadius + 7 : oy - pos.orbRadius - height - 7;
    } else if (cos >= 0) {
      bx = ox + pos.orbRadius + 8;
      by = oy - height / 2 + sin * 6;
    } else {
      bx = ox - pos.orbRadius - width - 8;
      by = oy - height / 2 + sin * 6;
    }

    return {
      threadId: pos.node.threadId,
      text,
      accountColor: pos.node.accountColor,
      orbX: ox,
      orbY: oy,
      orbRadius: pos.orbRadius,
      boxX: bx,
      boxY: by,
      boxWidth: width,
      boxHeight: height,
      opacity,
      emphasized,
    };
  });

  // Fixed ring header pill obstacles along the 12 o'clock meridian
  const ringLabelRects = ORBIT_RINGS.map((ring) => ({
    x: CENTER_X - 72,
    y: CENTER_Y - ring.outerRadius - 12,
    w: 144,
    h: 22,
  }));

  // Anti-collision pass: separate overlapping label boxes, ring headers, and orbs
  for (let iter = 0; iter < 18; iter += 1) {
    // 1. Pairwise label box separation
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        const a = boxes[i];
        const b = boxes[j];
        const padX = 5;
        const padY = 4;
        const overlapX =
          Math.min(a.boxX + a.boxWidth + padX, b.boxX + b.boxWidth + padX) -
          Math.max(a.boxX - padX, b.boxX - padX);
        const overlapY =
          Math.min(a.boxY + a.boxHeight + padY, b.boxY + b.boxHeight + padY) -
          Math.max(a.boxY - padY, b.boxY - padY);

        if (overlapX > 0 && overlapY > 0) {
          const aCenterY = a.boxY + a.boxHeight / 2;
          const bCenterY = b.boxY + b.boxHeight / 2;
          const dirY = aCenterY <= bCenterY ? -1 : 1;
          const shift = Math.min(overlapY * 0.55, 8);
          a.boxY += dirY * shift;
          b.boxY -= dirY * shift;
        }
      }
    }

    // 2. Keep label boxes clear of the 4 ring header pills at 12 o'clock
    for (const box of boxes) {
      for (const rect of ringLabelRects) {
        const padX = 6;
        const padY = 5;
        const overlapX =
          Math.min(box.boxX + box.boxWidth + padX, rect.x + rect.w + padX) -
          Math.max(box.boxX - padX, rect.x - padX);
        const overlapY =
          Math.min(box.boxY + box.boxHeight + padY, rect.y + rect.h + padY) -
          Math.max(box.boxY - padY, rect.y - padY);
        if (overlapX > 0 && overlapY > 0) {
          const boxCenterX = box.boxX + box.boxWidth / 2;
          const dirX = boxCenterX < CENTER_X ? -1 : 1;
          box.boxX += dirX * Math.min(overlapX * 0.65, 12);
          box.boxY += Math.min(overlapY * 0.35, 6);
        }
      }
    }

    // 3. Keep label boxes clear of other orbs
    for (const box of boxes) {
      for (const other of allNodes) {
        if (other.node.threadId === box.threadId) continue;
        const pad = other.orbRadius + 5;
        const closestX = Math.max(box.boxX, Math.min(other.x, box.boxX + box.boxWidth));
        const closestY = Math.max(box.boxY, Math.min(other.y, box.boxY + box.boxHeight));
        const dx = closestX - other.x;
        const dy = closestY - other.y;
        const dist = Math.hypot(dx, dy);
        if (dist < pad) {
          const push = (pad - dist) * 0.6;
          if (Math.abs(dy) >= Math.abs(dx) || dist < 0.01) {
            box.boxY += (box.boxY + box.boxHeight / 2 >= other.y ? 1 : -1) * push;
          } else {
            box.boxX += (box.boxX + box.boxWidth / 2 >= other.x ? 1 : -1) * push;
          }
        }
      }

      // Gently tether box within reasonable distance of its own orb
      const boxCenterX = box.boxX + box.boxWidth / 2;
      const boxCenterY = box.boxY + box.boxHeight / 2;
      const dx = boxCenterX - box.orbX;
      const dy = boxCenterY - box.orbY;
      const maxReach = box.boxWidth / 2 + box.orbRadius + 34;
      const d = Math.hypot(dx, dy);
      if (d > maxReach) {
        const pull = (d - maxReach) * 0.35;
        box.boxX -= (dx / d) * pull;
        box.boxY -= (dy / d) * pull;
      }
    }
  }

  return boxes;
}
