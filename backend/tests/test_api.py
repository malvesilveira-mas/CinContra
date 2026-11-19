"""
Suíte Completa de Validação dos Endpoints FastAPI e do Motor Branch-and-Bound (`CinContra`):
  - Valida seed automático SQLite via `squad_rpg_60.csv`
  - Valida `GET /professionals` e `GET /api/v1/professionals`
  - Valida `POST /recommend` e `POST /api/v1/squads/recommend` (< 120 ms, tamanho_min/max, diversidade >= 2, bilinguismo e Fallback Relaxado)
  - Valida `POST /simulate` e `POST /api/v1/squads/simulate` (< 5 ms, preservação de score_final/ui_metrics e detecção de HC1..HC5)
"""

import os
import sys
import types
import unittest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

from app.main import (  # noqa: E402
    _init_engine_from_db,
    app,
    list_professionals,
    recommend_squads,
    simulate_squad,
)
from app.schemas import RecommendRequest, SimulateRequest  # noqa: E402


class _DirectFastAPIClient:
    """
    Cliente de teste síncrono direto sobre as rotas registradas no FastAPI
    (evita socket.socketpair do ProactorEventLoop dentro do sandbox Windows).
    """

    def __init__(self, fastapi_app):
        self.app = fastapi_app
        self.app.state.engine = _init_engine_from_db()
        self.routes = {r.path: r for r in fastapi_app.routes if hasattr(r, "path")}
        self.req = types.SimpleNamespace(app=self.app)

    def get(self, path: str) -> dict:
        assert path in self.routes, f"Rota GET {path} não registrada no FastAPI!"
        return list_professionals(self.req)

    def post(self, path: str, json_body: dict) -> dict:
        assert path in self.routes, f"Rota POST {path} não registrada no FastAPI!"
        if "recommend" in path:
            payload = RecommendRequest.model_validate(json_body)
            return recommend_squads(payload, self.req)
        if "simulate" in path:
            payload = SimulateRequest.model_validate(json_body)
            return simulate_squad(payload, self.req)
        raise ValueError(f"Rota desconhecida: {path}")


class TestCinContraBackend(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = _DirectFastAPIClient(app)

    def test_01_professionals_seed_and_dual_routes(self):
        """Valida GET /professionals e GET /api/v1/professionals com os 60 profissionais do CSV."""
        for path in ("/professionals", "/api/v1/professionals"):
            data = self.client.get(path)
            self.assertEqual(data["total"], 60)
            profs = data["professionals"]
            self.assertEqual(len(profs), 60)

            by_trilha = {"Engenharia": 0, "Dados": 0, "Produto & Design": 0}
            for p in profs:
                by_trilha[p["trilha"]] += 1
                self.assertIn("custo_hora_brl", p)
                self.assertIn("custoHora", p)
                self.assertIn("hard_skills", p)
                self.assertIn("skills", p)

            self.assertEqual(by_trilha["Engenharia"], 30)
            self.assertEqual(by_trilha["Dados"], 16)
            self.assertEqual(by_trilha["Produto & Design"], 14)

            p06 = next(p for p in profs if p["id"] == "P06")
            self.assertEqual(p06["arquetipo"], "Facilitador")
            self.assertEqual(p06["custo_hora_brl"], 111.0)
            self.assertEqual(p06["hard_skills"]["Integracao_IoT_SCADA"], 5)

        print(
            "\n✅ [TEST 01] GET /professionals & /api/v1/professionals: "
            "60 profissionais carregados do SQLite (30 Eng, 16 Dados, 14 Prod)."
        )

    def test_02_recommend_neoenergia_benchmark_snake_case_and_latency(self):
        """
        Valida POST /recommend no Caso Benchmark Neoenergia:
          - Range tamanho_min=5, tamanho_max=7 (< 120 ms, Top 5 100% diverso >= 2 membros, Score 90.12)
          - Tamanho fixo 6..6 da Tabela 5.4 (< 120 ms, Campeão ['P06', 'P09', 'P15', 'P37', 'P42', 'P45'], Score 89.88)
        """
        payload_5_7 = {
            "dominio_setorial": "Energia_Utilities",
            "tipo_solucao": "Software Preditivo/IA",
            "skills_obrigatorias": {
                "Series_Temporais": 4,
                "Machine_Learning_Preditivo": 4,
                "Integracao_IoT_SCADA": 4,
                "Python": 4,
            },
            "orcamento_max_hora": 1000.0,
            "tamanho_min": 5,
            "tamanho_max": 7,
            "urgencia_prazo": "Normal",
            "criticidade_regulatoria": "Alta",
        }
        data_5_7 = self.client.post("/recommend", payload_5_7)
        self.assertTrue(data_5_7["is_feasible"])
        exec_ms = data_5_7["execution_time_ms"]
        self.assertLess(exec_ms, 120.0, f"Tempo {exec_ms} ms excedeu o limite de 120 ms!")

        top_squads = data_5_7["top_squads"]
        self.assertEqual(len(top_squads), 5)
        self.assertEqual(top_squads[0]["member_ids"], ["P06", "P09", "P15", "P32", "P37", "P42", "P45"])
        self.assertEqual(top_squads[0]["score_final"], 90.12)

        for i in range(len(top_squads)):
            set_i = set(top_squads[i]["member_ids"])
            self.assertTrue(5 <= len(set_i) <= 7)
            for j in range(i):
                set_j = set(top_squads[j]["member_ids"])
                diff_ij = max(len(set_i - set_j), len(set_j - set_i))
                self.assertGreaterEqual(
                    diff_ij,
                    2,
                    f"Squad {i+1} ({sorted(set_i)}) e Squad {j+1} ({sorted(set_j)}) diferem em apenas {diff_ij} membro(s)!",
                )

        # Valida também o caso de 6 integrantes da Tabela 5.4 de matriz-decisao.md
        payload_6_6 = {**payload_5_7, "tamanho_min": 6, "tamanho_max": 6}
        data_6_6 = self.client.post("/recommend", payload_6_6)
        self.assertLess(data_6_6["execution_time_ms"], 120.0)
        champ_6 = data_6_6["top_squads"][0]
        self.assertEqual(champ_6["member_ids"], ["P06", "P09", "P15", "P37", "P42", "P45"])
        self.assertEqual(champ_6["score_final"], 89.88)
        self.assertEqual(champ_6["custo_total"], 866.0)

        ui_m = champ_6["ui_metrics"]
        self.assertEqual(ui_m["Competência Técnica"], 83.64)
        self.assertEqual(ui_m["Domínio do Setor"], 100.0)
        self.assertEqual(ui_m["Química da Equipe"], 70.0)
        self.assertEqual(ui_m["Equilíbrio de Perfis"], 98.0)
        self.assertEqual(ui_m["Eficiência de Custo & Entrega"], 92.7)

        print(
            f"✅ [TEST 02] POST /recommend: Range 5..7 em {exec_ms:.2f} ms (1º={top_squads[0]['member_ids']}, Score={top_squads[0]['score_final']}) | "
            f"Benchmark 6..6 em {data_6_6['execution_time_ms']:.2f} ms (1º={champ_6['member_ids']}, Score={champ_6['score_final']}, Custo=R${champ_6['custo_total']}/h)."
        )

    def test_03_recommend_camelcase_ui_labels_on_v1_route(self):
        """Valida POST /api/v1/squads/recommend com payload camelCase e rótulos da UI."""
        ui_payload = {
            "dominioSetorial": "Energia & Utilities",
            "tipoSolucao": "Software Preditivo/IA",
            "skillsObrigatorias": [
                {"skill": "Séries Temporais", "minLevel": 4},
                {"skill": "ML Preditivo", "minLevel": 4},
                {"skill": "Integração IoT / SCADA", "minLevel": 4},
                {"skill": "Python", "minLevel": 4},
            ],
            "orcamentoMaxHora": 1000,
            "minSize": 5,
            "maxSize": 7,
            "urgencia": "Normal",
            "criticidadeRegulatoria": "Alta",
        }
        data = self.client.post("/api/v1/squads/recommend", ui_payload)

        self.assertTrue(data["isFeasible"])
        self.assertLess(data["execution_time_ms"], 120.0)
        champ = data["topSquads"][0]
        self.assertEqual(champ["member_ids"], ["P06", "P09", "P15", "P32", "P37", "P42", "P45"])
        self.assertEqual(champ["scoreFinal"], 90.12)
        self.assertGreaterEqual(len(champ["edges"]), 3)
        print(
            f"✅ [TEST 03] POST /api/v1/squads/recommend (camelCase + UI labels): "
            f"{data['execution_time_ms']:.2f} ms | Score={champ['scoreFinal']} | Arestas={len(champ['edges'])}."
        )

    def test_04_recommend_two_stage_soft_constraints_fallback(self):
        """
        Valida a Etapa 2 (Modo Fallback Relaxado < 200 ms) quando nenhuma combinação atende HC1..HC5.
        """
        impossible_payload = {
            "dominio_setorial": "Energia_Utilities",
            "tipo_solucao": "Software Preditivo/IA",
            "skills_obrigatorias": {
                "Series_Temporais": 4,
                "Machine_Learning_Preditivo": 4,
                "Integracao_IoT_SCADA": 4,
                "Python": 4,
            },
            "orcamento_max_hora": 250.0,
            "tamanho_min": 5,
            "tamanho_max": 7,
            "urgencia_prazo": "Normal",
            "criticidade_regulatoria": "Alta",
        }
        data = self.client.post("/recommend", impossible_payload)

        self.assertFalse(data["is_feasible"])
        self.assertTrue(data["fallback_mode"])
        self.assertLess(data["execution_time_ms"], 200.0)
        self.assertEqual(len(data["top_squads"]), 5)

        first_fb = data["top_squads"][0]
        self.assertFalse(first_fb["is_valid"])
        self.assertGreater(first_fb["score_final"], 0.0, "Score Final NUNCA deve ser zerado no fallback!")
        self.assertGreater(len(first_fb["violations"]), 0)
        for metric_name, metric_val in first_fb["ui_metrics"].items():
            self.assertGreater(metric_val, 0.0, f"Barra '{metric_name}' não deve ser zerada!")

        print(
            f"✅ [TEST 04] POST /recommend (Fallback Relaxado): {data['execution_time_ms']:.2f} ms (< 200 ms) | "
            f"is_feasible=False | Top 1 Fallback Score={first_fb['score_final']} com {len(first_fb['violations'])} violação(ões) detalhada(s)."
        )

    def test_05_simulate_valid_and_all_hc_violations_preserve_bars(self):
        """
        Valida POST /simulate e POST /api/v1/squads/simulate (< 5 ms).
        """
        base_params = {
            "dominio_setorial": "Energia_Utilities",
            "tipo_solucao": "Software Preditivo/IA",
            "skills_obrigatorias": {
                "Series_Temporais": 4,
                "Machine_Learning_Preditivo": 4,
                "Integracao_IoT_SCADA": 4,
                "Python": 4,
            },
            "orcamento_max_hora": 1000.0,
            "tamanho_min": 5,
            "tamanho_max": 7,
            "urgencia_prazo": "Normal",
            "criticidade_regulatoria": "Alta",
        }
        champ_ids = ["P06", "P09", "P15", "P37", "P42", "P45"]

        # 5.1 Troca válida: sai P06, entra P03
        prop_valid = ["P03", "P09", "P15", "P37", "P42", "P45"]
        sim_v = self.client.post(
            "/simulate",
            {
                "squad_proposto_ids": prop_valid,
                "squad_referencia_ids": champ_ids,
                "params": base_params,
            },
        )
        self.assertLess(sim_v["execution_time_ms"], 5.0)
        self.assertTrue(sim_v["is_valid"])
        self.assertEqual(sim_v["adicionados"], ["P03"])
        self.assertEqual(sim_v["removidos"], ["P06"])
        self.assertEqual(len(sim_v["violations"]), 0)

        # 5.2 Violação múltipla: HC1, HC2, HC3, HC4a/4b, HC5
        sim_i = self.client.post(
            "/api/v1/squads/simulate",
            {
                "memberIds": ["P04", "P28", "P39", "P41"],
                "baselineIds": champ_ids,
                "params": {
                    **base_params,
                    "orcamento_max_hora": 400.0,
                },
            },
        )
        self.assertLess(sim_i["execution_time_ms"], 5.0)
        self.assertFalse(sim_i["is_valid"])

        prop_eval = sim_i["proposto"]
        self.assertGreater(prop_eval["score_final"], 0.0, "score_final não pode ser zerado no /simulate!")
        for bar_label, bar_val in prop_eval["ui_metrics"].items():
            self.assertGreater(bar_val, 0.0, f"Barra '{bar_label}' foi zerada indevidamente!")

        rule_ids_found = {v["rule_id"] for v in sim_i["violations"]}
        self.assertIn("HC1", rule_ids_found)
        self.assertIn("HC2", rule_ids_found)
        self.assertIn("HC3", rule_ids_found)
        self.assertTrue("HC4a" in rule_ids_found or "HC4b" in rule_ids_found or "HC4c" in rule_ids_found)
        self.assertIn("HC5", rule_ids_found)

        print(
            f"✅ [TEST 05] POST /simulate & /api/v1/squads/simulate: "
            f"Valid={sim_v['execution_time_ms']:.3f} ms | Invalid={sim_i['execution_time_ms']:.3f} ms (< 5 ms) | "
            f"Score preservado ({prop_eval['score_final']}) | Violações detectadas: {sorted(rule_ids_found)}."
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
