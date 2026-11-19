import React, { useEffect, useRef } from 'react';

type ScenarioId = 'urban' | 'nature' | 'undersea';

interface MusicNote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  glyph: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  wobblePhase: number;
}

interface Fish {
  x: number;
  yRatio: number;
  speed: number;
  size: number;
  phase: number;
}

const SCENARIO_DURATION = 18;
const MORPH_DURATION = 3.0;

function shuffleScenarios(): ScenarioId[] {
  const arr: ScenarioId[] = ['urban', 'nature', 'undersea'];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const smoothstep = (t: number) => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};

export const BottomSceneryCanvas: React.FC = React.memo(() => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef({
    sequence: shuffleScenarios(),
    elapsed: 0,
    worldScroll: 0,
    nextNoteTimer: 0.25,
    musicNotes: [] as MusicNote[],
    bubbles: Array.from({ length: 20 }, (_, i) => ({
      x: ((i * 97) % 1600) + 30,
      y: 0.22 + ((i * 0.17) % 0.72),
      r: 2 + (i % 4) * 1.1,
      speed: 18 + (i % 5) * 5,
      wobblePhase: i * 1.1,
    })) as Bubble[],
    fishPool: Array.from({ length: 10 }, (_, i) => ({
      x: (i / 10) * 1600,
      yRatio: 0.22 + ((i * 0.14) % 0.56),
      speed: 38 + (i % 4) * 14,
      size: 8.5 + (i % 3) * 3.5,
      phase: i * 0.9,
    })) as Fish[],
    stars: Array.from({ length: 28 }, (_, i) => ({
      xRatio: ((i * 73 + 19) % 100) / 100,
      yRatio: 0.06 + (((i * 41 + 7) % 42) / 100),
      r: i % 5 === 0 ? 1.3 : 0.8,
      phase: i * 0.7,
    })),
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId = 0;
    let width = window.innerWidth;
    let height = Math.max(220, Math.round(window.innerHeight * 0.35));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = Math.max(220, Math.round(window.innerHeight * 0.35));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    let lastTime = performance.now();

    const getWeights = (tSec: number): Record<ScenarioId, number> => {
      const seq = stateRef.current.sequence;
      const totalCycle = SCENARIO_DURATION * seq.length;
      const cyclePos = tSec % totalCycle;
      const idx = Math.floor(cyclePos / SCENARIO_DURATION);
      const localT = cyclePos - idx * SCENARIO_DURATION;

      const current = seq[idx];
      const next = seq[(idx + 1) % seq.length];

      const weights: Record<ScenarioId, number> = {
        urban: 0,
        nature: 0,
        undersea: 0,
      };

      if (localT >= SCENARIO_DURATION - MORPH_DURATION) {
        const blend = smoothstep(
          (localT - (SCENARIO_DURATION - MORPH_DURATION)) / MORPH_DURATION
        );
        weights[current] = 1 - blend;
        weights[next] = blend;
      } else {
        weights[current] = 1;
      }
      return weights;
    };

    const drawUrbanLayer = (
      alpha: number,
      scroll: number,
      groundY: number
    ) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;

      const farOffset = (scroll * 0.35) % 420;
      const farHeights = [58, 94, 70, 114, 76, 52, 102, 66, 86, 54];
      ctx.strokeStyle = 'rgba(127, 166, 184, 0.38)';
      ctx.lineWidth = 1.1;

      for (let repeat = -1; repeat <= Math.ceil(width / 420) + 1; repeat++) {
        const baseX = repeat * 420 - farOffset;
        farHeights.forEach((bh, i) => {
          const bx = baseX + i * 42;
          const bw = 32;
          const by = groundY - bh;
          ctx.strokeRect(bx, by, bw, bh);

          if (i % 3 === 1) {
            ctx.beginPath();
            ctx.moveTo(bx + bw / 2, by);
            ctx.lineTo(bx + bw / 2, by - 15);
            ctx.stroke();
          }

          ctx.strokeStyle = 'rgba(163, 201, 217, 0.24)';
          for (let wy = by + 10; wy < groundY - 12; wy += 12) {
            if ((wy + i * 7) % 3 !== 0) {
              ctx.beginPath();
              ctx.moveTo(bx + 6, wy);
              ctx.lineTo(bx + bw - 6, wy);
              ctx.stroke();
            }
          }
          ctx.strokeStyle = 'rgba(127, 166, 184, 0.38)';
        });
      }

      const midOffset = (scroll * 0.85) % 280;
      ctx.strokeStyle = 'rgba(163, 201, 217, 0.56)';
      ctx.lineWidth = 1.2;
      for (let repeat = -1; repeat <= Math.ceil(width / 280) + 1; repeat++) {
        const lx = repeat * 280 - midOffset + 80;
        ctx.beginPath();
        ctx.moveTo(lx, groundY);
        ctx.lineTo(lx, groundY - 62);
        ctx.quadraticCurveTo(lx, groundY - 70, lx + 12, groundY - 70);
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(lx + 13, groundY - 68, 2.5, 0, Math.PI * 2);
        ctx.stroke();
      }

      const nearOffset = scroll % 56;
      ctx.strokeStyle = 'rgba(142, 184, 202, 0.42)';
      ctx.lineWidth = 1.2;
      for (let sx = -nearOffset; sx < width + 56; sx += 56) {
        ctx.beginPath();
        ctx.moveTo(sx, groundY + 10);
        ctx.lineTo(sx + 22, groundY + 10);
        ctx.stroke();
      }

      ctx.restore();
    };

    const drawNatureLayer = (
      alpha: number,
      scroll: number,
      groundY: number,
      time: number
    ) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;

      const moonX = width * 0.22;
      const moonY = Math.max(36, groundY - 128);
      ctx.strokeStyle = 'rgba(163, 201, 217, 0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0.45, Math.PI * 1.65);
      ctx.quadraticCurveTo(moonX - 2, moonY - 4, moonX + 14.3, moonY + 7);
      ctx.stroke();

      const birdOffset = (scroll * 0.22) % (width + 200);
      ctx.strokeStyle = 'rgba(127, 166, 184, 0.56)';
      ctx.lineWidth = 1.1;
      for (let b = 0; b < 4; b++) {
        const bx = width - birdOffset + b * 26;
        const by = moonY + 10 + (b % 2) * 10 + Math.sin(time * 2.5 + b) * 2.5;
        ctx.beginPath();
        ctx.moveTo(bx - 5, by - 2);
        ctx.quadraticCurveTo(bx - 2, by - 4, bx, by);
        ctx.quadraticCurveTo(bx + 2, by - 4, bx + 5, by - 2);
        ctx.stroke();
      }

      const ridgeOffset = scroll * 0.26;
      ctx.strokeStyle = 'rgba(127, 166, 184, 0.4)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      for (let x = 0; x <= width + 20; x += 18) {
        const wx = x + ridgeOffset;
        const y =
          groundY -
          64 -
          Math.sin(wx * 0.0045) * 26 -
          Math.cos(wx * 0.009) * 14;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const hillOffset = scroll * 0.48;
      ctx.strokeStyle = 'rgba(127, 166, 184, 0.5)';
      ctx.beginPath();
      for (let x = 0; x <= width + 20; x += 18) {
        const wx = x + hillOffset;
        const y =
          groundY -
          26 -
          Math.sin(wx * 0.007 + 1.2) * 16 -
          Math.cos(wx * 0.013) * 8;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const treeSpan = 460;
      const treeOffset = (scroll * 0.88) % treeSpan;
      for (let rep = -1; rep <= Math.ceil(width / treeSpan) + 1; rep++) {
        const baseX = rep * treeSpan - treeOffset;

        [40, 70, 215, 365, 398].forEach((tx, idx) => {
          const px = baseX + tx;
          const th = idx % 2 === 0 ? 52 : 38;
          const tw = idx % 2 === 0 ? 15 : 11.5;
          ctx.strokeStyle = 'rgba(142, 184, 202, 0.65)';
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.moveTo(px, groundY);
          ctx.lineTo(px, groundY - th);
          ctx.moveTo(px, groundY - th);
          ctx.lineTo(px - tw, groundY - 10);
          ctx.lineTo(px + tw, groundY - 10);
          ctx.closePath();
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(px - tw * 0.55, groundY - th * 0.58);
          ctx.lineTo(px, groundY - th * 0.78);
          ctx.lineTo(px + tw * 0.55, groundY - th * 0.58);
          ctx.stroke();
        });

        const cx = baseX + 292;
        ctx.strokeStyle = 'rgba(142, 184, 202, 0.58)';
        ctx.beginPath();
        ctx.moveTo(cx, groundY);
        ctx.lineTo(cx, groundY - 26);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(cx, groundY - 37, 16, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(127, 166, 184, 0.38)';
      ctx.lineWidth = 1.05;
      const waterOffset = (scroll * 0.65) % 230;
      for (let rep = -1; rep <= Math.ceil(width / 230) + 1; rep++) {
        const wx = rep * 230 - waterOffset + 40;
        [14, 24, 34].forEach((dy, rIdx) => {
          const rw = 50 - rIdx * 12;
          const wave = Math.sin(time * 2.1 + rIdx + rep) * 4.5;
          ctx.beginPath();
          ctx.moveTo(wx - rw + wave, groundY + dy);
          ctx.lineTo(wx + rw + wave, groundY + dy);
          ctx.stroke();
        });
      }

      ctx.restore();
    };

    const drawUnderseaLayer = (
      alpha: number,
      scroll: number,
      groundY: number,
      time: number
    ) => {
      if (alpha <= 0.01) return;
      ctx.save();
      ctx.globalAlpha = alpha;

      ctx.strokeStyle = 'rgba(163, 201, 217, 0.28)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let x = 0; x <= width + 20; x += 20) {
        const sy = 16 + Math.sin(x * 0.025 + time * 1.6) * 4;
        if (x === 0) ctx.moveTo(x, sy);
        else ctx.lineTo(x, sy);
      }
      ctx.stroke();

      const kelpSpan = 240;
      const kelpOffset = (scroll * 0.85) % kelpSpan;
      ctx.strokeStyle = 'rgba(127, 166, 184, 0.64)';
      ctx.lineWidth = 1.3;

      for (let rep = -1; rep <= Math.ceil(width / kelpSpan) + 1; rep++) {
        const baseX = rep * kelpSpan - kelpOffset;
        [32, 62, 152, 196].forEach((kx, kIdx) => {
          const x = baseX + kx;
          const seabedAtX =
            groundY +
            14 +
            Math.sin((x + scroll * 0.7) * 0.018 + time * 1.4) * 6;
          const h = 38 + (kIdx % 3) * 18;
          const sway = Math.sin(time * 2.4 + kIdx + rep) * 11;

          ctx.beginPath();
          ctx.moveTo(x, seabedAtX);
          ctx.bezierCurveTo(
            x - sway * 0.6,
            seabedAtX - h * 0.35,
            x + sway,
            seabedAtX - h * 0.7,
            x + sway * 0.45,
            seabedAtX - h
          );
          ctx.stroke();
        });
      }

      ctx.strokeStyle = 'rgba(163, 201, 217, 0.56)';
      ctx.lineWidth = 1.05;
      stateRef.current.bubbles.forEach((b) => {
        const bx =
          (((b.x - scroll * 0.45) % (width + 80)) + (width + 80)) %
            (width + 80) -
          40;
        const by =
          18 +
          (((b.y * (groundY - 12) - time * b.speed) % (groundY - 12)) +
            (groundY - 12)) %
            (groundY - 12);
        const wobble = Math.sin(time * 3.2 + b.wobblePhase) * 3.5;
        ctx.beginPath();
        ctx.arc(bx + wobble, by, b.r, 0, Math.PI * 2);
        ctx.stroke();
      });

      ctx.strokeStyle = 'rgba(163, 201, 217, 0.78)';
      ctx.lineWidth = 1.25;
      stateRef.current.fishPool.forEach((f) => {
        const fx = width + 40 - ((f.x + time * f.speed) % (width + 120));
        const fy =
          28 +
          f.yRatio * (groundY - 50) +
          Math.sin(time * 2.8 + f.phase) * 5.5;
        const s = f.size;

        ctx.beginPath();
        ctx.moveTo(fx - s, fy);
        ctx.quadraticCurveTo(fx, fy - s * 0.58, fx + s * 0.85, fy);
        ctx.quadraticCurveTo(fx, fy + s * 0.58, fx - s, fy);
        ctx.moveTo(fx + s * 0.85, fy);
        ctx.lineTo(fx + s * 1.42, fy - s * 0.44);
        ctx.lineTo(fx + s * 1.42, fy + s * 0.44);
        ctx.closePath();
        ctx.stroke();
      });

      ctx.restore();
    };

    const drawCharacter = (
      centerX: number,
      groundY: number,
      time: number,
      dt: number,
      urbanWeight: number,
      swimFactor: number
    ) => {
      const charScale = Math.min(1.06, Math.max(0.84, (groundY - 40) / 168));
      const walkPhase = time * 5.8;
      const swimPhase = time * 4.2;

      const bobWalk = Math.abs(Math.sin(walkPhase)) * 3.1 * charScale;
      const bobSwim = Math.sin(swimPhase) * 5.0 * charScale;

      const hipBaseY = groundY - 37.5 * charScale;
      const hipY =
        hipBaseY -
        bobWalk * (1 - swimFactor) -
        (34 * charScale + bobSwim) * swimFactor;

      const tiltAngle = 0.06 * (1 - swimFactor) + swimFactor * 1.44;

      const BG_FILL = '#09131C';
      const MAIN_STROKE = '#B8DCEB';
      const BACK_STROKE = '#8EB8CA';
      const DETAIL_STROKE = '#CBE8F5';

      ctx.save();
      ctx.translate(centerX, hipY);
      ctx.scale(charScale, charScale);
      ctx.rotate(tiltAngle);

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const drawCurlyHairOutline = (
        cx: number,
        cy: number,
        rx: number,
        ry: number,
        lobes: number,
        bump: number
      ) => {
        ctx.beginPath();
        for (let i = 0; i < lobes; i++) {
          const a0 = (i / lobes) * Math.PI * 2;
          const a1 = ((i + 1) / lobes) * Math.PI * 2;
          const aMid = (a0 + a1) * 0.5;

          const x0 = cx + Math.cos(a0) * rx;
          const y0 = cy + Math.sin(a0) * ry;
          const x1 = cx + Math.cos(a1) * rx;
          const y1 = cy + Math.sin(a1) * ry;

          const waveBump = bump * (i % 2 === 0 ? 1.05 : 0.92);
          const cpx = cx + Math.cos(aMid) * (rx + waveBump);
          const cpy = cy + Math.sin(aMid) * (ry + waveBump);

          if (i === 0) ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(cpx, cpy, x1, y1);
        }
        ctx.closePath();
      };

      const drawLeg = (phaseOffset: number, isFront: boolean) => {
        const wPhase = walkPhase + phaseOffset;
        const sPhase = swimPhase * 1.45 + phaseOffset;

        const walkHip = Math.sin(wPhase) * 0.55;
        const walkKnee = Math.max(0, -Math.cos(wPhase) * 0.66 + 0.14);

        const swimHip = -0.14 + Math.sin(sPhase) * 0.24;
        const swimKnee = 0.24 + Math.max(0, -Math.cos(sPhase)) * 0.28;

        const hipAngle = walkHip * (1 - swimFactor) + swimHip * swimFactor;
        const kneeBend = walkKnee * (1 - swimFactor) + swimKnee * swimFactor;
        const shinAngle = hipAngle - kneeBend;

        const hipX = isFront ? 0.4 : -1.6;
        const hipLocalY = 1.2;
        const thighLen = 16.5;

        const kneeX = hipX + Math.sin(hipAngle) * thighLen;
        const kneeY = hipLocalY + Math.cos(hipAngle) * thighLen;

        const strokeCol = isFront ? MAIN_STROKE : BACK_STROKE;

        // 1. Lower leg: bare calf + striped sock + chunky lace-up boot
        ctx.save();
        ctx.translate(kneeX, kneeY);
        ctx.rotate(-shinAngle);
        ctx.strokeStyle = strokeCol;
        ctx.fillStyle = BG_FILL;
        ctx.lineWidth = 1.45;

        // Bare knee-to-ankle leg column
        ctx.beginPath();
        ctx.moveTo(-3.5, -2.5);
        ctx.lineTo(3.5, -2.5);
        ctx.lineTo(3.2, 10.2);
        ctx.lineTo(-3.2, 10.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Striped sock lines above boot cuff
        ctx.lineWidth = 1.1;
        for (const sy of [3.4, 5.5, 7.6]) {
          ctx.beginPath();
          ctx.moveTo(-3.3, sy);
          ctx.lineTo(3.3, sy);
          ctx.stroke();
        }

        // Chunky lace-up boot (coturno)
        ctx.lineWidth = 1.45;
        ctx.beginPath();
        ctx.moveTo(-4.4, 8.6);
        ctx.lineTo(4.4, 8.6);
        ctx.lineTo(4.6, 15.8);
        ctx.quadraticCurveTo(5.6, 17.6, 10.4, 18.2);
        ctx.quadraticCurveTo(13.4, 18.6, 13.0, 20.6);
        ctx.quadraticCurveTo(12.6, 22.1, 8.6, 22.1);
        ctx.lineTo(-1.2, 22.0);
        ctx.quadraticCurveTo(-4.8, 22.0, -5.0, 19.6);
        ctx.lineTo(-4.4, 8.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Subtle boot top rim & 4 horizontal lace bars
        ctx.lineWidth = 1.1;
        for (const ly of [10.6, 12.4, 14.2, 16.0]) {
          ctx.beginPath();
          ctx.moveTo(0.8, ly);
          ctx.lineTo(4.3, ly);
          ctx.stroke();
        }
        ctx.restore();

        // 2. Upper leg: bare thigh peek + overall shorts leg + rolled cuff
        ctx.save();
        ctx.translate(hipX, hipLocalY);
        ctx.rotate(-hipAngle);
        ctx.strokeStyle = strokeCol;
        ctx.fillStyle = BG_FILL;
        ctx.lineWidth = 1.45;

        // Bare lower thigh
        ctx.beginPath();
        ctx.moveTo(-3.8, 9.5);
        ctx.lineTo(3.8, 9.5);
        ctx.lineTo(3.5, thighLen + 1.4);
        ctx.lineTo(-3.5, thighLen + 1.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Shortalls leg
        ctx.beginPath();
        ctx.moveTo(-5.8, -2.5);
        ctx.lineTo(5.8, -2.5);
        ctx.lineTo(5.2, 9.2);
        ctx.lineTo(-5.2, 9.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Rolled hem cuff at bottom of shorts
        ctx.beginPath();
        ctx.moveTo(-5.6, 8.8);
        ctx.lineTo(5.6, 8.8);
        ctx.lineTo(5.6, 11.7);
        ctx.lineTo(-5.6, 11.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore();
      };

      const drawArm = (phaseOffset: number, isFront: boolean) => {
        const wPhase = walkPhase + phaseOffset;
        const sPhase = swimPhase + phaseOffset;

        const walkShoulder = Math.sin(wPhase) * 0.48;
        const walkElbow = 0.22 + Math.max(0, Math.sin(wPhase)) * 0.28;

        const swimShoulder = isFront
          ? -0.05 + Math.sin(sPhase) * 0.44
          : 0.45 + Math.sin(sPhase) * 0.48;
        const swimElbow = 0.2 + Math.max(0, Math.cos(sPhase)) * 0.34;

        const shAngle =
          walkShoulder * (1 - swimFactor) + swimShoulder * swimFactor;
        const elBend = walkElbow * (1 - swimFactor) + swimElbow * swimFactor;
        const foreAngle = shAngle + elBend;

        const shX = isFront ? -1.0 : 3.2;
        const shY = -21.2;
        const upperLen = 12.6;
        const foreLen = 11.8;

        const elbowX = shX + Math.sin(shAngle) * upperLen;
        const elbowY = shY + Math.cos(shAngle) * upperLen;

        const strokeCol = isFront ? MAIN_STROKE : BACK_STROKE;

        // 1. Forearm + Wristband + Hand
        ctx.save();
        ctx.translate(elbowX, elbowY);
        ctx.rotate(-foreAngle);
        ctx.strokeStyle = strokeCol;
        ctx.fillStyle = BG_FILL;
        ctx.lineWidth = 1.4;

        // Forearm
        ctx.beginPath();
        ctx.moveTo(-2.5, -1.6);
        ctx.lineTo(2.5, -1.6);
        ctx.lineTo(2.1, foreLen);
        ctx.lineTo(-2.1, foreLen);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wristband on front/leading arm
        if (isFront) {
          ctx.beginPath();
          ctx.moveTo(-2.6, foreLen - 3.6);
          ctx.lineTo(2.6, foreLen - 3.6);
          ctx.lineTo(2.5, foreLen - 0.8);
          ctx.lineTo(-2.5, foreLen - 0.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(-2.5, foreLen - 2.2);
          ctx.lineTo(2.5, foreLen - 2.2);
          ctx.stroke();
          ctx.lineWidth = 1.4;
        }

        // Stylized hand with thumb & fingers
        ctx.beginPath();
        ctx.moveTo(-2.1, foreLen - 0.4);
        ctx.lineTo(2.1, foreLen - 0.4);
        ctx.quadraticCurveTo(4.0, foreLen + 1.8, 3.3, foreLen + 3.8);
        ctx.quadraticCurveTo(2.7, foreLen + 4.4, 2.0, foreLen + 3.2);
        ctx.lineTo(1.7, foreLen + 5.6);
        ctx.quadraticCurveTo(0.8, foreLen + 6.4, 0.0, foreLen + 5.7);
        ctx.quadraticCurveTo(-1.0, foreLen + 6.1, -1.8, foreLen + 5.0);
        ctx.quadraticCurveTo(-2.6, foreLen + 3.6, -2.1, foreLen - 0.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Subtle finger separation ticks
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.moveTo(0.8, foreLen + 3.2);
        ctx.lineTo(0.8, foreLen + 5.5);
        ctx.moveTo(-0.5, foreLen + 3.2);
        ctx.lineTo(-0.6, foreLen + 5.3);
        ctx.stroke();
        ctx.restore();

        // 2. Upper arm + short t-shirt sleeve
        ctx.save();
        ctx.translate(shX, shY);
        ctx.rotate(-shAngle);
        ctx.strokeStyle = strokeCol;
        ctx.fillStyle = BG_FILL;
        ctx.lineWidth = 1.4;

        // Bare upper arm
        ctx.beginPath();
        ctx.moveTo(-2.6, 3.0);
        ctx.lineTo(2.6, 3.0);
        ctx.lineTo(2.4, upperLen + 1.2);
        ctx.lineTo(-2.4, upperLen + 1.2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // T-shirt short sleeve cap
        ctx.beginPath();
        ctx.moveTo(-4.4, -1.6);
        ctx.quadraticCurveTo(0, -4.6, 4.4, -1.4);
        ctx.lineTo(5.0, 6.4);
        ctx.lineTo(-4.8, 6.4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      };

      const drawTorso = () => {
        ctx.save();
        ctx.strokeStyle = MAIN_STROKE;
        ctx.fillStyle = BG_FILL;
        ctx.lineWidth = 1.45;

        // Base torso (T-shirt upper + shortalls body)
        ctx.beginPath();
        ctx.moveTo(-5.8, -22.5);
        ctx.quadraticCurveTo(0.5, -25.2, 5.2, -22.2);
        ctx.quadraticCurveTo(7.4, -16.0, 7.2, -8.0);
        ctx.quadraticCurveTo(7.4, -1.0, 6.2, 3.6);
        ctx.lineTo(-6.2, 3.6);
        ctx.quadraticCurveTo(-7.6, -2.5, -7.2, -10.5);
        ctx.quadraticCurveTo(-7.4, -17.5, -5.8, -22.5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // T-shirt neckline curve
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-2.2, -24.2);
        ctx.quadraticCurveTo(1.2, -21.8, 4.0, -23.4);
        ctx.stroke();

        // Overall chest bib & side cutout curve
        ctx.lineWidth = 1.35;
        ctx.beginPath();
        ctx.moveTo(-5.8, -11.8);
        ctx.quadraticCurveTo(-3.4, -8.2, 0.2, -9.2);
        ctx.quadraticCurveTo(1.4, -11.0, 1.5, -16.8);
        ctx.lineTo(6.6, -16.8);
        ctx.stroke();

        // Two overall straps going over shoulders
        ctx.beginPath();
        ctx.moveTo(0.5, -23.6);
        ctx.lineTo(1.7, -16.6);
        ctx.moveTo(3.2, -23.2);
        ctx.lineTo(4.0, -16.6);
        ctx.stroke();

        // Back/far strap edge
        ctx.beginPath();
        ctx.moveTo(4.6, -22.4);
        ctx.lineTo(5.6, -16.6);
        ctx.stroke();

        // Tiny strap buttons on chest bib
        ctx.fillStyle = BG_FILL;
        ctx.beginPath();
        ctx.arc(2.7, -15.4, 1.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(5.5, -15.4, 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Front chest pocket on bib
        ctx.lineWidth = 1.15;
        ctx.beginPath();
        ctx.moveTo(2.4, -12.6);
        ctx.lineTo(6.5, -12.6);
        ctx.lineTo(6.3, -8.2);
        ctx.quadraticCurveTo(4.4, -6.8, 2.4, -8.2);
        ctx.closePath();
        ctx.stroke();

        ctx.restore();
      };

      const drawHipOverlay = () => {
        // Seamless hip pocket seam blending torso into front overall short leg
        ctx.save();
        ctx.fillStyle = BG_FILL;
        ctx.beginPath();
        ctx.ellipse(-0.4, -0.8, 5.2, 3.6, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = MAIN_STROKE;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        ctx.moveTo(-4.6, -2.6);
        ctx.quadraticCurveTo(-0.8, -1.6, 2.6, -3.0);
        ctx.lineTo(2.2, 1.8);
        ctx.quadraticCurveTo(-1.4, 3.6, -4.4, 1.4);
        ctx.closePath();
        ctx.stroke();
        ctx.restore();
      };

      const drawHead = () => {
        const headCounterTilt =
          Math.sin(walkPhase * 2) * 0.025 * (1 - swimFactor) -
          swimFactor * 1.08;

        ctx.save();
        ctx.translate(1.0, -24.8);
        ctx.rotate(headCounterTilt);

        // Neck
        ctx.fillStyle = BG_FILL;
        ctx.strokeStyle = MAIN_STROKE;
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(-2.3, 1.8);
        ctx.lineTo(-2.0, -5.2);
        ctx.lineTo(2.4, -5.2);
        ctx.lineTo(2.6, 1.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Curly afro puff hair silhouette (framing back & crown cleanly behind face)
        ctx.fillStyle = BG_FILL;
        ctx.strokeStyle = MAIN_STROKE;
        ctx.lineWidth = 1.45;
        drawCurlyHairOutline(-3.8, -17.6, 9.6, 9.4, 13, 3.1);
        ctx.fill();
        ctx.stroke();

        // Face oval (3/4 profile facing right)
        ctx.beginPath();
        ctx.ellipse(1.6, -12.4, 6.7, 7.6, -0.05, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Curly bangs across top of forehead
        ctx.beginPath();
        ctx.moveTo(-4.8, -16.0);
        ctx.quadraticCurveTo(-2.6, -19.8, 0.2, -17.8);
        ctx.quadraticCurveTo(2.6, -20.2, 5.2, -18.0);
        ctx.quadraticCurveTo(7.6, -19.2, 8.4, -16.2);
        ctx.quadraticCurveTo(6.0, -14.8, 4.0, -15.6);
        ctx.quadraticCurveTo(1.8, -14.5, -0.4, -15.5);
        ctx.quadraticCurveTo(-2.8, -14.4, -4.8, -16.0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Eyes & gentle eyebrows
        ctx.fillStyle = DETAIL_STROKE;
        ctx.beginPath();
        ctx.arc(2.5, -12.4, 0.95, 0, Math.PI * 2);
        ctx.arc(6.8, -12.5, 0.9, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = DETAIL_STROKE;
        ctx.lineWidth = 1.05;
        ctx.beginPath();
        ctx.moveTo(1.4, -14.8);
        ctx.quadraticCurveTo(2.5, -15.4, 3.6, -14.8);
        ctx.moveTo(6.0, -14.8);
        ctx.quadraticCurveTo(6.9, -15.3, 7.7, -14.7);
        ctx.stroke();

        // Nose & warm smile
        ctx.beginPath();
        ctx.moveTo(5.1, -11.4);
        ctx.quadraticCurveTo(5.7, -10.8, 5.1, -10.3);
        ctx.moveTo(2.6, -8.5);
        ctx.quadraticCurveTo(4.2, -7.5, 5.8, -8.6);
        ctx.stroke();

        // Round glasses (front lens, far lens, bridge & temple)
        ctx.strokeStyle = DETAIL_STROKE;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(2.2, -12.3, 2.8, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(6.9, -12.4, 2.1, 2.7, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(4.9, -12.5);
        ctx.lineTo(5.1, -12.5);
        ctx.moveTo(-0.6, -12.5);
        ctx.lineTo(-4.6, -12.2);
        ctx.stroke();

        // Ear & hoop earring (visible when Urban headphones are off)
        const earAlpha = Math.max(0, 1 - urbanWeight * 0.9);
        if (earAlpha > 0.04) {
          ctx.save();
          ctx.globalAlpha = earAlpha;
          ctx.fillStyle = BG_FILL;
          ctx.strokeStyle = MAIN_STROKE;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(-4.7, -11.6, 1.9, Math.PI * 0.4, Math.PI * 1.65);
          ctx.fill();
          ctx.stroke();

          // Sleek hoop earring
          ctx.strokeStyle = DETAIL_STROKE;
          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.ellipse(-5.1, -8.4, 1.1, 2.2, 0.15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        // Over-ear headphones (Urban scenario)
        if (urbanWeight > 0.04) {
          ctx.save();
          ctx.globalAlpha = urbanWeight;
          ctx.strokeStyle = DETAIL_STROKE;
          ctx.fillStyle = BG_FILL;
          ctx.lineWidth = 1.35;

          // Curved headband rising cleanly from top of earcup over the curly hair
          ctx.beginPath();
          ctx.moveTo(-6.0, -15.8);
          ctx.quadraticCurveTo(-5.8, -26.8, -1.0, -29.2);
          ctx.lineTo(1.2, -28.4);
          ctx.quadraticCurveTo(-3.2, -25.8, -3.2, -15.8);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Round earcup with concentric inner ring
          ctx.lineWidth = 1.45;
          ctx.beginPath();
          ctx.arc(-4.6, -12.0, 4.9, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.lineWidth = 1.15;
          ctx.beginPath();
          ctx.arc(-4.6, -12.0, 2.7, 0, Math.PI * 2);
          ctx.stroke();

          // Short headphone wire nub below earcup
          ctx.beginPath();
          ctx.moveTo(-4.6, -7.1);
          ctx.lineTo(-4.6, -4.4);
          ctx.stroke();
          ctx.restore();
        }

        ctx.restore();
      };

      // Layered cel-style rendering order (back-to-front)
      drawArm(0, false);
      drawLeg(Math.PI, false);
      drawTorso();
      drawLeg(0, true);
      drawHipOverlay();
      drawHead();
      drawArm(Math.PI, true);

      ctx.restore();

      const st = stateRef.current;
      if (urbanWeight > 0.15) {
        st.nextNoteTimer -= dt;
        if (st.nextNoteTimer <= 0) {
          st.nextNoteTimer = 0.62 + Math.random() * 0.4;
          st.musicNotes.push({
            x: centerX - 6 * charScale,
            y: hipY - 48 * charScale,
            vx: -32 - Math.random() * 16,
            vy: -20 - Math.random() * 12,
            life: 0,
            maxLife: 2.0,
            glyph: Math.random() > 0.45 ? '♪' : '♫',
          });
        }
      }

      for (let i = st.musicNotes.length - 1; i >= 0; i--) {
        const note = st.musicNotes[i];
        note.life += dt;
        note.x += note.vx * dt;
        note.y += note.vy * dt + Math.sin(note.life * 4.5) * 0.22;
        if (note.life >= note.maxLife) {
          st.musicNotes.splice(i, 1);
          continue;
        }
        const fade =
          Math.sin((note.life / note.maxLife) * Math.PI) * urbanWeight;
        if (fade > 0.02) {
          ctx.save();
          ctx.globalAlpha = fade * 0.9;
          ctx.fillStyle = '#A3C9D9';
          ctx.font = '14px "Plus Jakarta Sans", sans-serif';
          ctx.fillText(note.glyph, note.x, note.y);
          ctx.restore();
        }
      }
    };

    const render = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.004, (now - lastTime) / 1000));
      lastTime = now;

      const st = stateRef.current;
      st.elapsed += dt;
      st.worldScroll += dt * 58;

      const weights = getWeights(st.elapsed);
      const swimFactor = smoothstep(weights.undersea);
      const groundY = height - 48;

      ctx.clearRect(0, 0, width, height);

      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, 'rgba(8, 16, 23, 0)');
      bgGrad.addColorStop(0.5, 'rgba(11, 22, 31, 0.5)');
      bgGrad.addColorStop(1, 'rgba(8, 16, 23, 0.96)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      const skyAlpha = Math.max(0.18, 1 - swimFactor * 0.85);
      st.stars.forEach((s) => {
        const twinkle =
          0.22 + 0.35 * (0.5 + 0.5 * Math.sin(st.elapsed * 1.6 + s.phase));
        ctx.fillStyle = `rgba(163, 201, 217, ${twinkle * skyAlpha})`;
        ctx.beginPath();
        ctx.arc(s.xRatio * width, s.yRatio * height, s.r, 0, Math.PI * 2);
        ctx.fill();
      });

      drawUrbanLayer(weights.urban, st.worldScroll, groundY);
      drawNatureLayer(weights.nature, st.worldScroll, groundY, st.elapsed);
      drawUnderseaLayer(weights.undersea, st.worldScroll, groundY, st.elapsed);

      ctx.save();
      ctx.strokeStyle = 'rgba(142, 184, 202, 0.78)';
      ctx.lineWidth = 1.35;
      ctx.beginPath();
      for (let x = 0; x <= width + 16; x += 16) {
        const seaWave =
          Math.sin((x + st.worldScroll * 0.7) * 0.018 + st.elapsed * 1.4) * 6 +
          Math.cos((x + st.worldScroll * 0.35) * 0.032) * 2.5 +
          14;
        const natureWave = Math.sin((x + st.worldScroll * 0.85) * 0.01) * 1.8;
        const y =
          groundY +
          natureWave * weights.nature +
          seaWave * weights.undersea;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();

      drawCharacter(
        width * 0.5,
        groundY,
        st.elapsed,
        dt,
        weights.urban,
        swimFactor
      );

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-10 overflow-hidden"
      style={{ height: 'max(220px, 35vh)' }}
    >
      <canvas ref={canvasRef} className="block w-full h-full" />
    </div>
  );
});
