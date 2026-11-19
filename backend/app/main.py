"""
API REST FastAPI do Motor de Recomendação e Simulação de Squads (`CinContra`).
Endpoints expostos em dupla rota (curta e `/api/v1/...`):
  - GET  /professionals           & GET  /api/v1/professionals
  - POST /recommend               & POST /api/v1/squads/recommend
  - POST /simulate                & POST /api/v1/squads/simulate
"""

from contextlib import asynccontextmanager
from typing import Any, Dict
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, SessionLocal, engine as db_engine
from .engine import SquadRecommendationEngine, format_professional_for_response
from .normalizer import DOMAIN_CANONICAL_TO_LABEL, SKILL_CANONICAL_TO_LABEL
from .schemas import RecommendRequest, SimulateRequest
from .seed import seed_database_if_needed


def _init_engine_from_db() -> SquadRecommendationEngine:
    Base.metadata.create_all(bind=db_engine)
    db = SessionLocal()
    try:
        profs = seed_database_if_needed(db)
    finally:
        db.close()
    return SquadRecommendationEngine(profs)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.engine = _init_engine_from_db()
    yield


app = FastAPI(
    title="CinContra — White-Box Squad Recommendation Engine API",
    description=(
        "Motor determinístico Branch-and-Bound Hierárquico (< 120 ms) com seed automático de "
        "squad_rpg_60.csv em SQLite, Top 5 com diversidade mínima e simulação What-If (< 5 ms)."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_engine(request: Request) -> SquadRecommendationEngine:
    eng = getattr(request.app.state, "engine", None)
    if eng is None:
        eng = _init_engine_from_db()
        request.app.state.engine = eng
    return eng


@app.get("/health")
@app.get("/api/v1/health")
def health_check(request: Request) -> Dict[str, Any]:
    eng = get_engine(request)
    return {
        "status": "ok",
        "professionals_count": len(eng.professionals),
        "bilateral_friction_pairs": len(eng.bilateral_friction_masks),
    }


@app.get("/professionals")
@app.get("/api/v1/professionals")
def list_professionals(request: Request) -> Dict[str, Any]:
    """
    Retorna todos os 60 profissionais do banco SQLite (populado via squad_rpg_60.csv)
    junto com os catálogos canônicos de skills e domínios para alimentar o Banco de Talentos
    e o seletor 'Adicionar competência...'.
    """
    eng = get_engine(request)
    serialized = [format_professional_for_response(p) for p in eng.professionals]
    return {
        "total": len(serialized),
        "professionals": serialized,
        "skills_catalog": [
            {"key": k, "label": v} for k, v in SKILL_CANONICAL_TO_LABEL.items()
        ],
        "domains_catalog": [
            {"key": k, "label": v} for k, v in DOMAIN_CANONICAL_TO_LABEL.items()
        ],
    }


@app.post("/recommend")
@app.post("/api/v1/squads/recommend")
@app.post("/api/v1/recommend")
def recommend_squads(payload: RecommendRequest, request: Request) -> Dict[str, Any]:
    """
    Executa o motor Branch-and-Bound Hierárquico (< 120 ms) com suporte a tamanho_min e tamanho_max,
    retornando o Top 5 com diversidade mínima (pelo menos 2 integrantes diferentes) ou acionando
    o Modo Fallback Relaxado (Soft Constraints) caso as restrições sejam inviáveis.
    """
    eng = get_engine(request)
    params = payload.to_engine_params()
    locked_set = {str(x).strip().upper() for x in (payload.locked_ids or []) if str(x).strip()}
    excluded_set = {str(x).strip().upper() for x in (payload.excluded_ids or []) if str(x).strip()}

    result = eng.recommend_top_squads(
        params=params,
        top_k=payload.top_k,
        min_diff_members=payload.min_diff_members,
        locked_ids=locked_set,
        excluded_ids=excluded_set,
    )
    result["params_normalized"] = {
        "dominio_setorial": params["dominio_setorial"],
        "tipo_solucao": params["tipo_solucao"],
        "skills_obrigatorias": params["skills_obrigatorias"],
        "orcamento_max_hora": params["orcamento_max_hora"],
        "tamanho_min": params["tamanho_min"],
        "tamanho_max": params["tamanho_max"],
        "urgencia_prazo": params["urgencia_prazo"],
        "criticidade_regulatoria": params["criticidade_regulatoria"],
    }
    return result


@app.post("/simulate")
@app.post("/api/v1/squads/simulate")
@app.post("/api/v1/simulate")
def simulate_squad(payload: SimulateRequest, request: Request) -> Dict[str, Any]:
    """
    Recalcula em tempo real (< 5 ms) o Score Total, Custo/Hora, os 5 sub-índices (ui_metrics),
    as arestas sociais (afinidades e atritos) e valida as Hard Constraints (HC1..HC5)
    sem nunca zerar o score_final ou as barras da interface.
    """
    eng = get_engine(request)
    if not payload.squad_proposto_ids:
        raise HTTPException(
            status_code=422,
            detail="A lista 'squad_proposto_ids' (ou 'memberIds') não pode ser vazia.",
        )

    params = payload.resolve_engine_params()
    try:
        result = eng.simulate_what_if(
            squad_proposto_ids=payload.squad_proposto_ids,
            squad_referencia_ids=payload.squad_referencia_ids,
            params=params,
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    return result
