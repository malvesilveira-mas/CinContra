# Especificação Técnica do Motor de Recomendação de Squads (`matriz-decisao.md`)

**Fonte da Verdade:** Base `squad_rpg_60.csv` ($N = 60$ profissionais, 3 trilhas, 9 cargos, 5 arquétipos, 6 domínios setoriais e 24 hard skills).

---

## 1. Diagnóstico Quantitativo da Base (`squad_rpg_60`)

### 1.1. Estrutura Organizacional, Custos e Taxas de Sucesso
A base possui **60 profissionais** divididos em **44 executores** e **16 líderes/gerentes**:

| Trilha | Cargo | Papel Hierárquico | Qtd | Senioridades Presentes | Custo/Hora (Min / Méd / Máx) | Taxa de Sucesso (Min / Méd / Máx) |
| :--- | :--- | :--- | :---: | :--- | :---: | :---: |
| **Engenharia** (30) | Desenvolvedor | Executor | 24 | 3 Jr, 9 Pl, 10 Sr, 2 Esp | R$ 61 / R$ 135,96 / R$ 229 | 72% / 85,25% / 99% |
| **Engenharia** | Líder de Desenvolvimento | Líder | 4 | 4 Especialistas | R$ 234 / R$ 239,25 / R$ 245 | 78% / 87,25% / 97% |
| **Engenharia** | Gerente de Software | Gerente | 2 | 2 Especialistas | R$ 204 / R$ 215,50 / R$ 227 | 91% / 91,00% / 91% |
| **Dados** (16) | Analista de Dados | Executor | 12 | 3 Jr, 5 Pl, 4 Sr | R$ 61 / R$ 122,42 / R$ 185 | 72% / 88,67% / 97% |
| **Dados** | Líder de Dados | Líder | 2 | 1 Sênior, 1 Especialista | R$ 163 / R$ 181,50 / R$ 200 | 90% / 92,00% / 94% |
| **Dados** | Gerente de Dados | Gerente | 2 | 1 Sênior, 1 Especialista | R$ 168 / R$ 200,00 / R$ 232 | 98% / 98,50% / 99% |
| **Produto & Design** (14) | Designer de Produto | Executor | 8 | 3 Plenos, 5 Seniores | R$ 102 / R$ 141,50 / R$ 166 | 76% / 82,75% / 95% |
| **Produto & Design** | Líder de Design | Líder | 2 | 2 Seniores | R$ 151 / R$ 161,50 / R$ 172 | 74% / 76,50% / 79% |
| **Produto & Design** | Gerente de Produto | Gerente | 4 | 3 Plenos, 1 Sênior | R$ 100 / R$ 131,00 / R$ 186 | 85% / 89,50% / 97% |

### 1.2. Mapeamento de Domínios Setoriais e Gargalos de Liderança
| Domínio Setorial | Total na Base | Engenharia (Exec / Líd+Ger) | Dados (Exec / Líd+Ger) | Prod & Design (Exec / Líd+Ger) | IDs de Liderança/Gerência com o Domínio (Peso 2x) |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Financeiro** | **26** (43,3%) | 13 / 1 | 7 / 2 | 3 / 0 | `P26` (Eng), `P43`, `P44` (Dados) |
| **Energia_Utilities** | **24** (40,0%) | 11 / 2 | 2 / 2 | 3 / 4 | `P25`, `P26` (Eng), `P43`, `P45` (Dados), `P55`, `P57`, `P59`, `P60` (Prod) |
| **Saude** | **21** (35,0%) | 8 / 2 | 2 / 3 | 1 / 5 | `P29`, `P30` (Eng), `P44`, `P45`, `P46` (Dados), `P55`, `P56`, `P58`, `P59`, `P60` (Prod) |
| **Logistica** | **20** (33,3%) | 6 / 1 | 7 / 1 | 4 / 1 | `P27` (Eng), `P46` (Dados), `P60` (Prod) |
| **Industria_4_0** | **17** (28,3%) | 6 / 3 | 4 / 1 | 2 / 1 | `P25`, `P28`, `P29` (Eng), `P45` (Dados), `P56` (Prod) |
| **Varejo** | **16** (26,7%) | 5 / 1 | 3 / 2 | 3 / 2 | `P28` (Eng), `P43`, `P46` (Dados), `P58`, `P59` (Prod) |

* **Gargalos Críticos Setoriais:**
  1. Em `Energia_Utilities` e `Saude`, existem **apenas 2 Analistas de Dados** em cada domínio (`P37` e `P42` em Energia; `P31` e `P40` em Saúde).
  2. Em `Financeiro`, não há nenhum Líder ou Gerente na trilha de Produto & Design.

### 1.3. Gargalos de Hard Skills, Arquétipos e Grafo Social
* **Isolamento de Skills por Trilha:** As 24 hard skills respeitam separação estrita entre trilhas (7 em Engenharia, 8 em Dados, 9 em Produto & Design).
* **Gargalos Extremos de Hard Skills:**
  * `Prototipacao_Figma`: Apenas **2 profissionais** na base (`P51` e `P54`, nível 5).
  * `SQL_Avancado`: Apenas **5 profissionais** (`P34` [3], `P35` [4], `P43` [4], `P44` [4], `P45` [4]) e **nenhum com nível 5**.
  * `Engenharia_ETL` (6), `UX_Research` (6), `Python_DS` (7), `PowerBI_Looker` (7), `Design_System` (7), `Discovery_Usuario` (7), `Gestao_Stakeholders` (7), `Series_Temporais` (8) e `Spark` (8).
* **Distribuição de Arquétipos:** `Executor Pragmático` (16), `Cético Analítico` (15), `Facilitador` (11), `Bombeiro` (9) e `Arquiteto Metódico` (9). Na trilha de Dados existe apenas **1 `Facilitador`** (`P36`). Dos 11 Facilitadores da base, 6 ocupam cargos de Liderança/Gerência (`P25, P26, P27, P30, P59, P60`) e 5 são executores (`P06, P18, P36, P47, P51`).
* **Topologia do Grafo Social (178 arestas de afinidade e 95 de atrito):**
  * **Atrito Mútuo (Bilateral):** Apenas **1 par** em toda a base: **`P39` $\leftrightarrow$ `P41`**.
  * **Afinidades Mútuas (Bilaterais):** Exatamente **5 pares**: `P16` $\leftrightarrow$ `P19`, `P38` $\leftrightarrow$ `P46`, `P41` $\leftrightarrow$ `P45`, `P44` $\leftrightarrow$ `P51` e `P40` $\leftrightarrow$ `P55`.
  * **Principais Hubs de Afinidade (Mais citados):** `P57` (9 citações recebidas), `P44` (7), `P20` (7), `P16` (6), `P55` (6), `P19` (6).
  * **Principais Focos de Atrito (Mais rejeitados):** `P41` (citado negativamente por 5 colegas), `P58` (4) e `P21` (4).

---

## 2. Regras Booleanas de Corte (Hard Constraints — Camada 1)

### 2.1. Dicionário de Variáveis e Particionamento Hierárquico
Seja $\mathcal{U}$ o universo dos 60 profissionais e $Q \subseteq \mathcal{U}$ um squad candidato com tamanho $N = |Q|$.
* **Inputs:** $[N_{min}, N_{max}]$ (`tamanho_squad`), $B_{max}$ (`orcamento_max_hora`), $K_{req} = \{(s_k, l_k)\}$ (`skills_obrigatorias` e nível mínimo), $C_{reg} \in \{\text{"Baixa"}, \text{"Média"}, \text{"Alta"}\}$ (`criticidade_regulatoria`).
* **Subconjuntos por Trilha $t \in T = \{\text{"Engenharia"}, \text{"Dados"}, \text{"Produto \& Design"}\}$:**
  * **Executores ($E_t(Q)$):** Membros em $Q$ da trilha $t$ com `cargo` $\in \{\text{"Desenvolvedor"}, \text{"Analista de Dados"}, \text{"Designer de Produto"}\}$.
  * **Líderes ($L_t(Q)$):** Membros em $Q$ da trilha $t$ com `cargo` $\in \{\text{"Líder de Desenvolvimento"}, \text{"Líder de Dados"}, \text{"Líder de Design"}\}$.
  * **Gerentes ($G_t(Q)$):** Membros em $Q$ da trilha $t$ com `cargo` $\in \{\text{"Gerente de Software"}, \text{"Gerente de Dados"}, \text{"Gerente de Produto"}\}$.

### 2.2. Expressões Lógicas Eliminatórias ($HC_1$ a $HC_5$)
Um squad $Q$ é válido se e somente se $\text{IsValid}(Q) \iff HC_1(Q) \land HC_2(Q) \land HC_3(Q) \land HC_4(Q) \land HC_5(Q) == \text{True}$. Caso contrário, recebe `Score_Final = 0`:

1. **$HC_1$ (Cardinalidade):**
   $$HC_1(Q) \equiv (N_{min} \le |Q| \le N_{max})$$
2. **$HC_2$ (Restrição Orçamentária):**
   $$HC_2(Q) \equiv \left( \sum_{p \in Q} \text{custo}(p) \le B_{max} \right)$$
3. **$HC_3$ (Cobertura de Escopo Técnico):**
   $$HC_3(Q) \equiv \forall (s_k, l_k) \in K_{req}, \exists p \in Q \text{ tal que } \text{skill}(p, s_k) \ge l_k$$
4. **$HC_4$ (Proporção Hierárquica Realista — $HC_{4a} \land HC_{4b} \land HC_{4c}$):**
   * **$HC_{4a}$ (Base mínima de executores por trilha):**
     $$\forall t \in T, \quad \big( |L_t(Q)| + |G_t(Q)| > 0 \big) \implies \big( |E_t(Q)| \ge 2 \big)$$
   * **$HC_{4b}$ (Teto de liderança 1:3 por trilha):**
     $$\forall t \in T, \quad |L_t(Q)| \le \left\lfloor \frac{|E_t(Q)|}{3} \right\rfloor$$
   * **$HC_{4c}$ (Elegibilidade de Gerentes):**
     $$\left( \sum_{t \in T} |G_t(Q)| > 0 \right) \implies \big( |Q| \ge 6 \lor C_{reg} == \text{"Alta"} \big)$$
5. **$HC_5$ (Trava de Atrito Crítico Bilateral):**
   $$HC_5(Q) \equiv \Big( \exists p_a, p_b \in Q, a \neq b \mid p_a.\text{id} \in \text{atritos}(p_b) \land p_b.\text{id} \in \text{atritos}(p_a) \Big) \implies \Big( \exists p_f \in Q \mid \text{arq}(p_f) == \text{"Facilitador"} \Big)$$

### 2.3. Implementação de Referência em Python (Camada 1)

```python
from typing import List, Dict, Set, Any

CARGOS_EXECUTORES = {"Desenvolvedor", "Analista de Dados", "Designer de Produto"}
CARGOS_LIDERES    = {"Líder de Desenvolvimento", "Líder de Dados", "Líder de Design"}
CARGOS_GERENTES   = {"Gerente de Software", "Gerente de Dados", "Gerente de Produto"}
TRILHAS           = ("Engenharia", "Dados", "Produto & Design")

def is_squad_valid(
    squad: List[Dict[str, Any]],
    tamanho_min: int,
    tamanho_max: int,
    orcamento_max_hora: float,
    skills_obrigatorias: Dict[str, int],
    criticidade_regulatoria: str
) -> bool:
    n_members = len(squad)
    if not (tamanho_min <= n_members <= tamanho_max):
        return False
    if sum(p["custo_hora_brl"] for p in squad) > orcamento_max_hora:
        return False
    for skill_name, min_level in skills_obrigatorias.items():
        if not any(p["hard_skills"].get(skill_name, 0) >= min_level for p in squad):
            return False

    exec_count = {t: 0 for t in TRILHAS}
    lider_count = {t: 0 for t in TRILHAS}
    gerente_count = {t: 0 for t in TRILHAS}
    total_gerentes = 0
    has_facilitador = False

    for p in squad:
        t, cargo = p["trilha"], p["cargo"]
        if cargo in CARGOS_EXECUTORES:
            exec_count[t] += 1
        elif cargo in CARGOS_LIDERES:
            lider_count[t] += 1
        elif cargo in CARGOS_GERENTES:
            gerente_count[t] += 1
            total_gerentes += 1
        if p["arquetipo"] == "Facilitador":
            has_facilitador = True

    if total_gerentes > 0 and not (n_members >= 6 or criticidade_regulatoria == "Alta"):
        return False

    for t in TRILHAS:
        if (lider_count[t] + gerente_count[t]) > 0 and exec_count[t] < 2:
            return False
        if lider_count[t] > (exec_count[t] // 3):
            return False

    if not has_facilitador:
        squad_ids: Set[str] = {p["id"] for p in squad}
        atritos_map = {p["id"]: (p["atritos_ids"] & squad_ids) for p in squad}
        for id_a, atritos_de_a in atritos_map.items():
            for id_b in atritos_de_a:
                if id_a in atritos_map.get(id_b, set()):
                    return False

    return True
```

---

## 3. Equações de Scoring e Tabela de Pesos (Camadas 2 e 3)

### 3.1. Equação Global (`Score_Final`)
$$\text{Score\_Final}(Q) = W_1 \cdot S_{\text{Tecnico}}(Q) + W_2 \cdot S_{\text{Dominio}}(Q) + W_3 \cdot S_{\text{Quimica}}(Q) + W_4 \cdot S_{\text{RPG}}(Q) + W_5 \cdot S_{\text{Confiabilidade\_Custo}}(Q)$$
Onde $\sum_{i=1}^{5} W_i = 1.00$ e $\text{clamp}(x, a, b) = \max(a, \min(x, b))$.

---

### 3.2. Fórmulas Matemáticas dos 5 Sub-Índices (0 a 100)

#### 1. `S_Tecnico` (Aderência de Hard Skills)
Avalia $S_{eval} = K_{req} \cup K_{sol}$, onde $\omega_s = 2.0$ se $s \in K_{req}$ e $\omega_s = 1.0$ se $s \in K_{sol} \setminus K_{req}$.
* **Pacotes $K_{sol}$ por `tipo_solucao`:**
  * `"Software Preditivo/IA"`: `{Machine_Learning_Preditivo, Series_Temporais, Estatistica, Python_DS, Python, Cloud_AWS_GCP}`
  * `"Produto Digital/App"`: `{React, Node.js, APIs_REST, Design_System, Discovery_Usuario, Prototipacao_Figma, Metricas_Produto}`
  * `"Plataforma de Dados/BI"`: `{Engenharia_ETL, SQL_Avancado, Spark, PowerBI_Looker, Data_Visualization, Cloud_AWS_GCP}`
  * `"Sistema Crítico/IoT"`: `{Integracao_IoT_SCADA, Arquitetura_Microsservicos, Docker_K8s, APIs_REST, Python}`

Para cada skill $s \in S_{eval}$, ordenam-se os níveis dos membros de $Q$ em ordem decrescente ($v_{(1),s} \ge v_{(2),s} \ge \dots$):
$$E_s(Q) = 0.70 \cdot v_{(1),s} + 0.30 \cdot v_{(2),s}$$
$$S_{\text{Tecnico}}(Q) = 100 \times \frac{\sum_{s \in S_{eval}} \omega_s \cdot \left(\frac{E_s(Q)}{5.0}\right)}{\sum_{s \in S_{eval}} \omega_s}$$

#### 2. `S_Dominio` (Experiência Setorial)
Para o domínio solicitado $d_{req}$, seja $\rho(p) = 2.0$ para Líderes/Gerentes e $\rho(p) = 1.0$ para Executores, e $\delta(p, d_{req}) = 1$ se $d_{req} \in \text{dominios}(p)$ (ou $0$ caso contrário):
$$S_{\text{Dominio}}(Q) = 100 \times \frac{\sum_{p \in Q} \rho(p) \cdot \delta(p, d_{req})}{\sum_{p \in Q} \rho(p)}$$

#### 3. `S_Quimica` (Grafo de Afinidades e Atritos)
Partindo da base neutra $60.0$, sejam $A_{uni}(Q)$ os pares com afinidade unilateral, $A_{bi}(Q)$ os pares com afinidade mútua/bilateral, $C_{dir}(Q)$ o total de ocorrências direcionadas de atrito dentro do squad, e $\gamma_{fac}(Q) = 0.30$ se houver ao menos um `"Facilitador"` em $Q$ (ou $1.00$ caso contrário):
$$S_{\text{Quimica}}(Q) = \text{clamp}\Big( 60.0 + 8.0 \cdot A_{uni}(Q) + 20.0 \cdot A_{bi}(Q) - 20.0 \cdot \gamma_{fac}(Q) \cdot C_{dir}(Q), \; 0.0, \; 100.0 \Big)$$

#### 4. `S_RPG` (Sinergia de Arquétipos sob Contexto)
Sejam $n_{\text{AM}}, n_{\text{EP}}, n_{\text{FA}}, n_{\text{CA}}, n_{\text{BO}}$ as contagens de cada arquétipo no squad $Q$ de tamanho $N$:
$$S_{\text{RPG}}(Q) = \text{clamp}\Big( 60.0 + \Delta_{\text{Contexto}}(Q) + \Delta_{\text{Pares}}(Q) - P_{\text{Desequilibrio}}(Q), \; 0.0, \; 100.0 \Big)$$
* **Adequação Contextual ($\Delta_{\text{Contexto}}$):**
  $$\Delta_{\text{Contexto}}(Q) = \frac{5.0}{N} \times \Big( M_{\text{urg}}(Q) + M_{\text{sol\_crit}}(Q) \Big)$$
  * $M_{\text{urg}}$:
    * Se `urgencia_prazo` == `"Crítica"`: $+8.0 \cdot n_{\text{BO}} + 6.0 \cdot n_{\text{EP}} - 4.0 \cdot n_{\text{AM}} - 6.0 \cdot \max(0, n_{\text{AM}} - 1)$
    * Se `urgencia_prazo` == `"Baixa"`: $-4.0 \cdot n_{\text{BO}} + 3.0 \cdot n_{\text{AM}}$
    * Se `urgencia_prazo` == `"Normal"`: $0.0$
  * $M_{\text{sol\_crit}}$:
    * Se `tipo_solucao` == `"Software Preditivo/IA"` **E** `criticidade_regulatoria` == `"Alta"`: $+9.0 \cdot n_{\text{CA}} + 8.0 \cdot n_{\text{AM}}$
    * Se `tipo_solucao` == `"Software Preditivo/IA"` **OU** `criticidade_regulatoria` == `"Alta"` (apenas um verdadeiro): $+6.0 \cdot n_{\text{CA}} + 5.0 \cdot n_{\text{AM}}$
    * Caso contrário: $0.0$
* **Interação Par-a-Par ($\Delta_{\text{Pares}}$):**
  $$\Delta_{\text{Pares}}(Q) = \frac{10.0}{\binom{N}{2}} \sum_{\{p_a, p_b\} \subset Q} \Phi^*\big(\text{arq}(p_a), \text{arq}(p_b), n_{\text{FA}}\big)$$
* **Penalidade de Desequilíbrio Técnico ($P_{\text{Desequilibrio}}$):**
  $$P_{\text{Desequilibrio}}(Q) = \begin{cases} 25.0, & \text{se } n_{\text{EP}} \ge 2 \land (n_{\text{AM}} + n_{\text{CA}} == 0) \\ 0.0, & \text{caso contrário} \end{cases}$$

#### 5. `S_Confiabilidade_Custo` (Histórico de Sucesso e Eficiência Orçamentária)
$$S_{\text{Confiabilidade\_Custo}}(Q) = 0.60 \cdot S_{\text{Sucesso}}(Q) + 0.40 \cdot S_{\text{Eficiencia}}(r)$$
Onde $S_{\text{Sucesso}}(Q) = \frac{1}{N} \sum_{p \in Q} \text{taxa\_sucesso\_pct}(p)$ e $r = \frac{\sum_{p \in Q} \text{custo}(p)}{B_{max}}$:
$$S_{\text{Eficiencia}}(r) = \begin{cases} 100.0 \cdot r, & \text{se } 0.00 \le r < 0.50 \\ 50.0 + 166.67 \cdot (r - 0.50), & \text{se } 0.50 \le r < 0.80 \\ 100.0, & \text{se } 0.80 \le r \le 0.95 \\ 100.0 - 600.0 \cdot (r - 0.95), & \text{se } 0.95 < r \le 1.00 \end{cases}$$

---

### 3.3. Camada 3: Tabela de Pesos Dinâmicos por Cenário ($W_1$ a $W_5$)

| `tipo_solucao` | `urgencia_prazo` | $W_1$ (`S_Tecnico`) | $W_2$ (`S_Dominio`) | $W_3$ (`S_Quimica`) | $W_4$ (`S_RPG`) | $W_5$ (`S_Confiab_Custo`) |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **Software Preditivo/IA** | **Baixa** | 0.35 | 0.25 | 0.10 | 0.15 | 0.15 |
| **Software Preditivo/IA** | **Normal** | 0.30 | 0.20 | 0.15 | 0.20 | 0.15 |
| **Software Preditivo/IA** | **Crítica** | 0.28 | 0.15 | 0.17 | 0.25 | 0.15 |
| **Sistema Crítico/IoT** | **Baixa** | 0.32 | 0.23 | 0.10 | 0.15 | 0.20 |
| **Sistema Crítico/IoT** | **Normal** | 0.30 | 0.20 | 0.12 | 0.18 | 0.20 |
| **Sistema Crítico/IoT** | **Crítica** | 0.25 | 0.15 | 0.18 | 0.25 | 0.17 |
| **Produto Digital/App** | **Baixa** | 0.25 | 0.20 | 0.20 | 0.15 | 0.20 |
| **Produto Digital/App** | **Normal** | 0.25 | 0.18 | 0.22 | 0.18 | 0.17 |
| **Produto Digital/App** | **Crítica** | 0.22 | 0.12 | 0.23 | 0.28 | 0.15 |
| **Plataforma de Dados/BI** | **Baixa** | 0.30 | 0.25 | 0.12 | 0.13 | 0.20 |
| **Plataforma de Dados/BI** | **Normal** | 0.28 | 0.22 | 0.15 | 0.15 | 0.20 |
| **Plataforma de Dados/BI** | **Crítica** | 0.25 | 0.17 | 0.18 | 0.23 | 0.17 |

* **Regra de Ajuste Fino para `criticidade_regulatoria` == `"Alta"`:** Aplica-se um *shift* protetivo sobre a linha selecionada: **$W_4 + 0.02$**, **$W_5 + 0.01$** e **$W_3 - 0.03$** (mantendo $\sum W_i = 1.00$).

---

## 4. Matriz de Interação de Arquétipos (5x5)

### 4.1. Tabela de Modificadores Par-a-Par ($\Phi^*$)

| Arquétipo A \ Arquétipo B | **Arquiteto Metódico (AM)** | **Executor Pragmático (EP)** | **Facilitador (FA)** | **Cético Analítico (CA)** | **Bombeiro (BO)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Arquiteto Metódico (AM)** | **$+0.5$** | **$-1.5^*$** *(ou $0.0$ se $n_{\text{FA}} \ge 1$)* | **$+1.0$** | **$+2.0$** | **$-0.5$** |
| **Executor Pragmático (EP)** | **$-1.5^*$** *(ou $0.0$ se $n_{\text{FA}} \ge 1$)* | **$-0.5^{**}$** | **$+1.5$** | **$0.0$** | **$+1.0$** |
| **Facilitador (FA)** | **$+1.0$** | **$+1.5$** | **$+0.5$** | **$+1.0$** | **$+1.0$** |
| **Cético Analítico (CA)** | **$+2.0$** | **$0.0$** | **$+1.0$** | **$+0.5$** | **$-1.0$** |
| **Bombeiro (BO)** | **$-0.5$** | **$+1.0$** | **$+1.0$** | **$-1.0$** | **$0.0$** |

### 4.2. Regras de Negócio da Matriz 5x5
* **`AM` $\times$ `CA` ($+2.0$):** Sinergia máxima de qualidade arquitetural e validação analítica de edge-cases.
* **`EP` $\times$ `FA` ($+1.5$):** Sinergia alta de execução assistida e desbloqueio de comunicação entre trilhas.
* **`AM` $\times$ `EP` ($-1.5^*$ ou $0.0$):** Conflito natural entre planejamento metódico e pragmatismo imediato; é **100% neutralizado ($\Phi^* = 0.0$)** quando há ao menos 1 `Facilitador` ($n_{\text{FA}} \ge 1$) no squad.
* **`CA` $\times$ `BO` ($-1.0$):** Atrito entre análise profunda e reação imediata.
* **`EP` $\times$ `EP` ($-0.5^{**}$):** Competição por atalhos técnicos (além de acionar $P_{\text{Desequilibrio}} = -25.0$ caso $n_{\text{AM}} + n_{\text{CA}} == 0$).

---

## 5. Simulação de Calibragem Validada (Caso Benchmark Neoenergia)

### 5.1. Parâmetros de Entrada do Caso Neoenergia
* **`dominio_setorial`:** `"Energia_Utilities"`
* **`tipo_solucao`:** `"Software Preditivo/IA"` ($K_{sol} = \{\text{Machine\_Learning\_Preditivo}, \text{Series\_Temporais}, \text{Estatistica}, \text{Python\_DS}, \text{Python}, \text{Cloud\_AWS\_GCP}\}$)
* **`skills_obrigatorias` ($K_{req}$, nível mínimo $\ge 4$, peso $\omega_s = 2.0$):** `Series_Temporais` $\ge 4$, `Machine_Learning_Preditivo` $\ge 4$, `Integracao_IoT_SCADA` $\ge 4$, `Python` $\ge 4$
* **`orcamento_max_hora` ($B_{max}$):** $\text{R\$ } 1.000,00\text{/h}$ (Faixa ótima $[80\%, 95\%] = \text{R\$ } 800\text{/h a R\$ } 950\text{/h}$)
* **`tamanho_squad`:** $5$ a $7$ integrantes
* **`urgencia_prazo`:** `"Normal"`
* **`criticidade_regulatoria`:** `"Alta"` (Pesos ajustados: $W_1 = 0.30, W_2 = 0.20, W_3 = 0.12, W_4 = 0.22, W_5 = 0.16$)

---

### 5.2. Composição Nominal do Squad Campeão (`['P06', 'P09', 'P15', 'P37', 'P42', 'P45']`)

| ID | Cargo | Trilha | Senioridade | Custo/h | Arquétipo | Taxa Sucesso | Domínio `Energia_Utilities` | Hard Skills na Base (`nivel`) |
| :--- | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- |
| **`P06`** | Desenvolvedor | Engenharia | Pleno | R$ 111 | **Facilitador** | 84% | **Sim** | `Integracao_IoT_SCADA`: **5**, `APIs_REST`: 4, `Arquitetura_Microsservicos`: 3, `Docker_K8s`: 3 |
| **`P09`** | Desenvolvedor | Engenharia | Sênior | R$ 173 | **Cético Analítico** | 77% | **Sim** | `APIs_REST`: 5, `Docker_K8s`: 5, `Cloud_AWS_GCP`: **4**, `Arquitetura_Microsservicos`: 4 |
| **`P15`** | Desenvolvedor | Engenharia | Sênior | R$ 165 | **Cético Analítico** | 95% | **Sim** | `Integracao_IoT_SCADA`: **5**, `Python`: **5**, `Cloud_AWS_GCP`: **5**, `Node.js`: 5 |
| **`P37`** | Analista de Dados | Dados | Júnior | R$ 66 | **Executor Pragmático** | 76% | **Sim** | `Machine_Learning_Preditivo`: **4**, `Estatistica`: **4**, `Python_DS`: **4**, `Series_Temporais`: **3** |
| **`P42`** | Analista de Dados | Dados | Pleno | R$ 119 | **Arquiteto Metódico** | 96% | **Sim** | `Estatistica`: **5**, `Series_Temporais`: **4**, `Machine_Learning_Preditivo`: **3**, `Spark`: 3 |
| **`P45`** | Gerente de Dados | Dados | Especialista | R$ 232 | **Arquiteto Metódico** | 99% | **Sim** | `Series_Temporais`: **5**, `Engenharia_ETL`: 5, `SQL_Avancado`: 4, `PowerBI_Looker`: 4 |
| **TOTAL** | **5 Exec. + 1 Ger.** | **3 Eng / 3 Dad** | **1 Jr, 2 Pl, 2 Sr, 1 Esp** | **R$ 866** | **2 CA, 2 AM, 1 FA, 1 EP** | **Média: 87,83%** | **6 de 6 (100%)** | **100% Aprovado em $HC_1 \dots HC_5$** |

---

### 5.3. Memória de Cálculo dos 5 Sub-Índices do Squad Campeão

1. **`S_Tecnico` $= 83.64$:**
   * Skills Obrigatórias ($\omega_s = 2.0$):
     * `Integracao_IoT_SCADA`: Top1 `P15` (5), Top2 `P06` (5) $\implies E_s = 5.00 \implies 2.0 \times (5.00/5) = \mathbf{2.000}$
     * `Series_Temporais`: Top1 `P45` (5), Top2 `P42` (4) $\implies E_s = 4.70 \implies 2.0 \times (4.70/5) = \mathbf{1.880}$
     * `Machine_Learning_Preditivo`: Top1 `P37` (4), Top2 `P42` (3) $\implies E_s = 3.70 \implies 2.0 \times (3.70/5) = \mathbf{1.480}$
     * `Python`: Top1 `P15` (5), Top2 (0) $\implies E_s = 3.50 \implies 2.0 \times (3.50/5) = \mathbf{1.400}$
   * Skills Nativas Complementares de IA ($\omega_s = 1.0$):
     * `Cloud_AWS_GCP`: Top1 `P15` (5), Top2 `P09` (4) $\implies E_s = 4.70 \implies 1.0 \times (4.70/5) = \mathbf{0.940}$
     * `Estatistica`: Top1 `P42` (5), Top2 `P37` (4) $\implies E_s = 4.70 \implies 1.0 \times (4.70/5) = \mathbf{0.940}$
     * `Python_DS`: Top1 `P37` (4), Top2 (0) $\implies E_s = 2.80 \implies 1.0 \times (2.80/5) = \mathbf{0.560}$
   * Cálculo: $S_{\text{Tecnico}} = 100 \times \frac{9.200}{11.0} = \mathbf{83.64}$.

2. **`S_Dominio` $= 100.00$:**
   * Todos os 5 Executores (`P06, P09, P15, P37, P42` $= 5 \times 1.0$) e o Gerente de Dados (`P45` $= 1 \times 2.0$) possuem `Energia_Utilities`:
   * Cálculo: $S_{\text{Dominio}} = 100 \times \frac{5.0 + 2.0}{5.0 + 2.0} = \mathbf{100.00}$.

3. **`S_Quimica` $= 70.00$:**
   * Afinidades Unilaterais ($A_{uni} = 2$): `P06` $\rightarrow$ `P42` e `P09` $\rightarrow$ `P37` ($+16.0\text{ pts}$).
   * Afinidades Bilaterais ($A_{bi} = 0$): $0.0\text{ pts}$.
   * Atrito Unilateral ($C_{dir} = 1$): `P06` $\rightarrow$ `P15`, atenuado em 70% ($\gamma_{fac} = 0.30$) por `P06` ser `Facilitador` ($-20.0 \times 0.30 \times 1 = -6.0\text{ pts}$).
   * Cálculo: $S_{\text{Quimica}} = 60.0 + 16.0 - 6.0 = \mathbf{70.00}$.

4. **`S_RPG` $= 98.00$:**
   * $\Delta_{\text{Contexto}} = \frac{5.0}{6} \times [9.0(2\text{ CA}) + 8.0(2\text{ AM})] = \frac{5.0}{6} \times 34.0 = \mathbf{+28.33}$.
   * $\Delta_{\text{Pares}}$ (15 pares): 4 `AM`$\times$`CA` ($+8.0$) + 2 `FA`$\times$`CA` ($+2.0$) + 2 `FA`$\times$`AM` ($+2.0$) + 1 `FA`$\times$`EP` ($+1.5$) + 1 `CA`$\times$`CA` ($+0.5$) + 1 `AM`$\times$`AM` ($+0.5$) + 2 `CA`$\times$`EP` ($0.0$) + 2 `AM`$\times$`EP` neutralizados por `P06` ($0.0$) $= +14.50 \implies \frac{10.0}{15} \times 14.50 = \mathbf{+9.67}$.
   * $P_{\text{Desequilibrio}} = 0.0$.
   * Cálculo: $S_{\text{RPG}} = 60.0 + 28.33 + 9.67 = \mathbf{98.00}$.

5. **`S_Confiabilidade_Custo` $= 92.70$:**
   * Média de Sucesso ($S_{\text{Sucesso}}$): $(84 + 77 + 95 + 76 + 96 + 99) / 6 = \mathbf{87.83\%}$.
   * Eficiência Orçamentária ($S_{\text{Eficiencia}}$): Custo $= \text{R\$ } 866\text{/h}$ ($r = 0.866 \in [0.80, 0.95] \implies \mathbf{100.00}$).
   * Cálculo: $S_{\text{Confiabilidade\_Custo}} = 0.60(87.833) + 0.40(100.00) = 52.70 + 40.00 = \mathbf{92.70}$.

---

### 5.4. Tabela de Benchmark Comparativo Final e Justificativa de Vitória

| Dimensão / Sub-Índice | Peso ($W_i$) | 🏆 **1º Lugar: Squad Campeão**<br>`[P06, P09, P15, P37, P42, P45]` | 🥈 **2º Lugar: Alternativa B**<br>`[P09, P13, P15, P37, P42, P45]` | 🥉 **3º Lugar: Alternativa A**<br>`[P03, P15, P31, P32, P42, P43]` |
| :--- | :---: | :---: | :---: | :---: |
| **Tamanho e Estrutura** | — | 6 pessoas (3 Eng / 3 Dados) | 6 pessoas (3 Eng / 3 Dados) | 6 pessoas (2 Eng / 4 Dados) |
| **Custo Total / Hora (% Orçamento)** | — | **R$ 866/h** ($86,6\%$ — Ótimo) | **R$ 860/h** ($86,0\%$ — Ótimo) | **R$ 771/h** ($77,1\%$ — Subutilizado) |
| **1. $S_{\text{Tecnico}}$** *(Bruto $\rightarrow$ Ponderado)* | **$0.30$** | $83.64 \rightarrow \mathbf{25.09\text{ pts}}$ | $86.91 \rightarrow \mathbf{26.07\text{ pts}}$ | $91.45 \rightarrow \mathbf{27.44\text{ pts}}$ |
| **2. $S_{\text{Dominio}}$** *(Bruto $\rightarrow$ Ponderado)* | **$0.20$** | $\mathbf{100.00 \rightarrow 20.00\text{ pts}}$ | $85.71 \rightarrow \mathbf{17.14\text{ pts}}$ | $71.43 \rightarrow \mathbf{14.29\text{ pts}}$ |
| **3. $S_{\text{Quimica}}$** *(Bruto $\rightarrow$ Ponderado)* | **$0.12$** | $70.00 \rightarrow \mathbf{8.40\text{ pts}}$ | $76.00 \rightarrow \mathbf{9.12\text{ pts}}$ | $84.00 \rightarrow \mathbf{10.08\text{ pts}}$ |
| **4. $S_{\text{RPG}}$** *(Bruto $\rightarrow$ Ponderado)* | **$0.22$** | $98.00 \rightarrow \mathbf{21.56\text{ pts}}$ | $100.00 \rightarrow \mathbf{22.00\text{ pts}}$ | $100.00 \rightarrow \mathbf{22.00\text{ pts}}$ |
| **5. $S_{\text{Confiab\_Custo}}$** *(Bruto $\rightarrow$ Ponderado)* | **$0.16$** | $\mathbf{92.70 \rightarrow 14.83\text{ pts}}$ | $92.20 \rightarrow \mathbf{14.75\text{ pts}}$ | $91.97 \rightarrow \mathbf{14.71\text{ pts}}$ |
| **SCORE FINAL GLOBAL (0 a 100)** | **$1.00$** | 🏆 **$89.88\text{ pontos}$** | 🥈 **$89.09\text{ pontos}$** *($-0.79$)* | 🥉 **$88.52\text{ pontos}$** *($-1.36$)* |

#### Síntese Decisória:
1. **Domínio Integral do Setor Elétrico (`100.00` em `S_Dominio`):** O Squad Campeão contorna o gargalo da trilha de Dados escalando os dois únicos Analistas de Dados com histórico em `Energia_Utilities` (`P37` e `P42`) mais o Gerente de Dados `P45` (peso $2.0\times$, viabilizado por $HC_{4c}$ sob `Criticidade == Alta` exigindo apenas 2 executores da trilha). A **Alternativa A** perde **$-5.71\text{ pontos}$ ponderados** em domínio ao recorrer a analistas sem vivência no setor elétrico (`P31`, `P32`) e sofre penalidade por subutilizar o orçamento ($77,1\% < 80\%$).
2. **Superioridade do Facilitador `P06` sobre `P13` (Vitória sobre a Alternativa B):** Ao manter `P06` no lugar de `P13`, o Squad Campeão assegura **redundância máxima (nível 5 + nível 5)** em `Integracao_IoT_SCADA`, atinge $100\%$ em `S_Dominio` ($+2.86\text{ pts}$ líquidos no Score Global), neutraliza o conflito `AM` $\times$ `EP` na Matriz 5x5 e atenua em $70\%$ o atrito unilateral com `P15`.