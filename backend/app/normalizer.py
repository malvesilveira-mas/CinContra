"""
Normalização bidirecional entre rótulos da interface (`cincontra_front`)
e códigos canônicos da base `squad_rpg_60.csv` e `matriz-decisao.md`.
"""

import unicodedata
from typing import Any, Dict, List, Tuple


def _strip_accents(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", text)
        if unicodedata.category(c) != "Mn"
    )


def _norm_key(text: str) -> str:
    s = _strip_accents(str(text).strip().lower())
    for ch in ("&", "/", "-", ".", "(", ")", ","):
        s = s.replace(ch, " ")
    return "_".join(part for part in s.split() if part)


# ==============================================================================
# 1. DOMÍNIOS SETORIAIS
# ==============================================================================

DOMAIN_CANONICAL_TO_LABEL: Dict[str, str] = {
    "Energia_Utilities": "Energia & Utilities",
    "Financeiro": "Financeiro",
    "Industria_4_0": "Indústria 4.0",
    "Logistica": "Logística",
    "Varejo": "Varejo",
    "Saude": "Saúde",
}

DOMAIN_ALIASES: Dict[str, str] = {
    "energia_utilities": "Energia_Utilities",
    "energia_e_utilities": "Energia_Utilities",
    "energia": "Energia_Utilities",
    "utilities": "Energia_Utilities",
    "financeiro": "Financeiro",
    "financas": "Financeiro",
    "industria_4_0": "Industria_4_0",
    "industria": "Industria_4_0",
    "logistica": "Logistica",
    "varejo": "Varejo",
    "saude": "Saude",
}


def normalize_domain(value: str) -> str:
    if value in DOMAIN_CANONICAL_TO_LABEL:
        return value
    k = _norm_key(value)
    if k in DOMAIN_ALIASES:
        return DOMAIN_ALIASES[k]
    raise ValueError(
        f"Domínio setorial inválido: '{value}'. Valores aceitos: {list(DOMAIN_CANONICAL_TO_LABEL.keys())} "
        f"ou rótulos {list(DOMAIN_CANONICAL_TO_LABEL.values())}."
    )


# ==============================================================================
# 2. HARD SKILLS (24 SKILLS REAIS DO CSV + ALIASES DO FRONTEND)
# ==============================================================================

SKILL_CANONICAL_TO_LABEL: Dict[str, str] = {
    # Engenharia (7)
    "APIs_REST": "APIs REST",
    "Arquitetura_Microsservicos": "Arquitetura de Microsserviços",
    "Cloud_AWS_GCP": "Cloud AWS / GCP",
    "Docker_K8s": "Docker & Kubernetes",
    "Integracao_IoT_SCADA": "Integração IoT / SCADA",
    "Node.js": "Node.js",
    "Python": "Python",
    "React": "React",
    # Dados (8)
    "Engenharia_ETL": "Engenharia ETL",
    "Estatistica": "Estatística",
    "Machine_Learning_Preditivo": "ML Preditivo",
    "PowerBI_Looker": "PowerBI & Looker",
    "Python_DS": "Python para Data Science",
    "SQL_Avancado": "SQL Avançado",
    "Series_Temporais": "Séries Temporais",
    "Spark": "Spark",
    # Produto & Design (8)
    "Data_Visualization": "Data Visualization",
    "Design_System": "Design System",
    "Discovery_Usuario": "Discovery de Usuário",
    "Gestao_Stakeholders": "Gestão de Stakeholders",
    "Metricas_Produto": "Métricas de Produto",
    "Prototipacao_Figma": "Prototipação Figma",
    "Roadmap_Agil": "Roadmap Ágil",
    "UX_Research": "UX Research",
}

SKILL_ALIASES: Dict[str, str] = {
    # Canônicos normalizados
    "apis_rest": "APIs_REST",
    "api_rest": "APIs_REST",
    "api_backend": "APIs_REST",
    "api_e_backend": "APIs_REST",
    "arquitetura_microsservicos": "Arquitetura_Microsservicos",
    "arquitetura_de_microsservicos": "Arquitetura_Microsservicos",
    "microsservicos": "Arquitetura_Microsservicos",
    "cloud_aws_gcp": "Cloud_AWS_GCP",
    "arquitetura_cloud": "Cloud_AWS_GCP",
    "cloud": "Cloud_AWS_GCP",
    "docker_k8s": "Docker_K8s",
    "docker_kubernetes": "Docker_K8s",
    "devops_sre": "Docker_K8s",
    "devops": "Docker_K8s",
    "integracao_iot_scada": "Integracao_IoT_SCADA",
    "iot_scada": "Integracao_IoT_SCADA",
    "node_js": "Node.js",
    "nodejs": "Node.js",
    "python": "Python",
    "react": "React",
    "engenharia_etl": "Engenharia_ETL",
    "engenharia_dados": "Engenharia_ETL",
    "engenharia_de_dados": "Engenharia_ETL",
    "estatistica": "Estatistica",
    "machine_learning_preditivo": "Machine_Learning_Preditivo",
    "ml_preditivo": "Machine_Learning_Preditivo",
    "machine_learning": "Machine_Learning_Preditivo",
    "visao_computacional": "Machine_Learning_Preditivo",
    "powerbi_looker": "PowerBI_Looker",
    "power_bi_looker": "PowerBI_Looker",
    "python_ds": "Python_DS",
    "python_para_data_science": "Python_DS",
    "sql_avancado": "SQL_Avancado",
    "sql": "SQL_Avancado",
    "series_temporais": "Series_Temporais",
    "spark": "Spark",
    "data_visualization": "Data_Visualization",
    "design_system": "Design_System",
    "ux_ui_design": "Design_System",
    "ux_ui": "Design_System",
    "discovery_usuario": "Discovery_Usuario",
    "discovery_de_usuario": "Discovery_Usuario",
    "gestao_stakeholders": "Gestao_Stakeholders",
    "gestao_de_stakeholders": "Gestao_Stakeholders",
    "metricas_produto": "Metricas_Produto",
    "metricas_de_produto": "Metricas_Produto",
    "prototipacao_figma": "Prototipacao_Figma",
    "figma": "Prototipacao_Figma",
    "roadmap_agil": "Roadmap_Agil",
    "produto_agil": "Roadmap_Agil",
    "ux_research": "UX_Research",
    "seguranca_cibernetica": "Arquitetura_Microsservicos",
}


def normalize_skill(skill_name: str) -> str:
    s = str(skill_name).strip()
    if s in SKILL_CANONICAL_TO_LABEL:
        return s
    k = _norm_key(s)
    if k in SKILL_ALIASES:
        return SKILL_ALIASES[k]
    raise ValueError(
        f"Hard skill inválida: '{skill_name}'. Valores canônicos aceitos: {list(SKILL_CANONICAL_TO_LABEL.keys())}."
    )


def normalize_skills_obrigatorias(raw_skills: Any) -> Dict[str, int]:
    """
    Aceita:
      - Dict[str, int]: {"Series_Temporais": 4, "ML Preditivo": 4}
      - List[Dict]: [{"skill": "Series_Temporais", "minLevel": 4}, {"skill": "Python", "nivel": 4}]
    Retorna Dict[canonical_skill, int].
    """
    if not raw_skills:
        return {}
    normalized: Dict[str, int] = {}
    if isinstance(raw_skills, dict):
        for k, v in raw_skills.items():
            canon_k = normalize_skill(k)
            lvl = max(1, min(5, int(v)))
            normalized[canon_k] = max(normalized.get(canon_k, 0), lvl)
        return normalized

    if isinstance(raw_skills, (list, tuple)):
        for item in raw_skills:
            if isinstance(item, dict):
                sk_raw = item.get("skill") or item.get("nome") or item.get("name")
                lvl_raw = (
                    item.get("minLevel")
                    or item.get("min_level")
                    or item.get("nivel")
                    or item.get("level")
                    or 3
                )
            else:
                sk_raw = getattr(item, "skill", None)
                lvl_raw = getattr(item, "minLevel", getattr(item, "min_level", 3))
            if sk_raw:
                canon_k = normalize_skill(str(sk_raw))
                lvl = max(1, min(5, int(lvl_raw)))
                normalized[canon_k] = max(normalized.get(canon_k, 0), lvl)
        return normalized

    raise ValueError("Formato inválido para skills_obrigatorias.")


# ==============================================================================
# 3. TIPO DE SOLUÇÃO, URGÊNCIA E CRITICIDADE REGULATÓRIA
# ==============================================================================

SOLUTION_ALIASES: Dict[str, str] = {
    "software_preditivo_ia": "Software Preditivo/IA",
    "produto_digital_app": "Produto Digital/App",
    "plataforma_de_dados_bi": "Plataforma de Dados/BI",
    "plataforma_dados_bi": "Plataforma de Dados/BI",
    "sistema_critico_iot": "Sistema Crítico/IoT",
}

URGENCY_ALIASES: Dict[str, str] = {
    "baixa": "Baixa",
    "normal": "Normal",
    "media": "Normal",
    "critica": "Crítica",
    "alta": "Crítica",
}

REGULATORY_ALIASES: Dict[str, str] = {
    "baixa": "Baixa",
    "media": "Média",
    "normal": "Média",
    "alta": "Alta",
    "critica": "Alta",
}


def normalize_solution_type(value: str) -> str:
    valid = {
        "Software Preditivo/IA",
        "Produto Digital/App",
        "Plataforma de Dados/BI",
        "Sistema Crítico/IoT",
    }
    if value in valid:
        return value
    k = _norm_key(value)
    if k in SOLUTION_ALIASES:
        return SOLUTION_ALIASES[k]
    raise ValueError(f"tipo_solucao inválido: '{value}'. Valores aceitos: {sorted(valid)}.")


def normalize_urgency(value: str) -> str:
    valid = {"Baixa", "Normal", "Crítica"}
    if value in valid:
        return value
    k = _norm_key(value)
    if k in URGENCY_ALIASES:
        return URGENCY_ALIASES[k]
    raise ValueError(f"urgencia_prazo inválida: '{value}'. Valores aceitos: {sorted(valid)}.")


def normalize_regulatory(value: str) -> str:
    valid = {"Baixa", "Média", "Alta"}
    if value in valid:
        return value
    k = _norm_key(value)
    if k in REGULATORY_ALIASES:
        return REGULATORY_ALIASES[k]
    raise ValueError(f"criticidade_regulatoria inválida: '{value}'. Valores aceitos: {sorted(valid)}.")


# ==============================================================================
# 4. RÓTULOS DA UI PARA SUB-ÍNDICES (`ui_metrics`)
# ==============================================================================

UI_METRICS_LABELS: List[Tuple[str, str, str]] = [
    ("S_Tecnico", "sTecnico", "Competência Técnica"),
    ("S_Dominio", "sDominio", "Domínio do Setor"),
    ("S_Quimica", "sQuimica", "Química da Equipe"),
    ("S_RPG", "sRpg", "Equilíbrio de Perfis"),
    ("S_Confiabilidade_Custo", "sConfiabCusto", "Eficiência de Custo & Entrega"),
]
