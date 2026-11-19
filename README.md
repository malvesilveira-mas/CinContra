# CinContra — Motor Determinístico de Recomendação e Simulação de Squads

Plataforma **White-Box AI** para formação otimizada de squads multidisciplinares com grafo interativo de afinidades/atritos e simulação **What-If** em tempo real via *drag-and-drop*.

O motor matemático determinístico (Branch-and-Bound Hierárquico com bitmasks 64-bit, matrizes 2D $O(1)$ e LUT de sinergia RPG 5x5) encontra recomendações ótimas e diversas em **< 120 ms** sobre a base de **60 profissionais** (`squad_rpg_60.csv`) e recalcula alterações manuais no grafo em **< 5 ms**.

---

# CinContra — Engenharia Explicável de Squads (*White-Box AI*)

O **CinContra** substitui a montagem manual e intuitiva de equipes de tecnologia por uma arquitetura determinística e explicável (*White-Box AI*). A plataforma cruza requisitos técnicos do projeto, experiência setorial, arquétipos comportamentais, orçamento/hora e histórico interpessoal (afinidades e atritos) para encontrar e validar a formação ideal em menos de **200 ms**.

---

## Funcionalidades Principais

* **Configuração de Parâmetros da Missão (Painel Esquerdo):**
  * **Setor e Tipo de Solução:** Define o contexto de negócio (ex.: *Energia & Utilities*, *Fintech*, *Saúde*) e a natureza técnica da entrega (ex.: *ML Preditivo*, *Integração IoT / SCADA*, *Séries Temporais*).
  * **Skills Obrigatórias e Nível Mínimo:** Exige competências técnicas específicas e o nível de proficiência mínimo (`1` a `5`) que o squad deve cobrir.
  * **Restrições Operacionais:** Controla o **Orçamento Máximo por Hora (`R$/h`)**, o **Tamanho da Equipe** (mínimo e máximo de membros), o **Prazo** e o **Nível de Criticidade**.
* **Motor de Recomendação Automática (Top 5 Squads):**
  * Executa um algoritmo *Branch-and-Bound* determinístico sobre a base de talentos (`squad_rpg_60.csv`) e ranqueia as **5 melhores formações** (`1º Campeão` ao `5º`).
  * **Modo Fallback Inteligente (*Soft Constraints*):** Caso o usuário defina parâmetros impossíveis de cumprir simultaneamente, a plataforma flexibiliza automaticamente as travas, entrega o Top 5 com o maior *Score Final* possível dentro do pedido e exibe um diagnóstico detalhando quais regras ($HC_1 \dots HC_5$) precisaram ser adaptadas.
* **Grafo Relacional Interativo (Área Central):**
  * Exibe os integrantes do squad como nós conectados por arestas dinâmicas:
    * **Linhas Verdes (Afinidade):** Indicam sinergia e histórico positivo de colaboração.
    * **Linhas Vermelhas (Atrito):** Alertam sobre conflitos interpessoais ou incompatibilidade operacional.
  * **Design Emocional:** Conta com um personagem animado em estética *slim line-art* na base da interface para humanizar a leitura dos dados e reduzir a fadiga cognitiva.
* **Simulador "What-If" via Drag-and-Drop:**
  * Permite arrastar profissionais do **Banco de Talentos** lateral e soltá-los diretamente sobre membros do grafo central.
  * Recalcula instantaneamente custos, conexões e métricas sem zerar os indicadores, exibindo um alerta visual discreto caso a troca manual viole alguma regra de orçamento, tamanho ou skill obrigatória.
* **Painel de Métricas Explicáveis (*Resultados da Combinação*):**
  * Apresenta o **Score Total (`0` a `100`)**, o **Custo Total por Hora** comparado ao teto definido e **5 sub-índices de desempenho**:
    1. **Competência Técnica:** Cobertura e profundidade das skills exigidas.
    2. **Domínio do Setor:** Experiência prévia dos membros no segmento da missão.
    3. **Química da Equipe:** Saldo líquido entre afinidades e atritos interpessoais.
    4. **Equilíbrio de Perfis:** Diversidade complementar de arquétipos dentro do squad.
    5. **Eficiência de Custo & Entrega:** Relação entre valor/hora, teto orçamentário e confiabilidade de prazo.

---

## Como Usar (Passo a Passo)

1. **Defina a Missão:** No painel esquerdo, selecione o **Setor**, o **Tipo de Solução**, adicione as **Skills Obrigatórias** com seus níveis mínimos e ajuste o **Orçamento Máximo (`R$/h`)** e o **Tamanho da Equipe**.
2. **Gere as Recomendações:** Acione a busca para visualizar o squad `1º Campeão` no grafo central e suas métricas detalhadas no card de resultados.
3. **Compare o Pódio:** Navegue entre as posições `1º` ao `5º` na barra superior para comparar custo/hora, equilíbrio de perfis e *Score Total* entre as melhores alternativas.
4. **Simule Trocas (*What-If*):** Arraste qualquer profissional da lista lateral e solte sobre um integrante do grafo para testar substituições em tempo real e observar o impacto nas linhas de afinidade/atrito e nas 5 barras de métricas.
5. **Audite os Alertas:** Caso apareça um aviso de regra descumprida no painel de resultados (ex.: orçamento excedido ou skill abaixo do nível exigido), ajuste a composição no grafo ou revise os parâmetros até atingir uma formação 100% válida.

---

## Arquitetura do Sistema

```text
CinContra/
├── backend/                  # API REST FastAPI + SQLAlchemy (SQLite) + Motor Branch-and-Bound
│   ├── app/
│   │   ├── database.py       # Engine SQLite (suporte a DATABASE_URL em volume Docker)
│   │   ├── engine.py         # SquadRecommendationEngine (B&B < 120 ms, Fallback Relaxado, What-If < 5 ms)
│   │   ├── main.py           # Aplicação FastAPI, CORS, lifespan e rotas (/ e /api/v1)
│   │   ├── models.py         # Modelo ORM ProfessionalModel
│   │   ├── normalizer.py     # Normalização bidirecional (UI labels <-> códigos canônicos do CSV)
│   │   ├── schemas.py        # Contratos Pydantic v2 (aceita snake_case e camelCase)
│   │   └── seed.py           # Seed automático de squad_rpg_60.csv no SQLite
│   ├── tests/
│   │   └── test_api.py       # Suíte automatizada validando /professionals, /recommend e /simulate
│   ├── Dockerfile            # python:3.11-slim + Uvicorn na porta 8000
│   ├── requirements.txt
│   └── squad_rpg_60.csv      # Cópia embarcada para build isolado do container
├── cincontra_front/          # Interface React 19 + TypeScript + Tailwind v4 + Vite 8
│   ├── src/
│   │   ├── components/       # Grafo anticolisão (AABB + ResizeObserver), cenário cel line-art, carregamento 0%–100%, Banco, Parâmetros e Resultados
│   │   ├── data/             # Catálogos de labels e tipos canônicos
│   │   ├── services/api.ts   # Cliente HTTP com rotas relativas (proxy Vite/Nginx)
│   │   └── types/            # Contratos TypeScript
│   ├── Dockerfile            # Multi-stage: node:20-alpine (build) -> nginx:alpine
│   └── nginx.conf            # Proxy reverso para /api/ e /professionals, /recommend, /simulate, /health
├── docker-compose.yml        # Orquestração backend + frontend + volume sqlite_data
├── .env.example              # Variáveis de ambiente de referência
├── matriz-decisao.md         # Especificação matemática (Camadas 1, 2 e 3 + Matriz 5x5)
├── motor matemático CITi.md  # Arquitetura e referência do algoritmo Branch-and-Bound
└── squad_rpg_60.csv          # Fonte da verdade dos 60 profissionais
```

### Interface & UX (`cincontra_front`)

- **Grafo Interativo Anticolisão (`SquadRelationGraph.tsx` + `App.tsx`):** posicionamento em anel com *solver* determinístico AABB, escala adaptativa via `ResizeObserver`, popovers com abertura inteligente próxima às bordas e área segura responsiva para evitar sobreposição com `Resultados da Combinação`, `Banco de Talentos` e `Parâmetros`.
- **Cenário Animado Inferior (`BottomSceneryCanvas.tsx`):** personagem estilizado em *cel line-art* com transições contínuas entre os cenários urbano (com fones e notas musicais), natureza e submarino.
- **Carregamento Progressivo (`ComputingOverlay.tsx`):** janela de processamento estético de `30` segundos exibindo o progresso das combinações avaliadas em porcentagem (`0%` a `100%`), com atalho de conclusão imediata para demonstração.

---

## Como Funciona o Motor Matemático (White-Box AI)

### Camada 1 — Hard Constraints ($HC_1$ a $HC_5$)

1. **$HC_1$ (Cardinalidade):** `tamanho_min <= |Q| <= tamanho_max` (range configurável de 4 a 8 membros).
2. **$HC_2$ (Orçamento):** $\sum_{p \in Q} \text{custo}(p) \le B_{\max}$.
3. **$HC_3$ (Escopo Técnico por Cobertura de Squad):** Cada skill em `skills_obrigatorias` deve ser coberta por ao menos um membro do squad com nível igual ou superior ao exigido (1 a 5).
4. **$HC_4$ (Proporção Hierárquica):**
   - **$HC_{4a}$:** Qualquer trilha com Líder ou Gerente exige $\ge 2$ Executores nessa trilha.
   - **$HC_{4b}$:** Teto de 1 Líder para cada 3 Executores por trilha.
   - **$HC_{4c}$:** Gerentes exigem squad com $|Q| \ge 6$ ou `criticidade_regulatoria == "Alta"`.
5. **$HC_5$ (Atritos e Mediação por Facilitador):** Pares com atrito bilateral crítico (ex.: `P39 <-> P41`) exigem ao menos 1 profissional com arquétipo `Facilitador` no squad. Na Camada 2 (`S_Quimica`), o Facilitador amortece penalidades de atrito em 70% e neutraliza choques entre *Arquiteto Metódico* e *Executor Pragmático*.

### Camada 2 & 3 — Sub-Índices (`ui_metrics`), Pesos Dinâmicos e Comportamento em Violação

```math
\text{Score\_Final}(Q) = W_1 S_{\text{Tecnico}} + W_2 S_{\text{Dominio}} + W_3 S_{\text{Quimica}} + W_4 S_{\text{RPG}} + W_5 S_{\text{Confiabilidade\_Custo}}
```
- **Mapeamento na Interface (`Resultados da Combinação`):**
  - `S_Tecnico` $\rightarrow$ **Competência Técnica**
  - `S_Dominio` $\rightarrow$ **Domínio do Setor**
  - `S_Quimica` $\rightarrow$ **Química da Equipe**
  - `S_RPG` $\rightarrow$ **Equilíbrio de Perfis**
  - `S_Confiabilidade_Custo` $\rightarrow$ **Eficiência de Custo & Entrega**
- **Diversidade no Pódio Top 5:** Cada equipe ranqueada (`1º Campeão` ao `5º`) difere de todas as superiores em pelo menos **2 integrantes** (`min_diff_members = 2`).
- **Busca em 2 Etapas (`/recommend`):** Primeiro busca o Top 5 ideal que atende 100% de $HC_1 \dots HC_5$; caso não exista solução viável, ativa o **Modo Fallback Relaxado** (`is_feasible = false`), retornando os 5 squads de maior `score_final` com `violations` detalhadas e mantendo os valores reais do score e das 5 barras em `ui_metrics`.
- **Simulação What-If (`/simulate`):** Em violações de $HC_1 \dots HC_5$ via *drag-and-drop*, o motor **não zera** o `score_final` nem as 5 barras em `ui_metrics`, retornando `is_valid = false`, a lista `violations` e exibindo na UI um aviso integrado à estética da aplicação indicando qual regra foi descumprida.

---

## Executando com Docker Compose (Recomendado)

### Pré-requisitos
- Docker e Docker Compose v2 ativos na máquina.

### Passo a passo
1. *(Opcional)* Copie o arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   ```
2. Construa e suba os containers em segundo plano:
   ```bash
   docker compose up --build -d
   ```
3. Acesse a aplicação:
   - **Frontend (Nginx + Proxy Reverso):** `http://localhost:3000` (ou `http://<IP-DA-MAQUINA>:3000` em outras máquinas da rede)
   - **Backend (Swagger/OpenAPI):** `http://localhost:8000/docs`
   - **Healthcheck:** `http://localhost:8000/health`

O banco SQLite é persistido automaticamente no volume nomeado `sqlite_data` (`/app/data/squads.db`) e populado no startup com os 60 profissionais de `squad_rpg_60.csv`.

---

## Executando Localmente (Desenvolvimento)

### 1. Backend (Python 3.11+)
```bash
pip install -r backend/requirements.txt
uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000 --reload
```
*(Para expor na rede local fora do Docker, utilize `--host 0.0.0.0`.)*

### 2. Frontend (Node.js 20+)
```bash
cd cincontra_front
npm install --legacy-peer-deps
npm run dev
```
O servidor Vite inicia em `http://localhost:3000` com proxy configurado em `vite.config.ts` para `http://127.0.0.1:8000`.

---

## Endpoints da API REST

As rotas estão expostas tanto no formato curto quanto sob o prefixo `/api/v1`, aceitando requisições em `snake_case` ou `camelCase` e normalizando automaticamente rótulos da UI (como `"Energia & Utilities"`, `"Séries Temporais"`, `"ML Preditivo"`, `"Integração IoT / SCADA"`).

| Método | Rotas | Descrição |
| :--- | :--- | :--- |
| `GET` | `/health` <br> `/api/v1/health` | Status da API e contagem de profissionais indexados. |
| `GET` | `/professionals` <br> `/api/v1/professionals` | Lista os 60 profissionais do SQLite + catálogos de skills e domínios. |
| `POST` | `/recommend` <br> `/api/v1/squads/recommend` | Retorna o Top 5 squads recomendados (< 120 ms), pesos aplicados, sub-índices e arestas sociais. |
| `POST` | `/simulate` <br> `/api/v1/squads/simulate` | Recalcula em tempo real (< 5 ms) o squad modificado via *drag-and-drop*, deltas e violações $HC_1 \dots HC_5$. |

---

## Testes Automatizados

Execute a suíte de validação do backend (seed SQLite, benchmark Neoenergia `5..7` e `6..6`, normalização de labels da UI, fallback relaxado e simulação What-If):

```bash
python backend/tests/test_api.py
```

Para validar tipos e build de produção do frontend:

```bash
npm --prefix cincontra_front run lint
npm --prefix cincontra_front run build
```

---

## Ferramentas do Plano Google AI Pro Utilizadas no Fluxo

- **Google AI Studio:** Prototipagem do motor de recomendação, validação da arquitetura, geração da interface inicial (`cincontra_front`) e refinamentos visuais do personagem em *cel line-art* e do grafo anticolisão com modelos avançados como Gemini 4 Argon.
- **Google Colab:** Execução e medição de performance do protótipo do motor em Python com os 60 profissionais (`squad_rpg_60.csv`).
- **Google Antigravity:** Desenvolvimento agêntico do `/backend` em FastAPI, integração com `cincontra_front`, ajustes de layout responsivo, execução de testes, validação visual no navegador e configuração do ambiente Docker com modelos como Gemini 4 Argon e Opus 5.5.
- **Pesquisa Google / Google Workspace / Gemini Notebook:** Apoio à pesquisa, documentação e organização do fluxo de trabalho do projeto.
- **Gemini:** Planejamento geral do projeto
- **ElevenLabs:** Geração da voz
- **Google Flow:** Geração do vídeo
