# Phase 2 Implementation Plan - Advanced Triggers

**Data:** 20 de Abril de 2026  
**Status:** 🔄 Em Planejamento  
**Estimativa:** 24-36h  
**Dependências:** Phase 1 ✅ Completa

---

## 📋 Escopo da Phase 2

### 🎯 Objetivo

Expandir o sistema de triggers com funcionalidades enterprise:
- **Webhook Triggers**: Integração com sistemas externos
- **Conditional Triggers**: Automação baseada em condições (if/then)
- **Jitter**: Distribuição de carga temporal
- **Tags/Groups**: Organização e operações em lote
- **Dashboard UI**: Interface web para gerenciamento visual

---

## 🗂️ Melhorias Planejadas

### 1️⃣ Webhook Triggers (8-12h) — PRIORIDADE ALTA

**Objetivo:** Permitir que jobs sejam disparados via HTTP webhooks

**Use Cases:**
- GitHub push → deploy automático
- Stripe payment → processar pedido
- CI/CD pipeline → notificar equipe
- IoT device → processar dados

**Arquitetura:**
```
POST /webhook/trigger/:webhookId
  → WebhookTriggerManager.validate()
  → CronScheduler.triggerJob()
  → Job executa com payload context
```

**Implementação:**
- Endpoint REST `/webhook/trigger/:webhookId`
- HMAC signature validation (segurança)
- Rate limiting (proteção DDoS)
- Webhook ID generator
- Secret storage
- Payload validation

**Arquivos:**
- `src/routes/webhook-triggers.ts` (NOVO)
- `src/services/cron/triggers/webhook-trigger-manager.ts` (NOVO)
- `src/services/cron/cron-types.ts` (MODIFICAR)
- `src/tools/cron-tool.ts` (MODIFICAR)

---

### 2️⃣ Conditional Triggers (8-12h) — PRIORIDADE MÉDIA

**Objetivo:** Jobs disparados quando condição é verdadeira

**Use Cases:**
- Disk usage > 80% → limpar logs
- API response time > 2s → alertar equipe
- Database rows > 10000 → arquivar dados
- Temperatura sensor > 25° → ligar ar condicionado

**Arquitetura:**
```
ConditionTriggerManager.tick() (a cada 30s)
  → Avalia expressões de todos os jobs
  → Se condition === true → dispara job
  → Cooldown para evitar disparo repetido
```

**Segurança:**
- Sandbox seguro (vm2 ou safe-eval)
- Whitelist de objetos acessíveis
- Timeout de execução
- Rate limiting por job

**Implementação:**
- `ConditionTriggerManager` com tick loop
- Safe expression evaluator
- Context builder (db, storage, env, metrics)
- Cooldown mechanism
- Integração no scheduler

**Arquivos:**
- `src/services/cron/triggers/condition-trigger-manager.ts` (NOVO)
- `src/services/cron/triggers/safe-evaluator.ts` (NOVO)
- `src/services/cron/cron-types.ts` (MODIFICAR)

---

### 3️⃣ Jitter (3-4h) — PRIORIDADE BAIXA

**Objetivo:** Adicionar variação aleatória no tempo de execução

**Benefícios:**
- Evita sobrecarga quando múltiplos jobs coincidem
- Distribui carga ao longo do tempo
- Simula comportamento mais "natural"

**Exemplo:**
```
Schedule: "0 7 * * *" (7:00 AM)
Jitter: ±15 min
Execution: Entre 6:45 e 7:15
```

**Implementação:**
- Campo `jitter` em CronSchedule
- `calculateNextRunWithJitter()` helper
- Random offset entre -maxMinutes e +maxMinutes
- Aplicar apenas em recurring jobs

**Arquivos:**
- `src/services/cron/cron-types.ts` (MODIFICAR)
- `src/services/cron/schedule-parser.ts` (MODIFICAR)

---

### 4️⃣ Tags & Groups (3-4h) — PRIORIDADE MÉDIA

**Objetivo:** Organização e operações em lote

**Use Cases:**
- Pausar todos jobs de "backup"
- Deletar todos jobs do grupo "testing"
- Listar apenas jobs com tag "production"

**Features:**
- Campos: `tags: string[]`, `group: string`
- Bulk operations: pause, resume, delete (com confirmação)
- Filtros em list: por tags, por group
- Proteção: permanent flag previne delete acidental

**Implementação:**
- Estender CronJob com tags/group
- Implementar bulk operations em CronStorage
- Atualizar cron-tool com bulk actions
- Filtros em list command

**Arquivos:**
- `src/services/cron/cron-types.ts` (MODIFICAR)
- `src/services/cron/cron-storage.ts` (MODIFICAR)
- `src/tools/cron-tool.ts` (MODIFICAR)

---

### 5️⃣ Dashboard UI (8-12h) — PRIORIDADE ALTA

**Objetivo:** Interface web para gerenciar jobs visualmente

**Features:**
- Lista de jobs com status (active, paused, disabled)
- Filtros: tags, groups, status, busca por nome
- Ações inline: pause, resume, delete, trigger manual
- Formulário de criação com wizard multi-step
- Visualização de outputs (timeline + details)
- Preview de próximas execuções
- Real-time status updates (opcional: WebSocket)

**Stack:**
- Next.js (já existe em `dashboard/`)
- shadcn/ui para componentes
- TanStack Query para cache
- Zod para validação

**Páginas:**
- `/dashboard/cron` - Lista de jobs
- `/dashboard/cron/new` - Criar job
- `/dashboard/cron/:id` - Detalhes do job
- `/dashboard/cron/:id/outputs` - Histórico

**API Endpoints:**
```typescript
GET    /api/cron/jobs          - Lista jobs (com filtros)
POST   /api/cron/jobs          - Cria job
GET    /api/cron/jobs/:id      - Detalhes
PATCH  /api/cron/jobs/:id      - Atualiza (pause/resume)
DELETE /api/cron/jobs/:id      - Deleta
POST   /api/cron/jobs/:id/trigger - Trigger manual
GET    /api/cron/jobs/:id/outputs - Outputs
```

**Arquivos:**
- `dashboard/src/app/dashboard/cron/` (NOVO)
- `dashboard/src/app/api/cron/` (NOVO)
- `dashboard/src/components/cron/` (NOVO)

---

## 🎯 Ordem de Implementação Recomendada

### Opção A: Feature-First (Recomendado)
1. **Tags & Groups** (3-4h) - Rápido, alto valor, útil para organizar
2. **Webhook Triggers** (8-12h) - Feature mais requisitada
3. **Jitter** (3-4h) - Simples, melhora distribuição de carga
4. **Dashboard UI** (8-12h) - Visual appeal, facilita adoção
5. **Conditional Triggers** (8-12h) - Mais complexo, menor urgência

**Total:** 30-44h

### Opção B: Quick-Wins First
1. **Tags & Groups** (3-4h)
2. **Jitter** (3-4h)
3. **Webhook Triggers** (8-12h)
4. **Conditional Triggers** (8-12h)
5. **Dashboard UI** (8-12h)

**Total:** 30-44h

### Opção C: Value-First
1. **Webhook Triggers** (8-12h) - Integração com sistemas externos
2. **Dashboard UI** (8-12h) - UX melhorado
3. **Tags & Groups** (3-4h) - Organização
4. **Jitter** (3-4h) - Otimização
5. **Conditional Triggers** (8-12h) - Automação avançada

**Total:** 30-44h

---

## 🛡️ Considerações de Segurança

### Webhook Triggers
- ✅ HMAC signature validation obrigatória
- ✅ Rate limiting (10 req/min por webhook)
- ✅ Webhook secrets gerados com crypto.randomBytes
- ✅ HTTPS only em produção
- ✅ IP whitelist (opcional)

### Conditional Triggers
- ⚠️ **CRÍTICO:** Safe evaluation apenas (vm2 ou safe-eval)
- ⚠️ Sandbox isolado sem acesso a process, fs, require
- ⚠️ Timeout de 1s para expressões
- ⚠️ Whitelist de objetos acessíveis
- ⚠️ Logs de todas as avaliações

### Dashboard UI
- ✅ Autenticação via Telegram (já implementada)
- ✅ CSRF protection
- ✅ Input validation com Zod
- ✅ Rate limiting em API endpoints

---

## 📊 Métricas de Sucesso

**Webhook Triggers:**
- [ ] 99.9% uptime do endpoint
- [ ] < 100ms latência média
- [ ] Zero falhas de signature validation

**Conditional Triggers:**
- [ ] Zero code injection exploits
- [ ] < 50ms tempo médio de avaliação
- [ ] 100% das expressões com timeout

**Dashboard UI:**
- [ ] < 2s tempo de carregamento
- [ ] 100% mobile responsive
- [ ] Zero erros de validação em produção

---

## 🚀 Quick Start

### 1. Tags & Groups (Começar aqui)

**Estimativa:** 3-4h  
**Complexidade:** Baixa  
**Valor:** Alto

Implementação mais rápida para ganhar momentum e organizar jobs existentes antes de criar novas features.

**Checklist:**
- [ ] Adicionar tags/group em CronJob
- [ ] Implementar filtros em CronStorage
- [ ] Bulk operations (pause, resume, delete)
- [ ] Atualizar cron-tool
- [ ] Testes

---

## 📝 Notas de Implementação

### Webhook URL Format
```
https://gueclaw.example.com/webhook/trigger/{webhookId}
```

### Condition Expression Examples
```javascript
// Disk usage
storage.diskUsage > 0.8

// API health
metrics.apiResponseTime > 2000

// Database
db.count('users') > 10000

// Time-based condition
new Date().getHours() >= 22 && env.NODE_ENV === 'production'

// Combined
storage.diskUsage > 0.8 && metrics.errorRate > 0.05
```

### Tag Examples
```json
{
  "tags": ["backup", "critical", "daily"],
  "group": "maintenance"
}
```

---

## ❓ Perguntas Pendentes

1. **Webhook Triggers:** Usar Express ou Next.js API routes?
   - **Resposta:** Next.js API routes (já temos dashboard em Next)

2. **Conditional Triggers:** vm2 está deprecated, usar isolated-vm?
   - **Resposta:** Avaliar safe-eval ou criar custom sandbox

3. **Dashboard:** Criar em dashboard/ existente ou novo projeto?
   - **Resposta:** Usar dashboard/ existente

4. **Rate Limiting:** Redis ou in-memory?
   - **Resposta:** In-memory (Map) por simplicidade

---

**Próximo Passo:** Implementar Tags & Groups (3-4h)

**Aprovação Necessária:** Usuário escolhe opção A, B ou C
