# Arquitetura — Nível 2: Containers (C4)

Decomposição do GueClaw Bot em processos e tecnologias.

## Diagrama C4 — Containers

```mermaid
graph TB
    USER["👤 Usuário (Telegram)"]

    subgraph VPS["VPS Ubuntu — /opt/gueclaw-agent"]
        BOT["🤖 Bot Core\nsrc/index.ts\nNode.js + TypeScript"]
        SKILLS["📦 Skills Engine\n.agents/skills/\n17 skills SKILL.md"]
        AGENTS["🧩 Agents Registry\n.agents/agents/\nModel Cards + personas"]
        MEMORY["🗄️ Memory Store\ndata/memory/\nSQLite (better-sqlite3)"]
        LOGS["📋 Logs\nlogs/ + PM2\nRotação diária"]
        API["🔌 Debug API\nHTTP :3742\nExecution traces"]
    end

    subgraph EXTERNAL["Serviços Externos"]
        LLM["🧠 LLM\nClaude/GPT/Copilot"]
        TELEGRAM_API["📱 Telegram API"]
        UAZAPI["💬 UazAPI"]
        GCAL["📅 Google Calendar"]
        GITHUB_VAULT["📔 meu-vault-obsidian\n(GitHub)"]
    end

    USER -->|"webhook"| TELEGRAM_API
    TELEGRAM_API -->|"update"| BOT
    BOT --> SKILLS
    BOT --> AGENTS
    BOT --> MEMORY
    BOT --> API
    BOT -->|"LLM calls"| LLM
    BOT -->|"respostas"| TELEGRAM_API
    SKILLS -->|"mensagens"| UAZAPI
    SKILLS -->|"eventos"| GCAL
    SKILLS -->|"git sync"| GITHUB_VAULT
    BOT --> LOGS
```

## Containers em Detalhe

### Bot Core (`src/`)
| Arquivo/Dir | Responsabilidade |
|---|---|
| `src/index.ts` | Entry point, inicialização, webhook |
| `src/core/` | SkillRouter, MemoryManager, AgentLoop |
| `src/handlers/` | Handlers de mensagens Telegram |
| `src/services/` | Integrações externas (Calendar, WhatsApp) |
| `src/tools/` | Tools disponíveis para o LLM |
| `src/api/` | Debug API REST (:3742) |

### Skills Engine (`.agents/skills/`)
- Cada skill é um diretório com `SKILL.md` (instruções) + scripts opcionais
- Carregadas dinamicamente pelo SkillRouter
- Sincronizadas com `meu-vault-obsidian` via `scripts/sync-skills.sh`

### Memory Store (`data/`)
- `data/memory/` — memória conversacional por usuário
- `data/heartbeat/` — registro de saúde do sistema
- Banco SQLite local, sem dependências de cloud

### Logs (`logs/`)
- Logs de PM2 (stdout + stderr)
- Rotação automática diária
- Debug API expõe últimas entradas via HTTP

## Próximo nível
→ [Decisões de Arquitetura (ADR)](decisions/)
