"""
Módulo de ingestão e seed automático de `squad_rpg_60.csv` para o banco SQLite.
"""

import ast
import csv
import json
import os
import re
from typing import Any, Dict, List
from sqlalchemy.orm import Session
from .models import ProfessionalModel

WORKSPACE_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def _resolve_default_csv_path() -> str:
    env_csv = os.getenv("CSV_PATH")
    if env_csv and os.path.exists(env_csv):
        return env_csv
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    candidates = [
        "/app/squad_rpg_60.csv",
        os.path.join(backend_dir, "squad_rpg_60.csv"),
        os.path.join(WORKSPACE_ROOT, "squad_rpg_60.csv"),
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return os.path.join(backend_dir, "squad_rpg_60.csv")


DEFAULT_CSV_PATH = _resolve_default_csv_path()


def _parse_dict_field(raw_val: Any) -> Dict[str, int]:
    if not raw_val or str(raw_val).strip() in ("", "nan", "None", "{}"):
        return {}
    if isinstance(raw_val, dict):
        return {str(k).strip(): int(v) for k, v in raw_val.items()}
    s = str(raw_val).strip()
    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(s)
            if isinstance(parsed, dict):
                return {str(k).strip(): int(v) for k, v in parsed.items()}
        except Exception:
            pass
    result: Dict[str, int] = {}
    for part in re.split(r"[;|,]", s):
        part = part.strip()
        if ":" in part:
            k, v = part.split(":", 1)
            result[k.strip().strip("'\"")] = int(re.sub(r"[^\d]", "", v))
    return result


def _parse_list_field(raw_val: Any) -> List[str]:
    if not raw_val or str(raw_val).strip() in ("", "nan", "None", "[]"):
        return []
    if isinstance(raw_val, (list, tuple, set)):
        return [str(x).strip() for x in raw_val if str(x).strip()]
    s = str(raw_val).strip()
    for parser in (json.loads, ast.literal_eval):
        try:
            parsed = parser(s)
            if isinstance(parsed, (list, tuple, set)):
                return [str(x).strip() for x in parsed if str(x).strip()]
        except Exception:
            pass
    return [
        x.strip().strip("'\"[]")
        for x in re.split(r"[;|,]", s)
        if x.strip().strip("'\"[]")
    ]


def parse_csv_professionals(csv_path: str = DEFAULT_CSV_PATH) -> List[Dict[str, Any]]:
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Arquivo CSV não encontrado em: {csv_path}")

    professionals: List[Dict[str, Any]] = []
    with open(csv_path, mode="r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            p_id = str(row.get("id") or row.get("ID") or "").strip()
            nome = str(row.get("nome") or row.get("name") or f"Profissional {p_id}").strip()
            cargo = str(row.get("cargo") or row.get("role") or "").strip()
            trilha = str(row.get("trilha") or row.get("track") or "").strip()
            senioridade = str(row.get("senioridade") or row.get("seniority") or "").strip()
            arquetipo = str(row.get("arquetipo") or row.get("arquétipo") or "").strip()

            raw_custo = row.get("custo_hora_brl") or row.get("custo_hora") or "0"
            custo = float(re.sub(r"[^\d.]", "", str(raw_custo).replace(",", ".")))

            raw_sucesso = row.get("taxa_sucesso_pct") or row.get("taxa_sucesso") or "0"
            sucesso = float(re.sub(r"[^\d.]", "", str(raw_sucesso).replace(",", ".")))
            if 0 < sucesso <= 1.0:
                sucesso *= 100.0

            hard_skills = _parse_dict_field(row.get("hard_skills") or row.get("skills"))
            dominios_list = _parse_list_field(row.get("dominios") or row.get("dominios_setoriais"))
            afinidades_list = _parse_list_field(row.get("afinidades_ids") or row.get("afinidades"))
            atritos_list = _parse_list_field(row.get("atritos_ids") or row.get("atritos"))

            professionals.append({
                "id": p_id,
                "nome": nome,
                "cargo": cargo,
                "trilha": trilha,
                "senioridade": senioridade,
                "custo_hora_brl": custo,
                "taxa_sucesso_pct": sucesso,
                "arquetipo": arquetipo,
                "hard_skills": hard_skills,
                "dominios": set(dominios_list),
                "dominios_list": dominios_list,
                "afinidades_ids": set(afinidades_list),
                "afinidades_list": afinidades_list,
                "atritos_ids": set(atritos_list),
                "atritos_list": atritos_list,
            })

    professionals.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["id"])))
    return professionals


def seed_database_if_needed(db: Session, csv_path: str = DEFAULT_CSV_PATH) -> List[Dict[str, Any]]:
    """
    Popula automaticamente a tabela `professionals` no SQLite a partir de `squad_rpg_60.csv`.
    Se já houver exatamente os 60 registros sincronizados, carrega direto do banco.
    """
    csv_rows = parse_csv_professionals(csv_path)
    existing_count = db.query(ProfessionalModel).count()

    if existing_count != len(csv_rows):
        db.query(ProfessionalModel).delete()
        for p in csv_rows:
            model = ProfessionalModel(
                id=p["id"],
                nome=p["nome"],
                cargo=p["cargo"],
                trilha=p["trilha"],
                senioridade=p["senioridade"],
                custo_hora_brl=p["custo_hora_brl"],
                arquetipo=p["arquetipo"],
                hard_skills_json=json.dumps(p["hard_skills"], ensure_ascii=False),
                dominios_json=json.dumps(p["dominios_list"], ensure_ascii=False),
                taxa_sucesso_pct=p["taxa_sucesso_pct"],
                afinidades_json=json.dumps(p["afinidades_list"], ensure_ascii=False),
                atritos_json=json.dumps(p["atritos_list"], ensure_ascii=False),
            )
            db.add(model)
        db.commit()

    db_rows = db.query(ProfessionalModel).all()
    profs = [r.to_engine_dict() for r in db_rows]
    profs.sort(key=lambda x: int(re.sub(r"[^\d]", "", x["id"])))
    return profs
