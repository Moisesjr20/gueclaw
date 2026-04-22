# ✅ Phase 2.2: Webhook Triggers — COMPLETO

**Data:** 20 de Abril de 2026  
**Estimativa:** 8-12h  
**Tempo Real:** ~4h  
**Status:** ✅ **100% COMPLETO**

---

## 📋 Resumo da Implementação

Sistema completo de **Webhook Triggers** para disparar jobs via HTTP com autenticação HMAC SHA256, rate limiting e IP whitelist.

### 🎯 Objetivos Alcançados

✅ Tipos estendidos (TriggerType + WebhookTriggerConfig)  
✅ WebhookTriggerManager com HMAC validation  
✅ Rate limiting (10 req/min default)  
✅ IP whitelist (opcional)  
✅ API Route Next.js `/api/webhook/trigger/[webhookId]`  
✅ Integração com CronScheduler  
✅ Context payload passado para o job  
✅ Auto-registro de webhooks no start()  
✅ Suporte no cron-tool para criar jobs webhook

---

## 🔧 Arquivos Criados/Modificados

### 1. `src/services/cron/cron-types.ts` ✏️

**Mudanças:**
- Adicionado `'webhook'` ao `TriggerType`
- Criado interface `WebhookTriggerConfig`
- Adicionado campo `webhook?` ao `CronTrigger`

```typescript
export type TriggerType = 'time' | 'file' | 'webhook';

export interface WebhookTriggerConfig {
  webhookId: string;        // Auto-generated (32 chars hex)
  secret: string;           // Auto-generated (base64, 43 chars)
  rateLimit?: number;       // Default: 10 req/min
  ipWhitelist?: string[];   // Optional
  allowedMethods?: ('POST' | 'GET')[];  // Default: ['POST']
}
```

---

### 2. `src/services/cron/triggers/webhook-trigger-manager.ts` ✨ NOVO

**Classe Singleton** para gerenciar webhooks.

**Métodos Públicos:**

#### `generateWebhookId(): string`
Gera ID criptograficamente seguro (32 hex chars).

#### `generateSecret(): string`
Gera secret para HMAC (base64, 43 chars).

#### `registerWebhook(jobId, config): void`
Registra webhook para um job.

#### `unregisterWebhook(webhookId): void`
Remove webhook.

#### `validateRequest(webhookId, signature, payload, ip, method): ValidationResult`
**Validação completa:**
1. Webhook existe?
2. Rate limit OK?
3. IP whitelisted?
4. Method allowed?
5. HMAC signature válida?

Retorna:
```typescript
{
  valid: true,
  payload: { jobId, timestamp, data }
}
// ou
{
  valid: false,
  error: "Invalid signature",
  rateLimited?: true
}
```

#### `validateSignature(webhookId, signature, payload): boolean`
HMAC SHA256 validation com `timingSafeEqual` (timing-safe).

```typescript
Expected: sha256=<hex_digest>
```

#### `checkRateLimit(webhookId): boolean`
Rate limiting em janela de 1 minuto:
- Default: 10 req/min
- Configurável por webhook

#### `validateIp(webhookId, ip): boolean`
Whitelist opcional:
- Se não configurado: allow all
- Se configurado: apenas IPs listados

---

### 3. `dashboard/src/app/api/webhook/trigger/[webhookId]/route.ts` ✨ NOVO

**Next.js App Router API Route**

#### `POST /api/webhook/trigger/:webhookId`

**Headers:**
```
X-Webhook-Signature: sha256=<hmac_sha256_hex>
Content-Type: application/json
```

**Body:** Qualquer JSON

**Flow:**
1. Extrai signature header
2. Lê body como texto
3. Valida request (HMAC + rate limit + IP + method)
4. Se válido: dispara job com context payload
5. Retorna success ou error

**Responses:**

✅ **200 Success:**
```json
{
  "success": true,
  "jobId": "abc123",
  "message": "Job triggered successfully",
  "timestamp": "2026-04-20T..."
}
```

❌ **401 Unauthorized:**
```json
{
  "error": "Missing X-Webhook-Signature header"
}
```

❌ **403 Forbidden:**
```json
{
  "error": "Invalid signature"
}
// ou
{
  "error": "IP not whitelisted"
}
```

❌ **429 Rate Limited:**
```json
{
  "error": "Rate limit exceeded",
  "rateLimited": true
}
```

#### `GET /api/webhook/trigger/:webhookId`

Suporte opcional para webhooks que permitem GET.

- Query params passados como payload
- Mesma validação HMAC

---

### 4. `src/services/cron/cron-scheduler.ts` ✏️

**Mudanças:**

#### Import WebhookTriggerManager
```typescript
import { WebhookTriggerManager } from './triggers/webhook-trigger-manager';
```

#### Propriedade privada
```typescript
private webhookTriggerManager: WebhookTriggerManager;
```

#### Constructor
```typescript
this.webhookTriggerManager = WebhookTriggerManager.getInstance();
```

#### Método `registerWebhooks(): void` 🆕
Registra todos webhooks ativos no startup:
```typescript
for (const job of jobs) {
  if (job.trigger?.type === 'webhook') {
    this.webhookTriggerManager.registerWebhook(job.id, job.trigger.webhook);
  }
}
```

#### Método `registerJobWebhook(jobId): void` 🆕
Registra webhook individual (quando job é criado dinamicamente).

#### Método `unregisterJobWebhook(jobId): void` 🆕
Remove webhook quando job é deletado.

#### Método `triggerJob(jobId, context?): Promise<void>` ✏️
Aceita `context` opcional que é passado para o job:
```typescript
await scheduler.triggerJob(jobId, {
  webhookId: "abc123",
  payload: { key: "value" },
  ip: "192.168.1.1",
  timestamp: "2026-04-20T..."
});
```

#### Método `executeJob(job, isRecovery, context?): Promise<void>` ✏️
Enriquece prompt com context JSON quando fornecido:
```markdown
{prompt original}

---
**Context:**
```json
{
  "webhookId": "abc123",
  "payload": { "key": "value" },
  "ip": "192.168.1.1"
}
```
```

#### Método `tick()` ✏️
Skip jobs webhook-triggered (não são time-based):
```typescript
if (job.trigger?.type === 'webhook') {
  continue; // Handled by HTTP endpoint
}
```

#### Método `start()` ✏️
Chama `registerWebhooks()`:
```typescript
this.registerFileWatchers();
this.registerWebhooks(); // ← NOVO
```

---

### 5. `src/tools/cron-tool.ts` ✏️

**Mudanças:**

#### Parâmetros adicionados
```typescript
triggerType: 'time' | 'file' | 'webhook'
webhookRateLimit: number         // Default: 10
webhookIpWhitelist: string[]     // Optional
webhookAllowedMethods: string[]  // Default: ['POST']
```

#### Action `create` - Webhook branch 🆕

Quando `triggerType === 'webhook'`:

1. Gera `webhookId` e `secret`
2. Cria job com `trigger.webhook` config
3. Registra webhook com `scheduler.registerJobWebhook()`
4. Retorna URL + secret + exemplo curl

**Output:**
```
✅ Webhook-triggered job "My Job" created successfully

**ID:** abc123
**Webhook URL:** https://dashboard.com/api/webhook/trigger/abc123...
**Webhook ID:** abc123...
**Secret:** dGVzdHNlY3JldA==...
**Rate Limit:** 10 req/min
**Allowed Methods:** POST
**Status:** active

**To trigger:**
```bash
curl -X POST "https://dashboard.com/api/webhook/trigger/abc123..." \
  -H "X-Webhook-Signature: sha256=<signature>" \
  -H "Content-Type: application/json" \
  -d '{"key":"value"}'
```

**Note:** Store the secret securely - it's needed to sign requests
```

---

## 🔐 Segurança

### HMAC SHA256 Signature

**Cálculo (client-side):**
```javascript
const crypto = require('crypto');

const secret = 'dGVzdHNlY3JldA==...'; // From job creation
const payload = JSON.stringify({ key: 'value' });

const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const signature = 'sha256=' + hmac.digest('hex');

// Use in header: X-Webhook-Signature: sha256=...
```

**Validação (server-side):**
- Usa `timingSafeEqual()` para evitar timing attacks
- Compara byte-a-byte

### Rate Limiting

- **Window:** 1 minuto
- **Default:** 10 requests/min
- **Configurável:** Por webhook
- **Cleanup:** Janelas expiradas removidas a cada minuto

### IP Whitelist

- **Opcional:** Se não configurado, permite todos
- **Formato:** Array de IPs (`['192.168.1.1', '10.0.0.1']`)
- **Headers verificados:**
  - `x-forwarded-for` (primeiro IP)
  - `x-real-ip`
  - Fallback: `'unknown'`

---

## 📊 Casos de Uso

### 1. GitHub Webhook (Deploy on Push)

```typescript
// Criar job
await cronTool.execute({
  action: 'create',
  name: 'Deploy on GitHub Push',
  prompt: 'Deploy the application based on the webhook payload',
  triggerType: 'webhook',
  webhookRateLimit: 20,
  webhookAllowedMethods: ['POST'],
  userId: 'admin'
});

// Output: webhookId + secret

// Configurar no GitHub:
// Settings → Webhooks → Add webhook
// URL: https://dashboard.com/api/webhook/trigger/{webhookId}
// Secret: {secret}
// Content type: application/json
// Events: Just the push event
```

### 2. Stripe Webhook (Payment Confirmation)

```typescript
await cronTool.execute({
  action: 'create',
  name: 'Process Stripe Payment',
  prompt: 'Confirm payment and send confirmation email. Use payload.amount and payload.customer_email',
  triggerType: 'webhook',
  webhookRateLimit: 30,
  userId: 'billing'
});

// Configurar no Stripe Dashboard:
// Developers → Webhooks → Add endpoint
// Events: payment_intent.succeeded
```

### 3. IoT Sensor (Temperature Alert)

```typescript
await cronTool.execute({
  action: 'create',
  name: 'Temperature Alert',
  prompt: 'Check temperature from sensor. If > 30°C, send alert via Telegram',
  triggerType: 'webhook',
  webhookRateLimit: 60, // 1 req/second
  webhookIpWhitelist: ['192.168.1.100'], // Only from sensor
  tags: ['iot', 'monitoring'],
  group: 'sensors'
});
```

---

## ✅ Checklist de Validação

- [x] TriggerType 'webhook' adicionado
- [x] WebhookTriggerConfig interface criada
- [x] WebhookTriggerManager implementado
- [x] HMAC SHA256 validation
- [x] Rate limiting (in-memory, 1min window)
- [x] IP whitelist support
- [x] Timing-safe comparison
- [x] API Route Next.js criada
- [x] GET support (opcional)
- [x] Client IP extraction
- [x] Integração com CronScheduler
- [x] Context payload para jobs
- [x] Auto-registro no start()
- [x] registerJobWebhook() para jobs dinâmicos
- [x] cron-tool suporte para webhook
- [x] Exemplo curl no output
- [x] Secret gerado com crypto.randomBytes
- [x] Compilação sem erros

---

## 📈 Métricas

**Linhas de Código:**
- `cron-types.ts`: +25 linhas
- `webhook-trigger-manager.ts`: +300 linhas (NOVO)
- `route.ts (API)`: +220 linhas (NOVO)
- `cron-scheduler.ts`: +60 linhas
- `cron-tool.ts`: +90 linhas

**Total:** ~695 linhas adicionadas

**Métodos Públicos Adicionados:** 11
- WebhookTriggerManager: 7 métodos
- CronScheduler: 3 métodos
- API Route: 2 handlers (POST + GET)

**Segurança:**
- HMAC SHA256 ✅
- Timing-safe comparison ✅
- Rate limiting ✅
- IP whitelist ✅

---

## 🧪 Teste Manual

### 1. Criar Webhook Job

```bash
# Via cron-tool (simulado)
{
  "action": "create",
  "name": "Test Webhook",
  "prompt": "Process webhook data from payload.message",
  "triggerType": "webhook",
  "userId": "test"
}

# Output:
# webhookId: abc123...
# secret: dGVzdHNlY3JldA==...
# URL: http://localhost:3000/api/webhook/trigger/abc123...
```

### 2. Calcular Signature

```javascript
// Node.js
const crypto = require('crypto');
const secret = 'dGVzdHNlY3JldA==...';
const payload = JSON.stringify({ message: 'Hello World!' });

const hmac = crypto.createHmac('sha256', secret);
hmac.update(payload);
const signature = 'sha256=' + hmac.digest('hex');

console.log(signature);
```

### 3. Trigger Webhook

```bash
curl -X POST "http://localhost:3000/api/webhook/trigger/abc123..." \
  -H "X-Webhook-Signature: sha256=..." \
  -H "Content-Type: application/json" \
  -d '{"message":"Hello World!"}'

# Esperado: 200 OK
# {
#   "success": true,
#   "jobId": "...",
#   "message": "Job triggered successfully",
#   "timestamp": "..."
# }
```

### 4. Verificar Job Executado

```bash
# O prompt recebeu:
# "Process webhook data from payload.message"
#
# ---
# **Context:**
# ```json
# {
#   "webhookId": "abc123...",
#   "payload": { "message": "Hello World!" },
#   "ip": "127.0.0.1",
#   "timestamp": "2026-04-20T..."
# }
# ```
```

---

## 🎯 Próximos Passos

**Phase 2 Restante:**
1. ✅ Tags & Groups (2h)
2. ✅ Webhook Triggers (4h)
3. ⏳ **Jitter** (3-4h) - Próximo
4. ⏳ **Dashboard UI** (8-12h)
5. ⏳ **Conditional Triggers** (8-12h)

**Testes (ao final):**
- Unit tests para HMAC validation
- Unit tests para rate limiting
- Integration tests webhook → job execution
- Security tests (timing attacks, invalid signatures)

---

## 📝 Observações

- ✅ Implementação mais rápida que estimado (4h vs 8-12h)
- ✅ HMAC validation timing-safe desde o início
- ✅ Rate limiting in-memory (suficiente para uso moderado)
- ⚠️ Para alta escala: considerar Redis para rate limiting
- ✅ Suporte GET opcional (útil para alguns serviços)
- ✅ Context payload integrado com scheduler
- ✅ Exemplo curl ajuda desenvolvedores a testar

**Status:** Pronto para próxima feature (Jitter)
