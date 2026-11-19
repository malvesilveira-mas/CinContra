"""
Motor Determinístico de Recomendação e Simulação de Squads (White-Box AI Engine).
Arquitetura:
  - Branch-and-Bound Hierárquico + Matrizes 2D O(1) + Bitmasks 64-bit + LUT RPG
  - Anytime Cutoff (< 120 ms / 35.000 nós)
  - Pódio Top-K com Diversidade Garantida (min_diff_members >= 2)
  - Busca em 2 Etapas: Hard Constraints (Etapa 1) -> Soft Constraints Fallback (Etapa 2)
"""

import heapq
import math
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from .normalizer import DOMAIN_CANONICAL_TO_LABEL, SKILL_CANONICAL_TO_LABEL

# ==============================================================================
# 1. CONSTANTES E TABELAS DA MATRIZ DE DECISÃO (CAMADAS 1, 2 E 3)
# ==============================================================================

TRILHAS = ("Engenharia", "Dados", "Produto & Design")

CARGOS_EXECUTORES = {"Desenvolvedor", "Analista de Dados", "Designer de Produto"}
CARGOS_LIDERES = {"Líder de Desenvolvimento", "Líder de Dados", "Líder de Design"}
CARGOS_GERENTES = {"Gerente de Software", "Gerente de Dados", "Gerente de Produto"}

ARQ_MAP = {
    "Arquiteto Metódico": 0,   # AM
    "Executor Pragmático": 1,  # EP
    "Facilitador": 2,          # FA
    "Cético Analítico": 3,     # CA
    "Bombeiro": 4,             # BO
}
ARQ_NAMES = {v: k for k, v in ARQ_MAP.items()}

# Matriz 5x5 Base (Sem Facilitador: AM x EP = -1.5)
PHI_MATRIX_NO_FA = (
    ( 0.5, -1.5,  1.0,  2.0, -0.5),  # AM
    (-1.5, -0.5,  1.5,  0.0,  1.0),  # EP
    ( 1.0,  1.5,  0.5,  1.0,  1.0),  # FA
    ( 2.0,  0.0,  1.0,  0.5, -1.0),  # CA
    (-0.5,  1.0,  1.0, -1.0,  0.0),  # BO
)

# Matriz 5x5 Com Facilitador (n_FA >= 1 neutraliza AM x EP para 0.0)
PHI_MATRIX_WITH_FA = (
    ( 0.5,  0.0,  1.0,  2.0, -0.5),  # AM
    ( 0.0, -0.5,  1.5,  0.0,  1.0),  # EP
    ( 1.0,  1.5,  0.5,  1.0,  1.0),  # FA
    ( 2.0,  0.0,  1.0,  0.5, -1.0),  # CA
    (-0.5,  1.0,  1.0, -1.0,  0.0),  # BO
)

PACOTES_SOLUCAO: Dict[str, Set[str]] = {
    "Software Preditivo/IA": {
        "Machine_Learning_Preditivo", "Series_Temporais", "Estatistica",
        "Python_DS", "Python", "Cloud_AWS_GCP",
    },
    "Produto Digital/App": {
        "React", "Node.js", "APIs_REST", "Design_System",
        "Discovery_Usuario", "Prototipacao_Figma", "Metricas_Produto",
    },
    "Plataforma de Dados/BI": {
        "Engenharia_ETL", "SQL_Avancado", "Spark",
        "PowerBI_Looker", "Data_Visualization", "Cloud_AWS_GCP",
    },
    "Sistema Crítico/IoT": {
        "Integracao_IoT_SCADA", "Arquitetura_Microsservicos",
        "Docker_K8s", "APIs_REST", "Python",
    },
}

TABELA_PESOS: Dict[Tuple[str, str], Tuple[float, float, float, float, float]] = {
    ("Software Preditivo/IA", "Baixa"):    (0.35, 0.25, 0.10, 0.15, 0.15),
    ("Software Preditivo/IA", "Normal"):   (0.30, 0.20, 0.15, 0.20, 0.15),
    ("Software Preditivo/IA", "Crítica"):  (0.28, 0.15, 0.17, 0.25, 0.15),
    ("Sistema Crítico/IoT", "Baixa"):      (0.32, 0.23, 0.10, 0.15, 0.20),
    ("Sistema Crítico/IoT", "Normal"):     (0.30, 0.20, 0.12, 0.18, 0.20),
    ("Sistema Crítico/IoT", "Crítica"):    (0.25, 0.15, 0.18, 0.25, 0.17),
    ("Produto Digital/App", "Baixa"):      (0.25, 0.20, 0.20, 0.15, 0.20),
    ("Produto Digital/App", "Normal"):     (0.25, 0.18, 0.22, 0.18, 0.17),
    ("Produto Digital/App", "Crítica"):    (0.22, 0.12, 0.23, 0.28, 0.15),
    ("Plataforma de Dados/BI", "Baixa"):   (0.30, 0.25, 0.12, 0.13, 0.20),
    ("Plataforma de Dados/BI", "Normal"):  (0.28, 0.22, 0.15, 0.15, 0.20),
    ("Plataforma de Dados/BI", "Crítica"): (0.25, 0.17, 0.18, 0.23, 0.17),
}


def format_professional_for_response(p: Dict[str, Any]) -> Dict[str, Any]:
    """Serializa um profissional com campos snake_case (motor) e camelCase (cincontra_front)."""
    dominios_list = p.get("dominios_list") or sorted(p["dominios"])
    afinidades_list = p.get("afinidades_list") or sorted(
        p["afinidades_ids"], key=lambda x: int(x[1:])
    )
    atritos_list = p.get("atritos_list") or sorted(
        p["atritos_ids"], key=lambda x: int(x[1:])
    )
    return {
        "id": p["id"],
        "nome": p["nome"],
        "cargo": p["cargo"],
        "trilha": p["trilha"],
        "senioridade": p["senioridade"],
        "custo_hora_brl": p["custo_hora_brl"],
        "custoHora": p["custo_hora_brl"],
        "taxa_sucesso_pct": p["taxa_sucesso_pct"],
        "taxaSucesso": p["taxa_sucesso_pct"],
        "arquetipo": p["arquetipo"],
        "hard_skills": dict(p["hard_skills"]),
        "skills": dict(p["hard_skills"]),
        "dominios": list(dominios_list),
        "afinidades_ids": list(afinidades_list),
        "atritos_ids": list(atritos_list),
    }


def _is_diverse_from_podium(
    cand_bmask: int,
    podium_items: List[Tuple[float, int, Tuple[str, ...]]],
    min_diff_members: int,
) -> bool:
    if min_diff_members <= 1:
        return all(cand_bmask != item[1] for item in podium_items)
    for _, p_bmask, _ in podium_items:
        diff_a = (cand_bmask & ~p_bmask).bit_count()
        diff_b = (p_bmask & ~cand_bmask).bit_count()
        if max(diff_a, diff_b) < min_diff_members:
            return False
    return True


def _rebuild_diverse_podium(
    candidates_sorted_desc: List[Tuple[float, int, Tuple[str, ...]]],
    top_k: int,
    min_diff_members: int,
) -> List[Tuple[float, int, Tuple[str, ...]]]:
    podium: List[Tuple[float, int, Tuple[str, ...]]] = []
    for item in candidates_sorted_desc:
        if _is_diverse_from_podium(item[1], podium, min_diff_members):
            podium.append(item)
            if len(podium) == top_k:
                break
    return podium


# ==============================================================================
# 2. CORE ENGINE: MOTOR BRANCH-AND-BOUND HIERÁRQUICO
# ==============================================================================

class SquadRecommendationEngine:
    def __init__(self, professionals: List[Dict[str, Any]]):
        self.professionals: List[Dict[str, Any]] = []
        self.prof_by_id: Dict[str, Dict[str, Any]] = {}
        self.idx_by_id: Dict[str, int] = {}
        self.trilha_to_idx = {t: i for i, t in enumerate(TRILHAS)}

        for p_raw in professionals:
            p = dict(p_raw)
            p["dominios"] = set(p["dominios"])
            p["afinidades_ids"] = set(p["afinidades_ids"])
            p["atritos_ids"] = set(p["atritos_ids"])
            self.professionals.append(p)

        n = len(self.professionals)
        self.n_profs = n

        # 1. Pré-indexação em inteiros 0..N-1 e bitmasks de 64 bits
        for idx, p in enumerate(self.professionals):
            pid = p["id"]
            self.prof_by_id[pid] = p
            self.idx_by_id[pid] = idx
            p["_idx"] = idx
            p["_bit"] = 1 << idx
            p["_t_idx"] = self.trilha_to_idx[p["trilha"]]
            p["_arq_idx"] = ARQ_MAP[p["arquetipo"]]
            p["_is_exec"] = p["cargo"] in CARGOS_EXECUTORES
            p["_is_lider"] = p["cargo"] in CARGOS_LIDERES
            p["_is_gerente"] = p["cargo"] in CARGOS_GERENTES
            p["_rho"] = 1.0 if p["_is_exec"] else 2.0

        # 2. Matrizes 2D pré-computadas (N x N) e máscaras de bits do grafo social
        self.aff_matrix = [[0] * n for _ in range(n)]
        self.atr_matrix = [[0] * n for _ in range(n)]
        self.aff_pair_pts = [[0.0] * n for _ in range(n)]
        self.atr_pair_cnt = [[0] * n for _ in range(n)]
        self.bilateral_friction_masks: List[int] = []
        self.bilateral_friction_pairs: List[Tuple[str, str, int]] = []
        self._rpg_lut_cache: Dict[Tuple[int, int, str, bool, bool, float], Any] = {}

        for i, p in enumerate(self.professionals):
            aff_mask = 0
            for target_id in p["afinidades_ids"]:
                if target_id in self.idx_by_id:
                    j = self.idx_by_id[target_id]
                    aff_mask |= (1 << j)
                    self.aff_matrix[i][j] = 1
            atr_mask = 0
            for target_id in p["atritos_ids"]:
                if target_id in self.idx_by_id:
                    j = self.idx_by_id[target_id]
                    atr_mask |= (1 << j)
                    self.atr_matrix[i][j] = 1
            p["_aff_mask"] = aff_mask
            p["_atr_mask"] = atr_mask

        for i in range(n):
            p_a = self.professionals[i]
            ti = p_a["_t_idx"]
            social_adj_mask = 0
            upward_cross_aff = 0.0
            intra_aff_pot = 0.0

            for j in range(n):
                if i == j:
                    continue
                ij_aff = self.aff_matrix[i][j]
                ji_aff = self.aff_matrix[j][i]
                pts = 20.0 if (ij_aff and ji_aff) else (8.0 if (ij_aff or ji_aff) else 0.0)
                atr_cnt = self.atr_matrix[i][j] + self.atr_matrix[j][i]
                self.aff_pair_pts[i][j] = pts
                self.atr_pair_cnt[i][j] = atr_cnt

                if pts > 0.0 or atr_cnt > 0:
                    social_adj_mask |= (1 << j)
                if pts > 0.0:
                    tj = self.professionals[j]["_t_idx"]
                    if tj == ti:
                        intra_aff_pot += pts
                    elif tj > ti:
                        upward_cross_aff += pts

                if j > i and self.atr_matrix[i][j] and self.atr_matrix[j][i]:
                    bmask_pair = p_a["_bit"] | self.professionals[j]["_bit"]
                    self.bilateral_friction_masks.append(bmask_pair)
                    self.bilateral_friction_pairs.append(
                        (p_a["id"], self.professionals[j]["id"], bmask_pair)
                    )

            p_a["_social_adj_mask"] = social_adj_mask
            p_a["_upward_cross_aff"] = upward_cross_aff
            p_a["_intra_aff_pot"] = intra_aff_pot

        # Pre-warm LUT RPG para o caso padrão (5..7 e 6..6) no startup
        self._build_rpg_luts(5, 7, "Normal", True, True, 0.22)
        self._build_rpg_luts(5, 7, "Normal", True, False, 0.20)
        self._build_rpg_luts(6, 6, "Normal", True, True, 0.22)

    @staticmethod
    def get_dynamic_weights(
        tipo_solucao: str, urgencia_prazo: str, criticidade_regulatoria: str
    ) -> Tuple[float, float, float, float, float]:
        w1, w2, w3, w4, w5 = TABELA_PESOS[(tipo_solucao, urgencia_prazo)]
        if criticidade_regulatoria == "Alta":
            w3 = round(w3 - 0.03, 4)
            w4 = round(w4 + 0.02, 4)
            w5 = round(w5 + 0.01, 4)
        return w1, w2, w3, w4, w5

    # --------------------------------------------------------------------------
    # PRÉ-COMPUTAÇÃO DE TABELA DE LOOKUP O(1) E BACKWARD-DP PARA SINERGIA RPG
    # --------------------------------------------------------------------------
    def _build_rpg_luts(
        self, n_min: int, n_max: int, urgencia: str, is_ia: bool, is_alta: bool, w4: float
    ) -> Tuple[
        Dict[int, Dict[int, float]],
        Dict[int, Dict[int, float]],
        Dict[int, float],
        List[Dict[int, float]],
        List[Dict[int, float]],
    ]:
        cache_key = (n_min, n_max, urgencia, is_ia, is_alta, w4)
        if cache_key in self._rpg_lut_cache:
            return self._rpg_lut_cache[cache_key]

        rpg_lut: Dict[int, Dict[int, float]] = {}
        rpg_partial_max: Dict[int, Dict[int, float]] = {}
        max_rpg_by_n: Dict[int, float] = {}
        shifts = (1, 1 << 3, 1 << 6, 1 << 9, 1 << 12)

        for n_tot in range(n_min, n_max + 1):
            lut_n: Dict[int, float] = {}
            inv_n_5 = 5.0 / n_tot
            num_pairs = (n_tot * (n_tot - 1)) / 2.0
            inv_pairs_10 = 10.0 / num_pairs if num_pairs > 0 else 0.0
            best_n = 0.0

            for c0 in range(n_tot + 1):
                for c1 in range(n_tot - c0 + 1):
                    for c2 in range(n_tot - c0 - c1 + 1):
                        for c3 in range(n_tot - c0 - c1 - c2 + 1):
                            c4 = n_tot - c0 - c1 - c2 - c3
                            if urgencia == "Crítica":
                                m_urg = 8.0 * c4 + 6.0 * c1 - 4.0 * c0 - 6.0 * max(0, c0 - 1)
                            elif urgencia == "Baixa":
                                m_urg = -4.0 * c4 + 3.0 * c0
                            else:
                                m_urg = 0.0

                            if is_ia and is_alta:
                                m_sol_crit = 9.0 * c3 + 8.0 * c0
                            elif is_ia or is_alta:
                                m_sol_crit = 6.0 * c3 + 5.0 * c0
                            else:
                                m_sol_crit = 0.0

                            delta_ctx = inv_n_5 * (m_urg + m_sol_crit)
                            counts = (c0, c1, c2, c3, c4)
                            phi_mat = PHI_MATRIX_WITH_FA if c2 >= 1 else PHI_MATRIX_NO_FA
                            soma_pares = 0.0
                            for ia in range(5):
                                cia = counts[ia]
                                if cia == 0:
                                    continue
                                if cia > 1:
                                    soma_pares += (cia * (cia - 1) // 2) * phi_mat[ia][ia]
                                for ja in range(ia + 1, 5):
                                    cja = counts[ja]
                                    if cja > 0:
                                        soma_pares += (cia * cja) * phi_mat[ia][ja]

                            delta_pares = inv_pairs_10 * soma_pares
                            p_deseq = 25.0 if (c1 >= 2 and (c0 + c3) == 0) else 0.0
                            s_rpg = max(0.0, min(100.0, 60.0 + delta_ctx + delta_pares - p_deseq))
                            val = w4 * s_rpg
                            code = c0 | (c1 << 3) | (c2 << 6) | (c3 << 9) | (c4 << 12)
                            lut_n[code] = val
                            if val > best_n:
                                best_n = val

            rpg_lut[n_tot] = lut_n
            max_rpg_by_n[n_tot] = best_n

            part_n = dict(lut_n)
            curr_layer = lut_n
            for _k in range(n_tot - 1, -1, -1):
                prev_layer: Dict[int, float] = {}
                for code, val in curr_layer.items():
                    for sh in shifts:
                        if (code // sh) & 7:
                            p_code = code - sh
                            old_v = prev_layer.get(p_code, -1.0)
                            if val > old_v:
                                prev_layer[p_code] = val
                part_n.update(prev_layer)
                curr_layer = prev_layer
            rpg_partial_max[n_tot] = part_n

        global_max_w4_rpg = max(max_rpg_by_n.values()) if max_rpg_by_n else 0.0
        rpg_def_by_k: List[Dict[int, float]] = [{} for _ in range(n_max + 1)]
        for code_p in rpg_partial_max[n_max]:
            cnt_p = (
                (code_p & 7)
                + ((code_p >> 3) & 7)
                + ((code_p >> 6) & 7)
                + ((code_p >> 9) & 7)
                + ((code_p >> 12) & 7)
            )
            for k_sz in range(cnt_p, n_max + 1):
                best_v = -1.0
                for nt in range(max(n_min, k_sz), n_max + 1):
                    v = rpg_partial_max[nt].get(code_p, -1.0)
                    if v > best_v:
                        best_v = v
                rpg_def_by_k[k_sz][code_p] = best_v - global_max_w4_rpg

        shifts_no_am_ca = (1 << 3, 1 << 6, 1 << 12)
        rpg_def_no_am_ca_by_k: List[Dict[int, float]] = [
            dict(rpg_def_by_k[k_sz]) for k_sz in range(n_max + 1)
        ]
        for k_sz in range(1, n_max + 1):
            curr_l = {
                code: val
                for code, val in rpg_def_by_k[k_sz].items()
                if (
                    (code & 7)
                    + ((code >> 3) & 7)
                    + ((code >> 6) & 7)
                    + ((code >> 9) & 7)
                    + ((code >> 12) & 7)
                ) == k_sz
            }
            for _step in range(k_sz - 1, -1, -1):
                prev_l: Dict[int, float] = {}
                for code, val in curr_l.items():
                    for sh in shifts_no_am_ca:
                        if (code // sh) & 7:
                            p_code = code - sh
                            old_v = prev_l.get(p_code, -1e9)
                            if val > old_v:
                                prev_l[p_code] = val
                rpg_def_no_am_ca_by_k[k_sz].update(prev_l)
                curr_l = prev_l

        res_tuple = (rpg_lut, rpg_partial_max, max_rpg_by_n, rpg_def_by_k, rpg_def_no_am_ca_by_k)
        self._rpg_lut_cache[cache_key] = res_tuple
        return res_tuple

    # --------------------------------------------------------------------------
    # AVALIAÇÃO INDIVIDUAL COMPLETA (USADA NO TOP-K, FALLBACK E WHAT-IF)
    # --------------------------------------------------------------------------
    def evaluate_squad_detailed(
        self,
        member_ids: List[str],
        params: Dict[str, Any],
        squad_id_prefix: str = "squad",
    ) -> Dict[str, Any]:
        """
        Calcula o score completo (NUNCA zerando score_final nem ui_metrics),
        valida Hard Constraints (HC1..HC5) com descrições detalhadas e gera explicabilidade White-Box.
        """
        unique_ids = []
        seen_m = set()
        for mid in member_ids:
            mid_clean = str(mid).strip().upper()
            if mid_clean not in self.prof_by_id:
                raise KeyError(f"Profissional '{mid}' não encontrado na base.")
            if mid_clean not in seen_m:
                seen_m.add(mid_clean)
                unique_ids.append(mid_clean)

        squad = [self.prof_by_id[mid] for mid in sorted(unique_ids, key=lambda x: int(x[1:]))]
        n_members = len(squad)
        b_max = float(params["orcamento_max_hora"])
        n_min, n_max = params["tamanho_squad"]
        k_req: Dict[str, int] = params["skills_obrigatorias"]
        crit_reg = params["criticidade_regulatoria"]
        urgencia = params["urgencia_prazo"]
        tipo_sol = params["tipo_solucao"]
        dom_req = params["dominio_setorial"]

        w1, w2, w3, w4, w5 = self.get_dynamic_weights(tipo_sol, urgencia, crit_reg)

        # 1. Validação detalhada das 5 Hard Constraints (Camada 1)
        violations: List[Dict[str, str]] = []

        custo_total = sum(p["custo_hora_brl"] for p in squad)
        hc1_ok = (n_min <= n_members <= n_max)
        if not hc1_ok:
            violations.append({
                "rule_id": "HC1",
                "code": "SQUAD_SIZE",
                "rule_name": "HC1 — Cardinalidade do Squad",
                "message": (
                    f"Tamanho do squad ({n_members}) fora do intervalo permitido "
                    f"({n_min} a {n_max} integrantes)."
                ),
            })

        hc2_ok = (custo_total <= b_max)
        if not hc2_ok:
            excesso = custo_total - b_max
            violations.append({
                "rule_id": "HC2",
                "code": "BUDGET_EXCEEDED",
                "rule_name": "HC2 — Restrição Orçamentária",
                "message": (
                    f"Orçamento excedido em R$ {excesso:.2f}/h "
                    f"(R$ {custo_total:.2f}/h acima do teto de R$ {b_max:.2f}/h)."
                ),
            })

        missing_skills: List[str] = []
        for sk, min_lvl in k_req.items():
            best_lvl = max((p["hard_skills"].get(sk, 0) for p in squad), default=0)
            if best_lvl < min_lvl:
                sk_label = SKILL_CANONICAL_TO_LABEL.get(sk, sk)
                missing_skills.append(f"{sk} >= {min_lvl}")
                violations.append({
                    "rule_id": "HC3",
                    "code": "MISSING_SKILL",
                    "rule_name": "HC3 — Cobertura de Escopo Técnico",
                    "message": (
                        f"Skill obrigatória {sk_label} ({sk}) nv.{min_lvl} não coberta "
                        f"(nível máximo no squad: {best_lvl})."
                    ),
                })
        hc3_ok = (len(missing_skills) == 0)

        exec_count = {t: 0 for t in TRILHAS}
        lider_count = {t: 0 for t in TRILHAS}
        gerente_count = {t: 0 for t in TRILHAS}
        arq_counts = [0, 0, 0, 0, 0]
        squad_bitmask = 0

        for p in squad:
            t = p["trilha"]
            if p["_is_exec"]:
                exec_count[t] += 1
            elif p["_is_lider"]:
                lider_count[t] += 1
            elif p["_is_gerente"]:
                gerente_count[t] += 1
            arq_counts[p["_arq_idx"]] += 1
            squad_bitmask |= p["_bit"]

        total_gerentes = sum(gerente_count.values())
        hc4c_ok = not (total_gerentes > 0 and not (n_members >= 6 or crit_reg == "Alta"))
        if not hc4c_ok:
            violations.append({
                "rule_id": "HC4c",
                "code": "LEADER_EXECUTOR_RATIO",
                "rule_name": "HC4c — Elegibilidade de Gerentes",
                "message": (
                    f"Presença de Gerente ({total_gerentes}) exige squad >= 6 membros "
                    f"(atual: {n_members}) ou Criticidade Regulatória Alta (atual: {crit_reg})."
                ),
            })

        hc4a_ok = True
        hc4b_ok = True
        for t in TRILHAS:
            if (lider_count[t] + gerente_count[t]) > 0 and exec_count[t] < 2:
                hc4a_ok = False
                violations.append({
                    "rule_id": "HC4a",
                    "code": "LEADER_EXECUTOR_RATIO",
                    "rule_name": "HC4a — Base Mínima de Executores por Trilha",
                    "message": (
                        f"Trilha '{t}' possui {lider_count[t]} Líder(es) e {gerente_count[t]} Gerente(s), "
                        f"mas apenas {exec_count[t]} Executor(es) (mínimo exigido: 2 executores)."
                    ),
                })
            if lider_count[t] > (exec_count[t] // 3):
                hc4b_ok = False
                violations.append({
                    "rule_id": "HC4b",
                    "code": "LEADER_EXECUTOR_RATIO",
                    "rule_name": "HC4b — Teto de Liderança 1:3 por Trilha",
                    "message": (
                        f"Trilha '{t}' excede a proporção de 1 Líder para cada 3 Executores "
                        f"({lider_count[t]} Líder(es) para {exec_count[t]} Executor(es))."
                    ),
                })
        hc4_ok = hc4a_ok and hc4b_ok and hc4c_ok

        has_facilitador = (arq_counts[2] > 0)
        active_bilateral_frictions = [
            (id_a, id_b)
            for id_a, id_b, mask in self.bilateral_friction_pairs
            if (squad_bitmask & mask) == mask
        ]
        has_bilateral_friction = len(active_bilateral_frictions) > 0
        hc5_ok = not (has_bilateral_friction and not has_facilitador)
        if not hc5_ok:
            pares_str = ", ".join(f"{a} <-> {b}" for a, b in active_bilateral_frictions)
            violations.append({
                "rule_id": "HC5",
                "code": "UNMITIGATED_FRICTION",
                "rule_name": "HC5 — Trava de Atrito Crítico Bilateral",
                "message": (
                    f"Atrito crítico bilateral detectado ({pares_str}) sem nenhum profissional "
                    f"com arquétipo Facilitador no squad para mediação."
                ),
            })

        is_valid = hc1_ok and hc2_ok and hc3_ok and hc4_ok and hc5_ok

        # 2. Cálculo dos 5 Sub-Índices (Camada 2)
        # 2.1 S_Tecnico
        k_sol = PACOTES_SOLUCAO.get(tipo_sol, set())
        s_eval = set(k_req.keys()) | k_sol
        num_tec = 0.0
        den_tec = 0.0
        skill_breakdown = []

        for sk in sorted(s_eval):
            is_req = sk in k_req
            omega = 2.0 if is_req else 1.0
            levels = sorted(
                [(p["hard_skills"].get(sk, 0), p["id"]) for p in squad],
                key=lambda x: x[0],
                reverse=True,
            )
            v1, id1 = levels[0] if len(levels) >= 1 else (0, None)
            v2, id2 = levels[1] if len(levels) >= 2 else (0, None)
            es_val = 0.70 * v1 + 0.30 * v2
            contrib = omega * (es_val / 5.0)
            num_tec += contrib
            den_tec += omega
            skill_breakdown.append({
                "skill": sk,
                "label": SKILL_CANONICAL_TO_LABEL.get(sk, sk),
                "obrigatoria": is_req,
                "peso": omega,
                "top1": (id1, v1) if v1 > 0 else (None, 0),
                "top2": (id2, v2) if v2 > 0 else (None, 0),
                "E_s": round(es_val, 2),
                "contribuicao": round(contrib, 3),
            })
        s_tecnico = 100.0 * (num_tec / den_tec) if den_tec > 0 else 0.0

        # 2.2 S_Dominio
        num_dom = sum(p["_rho"] for p in squad if dom_req in p["dominios"])
        den_dom = sum(p["_rho"] for p in squad)
        s_dominio = 100.0 * (num_dom / den_dom) if den_dom > 0 else 0.0

        # 2.3 S_Quimica & Grafo de Arestas
        a_uni = 0
        a_bi = 0
        c_dir = 0
        arestas_ativas: List[str] = []
        structured_edges: List[Dict[str, Any]] = []

        for i in range(n_members):
            pa = squad[i]
            for j in range(i + 1, n_members):
                pb = squad[j]
                ab_aff = bool(pa["_aff_mask"] & pb["_bit"])
                ba_aff = bool(pb["_aff_mask"] & pa["_bit"])
                if ab_aff and ba_aff:
                    a_bi += 1
                    lbl = f"Afinidade Bilateral: {pa['id']} <-> {pb['id']} (+20.0 pts)"
                    arestas_ativas.append(lbl)
                    structured_edges.append({
                        "fromId": pa["id"],
                        "toId": pb["id"],
                        "type": "afinidade",
                        "bilateral": True,
                        "cushionedByFacilitator": False,
                        "points": 20.0,
                        "label": lbl,
                    })
                elif ab_aff:
                    a_uni += 1
                    lbl = f"Afinidade Unilateral: {pa['id']} -> {pb['id']} (+8.0 pts)"
                    arestas_ativas.append(lbl)
                    structured_edges.append({
                        "fromId": pa["id"],
                        "toId": pb["id"],
                        "type": "afinidade",
                        "bilateral": False,
                        "cushionedByFacilitator": False,
                        "points": 8.0,
                        "label": lbl,
                    })
                elif ba_aff:
                    a_uni += 1
                    lbl = f"Afinidade Unilateral: {pb['id']} -> {pa['id']} (+8.0 pts)"
                    arestas_ativas.append(lbl)
                    structured_edges.append({
                        "fromId": pb["id"],
                        "toId": pa["id"],
                        "type": "afinidade",
                        "bilateral": False,
                        "cushionedByFacilitator": False,
                        "points": 8.0,
                        "label": lbl,
                    })

                ab_atr = bool(pa["_atr_mask"] & pb["_bit"])
                ba_atr = bool(pb["_atr_mask"] & pa["_bit"])
                pen_unit = -6.0 if has_facilitador else -20.0
                if ab_atr and ba_atr:
                    c_dir += 2
                    lbl_ab = f"Atrito: {pa['id']} -> {pb['id']} ({pen_unit:+.1f} pts)"
                    lbl_ba = f"Atrito: {pb['id']} -> {pa['id']} ({pen_unit:+.1f} pts)"
                    arestas_ativas.append(lbl_ab)
                    arestas_ativas.append(lbl_ba)
                    structured_edges.append({
                        "fromId": pa["id"],
                        "toId": pb["id"],
                        "type": "atrito",
                        "bilateral": True,
                        "cushionedByFacilitator": has_facilitador,
                        "points": 2.0 * pen_unit,
                        "label": f"Atrito Bilateral: {pa['id']} <-> {pb['id']} ({2.0 * pen_unit:+.1f} pts)",
                    })
                elif ab_atr:
                    c_dir += 1
                    lbl = f"Atrito: {pa['id']} -> {pb['id']} ({pen_unit:+.1f} pts)"
                    arestas_ativas.append(lbl)
                    structured_edges.append({
                        "fromId": pa["id"],
                        "toId": pb["id"],
                        "type": "atrito",
                        "bilateral": False,
                        "cushionedByFacilitator": has_facilitador,
                        "points": pen_unit,
                        "label": lbl,
                    })
                elif ba_atr:
                    c_dir += 1
                    lbl = f"Atrito: {pb['id']} -> {pa['id']} ({pen_unit:+.1f} pts)"
                    arestas_ativas.append(lbl)
                    structured_edges.append({
                        "fromId": pb["id"],
                        "toId": pa["id"],
                        "type": "atrito",
                        "bilateral": False,
                        "cushionedByFacilitator": has_facilitador,
                        "points": pen_unit,
                        "label": lbl,
                    })

        gamma_fac = 0.30 if has_facilitador else 1.00
        s_quimica = max(0.0, min(100.0, 60.0 + 8.0 * a_uni + 20.0 * a_bi - 20.0 * gamma_fac * c_dir))

        # 2.4 S_RPG
        n_am, n_ep, n_fa, n_ca, n_bo = arq_counts
        if urgencia == "Crítica":
            m_urg = 8.0 * n_bo + 6.0 * n_ep - 4.0 * n_am - 6.0 * max(0, n_am - 1)
        elif urgencia == "Baixa":
            m_urg = -4.0 * n_bo + 3.0 * n_am
        else:
            m_urg = 0.0

        is_ia = (tipo_sol == "Software Preditivo/IA")
        is_alta = (crit_reg == "Alta")
        if is_ia and is_alta:
            m_sol_crit = 9.0 * n_ca + 8.0 * n_am
        elif is_ia or is_alta:
            m_sol_crit = 6.0 * n_ca + 5.0 * n_am
        else:
            m_sol_crit = 0.0

        delta_contexto = (5.0 / n_members) * (m_urg + m_sol_crit) if n_members > 0 else 0.0
        phi_mat = PHI_MATRIX_WITH_FA if n_fa >= 1 else PHI_MATRIX_NO_FA
        soma_pares = 0.0
        for i in range(n_members):
            ai = squad[i]["_arq_idx"]
            for j in range(i + 1, n_members):
                soma_pares += phi_mat[ai][squad[j]["_arq_idx"]]

        num_pairs = (n_members * (n_members - 1)) / 2.0
        delta_pares = (10.0 / num_pairs) * soma_pares if num_pairs > 0 else 0.0
        p_deseq = 25.0 if (n_ep >= 2 and (n_am + n_ca) == 0) else 0.0
        s_rpg = max(0.0, min(100.0, 60.0 + delta_contexto + delta_pares - p_deseq))

        # 2.5 S_Confiabilidade_Custo
        s_sucesso = (sum(p["taxa_sucesso_pct"] for p in squad) / n_members) if n_members > 0 else 0.0
        r = (custo_total / b_max) if b_max > 0 else 1.0
        if r < 0.50:
            s_efic = max(0.0, 100.0 * r)
        elif r < 0.80:
            s_efic = 50.0 + 166.67 * (r - 0.50)
        elif r <= 0.95:
            s_efic = 100.0
        elif r <= 1.00:
            s_efic = 100.0 - 600.0 * (r - 0.95)
        else:
            # Acima do orçamento: decai suavemente a partir de 70.0 para manter informatividade nas barras What-If
            s_efic = max(0.0, 70.0 - 200.0 * (r - 1.00))
        s_conf_custo = 0.60 * s_sucesso + 0.40 * s_efic

        # Score Final Global (Camada 3) — NUNCA zerado para preservar as barras na UI
        score_calculado = (
            w1 * s_tecnico
            + w2 * s_dominio
            + w3 * s_quimica
            + w4 * s_rpg
            + w5 * s_conf_custo
        )

        # 3. Geração de Justificativas Determinísticas por Membro (White-Box AI)
        justificativas_membros: Dict[str, List[str]] = {}
        members_formatted: List[Dict[str, Any]] = []
        members_with_rationale: List[Dict[str, Any]] = []
        dom_label = DOMAIN_CANONICAL_TO_LABEL.get(dom_req, dom_req)

        for p in squad:
            pid = p["id"]
            reasons: List[str] = []
            top_skills = [
                f"{sb['label']} (nv.{p['hard_skills'].get(sb['skill'], 0)}/5)"
                for sb in skill_breakdown
                if sb["top1"][0] == pid or sb["top2"][0] == pid
            ]
            if top_skills:
                reasons.append(f"Referência Técnica em: {', '.join(top_skills[:3])}")
            else:
                reasons.append(f"Suporte técnico na trilha {p['trilha']} ({p['cargo']})")

            if dom_req in p["dominios"]:
                peso_str = " (Peso 2x Liderança)" if p["_rho"] == 2.0 else ""
                reasons.append(f"Domínio comprovado em {dom_label}{peso_str}")

            if p["arquetipo"] == "Facilitador":
                reasons.append("Facilitador: amortece atritos (-70%) e neutraliza choques AM×EP")
            elif p["arquetipo"] in ("Cético Analítico", "Arquiteto Metódico") and (is_ia or is_alta):
                reasons.append(f"Sinergia RPG máxima ({p['arquetipo']}) para IA / Alta Criticidade")
            else:
                reasons.append(f"Perfil RPG {p['arquetipo']}")

            justificativas_membros[pid] = reasons
            p_formatted = format_professional_for_response(p)
            members_formatted.append(p_formatted)
            members_with_rationale.append({
                "professional": p_formatted,
                "justificativa": " · ".join(reasons) + ".",
            })

        sub_indices_dict = {
            "S_Tecnico": {"bruto": round(s_tecnico, 2), "ponderado": round(w1 * s_tecnico, 2)},
            "S_Dominio": {"bruto": round(s_dominio, 2), "ponderado": round(w2 * s_dominio, 2)},
            "S_Quimica": {"bruto": round(s_quimica, 2), "ponderado": round(w3 * s_quimica, 2)},
            "S_RPG": {"bruto": round(s_rpg, 2), "ponderado": round(w4 * s_rpg, 2)},
            "S_Confiabilidade_Custo": {
                "bruto": round(s_conf_custo, 2),
                "ponderado": round(w5 * s_conf_custo, 2),
            },
            "S_Confiab_Custo": {
                "bruto": round(s_conf_custo, 2),
                "ponderado": round(w5 * s_conf_custo, 2),
            },
        }

        ui_metrics = {
            "Competência Técnica": round(s_tecnico, 2),
            "Domínio do Setor": round(s_dominio, 2),
            "Química da Equipe": round(s_quimica, 2),
            "Equilíbrio de Perfis": round(s_rpg, 2),
            "Eficiência de Custo & Entrega": round(s_conf_custo, 2),
        }

        sub_indices_camel = {
            "sTecnico": round(s_tecnico, 2),
            "sDominio": round(s_dominio, 2),
            "sQuimica": round(s_quimica, 2),
            "sRpg": round(s_rpg, 2),
            "sConfiabCusto": round(s_conf_custo, 2),
        }

        weights_camel = {
            "w1": w1,
            "w2": w2,
            "w3": w3,
            "w4": w4,
            "w5": w5,
            "formulaNotes": {
                "baseSource": tipo_sol,
                "urgencyModifier": f"Urgência {urgencia}",
                "regulatoryModifier": (
                    "Shift Protetivo Alta (+0.02 W4, +0.01 W5, -0.03 W3)"
                    if crit_reg == "Alta"
                    else f"Criticidade {crit_reg} (Padrão)"
                ),
            },
        }

        squad_id_str = f"{squad_id_prefix}-{'-'.join(p['id'] for p in squad)}"

        return {
            "id": squad_id_str,
            "member_ids": [p["id"] for p in squad],
            "membros": members_formatted,
            "members": members_formatted,
            "membersWithRationale": members_with_rationale,
            "is_valid": is_valid,
            "isValid": is_valid,
            "has_facilitator": has_facilitador,
            "hasFacilitator": has_facilitador,
            "violations": violations,
            "constraints": {
                "HC1_tamanho": hc1_ok,
                "HC2_orcamento": hc2_ok,
                "HC3_skills": hc3_ok,
                "HC4_proporcao_lideranca": hc4_ok,
                "HC5_atrito_bilateral": hc5_ok,
                "missing_skills": missing_skills,
            },
            "score_final": round(score_calculado, 2),
            "scoreFinal": round(score_calculado, 2),
            "score_final_raw": score_calculado,
            "score_teorico_sem_trava": round(score_calculado, 2),
            "custo_total": round(custo_total, 2),
            "custoHoraTotal": round(custo_total, 2),
            "utilizacao_orcamento_pct": round(r * 100.0, 1),
            "taxa_sucesso_media": round(s_sucesso, 2),
            "taxaSucessoMedia": round(s_sucesso, 2),
            "pesos": {"W1": w1, "W2": w2, "W3": w3, "W4": w4, "W5": w5},
            "weights": weights_camel,
            "sub_indices": sub_indices_dict,
            "subIndices": sub_indices_camel,
            "ui_metrics": ui_metrics,
            "edges": structured_edges,
            "detalhes_calculo": {
                "skill_breakdown": skill_breakdown,
                "arestas_ativas": arestas_ativas,
                "delta_contexto": round(delta_contexto, 2),
                "delta_pares": round(delta_pares, 2),
                "p_desequilibrio": round(p_deseq, 2),
                "s_eficiencia_orcamentaria": round(s_efic, 2),
                "justificativas_membros": justificativas_membros,
                "trilhas_count": {
                    t: exec_count[t] + lider_count[t] + gerente_count[t] for t in TRILHAS
                },
                "arquetipos_count": {
                    ARQ_NAMES[i]: arq_counts[i] for i in range(5) if arq_counts[i] > 0
                },
            },
        }

    # --------------------------------------------------------------------------
    # ETAPA 2: MODO FALLBACK RELAXADO (SOFT CONSTRAINTS < 200 MS)
    # --------------------------------------------------------------------------
    def _recommend_soft_fallback(
        self,
        params: Dict[str, Any],
        top_k: int,
        min_diff_members: int,
        excluded_ids: Set[str],
        locked_ids: Set[str],
    ) -> List[Tuple[float, int, Tuple[str, ...]]]:
        """
        Acionado automaticamente quando nenhuma combinação na base cumpre 100% de HC1..HC5.
        Busca as melhores equipes que maximizam o Score Final e minimizam o déficit de restrições.
        """
        n_min, n_max = params["tamanho_squad"]
        b_max = float(params["orcamento_max_hora"])
        k_req: Dict[str, int] = params["skills_obrigatorias"]
        dom_req = params["dominio_setorial"]
        tipo_sol = params["tipo_solucao"]
        k_sol = PACOTES_SOLUCAO.get(tipo_sol, set())
        s_eval = sorted(set(k_req.keys()) | k_sol)

        pool = [p for p in self.professionals if p["id"] not in excluded_ids]
        if not pool:
            return []

        def individual_rank_score(p: Dict[str, Any]) -> float:
            req_score = sum(
                30.0 * min(1.0, p["hard_skills"].get(sk, 0) / max(1, lvl))
                for sk, lvl in k_req.items()
                if p["hard_skills"].get(sk, 0) > 0
            )
            sol_score = sum(3.0 * p["hard_skills"].get(sk, 0) for sk in s_eval)
            dom_score = 18.0 if dom_req in p["dominios"] else 0.0
            cost_bonus = max(0.0, (250.0 - p["custo_hora_brl"]) * 0.15)
            suc_bonus = p["taxa_sucesso_pct"] * 0.25
            lock_bonus = 1000.0 if p["id"] in locked_ids else 0.0
            return lock_bonus + req_score + sol_score + dom_score + cost_bonus + suc_bonus

        ranked_pool = sorted(pool, key=individual_rank_score, reverse=True)
        cheapest_pool = sorted(pool, key=lambda p: (p["custo_hora_brl"], -p["taxa_sucesso_pct"]))

        # Combina os melhores candidatos técnicos e os mais econômicos em um sub-pool compacto (até 14)
        sub_pool_ids: List[str] = []
        for p in ranked_pool[:10] + cheapest_pool[:8]:
            if p["id"] not in sub_pool_ids:
                sub_pool_ids.append(p["id"])
        sub_pool = [self.prof_by_id[pid] for pid in sub_pool_ids[:13]]

        # Beam Search construtivo rápido (< 15 ms) para tamanhos n_min..n_max
        target_sizes = [n_min] if n_min == n_max else [n_min, min(n_max, n_min + 1)]
        candidates_found: Dict[int, Tuple[float, float, Tuple[str, ...]]] = {}

        for target_n in target_sizes:
            if target_n > len(sub_pool):
                continue
            beam: List[Tuple[float, int, List[Dict[str, Any]]]] = [(0.0, 0, [])]
            for _step in range(target_n):
                next_beam_map: Dict[int, Tuple[float, int, List[Dict[str, Any]]]] = {}
                for _, bmask, curr_list in beam:
                    for cand in sub_pool:
                        c_bit = cand["_bit"]
                        if bmask & c_bit:
                            continue
                        new_mask = bmask | c_bit
                        if new_mask in next_beam_map:
                            continue
                        new_list = curr_list + [cand]
                        custo_parcial = sum(x["custo_hora_brl"] for x in new_list)
                        over_budget_pen = max(0.0, custo_parcial - b_max) * 0.12
                        sk_cov = 0.0
                        for sk, lvl in k_req.items():
                            best_l = max((x["hard_skills"].get(sk, 0) for x in new_list), default=0)
                            sk_cov += 25.0 * min(1.0, best_l / max(1, lvl))
                        dom_cov = sum(8.0 for x in new_list if dom_req in x["dominios"])
                        suc_cov = sum(x["taxa_sucesso_pct"] * 0.15 for x in new_list)
                        h_val = sk_cov + dom_cov + suc_cov - over_budget_pen
                        next_beam_map[new_mask] = (h_val, new_mask, new_list)
                beam = sorted(next_beam_map.values(), key=lambda x: x[0], reverse=True)[:16]

            for _, bmask, sq_list in beam[:16]:
                m_ids = tuple(sorted((x["id"] for x in sq_list), key=lambda x: int(x[1:])))
                ev = self.evaluate_squad_detailed(list(m_ids), params)
                soft_rank_key = ev["score_final_raw"] - 4.0 * len(ev["violations"])
                candidates_found[bmask] = (soft_rank_key, ev["score_final_raw"], m_ids)

        sorted_cands = [
            (real_score, bmask, m_ids)
            for bmask, (soft_key, real_score, m_ids) in sorted(
                candidates_found.items(), key=lambda kv: (kv[1][0], kv[1][1]), reverse=True
            )
        ]
        return _rebuild_diverse_podium(sorted_cands, top_k=top_k, min_diff_members=min_diff_members)

    # --------------------------------------------------------------------------
    # BUSCA COMBINATÓRIA OTIMIZADA (BRANCH-AND-BOUND HIERÁRQUICO + UPPER BOUND)
    # --------------------------------------------------------------------------
    def recommend_top_squads(
        self,
        params: Dict[str, Any],
        top_k: int = 5,
        min_diff_members: int = 2,
        locked_ids: Optional[Set[str]] = None,
        excluded_ids: Optional[Set[str]] = None,
        max_elapsed_sec: float = 0.12,
        max_nodes: int = 35000,
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        locked_ids = set(locked_ids or set())
        excluded_ids = set(excluded_ids or set())

        b_max = float(params["orcamento_max_hora"])
        n_min, n_max = params["tamanho_squad"]
        k_req: Dict[str, int] = params["skills_obrigatorias"]
        crit_reg = params["criticidade_regulatoria"]
        urgencia = params["urgencia_prazo"]
        tipo_sol = params["tipo_solucao"]
        dom_req = params["dominio_setorial"]

        w1, w2, w3, w4, w5 = self.get_dynamic_weights(tipo_sol, urgencia, crit_reg)
        is_ia = (tipo_sol == "Software Preditivo/IA")
        is_alta = (crit_reg == "Alta")

        # 1. Pré-computa LUT O(1) de Sinergia RPG para todos os códigos de arquétipos (n_min..n_max)
        rpg_lut, rpg_partial_max, max_rpg_by_n, rpg_def_by_k, rpg_def_no_am_ca_by_k = self._build_rpg_luts(
            n_min, n_max, urgencia, is_ia, is_alta, w4
        )
        global_max_w4_rpg = max(max_rpg_by_n.values()) if max_rpg_by_n else 0.0

        # 2. Configuração de Pesos e Escalas de Hard Skills (S_Tecnico)
        k_sol = PACOTES_SOLUCAO.get(tipo_sol, set())
        eval_skills = sorted(set(k_req.keys()) | k_sol)
        eval_weights = [2.0 if sk in k_req else 1.0 for sk in eval_skills]
        sum_eval_weights = sum(eval_weights)
        num_eval_skills = len(eval_skills)
        skill_w1_factor = [
            (100.0 * w1 * (w_sk / 5.0)) / sum_eval_weights if sum_eval_weights > 0 else 0.0
            for w_sk in eval_weights
        ]

        # 3. Bitmask de skills obrigatórias (HC3) e detecção de exclusividade por trilha
        req_skills_list = sorted(k_req.keys())
        full_req_mask = (1 << len(req_skills_list)) - 1

        trilha_exclusive_req_mask = [0, 0, 0]
        impossible_req_skill = False
        for bit_i, sk in enumerate(req_skills_list):
            trilhas_com_skill = {
                p["_t_idx"]
                for p in self.professionals
                if p["id"] not in excluded_ids and p["hard_skills"].get(sk, 0) >= k_req[sk]
            }
            if len(trilhas_com_skill) == 0:
                impossible_req_skill = True
            elif len(trilhas_com_skill) == 1:
                only_t = next(iter(trilhas_com_skill))
                trilha_exclusive_req_mask[only_t] |= (1 << bit_i)

        max_possible_dom_den = 2.0 * n_max
        min_dom_miss_pen_unit = (100.0 * w2) / max_possible_dom_den
        min_w5_suc_pen_factor = (0.60 * w5) / n_max

        arq_ctx_val = [0.0] * 5
        for a_i in range(5):
            n_am = 1 if a_i == 0 else 0
            n_ep = 1 if a_i == 1 else 0
            n_ca = 1 if a_i == 3 else 0
            n_bo = 1 if a_i == 4 else 0
            if urgencia == "Crítica":
                mu = 8.0 * n_bo + 6.0 * n_ep - 4.0 * n_am
            elif urgencia == "Baixa":
                mu = -4.0 * n_bo + 3.0 * n_am
            else:
                mu = 0.0
            if is_ia and is_alta:
                ms = 9.0 * n_ca + 8.0 * n_am
            elif is_ia or is_alta:
                ms = 6.0 * n_ca + 5.0 * n_am
            else:
                ms = 0.0
            arq_ctx_val[a_i] = mu + ms
        max_arq_ctx = max(arq_ctx_val)

        # 4. Pré-filtragem e empacotamento numérico dos candidatos
        pool_by_trilha: List[List[Tuple]] = [[], [], []]
        for p in self.professionals:
            if p["id"] in excluded_ids:
                continue
            t_idx = p["_t_idx"]
            r_mask = 0
            for bit_i, sk in enumerate(req_skills_list):
                if p["hard_skills"].get(sk, 0) >= k_req[sk]:
                    r_mask |= (1 << bit_i)

            sk_tuple = tuple(p["hard_skills"].get(sk, 0) for sk in eval_skills)
            sk_pres_mask = 0
            for s_i, lvl in enumerate(sk_tuple):
                if lvl > 0:
                    sk_pres_mask |= (1 << s_i)

            max_tec_add = sum(
                skill_w1_factor[s_i] * (0.70 * sk_tuple[s_i]) for s_i in range(num_eval_skills)
            )
            has_dom = 1 if (dom_req in p["dominios"]) else 0
            rho = p["_rho"]
            dom_num = rho if has_dom else 0.0
            dom_miss = 0.0 if has_dom else rho
            custo = p["custo_hora_brl"]
            suc = p["taxa_sucesso_pct"]
            arq_idx = p["_arq_idx"]
            arq_code = 1 << (3 * arq_idx)
            role_code = 0 if p["_is_exec"] else (1 if p["_is_lider"] else 2)
            is_locked = 1 if (p["id"] in locked_ids) else 0

            suc_deficit = 100.0 - suc
            indiv_potential = (
                max_tec_add
                - min_dom_miss_pen_unit * dom_miss
                - min_w5_suc_pen_factor * suc_deficit
                + (w4 * (5.0 / n_max)) * (arq_ctx_val[arq_idx] - max_arq_ctx)
                + min(w3 * 20.0, w3 * p["_upward_cross_aff"])
            )
            nontec_prof_add = (
                -min_dom_miss_pen_unit * dom_miss
                - min_w5_suc_pen_factor * suc_deficit
                + w3 * (p["_upward_cross_aff"] + p["_intra_aff_pot"])
            )

            cand_tuple = (
                p["_idx"], p["_bit"], custo, r_mask, role_code, dom_num, rho, dom_miss,
                suc, arq_code, sk_tuple, max_tec_add, p["_upward_cross_aff"],
                sk_pres_mask, p["_social_adj_mask"], p["_atr_mask"],
                nontec_prof_add, indiv_potential, is_locked, p["id"],
            )
            pool_by_trilha[t_idx].append(cand_tuple)

        for t_idx in range(3):
            pool_by_trilha[t_idx].sort(
                key=lambda c: (
                    c[18],
                    1 if (c[5] > 0 and c[13] > 0) else 0,
                    1 if c[9] in (1, 1 << 6, 1 << 9) else 0,
                    c[17],
                ),
                reverse=True,
            )

        min_k_trilha = [0, 0, 0]
        for t_idx in range(3):
            n_locked_t = sum(1 for c in pool_by_trilha[t_idx] if c[18] == 1)
            if trilha_exclusive_req_mask[t_idx] != 0:
                min_k_trilha[t_idx] = max(1, n_locked_t)
            else:
                min_k_trilha[t_idx] = n_locked_t

        track_has_eval_skills = [
            any(c[13] != 0 for c in pool_by_trilha[t_idx]) for t_idx in range(3)
        ]
        max_k_trilha = [
            min(
                len(pool_by_trilha[t_idx]),
                max(0, n_max - sum(min_k_trilha) + min_k_trilha[t_idx]),
                4 if track_has_eval_skills[t_idx] else max(1, min_k_trilha[t_idx]),
            )
            for t_idx in range(3)
        ]
        max_cands_by_trilha = [
            9 if track_has_eval_skills[t_idx] else 2 for t_idx in range(3)
        ]

        branches_pruned = 0

        def generate_subsquads_for_trilha(
            t_idx: int,
            k_min_t: int,
            k_max_t: int,
            max_candidates: Optional[int] = None,
            min_ub_required_by_k: Optional[Dict[int, float]] = None,
        ) -> Dict[int, List[Tuple]]:
            nonlocal branches_pruned
            cands = pool_by_trilha[t_idx]
            if max_candidates is not None:
                cands = cands[:max_candidates]
            t_req_mask = trilha_exclusive_req_mask[t_idx]
            locked_cands = [c for c in cands if c[18] == 1]
            free_cands = [c for c in cands if c[18] == 0]
            n_free = len(free_cands)
            n_lock = len(locked_cands)

            suffix_req_or = [0] * (n_free + 1)
            for i in range(n_free - 1, -1, -1):
                suffix_req_or[i] = suffix_req_or[i + 1] | free_cands[i][3]

            suffix_top1 = [[0] * num_eval_skills for _ in range(n_free + 1)]
            suffix_top2 = [[0] * num_eval_skills for _ in range(n_free + 1)]
            for i in range(n_free - 1, -1, -1):
                sk_i = free_cands[i][10]
                st1 = suffix_top1[i + 1]
                st2 = suffix_top2[i + 1]
                nt1 = suffix_top1[i]
                nt2 = suffix_top2[i]
                for s_i in range(num_eval_skills):
                    v = sk_i[s_i]
                    if v > st1[s_i]:
                        nt1[s_i] = v
                        nt2[s_i] = st1[s_i]
                    elif v > st2[s_i]:
                        nt1[s_i] = st1[s_i]
                        nt2[s_i] = v
                    else:
                        nt1[s_i] = st1[s_i]
                        nt2[s_i] = st2[s_i]

            suffix_tec_changed = [True] * (n_free + 1)
            for i in range(1, n_free + 1):
                if suffix_top1[i] == suffix_top1[i - 1] and suffix_top2[i] == suffix_top2[i - 1]:
                    suffix_tec_changed[i] = False

            am_ca_codes = (1, 1 << 9)
            suffix_has_am_ca = [False] * (n_free + 1)
            for i in range(n_free - 1, -1, -1):
                suffix_has_am_ca[i] = suffix_has_am_ca[i + 1] or (free_cands[i][9] in am_ca_codes)

            free_costs_sorted = sorted(c[2] for c in free_cands)
            prefix_min_cost = [0.0] * (n_free + 1)
            for i in range(n_free):
                prefix_min_cost[i + 1] = prefix_min_cost[i] + free_costs_sorted[i]

            suffix_nontec_prefix: List[List[float]] = []
            for start_i in range(n_free + 1):
                vals = sorted((c[16] for c in free_cands[start_i:]), reverse=True)
                pref = [0.0] * (len(vals) + 1)
                for j_idx, v in enumerate(vals):
                    pref[j_idx + 1] = pref[j_idx] + v
                suffix_nontec_prefix.append(pref)

            result_by_k: Dict[int, List[Tuple]] = {k: [] for k in range(n_max + 1)}
            zero_t = tuple([0] * num_eval_skills)

            for k in range(max(k_min_t, n_lock), min(k_max_t, n_lock + n_free) + 1):
                if k == 0:
                    if t_req_mask == 0:
                        result_by_k[0].append((
                            0.0, 0.0, 0, 0, False, 0.0, 0.0,
                            0.0, 0.0, 0, zero_t, zero_t, 0.0,
                            0.0, 0, 0.0, (), 0, 0,
                        ))
                    continue

                need = k - n_lock
                min_ub_k = min_ub_required_by_k.get(k, -1e9) if min_ub_required_by_k else -1e9
                max_lid_allowed = k // 4
                max_ger_allowed = max(0, k - 2)

                init_cost = sum(c[2] for c in locked_cands)
                if init_cost + prefix_min_cost[need] > b_max:
                    branches_pruned += 1
                    continue

                out_list = result_by_k[k]
                rpg_def_for_k = rpg_def_by_k[k]
                rpg_def_no_am_ca_k = rpg_def_no_am_ca_by_k[k]
                chosen = list(locked_cands)

                def dfs(
                    start_idx: int,
                    rem: int,
                    cost_acc: float,
                    req_acc: int,
                    bmask_acc: int,
                    n_exec: int,
                    n_lid: int,
                    n_ger: int,
                    dom_num_acc: float,
                    dom_den_acc: float,
                    dom_miss_acc: float,
                    suc_acc: float,
                    arq_code_acc: int,
                    t1_acc: Tuple[int, ...],
                    t2_acc: Tuple[int, ...],
                    tec_val_acc: float,
                    intra_aff_acc: float,
                    intra_c_dir_acc: int,
                    upward_aff_acc: float,
                    sk_pres_acc: int,
                    soc_adj_acc: int,
                ) -> None:
                    nonlocal branches_pruned
                    if rem == 0:
                        if (req_acc & t_req_mask) != t_req_mask:
                            return
                        if (n_lid + n_ger) > 0 and n_exec < 2:
                            return
                        if n_lid > (n_exec // 3):
                            return

                        chem_ub_t = w3 * max(0.0, intra_aff_acc - 6.0 * intra_c_dir_acc + upward_aff_acc)
                        suc_def_acc = k * 100.0 - suc_acc
                        ub_contrib = (
                            tec_val_acc
                            - min_dom_miss_pen_unit * dom_miss_acc
                            - min_w5_suc_pen_factor * suc_def_acc
                            + chem_ub_t
                        )
                        if ub_contrib + rpg_def_for_k.get(arq_code_acc, 0.0) < min_ub_k:
                            branches_pruned += 1
                            return

                        out_list.append((
                            ub_contrib,
                            cost_acc,
                            req_acc,
                            bmask_acc,
                            n_ger > 0,
                            dom_num_acc,
                            dom_den_acc,
                            dom_miss_acc,
                            suc_acc,
                            arq_code_acc,
                            t1_acc,
                            t2_acc,
                            tec_val_acc,
                            intra_aff_acc,
                            intra_c_dir_acc,
                            upward_aff_acc,
                            tuple(chosen),
                            sk_pres_acc,
                            soc_adj_acc,
                        ))
                        return

                    if n_free - start_idx < rem:
                        return
                    if (n_lid + n_ger) > 0 and (n_exec + rem) < 2:
                        branches_pruned += 1
                        return
                    if n_lid > ((n_exec + rem) // 3):
                        branches_pruned += 1
                        return

                    curr_suc_def = (k - rem) * 100.0 - suc_acc
                    curr_nontec = (
                        -min_dom_miss_pen_unit * dom_miss_acc
                        - min_w5_suc_pen_factor * curr_suc_def
                        + w3 * max(0.0, intra_aff_acc - 6.0 * intra_c_dir_acc + upward_aff_acc)
                    )
                    max_final_tec = tec_val_acc

                    limit_idx = n_free - rem + 1
                    for i in range(start_idx, limit_idx):
                        if ((req_acc | suffix_req_or[i]) & t_req_mask) != t_req_mask:
                            branches_pruned += (limit_idx - i)
                            break

                        c = free_cands[i]

                        if min_ub_k > -1e8:
                            if i == start_idx or suffix_tec_changed[i]:
                                st1 = suffix_top1[i]
                                if st1 == zero_t:
                                    max_final_tec = tec_val_acc
                                else:
                                    st2 = suffix_top2[i] if rem >= 2 else zero_t
                                    max_final_tec = 0.0
                                    for s_i in range(num_eval_skills):
                                        a1, a2 = t1_acc[s_i], t2_acc[s_i]
                                        b1, b2 = st1[s_i], st2[s_i]
                                        if b1 > a1:
                                            v1 = b1
                                            v2 = a1 if a1 > b2 else b2
                                        else:
                                            v1 = a1
                                            v2 = b1 if b1 > a2 else a2
                                        max_final_tec += skill_w1_factor[s_i] * (0.70 * v1 + 0.30 * v2)

                            rpg_def_bound = (
                                rpg_def_for_k[arq_code_acc]
                                if suffix_has_am_ca[i]
                                else rpg_def_no_am_ca_k[arq_code_acc]
                            )
                            if max_final_tec + curr_nontec + suffix_nontec_prefix[i][rem] + rpg_def_bound < min_ub_k:
                                branches_pruned += (limit_idx - i)
                                break

                            arq_after_c = arq_code_acc + c[9]
                            rpg_def_next = (
                                rpg_def_for_k[arq_after_c]
                                if suffix_has_am_ca[i + 1]
                                else rpg_def_no_am_ca_k[arq_after_c]
                            )
                            if max_final_tec + curr_nontec + c[16] + suffix_nontec_prefix[i + 1][rem - 1] + rpg_def_next < min_ub_k:
                                branches_pruned += 1
                                continue

                        new_cost = cost_acc + c[2]
                        if new_cost + prefix_min_cost[rem - 1] > b_max:
                            branches_pruned += 1
                            continue

                        rc = c[4]
                        ne = n_exec + (1 if rc == 0 else 0)
                        nl = n_lid + (1 if rc == 1 else 0)
                        ng = n_ger + (1 if rc == 2 else 0)
                        if nl > max_lid_allowed or ng > max_ger_allowed:
                            branches_pruned += 1
                            continue
                        if (nl + ng) > 0 and (ne + rem - 1) < 2:
                            branches_pruned += 1
                            continue

                        c_sk_pres = c[13]
                        if c_sk_pres == 0:
                            new_t1 = t1_acc
                            new_t2 = t2_acc
                            new_tec_val = tec_val_acc
                        elif sk_pres_acc == 0:
                            c_sk = c[10]
                            new_t1 = c_sk
                            new_t2 = zero_t
                            new_tec_val = 0.0
                            for s_i in range(num_eval_skills):
                                new_tec_val += skill_w1_factor[s_i] * (0.70 * c_sk[s_i])
                        else:
                            c_sk = c[10]
                            nt1 = list(t1_acc)
                            nt2 = list(t2_acc)
                            new_tec_val = 0.0
                            for s_i in range(num_eval_skills):
                                v = c_sk[s_i]
                                if v > nt1[s_i]:
                                    nt2[s_i] = nt1[s_i]
                                    nt1[s_i] = v
                                elif v > nt2[s_i]:
                                    nt2[s_i] = v
                                new_tec_val += skill_w1_factor[s_i] * (0.70 * nt1[s_i] + 0.30 * nt2[s_i])
                            new_t1 = tuple(nt1)
                            new_t2 = tuple(nt2)

                        c_soc_adj = c[14]
                        add_aff = 0.0
                        add_c_dir = 0
                        if c_soc_adj & bmask_acc:
                            c_idx = c[0]
                            aff_row = self.aff_pair_pts[c_idx]
                            atr_row = self.atr_pair_cnt[c_idx]
                            for prev_c in chosen:
                                p_idx = prev_c[0]
                                add_aff += aff_row[p_idx]
                                add_c_dir += atr_row[p_idx]

                        chosen.append(c)
                        dfs(
                            i + 1,
                            rem - 1,
                            new_cost,
                            req_acc | c[3],
                            bmask_acc | c[1],
                            ne,
                            nl,
                            ng,
                            dom_num_acc + c[5],
                            dom_den_acc + c[6],
                            dom_miss_acc + c[7],
                            suc_acc + c[8],
                            arq_code_acc + c[9],
                            new_t1,
                            new_t2,
                            new_tec_val,
                            intra_aff_acc + add_aff,
                            intra_c_dir_acc + add_c_dir,
                            upward_aff_acc + c[12],
                            sk_pres_acc | c_sk_pres,
                            soc_adj_acc | c_soc_adj,
                        )
                        chosen.pop()

                init_req = 0
                init_bmask = 0
                init_ne = init_nl = init_ng = 0
                init_dnum = init_dden = init_dmiss = init_suc = 0.0
                init_arq = 0
                init_t1 = [0] * num_eval_skills
                init_t2 = [0] * num_eval_skills
                init_aff = 0.0
                init_cdir = 0
                init_up_aff = 0.0
                init_sk_pres = 0
                init_soc_adj = 0
                for idx_l, c in enumerate(locked_cands):
                    init_req |= c[3]
                    init_bmask |= c[1]
                    rc = c[4]
                    if rc == 0:
                        init_ne += 1
                    elif rc == 1:
                        init_nl += 1
                    else:
                        init_ng += 1
                    init_dnum += c[5]
                    init_dden += c[6]
                    init_dmiss += c[7]
                    init_suc += c[8]
                    init_arq += c[9]
                    init_sk_pres |= c[13]
                    init_soc_adj |= c[14]
                    for s_i in range(num_eval_skills):
                        v = c[10][s_i]
                        if v > init_t1[s_i]:
                            init_t2[s_i] = init_t1[s_i]
                            init_t1[s_i] = v
                        elif v > init_t2[s_i]:
                            init_t2[s_i] = v
                    init_up_aff += c[12]
                    for prev_c in locked_cands[:idx_l]:
                        init_aff += self.aff_pair_pts[c[0]][prev_c[0]]
                        init_cdir += self.atr_pair_cnt[c[0]][prev_c[0]]

                init_tec = sum(
                    skill_w1_factor[s_i] * (0.70 * init_t1[s_i] + 0.30 * init_t2[s_i])
                    for s_i in range(num_eval_skills)
                )

                dfs(
                    0, need, init_cost, init_req, init_bmask,
                    init_ne, init_nl, init_ng, init_dnum, init_dden, init_dmiss,
                    init_suc, init_arq, tuple(init_t1), tuple(init_t2),
                    init_tec, init_aff, init_cdir, init_up_aff,
                    init_sk_pres, init_soc_adj,
                )
                out_list.sort(key=lambda x: x[0], reverse=True)

            return result_by_k

        # Heap âncora (top_k_anchor = top_k) idêntico ao motor matemático CITi.md para poda exata (< 25 ms)
        top_k_anchor = top_k
        anchor_min_heap: List[Tuple[float, int, Tuple[str, ...]]] = []
        all_valid_found: List[Tuple[float, int, Tuple[str, ...]]] = []
        seen_bmasks: Set[int] = set()
        valid_evaluated = 0
        nodes_visited = 0
        anytime_cutoff_triggered = False

        def get_prune_thresh() -> Optional[float]:
            if len(anchor_min_heap) >= top_k_anchor:
                return anchor_min_heap[0][0]
            return None

        def register_valid_candidate(
            score_final: float, squad_bmask: int, member_ids_tuple: Tuple[str, ...]
        ) -> None:
            if squad_bmask in seen_bmasks:
                return
            seen_bmasks.add(squad_bmask)
            item = (score_final, squad_bmask, member_ids_tuple)
            all_valid_found.append(item)
            if len(anchor_min_heap) < top_k_anchor:
                heapq.heappush(anchor_min_heap, item)
            elif score_final > anchor_min_heap[0][0]:
                heapq.heapreplace(anchor_min_heap, item)

        def search_combinations(subs_by_t: List[Dict[int, List[Tuple]]]) -> None:
            nonlocal valid_evaluated, nodes_visited, branches_pruned, anytime_cutoff_triggered
            base_ub_const_global = 100.0 * w2 + 60.0 * w3 + 100.0 * w5

            min_cost_t_k = [
                {k: min((s[1] for s in subs_by_t[ti][k]), default=1e9) for k in range(n_max + 1)}
                for ti in range(3)
            ]

            for n_total in range(n_min, n_max + 1):
                if anytime_cutoff_triggered:
                    break
                gerentes_permitidos = (n_total >= 6) or is_alta
                rpg_lut_n = rpg_lut[n_total]
                rpg_part_n = rpg_partial_max[n_total]
                max_rpg_n = max_rpg_by_n[n_total]
                base_ub_n = base_ub_const_global + max_rpg_n
                w5_suc_mult = (0.60 * w5) / n_total

                for n_eng in range(min_k_trilha[0], min(max_k_trilha[0], n_total) + 1):
                    if anytime_cutoff_triggered:
                        break
                    list_eng = subs_by_t[0][n_eng]
                    if not list_eng:
                        continue

                    for n_dad in range(min_k_trilha[1], min(max_k_trilha[1], n_total - n_eng) + 1):
                        if anytime_cutoff_triggered:
                            break
                        n_prod = n_total - n_eng - n_dad
                        if n_prod < min_k_trilha[2] or n_prod > max_k_trilha[2]:
                            continue
                        list_dad = subs_by_t[1][n_dad]
                        list_prod = subs_by_t[2][n_prod]
                        if not list_dad or not list_prod:
                            continue

                        max_ub_dad = list_dad[0][0]
                        max_ub_prod = list_prod[0][0]
                        min_cost_dad = min_cost_t_k[1][n_dad]
                        min_cost_prod = min_cost_t_k[2][n_prod]

                        for idx_eng, s_eng in enumerate(list_eng):
                            if anytime_cutoff_triggered:
                                break
                            p_thresh = get_prune_thresh()
                            if p_thresh is not None:
                                if s_eng[0] + max_ub_dad + max_ub_prod + base_ub_n <= p_thresh + 1e-9:
                                    branches_pruned += (len(list_eng) - idx_eng)
                                    break

                            if not gerentes_permitidos and s_eng[4]:
                                branches_pruned += 1
                                continue
                            c_eng = s_eng[1]
                            if c_eng + min_cost_dad + min_cost_prod > b_max:
                                branches_pruned += 1
                                continue

                            arq_eng = s_eng[9]
                            if p_thresh is not None:
                                if (
                                    s_eng[0]
                                    + max_ub_dad
                                    + max_ub_prod
                                    + base_ub_const_global
                                    + rpg_part_n[arq_eng]
                                    <= p_thresh + 1e-9
                                ):
                                    branches_pruned += 1
                                    continue

                            rmask_eng = s_eng[2]
                            bmask_eng = s_eng[3]
                            dnum_eng = s_eng[5]
                            dden_eng = s_eng[6]
                            suc_eng = s_eng[8]
                            t1_eng = s_eng[10]
                            t2_eng = s_eng[11]
                            tec_eng = s_eng[12]
                            aff_eng = s_eng[13]
                            cdir_eng = s_eng[14]
                            cands_eng = s_eng[16]
                            sk_pres_eng = s_eng[17]
                            soc_adj_eng = s_eng[18]

                            for idx_dad, s_dad in enumerate(list_dad):
                                if anytime_cutoff_triggered:
                                    break
                                p_thresh = get_prune_thresh()
                                if p_thresh is not None:
                                    if s_eng[0] + s_dad[0] + max_ub_prod + base_ub_n <= p_thresh + 1e-9:
                                        branches_pruned += (len(list_dad) - idx_dad)
                                        break

                                if not gerentes_permitidos and s_dad[4]:
                                    branches_pruned += 1
                                    continue
                                c_ed = c_eng + s_dad[1]
                                if c_ed + min_cost_prod > b_max:
                                    branches_pruned += 1
                                    continue

                                arq_ed = arq_eng + s_dad[9]
                                if p_thresh is not None:
                                    if (
                                        s_eng[0]
                                        + s_dad[0]
                                        + max_ub_prod
                                        + base_ub_const_global
                                        + rpg_part_n[arq_ed]
                                        <= p_thresh + 1e-9
                                    ):
                                        branches_pruned += 1
                                        continue

                                rmask_ed = rmask_eng | s_dad[2]
                                if n_prod == 0 and (rmask_ed & full_req_mask) != full_req_mask:
                                    branches_pruned += 1
                                    continue

                                bmask_ed = bmask_eng | s_dad[3]
                                dnum_ed = dnum_eng + s_dad[5]
                                dden_ed = dden_eng + s_dad[6]
                                suc_ed = suc_eng + s_dad[8]

                                sk_pres_dad = s_dad[17]
                                if (sk_pres_eng & sk_pres_dad) == 0:
                                    w1_s_tec_ed = tec_eng + s_dad[12]
                                    t1_ed = None
                                    t2_ed = None
                                else:
                                    t1_dad = s_dad[10]
                                    t2_dad = s_dad[11]
                                    t1_ed_list = [0] * num_eval_skills
                                    t2_ed_list = [0] * num_eval_skills
                                    w1_s_tec_ed = 0.0
                                    for s_i in range(num_eval_skills):
                                        a1, a2 = t1_eng[s_i], t2_eng[s_i]
                                        b1, b2 = t1_dad[s_i], t2_dad[s_i]
                                        if b1 > a1:
                                            v1 = b1
                                            v2 = a1 if a1 > b2 else b2
                                        else:
                                            v1 = a1
                                            v2 = b1 if b1 > a2 else a2
                                        t1_ed_list[s_i] = v1
                                        t2_ed_list[s_i] = v2
                                        w1_s_tec_ed += skill_w1_factor[s_i] * (0.70 * v1 + 0.30 * v2)
                                    t1_ed = tuple(t1_ed_list)
                                    t2_ed = tuple(t2_ed_list)

                                cross_aff_ed = 0.0
                                cross_cdir_ed = 0
                                if soc_adj_eng & s_dad[3]:
                                    cands_dad = s_dad[16]
                                    for ce in cands_eng:
                                        if ce[14] & s_dad[3]:
                                            ce_idx = ce[0]
                                            aff_r = self.aff_pair_pts[ce_idx]
                                            atr_r = self.atr_pair_cnt[ce_idx]
                                            for cd in cands_dad:
                                                cd_idx = cd[0]
                                                cross_aff_ed += aff_r[cd_idx]
                                                cross_cdir_ed += atr_r[cd_idx]

                                aff_ed = aff_eng + s_dad[13] + cross_aff_ed
                                cdir_ed = cdir_eng + s_dad[14] + cross_cdir_ed
                                sk_pres_ed = sk_pres_eng | sk_pres_dad
                                soc_adj_ed = soc_adj_eng | s_dad[18]

                                for idx_prod, s_prod in enumerate(list_prod):
                                    # EARLY BREAK NÍVEL 3 (Produto & Design)
                                    p_thresh = get_prune_thresh()
                                    if p_thresh is not None:
                                        if s_eng[0] + s_dad[0] + s_prod[0] + base_ub_n <= p_thresh + 1e-9:
                                            branches_pruned += (len(list_prod) - idx_prod)
                                            break

                                    if not gerentes_permitidos and s_prod[4]:
                                        branches_pruned += 1
                                        continue
                                    custo_total = c_ed + s_prod[1]
                                    if custo_total > b_max:
                                        branches_pruned += 1
                                        continue

                                    if ((rmask_ed | s_prod[2]) & full_req_mask) != full_req_mask:
                                        branches_pruned += 1
                                        continue

                                    squad_bitmask = bmask_ed | s_prod[3]
                                    total_arq_code = arq_ed + s_prod[9]
                                    has_fa = ((total_arq_code >> 6) & 7) > 0

                                    if not has_fa and self.bilateral_friction_masks:
                                        if any(
                                            (squad_bitmask & m) == m
                                            for m in self.bilateral_friction_masks
                                        ):
                                            branches_pruned += 1
                                            continue

                                    valid_evaluated += 1

                                    # 1. W2 * S_Dominio
                                    w2_s_dom = (100.0 * w2) * ((dnum_ed + s_prod[5]) / (dden_ed + s_prod[6]))

                                    # 2. W5 * S_Confiabilidade_Custo
                                    w5_s_suc = w5_suc_mult * (suc_ed + s_prod[8])
                                    r = custo_total / b_max
                                    if r < 0.50:
                                        s_efic = 100.0 * r
                                    elif r < 0.80:
                                        s_efic = 50.0 + 166.67 * (r - 0.50)
                                    elif r <= 0.95:
                                        s_efic = 100.0
                                    else:
                                        s_efic = 100.0 - 600.0 * (r - 0.95)
                                    w5_s_conf = w5_s_suc + (0.40 * w5) * s_efic

                                    # 3. W4 * S_RPG (Lookup O(1))
                                    w4_s_rpg = rpg_lut_n[total_arq_code]

                                    # 4. W1 * S_Tecnico
                                    if n_prod == 0 or (sk_pres_ed & s_prod[17]) == 0:
                                        w1_s_tec = w1_s_tec_ed + (s_prod[12] if n_prod > 0 else 0.0)
                                    else:
                                        if t1_ed is None:
                                            t1_dad = s_dad[10]
                                            t2_dad = s_dad[11]
                                            t1_ed = tuple(
                                                t1_eng[i] if t1_eng[i] > 0 else t1_dad[i]
                                                for i in range(num_eval_skills)
                                            )
                                            t2_ed = tuple(
                                                t2_eng[i] if t1_eng[i] > 0 else t2_dad[i]
                                                for i in range(num_eval_skills)
                                            )
                                        t1_prod = s_prod[10]
                                        t2_prod = s_prod[11]
                                        w1_s_tec = 0.0
                                        for s_i in range(num_eval_skills):
                                            a1, a2 = t1_ed[s_i], t2_ed[s_i]
                                            c1, c2 = t1_prod[s_i], t2_prod[s_i]
                                            if c1 > a1:
                                                v1 = c1
                                                v2 = a1 if a1 > c2 else c2
                                            else:
                                                v1 = a1
                                                v2 = c1 if c1 > a2 else a2
                                            w1_s_tec += skill_w1_factor[s_i] * (0.70 * v1 + 0.30 * v2)

                                    partial_4 = w1_s_tec + w2_s_dom + w4_s_rpg + w5_s_conf
                                    if p_thresh is not None and partial_4 + w3 * 100.0 <= p_thresh + 1e-9:
                                        branches_pruned += 1
                                        continue

                                    # 5. W3 * S_Quimica
                                    if n_prod == 0 or (soc_adj_ed & s_prod[3]) == 0:
                                        total_aff = aff_ed + (s_prod[13] if n_prod > 0 else 0.0)
                                        total_cdir = cdir_ed + (s_prod[14] if n_prod > 0 else 0)
                                    else:
                                        cands_prod = s_prod[16]
                                        cands_dad = s_dad[16]
                                        cross_aff_p = 0.0
                                        cross_cdir_p = 0
                                        for cp in cands_prod:
                                            if cp[14] & bmask_ed:
                                                cp_idx = cp[0]
                                                aff_r = self.aff_pair_pts[cp_idx]
                                                atr_r = self.atr_pair_cnt[cp_idx]
                                                for ce in cands_eng:
                                                    ce_idx = ce[0]
                                                    cross_aff_p += aff_r[ce_idx]
                                                    cross_cdir_p += atr_r[ce_idx]
                                                for cd in cands_dad:
                                                    cd_idx = cd[0]
                                                    cross_aff_p += aff_r[cd_idx]
                                                    cross_cdir_p += atr_r[cd_idx]
                                        total_aff = aff_ed + s_prod[13] + cross_aff_p
                                        total_cdir = cdir_ed + s_prod[14] + cross_cdir_p

                                    gamma_fac = 0.30 if has_fa else 1.00
                                    s_quimica = max(
                                        0.0, min(100.0, 60.0 + total_aff - 20.0 * gamma_fac * total_cdir)
                                    )
                                    w3_s_quim = w3 * s_quimica
                                    score_final = partial_4 + w3_s_quim

                                    all_cands = cands_eng + s_dad[16] + (s_prod[16] if n_prod > 0 else ())
                                    member_ids_tuple = tuple(
                                        sorted((c[19] for c in all_cands), key=lambda x: int(x[1:]))
                                    )
                                    register_valid_candidate(
                                        score_final, squad_bitmask, member_ids_tuple
                                    )

        all_cheapest_costs = sorted(
            p["custo_hora_brl"] for p in self.professionals if p["id"] not in excluded_ids
        )
        min_possible_cost_n_min = (
            sum(all_cheapest_costs[:n_min]) if len(all_cheapest_costs) >= n_min else 1e9
        )

        if (
            not impossible_req_skill
            and sum(min_k_trilha) <= n_max
            and min_possible_cost_n_min <= b_max
        ):
            # ESTÁGIO 1 (WARM-START SEED): Busca rápida nos Top-5 candidatos de cada trilha (< 0.5 ms)
            seed_subs = [
                generate_subsquads_for_trilha(
                    t_idx,
                    min_k_trilha[t_idx],
                    max_k_trilha[t_idx],
                    max_candidates=min(5, max_cands_by_trilha[t_idx]),
                )
                for t_idx in range(3)
            ]
            search_combinations(seed_subs)

            # Limite superior analítico inicial por trilha e tamanho k
            base_ub_max = 100.0 * w2 + 60.0 * w3 + 100.0 * w5 + global_max_w4_rpg
            max_possible_track_ub: List[Dict[int, float]] = [{}, {}, {}]
            for t_idx in range(3):
                cands = pool_by_trilha[t_idx][: max_cands_by_trilha[t_idx]]
                nontec_sorted = sorted((c[16] for c in cands), reverse=True)
                tr_t1 = [0] * num_eval_skills
                tr_t2 = [0] * num_eval_skills
                for c in cands:
                    for s_i in range(num_eval_skills):
                        v = c[10][s_i]
                        if v > tr_t1[s_i]:
                            tr_t2[s_i] = tr_t1[s_i]
                            tr_t1[s_i] = v
                        elif v > tr_t2[s_i]:
                            tr_t2[s_i] = v
                max_tec_k1 = sum(
                    skill_w1_factor[s_i] * (0.70 * tr_t1[s_i]) for s_i in range(num_eval_skills)
                )
                max_tec_k2 = sum(
                    skill_w1_factor[s_i] * (0.70 * tr_t1[s_i] + 0.30 * tr_t2[s_i])
                    for s_i in range(num_eval_skills)
                )

                for k in range(n_max + 1):
                    if k == 0:
                        max_possible_track_ub[t_idx][0] = 0.0
                    elif k <= len(cands):
                        t_bound = max_tec_k1 if k == 1 else max_tec_k2
                        max_possible_track_ub[t_idx][k] = t_bound + sum(nontec_sorted[:k])
                    else:
                        max_possible_track_ub[t_idx][k] = -1e9

            # ESTÁGIO 2 & 3 (EXACT BRANCH-AND-BOUND COM PODA POR UPPER BOUND NOS TOP-10 POR TRILHA)
            trilhas_order = sorted(range(3), key=lambda ti: len(pool_by_trilha[ti]))
            full_subs: List[Dict[int, List[Tuple]]] = [{}, {}, {}]

            for t_idx in trilhas_order:
                min_ub_t: Dict[int, float] = {}
                p_thresh = get_prune_thresh()
                if p_thresh is not None:
                    other_t1 = (t_idx + 1) % 3
                    other_t2 = (t_idx + 2) % 3
                    for k in range(min_k_trilha[t_idx], max_k_trilha[t_idx] + 1):
                        best_others = -1e9
                        for n_tot in range(max(n_min, k), n_max + 1):
                            rem_n = n_tot - k
                            for k1 in range(
                                min_k_trilha[other_t1], min(max_k_trilha[other_t1], rem_n) + 1
                            ):
                                k2 = rem_n - k1
                                if min_k_trilha[other_t2] <= k2 <= max_k_trilha[other_t2]:
                                    u1 = max_possible_track_ub[other_t1].get(k1, -1e9)
                                    u2 = max_possible_track_ub[other_t2].get(k2, -1e9)
                                    if u1 > -1e8 and u2 > -1e8:
                                        val = u1 + u2 + (max_rpg_by_n[n_tot] - global_max_w4_rpg)
                                        if val > best_others:
                                            best_others = val
                        if best_others > -1e8:
                            min_ub_t[k] = p_thresh - base_ub_max - best_others + 1e-9
                        else:
                            min_ub_t[k] = 1e9

                subs_t = generate_subsquads_for_trilha(
                    t_idx,
                    min_k_trilha[t_idx],
                    max_k_trilha[t_idx],
                    max_candidates=max_cands_by_trilha[t_idx],
                    min_ub_required_by_k=min_ub_t,
                )
                full_subs[t_idx] = subs_t
                for k in range(n_max + 1):
                    if subs_t.get(k):
                        max_possible_track_ub[t_idx][k] = subs_t[k][0][0]
                    else:
                        max_possible_track_ub[t_idx][k] = -1e9

            search_combinations(full_subs)

        sorted_all_cands = sorted(all_valid_found, key=lambda x: x[0], reverse=True)
        diverse_podium = _rebuild_diverse_podium(
            sorted_all_cands, top_k=top_k, min_diff_members=min_diff_members
        )
        if len(diverse_podium) < top_k and len(sorted_all_cands) > len(diverse_podium):
            picked_bmasks = {x[1] for x in diverse_podium}
            for item in sorted_all_cands:
                if item[1] not in picked_bmasks:
                    diverse_podium.append(item)
                    picked_bmasks.add(item[1])
                    if len(diverse_podium) == top_k:
                        break

        # Verifica se a Etapa 1 encontrou soluções válidas; caso contrário, aciona Etapa 2 (Fallback Relaxado)
        is_feasible = len(diverse_podium) > 0
        fallback_warning: Optional[str] = None

        if is_feasible:
            top_winners = diverse_podium
        else:
            top_winners = self._recommend_soft_fallback(
                params=params,
                top_k=top_k,
                min_diff_members=min_diff_members,
                excluded_ids=excluded_ids,
                locked_ids=locked_ids,
            )
            fallback_warning = (
                "Nenhuma combinação cumpriu simultaneamente 100% das Hard Constraints (HC1..HC5). "
                "Modo Fallback Relaxado (Soft Constraints) ativado automaticamente com os 5 squads "
                "de maior Score Final e menor desvio das restrições."
            )

        enriched_top_squads = []
        best_score = top_winners[0][0] if top_winners else 0.0
        for rank_idx, (_, _, m_ids) in enumerate(top_winners, start=1):
            detailed = self.evaluate_squad_detailed(
                list(m_ids), params, squad_id_prefix=f"rank-{rank_idx}"
            )
            detailed["rank"] = rank_idx
            detailed["label_rank"] = "1º Campeão" if rank_idx == 1 else f"{rank_idx}º"
            detailed["delta_para_lider"] = round(detailed["score_final_raw"] - best_score, 2)
            detailed["is_fallback"] = not is_feasible
            enriched_top_squads.append(detailed)

        n_pool_active = sum(len(pool_by_trilha[ti]) for ti in range(3))
        total_comb_space = sum(
            math.comb(n_pool_active, k)
            for k in range(n_min, min(n_max, n_pool_active) + 1)
        )

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        telemetry = {
            "totalCombinationsSpace": total_comb_space,
            "combinationsEvaluated": valid_evaluated,
            "branchesPruned": branches_pruned,
            "validFound": valid_evaluated if is_feasible else 0,
            "anytimeCutoffTriggered": anytime_cutoff_triggered,
            "executionTimeMs": round(elapsed_ms, 2),
        }

        return {
            "is_feasible": is_feasible,
            "isFeasible": is_feasible,
            "fallback_mode": not is_feasible,
            "fallback_warning": fallback_warning,
            "execution_time_ms": round(elapsed_ms, 2),
            "valid_combinations_evaluated": valid_evaluated,
            "min_diff_members_applied": min_diff_members,
            "weights_applied": {"W1": w1, "W2": w2, "W3": w3, "W4": w4, "W5": w5},
            "telemetry": telemetry,
            "top_squads": enriched_top_squads,
            "topSquads": enriched_top_squads,
        }

    # --------------------------------------------------------------------------
    # ENDPOINT DE SIMULAÇÃO "WHAT-IF" (TROCA MANUAL OU DINÂMICA < 5 MS)
    # --------------------------------------------------------------------------
    def simulate_what_if(
        self,
        squad_proposto_ids: List[str],
        squad_referencia_ids: Optional[List[str]],
        params: Dict[str, Any],
    ) -> Dict[str, Any]:
        t0 = time.perf_counter()
        ref_ids = squad_referencia_ids if squad_referencia_ids else squad_proposto_ids

        eval_prop = self.evaluate_squad_detailed(
            squad_proposto_ids, params, squad_id_prefix="sim-proposto"
        )
        eval_ref = self.evaluate_squad_detailed(
            ref_ids, params, squad_id_prefix="sim-referencia"
        )

        set_prop = set(eval_prop["member_ids"])
        set_ref = set(eval_ref["member_ids"])
        adicionados = sorted(set_prop - set_ref, key=lambda x: int(x[1:]))
        removidos = sorted(set_ref - set_prop, key=lambda x: int(x[1:]))

        deltas_ponderados = {}
        deltas_brutos = {}
        for k in ("S_Tecnico", "S_Dominio", "S_Quimica", "S_RPG", "S_Confiabilidade_Custo"):
            deltas_ponderados[k] = round(
                eval_prop["sub_indices"][k]["ponderado"] - eval_ref["sub_indices"][k]["ponderado"],
                2,
            )
            deltas_brutos[k] = round(
                eval_prop["sub_indices"][k]["bruto"] - eval_ref["sub_indices"][k]["bruto"],
                2,
            )

        deltas_ui_metrics = {
            ui_k: round(eval_prop["ui_metrics"][ui_k] - eval_ref["ui_metrics"][ui_k], 2)
            for ui_k in eval_prop["ui_metrics"]
        }

        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        return {
            "execution_time_ms": round(elapsed_ms, 3),
            "is_valid": eval_prop["is_valid"],
            "isValid": eval_prop["is_valid"],
            "violations": eval_prop["violations"],
            "adicionados": adicionados,
            "removidos": removidos,
            "delta_score_final": round(eval_prop["score_final"] - eval_ref["score_final"], 2),
            "delta_custo_hora": round(eval_prop["custo_total"] - eval_ref["custo_total"], 2),
            "deltas_sub_indices_ponderados": deltas_ponderados,
            "deltas_sub_indices_brutos": deltas_brutos,
            "deltas_ui_metrics": deltas_ui_metrics,
            "proposto": eval_prop,
            "referencia": eval_ref,
            "evaluation": eval_prop,
        }
