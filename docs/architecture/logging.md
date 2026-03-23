# Estratégia de Logging e Tratamento de Erros

**Stack:** Node.js + TypeScript, sem biblioteca de logging (pure `console.*`)
**Captura em produção:** PM2 redireciona stdout/stderr automaticamente

---

## 1. Visão Geral

O GueClaw não usa uma biblioteca de logging (Winston, Pino, etc.). Todo o output usa `console.log`, `console.error` e `console.warn` diretamente. O PM2 captura tudo em arquivos de log.

```
console.log   → stdout  → ~/.pm2/logs/gueclaw-out.log
console.error → stderr  → ~/.pm2/logs/gueclaw-error.log
console.warn  → stderr  → ~/.pm2/logs/gueclaw-error.log
```

---

## 2. Convenção de Prefixos por Módulo

Cada módulo usa um emoji/prefixo consistente para facilitar leitura de logs:

| Prefixo | Modulo | Exemplo |
|---|---|---|
| `🤖` | Startup / index.ts | `🤖 Bot polling...` |
| `🧬` | IdentityLoader | `🧬 Identity loaded (1234 chars)` |
| `🔧` | ToolRegistry | `🔧 Registered tool: vps_execute_command` |
| `🖥️` | VPS Command Tool | `🖥️  Executing VPS command: docker ps` |
| `🌐` | API Request Tool | `🌐 Making GET request to https://...` |
| `🔐` | Copilot OAuth | `🔐 GitHub Copilot Authentication` |
| `✅` | Sucesso geral | `✅ Token do Copilot obtido com sucesso!` |
| `❌` | Erro (stderr) | `❌ VPS command error: connection refused` |
| `⚠️` | Aviso (stderr) | `⚠️ Token expirado. Execute: npm run copilot:auth` |
| `🔄` | Retry / refresh | `🔄 Auto-refreshing Copilot token...` |

---

## 3. Localização dos Logs em Produção

```bash
# Logs do PM2 (VPS)
~/.pm2/logs/gueclaw-out.log       # stdout (todos os console.log)
~/.pm2/logs/gueclaw-error.log     # stderr (console.error + console.warn)

# Via PM2 diretamente
pm2 logs gueclaw                  # em tempo real (últimas 200 linhas)
pm2 logs gueclaw --lines 500      # últimas 500 linhas
pm2 flush gueclaw                 # limpar arquivos de log

# Via Debug API (requer túnel SSH aberto)
npm run debug:logs                # últimas 50 linhas do PM2
node scripts/debug-api.js logs 200  # últimas 200 linhas
```

---

## 4. Logs de Execução no Banco (SQLite)

Além dos logs do PM2, o sistema persiste traces detalhados no SQLite:

```sql
-- Ver últimas 10 execuções de skills
SELECT skill_name, user_id, success, execution_time_ms, timestamp
FROM skill_executions
ORDER BY timestamp DESC
LIMIT 10;

-- Ver traces de uma conversa específica (debug de tool calls)
SELECT iteration, tool_name, tool_args, tool_result, thought, finish_reason
FROM execution_traces
WHERE conversation_id = '<uuid>'
ORDER BY created_at;

-- Taxa de sucesso por skill
SELECT skill_name,
       COUNT(*) AS total,
       SUM(success) AS successes,
       ROUND(100.0 * SUM(success) / COUNT(*), 1) AS success_rate,
       AVG(execution_time_ms) AS avg_ms
FROM skill_executions
GROUP BY skill_name
ORDER BY total DESC;
```

Esses dados são expostos pelo endpoint `/api/stats` da Debug API.

---

## 5. Estratégia de Tratamento de Erros

### 5.1 Regra Geral por Camada

| Camada | Comportamento em erro |
|---|---|
| **Tools** (`BaseTool.execute()`) | Captura exceção, retorna `this.error(message)` — **nunca relança** |
| **Providers** (`generateCompletion()`) | Captura exceção, retorna `{ error: string }` — **nunca relança** |
| **SkillRouter** | Em falha, retorna `null` (skill geral, sem crash) |
| **AgentLoop** | Itera mas para no `maxIterations`; retorna resposta parcial se necessário |
| **Handlers** | Captura erros do AgentLoop, envia mensagem de erro amigável ao usuário |
| **index.ts (startup)** | Valida `.env` e providers antes de iniciar; `process.exit(1)` se config inválida |

### 5.2 Erros de Startup (Fatais)

Causam `process.exit(1)` imediato com mensagem clara:

```typescript
// Exemplos de erros fatais (src/index.ts):
// - Variáveis de ambiente obrigatórias ausentes
// - TELEGRAM_ALLOWED_USER_IDS vazio ou não numérico
// - Nenhum provider LLM configurado
```

O PM2 reinicia o processo automaticamente se ele morrer com código ≠ 0.

### 5.3 Erros em Runtime (Tratados)

Erros de runtime são absorvidos e convertidos em respostas de erro:

```typescript
// Tool falha → usuário recebe: "❌ <mensagem do erro>"
// Provider falha → fallback automático para o próximo provider disponível
// Skill não roteada → usa o LLM em modo chat geral
```

### 5.4 Erros de Conexão ao VPS

O `VpsCommandTool` usa SSH (`node-ssh`). Erros de conexão são capturados e retornados como `ToolResult.error`. O bot nunca trava — responde com a mensagem de erro ao usuário.

---

## 6. Debug de Problemas Comuns

### Bot não responde (timeout silencioso)

```bash
# 1. Verificar se o processo está vivo
pm2 status

# 2. Ver últimos logs (procurar ❌ ou stack trace)
pm2 logs gueclaw --lines 50

# 3. Simular a mesma mensagem via Debug API
node scripts/debug-api.js tunnel   # terminal 1
node scripts/debug-api.js simulate "sua mensagem aqui"   # terminal 2
```

### Skill sendo roteada errada

```bash
# Ver qual skill foi roteada + trace completo
node scripts/debug-api.js simulate "sua mensagem"

# Output mostra: "🎯 Skill roteada: <nome-ou-null>"
# Se errada: revisar description no SKILL.md da skill incorreta
```

### Provider Copilot OAuth expirado

```bash
# Sintoma: logs com "⚠️ Token expirado"
# Solução:
npm run copilot:auth   # local (interativo, Device Code Flow)
# ou na VPS:
pm2 exec gueclaw "npm run copilot:auth"  # se disponível
```

### Crescimento dos arquivos de log

```bash
# PM2 não rota logs por padrão. Instalar pm2-logrotate:
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

---

## 7. Ausência de Logging Estruturado (Trade-off Documentado)

**Situação atual:** `console.log` simples, sem JSON estruturado, sem correlation IDs.

**Por que não foi implementado:**
- O volume de mensagens é baixo (bot pessoal, 1 usuário)
- PM2 logs são suficientes para diagnóstico
- Os traces no SQLite cobrem o audit trail de execuções

**Quando migrar para logging estruturado (Pino/Winston):**
- Se o bot processar mais de 1 usuário simultâneo
- Se precisar integrar com ferramentas como Datadog, Loki, ou Grafana
- Se correlation IDs entre requests se tornarem necessários

Ver `ADR-0003` (planejado) para a decisão formal sobre estratégia de observabilidade.
