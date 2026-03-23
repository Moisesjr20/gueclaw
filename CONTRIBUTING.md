# Guia de Contribuição — GueClaw

> Para humanos e agentes de IA. Leia antes de qualquer modificação.

---

## 1. Princípios

| Princípio | O que significa |
|---|---|
| **Build nunca quebra** | `npm run validate` deve passar 100% antes de qualquer push |
| **Sem surpresas no prod** | Toda feature passa por unit test antes de subir |
| **Mudança mínima** | Não refatore o que não foi pedido. Não adicione features extras. |
| **Rastreabilidade** | Commit message explica o *porquê*, não o *o quê* |

---

## 2. Pré-requisitos de Desenvolvimento

```bash
# Versões mínimas
node --version   # >= 20.x
npm --version    # >= 10.x
git --version    # qualquer versão recente

# Instalar dependências
npm install

# Criar .env a partir do exemplo
cp .env.example .env
# Preencher TELEGRAM_BOT_TOKEN, TELEGRAM_ALLOWED_USER_IDS, e pelo menos um LLM provider
```

---

## 3. Workflow de Desenvolvimento

### 3.1 Antes de começar

```bash
# Pegar últimas mudanças
git pull origin main

# Verificar se o ambiente está limpo
npm run validate
```

### 3.2 Ciclo de implementação

```
1. Ler o código afetado (nunca editar sem ler antes)
2. Implementar a mudança mínima necessária
3. Escrever ou atualizar o teste correspondente
4. Rodar: npm run validate
5. Commit com mensagem semântica
6. Push
```

### 3.3 Testar localmente (sem VPS)

```bash
# Rodar todos os testes unitários
npm run test:unit

# Rodar testes e2e (simulam o AgentLoop com mock provider)
npm run test:e2e

# Watch mode durante desenvolvimento
npm run test:watch

# Subir o bot em modo dev (hot reload)
npm run dev
```

---

## 4. Convenções de Commit

Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<tipo>(<escopo>): <descrição curta>
```

| Tipo | Quando usar |
|---|---|
| `feat` | Nova feature ou nova skill |
| `fix` | Correção de bug |
| `docs` | Mudança apenas em documentação |
| `refactor` | Refatoração sem mudança de comportamento |
| `test` | Adicionar ou corrigir testes |
| `chore` | Dependências, configs, scripts |

**Exemplos válidos:**
```bash
git commit -m "feat(skill): adicionar skill de cotacao-btc"
git commit -m "fix(provider): retry ao receber 429 do Copilot OAuth"
git commit -m "docs(runbook): adicionar passo de rollback"
git commit -m "test(skill-router): cobrir caso de skill não encontrada"
```

---

## 5. Estrutura do Código

```
src/
├── index.ts                  ← Entrada: valida .env, inicializa providers, starts bot
├── api/                      ← Debug API (porta 3742, localhost-only)
├── core/
│   ├── agent-loop/           ← ReAct loop (Thought → Action → Observation)
│   ├── memory/               ← SQLite (database.ts, conversation-memory.ts)
│   ├── providers/            ← LLM providers (Copilot OAuth, DeepSeek, etc.)
│   └── skills/               ← SkillLoader + SkillRouter
├── handlers/                 ← TelegramInputHandler, TelegramOutputHandler
├── services/                 ← HeartbeatService
├── tools/                    ← BaseTool + implementações (vps, docker, file, api, etc.)
├── types/                    ← Tipos compartilhados (Message, LLMResponse, ToolResult)
└── utils/                    ← IdentityLoader, TelegramFormatter
```

### Regras por camada

- **`src/tools/`** — Toda tool herda de `BaseTool`. Use `this.success()` / `this.error()` para retornar.
- **`src/core/providers/`** — Todo provider implementa `ILLMProvider`. Nunca lança exceção em `generateCompletion()` — retorna erro no objeto.
- **`src/core/skills/`** — Skills são arquivos Markdown. O loader lê em runtime, nunca hard-code nomes de skills.

---

## 6. Criando uma Nova Skill

Skills são a unidade de extensão do GueClaw. Cada skill é um diretório em `.agents/skills/<nome>/`.

```
.agents/skills/<nome>/
├── SKILL.md          ← OBRIGATÓRIO: frontmatter YAML + instruções
└── scripts/          ← OPCIONAL: scripts de apoio (.py, .js, .sh)
```

### Estrutura mínima do SKILL.md

```yaml
---
name: nome-da-skill
version: 1.0.0
description: "Frase curta (usada pelo SkillRouter para matching)"
author: Moises
---

# <Nome da Skill>

## Quando usar
(condições de trigger)

## Como executar
(passos que o agente deve seguir)

## Ferramentas disponíveis
(quais tools o agente pode chamar)
```

> **Crítico:** O campo `description` é a frase que o SkillRouter compara com a mensagem do usuário via LLM. Seja específico e cubra as frases que o usuário usaria.

### Persistir a skill

```bash
git add .agents/skills/<nome>/
git commit -m "feat(<nome>): descrição da skill"
git push origin main

# Sincronizar com o vault (meu-vault-obsidian)
bash scripts/sync-skills.sh push "feat(<nome>): descrição da skill"

# Na VPS, após o push:
bash scripts/sync-skills.sh pull
pm2 restart gueclaw
```

---

## 7. Testes

Ver [docs/testing/skills-testing.md](docs/testing/skills-testing.md) para a estratégia completa.

### TL;DR dos testes existentes

| Arquivo | O que testa |
|---|---|
| `tests/unit/tool-registry.test.ts` | Registro e lookup de tools |
| `tests/unit/memory-manager.test.ts` | MemoryManager (SQLite mock) |
| `tests/unit/heartbeat.test.ts` | HeartbeatService |
| `tests/unit/security-validators.test.ts` | Sanitização de inputs |
| `tests/e2e/agent-loop.test.ts` | Agent loop completo com mock provider |
| `tests/e2e/dialog-api.test.ts` | Debug API endpoints |

### Mocks disponíveis

```typescript
// better-sqlite3: __mocks__/better-sqlite3.js (in-memory, automático via jest.config.js)
// LLM provider: crie um MockProvider implementando ILLMProvider
// Tools: MockTool extends BaseTool
```

---

## 8. Deploy na VPS

Ver [docs/operations/runbook.md](docs/operations/runbook.md) para o guia completo.

```bash
# Deploy padrão
ssh user@vps "cd /opt/gueclaw-agent && git pull && npm install && npm run build && pm2 restart gueclaw"

# Verificar se subiu
npm run debug:tunnel  # terminal 1
npm run debug:logs    # terminal 2 (aguardar "Bot polling...")
```

---

## 9. Documentação

Qualquer mudança estrutural deve ter documentação correspondente:

| Tipo de mudança | Documentação necessária |
|---|---|
| Nova skill | Entrada no catálogo em `docs/MASTER.md` seção 5 |
| Novo provider | Entrada em `docs/architecture/providers.md` |
| Mudança na DB | Atualizar `docs/architecture/db-schema.md` + criar ADR |
| Decisão arquitetural | Criar ADR em `docs/architecture/decisions/ADR-XXXX-*.md` |
| Operação manual na VPS | Registrar em `docs/operations/vps-history.md` |

---

## 10. Checklist de PR / Push

```
[ ] npm run validate passou (lint + build + unit tests)
[ ] Novos testes cobrem o código adicionado
[ ] Commit message segue o padrão semântico
[ ] Documentação atualizada se necessário
[ ] Nenhuma credencial no código (npm run secrets:scan)
[ ] Skills novas foram sincronizadas com o vault
```
