import React from 'react';

export type LogoMode =
  | 'initial'
  | 'params'
  | 'movement1'
  | 'computing'
  | 'expanding'
  | 'dashboard';

interface CinContraLogoProps {
  mode: LogoMode;
  onClick?: () => void;
  computingProgress?: number; // 0 to 1 during 30s state
}

interface Point {
  id: number;
  x: number;
  y: number;
  r: number;
}

// 11 vertices forming an asymmetric geometric star graph matching the CinContra emblem
const NODES: Point[] = [
  { id: 0, x: 102, y: 20, r: 4.2 },
  { id: 1, x: 168, y: 34, r: 4.0 },
  { id: 2, x: 196, y: 102, r: 4.4 },
  { id: 3, x: 152, y: 184, r: 4.1 },
  { id: 4, x: 92, y: 196, r: 4.0 },
  { id: 5, x: 46, y: 160, r: 3.9 },
  { id: 6, x: 26, y: 104, r: 4.1 },
  { id: 7, x: 64, y: 52, r: 4.1 },
  { id: 8, x: 82, y: 98, r: 3.9 },
  { id: 9, x: 136, y: 112, r: 4.4 },
  { id: 10, x: 106, y: 146, r: 4.1 },
];

interface LogoEdge {
  from: number;
  to: number;
  curveOffset?: number;
}

const EDGES: LogoEdge[] = [
  { from: 0, to: 8 },
  { from: 0, to: 9 },
  { from: 0, to: 2 },
  { from: 0, to: 7 },
  { from: 1, to: 7 },
  { from: 1, to: 8 },
  { from: 1, to: 9 },
  { from: 1, to: 10 },
  { from: 2, to: 7 },
  { from: 2, to: 9 },
  { from: 2, to: 10 },
  { from: 3, to: 9 },
  { from: 3, to: 10 },
  { from: 3, to: 5, curveOffset: -18 },
  { from: 4, to: 8 },
  { from: 4, to: 9 },
  { from: 4, to: 10 },
  { from: 5, to: 8 },
  { from: 5, to: 10 },
  { from: 6, to: 7 },
  { from: 6, to: 8 },
  { from: 6, to: 10 },
  { from: 7, to: 8 },
  { from: 7, to: 9 },
  { from: 8, to: 9 },
  { from: 8, to: 10 },
  { from: 9, to: 10 },
  { from: 0, to: 4, curveOffset: -12 },
  { from: 6, to: 2, curveOffset: 10 },
];

function computeEdgePath(a: Point, b: Point, curveOffset = 0): string {
  if (!curveOffset) {
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const cx = mx - (dy / len) * curveOffset;
  const cy = my + (dx / len) * curveOffset;
  return `M ${a.x} ${a.y} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${b.x} ${b.y}`;
}

export const CinContraLogo: React.FC<CinContraLogoProps> = ({
  mode,
  onClick,
  computingProgress = 0,
}) => {
  const isInitial = mode === 'initial';
  const isParams = mode === 'params' || mode === 'movement1';
  const isComputing = mode === 'computing';
  const isExpanding = mode === 'expanding';

  const sizePx = isInitial
    ? 208
    : isComputing
      ? 220
      : isExpanding
        ? 180
        : isParams
          ? 104
          : 28;

  const cycleWave = isComputing
    ? Math.sin(computingProgress * Math.PI * 14)
    : 1;

  const content = (
    <div className="flex flex-col items-center select-none">
      {mode !== 'dashboard' && (
        <span
          className={`font-grotesk font-semibold tracking-[0.04em] text-[#E6EFF4] transition-all duration-300 ${
            isInitial
              ? 'text-3xl mb-3'
              : isComputing
                ? 'text-2xl mb-2'
                : 'text-base mb-1'
          }`}
        >
          CinContra
        </span>
      )}

      <svg
        width={sizePx}
        height={sizePx}
        viewBox="0 0 220 220"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Edges: retract into vertices and extend back out during computing */}
        <g>
          {EDGES.map((edge, idx) => {
            const a = NODES[edge.from];
            const b = NODES[edge.to];
            const d = computeEdgePath(a, b, edge.curveOffset);
            const approxLen = Math.hypot(b.x - a.x, b.y - a.y) + 24;

            let dashOffset = 0;
            let edgeOpacity = 0.74;
            if (isComputing) {
              // Smooth wave where edges retract all the way into the node and extend back out
              const wave =
                0.5 +
                0.5 *
                  Math.sin(computingProgress * Math.PI * 24 + idx * 0.52);
              dashOffset = wave * approxLen;
              edgeOpacity = 0.22 + (1 - wave) * 0.68;
            } else if (isExpanding) {
              edgeOpacity = 0.35;
            }

            return (
              <path
                key={`${edge.from}-${edge.to}`}
                d={d}
                stroke="#8EB8CA"
                strokeWidth={mode === 'dashboard' ? 2.2 : 1.25}
                strokeOpacity={edgeOpacity}
                strokeDasharray={isComputing ? approxLen : undefined}
                strokeDashoffset={isComputing ? dashOffset : undefined}
              />
            );
          })}
        </g>

        {/* 11 Circular Vertices */}
        <g>
          {NODES.map((node, idx) => {
            const computingPulse = isComputing
              ? 1 +
                0.24 *
                  Math.max(
                    0,
                    Math.sin(computingProgress * Math.PI * 18 + idx)
                  )
              : 1;

            return (
              <g key={node.id}>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={
                    (mode === 'dashboard' ? node.r * 1.5 : node.r) *
                    computingPulse
                  }
                  fill="#8EB8CA"
                  fillOpacity={
                    isComputing
                      ? 0.65 + 0.35 * Math.abs(cycleWave)
                      : 0.94
                  }
                />
                {isInitial && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.r + 3.5}
                    stroke="#A3C9D9"
                    strokeOpacity={0.2}
                    strokeWidth={0.8}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label="Iniciar configuração CinContra"
        className="group relative flex flex-col items-center cursor-pointer rounded-2xl p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#A3C9D9]/70 transition-transform duration-300 hover:scale-[1.02] active:scale-[0.99]"
      >
        {content}
        {isInitial && (
          <span className="mt-2.5 text-xs tracking-wide text-[#8EAAB8] group-hover:text-[#A3C9D9] transition-colors">
            Clique no grafo para configurar os parâmetros
          </span>
        )}
      </button>
    );
  }

  return content;
};
