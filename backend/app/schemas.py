"""
Schemas Pydantic v2 bilingues (snake_case + camelCase + rótulos da UI)
para os endpoints `/professionals`, `/recommend` e `/simulate`.
"""

from typing import Any, Dict, List, Optional, Tuple
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator
from .normalizer import (
    normalize_domain,
    normalize_regulatory,
    normalize_skills_obrigatorias,
    normalize_solution_type,
    normalize_urgency,
)


class ProjectParamsSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    nome_projeto: Optional[str] = Field(
        default="Projeto CinContra",
        validation_alias=AliasChoices("nome_projeto", "nomeProjeto", "project_name"),
    )
    dominio_setorial: str = Field(
        default="Energia_Utilities",
        validation_alias=AliasChoices("dominio_setorial", "dominioSetorial", "dominio", "domain"),
    )
    tipo_solucao: str = Field(
        default="Software Preditivo/IA",
        validation_alias=AliasChoices("tipo_solucao", "tipoSolucao", "solucao", "solution_type"),
    )
    skills_obrigatorias: Any = Field(
        default_factory=lambda: {
            "Series_Temporais": 4,
            "Machine_Learning_Preditivo": 4,
            "Integracao_IoT_SCADA": 4,
            "Python": 4,
        },
        validation_alias=AliasChoices(
            "skills_obrigatorias", "skillsObrigatorias", "required_skills", "skills"
        ),
    )
    orcamento_max_hora: float = Field(
        default=1000.0,
        validation_alias=AliasChoices(
            "orcamento_max_hora", "orcamentoMaxHora", "orcamento", "budget"
        ),
    )
    tamanho_min: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_min", "minSize", "min_size"),
    )
    tamanho_max: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_max", "maxSize", "max_size"),
    )
    tamanho_squad: Optional[Tuple[int, int]] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_squad", "tamanhoSquad", "squad_size"),
    )
    urgencia_prazo: str = Field(
        default="Normal",
        validation_alias=AliasChoices("urgencia_prazo", "urgencia", "urgency"),
    )
    criticidade_regulatoria: str = Field(
        default="Alta",
        validation_alias=AliasChoices(
            "criticidade_regulatoria", "criticidadeRegulatoria", "criticidade", "regulatory"
        ),
    )

    @model_validator(mode="after")
    def normalize_all_fields(self) -> "ProjectParamsSchema":
        self.dominio_setorial = normalize_domain(self.dominio_setorial)
        self.tipo_solucao = normalize_solution_type(self.tipo_solucao)
        self.urgencia_prazo = normalize_urgency(self.urgencia_prazo)
        self.criticidade_regulatoria = normalize_regulatory(self.criticidade_regulatoria)
        self.skills_obrigatorias = normalize_skills_obrigatorias(self.skills_obrigatorias)

        if self.tamanho_min is not None and self.tamanho_max is not None:
            t_min = int(self.tamanho_min)
            t_max = int(self.tamanho_max)
        elif self.tamanho_squad is not None:
            t_min = int(self.tamanho_squad[0])
            t_max = int(self.tamanho_squad[1])
        elif self.tamanho_min is not None:
            t_min = int(self.tamanho_min)
            t_max = max(t_min, 7)
        elif self.tamanho_max is not None:
            t_max = int(self.tamanho_max)
            t_min = min(5, t_max)
        else:
            t_min, t_max = 5, 7

        if t_min > t_max:
            t_min, t_max = t_max, t_min
        t_min = max(1, min(12, t_min))
        t_max = max(t_min, min(12, t_max))

        self.tamanho_min = t_min
        self.tamanho_max = t_max
        self.tamanho_squad = (t_min, t_max)
        return self

    def to_engine_params(self) -> Dict[str, Any]:
        return {
            "nome_projeto": self.nome_projeto,
            "dominio_setorial": self.dominio_setorial,
            "tipo_solucao": self.tipo_solucao,
            "skills_obrigatorias": dict(self.skills_obrigatorias),
            "orcamento_max_hora": float(self.orcamento_max_hora),
            "tamanho_min": int(self.tamanho_min or 5),
            "tamanho_max": int(self.tamanho_max or 7),
            "tamanho_squad": (int(self.tamanho_min or 5), int(self.tamanho_max or 7)),
            "urgencia_prazo": self.urgencia_prazo,
            "criticidade_regulatoria": self.criticidade_regulatoria,
        }


class RecommendRequest(ProjectParamsSchema):
    top_k: int = Field(
        default=5,
        ge=1,
        le=20,
        validation_alias=AliasChoices("top_k", "topK", "limit"),
    )
    min_diff_members: int = Field(
        default=2,
        ge=1,
        le=6,
        validation_alias=AliasChoices("min_diff_members", "minDiffMembers", "diversidade_minima"),
    )
    locked_ids: Optional[List[str]] = Field(
        default=None,
        validation_alias=AliasChoices("locked_ids", "lockedIds"),
    )
    excluded_ids: Optional[List[str]] = Field(
        default=None,
        validation_alias=AliasChoices("excluded_ids", "excludedIds"),
    )


class SimulateRequest(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="allow")

    squad_proposto_ids: List[str] = Field(
        validation_alias=AliasChoices(
            "squad_proposto_ids",
            "squadPropostoIds",
            "member_ids",
            "memberIds",
            "members",
            "proposto_ids",
        )
    )
    squad_referencia_ids: Optional[List[str]] = Field(
        default=None,
        validation_alias=AliasChoices(
            "squad_referencia_ids",
            "squadReferenciaIds",
            "baseline_ids",
            "baselineIds",
            "referencia_ids",
        ),
    )
    params: Optional[ProjectParamsSchema] = Field(
        default=None,
        validation_alias=AliasChoices("params", "parametros", "project_params"),
    )

    # Permite também enviar os parâmetros diretamente na raiz do JSON do /simulate
    dominio_setorial: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("dominio_setorial", "dominioSetorial"),
    )
    tipo_solucao: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("tipo_solucao", "tipoSolucao"),
    )
    skills_obrigatorias: Optional[Any] = Field(
        default=None,
        validation_alias=AliasChoices("skills_obrigatorias", "skillsObrigatorias"),
    )
    orcamento_max_hora: Optional[float] = Field(
        default=None,
        validation_alias=AliasChoices("orcamento_max_hora", "orcamentoMaxHora"),
    )
    tamanho_min: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_min", "minSize"),
    )
    tamanho_max: Optional[int] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_max", "maxSize"),
    )
    tamanho_squad: Optional[Tuple[int, int]] = Field(
        default=None,
        validation_alias=AliasChoices("tamanho_squad", "tamanhoSquad"),
    )
    urgencia_prazo: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("urgencia_prazo", "urgencia"),
    )
    criticidade_regulatoria: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("criticidade_regulatoria", "criticidadeRegulatoria"),
    )

    def resolve_engine_params(self) -> Dict[str, Any]:
        if self.params is not None:
            return self.params.to_engine_params()

        raw_kwargs: Dict[str, Any] = {}
        for k in (
            "dominio_setorial",
            "tipo_solucao",
            "skills_obrigatorias",
            "orcamento_max_hora",
            "tamanho_min",
            "tamanho_max",
            "tamanho_squad",
            "urgencia_prazo",
            "criticidade_regulatoria",
        ):
            val = getattr(self, k)
            if val is not None:
                raw_kwargs[k] = val
        resolved = ProjectParamsSchema(**raw_kwargs)
        return resolved.to_engine_params()
