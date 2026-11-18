import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, SlidersHorizontal, X } from 'lucide-react';
import {
  ALL_SKILLS,
  DOMAIN_LABELS,
  SKILL_LABELS,
} from '../data/professionals';
import {
  DomainSector,
  RegulatoryLevel,
  RequiredSkill,
  SkillKey,
  SolutionType,
  SquadParams,
  UrgencyLevel,
} from '../types/cincontra';

interface ParametersPanelProps {
  params: SquadParams;
  mode: 'floating' | 'drawer';
  onSubmit: (nextParams: SquadParams) => void;
  onMinimizeDrawer?: () => void;
}

const PARAM_TOOLTIPS = {
  dominio:
    'Área de negócio do projeto. Prioriza profissionais que já possuem experiência comprovada nesse setor.',
  solucao:
    'Natureza técnica do que será construído. Ajusta automaticamente o peso entre velocidade de entrega, arquitetura e análise de dados.',
  skills:
    'Competências técnicas indispensáveis e o nível mínimo exigido (1 a 5). Qualquer equipe que não cubra 100% dessa lista é descartada.',
  orcamento:
    'Teto financeiro por hora para a soma de todos os integrantes. Equipes que ultrapassem esse valor são eliminadas.',
  tamanho:
    'Quantidade mínima e máxima de pessoas na equipe. Também define a proporção necessária entre executores e lideranças.',
  urgencia:
    'Nível de pressão por velocidade. Em urgência crítica, o motor prioriza perfis ágeis e especialistas em resolução rápida de crises.',
  regulatoria:
    'Grau de exigência legal, conformidade e risco operacional. Em nível alto, libera gerentes em equipes menores e prioriza perfis mais metódicos e analíticos.',
} as const;

interface InfoTooltipProps {
  text: string;
}

const InfoTooltip: React.FC<InfoTooltipProps> = ({ text }) => {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    placeAbove: boolean;
  } | null>(null);

  const show = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const tooltipWidth = 256;
    const clampedLeft = Math.min(
      window.innerWidth - tooltipWidth - 12,
      Math.max(12, rect.left - 8)
    );
    const placeAbove = rect.top > 130;
    setCoords({
      left: clampedLeft,
      top: placeAbove ? rect.top - 8 : rect.bottom + 8,
      placeAbove,
    });
  };

  const hide = () => setCoords(null);

  return (
    <>
      <span
        ref={triggerRef}
        tabIndex={0}
        aria-label={text}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className="w-3.5 h-3.5 rounded-full border border-[#8EB8CA]/55 text-[#A3C9D9] text-[9px] font-semibold inline-flex items-center justify-center cursor-help select-none hover:border-[#E6EFF4] hover:text-white shrink-0"
      >
        !
      </span>
      {coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            role="tooltip"
            style={{
              left: `${coords.left}px`,
              top: `${coords.top}px`,
              transform: coords.placeAbove ? 'translateY(-100%)' : 'none',
            }}
            className="pointer-events-none fixed z-[999] w-64 rounded-lg border border-[#8EB8CA]/55 bg-[#081017] p-2.5 text-[11px] text-[#E6EFF4] leading-relaxed shadow-2xl"
          >
            {text}
          </div>,
          document.body
        )}
    </>
  );
};

const DOMAINS: DomainSector[] = [
  'Energia_Utilities',
  'Financeiro',
  'Industria_4_0',
  'Logistica',
  'Varejo',
  'Saude',
];

const SOLUTION_TYPES: SolutionType[] = [
  'Software Preditivo/IA',
  'Produto Digital/App',
  'Plataforma de Dados/BI',
  'Sistema Crítico/IoT',
];

const URGENCY_LEVELS: UrgencyLevel[] = ['Baixa', 'Normal', 'Crítica'];
const REGULATORY_LEVELS: RegulatoryLevel[] = ['Baixa', 'Média', 'Alta'];

export const ParametersPanel: React.FC<ParametersPanelProps> = ({
  params,
  mode,
  onSubmit,
  onMinimizeDrawer,
}) => {
  const [draft, setDraft] = useState<SquadParams>(params);
  const [skillToAdd, setSkillToAdd] = useState<SkillKey | ''>('');

  useEffect(() => {
    setDraft(params);
  }, [params]);

  const availableSkillsToAdd = ALL_SKILLS.filter(
    (s) => !draft.skillsObrigatorias.some((req) => req.skill === s)
  );

  const handleToggleSkillLevel = (
    skill: SkillKey,
    minLevel: 1 | 2 | 3 | 4 | 5
  ) => {
    setDraft((prev) => ({
      ...prev,
      skillsObrigatorias: prev.skillsObrigatorias.map((item) =>
        item.skill === skill ? { ...item, minLevel } : item
      ),
    }));
  };

  const handleRemoveSkill = (skill: SkillKey) => {
    setDraft((prev) => ({
      ...prev,
      skillsObrigatorias: prev.skillsObrigatorias.filter(
        (item) => item.skill !== skill
      ),
    }));
  };

  const handleAddSkill = () => {
    if (!skillToAdd) return;
    const nextItem: RequiredSkill = { skill: skillToAdd, minLevel: 3 };
    setDraft((prev) => ({
      ...prev,
      skillsObrigatorias: [...prev.skillsObrigatorias, nextItem],
    }));
    setSkillToAdd('');
  };

  const handleMinSizeChange = (val: number) => {
    setDraft((prev) => ({
      ...prev,
      minSize: val,
      maxSize: Math.max(val, prev.maxSize),
    }));
  };

  const handleMaxSizeChange = (val: number) => {
    setDraft((prev) => ({
      ...prev,
      maxSize: val,
      minSize: Math.min(val, prev.minSize),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(draft);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={`cin-panel rounded-xl p-4 text-[#E6EFF4] shadow-2xl flex flex-col gap-3 ${
        mode === 'drawer'
          ? 'w-full max-w-[350px] max-h-[calc(64vh-64px)] overflow-y-auto'
          : 'w-full max-w-[380px] max-h-[calc(64vh-120px)] overflow-y-auto'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#7FA6B8]/20 pb-2">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-[#8EB8CA]" />
          <h2 className="text-sm font-semibold tracking-wide text-[#E6EFF4]">
            Parâmetros do Projeto
          </h2>
        </div>
        {mode === 'drawer' && onMinimizeDrawer && (
          <button
            type="button"
            onClick={onMinimizeDrawer}
            title="Minimizar parâmetros"
            aria-label="Minimizar painel de parâmetros"
            className="p-1 rounded-md border border-[#7FA6B8]/30 text-[#A3C9D9] hover:text-white hover:border-[#A3C9D9] transition-colors cursor-pointer"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* 1. Domínio Setorial */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="param-domain"
            className="text-xs font-medium text-[#A3C9D9]"
          >
            1. Domínio Setorial
          </label>
          <InfoTooltip text={PARAM_TOOLTIPS.dominio} />
        </div>
        <select
          id="param-domain"
          value={draft.dominioSetorial}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              dominioSetorial: e.target.value as DomainSector,
            }))
          }
          className="w-full rounded-lg bg-[#081017] border border-[#7FA6B8]/30 px-2.5 py-1.5 text-xs text-[#E6EFF4] focus:outline-none focus:border-[#A3C9D9]"
        >
          {DOMAINS.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d]}
            </option>
          ))}
        </select>
      </div>

      {/* 2. Tipo de Solução */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <label
            htmlFor="param-solution"
            className="text-xs font-medium text-[#A3C9D9]"
          >
            2. Tipo de Solução
          </label>
          <InfoTooltip text={PARAM_TOOLTIPS.solucao} />
        </div>
        <select
          id="param-solution"
          value={draft.tipoSolucao}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              tipoSolucao: e.target.value as SolutionType,
            }))
          }
          className="w-full rounded-lg bg-[#081017] border border-[#7FA6B8]/30 px-2.5 py-1.5 text-xs text-[#E6EFF4] focus:outline-none focus:border-[#A3C9D9]"
        >
          {SOLUTION_TYPES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* 3. Skills Obrigatórias */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#A3C9D9]">
              3. Skills Obrigatórias
            </span>
            <InfoTooltip text={PARAM_TOOLTIPS.skills} />
          </div>
          <span className="text-[11px] tabular-nums text-[#8EAAB8] shrink-0">
            {draft.skillsObrigatorias.length} ativas
          </span>
        </div>

        <div className="flex flex-col gap-1.5 max-h-[135px] overflow-y-auto pr-1">
          {draft.skillsObrigatorias.map((req) => (
            <div
              key={req.skill}
              className="flex items-center justify-between gap-2 rounded-lg border border-[#7FA6B8]/25 bg-[#081017] px-2.5 py-1"
            >
              <span className="text-xs text-[#E6EFF4] truncate">
                {SKILL_LABELS[req.skill]}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {([1, 2, 3, 4, 5] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => handleToggleSkillLevel(req.skill, lvl)}
                    className={`w-5 h-5 rounded text-[11px] tabular-nums transition-colors cursor-pointer ${
                      req.minLevel === lvl
                        ? 'bg-[#8EB8CA] text-[#081017] font-semibold'
                        : 'bg-[#0D1821] text-[#8EAAB8] hover:text-white border border-[#7FA6B8]/25'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleRemoveSkill(req.skill)}
                  aria-label={`Remover ${SKILL_LABELS[req.skill]}`}
                  className="ml-1 p-0.5 text-[#8EAAB8] hover:text-[#EF4444] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {availableSkillsToAdd.length > 0 && (
          <div className="flex items-center gap-1.5">
            <select
              aria-label="Adicionar skill obrigatória"
              value={skillToAdd}
              onChange={(e) => setSkillToAdd(e.target.value as SkillKey | '')}
              className="flex-1 rounded-lg bg-[#081017] border border-[#7FA6B8]/25 px-2.5 py-1 text-xs text-[#E6EFF4] focus:outline-none focus:border-[#A3C9D9]"
            >
              <option value="">Adicionar competência...</option>
              {availableSkillsToAdd.map((sk) => (
                <option key={sk} value={sk}>
                  {SKILL_LABELS[sk]}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddSkill}
              disabled={!skillToAdd}
              className="px-2.5 py-1 rounded-lg border border-[#7FA6B8]/35 bg-[#0D1821] text-xs text-[#A3C9D9] hover:bg-[#7FA6B8]/15 disabled:opacity-40 cursor-pointer flex items-center gap-1 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Incluir
            </button>
          </div>
        )}
      </div>

      {/* 4. Orçamento Máximo/Hora */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <label
              htmlFor="param-budget"
              className="text-xs font-medium text-[#A3C9D9]"
            >
              4. Orçamento Máximo/Hora
            </label>
            <InfoTooltip text={PARAM_TOOLTIPS.orcamento} />
          </div>
          <div className="flex items-center gap-1 font-grotesk shrink-0">
            <span className="text-xs text-[#8EAAB8]">R$</span>
            <input
              id="param-budget"
              type="number"
              min={500}
              max={2500}
              step={25}
              value={draft.orcamentoMaxHora}
              onChange={(e) =>
                setDraft((prev) => ({
                  ...prev,
                  orcamentoMaxHora: Math.max(400, Number(e.target.value) || 0),
                }))
              }
              className="w-20 rounded bg-[#081017] border border-[#7FA6B8]/30 px-2 py-0.5 text-right text-xs font-grotesk text-[#E6EFF4] focus:outline-none focus:border-[#A3C9D9]"
            />
            <span className="text-xs text-[#8EAAB8]">/h</span>
          </div>
        </div>
        <input
          type="range"
          min={500}
          max={1800}
          step={25}
          value={Math.min(1800, Math.max(500, draft.orcamentoMaxHora))}
          onChange={(e) =>
            setDraft((prev) => ({
              ...prev,
              orcamentoMaxHora: Number(e.target.value),
            }))
          }
          className="cin-range w-full"
        />
      </div>

      {/* 5. Tamanho do Squad */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-[#A3C9D9]">
              5. Tamanho do Squad
            </span>
            <InfoTooltip text={PARAM_TOOLTIPS.tamanho} />
          </div>
          <span className="text-xs tabular-nums text-[#E6EFF4] shrink-0">
            {draft.minSize} a {draft.maxSize} membros
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-lg border border-[#7FA6B8]/25 bg-[#081017] px-2 py-1">
            <span className="text-[11px] text-[#8EAAB8]">Mín.</span>
            <div className="flex items-center gap-0.5">
              {[4, 5, 6, 7, 8].map((n) => (
                <button
                  key={`min-${n}`}
                  type="button"
                  onClick={() => handleMinSizeChange(n)}
                  className={`w-5 h-5 rounded text-[11px] tabular-nums cursor-pointer ${
                    draft.minSize === n
                      ? 'bg-[#8EB8CA] text-[#081017] font-semibold'
                      : 'text-[#8EAAB8] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-[#7FA6B8]/25 bg-[#081017] px-2 py-1">
            <span className="text-[11px] text-[#8EAAB8]">Máx.</span>
            <div className="flex items-center gap-0.5">
              {[4, 5, 6, 7, 8].map((n) => (
                <button
                  key={`max-${n}`}
                  type="button"
                  onClick={() => handleMaxSizeChange(n)}
                  className={`w-5 h-5 rounded text-[11px] tabular-nums cursor-pointer ${
                    draft.maxSize === n
                      ? 'bg-[#8EB8CA] text-[#081017] font-semibold'
                      : 'text-[#8EAAB8] hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 6. Urgência de Prazo */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#A3C9D9]">
            6. Urgência de Prazo
          </span>
          <InfoTooltip text={PARAM_TOOLTIPS.urgencia} />
        </div>
        <div className="grid grid-cols-3 rounded-lg border border-[#7FA6B8]/25 bg-[#081017] p-0.5">
          {URGENCY_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() =>
                setDraft((prev) => ({ ...prev, urgencia: lvl }))
              }
              className={`py-1 text-[11px] rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                draft.urgencia === lvl
                  ? 'bg-[#8EB8CA]/25 text-[#E6EFF4] font-medium border border-[#8EB8CA]/40'
                  : 'text-[#8EAAB8] hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* 7. Criticidade Regulatória */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-[#A3C9D9]">
            7. Criticidade Regulatória
          </span>
          <InfoTooltip text={PARAM_TOOLTIPS.regulatoria} />
        </div>
        <div className="grid grid-cols-3 rounded-lg border border-[#7FA6B8]/25 bg-[#081017] p-0.5">
          {REGULATORY_LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() =>
                setDraft((prev) => ({
                  ...prev,
                  criticidadeRegulatoria: lvl,
                }))
              }
              className={`py-1 text-[11px] rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                draft.criticidadeRegulatoria === lvl
                  ? 'bg-[#8EB8CA]/25 text-[#E6EFF4] font-medium border border-[#8EB8CA]/40'
                  : 'text-[#8EAAB8] hover:text-white'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Action */}
      <button
        type="submit"
        className="mt-1 w-full rounded-lg bg-[#8EB8CA] hover:bg-[#A3C9D9] text-[#081017] font-semibold text-xs py-2 px-4 transition-colors cursor-pointer whitespace-nowrap shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
      >
        {mode === 'drawer'
          ? 'Confirmar e Recalcular'
          : 'Calcular Formação de Squads'}
      </button>
    </form>
  );
};
