# FluxoHub vs GueClaw — Relação Entre os Projetos

> Este documento esclarece o que é cada projeto, como se relacionam, e onde cada um opera.

---

## 1. Resumo Rápido

| | GueClaw | FluxoHub |
|---|---|---|
| **O que é** | Bot pessoal de assistência via Telegram | Motor de automação de workflows code-first |
| **Interface** | Telegram (mensagens de texto, comandos) | API HTTP (Fastify) + Frontend web |
| **Runtime** | VPS Ubuntu, PM2, processo único | VPS, Docker containers, BullMQ + Redis |
| **LLM** | Sim — é o "cérebro" central | Sim — geração de nós JS, análise de execuções |
| **Banco** | SQLite local | Supabase (PostgreSQL hosted) |
| **Repositório** | `github.com/Moisesjr20/gueclaw` | Repositório separado (monorepo npm workspaces) |
| **Usuário alvo** | Moises (uso pessoal) | Clientes / fluxos de negócio |

---

## 2. O Que é o GueClaw

GueClaw é um **agente de IA pessoal** que roda no VPS e se comunica exclusivamente via Telegram. Ele:

- Recebe mensagens de texto do usuário autorizado (Moises)
- Usa um LLM para entender a intenção e rotear para a skill correta
- Executa tools (SSH no VPS, chamadas a APIs externas, operações de arquivo)
- Responde de volta no Telegram

**Analogia:** GueClaw é como um "DevOps sênior disponível 24h via Telegram". Você digita "docker ps" ou "crie um evento no calendário sexta às 14h" e ele executa.

---

## 3. O Que é o FluxoHub

FluxoHub é um **motor de orquestração de workflows** para uso empresarial. Ele:

- Permite criar workflows visuais (DAG — grafos acíclicos direcionados) com nós de código JavaScript
- Processa formulários web → dispara execuções → loga cada passo
- Usa BullMQ + Redis para fila de jobs assíncronos
- Tem pacotes separados: `api` (Fastify), `worker`, `orchestrator-core`, `execution-queue`, `sandbox`, `frontend`

**Analogia:** FluxoHub é um `n8n` ou `Zapier` customizado, mas code-first — os nós são scripts JS escritos pela IA.

---

## 4. O Que é Compartilhado: Framework DOE

O único elemento realmente compartilhado entre os dois projetos é o **Framework DOE** (Directives → Orchestration → Execution):

```
Layer 1: Directives  — Documentos Markdown que definem comportamento e regras
Layer 2: Orchestration — O agente (LLM) que lê as Directives e planeja
Layer 3: Execution   — Scripts determinísticos que executam as ações
```

| Artefato DOE | Localização no GueClaw | Uso no FluxoHub |
|---|---|---|
| `DOE/Directives.md` | Define regras do agente GueClaw | Define regras do agente FluxoHub |
| `DOE/Orchestration.md` | Descreve o loop ReAct | Descreve o loop de orquestração |
| `DOE/Executions.md` | Scripts de execução do GueClaw | Scripts de execução do FluxoHub |
| `DOE/fluxohub_architecture_guide.md` | Referência (contexto) | **Documento principal do FluxoHub** |
| `DOE/agents.md` | Personas de agentes disponíveis | Compartilhado |
| `DOE/Checklist.md` | Checklist de tarefas | Checklist de tarefas |

> **Importante:** Os arquivos no diretório `DOE/` deste repositório são um **espelho ou referência** da arquitetura do FluxoHub. O código do FluxoHub vive em seu próprio repositório separado.

---

## 5. Relação Operacional

```
┌─────────────────────────────────────────────────────────┐
│                        VPS Ubuntu                        │
│                                                          │
│  ┌──────────────────┐      ┌──────────────────────────┐  │
│  │    GueClaw       │      │       FluxoHub           │  │
│  │  (PM2 process)   │      │  (Docker containers)     │  │
│  │                  │      │                          │  │
│  │  Port: interno   │      │  Port: 80/443 (Nginx)    │  │
│  │  DB: SQLite      │      │  DB: Supabase (cloud)    │  │
│  │  LLM: Copilot    │      │  LLM: Gemini/OpenAI      │  │
│  └──────────────────┘      └──────────────────────────┘  │
│           │                            │                  │
│           └──── Nginx (port 443) ──────┘                  │
│                  (Telegram webhook)                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

Os dois projetos rodam no mesmo VPS mas são **processos completamente independentes**. Não há comunicação direta entre GueClaw e FluxoHub em runtime.

---

## 6. Quando Cada Projeto é Acionado

| Trigger | Projeto |
|---|---|
| Mensagem no Telegram de Moises | **GueClaw** |
| POST em `/webhook/formulario-aditivo` | **FluxoHub** |
| Formulário web de contrato/aditivo | **FluxoHub** |
| `pm2 restart gueclaw` | **GueClaw** |
| `docker compose up` | **FluxoHub** |
| Skill sendo executada | **GueClaw** |
| Nó de workflow sendo executado | **FluxoHub** |

---

## 7. DOE/Entrega.md — Status

O arquivo `DOE/Entrega.md` documenta o schema SQL e a arquitetura do **FluxoHub** (tabelas `workflows`, `nodes`, `edges`, `executions`, `execution_logs`). Esse schema é do Supabase/PostgreSQL do FluxoHub, **não do GueClaw**.

O GueClaw usa SQLite com schema diferente (ver [docs/architecture/db-schema.md](db-schema.md)).

> **Para documentação GueClaw:** use `docs/`. Para documentação FluxoHub: use o repositório do FluxoHub.

---

## 8. Resumo para Agentes de IA

Se você está operando como **GueClaw** (Telegram bot):
- Ignore `DOE/Entrega.md` e `DOE/fluxohub_architecture_guide.md` — são do FluxoHub
- Seu banco é SQLite em `./data/gueclaw.db`
- Seu loop é o ReAct em `src/core/agent-loop/`
- Suas skills estão em `.agents/skills/`

Se você foi convocado para trabalhar no **FluxoHub**:
- Leia `DOE/fluxohub_architecture_guide.md` primeiro
- O código está em um repositório separado (monorepo npm workspaces)
- Use scripts Python em `execution/` para diagnosticar execuções
- O banco é Supabase (PostgreSQL), não SQLite
