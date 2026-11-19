import json
from typing import Any, Dict
from sqlalchemy import Column, Float, String, Text
from .database import Base


class ProfessionalModel(Base):
    __tablename__ = "professionals"

    id = Column(String(16), primary_key=True, index=True)
    nome = Column(String(128), nullable=False)
    cargo = Column(String(128), nullable=False)
    trilha = Column(String(64), nullable=False, index=True)
    senioridade = Column(String(64), nullable=False)
    custo_hora_brl = Column(Float, nullable=False)
    arquetipo = Column(String(64), nullable=False)
    hard_skills_json = Column(Text, nullable=False, default="{}")
    dominios_json = Column(Text, nullable=False, default="[]")
    taxa_sucesso_pct = Column(Float, nullable=False)
    afinidades_json = Column(Text, nullable=False, default="[]")
    atritos_json = Column(Text, nullable=False, default="[]")

    def to_engine_dict(self) -> Dict[str, Any]:
        hard_skills = json.loads(self.hard_skills_json or "{}")
        dominios_list = json.loads(self.dominios_json or "[]")
        afinidades_list = json.loads(self.afinidades_json or "[]")
        atritos_list = json.loads(self.atritos_json or "[]")
        return {
            "id": self.id,
            "nome": self.nome,
            "cargo": self.cargo,
            "trilha": self.trilha,
            "senioridade": self.senioridade,
            "custo_hora_brl": float(self.custo_hora_brl),
            "taxa_sucesso_pct": float(self.taxa_sucesso_pct),
            "arquetipo": self.arquetipo,
            "hard_skills": {str(k): int(v) for k, v in hard_skills.items()},
            "dominios": set(dominios_list),
            "dominios_list": list(dominios_list),
            "afinidades_ids": set(afinidades_list),
            "afinidades_list": list(afinidades_list),
            "atritos_ids": set(atritos_list),
            "atritos_list": list(atritos_list),
        }
