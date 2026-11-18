import React, { useEffect, useState } from 'react';
import { FastForward } from 'lucide-react';
import { AppState, SearchTelemetry } from '../types/cincontra';
import { CinContraLogo } from './CinContraLogo';

interface LiveLogoStageProps {
  appState: AppState;
  telemetry: SearchTelemetry;
  onStartParams: () => void;
  onMovement1Done: () => void;
  onMovement2Done: () => void;
  onMovement3Done: () => void;
}

const TOTAL_SECONDS = 30;

const STAGES = [
  { at: 0, label: 'Filtragem de elegibilidade na base de talentos' },
  { at: 0.25, label: 'Poda combinatória por restrições do projeto' },
  { at: 0.55, label: 'Avaliação de química interpessoal e equilíbrio de perfis' },
  { at: 0.82, label: 'Consolidação determinística do Top 5 Squads' },
];

export const ComputingOverlay: React.FC<LiveLogoStageProps> = ({
  appState,
  telemetry,
  onStartParams,
  onMovement1Done,
  onMovement2Done,
  onMovement3Done,
}) => {
  const [elapsedMs, setElapsedMs] = useState(0);

  // Movement 1: Top-left -> Descends down left side (750ms)
  useEffect(() => {
    if (appState !== 'MOVEMENT_1_DOWN') return;
    const timer = window.setTimeout(() => {
      onMovement1Done();
    }, 750);
    return () => window.clearTimeout(timer);
  }, [appState, onMovement1Done]);

  // Movement 2: Center 30s calculation window
  useEffect(() => {
    if (appState !== 'MOVEMENT_2_CENTER') {
      setElapsedMs(0);
      return;
    }
    const start = performance.now();
    let rafId = 0;

    const tick = (now: number) => {
      const next = now - start;
      if (next >= TOTAL_SECONDS * 1000) {
        setElapsedMs(TOTAL_SECONDS * 1000);
        onMovement2Done();
        return;
      }
      setElapsedMs(next);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [appState, onMovement2Done]);

  // Movement 3: Vertices expand directly in the open center background to morph into member balloons (820ms)
  useEffect(() => {
    if (appState !== 'MOVEMENT_3_EXPAND') return;
    const timer = window.setTimeout(() => {
      onMovement3Done();
    }, 820);
    return () => window.clearTimeout(timer);
  }, [appState, onMovement3Done]);

  if (appState === 'DASHBOARD') {
    return null;
  }

  const progress = Math.min(1, elapsedMs / (TOTAL_SECONDS * 1000));
  const remainingSec = Math.max(0, Math.ceil(TOTAL_SECONDS - elapsedMs / 1000));

  const currentStage =
    [...STAGES].reverse().find((s) => progress >= s.at)?.label ??
    STAGES[0].label;

  const displayedEval = Math.min(
    telemetry.combinationsEvaluated,
    Math.max(1, Math.round(telemetry.combinationsEvaluated * progress))
  );

  // Compute dynamic position and expansion directly on background (no box frame)
  let containerStyle: React.CSSProperties = {};
  if (appState === 'INITIAL') {
    containerStyle = {
      left: '50%',
      top: '31%',
      width: '260px',
      height: '280px',
      transform: 'translate3d(-50%, -50%, 0) scale(1)',
    };
  } else if (appState === 'PARAMS') {
    containerStyle = {
      left: '214px',
      top: '76px',
      width: '180px',
      height: '136px',
      transform: 'translate3d(-50%, -50%, 0) scale(1)',
    };
  } else if (appState === 'MOVEMENT_1_DOWN') {
    // Movimento 1: Desce suavemente pela lateral esquerda
    containerStyle = {
      left: '214px',
      top: '44%',
      width: '190px',
      height: '190px',
      transform: 'translate3d(-50%, -50%, 0) scale(1)',
    };
  } else if (appState === 'MOVEMENT_2_CENTER') {
    // Movimento 2: Centro da tela durante o carregamento de 30s
    containerStyle = {
      left: '50%',
      top: '32%',
      width: '440px',
      height: '390px',
      transform: 'translate3d(-50%, -50%, 0) scale(1)',
    };
  } else if (appState === 'MOVEMENT_3_EXPAND') {
    // Movimento 3: Os vértices do logo se expandem diretamente no centro do fundo para virarem os balões dos membros
    containerStyle = {
      left: '50%',
      top: '33%',
      width: '540px',
      height: '440px',
      transform: 'translate3d(-50%, -50%, 0) scale(1.65)',
      opacity: 0.12,
    };
  }

  const isComputing = appState === 'MOVEMENT_2_CENTER';

  return (
    <div
      style={containerStyle}
      className="fixed z-30 flex flex-col items-center justify-center transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-auto"
    >
      <CinContraLogo
        mode={
          appState === 'INITIAL'
            ? 'initial'
            : appState === 'PARAMS'
              ? 'params'
              : appState === 'MOVEMENT_1_DOWN'
                ? 'movement1'
                : appState === 'MOVEMENT_2_CENTER'
                  ? 'computing'
                  : 'expanding'
        }
        computingProgress={progress}
        onClick={appState === 'INITIAL' ? onStartParams : undefined}
      />

      {/* Discreet 30s Calculation Status & Demo Button during Movement 2 */}
      {isComputing && (
        <div className="mt-3 w-full max-w-[420px] cin-panel rounded-xl p-3.5 shadow-xl">
          <div className="flex items-center justify-between gap-3 mb-2">
            <span className="text-xs font-medium text-[#A3C9D9] truncate">
              {currentStage}
            </span>
            <span className="font-grotesk text-xs font-semibold text-[#E6EFF4] shrink-0">
              {remainingSec}s
            </span>
          </div>

          <div className="w-full h-1 rounded-full bg-[#7FA6B8]/20 overflow-hidden mb-2.5">
            <div
              className="h-full bg-[#8EB8CA] transition-[width] duration-150 ease-linear"
              style={{ width: `${(progress * 100).toFixed(1)}%` }}
            />
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[11px] text-[#8EAAB8]">
              Combinações avaliadas:{' '}
              <strong className="font-grotesk text-[#E6EFF4]">
                {displayedEval}/{telemetry.totalCombinationsSpace}
              </strong>
            </span>
            <button
              type="button"
              onClick={onMovement2Done}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#8EB8CA]/45 bg-[#081017] hover:bg-[#7FA6B8]/15 px-2.5 py-1 text-[11px] font-medium text-[#A3C9D9] hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              <FastForward className="w-3 h-3" />
              Concluir Agora (Demo)
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
