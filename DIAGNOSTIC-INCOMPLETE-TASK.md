# 🔍 DIAGNÓSTICO: Tarefa Prometida Não Concluída

**Data:** 09/04/2026  
**Tarefa:** Criar vps-security-scanner skill + security-guardian agent + systemd timer

---

## 🎯 O QUE FOI PROMETIDO

O GueClaw prometeu executar 3 fases:

### FASE 1: Criar Skill vps-security-scanner
- Copiar base da skill-security-analyzer
- Adaptar para análise de VPS (portas, SSH, Docker, usuários, logs)
- Adicionar scan de vulnerabilidades (trivy para containers)
- Criar scripts auxiliares de varredura
- Gerar relatório Markdown estruturado por severidade

### FASE 2: Criar Subagente security-guardian
- Criar persona especialista em segurança ofensiva + DevSecOps
- Integrar skill vps-security-scanner
- Implementar lógica de envio via Telegram
- Localização: `.agents/agents/03-infrastructure/security-guardian.md`

### FASE 3: Automatizar com Systemd Timer
- Script: `/opt/gueclaw/automation/daily-security-scan.sh`
- Timer: `/etc/systemd/system/daily-security-scan.timer` (6h America/Sao_Paulo)
- Service: `/etc/systemd/system/daily-security-scan.service`
- Habilitar e testar execução

---

## ❌ O QUE REALMENTE ACONTECEU

### Evidências dos Logs (PM2)
```
💭 Thought: 🎯 **PLANO APROVADO E AJUSTADO!**
...
✅ Agent Loop completed successfully
State Summary:
  Turns: 1
  Tool Executions: 0  ❌ ZERO FERRAMENTAS EXECUTADAS
  Elapsed Time: 12951ms
✅ Response sent successfully
```

### Verificação do Sistema
- ❌ Skill `vps-security-scanner` NÃO existe em `.agents/skills/`
- ❌ Subagente `security-guardian.md` NÃO existe em `.agents/agents/03-infrastructure/`
- ❌ Scripts systemd NÃO existem em `/etc/systemd/system/`
- ❌ Nenhum arquivo foi criado
- ❌ Nenhuma ferramenta foi invocada

### Status do GueClaw
- ✅ **Rodando normalmente** (PM2: online, 2h uptime)
- ✅ Recebeu a mensagem do usuário
- ✅ Roteou corretamente (general chat)
- ✅ Gerou um "plano de implementação" bonito
- ❌ **Não executou nada** (`Tool Executions: 0`)
- ✅ Marcou como "completed successfully"

---

## 🔬 ANÁLISE DA CAUSA RAIZ

### Problema Identificado
O GueClaw confundiu **descrever o plano** com **executar o plano**.

**O que deveria ter acontecido:**
1. Receber request → ✅
2. Gerar plano → ✅
3. **Executar ferramentas** (create_file, skill-creator) → ❌ PULOU
4. Retornar resultado → ✅ (mas resultado falso)

**O que aconteceu de fato:**
1. Receber request → ✅
2. Gerar plano como THOUGHT → ✅
3. **Tratar THOUGHT como resposta final** → ❌ BUG
4. Enviar plano ao usuário e marcar como "sucesso" → ❌ FALSO POSITIVO

### Por que isso aconteceu?

**Hipótese 1: Ambiguidade no Loop ReAct**
- O loop ReAct (Thought → Action → Observation) deveria SEMPRE ter ao menos 1 ACTION
- No caso registrado: Thought SEM Action
- O agente gerou um pensamento descritivo e saiu do loop

**Hipótese 2: Falta de Validação de Conclusão**
- O sistema marcou `SUCCESS` baseado apenas em "não houve erro"
- Não validou se as ações prometidas foram executadas
- Não há tracking de "tarefas pendentes multi-turno"

**Hipótese 3: Limitação do Max Iterations**
- `MAX_ITERATIONS=5` no .env
- Tarefas de 3 fases podem precisar de mais iterações
- O agente pode ter "desistido" por limitação de contexto

---

## 🛠️ CORREÇÕES NECESSÁRIAS

### ✅ 1. Sistema de Task Tracking Persistente
**Objetivo:** Garantir que promessas sejam cumpridas

**Implementação:**
- [ ] Criar tabela `agent_tasks` no SQLite:
  ```sql
  CREATE TABLE agent_tasks (
    id TEXT PRIMARY KEY,
    conversation_id TEXT,
    description TEXT,
    status TEXT, -- pending, in_progress, completed, failed
    created_at INTEGER,
    updated_at INTEGER,
    metadata JSON
  );
  ```
- [ ] Hook no Agent Loop: ao detectar promessa de múltiplas etapas, criar task
- [ ] Verificação pré-resposta: antes de marcar como "completed", validar se há tasks pendentes
- [ ] Comando `/tasks` no Telegram para listar tarefas pendentes

### ✅ 2. Validação de Execução de Ferramentas
**Objetivo:** Diferenciar "planos" de "execuções"

**Implementação:**
- [ ] Adicionar flag `requires_tool_execution` no Agent State
- [ ] Regra: se THOUGHT contém "vou criar", "vou implementar", "farei", **DEVE** ter ACTION
- [ ] Se nenhuma ACTION foi executada após THOUGHT de implementação, lançar warning
- [ ] Adicionar log de "Dry Run Detected" quando só há plano sem execução

### ✅ 3. Melhorar Prompt do Sistema (SOUL.md)
**Objetivo:** Deixar claro que promessas devem ser cumpridas

**Adicionar em SOUL.md:**
```markdown
## Regra de Ouro: Promessas vs Execução

- Se você diz "vou fazer X", você DEVE executar X antes de responder
- NUNCA descreva um plano de implementação sem executá-lo
- Use ferramentas (create_file, replace_string_in_file, etc) IMEDIATAMENTE
- Se você disser "FASE 1, FASE 2, FASE 3", execute TODAS antes de finalizar
- Se não puder executar tudo de uma vez, peça confirmação de cada fase
```

### ✅ 4. Aumentar MAX_ITERATIONS para Tarefas Complexas
**Objetivo:** Dar espaço para tarefas multi-etapa

**Implementação:**
- [ ] `.env`: `MAX_ITERATIONS=15` (aumentar de 5 para 15)
- [ ] Adicionar detecção de "tarefa complexa" (>2 fases) → aumentar limite dinamicamente
- [ ] Log de "Iteration limit approaching" quando chegar em 80% do limite

### ✅ 5. Auto-Recovery de Tarefas Incompletas
**Objetivo:** Retomar tarefas se o agente reiniciar

**Implementação:**
- [ ] Ao iniciar, verificar `agent_tasks` com status `in_progress`
- [ ] Se encontradas, perguntar ao usuário (via Telegram):
  ```
  ⚠️ Detectei tarefas não concluídas:
  1. Criar vps-security-scanner (50% completa)
  
  Deseja que eu retome? (Sim/Não)
  ```
- [ ] Integrar com Memory System (usar memórias de sessão para contexto)

---

## 🚀 PLANO DE CORREÇÃO IMEDIATA

### Passo 1: Criar infraestrutura de Task Tracking (AGORA)
- [ ] Criar `src/core/task-tracker.ts`
- [ ] Migration SQL para tabela `agent_tasks`
- [ ] Integrar com AgentLoop

### Passo 2: Executar a Tarefa Prometida (AGORA)
- [ ] Criar skill `vps-security-scanner`
- [ ] Criar subagente `security-guardian`
- [ ] Configurar systemd timer
- [ ] Testar execução manual
- [ ] Notificar usuário de conclusão

### Passo 3: Validação de Correção
- [ ] Fazer nova solicitação multi-fase ao GueClaw
- [ ] Verificar se todas as fases são executadas
- [ ] Verificar se tarefas são tracked no banco
- [ ] Confirmar que `/tasks` lista corretamente

---

## 📊 MÉTRICAS DE SUCESSO

| Métrica | Valor Atual | Valor Esperado |
|---------|-------------|----------------|
| Tarefas prometidas concluídas | 0/1 (0%) | 100% |
| Execuções de ferramentas em planos multi-fase | 0 | ≥ 1 por fase |
| Falsos positivos de "success" | 1 | 0 |
| Tarefas trackadas no banco | 0 | 100% das promessas |

---

## 📝 LIÇÕES APRENDIDAS

1. **Planos ≠ Execução**: Um agente descrevendo o que fará não é o mesmo que fazer
2. **Validação é crítica**: Marcar como "success" sem validar ações = falso positivo
3. **Persistência é necessária**: Tarefas multi-fase precisam de tracking persistente
4. **Transparency matters**: O usuário precisa saber se algo falhou vs está pendente

---

## 🔗 PRÓXIMOS PASSOS

1. ✅ Implementar Task Tracker
2. ✅ Executar tarefa prometida
3. ✅ Adicionar testes de regressão
4. ✅ Documentar novo fluxo no MASTER.md
5. ✅ Criar skill de auto-validação de tarefas

---

**Conclusão:** O GueClaw está funcional mas precisa de um sistema de Task Completion Tracking para garantir que promessas sejam cumpridas. O problema foi identificado, a correção é clara, e a implementação pode começar imediatamente.
