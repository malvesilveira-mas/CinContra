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

export type Seniority = 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista';

export type SkillKey =
  | 'APIs_REST'
  | 'Arquitetura_Microsservicos'
  | 'Cloud_AWS_GCP'
  | 'Docker_K8s'
  | 'Integracao_IoT_SCADA'
  | 'Node.js'
  | 'Python'
  | 'React'
  | 'Engenharia_ETL'
  | 'Estatistica'
  | 'Machine_Learning_Preditivo'
  | 'PowerBI_Looker'
  | 'Python_DS'
  | 'SQL_Avancado'
  | 'Series_Temporais'
  | 'Spark'
  | 'Data_Visualization'
  | 'Design_System'
  | 'Discovery_Usuario'
  | 'Gestao_Stakeholders'
  | 'Metricas_Produto'
  | 'Prototipacao_Figma'
  | 'Roadmap_Agil'
  | 'UX_Research';

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
  custo_hora_brl?: number;
  arquetipo: RpgArchetype;
  dominios: DomainSector[];
  skills: Partial<Record<SkillKey, 1 | 2 | 3 | 4 | 5>>;
  hard_skills?: Partial<Record<SkillKey, number>>;
  taxaSucesso: number; // 0-100
  taxa_sucesso_pct?: number;
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

export interface UiMetricsMap {
  'Competência Técnica': number;
  'Domínio do Setor': number;
  'Química da Equipe': number;
  'Equilíbrio de Perfis': number;
  'Eficiência de Custo & Entrega': number;
}

export interface SocialEdge {
  fromId: string;
  toId: string;
  type: 'afinidade' | 'atrito';
  bilateral?: boolean;
  cushionedByFacilitator: boolean;
  points?: number;
  label?: string;
}

export interface ConstraintViolation {
  rule_id?: string;
  rule_name?: string;
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
  rank?: number;
  member_ids?: string[];
  members: Professional[];
  membersWithRationale: MemberWithRationale[];
  scoreFinal: number;
  score_final?: number;
  custoHoraTotal: number;
  custo_total?: number;
  taxaSucessoMedia: number;
  weights: DynamicWeights;
  subIndices: SubIndices;
  ui_metrics?: UiMetricsMap;
  edges: SocialEdge[];
  hasFacilitator: boolean;
  violations: ConstraintViolation[];
  isValid: boolean;
  is_valid?: boolean;
  is_fallback?: boolean;
}

export interface SearchTelemetry {
  totalCombinationsSpace: number;
  combinationsEvaluated: number;
  branchesPruned: number;
  validFound: number;
  executionTimeMs?: number;
}
