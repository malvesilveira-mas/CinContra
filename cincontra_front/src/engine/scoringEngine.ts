import { DOMAIN_LABELS, SKILL_LABELS } from '../data/professionals';
import {
  ConstraintViolation,
  DynamicWeights,
  MemberWithRationale,
  Professional,
  RpgArchetype,
  SearchTelemetry,
  SocialEdge,
  SquadEvaluation,
  SquadParams,
  SubIndices,
} from '../types/cincontra';

const round2 = (n: number): number => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

const RPG_SYNERGY_MATRIX: Record<RpgArchetype, Record<RpgArchetype, number>> = {
  'Arquiteto Metódico': {
    'Arquiteto Metódico': 0.55,
    'Cético Analítico': 0.92,
    'Executor Pragmático': 0.95,
    Facilitador: 0.9,
    Bombeiro: 0.72,
  },
  'Cético Analítico': {
    'Arquiteto Metódico': 0.92,
    'Cético Analítico': 0.65,
    'Executor Pragmático': 0.85,
    Facilitador: 0.88,
    Bombeiro: 0.78,
  },
  'Executor Pragmático': {
    'Arquiteto Metódico': 0.95,
    'Cético Analítico': 0.85,
    'Executor Pragmático': 0.78,
    Facilitador: 0.92,
    Bombeiro: 0.86,
  },
  Facilitador: {
    'Arquiteto Metódico': 0.9,
    'Cético Analítico': 0.88,
    'Executor Pragmático': 0.92,
    Facilitador: 0.62,
    Bombeiro: 0.94,
  },
  Bombeiro: {
    'Arquiteto Metódico': 0.72,
    'Cético Analítico': 0.78,
    'Executor Pragmático': 0.86,
    Facilitador: 0.94,
    Bombeiro: 0.58,
  },
};

export function computeDynamicWeights(params: SquadParams): DynamicWeights {
  let b1 = 0.3; // S_Tecnico
  let b2 = 0.2; // S_Dominio
  let b3 = 0.16; // S_Quimica
  let b4 = 0.16; // S_RPG
  let b5 = 0.18; // S_Confiab_Custo

  switch (params.tipoSolucao) {
    case 'Software Preditivo/IA':
      b1 = 0.34;
      b2 = 0.2;
      b3 = 0.16;
      b4 = 0.15;
      b5 = 0.15;
      break;
    case 'Produto Digital/App':
      b1 = 0.25;
      b2 = 0.17;
      b3 = 0.22;
      b4 = 0.2;
      b5 = 0.16;
      break;
    case 'Plataforma de Dados/BI':
      b1 = 0.31;
      b2 = 0.22;
      b3 = 0.15;
      b4 = 0.14;
      b5 = 0.18;
      break;
    case 'Sistema Crítico/IoT':
      b1 = 0.3;
      b2 = 0.22;
      b3 = 0.14;
      b4 = 0.13;
      b5 = 0.21;
      break;
  }

  let urgencyModifier = 'Neutro (+0%)';
  if (params.urgencia === 'Baixa') {
    b4 += 0.03;
    b1 += 0.01;
    urgencyModifier = 'Baixa (+W4 RPG / +W1 Técnico)';
  } else if (params.urgencia === 'Crítica') {
    b3 += 0.05;
    b5 += 0.05;
    urgencyModifier = 'Crítica (+W3 Química / +W5 Confiab.)';
  }

  let regulatoryModifier = 'Padrão (+0%)';
  if (params.criticidadeRegulatoria === 'Alta') {
    b2 += 0.05;
    b4 += 0.03;
    b5 += 0.02;
    regulatoryModifier = 'Alta (+W2 Domínio / +W4 RPG / +W5 Confiab.)';
  } else if (params.criticidadeRegulatoria === 'Média') {
    b2 += 0.02;
    regulatoryModifier = 'Média (+W2 Domínio)';
  }

  const sum = b1 + b2 + b3 + b4 + b5;
  const w2 = round2(b2 / sum);
  const w3 = round2(b3 / sum);
  const w4 = round2(b4 / sum);
  const w5 = round2(b5 / sum);
  const w1 = round2(1 - (w2 + w3 + w4 + w5));

  return {
    w1,
    w2,
    w3,
    w4,
    w5,
    formulaNotes: {
      baseSource: params.tipoSolucao,
      urgencyModifier,
      regulatoryModifier,
    },
  };
}

export function extractSocialEdges(members: Professional[]): {
  edges: SocialEdge[];
  hasFacilitator: boolean;
} {
  const memberIds = new Set(members.map((m) => m.id));
  const hasFacilitator = members.some((m) => m.arquetipo === 'Facilitador');
  const seenPairs = new Set<string>();
  const edges: SocialEdge[] = [];

  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const a = members[i];
      const b = members[j];
      const pairKey = [a.id, b.id].sort().join('--');
      if (seenPairs.has(pairKey)) continue;

      const hasAtrito =
        (a.atritos_ids.includes(b.id) || b.atritos_ids.includes(a.id)) &&
        memberIds.has(a.id) &&
        memberIds.has(b.id);

      const hasAfinidade =
        (a.afinidades_ids.includes(b.id) || b.afinidades_ids.includes(a.id)) &&
        memberIds.has(a.id) &&
        memberIds.has(b.id);

      if (hasAtrito) {
        seenPairs.add(pairKey);
        edges.push({
          fromId: a.id,
          toId: b.id,
          type: 'atrito',
          cushionedByFacilitator: hasFacilitator,
        });
      } else if (hasAfinidade) {
        seenPairs.add(pairKey);
        edges.push({
          fromId: a.id,
          toId: b.id,
          type: 'afinidade',
          cushionedByFacilitator: false,
        });
      }
    }
  }

  return { edges, hasFacilitator };
}

export function checkHardConstraints(
  members: Professional[],
  params: SquadParams,
  custoHoraTotal: number,
  edges: SocialEdge[],
  hasFacilitator: boolean
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  if (members.length < params.minSize || members.length > params.maxSize) {
    violations.push({
      code: 'SQUAD_SIZE',
      message: `Tamanho do squad (${members.length}) fora do intervalo permitido (${params.minSize} a ${params.maxSize} membros).`,
    });
  }

  if (custoHoraTotal > params.orcamentoMaxHora) {
    const excesso = custoHoraTotal - params.orcamentoMaxHora;
    violations.push({
      code: 'BUDGET_EXCEEDED',
      message: `Orçamento excedido em R$ ${excesso}/h (R$ ${custoHoraTotal}/h acima do limite de R$ ${params.orcamentoMaxHora}/h).`,
    });
  }

  for (const req of params.skillsObrigatorias) {
    const maxFound = Math.max(
      0,
      ...members.map((m) => m.skills[req.skill] ?? 0)
    );
    if (maxFound < req.minLevel) {
      violations.push({
        code: 'MISSING_SKILL',
        message: `Skill obrigatória ${SKILL_LABELS[req.skill]} exige nível ${req.minLevel}, mas o máximo no squad é ${maxFound}.`,
      });
    }
  }

  const leadersCount = members.filter(
    (m) => m.arquetipo === 'Arquiteto Metódico' || m.arquetipo === 'Facilitador'
  ).length;
  const executorsCount = members.filter(
    (m) =>
      m.arquetipo === 'Executor Pragmático' ||
      m.arquetipo === 'Bombeiro' ||
      m.arquetipo === 'Cético Analítico'
  ).length;

  if (leadersCount < 1 || executorsCount < Math.max(2, Math.floor(members.length * 0.4))) {
    violations.push({
      code: 'LEADER_EXECUTOR_RATIO',
      message: `Proporção líder:executor inválida (${leadersCount} liderança/facilitação para ${executorsCount} execução técnica).`,
    });
  }

  const unmitigatedFrictions = edges.filter(
    (e) => e.type === 'atrito' && !hasFacilitator
  );
  if (unmitigatedFrictions.length > 0) {
    const pairs = unmitigatedFrictions
      .map((e) => `${e.fromId} ↔ ${e.toId}`)
      .join(', ');
    violations.push({
      code: 'UNMITIGATED_FRICTION',
      message: `Atrito relacional (${pairs}) sem Facilitador no squad para amortecimento.`,
    });
  }

  return violations;
}

function computeSubIndices(
  members: Professional[],
  params: SquadParams,
  custoHoraTotal: number,
  taxaSucessoMedia: number,
  edges: SocialEdge[],
  hasFacilitator: boolean
): SubIndices {
  const n = Math.max(1, members.length);

  // 1. S_Tecnico (0-100): peak coverage + excess proficiency + redundancy
  let sTecnico = 85;
  if (params.skillsObrigatorias.length > 0) {
    let totalSkillScore = 0;
    for (const req of params.skillsObrigatorias) {
      const levels = members
        .map((m) => m.skills[req.skill] ?? 0)
        .sort((a, b) => b - a);
      const best = levels[0] ?? 0;
      const second = levels[1] ?? 0;

      const coverageRatio = clamp(best / req.minLevel, 0, 1);
      const surplusBonus = best > req.minLevel ? ((best - req.minLevel) / 2) * 8 : 0;
      const redundancyScore =
        second >= Math.max(2, req.minLevel - 1)
          ? 18
          : (second / Math.max(1, req.minLevel)) * 12;

      const itemScore = clamp(coverageRatio * 74 + surplusBonus + redundancyScore, 0, 100);
      totalSkillScore += itemScore;
    }
    sTecnico = totalSkillScore / params.skillsObrigatorias.length;
  }

  // 2. S_Dominio (0-100): sector experience + regulatory & solution fit
  const domainMatches = members.filter((m) =>
    m.dominios.includes(params.dominioSetorial)
  ).length;
  const domainRatio = domainMatches / n;
  const regulatoryReady = members.filter(
    (m) =>
      m.senioridade === 'Especialista' ||
      m.senioridade === 'Sênior' ||
      (m.skills.Arquitetura_Microsservicos ?? 0) >= 3
  ).length;
  const regulatoryFactor =
    params.criticidadeRegulatoria === 'Alta'
      ? (regulatoryReady / n) * 28
      : params.criticidadeRegulatoria === 'Média'
        ? (regulatoryReady / n) * 22
        : 20;
  const sDominio = clamp(domainRatio * 74 + regulatoryFactor + 4, 0, 100);

  // 3. S_Quimica (0-100): base 74 + green affinity edges - red friction edges
  const affinityCount = edges.filter((e) => e.type === 'afinidade').length;
  const frictionEdges = edges.filter((e) => e.type === 'atrito');
  let frictionPenalty = 0;
  for (const edge of frictionEdges) {
    frictionPenalty += edge.cushionedByFacilitator ? 6 : 22;
  }
  const sQuimica = clamp(74 + affinityCount * 5.2 - frictionPenalty, 0, 100);

  // 4. S_RPG (0-100): pairwise archetype synergy + diversity of archetypes
  let synergySum = 0;
  let pairCount = 0;
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      synergySum +=
        RPG_SYNERGY_MATRIX[members[i].arquetipo][members[j].arquetipo];
      pairCount++;
    }
  }
  const avgPairSynergy = pairCount > 0 ? synergySum / pairCount : 0.8;
  const distinctArchetypes = new Set(members.map((m) => m.arquetipo)).size;
  const diversityScore = clamp(distinctArchetypes / Math.min(4, n), 0, 1) * 18;
  const facilitatorBonus = hasFacilitator ? 5 : 0;
  const sRpg = clamp(avgPairSynergy * 77 + diversityScore + facilitatorBonus, 0, 100);

  // 5. S_Confiab_Custo (0-100): historical success rate + budget efficiency
  const reliabilityPart = clamp((taxaSucessoMedia - 70) / 26, 0, 1) * 65;
  let budgetPart = 0;
  if (custoHoraTotal <= params.orcamentoMaxHora) {
    const utilization = custoHoraTotal / Math.max(1, params.orcamentoMaxHora);
    // Sweet spot: 80%-98% budget utilization gives maximum efficiency without overspending
    budgetPart = utilization >= 0.75 ? 32 : 24 + utilization * 10;
  } else {
    const overrunRatio =
      (custoHoraTotal - params.orcamentoMaxHora) /
      Math.max(1, params.orcamentoMaxHora);
    budgetPart = Math.max(0, 20 - overrunRatio * 80);
  }
  const sConfiabCusto = clamp(reliabilityPart + budgetPart, 0, 100);

  return {
    sTecnico: round2(sTecnico),
    sDominio: round2(sDominio),
    sQuimica: round2(sQuimica),
    sRpg: round2(sRpg),
    sConfiabCusto: round2(sConfiabCusto),
  };
}

export function generateMemberJustification(
  member: Professional,
  squad: Professional[],
  params: SquadParams
): string {
  const topReqSkills = params.skillsObrigatorias
    .map((req) => ({
      label: SKILL_LABELS[req.skill],
      level: member.skills[req.skill] ?? 0,
      minLevel: req.minLevel,
    }))
    .filter((s) => s.level >= s.minLevel)
    .sort((a, b) => b.level - a.level);

  const skillText =
    topReqSkills.length > 0
      ? `Atende ${topReqSkills
          .slice(0, 2)
          .map((s) => `${s.label} (${s.level}/5)`)
          .join(' e ')}`
      : `Contribuição complementar na trilha ${member.trilha}`;

  const domainText = member.dominios.includes(params.dominioSetorial)
    ? `domínio direto em ${DOMAIN_LABELS[params.dominioSetorial]}`
    : `experiência transversal fora de ${DOMAIN_LABELS[params.dominioSetorial]}`;

  const squadIds = new Set(squad.map((m) => m.id));
  const affinitiesInSquad = member.afinidades_ids.filter(
    (id) => id !== member.id && squadIds.has(id)
  );
  const frictionsInSquad = member.atritos_ids.filter(
    (id) => id !== member.id && squadIds.has(id)
  );

  let socialText = `perfil ${member.arquetipo}`;
  if (affinitiesInSquad.length > 0) {
    socialText += ` com afinidade ativa (${affinitiesInSquad.join(', ')})`;
  } else if (frictionsInSquad.length > 0) {
    socialText += ` com atrito mapeado (${frictionsInSquad.join(', ')})`;
  }

  return `${skillText}; ${domainText}; ${socialText}.`;
}

export function evaluateSquad(
  members: Professional[],
  params: SquadParams,
  id = 'custom-squad'
): SquadEvaluation {
  const weights = computeDynamicWeights(params);
  const custoHoraTotal = members.reduce((sum, m) => sum + m.custoHora, 0);
  const taxaSucessoMedia =
    members.length > 0
      ? round2(
          members.reduce((sum, m) => sum + m.taxaSucesso, 0) / members.length
        )
      : 0;

  const { edges, hasFacilitator } = extractSocialEdges(members);
  const violations = checkHardConstraints(
    members,
    params,
    custoHoraTotal,
    edges,
    hasFacilitator
  );
  const subIndices = computeSubIndices(
    members,
    params,
    custoHoraTotal,
    taxaSucessoMedia,
    edges,
    hasFacilitator
  );

  const scoreFinal = round2(
    weights.w1 * subIndices.sTecnico +
      weights.w2 * subIndices.sDominio +
      weights.w3 * subIndices.sQuimica +
      weights.w4 * subIndices.sRpg +
      weights.w5 * subIndices.sConfiabCusto
  );

  const membersWithRationale: MemberWithRationale[] = members.map((m) => ({
    professional: m,
    justificativa: generateMemberJustification(m, members, params),
  }));

  return {
    id,
    members,
    membersWithRationale,
    scoreFinal,
    custoHoraTotal,
    taxaSucessoMedia,
    weights,
    subIndices,
    edges,
    hasFacilitator,
    violations,
    isValid: violations.length === 0,
  };
}

export function isEligibleForProject(
  p: Professional,
  params: SquadParams
): { eligible: boolean; matchedReqSkills: number } {
  const matchedReqSkills = params.skillsObrigatorias.filter(
    (req) => (p.skills[req.skill] ?? 0) >= Math.max(2, req.minLevel - 1)
  ).length;
  const domainMatch = p.dominios.includes(params.dominioSetorial);
  const isFacilitator = p.arquetipo === 'Facilitador';

  const eligible = matchedReqSkills > 0 || domainMatch || isFacilitator;
  return { eligible, matchedReqSkills };
}

export function solveTopSquads(
  professionals: Professional[],
  params: SquadParams
): {
  topSquads: SquadEvaluation[];
  telemetry: SearchTelemetry;
} {
  const pool = professionals.filter(
    (p) => isEligibleForProject(p, params).eligible
  );
  const effectivePool = pool.length >= params.minSize ? pool : professionals;

  // Sort by cheapest first for crisp Branch-and-Bound budget pruning
  const sortedPool = [...effectivePool].sort((a, b) => a.custoHora - b.custoHora);
  const n = sortedPool.length;

  let combinationsEvaluated = 0;
  let branchesPruned = 0;
  const validResults: SquadEvaluation[] = [];
  const fallbackResults: SquadEvaluation[] = [];

  // Precompute minimum sum of k cheapest remaining items starting at index idx
  const minRemainingCost = (startIdx: number, countNeeded: number): number => {
    if (countNeeded <= 0) return 0;
    if (startIdx + countNeeded > n) return Infinity;
    let sum = 0;
    for (let i = 0; i < countNeeded; i++) {
      sum += sortedPool[startIdx + i].custoHora;
    }
    return sum;
  };

  const current: Professional[] = [];

  function backtrack(startIdx: number, currentCost: number) {
    if (current.length >= params.minSize && current.length <= params.maxSize) {
      combinationsEvaluated++;
      const evalResult = evaluateSquad(
        [...current],
        params,
        `squad-${current.map((m) => m.id).join('-')}`
      );
      if (evalResult.isValid) {
        validResults.push(evalResult);
      } else {
        fallbackResults.push(evalResult);
      }
    }

    if (current.length === params.maxSize) {
      return;
    }

    for (let i = startIdx; i < n; i++) {
      const candidate = sortedPool[i];
      const nextCost = currentCost + candidate.custoHora;

      // Branch-and-Bound pruning 1: exact budget bound
      if (nextCost > params.orcamentoMaxHora && validResults.length >= 5) {
        branchesPruned += 1;
        continue;
      }

      // Branch-and-Bound pruning 2: min remaining cost to reach minSize
      const stillNeeded = Math.max(0, params.minSize - (current.length + 1));
      if (
        stillNeeded > 0 &&
        nextCost + minRemainingCost(i + 1, stillNeeded) > params.orcamentoMaxHora &&
        validResults.length >= 5
      ) {
        branchesPruned += 1;
        continue;
      }

      current.push(candidate);
      backtrack(i + 1, nextCost);
      current.pop();
    }
  }

  backtrack(0, 0);

  const sortEvaluations = (a: SquadEvaluation, b: SquadEvaluation) => {
    if (b.scoreFinal !== a.scoreFinal) return b.scoreFinal - a.scoreFinal;
    if (a.custoHoraTotal !== b.custoHoraTotal)
      return a.custoHoraTotal - b.custoHoraTotal;
    return b.taxaSucessoMedia - a.taxaSucessoMedia;
  };

  validResults.sort(sortEvaluations);
  fallbackResults.sort((a, b) => {
    if (a.violations.length !== b.violations.length)
      return a.violations.length - b.violations.length;
    return sortEvaluations(a, b);
  });

  const combined =
    validResults.length >= 5
      ? validResults.slice(0, 5)
      : [...validResults, ...fallbackResults].slice(0, 5);

  const topSquads = combined.map((sq, idx) => ({
    ...sq,
    id: `rank-${idx + 1}-${sq.members.map((m) => m.id).join('-')}`,
  }));

  // Compute total combinatorial space C(n, k) for k in [minSize..maxSize]
  const comb = (total: number, k: number): number => {
    if (k < 0 || k > total) return 0;
    let res = 1;
    for (let i = 1; i <= k; i++) {
      res = (res * (total - i + 1)) / i;
    }
    return Math.round(res);
  };
  let totalCombinationsSpace = 0;
  for (let k = params.minSize; k <= params.maxSize; k++) {
    totalCombinationsSpace += comb(n, k);
  }

  return {
    topSquads,
    telemetry: {
      totalCombinationsSpace,
      combinationsEvaluated,
      branchesPruned,
      validFound: validResults.length,
    },
  };
}
