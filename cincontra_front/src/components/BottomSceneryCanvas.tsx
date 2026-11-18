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

const SCENARIO_DURATION = 18; // ~18s per scenario
const MORPH_DURATION = 3.0; // smooth terrain and posture transition

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
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap DPR at 1.5 for minimal RAM usage
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

      // Skyline far parallax
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

      // Midground street lamps scrolling right-to-left
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

      // Foreground pavement dashes moving at full walking speed
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

      // Crescent moon
      const moonX = width * 0.22;
      const moonY = Math.max(36, groundY - 128);
      ctx.strokeStyle = 'rgba(163, 201, 217, 0.8)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.arc(moonX, moonY, 16, 0.45, Math.PI * 1.65);
      ctx.quadraticCurveTo(moonX - 2, moonY - 4, moonX + 14.3, moonY + 7);
      ctx.stroke();

      // Gliding birds
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

      // Rolling mountain ridge
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

      // Midground hills
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

      // Pine & canopy trees along the trail (no cars, no other people)
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

        // Canopy tree
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

      // Water reflections below trail
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

      // Upper water surface wave
      ctx.strokeStyle = 'rgba(163, 201, 217, 0.28)';
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (let x = 0; x <= width + 20; x += 20) {
        const sy = 16 + Math.sin(x * 0.025 + time * 1.6) * 4;
        if (x === 0) ctx.moveTo(x, sy);
        else ctx.lineTo(x, sy);
      }
      ctx.stroke();

      // Swaying seabed kelp sliding right-to-left
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

      // Rising bubbles
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

      // Small line-art fish swimming right-to-left
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
      // Energetic, unmistakable walking & swimming kinematics
      const walkPhase = time * 6.2;
      const swimPhase = time * 4.8;

      const bobWalk = Math.abs(Math.sin(walkPhase)) * 3.6;
      const bobSwim = Math.sin(swimPhase) * 5.2;

      const thighLen = 14;
      const shinLen = 14;
      const hipBaseY = groundY - (thighLen + shinLen);

      const hipY =
        hipBaseY -
        bobWalk * (1 - swimFactor) -
        (28 + bobSwim) * swimFactor;

      // Forward walking lean (0.09 rad) vs horizontal swim rotation (1.36 rad ~78 deg)
      const tiltAngle = 0.09 * (1 - swimFactor) + swimFactor * 1.36;

      ctx.save();
      ctx.translate(centerX, hipY);
      ctx.rotate(tiltAngle);

      ctx.strokeStyle = '#B8DCEB';
      ctx.lineWidth = 1.85;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      const shoulderY = -26;
      const headY = -37;

      // Torso
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, shoulderY);
      ctx.stroke();

      // Head (anonymous minimalist circle)
      ctx.fillStyle = '#081017';
      ctx.beginPath();
      ctx.arc(0, headY, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Headphones in Urban/Music scene
      if (urbanWeight > 0.05) {
        ctx.save();
        ctx.globalAlpha = urbanWeight;
        ctx.strokeStyle = '#E6EFF4';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(0, headY, 8.8, Math.PI * 1.05, Math.PI * 1.95);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(1.2, headY + 0.5, 2.8, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // Articulated 2-segment + foot/hand limb helper
      const drawLeg = (phaseOffset: number, alpha: number) => {
        const wPhase = walkPhase + phaseOffset;
        const sPhase = swimPhase * 1.7 + phaseOffset;

        // Walk: hip swings forward (+sin) and backward (-sin); knee bends when leg lifts/passes
        const walkHip = Math.sin(wPhase) * 0.66;
        const walkKnee = Math.max(0, -Math.cos(wPhase) * 0.72 + 0.18);

        // Swim: rhythmic flutter kick behind body
        const swimHip = -0.18 + Math.sin(sPhase) * 0.38;
        const swimKnee = 0.22 + Math.max(0, -Math.cos(sPhase)) * 0.32;

        const hipAngle = walkHip * (1 - swimFactor) + swimHip * swimFactor;
        const kneeBend = walkKnee * (1 - swimFactor) + swimKnee * swimFactor;

        const kneeX = Math.sin(hipAngle) * thighLen;
        const kneeY = Math.cos(hipAngle) * thighLen;

        const shinAngle = hipAngle - kneeBend;
        const ankleX = kneeX + Math.sin(shinAngle) * shinLen;
        const ankleY = kneeY + Math.cos(shinAngle) * shinLen;

        // Foot segment pointing forward (or flipper extension when swimming)
        const footAngle =
          shinAngle + (1 - swimFactor) * 1.35 + swimFactor * 0.35;
        const footX = ankleX + Math.sin(footAngle) * 5.2;
        const footY = ankleY + Math.cos(footAngle) * 5.2;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(kneeX, kneeY);
        ctx.lineTo(ankleX, ankleY);
        ctx.lineTo(footX, footY);
        ctx.stroke();
        ctx.restore();
      };

      const drawArm = (phaseOffset: number, alpha: number) => {
        const wPhase = walkPhase + phaseOffset;
        const sPhase = swimPhase + phaseOffset;

        // Counter-swing to legs during walk
        const walkShoulder = Math.sin(wPhase) * 0.56;
        const walkElbow = 0.42 + Math.max(0, Math.sin(wPhase)) * 0.35;

        // Wide overhead/breaststroke reach during swim
        const swimShoulder = 1.95 + Math.sin(sPhase) * 0.85;
        const swimElbow = 0.38 + Math.max(0, Math.cos(sPhase)) * 0.45;

        const shAngle =
          walkShoulder * (1 - swimFactor) + swimShoulder * swimFactor;
        const elBend = walkElbow * (1 - swimFactor) + swimElbow * swimFactor;

        const upperLen = 11.5;
        const foreLen = 11;

        const sy = shoulderY + 3;
        const elbowX = Math.sin(shAngle) * upperLen;
        const elbowY = sy + Math.cos(shAngle) * upperLen;

        const foreAngle = shAngle + elBend;
        const handX = elbowX + Math.sin(foreAngle) * foreLen;
        const handY = elbowY + Math.cos(foreAngle) * foreLen;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(0, sy);
        ctx.lineTo(elbowX, elbowY);
        ctx.lineTo(handX, handY);
        ctx.stroke();
        ctx.restore();
      };

      // Back limbs (dimmed for depth)
      drawLeg(Math.PI, 0.52);
      drawArm(0, 0.52);

      // Front limbs (bright)
      drawLeg(0, 1);
      drawArm(Math.PI, 1);

      ctx.restore();

      // Floating musical notes in Urban scene
      const st = stateRef.current;
      if (urbanWeight > 0.15) {
        st.nextNoteTimer -= dt;
        if (st.nextNoteTimer <= 0) {
          st.nextNoteTimer = 0.62 + Math.random() * 0.4;
          st.musicNotes.push({
            x: centerX - 2,
            y: hipY - 42,
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
      st.worldScroll += dt * 58; // Crisp continuous horizontal displacement

      const weights = getWeights(st.elapsed);
      const swimFactor = smoothstep(weights.undersea);
      const groundY = height - 48;

      ctx.clearRect(0, 0, width, height);

      // Subtle atmospheric gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, 'rgba(8, 16, 23, 0)');
      bgGrad.addColorStop(0.5, 'rgba(11, 22, 31, 0.5)');
      bgGrad.addColorStop(1, 'rgba(8, 16, 23, 0.96)');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Stars
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

      // Morphing ground / undulating seabed line
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

      // Articulated central character
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
