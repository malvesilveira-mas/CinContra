import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Plus, ShieldCheck, X } from 'lucide-react';
import {
  DOMAIN_LABELS,
  getProfessionalFullTitle,
  getProfessionalShortLabel,
  SKILL_LABELS,
} from '../data/professionals';
import { MemberWithRationale, SocialEdge } from '../types/cincontra';

interface SquadRelationGraphProps {
  membersWithRationale: MemberWithRationale[];
  edges: SocialEdge[];
  hasFacilitator: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onSwapMember: (targetSquadId: string, incomingBankId: string) => void;
  onAddMember: (incomingBankId: string) => void;
  onDraggingMemberChange: (memberId: string | null) => void;
}

interface NodePixelCoord {
  x: number;
  y: number;
}

interface ComputedLayout {
  nodes: NodePixelCoord[];
  nodeScale: number;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

const BASE_CARD_W = 168;
const BASE_CARD_H = 78;
const MIN_GAP = 16;
const EDGE_PAD = 10;
const LEGEND_RESERVED_H = 34;

function getRingAngles(count: number): number[] {
  if (count <= 1) return [0];
  if (count === 2) return [Math.PI, 0];
  if (count === 3) {
    return [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
  }
  if (count === 4) {
    return [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
  }
  if (count === 6) {
    // Flat-top hexagon: 2 top, 2 middle sides, 2 bottom — maximum clearance
    return [
      (-2 * Math.PI) / 3,
      -Math.PI / 3,
      0,
      Math.PI / 3,
      (2 * Math.PI) / 3,
      Math.PI,
    ];
  }
  if (count === 8) {
    // Shifted octagon: 2 top, 2 upper-sides, 2 lower-sides, 2 bottom
    return Array.from(
      { length: 8 },
      (_, i) => -Math.PI / 2 - Math.PI / 8 + (i * Math.PI) / 4
    );
  }
  // Odd counts (5, 7, 9+): peak at top center, evenly distributed around ellipse
  return Array.from(
    { length: count },
    (_, i) => -Math.PI / 2 + (i * Math.PI * 2) / count
  );
}

function solveNonOverlappingLayout(
  count: number,
  width: number,
  height: number
): ComputedLayout {
  const safeW = Math.max(320, width);
  const safeH = Math.max(220, height);
  const usableH = Math.max(180, safeH - LEGEND_RESERVED_H);
  const cx = safeW / 2;
  const cy = usableH / 2;

  if (count <= 0) {
    return {
      nodes: [],
      nodeScale: 1,
      cx,
      cy,
      rx: safeW * 0.34,
      ry: usableH * 0.36,
    };
  }

  const candidateScales = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.64, 0.58];
  const angles = getRingAngles(count);

  let bestResult: ComputedLayout | null = null;

  for (const scale of candidateScales) {
    const cardW = BASE_CARD_W * scale;
    const cardH = BASE_CARD_H * scale;
    const minDx = cardW + MIN_GAP * scale;
    const minDy = cardH + MIN_GAP * scale;

    const minX = cardW / 2 + EDGE_PAD;
    const maxX = Math.max(minX, safeW - cardW / 2 - EDGE_PAD);
    const minY = cardH / 2 + EDGE_PAD;
    const maxY = Math.max(minY, usableH - cardH / 2 - EDGE_PAD);

    const maxRx = Math.max(0, (maxX - minX) / 2);
    const maxRy = Math.max(0, (maxY - minY) / 2);

    const rxFactor = count <= 2 ? 0.56 : count <= 4 ? 0.84 : 0.96;
    const ryFactor = count <= 2 ? 0 : count <= 4 ? 0.88 : 0.96;
    const rx = maxRx * rxFactor;
    const ry = maxRy * ryFactor;

    const pts: NodePixelCoord[] =
      count === 1
        ? [{ x: cx, y: cy }]
        : angles.map((angle) => ({
            x: cx + Math.cos(angle) * rx,
            y: cy + Math.sin(angle) * ry,
          }));

    // Deterministic AABB collision-resolution solver
    let hasOverlap = false;
    for (let iter = 0; iter < 50; iter++) {
      hasOverlap = false;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[j].x - pts[i].x;
          const dy = pts[j].y - pts[i].y;
          const overlapX = minDx - Math.abs(dx);
          const overlapY = minDy - Math.abs(dy);

          if (overlapX > 0.5 && overlapY > 0.5) {
            hasOverlap = true;
            if (overlapX < overlapY) {
              const push = overlapX / 2 + 0.5;
              const dir = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
              pts[i].x -= dir * push;
              pts[j].x += dir * push;
            } else {
              const push = overlapY / 2 + 0.5;
              const dir = dy === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dy);
              pts[i].y -= dir * push;
              pts[j].y += dir * push;
            }
          }
        }
      }

      for (let i = 0; i < pts.length; i++) {
        pts[i].x = Math.min(maxX, Math.max(minX, pts[i].x));
        pts[i].y = Math.min(maxY, Math.max(minY, pts[i].y));
      }

      if (!hasOverlap) break;
    }

    let stillOverlapping = false;
    for (let i = 0; i < pts.length && !stillOverlapping; i++) {
      for (let j = i + 1; j < pts.length; j++) {
        if (
          Math.abs(pts[j].x - pts[i].x) < cardW + 4 &&
          Math.abs(pts[j].y - pts[i].y) < cardH + 4
        ) {
          stillOverlapping = true;
          break;
        }
      }
    }

    bestResult = {
      nodes: pts,
      nodeScale: scale,
      cx,
      cy,
      rx: Math.max(40, rx * 0.92),
      ry: Math.max(30, ry * 0.92),
    };

    if (!stillOverlapping) {
      return bestResult;
    }
  }

  return bestResult!;
}

export const SquadRelationGraph: React.FC<SquadRelationGraphProps> = ({
  membersWithRationale,
  edges,
  hasFacilitator,
  expandedIds,
  onToggleExpand,
  onSwapMember,
  onAddMember,
  onDraggingMemberChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: 880,
    height: 430,
  });
  const [hoveredMemberId, setHoveredMemberId] = useState<string | null>(null);
  const [dragOverBalloonId, setDragOverBalloonId] = useState<string | null>(
    null
  );
  const [isDragOverFreeCenter, setIsDragOverFreeCenter] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Use clientWidth/clientHeight (untransformed CSS layout box) so parent
    // entrance scale animations never skew balloon vs SVG coordinates.
    const updateSize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) {
        setSize((prev) =>
          Math.abs(prev.width - w) > 1 || Math.abs(prev.height - h) > 1
            ? { width: w, height: h }
            : prev
        );
      }
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(el);
    window.addEventListener('resize', updateSize, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateSize);
    };
  }, []);

  const layout = useMemo(
    () =>
      solveNonOverlappingLayout(
        membersWithRationale.length,
        size.width,
        size.height
      ),
    [membersWithRationale.length, size.width, size.height]
  );

  const posById = useMemo(() => {
    const map = new Map<string, NodePixelCoord>();
    membersWithRationale.forEach((item, idx) => {
      map.set(
        item.professional.id,
        layout.nodes[idx] ?? { x: layout.cx, y: layout.cy }
      );
    });
    return map;
  }, [membersWithRationale, layout]);

  const affinityEdges = edges.filter((e) => e.type === 'afinidade');
  const frictionEdges = edges.filter((e) => e.type === 'atrito');

  return (
    <div
      ref={containerRef}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('application/x-cincontra-bank')) {
          e.preventDefault();
          if (!dragOverBalloonId) {
            setIsDragOverFreeCenter(true);
          }
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) {
          setIsDragOverFreeCenter(false);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverFreeCenter(false);
        const bankId = e.dataTransfer.getData('application/x-cincontra-bank');
        if (bankId && !dragOverBalloonId) {
          onAddMember(bankId);
        }
      }}
      className="relative w-full h-full select-none"
    >
      {/* Subtle drop-to-add hint over empty background */}
      {isDragOverFreeCenter && (
        <div className="pointer-events-none fixed left-1/2 -translate-x-1/2 top-[48%] z-10 rounded-full border border-[#A3C9D9]/55 bg-[#0D1821]/90 px-4 py-1.5 text-xs text-[#A3C9D9]">
          Solte na área central para adicionar ao squad
        </div>
      )}

      {/* Direct SVG Edges over Background */}
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 w-full h-full"
      >
        {/* Subtle constellation guide ellipse */}
        <ellipse
          cx={layout.cx}
          cy={layout.cy}
          rx={layout.rx}
          ry={layout.ry}
          fill="none"
          stroke="#7FA6B8"
          strokeOpacity={0.08}
          strokeWidth={1}
          strokeDasharray="4 6"
        />

        {edges.map((edge, idx) => {
          const p1 = posById.get(edge.fromId);
          const p2 = posById.get(edge.toId);
          if (!p1 || !p2) return null;

          const x1 = p1.x;
          const y1 = p1.y;
          const x2 = p2.x;
          const y2 = p2.y;

          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;
          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const curve = idx % 2 === 0 ? 18 : -18;
          const cx = mx - (dy / len) * curve;
          const cy = my + (dx / len) * curve;

          // Accurate quadratic Bezier arc length estimate so animated dash runs node-to-node
          const polyLen =
            Math.hypot(cx - x1, cy - y1) + Math.hypot(x2 - cx, y2 - cy);
          const approxLen = Math.ceil((len + polyLen) * 0.5 + 4);

          const pathD =
            idx % 2 === 0
              ? `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`
              : `M ${x2.toFixed(1)} ${y2.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;

          const isAffinity = edge.type === 'afinidade';
          const isHighlighted =
            !hoveredMemberId ||
            hoveredMemberId === edge.fromId ||
            hoveredMemberId === edge.toId;

          const edgeColor = isAffinity ? '#22C55E' : '#EF4444';

          return (
            <g
              key={`${edge.fromId}-${edge.toId}-${idx}`}
              opacity={isHighlighted ? 1 : 0.22}
            >
              {/* Subtle continuous anchor line so connections always visibly link both balloons */}
              <path
                d={pathD}
                fill="none"
                stroke={edgeColor}
                strokeWidth={1.3}
                strokeOpacity={
                  !isAffinity && edge.cushionedByFacilitator ? 0.34 : 0.22
                }
                strokeDasharray={
                  !isAffinity && edge.cushionedByFacilitator ? '6 5' : undefined
                }
              />
              {/* Animated retract/extend pulse matching the CinContra loading logo */}
              <path
                d={pathD}
                fill="none"
                stroke={edgeColor}
                strokeWidth={2.2}
                strokeDasharray={approxLen}
                className="cin-edge-animated"
                style={
                  {
                    '--edge-len': approxLen,
                    animationDelay: `${-(idx * 0.28).toFixed(2)}s`,
                  } as React.CSSProperties
                }
              />
            </g>
          );
        })}
      </svg>

      {/* Member Balloons as Vertices directly on Dark Background */}
      {membersWithRationale.map(({ professional: member, justificativa }) => {
        const coord = posById.get(member.id) ?? { x: layout.cx, y: layout.cy };
        const xPct = (coord.x / size.width) * 100;
        const yPct = (coord.y / size.height) * 100;
        const isExpanded = expandedIds.has(member.id);
        const isDropTarget = dragOverBalloonId === member.id;
        const isBeingDragged = draggingId === member.id;

        const topSkills = Object.entries(member.skills || {})
          .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
          .map(
            ([sk, lvl]) =>
              `${SKILL_LABELS[sk as keyof typeof SKILL_LABELS] || sk} (${lvl}/5)`
          );

        const openUpward = coord.y > size.height * 0.64 && coord.y > 240;
        const nearLeft = coord.x < 150;
        const nearRight = coord.x > size.width - 150;
        const popoverHorizontalClass = nearLeft
          ? 'left-0'
          : nearRight
            ? 'right-0'
            : 'left-1/2 -translate-x-1/2';

        const shortLabel = getProfessionalShortLabel(member);
        const fullTitle = getProfessionalFullTitle(member);

        return (
          <div
            key={member.id}
            style={{
              left: `${xPct}%`,
              top: `${yPct}%`,
              transform: `translate(-50%, -50%) scale(${layout.nodeScale})`,
            }}
            className={`absolute transition-[left,top] duration-300 ease-out ${
              isExpanded ? 'z-30' : 'z-20'
            }`}
          >
            <div
              draggable
              onMouseEnter={() => setHoveredMemberId(member.id)}
              onMouseLeave={() => setHoveredMemberId(null)}
              onDragStart={(e) => {
                setDraggingId(member.id);
                onDraggingMemberChange(member.id);
                e.dataTransfer.setData(
                  'application/x-cincontra-squad',
                  member.id
                );
                e.dataTransfer.setData('text/plain', member.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDraggingId(null);
                onDraggingMemberChange(null);
                setDragOverBalloonId(null);
              }}
              onDragOver={(e) => {
                if (
                  e.dataTransfer.types.includes('application/x-cincontra-bank')
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  setDragOverBalloonId(member.id);
                  setIsDragOverFreeCenter(false);
                }
              }}
              onDragLeave={(e) => {
                e.stopPropagation();
                if (dragOverBalloonId === member.id) {
                  setDragOverBalloonId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOverBalloonId(null);
                const bankId = e.dataTransfer.getData(
                  'application/x-cincontra-bank'
                );
                if (bankId) {
                  onSwapMember(member.id, bankId);
                }
              }}
              className={`w-[164px] rounded-xl px-2.5 py-2 border transition-all cursor-grab active:cursor-grabbing shadow-xl ${
                isDropTarget
                  ? 'bg-[#132634] border-[#A3C9D9] ring-2 ring-[#A3C9D9]/75 scale-105'
                  : isBeingDragged
                    ? 'opacity-45 border-[#EF4444]/65 bg-[#0D1821]'
                    : 'bg-[#0D1821] border-[#8EB8CA]/50 hover:border-[#A3C9D9]'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <div className="min-w-0 flex items-center gap-1">
                  <span className="text-[11px] font-semibold text-[#A3C9D9] shrink-0">
                    {member.id}
                  </span>
                  <span className="text-xs font-semibold text-[#E6EFF4] truncate">
                    {shortLabel}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand(member.id);
                  }}
                  aria-label={`Detalhes de ${member.id}`}
                  className={`w-5 h-5 rounded-full flex items-center justify-center border text-xs transition-colors cursor-pointer shrink-0 ${
                    isExpanded
                      ? 'bg-[#8EB8CA] text-[#081017] border-[#8EB8CA]'
                      : 'bg-[#081017] text-[#A3C9D9] border-[#7FA6B8]/40 hover:border-[#A3C9D9]'
                  }`}
                >
                  {isExpanded ? (
                    <X className="w-3 h-3" />
                  ) : (
                    <Plus className="w-3 h-3" />
                  )}
                </button>
              </div>

              <div className="mt-0.5 text-[10px] text-[#8EAAB8] truncate">
                {member.cargo}
              </div>
              <div className="mt-0.5 flex items-center justify-between gap-1">
                <span className="text-[10px] text-[#A3C9D9] truncate">
                  {member.arquetipo}
                </span>
                <span className="font-grotesk text-[11px] font-semibold text-[#E6EFF4] shrink-0">
                  R$ {member.custoHora}/h
                </span>
              </div>
            </div>

            {isExpanded && (
              <div
                onClick={(e) => e.stopPropagation()}
                className={`absolute ${popoverHorizontalClass} w-[250px] rounded-xl cin-panel p-3 shadow-2xl z-40 text-left ${
                  openUpward ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 border-b border-[#7FA6B8]/20 pb-1.5 mb-2">
                  <span className="text-xs font-semibold text-[#E6EFF4] truncate">
                    {member.id} · {fullTitle}
                  </span>
                  <span className="font-grotesk text-xs font-semibold text-[#A3C9D9] shrink-0">
                    R$ {member.custoHora}/h
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-[11px]">
                  <div>
                    <span className="text-[#8EAAB8]">Trilha: </span>
                    <span className="text-[#E6EFF4]">
                      {member.trilha} · Sucesso {member.taxaSucesso}%
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8EAAB8]">Domínios: </span>
                    <span className="text-[#E6EFF4]">
                      {member.dominios
                        .map((d) => DOMAIN_LABELS[d] || d)
                        .join(' · ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#8EAAB8]">Skills: </span>
                    <span className="text-[#A3C9D9]">
                      {topSkills.join(' · ')}
                    </span>
                  </div>
                  <p className="text-[#CFE0E8] leading-relaxed border-t border-[#7FA6B8]/15 pt-1.5 mt-0.5">
                    {justificativa}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Unboxed Subtle Relation Legend at Bottom Center of Upper Stage */}
      <div className="pointer-events-none absolute bottom-1 inset-x-0 flex flex-wrap items-center justify-center gap-4 text-[11px] text-[#8EAAB8]">
        <span className="inline-flex items-center gap-1.5 text-[#22C55E]">
          <span className="inline-block w-3 h-[2px] bg-[#22C55E]" />
          Afinidade ({affinityEdges.length})
        </span>
        <span className="inline-flex items-center gap-1.5 text-[#EF4444]">
          <span className="inline-block w-3 h-[2px] bg-[#EF4444]" />
          Atrito ({frictionEdges.length})
        </span>
        {frictionEdges.length > 0 &&
          (hasFacilitator ? (
            <span className="inline-flex items-center gap-1 text-[#FCD34D]">
              <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
              Amortecido por Facilitador
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[#FCA5A5]">
              <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />
              Sem Facilitador
            </span>
          ))}
      </div>
    </div>
  );
};
