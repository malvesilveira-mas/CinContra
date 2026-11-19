import React, { useMemo, useState } from 'react';
import { Minus, Plus, Users, X } from 'lucide-react';
import {
  DOMAIN_LABELS,
  getProfessionalFullTitle,
  SKILL_LABELS,
} from '../data/professionals';
import {
  generateMemberJustification,
  isEligibleForProject,
} from '../engine/scoringEngine';
import { Professional, SquadParams, Track } from '../types/cincontra';

interface TalentBankWindowProps {
  params: SquadParams;
  allProfessionals: Professional[];
  activeMembers: Professional[];
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onMinimize: () => void;
}

type TrackFilter = 'Todos' | Track;

const TRACK_FILTERS: TrackFilter[] = [
  'Todos',
  'Engenharia',
  'Dados',
  'Produto & Design',
];

export const TalentBankWindow: React.FC<TalentBankWindowProps> = ({
  params,
  allProfessionals,
  activeMembers,
  expandedIds,
  onToggleExpand,
  onMinimize,
}) => {
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('Todos');

  const activeIds = useMemo(
    () => new Set(activeMembers.map((m) => m.id)),
    [activeMembers]
  );

  const eligibleTalentBank = useMemo(() => {
    return allProfessionals
      .filter((p) => !activeIds.has(p.id))
      .filter(
        (p) => trackFilter === 'Todos' || p.trilha === trackFilter
      )
      .map((p) => ({
        professional: p,
        eligibility: isEligibleForProject(p, params),
      }))
      .sort((a, b) => {
        if (b.eligibility.eligible !== a.eligibility.eligible) {
          return b.eligibility.eligible ? 1 : -1;
        }
        if (b.eligibility.matchedReqSkills !== a.eligibility.matchedReqSkills) {
          return b.eligibility.matchedReqSkills - a.eligibility.matchedReqSkills;
        }
        return (
          parseInt(a.professional.id.replace(/\D/g, ''), 10) -
          parseInt(b.professional.id.replace(/\D/g, ''), 10)
        );
      });
  }, [allProfessionals, activeIds, params, trackFilter]);

  return (
    <aside className="w-[280px] xl:w-[22vw] max-w-[325px] h-[calc(64vh-58px)] cin-panel rounded-2xl shadow-2xl flex flex-col overflow-hidden">
      {/* Header with Minimize button */}
      <div className="shrink-0 border-b border-[#7FA6B8]/25 bg-[#0A151E] px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Users className="w-3.5 h-3.5 text-[#8EB8CA] shrink-0" />
          <h2 className="text-xs font-semibold text-[#E6EFF4] truncate">
            Banco de Talentos ({eligibleTalentBank.length})
          </h2>
        </div>

        <button
          type="button"
          onClick={onMinimize}
          title="Minimizar Banco de Talentos"
          aria-label="Minimizar Banco de Talentos"
          className="p-1 rounded border border-[#7FA6B8]/30 text-[#A3C9D9] hover:text-white hover:border-[#A3C9D9] transition-colors cursor-pointer shrink-0"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Instructions + Track Filters */}
      <div className="shrink-0 px-3.5 pt-2.5 pb-2 border-b border-[#7FA6B8]/15 flex flex-col gap-2">
        <p className="text-[11px] text-[#8EAAB8] leading-snug">
          Arraste para um balão ou área livre do grafo central
        </p>
        <div className="flex flex-wrap gap-1">
          {TRACK_FILTERS.map((tr) => (
            <button
              key={tr}
              type="button"
              onClick={() => setTrackFilter(tr)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors cursor-pointer ${
                trackFilter === tr
                  ? 'bg-[#8EB8CA] text-[#081017]'
                  : 'bg-[#081017] text-[#8EAAB8] border border-[#7FA6B8]/25 hover:text-white'
              }`}
            >
              {tr}
            </button>
          ))}
        </div>
      </div>

      {/* Independent Internal Vertical Scroll */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
        {eligibleTalentBank.length === 0 ? (
          <div className="rounded-lg border border-[#7FA6B8]/20 bg-[#081017]/60 p-3.5 text-center text-[11px] text-[#8EAAB8]">
            Nenhum profissional disponível fora do squad nesta trilha.
          </div>
        ) : (
          eligibleTalentBank.map(({ professional: talent }) => {
            const isExpanded = expandedIds.has(talent.id);
            const topSkills = Object.entries(talent.skills || {})
              .sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
              .map(
                ([sk, lvl]) =>
                  `${SKILL_LABELS[sk as keyof typeof SKILL_LABELS] || sk} (${lvl}/5)`
              );
            const rationale = generateMemberJustification(
              talent,
              [...activeMembers, talent],
              params
            );
            const fullTitle = getProfessionalFullTitle(talent);

            return (
              <div
                key={talent.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(
                    'application/x-cincontra-bank',
                    talent.id
                  );
                  e.dataTransfer.setData('text/plain', talent.id);
                  e.dataTransfer.effectAllowed = 'copyMove';
                }}
                className="rounded-xl border border-[#8EB8CA]/35 bg-[#0D1821] hover:border-[#A3C9D9] p-2.5 flex flex-col gap-1 cursor-grab active:cursor-grabbing transition-colors"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-[#A3C9D9] shrink-0">
                      {talent.id}
                    </span>
                    <span className="text-xs font-semibold text-[#E6EFF4] truncate">
                      {fullTitle}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpand(talent.id);
                    }}
                    aria-label={`Detalhes de ${talent.id}`}
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

                <div className="text-[11px] text-[#8EAAB8] truncate">
                  {talent.trilha} · Sucesso {talent.taxaSucesso}%
                </div>

                <div className="flex items-center justify-between gap-1 mt-0.5">
                  <span className="text-[10px] text-[#A3C9D9] truncate">
                    {talent.arquetipo}
                  </span>
                  <span className="font-grotesk text-xs font-semibold text-[#E6EFF4] shrink-0">
                    R$ {talent.custoHora}/h
                  </span>
                </div>

                {isExpanded && (
                  <div className="mt-2 pt-2 border-t border-[#7FA6B8]/20 flex flex-col gap-1 text-[11px]">
                    <div>
                      <span className="text-[#8EAAB8]">Domínios: </span>
                      <span className="text-[#E6EFF4]">
                        {talent.dominios
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
                    <p className="text-[#CFE0E8] leading-relaxed pt-1">
                      {rationale}
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
