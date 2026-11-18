import React, { useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  BarChart3,
  Minimize2,
  RotateCcw,
  SlidersHorizontal,
  Users,
} from 'lucide-react';
import { BottomSceneryCanvas } from './components/BottomSceneryCanvas';
import { ComputingOverlay } from './components/ComputingOverlay';
import { ParametersPanel } from './components/ParametersPanel';
import { ResultsWindow } from './components/ResultsWindow';
import { SquadRelationGraph } from './components/SquadRelationGraph';
import { TalentBankWindow } from './components/TalentBankWindow';
import { DEFAULT_PARAMS, PROFESSIONALS } from './data/professionals';
import { evaluateSquad, solveTopSquads } from './engine/scoringEngine';
import {
  AppState,
  Professional,
  SearchTelemetry,
  SquadEvaluation,
  SquadParams,
} from './types/cincontra';

export default function App() {
  const [appState, setAppState] = useState<AppState>('INITIAL');
  const [params, setParams] = useState<SquadParams>(DEFAULT_PARAMS);
  const [topSquads, setTopSquads] = useState<SquadEvaluation[]>([]);
  const [telemetry, setTelemetry] = useState<SearchTelemetry>({
    totalCombinationsSpace: 92,
    combinationsEvaluated: 92,
    branchesPruned: 0,
    validFound: 5,
  });
  const [activeTabIdx, setActiveTabIdx] = useState<number>(0);
  const [whatIfMembersByTab, setWhatIfMembersByTab] = useState<
    Record<number, Professional[]>
  >({});

  // Three independent corner-anchored subwindows
  const [isParamsOpen, setIsParamsOpen] = useState<boolean>(false);
  const [isResultsOpen, setIsResultsOpen] = useState<boolean>(true);
  const [isBankOpen, setIsBankOpen] = useState<boolean>(false);

  // Shared multi-openable '+' popover state
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Track squad member currently being dragged for bottom-strip removal zone
  const [draggingSquadMemberId, setDraggingSquadMemberId] = useState<
    string | null
  >(null);
  const [isDragOverAnimation, setIsDragOverAnimation] =
    useState<boolean>(false);

  const handleToggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const runCalculationCycle = useCallback((nextParams: SquadParams) => {
    setParams(nextParams);
    setIsParamsOpen(false);
    setIsResultsOpen(true);
    setIsBankOpen(false);
    setExpandedIds(new Set());

    const solved = solveTopSquads(PROFESSIONALS, nextParams);
    setTopSquads(solved.topSquads);
    setTelemetry(solved.telemetry);
    setActiveTabIdx(0);

    const initialMap: Record<number, Professional[]> = {};
    solved.topSquads.forEach((sq, idx) => {
      initialMap[idx] = sq.members;
    });
    setWhatIfMembersByTab(initialMap);

    setAppState('MOVEMENT_1_DOWN');
  }, []);

  const handleStartParams = useCallback(() => {
    setAppState('PARAMS');
  }, []);

  const handleMovement1Done = useCallback(() => {
    setAppState('MOVEMENT_2_CENTER');
  }, []);

  const handleMovement2Done = useCallback(() => {
    setAppState('MOVEMENT_3_EXPAND');
  }, []);

  const handleMovement3Done = useCallback(() => {
    // Enter Estado 4: Parâmetros starts minimized (top-left), Banco de Talentos starts minimized (top-right), Resultados starts open (bottom-left)
    setIsParamsOpen(false);
    setIsBankOpen(false);
    setIsResultsOpen(true);
    setAppState('DASHBOARD');
  }, []);

  const activeMembers = useMemo(
    () =>
      whatIfMembersByTab[activeTabIdx] ?? topSquads[activeTabIdx]?.members ?? [],
    [whatIfMembersByTab, activeTabIdx, topSquads]
  );

  const baselineSquad = topSquads[activeTabIdx] ?? topSquads[0];

  const currentEval = useMemo(
    () => evaluateSquad(activeMembers, params, `active-whatif-${activeTabIdx}`),
    [activeMembers, params, activeTabIdx]
  );

  const isModified = useMemo(() => {
    if (!baselineSquad) return false;
    if (baselineSquad.members.length !== activeMembers.length) return true;
    const baseIds = new Set(baselineSquad.members.map((m) => m.id));
    return activeMembers.some((m) => !baseIds.has(m.id));
  }, [baselineSquad, activeMembers]);

  const handleUpdateMembers = useCallback(
    (nextMembers: Professional[]) => {
      setWhatIfMembersByTab((prev) => ({
        ...prev,
        [activeTabIdx]: nextMembers,
      }));
    },
    [activeTabIdx]
  );

  const handleResetActiveSquad = useCallback(() => {
    if (!baselineSquad) return;
    handleUpdateMembers(baselineSquad.members);
  }, [baselineSquad, handleUpdateMembers]);

  const handleSwapMember = useCallback(
    (targetSquadId: string, incomingBankId: string) => {
      const incoming = PROFESSIONALS.find((p) => p.id === incomingBankId);
      if (!incoming || activeMembers.some((m) => m.id === incoming.id)) return;
      handleUpdateMembers(
        activeMembers.map((m) => (m.id === targetSquadId ? incoming : m))
      );
    },
    [activeMembers, handleUpdateMembers]
  );

  const handleAddMember = useCallback(
    (incomingBankId: string) => {
      if (activeMembers.length >= params.maxSize) return;
      const incoming = PROFESSIONALS.find((p) => p.id === incomingBankId);
      if (!incoming || activeMembers.some((m) => m.id === incoming.id)) return;
      handleUpdateMembers([...activeMembers, incoming]);
    },
    [activeMembers, params.maxSize, handleUpdateMembers]
  );

  const handleRemoveFromSquad = useCallback(
    (squadMemberId: string) => {
      if (activeMembers.length <= 1) return;
      handleUpdateMembers(activeMembers.filter((m) => m.id !== squadMemberId));
    },
    [activeMembers, handleUpdateMembers]
  );

  const handleMinimizeAll = useCallback(() => {
    setIsParamsOpen(false);
    setIsResultsOpen(false);
    setIsBankOpen(false);
  }, []);

  const isDashboard = appState === 'DASHBOARD';
  const anySubwindowOpen =
    isDashboard && (isParamsOpen || isResultsOpen || isBankOpen);

  return (
    <div className="relative min-h-screen w-full bg-gradient-to-b from-[#081017] via-[#0A151E] to-[#0D1821] text-[#E6EFF4] overflow-hidden">
      {/* Subtle atmospheric radial glow behind upper stage */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            'radial-gradient(circle at 50% 24%, rgba(127, 166, 184, 0.09) 0%, rgba(8, 16, 23, 0) 58%)',
        }}
      />

      {/* ALWAYS-ACTIVE SILENT BOTTOM LINE-ART SCENERY STRIP (35vh) */}
      <BottomSceneryCanvas />

      {/* DROP-TO-REMOVE ZONE OVER BOTTOM ANIMATION STRIP (VISIBLE ONLY WHILE DRAGGING A MEMBER BALLOON) */}
      {isDashboard && draggingSquadMemberId && (
        <div
          onDragOver={(e) => {
            if (
              e.dataTransfer.types.includes('application/x-cincontra-squad')
            ) {
              e.preventDefault();
              setIsDragOverAnimation(true);
            }
          }}
          onDragLeave={() => setIsDragOverAnimation(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragOverAnimation(false);
            const squadId = e.dataTransfer.getData(
              'application/x-cincontra-squad'
            );
            if (squadId) {
              handleRemoveFromSquad(squadId);
            }
            setDraggingSquadMemberId(null);
          }}
          style={{ height: 'max(220px, 35vh)' }}
          className={`fixed inset-x-0 bottom-0 z-25 flex items-start justify-center pt-4 transition-colors ${
            isDragOverAnimation
              ? 'border-t-2 border-[#EF4444]/85 bg-[#EF4444]/12'
              : 'border-t border-dashed border-[#8EB8CA]/60 bg-[#081017]/25'
          }`}
        >
          <span
            className={`rounded-full border px-4 py-1.5 text-xs font-medium shadow-lg ${
              isDragOverAnimation
                ? 'border-[#EF4444]/75 bg-[#0D1821] text-[#FCA5A5]'
                : 'border-[#8EB8CA]/55 bg-[#0D1821]/95 text-[#A3C9D9]'
            }`}
          >
            Solte sobre a animação para remover {draggingSquadMemberId} do squad
          </span>
        </div>
      )}

      {/* SINGLE LIVE LOGO CONTAINER (INITIAL -> PARAMS -> 3 SEQUENTIAL MOVEMENTS EXPANDING AT CENTER) */}
      <ComputingOverlay
        appState={appState}
        telemetry={telemetry}
        onStartParams={handleStartParams}
        onMovement1Done={handleMovement1Done}
        onMovement2Done={handleMovement2Done}
        onMovement3Done={handleMovement3Done}
      />

      {/* STATE 2: FLOATING LEFT PARAMETERS PANEL BELOW DOCKED LOGO */}
      <AnimatePresence>
        {appState === 'PARAMS' && (
          <motion.section
            key="state-params"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-4 sm:left-6 top-[146px] z-30 w-[calc(100vw-32px)] max-w-[380px]"
          >
            <ParametersPanel
              params={params}
              mode="floating"
              onSubmit={runCalculationCycle}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* ESTADO 4: CENTRAL GRAPH INTEGRATED DIRECTLY ONTO DARK NAVY BACKGROUND */}
      {/* ===================================================================== */}
      <AnimatePresence>
        {isDashboard && topSquads.length > 0 && (
          <>
            {/* 1. TOP-CENTER INTEGRATED TOP 5 SQUADS BAR (NO FRAME, NO MINIMIZE) */}
            <motion.nav
              key="top5-background-bar"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28 }}
              aria-label="Seletor das Top 5 Equipes"
              className="fixed top-3 inset-x-0 z-30 flex items-center justify-center pointer-events-none px-4"
            >
              <div
                role="tablist"
                aria-label="Top 5 Equipes"
                className="pointer-events-auto flex items-center gap-1.5 sm:gap-2"
              >
                {topSquads.map((sq, idx) => {
                  const isActive = idx === activeTabIdx;
                  const displayEval = isActive ? currentEval : sq;
                  return (
                    <button
                      key={sq.id}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveTabIdx(idx)}
                      className={`px-2.5 py-1 text-left transition-all cursor-pointer border-b-2 ${
                        isActive
                          ? 'border-[#A3C9D9] text-[#E6EFF4]'
                          : 'border-transparent text-[#8EAAB8] hover:text-[#CFE0E8] hover:border-[#7FA6B8]/40'
                      }`}
                    >
                      <div className="flex items-baseline gap-1.5 whitespace-nowrap">
                        <span className="text-xs font-semibold">
                          {idx === 0 ? '1º Campeão' : `${idx + 1}º`}
                        </span>
                        <span className="font-grotesk text-xs font-semibold text-[#A3C9D9]">
                          {displayEval.scoreFinal.toFixed(1)}
                        </span>
                      </div>
                      <div className="font-grotesk text-[10px] text-[#8EAAB8] whitespace-nowrap">
                        R$ {displayEval.custoHoraTotal}/h
                      </div>
                    </button>
                  );
                })}

                {isModified && (
                  <button
                    type="button"
                    onClick={handleResetActiveSquad}
                    title="Restaurar squad original"
                    className="ml-1 inline-flex items-center gap-1 rounded-full border border-[#7FA6B8]/40 bg-[#0D1821]/85 hover:border-[#A3C9D9] px-2.5 py-1 text-[11px] font-medium text-[#A3C9D9] hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </button>
                )}
              </div>
            </motion.nav>

            {/* 2. CENTRAL STAR GRAPH DIRECTLY ON BACKGROUND (VERTICES EXPAND FROM LOGO) */}
            <motion.main
              key="central-background-graph"
              initial={{ opacity: 0, scale: 0.72 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="fixed inset-x-0 top-[68px] bottom-[max(220px,35vh)] z-20 flex items-center justify-center pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-[700px] h-full">
                <SquadRelationGraph
                  membersWithRationale={currentEval.membersWithRationale}
                  edges={currentEval.edges}
                  hasFacilitator={currentEval.hasFacilitator}
                  expandedIds={expandedIds}
                  onToggleExpand={handleToggleExpand}
                  onSwapMember={handleSwapMember}
                  onAddMember={handleAddMember}
                  onDraggingMemberChange={setDraggingSquadMemberId}
                />
              </div>
            </motion.main>
          </>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* CORNER 1 (TOP-LEFT): PARÂMETROS (MINIMIZED PILL <-> OPEN SUBWINDOW)   */}
      {/* ===================================================================== */}
      {(appState === 'MOVEMENT_1_DOWN' ||
        appState === 'MOVEMENT_2_CENTER' ||
        appState === 'MOVEMENT_3_EXPAND' ||
        (isDashboard && !isParamsOpen)) && (
        <div className="fixed left-4 top-3 z-40">
          <button
            type="button"
            onClick={() => {
              if (isDashboard) setIsParamsOpen(true);
            }}
            disabled={!isDashboard}
            className={`inline-flex items-center gap-2 rounded-full border border-[#8EB8CA]/75 bg-[#0D1821] px-3.5 py-1.5 text-xs font-medium text-[#E6EFF4] shadow-lg transition-colors whitespace-nowrap ${
              isDashboard
                ? 'hover:border-[#A3C9D9] hover:bg-[#132330] cursor-pointer'
                : 'opacity-80 cursor-default'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#A3C9D9] shrink-0" />
            <span>
              Urgência:{' '}
              <strong className="font-semibold text-[#A3C9D9]">
                {params.urgencia}
              </strong>
              <span className="mx-1.5 text-[#7FA6B8]/50">·</span>
              Squad:{' '}
              <strong className="font-grotesk font-semibold text-[#A3C9D9]">
                {params.minSize}–{params.maxSize}
              </strong>
            </span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {isDashboard && isParamsOpen && (
          <motion.div
            key="corner-params-window"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-4 top-3 z-40 w-[calc(100vw-32px)] max-w-[350px]"
          >
            <ParametersPanel
              params={params}
              mode="drawer"
              onSubmit={runCalculationCycle}
              onMinimizeDrawer={() => setIsParamsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* CORNER 2 (BOTTOM-LEFT): RESULTADOS DA COMBINAÇÃO (OVERLAPS ANIMATION) */}
      {/* ===================================================================== */}
      {isDashboard && !isResultsOpen && (
        <div className="fixed left-4 bottom-4 z-40">
          <button
            type="button"
            onClick={() => setIsResultsOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-[#8EB8CA]/75 bg-[#0D1821] hover:bg-[#132330] hover:border-[#A3C9D9] px-4 py-1.5 text-xs font-semibold text-[#E6EFF4] shadow-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <BarChart3 className="w-3.5 h-3.5 text-[#A3C9D9] shrink-0" />
            <span>Resultados</span>
          </button>
        </div>
      )}

      <AnimatePresence>
        {isDashboard && isResultsOpen && baselineSquad && (
          <motion.div
            key="corner-results-window"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-4 bottom-4 z-40"
          >
            <ResultsWindow
              params={params}
              currentEval={currentEval}
              baselineSquad={baselineSquad}
              isModified={isModified}
              onMinimize={() => setIsResultsOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================================================================== */}
      {/* CORNER 3 (TOP-RIGHT): MINIMIZAR TODAS + BANCO DE TALENTOS             */}
      {/* ===================================================================== */}
      {isDashboard && (
        <div className="fixed right-4 top-3 z-40 flex items-center justify-end gap-2">
          {anySubwindowOpen && (
            <button
              type="button"
              onClick={handleMinimizeAll}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#7FA6B8]/50 bg-[#0D1821]/90 hover:bg-[#132330] hover:border-[#A3C9D9] px-3 py-1.5 text-xs font-medium text-[#A3C9D9] hover:text-white shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Minimize2 className="w-3.5 h-3.5 shrink-0" />
              <span>Minimizar Todas</span>
            </button>
          )}

          {!isBankOpen && (
            <button
              type="button"
              onClick={() => setIsBankOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#8EB8CA]/75 bg-[#0D1821] hover:bg-[#132330] hover:border-[#A3C9D9] px-3.5 py-1.5 text-xs font-medium text-[#E6EFF4] shadow-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Users className="w-3.5 h-3.5 text-[#A3C9D9] shrink-0" />
              <span>Banco de Talentos</span>
            </button>
          )}
        </div>
      )}

      <AnimatePresence>
        {isDashboard && isBankOpen && (
          <motion.div
            key="corner-bank-window"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed right-4 top-[52px] z-35"
          >
            <TalentBankWindow
              params={params}
              allProfessionals={PROFESSIONALS}
              activeMembers={activeMembers}
              expandedIds={expandedIds}
              onToggleExpand={handleToggleExpand}
              onMinimize={() => setIsBankOpen(false)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
