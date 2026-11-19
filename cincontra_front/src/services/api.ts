import {
  Professional,
  SearchTelemetry,
  SkillKey,
  SquadEvaluation,
  SquadParams,
} from '../types/cincontra';

const viteEnv = (import.meta as unknown as { env?: Record<string, string> }).env;
const ENV_API_BASE = (
  viteEnv?.VITE_API_URL ||
  viteEnv?.VITE_API_BASE_URL ||
  ''
).replace(/\/+$/, '');

async function apiFetch(
  path: string,
  options?: RequestInit
): Promise<Response> {
  const url = `${ENV_API_BASE}${path}`;
  return fetch(url, options);
}

export function normalizeApiProfessional(raw: Record<string, unknown>): Professional {
  const rawSkills = (raw.skills ?? raw.hard_skills ?? {}) as Record<
    string,
    1 | 2 | 3 | 4 | 5
  >;
  return {
    id: String(raw.id ?? ''),
    nome: String(raw.nome ?? ''),
    cargo: String(raw.cargo ?? ''),
    trilha: raw.trilha as Professional['trilha'],
    senioridade: raw.senioridade as Professional['senioridade'],
    custoHora: Number(raw.custoHora ?? raw.custo_hora_brl ?? 0),
    custo_hora_brl: Number(raw.custo_hora_brl ?? raw.custoHora ?? 0),
    arquetipo: raw.arquetipo as Professional['arquetipo'],
    dominios: (raw.dominios as Professional['dominios']) ?? [],
    skills: rawSkills as Partial<Record<SkillKey, 1 | 2 | 3 | 4 | 5>>,
    hard_skills: rawSkills,
    taxaSucesso: Number(raw.taxaSucesso ?? raw.taxa_sucesso_pct ?? 0),
    taxa_sucesso_pct: Number(raw.taxa_sucesso_pct ?? raw.taxaSucesso ?? 0),
    afinidades_ids: (raw.afinidades_ids as string[]) ?? [],
    atritos_ids: (raw.atritos_ids as string[]) ?? [],
  };
}

export function normalizeApiSquadEvaluation(
  raw: Record<string, unknown>
): SquadEvaluation {
  const rawMembers = ((raw.members ?? raw.membros) || []) as Record<
    string,
    unknown
  >[];
  const members = rawMembers.map(normalizeApiProfessional);

  const rawRationale = (raw.membersWithRationale || []) as Array<{
    professional: Record<string, unknown>;
    justificativa: string;
  }>;

  const membersWithRationale =
    rawRationale.length > 0
      ? rawRationale.map((item) => ({
          professional: normalizeApiProfessional(item.professional),
          justificativa: item.justificativa,
        }))
      : members.map((m) => ({
          professional: m,
          justificativa: `${m.cargo} (${m.senioridade}) · ${m.arquetipo}`,
        }));

  const uiMetrics = raw.ui_metrics as SquadEvaluation['ui_metrics'];
  const subIndicesRaw = (raw.subIndices ?? {}) as Record<string, number>;
  const subIndicesSnake = (raw.sub_indices ?? {}) as Record<
    string,
    { bruto: number; ponderado: number }
  >;

  const subIndices = {
    sTecnico: Number(
      uiMetrics?.['Competência Técnica'] ??
        subIndicesRaw.sTecnico ??
        subIndicesSnake.S_Tecnico?.bruto ??
        0
    ),
    sDominio: Number(
      uiMetrics?.['Domínio do Setor'] ??
        subIndicesRaw.sDominio ??
        subIndicesSnake.S_Dominio?.bruto ??
        0
    ),
    sQuimica: Number(
      uiMetrics?.['Química da Equipe'] ??
        subIndicesRaw.sQuimica ??
        subIndicesSnake.S_Quimica?.bruto ??
        0
    ),
    sRpg: Number(
      uiMetrics?.['Equilíbrio de Perfis'] ??
        subIndicesRaw.sRpg ??
        subIndicesSnake.S_RPG?.bruto ??
        0
    ),
    sConfiabCusto: Number(
      uiMetrics?.['Eficiência de Custo & Entrega'] ??
        subIndicesRaw.sConfiabCusto ??
        subIndicesSnake.S_Confiabilidade_Custo?.bruto ??
        subIndicesSnake.S_Confiab_Custo?.bruto ??
        0
    ),
  };

  return {
    id: String(raw.id ?? `squad-${members.map((m) => m.id).join('-')}`),
    rank: raw.rank ? Number(raw.rank) : undefined,
    member_ids: (raw.member_ids as string[]) ?? members.map((m) => m.id),
    members,
    membersWithRationale,
    scoreFinal: Number(raw.scoreFinal ?? raw.score_final ?? 0),
    score_final: Number(raw.score_final ?? raw.scoreFinal ?? 0),
    custoHoraTotal: Number(raw.custoHoraTotal ?? raw.custo_total ?? 0),
    custo_total: Number(raw.custo_total ?? raw.custoHoraTotal ?? 0),
    taxaSucessoMedia: Number(raw.taxaSucessoMedia ?? raw.taxa_sucesso_pct ?? 0),
    weights: (raw.weights as SquadEvaluation['weights']) ?? {
      w1: 0.3,
      w2: 0.2,
      w3: 0.12,
      w4: 0.22,
      w5: 0.16,
      formulaNotes: {
        baseSource: 'Software Preditivo/IA',
        urgencyModifier: 'Normal',
        regulatoryModifier: 'Alta',
      },
    },
    subIndices,
    ui_metrics: uiMetrics,
    edges: (raw.edges as SquadEvaluation['edges']) ?? [],
    hasFacilitator: Boolean(raw.hasFacilitator ?? raw.has_facilitator),
    violations: (raw.violations as SquadEvaluation['violations']) ?? [],
    isValid: Boolean(raw.isValid ?? raw.is_valid),
    is_valid: Boolean(raw.is_valid ?? raw.isValid),
    is_fallback: Boolean(raw.is_fallback),
  };
}

export async function fetchProfessionalsFromApi(): Promise<Professional[]> {
  const res = await apiFetch('/api/v1/professionals');
  if (!res.ok) {
    throw new Error(`Erro ao carregar profissionais: HTTP ${res.status}`);
  }
  const data = await res.json();
  const list = (data.professionals || []) as Record<string, unknown>[];
  return list.map(normalizeApiProfessional);
}

export async function recommendSquadsFromApi(params: SquadParams): Promise<{
  topSquads: SquadEvaluation[];
  telemetry: SearchTelemetry;
  isFeasible: boolean;
  fallbackWarning?: string | null;
}> {
  const payload = {
    dominio_setorial: params.dominioSetorial,
    tipo_solucao: params.tipoSolucao,
    skills_obrigatorias: params.skillsObrigatorias,
    orcamento_max_hora: params.orcamentoMaxHora,
    tamanho_min: params.minSize,
    tamanho_max: params.maxSize,
    urgencia_prazo: params.urgencia,
    criticidade_regulatoria: params.criticidadeRegulatoria,
    top_k: 5,
    min_diff_members: 2,
  };

  const res = await apiFetch('/api/v1/squads/recommend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Erro na recomendação de squads: HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawSquads = ((data.top_squads ?? data.topSquads) || []) as Record<
    string,
    unknown
  >[];
  const topSquads = rawSquads.map(normalizeApiSquadEvaluation);

  const telemetry: SearchTelemetry = {
    totalCombinationsSpace: Number(
      data.telemetry?.totalCombinationsSpace ??
        data.valid_combinations_evaluated ??
        0
    ),
    combinationsEvaluated: Number(
      data.telemetry?.combinationsEvaluated ??
        data.valid_combinations_evaluated ??
        0
    ),
    branchesPruned: Number(data.telemetry?.branchesPruned ?? 0),
    validFound: Number(data.telemetry?.validFound ?? topSquads.length),
    executionTimeMs: Number(
      data.execution_time_ms ?? data.telemetry?.executionTimeMs ?? 0
    ),
  };

  return {
    topSquads,
    telemetry,
    isFeasible: Boolean(data.is_feasible ?? data.isFeasible ?? true),
    fallbackWarning: data.fallback_warning ?? null,
  };
}

export async function simulateSquadFromApi(
  memberIds: string[],
  baselineIds: string[],
  params: SquadParams
): Promise<SquadEvaluation> {
  const payload = {
    squad_proposto_ids: memberIds,
    squad_referencia_ids: baselineIds,
    params: {
      dominio_setorial: params.dominioSetorial,
      tipo_solucao: params.tipoSolucao,
      skills_obrigatorias: params.skillsObrigatorias,
      orcamento_max_hora: params.orcamentoMaxHora,
      tamanho_min: params.minSize,
      tamanho_max: params.maxSize,
      urgencia_prazo: params.urgencia,
      criticidade_regulatoria: params.criticidadeRegulatoria,
    },
  };

  const res = await apiFetch('/api/v1/squads/simulate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Erro na simulação What-If: HTTP ${res.status}`);
  }

  const data = await res.json();
  const rawEval = (data.proposto ?? data.evaluation ?? data) as Record<
    string,
    unknown
  >;
  return normalizeApiSquadEvaluation(rawEval);
}
