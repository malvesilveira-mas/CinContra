export type AppState =
  | 'INITIAL'
  | 'PARAMS'
  | 'MOVEMENT_1_DOWN'
  | 'MOVEMENT_2_CENTER'
  | 'MOVEMENT_3_EXPAND'
  | 'DASHBOARD';

export type DomainSector =
  | 'Energia_Utilities'
  | 'Financeiro'
  | 'Industria_4_0'
  | 'Logistica'
  | 'Varejo'
  | 'Saude';

export type SolutionType =
  | 'Software Preditivo/IA'
  | 'Produto Digital/App'
  | 'Plataforma de Dados/BI'
  | 'Sistema Crítico/IoT';

export type UrgencyLevel = 'Baixa' | 'Normal' | 'Crítica';

export type RegulatoryLevel = 'Baixa' | 'Média' | 'Alta';

export type RpgArchetype =
  | 'Cético Analítico'
  | 'Arquiteto Metódico'
  | 'Executor Pragmático'
  | 'Facilitador'
  | 'Bombeiro';

export type Track = 'Engenharia' | 'Dados' | 'Produto & Design';

export type Seniority = 'Pleno' | 'Sênior' | 'Especialista';

export type SkillKey =
  | 'Series_Temporais'
  | 'Machine_Learning_Preditivo'
  | 'Integracao_IoT_SCADA'
  | 'Python'
  | 'Arquitetura_Cloud'
  | 'Engenharia_Dados'
  | 'UX_UI_Design'
  | 'DevOps_SRE'
  | 'Seguranca_Cibernetica'
  | 'Visao_Computacional'
  | 'API_Backend'
  | 'Produto_Agil';

export interface RequiredSkill {
  skill: SkillKey;
  minLevel: 1 | 2 | 3 | 4 | 5;
}

export interface SquadParams {
  dominioSetorial: DomainSector;
  tipoSolucao: SolutionType;
  skillsObrigatorias: RequiredSkill[];
  orcamentoMaxHora: number;
  minSize: number;
  maxSize: number;
  urgencia: UrgencyLevel;
  criticidadeRegulatoria: RegulatoryLevel;
}

export interface Professional {
  id: string;
  nome: string;
  cargo: string;
  trilha: Track;
  senioridade: Seniority;
  custoHora: number;
  arquetipo: RpgArchetype;
  dominios: DomainSector[];
  skills: Partial<Record<SkillKey, 1 | 2 | 3 | 4 | 5>>;
  taxaSucesso: number; // 0-100
  afinidades_ids: string[];
  atritos_ids: string[];
}

export interface DynamicWeights {
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
  formulaNotes: {
    baseSource: SolutionType;
    urgencyModifier: string;
    regulatoryModifier: string;
  };
}

export interface SubIndices {
  sTecnico: number;
  sDominio: number;
  sQuimica: number;
  sRpg: number;
  sConfiabCusto: number;
}

export interface SocialEdge {
  fromId: string;
  toId: string;
  type: 'afinidade' | 'atrito';
  cushionedByFacilitator: boolean;
}

export interface ConstraintViolation {
  code:
    | 'BUDGET_EXCEEDED'
    | 'MISSING_SKILL'
    | 'SQUAD_SIZE'
    | 'LEADER_EXECUTOR_RATIO'
    | 'UNMITIGATED_FRICTION';
  message: string;
}

export interface MemberWithRationale {
  professional: Professional;
  justificativa: string;
}

export interface SquadEvaluation {
  id: string;
  members: Professional[];
  membersWithRationale: MemberWithRationale[];
  scoreFinal: number;
  custoHoraTotal: number;
  taxaSucessoMedia: number;
  weights: DynamicWeights;
  subIndices: SubIndices;
  edges: SocialEdge[];
  hasFacilitator: boolean;
  violations: ConstraintViolation[];
  isValid: boolean;
}

export interface SearchTelemetry {
  totalCombinationsSpace: number;
  combinationsEvaluated: number;
  branchesPruned: number;
  validFound: number;
}
