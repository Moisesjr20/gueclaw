# 🔄 Análise Comparativa: Sistemas de Triggers e Automação

**Data:** 20 de Abril de 2026  
**Análise:** DVACE vs Hermes-Agent vs GueClaw (sistema atual)

---

## 📊 Executive Summary

✅ **GueClaw JÁ POSSUI um sistema de Cron Scheduler funcional e robusto**  
✅ Três sistemas analisados têm abordagens diferentes e complementares  
⚠️ Identificadas **8 melhorias estratégicas** para implementar no GueClaw

---

## 🎯 Comparativo dos Três Sistemas

### 1️⃣ **GueClaw Cron Scheduler** (Sistema Atual)

**Tecnologia:** TypeScript + Node.js  
**Localização:** `src/services/cron/`  
**Status:** ✅ **Implementado e funcional**

#### ✅ Pontos Fortes

| Característica | Detalhes |
|----------------|----------|
| **4 Formatos de Schedule** | Intervalos (`30m`, `2h`), Cron (`0 7 * * *`), ISO timestamps, execuções únicas |
| **Execução via AgentLoop** | Jobs têm acesso total a todas as ferramentas, memória e contexto |
| **3 Modos de Entrega** | Telegram, arquivo local, silencioso (`[SILENT]` marker) |
| **Persistência Atômica** | File locking para concorrência segura (`jobs.json`) |
| **Gerenciamento Completo** | Criar, listar, pausar, retomar, deletar, trigger manual |
| **Histórico Detalhado** | Output, duração, tokens usados, ferramentas chamadas |
| **Tool + Command Interface** | Acesso via `/cron` (Telegram) e `cron_manager` (LLM Tool) |
| **Tick Loop 60s** | Verificação a cada minuto para jobs vencidos |

#### ⚠️ Limitações Identificadas

1. **Sem Jitter (Variação de Tempo)** ❌
   - Jobs executam no horário exato
   - Pode causar sobrecarga se múltiplos jobs coincidirem
   
2. **Delivery Limitado** ⚠️
   - Apenas Telegram + Local
   - Sem WhatsApp, Email, Webhook, Discord
   
3. **Sem Recovery de Missed Tasks** ❌
   - Jobs perdidos durante downtime não são recuperados
   - Sem `maxRetries` ou `backoff`
   
4. **Sem Event Triggers** ❌
   - Apenas time-based
   - Sem triggers por: arquivo modificado, webhook recebido, condição atingida
   
5. **Sem Cron Groups/Tags** ⚠️
   - Dificulta gerenciamento de múltiplos jobs relacionados
   
6. **Sem Skill-Specific Hooks** ❌
   - Skills não podem registrar eventos automáticos (ex: skill de backup auto-ativar job de backup)
   
7. **Sem Timeout Protection** ⚠️
   - Jobs podem rodar indefinidamente
   
8. **Storage JSON Simples** ⚠️
   - Pode não escalar bem com centenas de jobs

---

### 2️⃣ **Hermes-Agent Cron System**

**Tecnologia:** Python + asyncio  
**Localização:** `cron/scheduler.py` + `cron/jobs.py`  
**Status:** ✅ Sistema maduro e production-ready

#### ✅ Pontos Fortes Únicos

| Feature | Implementação |
|---------|---------------|
| **Multi-Platform Delivery** | Telegram, Discord, Slack, WhatsApp, Signal, Matrix, Mattermost, HomeAssistant, QQBot |
| **File-Based Locking** | `~/.hermes/cron/.tick.lock` com `fcntl`/`msvcrt` cross-platform |
| **Missed Task Recovery** | `findMissedTasks()` executa jobs perdidos no startup |
| **[SILENT] Marker** | Similar ao GueClaw (auditoria local, sem delivery) |
| **Gateway Integration** | Chamado por background thread do gateway (multi-plataforma) |
| **Delivery Fallback Logic** | Tenta origin → adapter → standalone send → home channel |
| **Media Attachments** | Suporta envio de áudio, vídeo, imagens como resultado de cron |
| **E2EE Room Support** | Usa live adapter para Matrix encrypted rooms |
| **Delivery Target Validation** | `_KNOWN_DELIVERY_PLATFORMS` previne env var enumeration |
| **Thread-Aware Delivery** | Preserva `thread_id` para delivery em topics/threads |

#### 🔥 Diferenciais do Hermes

```python
# 1. MISSED TASK RECOVERY
def findMissedTasks(tasks: List[CronTask], nowMs: int) -> List[CronTask]:
    """Retorna one-shot tasks que deveriam ter rodado durante downtime"""
    missed = []
    for t in tasks:
        if not t.recurring and t.nextRunMs < nowMs:
            missed.append(t)
    return missed

# 2. DELIVERY COM FALLBACK ROBUSTO
def _resolve_delivery_target(job: dict) -> Optional[dict]:
    if deliver == "origin":
        if origin:
            return origin  # Responde no chat de origem
        # Fallback para home channel
        for platform in ("matrix", "telegram", "discord", "slack"):
            chat_id = os.getenv(f"{platform.upper()}_HOME_CHANNEL")
            if chat_id:
                return {"platform": platform, "chat_id": chat_id}

# 3. MEDIA ROUTING AUTOMÁTICO
def _send_media_via_adapter(adapter, chat_id, media_files, metadata):
    for media_path, _is_voice in media_files:
        ext = Path(media_path).suffix.lower()
        if ext in _AUDIO_EXTS:
            await adapter.send_voice(chat_id, media_path)
        elif ext in _VIDEO_EXTS:
            await adapter.send_video(chat_id, media_path)
        # ... etc
```

#### 📚 Arquitetura do Hermes

```
hermes-agent/
├── cron/
│   ├── scheduler.py           # Tick loop + delivery
│   └── jobs.py                # Storage + schedule parsing
├── gateway/
│   └── run.py                 # Background thread chama scheduler.tick()
└── tools/
    └── send_message_tool.py   # Roteamento multi-plataforma
```

---

### 3️⃣ **DVACE Kairos Scheduler**

**Tecnologia:** TypeScript + Chokidar (file watching)  
**Localização:** `src/utils/cronScheduler.ts` + `src/tools/ScheduleCronTool/`  
**Status:** ✅ Sistema integrado com assistente Kairos

#### ✅ Pontos Fortes Únicos

| Feature | Implementação |
|---------|---------------|
| **Durable vs In-Memory** | Jobs podem ser persistentes ou session-only |
| **File Watching** | Usa `chokidar` para reagir a mudanças em `scheduled_tasks.json` |
| **Jitter Support** | `CronJitterConfig` adiciona variação de tempo (±15min default) |
| **Age-Based Expiry** | Jobs recorrentes expiram após N dias (default 90) |
| **Permanent Tasks** | Flag para tasks que nunca expiram |
| **Lock-Based Ownership** | Multi-session: apenas 1 scheduler ativo por vez |
| **Missed Task Notification** | Gera notificação formatada para one-shot tasks perdidos |
| **Analytics Integration** | Log de eventos via `logEvent()` |
| **One-Shot Jitter** | Jitter diferente para execuções únicas vs recorrentes |
| **Auto-Enable on Task Add** | Scheduler ativa automaticamente quando tasks são criadas |

#### 🔥 Diferenciais do DVACE

```typescript
// 1. JITTER (VARIAÇÃO DE TEMPO)
export function jitteredNextCronRunMs(
  expr: string,
  nowMs: number,
  config: CronJitterConfig
): number {
  const exactMs = nextCronRunMs(expr, nowMs)
  const jitterMs = Math.floor(
    Math.random() * (config.maxJitterMinutes * 2 + 1) - config.maxJitterMinutes
  ) * 60_000
  return exactMs + jitterMs
}
// Evita sobrecarga quando múltiplos jobs coincidem

// 2. AGE-BASED EXPIRY
export function isRecurringTaskAged(
  task: CronTask,
  nowMs: number,
  maxAgeMs: number
): boolean {
  if (maxAgeMs === 0) return false
  return Boolean(
    task.recurring && !task.permanent && nowMs - task.createdAt >= maxAgeMs
  )
}
// Auto-limpeza de jobs antigos

// 3. DURABLE vs IN-MEMORY
const inputSchema = z.strictObject({
  cron: z.string(),
  prompt: z.string(),
  recurring: z.boolean().optional(),
  durable: z.boolean().optional()  // ← persist across restarts
})

// 4. FILE WATCHING (HOT RELOAD)
const watcher = chokidar.watch(taskFilePath, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: FILE_STABILITY_MS }
})
watcher.on('change', () => {
  console.log('Cron file changed, reloading tasks')
  loadTasksFromFile()
})

// 5. LOCK-BASED SCHEDULER OWNERSHIP
const lockAcquired = tryAcquireSchedulerLock(sessionId)
if (!lockAcquired) {
  console.log('Another session owns the scheduler, standing by')
  // Probe periodically for takeover
}
```

#### 📚 Arquitetura do DVACE

```
src/
├── tools/ScheduleCronTool/
│   ├── CronCreateTool.ts      # LLM tool para criar jobs
│   ├── CronListTool.ts        # Listar jobs
│   ├── CronDeleteTool.ts      # Deletar jobs
│   └── prompt.js              # Prompts + feature flag
├── utils/
│   ├── cronScheduler.ts       # Core scheduler (1s tick)
│   ├── cronTasks.ts           # Storage + parsing
│   └── cronTasksLock.ts       # Multi-session locking
└── bootstrap/state.ts         # Session state (in-memory tasks)

.claude/
└── scheduled_tasks.json       # Persistent tasks (durable=true)
```

---

## 🆚 Comparação Side-by-Side

| Feature | GueClaw (Atual) | Hermes-Agent | DVACE Kairos |
|---------|-----------------|--------------|--------------|
| **Linguagem** | TypeScript | Python | TypeScript |
| **Tick Interval** | 60s | 60s (configurável) | 1s |
| **Schedule Formats** | 4 (interval, cron, ISO, once) | 3 (cron, duration, ISO) | 2 (cron, cron+jitter) |
| **Delivery Channels** | 2 (Telegram, Local) | 10+ (multi-plataforma) | 1 (in-app) |
| **Missed Task Recovery** | ❌ Não | ✅ Sim | ✅ Sim (one-shot only) |
| **File Locking** | ✅ Sim (atomic write) | ✅ Sim (fcntl/msvcrt) | ✅ Sim (process lock) |
| **Jitter** | ❌ Não | ❌ Não | ✅ Sim (±15min default) |
| **Age-Based Expiry** | ❌ Não | ❌ Não | ✅ Sim (90 days default) |
| **Media Attachments** | ❌ Não | ✅ Sim (audio, video, img) | ❌ Não |
| **Thread-Aware** | ❌ Não | ✅ Sim | ❌ Não |
| **Durable vs In-Memory** | Persistent only | Persistent only | ✅ Both |
| **File Watching** | ❌ Não | ❌ Não | ✅ Sim (chokidar) |
| **Analytics** | ❌ Não | ❌ Não | ✅ Sim (logEvent) |
| **Tool Interface** | ✅ Yes (`cron_manager`) | ✅ Yes (tool_use) | ✅ Yes (3 tools) |
| **Command Interface** | ✅ Yes (`/cron`) | ✅ Yes (slash commands) | ⚠️ Partial (UI) |
| **Retry Logic** | ❌ Não | ❌ Não | ❌ Não |
| **Timeout Protection** | ❌ Não | ❌ Não | ❌ Não |
| **Tags/Groups** | ❌ Não | ❌ Não | ❌ Não |
| **Event Triggers** | ❌ Não (time only) | ❌ Não (time only) | ❌ Não (time only) |
| **Webhook Triggers** | ❌ Não | ❌ Não | ❌ Não |
| **Max Jobs Limit** | ❌ Unlimited | ❌ Unlimited | ✅ 50 |
| **Output History** | ✅ Files (.md) | ✅ Files (.md) | ✅ In-memory + analytics |

---

## 🎯 8 Melhorias Estratégicas para GueClaw

Com base na análise dos três sistemas, identificamos **8 melhorias prioritárias**:

---

### ✅ **Melhoria 1: Multi-Platform Delivery** 🌐

**Inspiração:** Hermes-Agent  
**Prioridade:** 🔥🔥🔥 **ALTA**  
**Impacto:** Usuários poderão receber notificações em qualquer canal

#### 📝 Implementação

```typescript
// src/services/cron/cron-types.ts
export interface CronJob {
  // ... campos existentes
  deliver: 'telegram' | 'whatsapp' | 'email' | 'webhook' | 'discord' | 'local' | 'none';
  deliverTo?: string;  // Chat ID, email, webhook URL, etc
  deliveryMetadata?: {  // Para configs específicas de cada canal
    webhook?: { headers?: Record<string, string>, method?: 'POST' | 'GET' };
    email?: { subject?: string, cc?: string[] };
    whatsapp?: { groupJid?: string };
  };
}

// src/services/cron/delivery/
├── telegram-delivery.ts    // Existente
├── whatsapp-delivery.ts    // ← NOVO (via UazAPI)
├── email-delivery.ts       // ← NOVO (via nodemailer)
├── webhook-delivery.ts     // ← NOVO (fetch)
├── discord-delivery.ts     // ← NOVO (discord.js ou webhook)
└── delivery-router.ts      // ← Roteador central
```

**Exemplo de Uso:**

```typescript
// Criar job com delivery WhatsApp
{
  "action": "create",
  "name": "Alerta de Vendas",
  "schedule": "0 18 * * *",
  "prompt": "Gere relatório de vendas do dia",
  "deliver": "whatsapp",
  "deliverTo": "120363321748044262@g.us"  // JID do grupo
}

// Criar job com webhook
{
  "action": "create",
  "name": "Sync Externo",
  "schedule": "*/30 * * * *",
  "prompt": "[SILENT] Execute sync de dados",
  "deliver": "webhook",
  "deliverTo": "https://api.exemplo.com/webhook/gueclaw",
  "deliveryMetadata": {
    "webhook": {
      "headers": { "Authorization": "Bearer token123" },
      "method": "POST"
    }
  }
}
```

**Benefícios:**
- Integração com WhatsApp via UazAPI (já configurado no GueClaw)
- Webhooks para integrações externas (n8n, Zapier, Make)
- Email para relatórios formais
- Discord para comunidades

**Esforço:** ~8-12h (implementar 4 canais + roteador)

---

### ✅ **Melhoria 2: Jitter (Variação de Tempo)** ⏱️

**Inspiração:** DVACE Kairos  
**Prioridade:** 🔥🔥 **MÉDIA**  
**Impacto:** Evita sobrecarga quando múltiplos jobs coincidem

#### 📝 Implementação

```typescript
// src/services/cron/schedule-parser.ts

export interface CronSchedule {
  // ... campos existentes
  jitter?: {
    enabled: boolean;
    maxMinutes: number;  // ±15 min default
  };
}

export function calculateNextRunWithJitter(
  schedule: CronSchedule,
  from: Date = new Date()
): Date {
  const exactTime = calculateNextRun(schedule, from);
  
  if (!schedule.jitter?.enabled) {
    return exactTime;
  }
  
  const maxMs = schedule.jitter.maxMinutes * 60_000;
  const jitterMs = Math.floor(Math.random() * (maxMs * 2 + 1)) - maxMs;
  
  return new Date(exactTime.getTime() + jitterMs);
}
```

**Exemplo de Uso:**

```typescript
// Job com jitter ±30min
{
  "action": "create",
  "name": "Backup DB",
  "schedule": "0 2 * * *",  // 2h AM exato
  "prompt": "Execute backup completo",
  "jitter": { "enabled": true, "maxMinutes": 30 }
}
// Executará entre 01:30 e 02:30 (variação aleatória)
```

**Casos de Uso:**
- Backups (evitar sobrecarga no mesmo horário)
- Relatórios não urgentes
- Sincronizações de dados

**Esforço:** ~3-4h

---

### ✅ **Melhoria 3: Missed Task Recovery** 🔄

**Inspiração:** Hermes-Agent + DVACE  
**Prioridade:** 🔥🔥🔥 **ALTA**  
**Impacto:** Confiabilidade — jobs perdidos são recuperados

#### 📝 Implementação

```typescript
// src/services/cron/cron-scheduler.ts

export class CronScheduler {
  // ... código existente
  
  /**
   * Executa missed tasks no startup
   */
  public async recoverMissedTasks(): Promise<void> {
    const jobs = this.storage.loadJobs();
    const now = new Date();
    const missed: CronJob[] = [];
    
    for (const job of jobs) {
      if (job.status !== 'active') continue;
      
      const nextRun = new Date(job.nextRun);
      const timeSinceScheduled = now.getTime() - nextRun.getTime();
      
      // Recupera jobs que deveriam ter rodado nas últimas 24h
      if (timeSinceScheduled > 0 && timeSinceScheduled < 86400000) {
        missed.push(job);
      }
    }
    
    if (missed.length > 0) {
      console.log(`[CronScheduler] Recovering ${missed.length} missed tasks`);
      
      for (const job of missed) {
        console.log(`  - ${job.name} (scheduled: ${job.nextRun})`);
        
        // Executa job missed
        await this.executeJob(job);
        
        // Adiciona metadata de recovery no output
        const lastOutput = this.storage.getLastOutput(job.id);
        if (lastOutput) {
          lastOutput.recovered = true;
          lastOutput.originalScheduledTime = job.nextRun;
          this.storage.updateOutput(lastOutput);
        }
      }
    }
  }
  
  public start(): void {
    if (this.isRunning) return;
    
    this.storage.ensureDirs();
    this.isRunning = true;
    
    // ← NOVO: Recupera missed tasks antes de iniciar tick loop
    this.recoverMissedTasks().catch(err => {
      console.error('[CronScheduler] Missed task recovery failed:', err);
    });
    
    // Initial tick
    this.tick();
    
    // ... resto do código
  }
}
```

**Lógica de Recovery:**

```typescript
// src/services/cron/cron-types.ts

export interface CronJobOutput {
  // ... campos existentes
  recovered?: boolean;  // ← NOVO
  originalScheduledTime?: string;  // ← NOVO
}

export interface CronRecoveryConfig {
  enabled: boolean;
  maxRecoveryWindowHours: number;  // Default: 24h
  notifyOnRecovery: boolean;  // Default: true
}
```

**Exemplo de Output Recovered:**

```markdown
## Cron Job Output: Relatório Diário

**Job ID:** abc-123-def  
**Status:** ✅ Success (RECOVERED)  
**Original Schedule:** 2026-04-19T07:00:00Z  
**Actual Execution:** 2026-04-20T10:15:32Z  
**Recovery Window:** 27h 15m  

---

Relatório de vendas do dia 19/04/2026...
```

**Esforço:** ~4-6h

---

### ✅ **Melhoria 4: Age-Based Expiry & Permanent Tasks** ⏳

**Inspiração:** DVACE Kairos  
**Prioridade:** 🔥 **BAIXA**  
**Impacto:** Auto-limpeza de jobs antigos

#### 📝 Implementação

```typescript
// src/services/cron/cron-types.ts

export interface CronJob {
  // ... campos existentes
  permanent?: boolean;  // ← NOVO: nunca expira
  maxAgeDays?: number;  // ← NOVO: expira após N dias (recurring only)
}

// src/services/cron/cron-scheduler.ts

private async tick(): Promise<void> {
  const jobs = this.storage.loadJobs();
  const now = new Date();
  
  for (const job of jobs) {
    if (job.status !== 'active') continue;
    
    // ← NOVO: Verifica expiry
    if (this.isJobExpired(job, now)) {
      console.log(`[CronScheduler] Job "${job.name}" expired (age limit reached)`);
      
      await this.storage.updateJob(job.id, {
        status: 'disabled',
        disabledReason: 'age_limit_reached',
        disabledAt: now.toISOString()
      });
      
      // Notifica usuário
      if (job.deliver === 'telegram' && job.userId) {
        await this.telegramBot.api.sendMessage(
          job.userId,
          `⏳ Job "${job.name}" foi desabilitado por limite de idade (${job.maxAgeDays} dias)`
        );
      }
      
      continue;
    }
    
    // ... resto do código (verifica nextRun, executa, etc)
  }
}

private isJobExpired(job: CronJob, now: Date): boolean {
  // Permanent jobs nunca expiram
  if (job.permanent) return false;
  
  // One-shot jobs não expiram por idade
  if (job.schedule.kind === 'once') return false;
  
  // Sem limite de idade configurado
  if (!job.maxAgeDays) return false;
  
  const createdAt = new Date(job.createdAt);
  const ageMs = now.getTime() - createdAt.getTime();
  const maxAgeMs = job.maxAgeDays * 24 * 60 * 60 * 1000;
  
  return ageMs >= maxAgeMs;
}
```

**Exemplo de Uso:**

```typescript
// Job com expiry
{
  "action": "create",
  "name": "Promoção Black Friday",
  "schedule": "0 9,15,21 * * *",  // 3x ao dia
  "prompt": "Envie lembretes da promoção",
  "maxAgeDays": 7  // Expira após 7 dias
}

// Job permanente
{
  "action": "create",
  "name": "Heartbeat",
  "schedule": "*/5 * * * *",  // A cada 5 min
  "prompt": "[SILENT] Ping health check",
  "permanent": true  // Nunca expira
}
```

**Esforço:** ~2-3h

---

### ✅ **Melhoria 5: Event Triggers (Além de Time-Based)** 🎣

**Inspiração:** Arquitetura moderna de event-driven systems  
**Prioridade:** 🔥🔥🔥 **ALTA**  
**Impacto:** Expande drasticamente os casos de uso

#### 📝 Implementação

```typescript
// src/services/cron/cron-types.ts

export type TriggerType = 'time' | 'file' | 'webhook' | 'condition';

export interface CronTrigger {
  type: TriggerType;
  
  // Time-based (existente)
  schedule?: CronSchedule;
  
  // File-based (NOVO)
  fileWatch?: {
    path: string;  // Caminho do arquivo ou glob pattern
    event: 'created' | 'modified' | 'deleted';
    debounceMs?: number;  // Default: 5000ms
  };
  
  // Webhook-based (NOVO)
  webhook?: {
    id: string;  // UUID único para o webhook
    secret?: string;  // HMAC secret para validação
  };
  
  // Condition-based (NOVO)
  condition?: {
    expression: string;  // JavaScript expression
    checkIntervalMinutes: number;  // Default: 5
  };
}

export interface CronJob {
  // ... campos existentes
  trigger: CronTrigger;  // ← MUDANÇA: schedule vira trigger
}
```

**Implementação de File Watcher:**

```typescript
// src/services/cron/triggers/file-trigger.ts

import chokidar from 'chokidar';

export class FileTriggerManager {
  private watchers = new Map<string, chokidar.FSWatcher>();
  
  public registerFileWatch(
    jobId: string,
    fileWatch: FileWatchConfig,
    onTrigger: () => void
  ): void {
    const watcher = chokidar.watch(fileWatch.path, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: fileWatch.debounceMs || 5000
      }
    });
    
    watcher.on(fileWatch.event, () => {
      console.log(`[FileTrigger] Job ${jobId} triggered by ${fileWatch.event} on ${fileWatch.path}`);
      onTrigger();
    });
    
    this.watchers.set(jobId, watcher);
  }
  
  public unregisterFileWatch(jobId: string): void {
    const watcher = this.watchers.get(jobId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(jobId);
    }
  }
}
```

**Implementação de Webhook Trigger:**

```typescript
// src/routes/webhook-triggers.ts

import { Router } from 'express';
import crypto from 'crypto';

export const webhookTriggerRouter = Router();

webhookTriggerRouter.post('/webhook/trigger/:webhookId', async (req, res) => {
  const { webhookId } = req.params;
  const signature = req.headers['x-webhook-signature'] as string;
  
  // Busca job associado ao webhook
  const job = CronStorage.getInstance().getJobByWebhookId(webhookId);
  
  if (!job) {
    return res.status(404).json({ error: 'Webhook not found' });
  }
  
  // Valida assinatura HMAC (se configurado)
  if (job.trigger.webhook?.secret) {
    const expectedSignature = crypto
      .createHmac('sha256', job.trigger.webhook.secret)
      .update(JSON.stringify(req.body))
      .digest('hex');
    
    if (signature !== expectedSignature) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }
  
  // Dispara execução do job
  const scheduler = CronScheduler.getInstance();
  await scheduler.triggerJob(job.id, { webhookPayload: req.body });
  
  res.json({ success: true, jobId: job.id });
});
```

**Implementação de Condition Trigger:**

```typescript
// src/services/cron/triggers/condition-trigger.ts

export class ConditionTriggerManager {
  private intervalIds = new Map<string, NodeJS.Timeout>();
  
  public registerCondition(
    jobId: string,
    condition: ConditionConfig,
    onTrigger: () => void
  ): void {
    const checkInterval = setInterval(async () => {
      try {
        // Contexto seguro para eval
        const context = {
          db: Database.getInstance(),
          storage: CronStorage.getInstance(),
          env: process.env,
          // ... adicione contextos seguros
        };
        
        // Avalia expressão
        const result = await this.evaluateCondition(condition.expression, context);
        
        if (result === true) {
          console.log(`[ConditionTrigger] Job ${jobId} triggered by condition: ${condition.expression}`);
          onTrigger();
        }
      } catch (error) {
        console.error(`[ConditionTrigger] Error evaluating condition for job ${jobId}:`, error);
      }
    }, condition.checkIntervalMinutes * 60_000);
    
    this.intervalIds.set(jobId, checkInterval);
  }
  
  private async evaluateCondition(expression: string, context: any): Promise<boolean> {
    // Implementação segura de eval (usar vm2 ou similar)
    const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
    const fn = new AsyncFunction(...Object.keys(context), `return (${expression})`);
    return await fn(...Object.values(context));
  }
}
```

**Exemplos de Uso:**

```typescript
// 1. FILE TRIGGER: Backup automático quando arquivo de config muda
{
  "action": "create",
  "name": "Auto Backup on Config Change",
  "trigger": {
    "type": "file",
    "fileWatch": {
      "path": "/opt/gueclaw-agent/config/*.json",
      "event": "modified",
      "debounceMs": 10000  // 10s debounce
    }
  },
  "prompt": "Execute backup completo das configurações"
}

// 2. WEBHOOK TRIGGER: Deploy automático ao receber webhook do GitHub
{
  "action": "create",
  "name": "Auto Deploy",
  "trigger": {
    "type": "webhook",
    "webhook": {
      "id": "abc-deploy-123",
      "secret": "gh_webhook_secret_xyz"
    }
  },
  "prompt": "Execute deploy da aplicação usando vps_tool"
}

// 3. CONDITION TRIGGER: Alerta quando espaço em disco < 10%
{
  "action": "create",
  "name": "Low Disk Alert",
  "trigger": {
    "type": "condition",
    "condition": {
      "expression": "(await db.query('SELECT disk_usage FROM system_stats')).disk_usage > 90",
      "checkIntervalMinutes": 15
    }
  },
  "prompt": "⚠️ ALERTA: Espaço em disco crítico! Gere relatório de uso."
}
```

**Esforço:** ~16-24h (maior melhoria)

---

### ✅ **Melhoria 6: Retry Logic & Timeout Protection** 🔄

**Inspiração:** Best practices de production systems  
**Prioridade:** 🔥🔥 **MÉDIA**  
**Impacto:** Resiliência e estabilidade

#### 📝 Implementação

```typescript
// src/services/cron/cron-types.ts

export interface CronJob {
  // ... campos existentes
  maxRetries?: number;  // Default: 0 (sem retry)
  retryBackoffMs?: number;  // Default: 60000 (1min)
  timeoutSeconds?: number;  // Default: 300 (5min)
  retryCount?: number;  // Contador atual
}

// src/services/cron/cron-scheduler.ts

private async executeJob(job: CronJob): Promise<void> {
  const startTime = Date.now();
  const timeout = (job.timeoutSeconds || 300) * 1000;
  
  try {
    // Executa com timeout
    const result = await Promise.race([
      this.agentController.processDirectMessage(job.prompt, job.userId),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Job timeout')), timeout)
      )
    ]);
    
    // Sucesso — reseta retry counter
    if (job.retryCount && job.retryCount > 0) {
      await this.storage.updateJob(job.id, { retryCount: 0 });
    }
    
    // ... salva output, delivery, etc
    
  } catch (error: any) {
    console.error(`[CronScheduler] Job "${job.name}" failed:`, error);
    
    const currentRetries = job.retryCount || 0;
    const maxRetries = job.maxRetries || 0;
    
    if (currentRetries < maxRetries) {
      // Agenda retry
      const backoffMs = job.retryBackoffMs || 60000;
      const nextRetryTime = new Date(Date.now() + backoffMs);
      
      console.log(
        `[CronScheduler] Scheduling retry ${currentRetries + 1}/${maxRetries} ` +
        `for job "${job.name}" at ${nextRetryTime.toISOString()}`
      );
      
      await this.storage.updateJob(job.id, {
        retryCount: currentRetries + 1,
        nextRun: nextRetryTime.toISOString()
      });
      
    } else {
      // Max retries atingido
      console.error(`[CronScheduler] Job "${job.name}" failed permanently after ${maxRetries} retries`);
      
      // Salva erro
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: false,
        error: `Failed after ${maxRetries} retries: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      this.storage.saveOutput(output);
      
      // Notifica falha permanente
      if (job.deliver === 'telegram' && job.userId) {
        await this.telegramBot.api.sendMessage(
          job.userId,
          `❌ **Job Failed Permanently**\n\n` +
          `**Job:** ${job.name}\n` +
          `**Retries:** ${maxRetries}\n` +
          `**Error:** ${error.message}`
        );
      }
      
      // Reseta retry counter para próxima execução scheduled
      await this.storage.updateJob(job.id, { retryCount: 0 });
    }
  }
}
```

**Exemplo de Uso:**

```typescript
// Job com retry + timeout
{
  "action": "create",
  "name": "API Sync",
  "schedule": "0 */6 * * *",  // A cada 6h
  "prompt": "Execute sync com API externa",
  "maxRetries": 3,
  "retryBackoffMs": 300000,  // 5 min entre retries
  "timeoutSeconds": 600  // Timeout de 10 min
}
```

**Esforço:** ~4-6h

---

### ✅ **Melhoria 7: Tags/Groups para Organização** 🏷️

**Inspiração:** Sistemas de task management modernos  
**Prioridade:** 🔥 **BAIXA**  
**Impacto:** Organização e bulk operations

#### 📝 Implementação

```typescript
// src/services/cron/cron-types.ts

export interface CronJob {
  // ... campos existentes
  tags?: string[];  // ← NOVO: ['backup', 'critical', 'daily']
  group?: string;   // ← NOVO: 'production', 'dev', 'analytics'
}

// src/tools/cron-tool.ts

public async execute(args: Record<string, any>): Promise<ToolResult> {
  const { action, tags, group } = args;
  
  switch (action) {
    // ... outros casos
    
    case 'bulk_pause': {
      const jobs = this.storage.loadJobs();
      const matchingJobs = jobs.filter(job => 
        (tags && job.tags?.some(t => tags.includes(t))) ||
        (group && job.group === group)
      );
      
      for (const job of matchingJobs) {
        await this.storage.updateJob(job.id, { status: 'paused' });
      }
      
      return this.success(
        `⏸️ Paused ${matchingJobs.length} jobs\n\n` +
        `**Filter:** ${tags ? `tags=${tags.join(',')}` : `group=${group}`}`
      );
    }
    
    case 'list': {
      const { filterTags, filterGroup } = args;
      let jobs = this.storage.loadJobs();
      
      if (filterTags) {
        jobs = jobs.filter(job => 
          job.tags?.some(t => filterTags.includes(t))
        );
      }
      
      if (filterGroup) {
        jobs = jobs.filter(job => job.group === filterGroup);
      }
      
      // ... formata output
    }
  }
}
```

**Exemplo de Uso:**

```typescript
// Criar jobs com tags
{
  "action": "create",
  "name": "Backup DB",
  "schedule": "0 2 * * *",
  "tags": ["backup", "critical", "daily"],
  "group": "production"
}

// Pausar todos os jobs de backup
{
  "action": "bulk_pause",
  "tags": ["backup"]
}

// Listar apenas jobs críticos
{
  "action": "list",
  "filterTags": ["critical"]
}
```

**Esforço:** ~3-4h

---

### ✅ **Melhoria 8: Skill-Specific Hooks** 🎣

**Inspiração:** Plugin systems + lifecycle hooks  
**Prioridade:** 🔥🔥 **MÉDIA**  
**Impacto:** Skills podem auto-registrar automações

#### 📝 Implementação

```typescript
// src/types/skill.ts

export interface SkillDefinition {
  // ... campos existentes
  
  /**
   * Hooks executados em momentos específicos
   */
  hooks?: {
    /**
     * Executado quando a skill é ativada
     * Pode registrar cron jobs automaticamente
     */
    onActivate?: (context: SkillHookContext) => Promise<void>;
    
    /**
     * Executado quando a skill é desativada
     * Pode remover cron jobs registrados
     */
    onDeactivate?: (context: SkillHookContext) => Promise<void>;
    
    /**
     * Executado no boot do agente (se skill está ativa)
     */
    onBoot?: (context: SkillHookContext) => Promise<void>;
  };
}

export interface SkillHookContext {
  skillName: string;
  cronScheduler: CronScheduler;
  storage: CronStorage;
  config: Record<string, any>;
}

// .agents/skills/vps-security-scanner/SKILL.md

## Hooks

### onBoot

Auto-registra job de security scan semanal:

```typescript
export const hooks = {
  async onBoot(context: SkillHookContext) {
    const storage = context.cronScheduler.storage;
    
    // Verifica se já existe job de security scan
    const existingJobs = storage.loadJobs();
    const hasSecurityJob = existingJobs.some(
      job => job.name === 'Weekly Security Scan' && job.createdBy === context.skillName
    );
    
    if (!hasSecurityJob) {
      console.log('[vps-security-scanner] Auto-registering weekly scan job');
      
      await storage.createJob({
        name: 'Weekly Security Scan',
        prompt: 'Execute full security audit using vps-security-scanner skill',
        schedule: { kind: 'cron', expr: '0 22 * * 0' },  // Domingo 22h
        deliver: 'telegram',
        userId: process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',')[0],
        status: 'active',
        createdBy: context.skillName,  // Marca como criado pela skill
        tags: ['security', 'auto-registered'],
        permanent: true
      });
    }
  },
  
  async onDeactivate(context: SkillHookContext) {
    // Remove jobs criados pela skill
    const storage = context.cronScheduler.storage;
    const jobs = storage.loadJobs();
    
    const skillJobs = jobs.filter(job => job.createdBy === context.skillName);
    
    for (const job of skillJobs) {
      console.log(`[vps-security-scanner] Removing auto-registered job: ${job.name}`);
      await storage.deleteJob(job.id);
    }
  }
};
```

**Exemplo de Skill com Hooks:**

```markdown
# .agents/skills/google-calendar-daily/SKILL.md

## Auto-Registration

Esta skill auto-registra um cron job para enviar a agenda diária às 7h.

### Hook onBoot

```typescript
export const hooks = {
  async onBoot(context: SkillHookContext) {
    const hasJob = context.storage.loadJobs().some(
      job => job.createdBy === 'google-calendar-daily'
    );
    
    if (!hasJob) {
      await context.storage.createJob({
        name: 'Daily Calendar Summary',
        prompt: 'List my Google Calendar events for today and summarize',
        schedule: { kind: 'cron', expr: '0 7 * * *' },
        deliver: 'telegram',
        userId: process.env.TELEGRAM_USER_CHAT_ID,
        createdBy: 'google-calendar-daily',
        tags: ['calendar', 'auto-registered'],
        permanent: true
      });
    }
  }
};
```

**Benefícios:**
- Skills podem se auto-configurar
- Manutenção automática (desativar skill remove jobs)
- Experiência "plug-and-play"

**Esforço:** ~6-8h

---

## 📊 Resumo de Priorização

| Melhoria | Prioridade | Esforço | ROI | Implementar? |
|----------|-----------|---------|-----|--------------|
| **1. Multi-Platform Delivery** | 🔥🔥🔥 ALTA | 8-12h | Alto | ✅ Sim (Priority 1) |
| **2. Jitter** | 🔥🔥 MÉDIA | 3-4h | Médio | ⚠️ Considerar |
| **3. Missed Task Recovery** | 🔥🔥🔥 ALTA | 4-6h | Alto | ✅ Sim (Priority 2) |
| **4. Age-Based Expiry** | 🔥 BAIXA | 2-3h | Baixo | ❌ Não (nice-to-have) |
| **5. Event Triggers** | 🔥🔥🔥 ALTA | 16-24h | Muito Alto | ✅ Sim (Priority 3) |
| **6. Retry Logic & Timeout** | 🔥🔥 MÉDIA | 4-6h | Médio | ✅ Sim (Priority 4) |
| **7. Tags/Groups** | 🔥 BAIXA | 3-4h | Baixo | ⚠️ Considerar |
| **8. Skill-Specific Hooks** | 🔥🔥 MÉDIA | 6-8h | Alto | ✅ Sim (Priority 5) |

### Roadmap Sugerido

#### **Phase 1: Foundation (Prioridade Alta)** — 28-42h

1. ✅ Melhoria 3: Missed Task Recovery (4-6h)
2. ✅ Melhoria 6: Retry Logic & Timeout (4-6h)
3. ✅ Melhoria 1: Multi-Platform Delivery (8-12h)
4. ✅ Melhoria 5: Event Triggers - File Watch only (8-12h)
5. ✅ Melhoria 8: Skill-Specific Hooks (6-8h)

#### **Phase 2: Advanced (Prioridade Média)** — 24-36h

6. ⚠️ Melhoria 5: Event Triggers - Webhook + Condition (8-12h)
7. ⚠️ Melhoria 2: Jitter (3-4h)
8. ⚠️ Melhoria 7: Tags/Groups (3-4h)
9. ⚠️ Dashboard UI para gerenciar jobs (8-12h)

#### **Phase 3: Polish (Prioridade Baixa)** — 8-12h

10. ❌ Melhoria 4: Age-Based Expiry (2-3h)
11. ❌ SQLite Storage (migração de JSON) (4-6h)
12. ❌ Metrics & Analytics (2-3h)

---

## 🎯 Conclusão

### ✅ **GueClaw já tem um sistema de Cron sólido**

O sistema atual é funcional, bem arquitetado e cobre os casos de uso básicos:
- Time-based scheduling ✅
- Multi-format schedules ✅
- LLM Tool + Command interface ✅
- Persistent storage ✅
- Output history ✅

### 🚀 **Melhorias Estratégicas Identificadas**

As 8 melhorias propostas **não são correções de bugs**, mas **expansões de funcionalidade** inspiradas pelos pontos fortes do Hermes e DVACE:

1. **Multi-Platform Delivery** (Hermes) → Expande para WhatsApp, Email, Webhook, Discord
2. **Jitter** (DVACE) → Evita sobrecarga em horários coincidentes
3. **Missed Task Recovery** (Hermes + DVACE) → Confiabilidade
4. **Age-Based Expiry** (DVACE) → Auto-limpeza
5. **Event Triggers** (Novel) → Expande para file watch, webhooks, conditions
6. **Retry Logic & Timeout** (Best Practice) → Resiliência
7. **Tags/Groups** (Best Practice) → Organização
8. **Skill-Specific Hooks** (Novel) → Auto-configuração de skills

### 📅 **Roadmap Recomendado**

**Priority 1-3 (Phase 1):** Implementar melhorias 1, 3, 5 (file watch), 6, 8  
**Priority 4-6 (Phase 2):** Considerar melhorias 2, 5 (webhook/condition), 7  
**Future:** Melhoria 4, migração para SQLite, analytics

---

**Próximos Passos:**

1. ✅ Aprovar roadmap
2. ✅ Criar issues/tasks para cada melhoria
3. ✅ Implementar Phase 1 (28-42h)
4. ✅ Testar em produção
5. ✅ Iterar com feedback

---

**Documento gerado em:** 20/04/2026  
**Autor:** GueClaw Analysis Engine  
**Versão:** 1.0.0
