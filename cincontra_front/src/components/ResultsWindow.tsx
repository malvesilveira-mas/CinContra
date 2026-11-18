import React from 'react';
import { AlertTriangle, CheckCircle2, Minus } from 'lucide-react';
import { SquadEvaluation, SquadParams } from '../types/cincontra';

interface ResultsWindowProps {
  params: SquadParams;
  currentEval: SquadEvaluation;
  baselineSquad: SquadEvaluation;
  isModified: boolean;
  onMinimize: () => void;
}

const SUB_INDEX_META = [
  {
    id: 'tecnico',
    title: 'Competência Técnica',
    tooltip:
      'Avalia o atendimento às skills obrigatórias do projeto, a proficiência técnica da equipe e a redundância entre especialistas.',
  },
  {
    id: 'dominio',
    title: 'Domínio do Setor',
    tooltip:
      'Mede a vivência prática dos profissionais no setor do projeto e a prontidão para o nível de criticidade regulatória exigido.',
  },
  {
    id: 'quimica',
    title: 'Química da Equipe',
    tooltip:
      'Calcula a sinergia interpessoal a partir dos laços de afinidade (arestas verdes) e eventuais atritos (arestas vermelhas).',
  },
  {
    id: 'perfis',
    title: 'Equilíbrio de Perfis',
    tooltip:
      'Verifica o balanço complementar entre perfis de concepção, análise crítica, execução pragmática, facilitação e resolução de crises.',
  },
  {
    id: 'eficiencia',
    title: 'Eficiência de Custo & Entrega',
    tooltip:
      'Relaciona o histórico comprovado de entregas bem-sucedidas com a adequação financeira ao teto de orçamento por hora.',
  },
] as const;

export const ResultsWindow: React.FC<ResultsWindowProps> = ({
  params,
  currentEval,
  baselineSquad,
  isModified,
  onMinimize,
}) => {
  const scoreDelta = currentEval.scoreFinal - baselineSquad.scoreFinal;
  const costDelta = currentEval.custoHoraTotal - baselineSquad.custoHoraTotal;

  const subIndexValues = [
    { ...SUB_INDEX_META[0], value: currentEval.subIndices.sTecnico },
    { ...SUB_INDEX_META[1], value: currentEval.subIndices.sDominio },
    { ...SUB_INDEX_META[2], value: currentEval.subIndices.sQuimica },
    { ...SUB_INDEX_META[3], value: currentEval.subIndices.sRpg },
    { ...SUB_INDEX_META[4], value: currentEval.subIndices.sConfiabCusto },
  ];

  return (
    <section
      aria-label="Resultados da Combinação"
      className="w-[calc(100vw-32px)] sm:w-[348px] rounded-2xl border border-[#8EB8CA]/45 bg-[#09121A] shadow-2xl flex flex-col overflow-visible"
    >
      {/* Header with Minimize button */}
      <div className="border-b border-[#7FA6B8]/25 bg-[#0D1821] rounded-t-2xl px-3.5 py-2.5 flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-[#E6EFF4]">
          Resultados da Combinação
        </h2>
        <button
          type="button"
          onClick={onMinimize}
          title="Minimizar Resultados"
          aria-label="Minimizar Resultados"
          className="p-1 rounded border border-[#7FA6B8]/30 text-[#A3C9D9] hover:text-white hover:border-[#A3C9D9] transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 flex flex-col gap-3">
        {/* Top Metrics: Score Total & Custo/Hora */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-xl border border-[#7FA6B8]/25 bg-[#0D1821] px-3 py-2">
            <div className="text-[11px] text-[#8EAAB8]">Score Total</div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-grotesk text-lg font-semibold text-[#E6EFF4]">
                {currentEval.scoreFinal.toFixed(2)}
              </span>
              <span className="font-grotesk text-[11px] text-[#8EAAB8]">
                /100
              </span>
              {isModified && Math.abs(scoreDelta) >= 0.01 && (
                <span
                  className={`font-grotesk text-[11px] font-medium ${
                    scoreDelta >= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                  }`}
                >
                  {scoreDelta >= 0 ? '+' : ''}
                  {scoreDelta.toFixed(2)}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#7FA6B8]/25 bg-[#0D1821] px-3 py-2">
            <div className="text-[11px] text-[#8EAAB8]">
              Custo/Hora (teto R$ {params.orcamentoMaxHora})
            </div>
            <div className="mt-0.5 flex items-baseline gap-1.5">
              <span className="font-grotesk text-base font-semibold text-[#E6EFF4]">
                R$ {currentEval.custoHoraTotal}/h
              </span>
              {isModified && costDelta !== 0 && (
                <span
                  className={`font-grotesk text-[11px] font-medium ${
                    costDelta <= 0 ? 'text-[#22C55E]' : 'text-[#EF4444]'
                  }`}
                >
                  {costDelta > 0 ? '+' : ''}R$ {costDelta}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Hard Constraint / What-If Status */}
        {!currentEval.isValid ? (
          <div
            role="alert"
            className="rounded-xl border border-[#EF4444]/55 bg-[#EF4444]/10 p-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#FCA5A5]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-[#EF4444]" />
              <span>Restrição do projeto violada</span>
            </div>
            <ul className="pl-4 list-disc flex flex-col gap-0.5 text-[10px] text-[#FECACA]">
              {currentEval.violations.map((v, idx) => (
                <li key={`${v.code}-${idx}`}>{v.message}</li>
              ))}
            </ul>
          </div>
        ) : (
          isModified && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#22C55E] px-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Simulação What-If válida dentro das restrições</span>
            </div>
          )
        )}

        {/* 5 Clean Sub-Indices with (!) Tooltips */}
        <div className="flex flex-col gap-2">
          {subIndexValues.map((item) => (
            <div key={item.id} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-[#E6EFF4]">
                    {item.title}
                  </span>
                  <div className="group relative inline-flex items-center">
                    <span
                      tabIndex={0}
                      aria-label={item.tooltip}
                      className="w-3.5 h-3.5 rounded-full border border-[#8EB8CA]/55 text-[#A3C9D9] text-[9px] font-semibold inline-flex items-center justify-center cursor-help select-none hover:border-[#E6EFF4] hover:text-white"
                    >
                      !
                    </span>
                    <div
                      role="tooltip"
                      className="pointer-events-none opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-150 absolute left-0 bottom-[calc(100%+6px)] w-56 rounded-lg border border-[#8EB8CA]/45 bg-[#081017] p-2.5 text-[11px] text-[#E6EFF4] leading-relaxed shadow-xl z-50"
                    >
                      {item.tooltip}
                    </div>
                  </div>
                </div>
                <span className="font-grotesk text-[11px] font-semibold text-[#A3C9D9]">
                  {item.value.toFixed(1)}
                </span>
              </div>

              <div className="h-1.5 w-full rounded-full bg-[#7FA6B8]/15 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#8EB8CA] transition-all duration-300"
                  style={{ width: `${Math.min(100, item.value)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
