import {
  DomainSector,
  Professional,
  SkillKey,
  SquadParams,
} from '../types/cincontra';

export const DOMAIN_LABELS: Record<DomainSector, string> = {
  Energia_Utilities: 'Energia & Utilities',
  Financeiro: 'Financeiro',
  Industria_4_0: 'Indústria 4.0',
  Logistica: 'Logística',
  Varejo: 'Varejo',
  Saude: 'Saúde',
};

export const SKILL_LABELS: Record<SkillKey, string> = {
  Series_Temporais: 'Séries Temporais',
  Machine_Learning_Preditivo: 'ML Preditivo',
  Integracao_IoT_SCADA: 'Integração IoT / SCADA',
  Python: 'Python',
  Cloud_AWS_GCP: 'Cloud AWS / GCP',
  Estatistica: 'Estatística',
  Python_DS: 'Python para Data Science',
  Engenharia_ETL: 'Engenharia ETL',
  SQL_Avancado: 'SQL Avançado',
  Spark: 'Spark',
  PowerBI_Looker: 'PowerBI & Looker',
  APIs_REST: 'APIs REST',
  Arquitetura_Microsservicos: 'Arquitetura de Microsserviços',
  Docker_K8s: 'Docker & Kubernetes',
  'Node.js': 'Node.js',
  React: 'React',
  Data_Visualization: 'Data Visualization',
  Design_System: 'Design System',
  Discovery_Usuario: 'Discovery de Usuário',
  Gestao_Stakeholders: 'Gestão de Stakeholders',
  Metricas_Produto: 'Métricas de Produto',
  Prototipacao_Figma: 'Prototipação Figma',
  Roadmap_Agil: 'Roadmap Ágil',
  UX_Research: 'UX Research',
};

export const ALL_SKILLS: SkillKey[] = Object.keys(SKILL_LABELS) as SkillKey[];

export const DEFAULT_PARAMS: SquadParams = {
  dominioSetorial: 'Energia_Utilities',
  tipoSolucao: 'Software Preditivo/IA',
  skillsObrigatorias: [
    { skill: 'Series_Temporais', minLevel: 4 },
    { skill: 'Machine_Learning_Preditivo', minLevel: 4 },
    { skill: 'Integracao_IoT_SCADA', minLevel: 4 },
    { skill: 'Python', minLevel: 4 },
  ],
  orcamentoMaxHora: 1000,
  minSize: 5,
  maxSize: 7,
  urgencia: 'Normal',
  criticidadeRegulatoria: 'Alta',
};

/**
 * Helper para exibir a identidade de um profissional nos nós do grafo e no Banco de Talentos
 * usando os campos reais de `squad_rpg_60.csv` sem depender de nomes mockados antigos.
 */
export function getProfessionalShortLabel(member: Professional): string {
  const rawName = (member.nome || '').trim();
  if (!rawName || /^profissional\s*\d*$/i.test(rawName) || rawName.startsWith('Profissional ')) {
    return member.senioridade;
  }
  return rawName.split(' ')[0];
}

export function getProfessionalFullTitle(member: Professional): string {
  const rawName = (member.nome || '').trim();
  if (!rawName || /^profissional\s*\d*$/i.test(rawName) || rawName.startsWith('Profissional ')) {
    return `${member.cargo} · ${member.senioridade}`;
  }
  return rawName;
}

/**
 * Lista vazia inicial: todos os 60 profissionais são carregados automaticamente
 * da API `GET /api/v1/professionals` (populada via `squad_rpg_60.csv`).
 */
export const PROFESSIONALS: Professional[] = [];
