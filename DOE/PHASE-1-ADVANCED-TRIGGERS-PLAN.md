# 🚀 Implementation Plan: Phase 1 - Advanced Triggers Foundation

**Data:** 20 de Abril de 2026  
**Arquitetura:** DOE (Directives, Orchestration, Execution)  
**Objetivo:** Implementar as 5 melhorias prioritárias da Phase 1  
**Estimativa:** 28-42h  
**Status:** 🟡 Aguardando Aprovação

---

## 📋 Executive Summary

Implementação das melhorias fundamentais do sistema de Cron Scheduler do GueClaw:

1. ✅ **Missed Task Recovery** (4-6h) — Recupera jobs perdidos durante downtime
2. ✅ **Retry Logic & Timeout** (4-6h) — Resiliência em falhas
3. ✅ **Multi-Platform Delivery** (8-12h) — WhatsApp, Email, Webhook, Discord
4. ✅ **Event Triggers - File Watch** (8-12h) — Triggers baseados em mudanças de arquivo
5. ✅ **Skill-Specific Hooks** (6-8h) — Skills auto-registram seus jobs

**Total:** 30-44h de implementação + 4-6h de testes

---

## 🎯 Arquitetura Atual (Baseline)

### Estrutura de Arquivos
```
src/
├── services/
│   └── cron/
│       ├── cron-types.ts          # Interfaces e tipos
│       ├── cron-storage.ts        # Persistência JSON + file locking
│       ├── cron-scheduler.ts      # Engine principal (60s tick)
│       └── schedule-parser.ts     # Parse de schedules
└── tools/
    └── cron-tool.ts               # LLM tool interface

data/
└── cron/
    ├── jobs.json                  # Persistent jobs storage
    └── output/                    # Job execution outputs
        └── {jobId}.md
```

### Features Atuais
- ✅ Time-based scheduling: `once`, `interval`, `cron`
- ✅ Delivery targets: `telegram`, `local`, `none`
- ✅ JSON storage com file locking
- ✅ [SILENT] marker para auditoria sem delivery
- ✅ Auto-disable de one-shot jobs
- ✅ Singleton pattern (CronScheduler, CronStorage)
- ✅ AgentController integration para execução

### Limitações Identificadas
- ❌ Sem recovery de missed tasks
- ❌ Sem retry logic
- ❌ Sem timeout protection
- ❌ Apenas 3 delivery targets
- ❌ Apenas time-based triggers
- ❌ Skills não podem auto-registrar jobs

---

## 🏗️ Arquitetura Proposta (Phase 1)

### Nova Estrutura de Arquivos
```
src/
├── services/
│   └── cron/
│       ├── cron-types.ts                    # ← ESTENDER (recovery, retry, triggers)
│       ├── cron-storage.ts                  # ← ESTENDER (getJobByWebhookId, etc)
│       ├── cron-scheduler.ts                # ← MODIFICAR (recovery, retry, timeout)
│       ├── schedule-parser.ts               # (sem mudanças)
│       ├── delivery/                        # ← NOVO
│       │   ├── delivery-router.ts           # ← NOVO (roteador central)
│       │   ├── telegram-delivery.ts         # ← NOVO (extrair lógica existente)
│       │   ├── whatsapp-delivery.ts         # ← NOVO (UazAPI)
│       │   ├── email-delivery.ts            # ← NOVO (nodemailer)
│       │   ├── webhook-delivery.ts          # ← NOVO (fetch)
│       │   └── discord-delivery.ts          # ← NOVO (webhook)
│       └── triggers/                        # ← NOVO
│           └── file-trigger.ts              # ← NOVO (chokidar)
├── tools/
│   └── cron-tool.ts                         # ← ESTENDER (novos params)
├── types/
│   └── skill.ts                             # ← ESTENDER (hooks interface)
└── core/
    └── skill-hook-manager.ts                # ← NOVO

.agents/
└── skills/
    ├── vps-security-scanner/
    │   └── SKILL.md                         # ← ADICIONAR hooks
    └── google-calendar-daily/
        └── SKILL.md                         # ← ADICIONAR hooks
```

---

## 📝 Detailed Implementation Plan

### 🔹 Melhoria 1: Missed Task Recovery (4-6h)

#### Objetivo
Recuperar automaticamente jobs que deveriam ter sido executados durante downtime do sistema.

#### Arquivos a Modificar
1. **src/services/cron/cron-types.ts**
2. **src/services/cron/cron-scheduler.ts**

#### Mudanças Detalhadas

**1.1 — Estender interfaces (`cron-types.ts`)**

```typescript
// ADICIONAR ao final do arquivo

/**
 * Recovery configuration
 */
export interface CronRecoveryConfig {
  enabled: boolean;
  maxRecoveryWindowHours: number;  // Default: 24h
  notifyOnRecovery: boolean;  // Default: true
}

// ESTENDER CronJobOutput
export interface CronJobOutput {
  // ... campos existentes
  recovered?: boolean;  // ← NOVO
  originalScheduledTime?: string;  // ← NOVO
}
```

**1.2 — Implementar recovery no scheduler (`cron-scheduler.ts`)**

```typescript
// ADICIONAR novo método antes de start()

/**
 * Recover missed tasks from downtime
 */
public async recoverMissedTasks(): Promise<void> {
  const jobs = this.storage.loadJobs();
  const now = new Date();
  const missed: CronJob[] = [];
  
  // Recovery window: 24 hours
  const recoveryWindowMs = 24 * 60 * 60 * 1000;
  
  for (const job of jobs) {
    if (job.status !== 'active') continue;
    if (!job.nextRun) continue;
    
    const nextRun = new Date(job.nextRun);
    const timeSinceScheduled = now.getTime() - nextRun.getTime();
    
    // Job deveria ter rodado nas últimas 24h
    if (timeSinceScheduled > 0 && timeSinceScheduled < recoveryWindowMs) {
      // One-shot jobs: sempre recupera
      // Recurring jobs: recupera se não rodou ainda (lastRun < nextRun)
      if (job.schedule.type === 'once' || !job.lastRun || new Date(job.lastRun) < nextRun) {
        missed.push(job);
      }
    }
  }
  
  if (missed.length > 0) {
    console.log(`[CronScheduler] 🔄 Recovering ${missed.length} missed task(s)`);
    
    for (const job of missed) {
      console.log(`  - ${job.name} (scheduled: ${job.nextRun})`);
      await this.executeJob(job);
    }
  }
}

// MODIFICAR método start() - adicionar recovery antes do tick

public start(): void {
  if (this.isRunning) {
    console.log('[CronScheduler] Already running');
    return;
  }

  this.storage.ensureDirs();
  this.isRunning = true;

  // ← NOVO: Recover missed tasks
  this.recoverMissedTasks().catch(err => {
    console.error('[CronScheduler] Missed task recovery failed:', err);
  });

  // Initial tick
  this.tick();

  // Set up 60s interval
  this.tickInterval = setInterval(() => {
    this.tick();
  }, 60000);

  console.log('[CronScheduler] Started (60s tick interval)');
}

// MODIFICAR executeJob() - adicionar metadata de recovery

private async executeJob(job: CronJob, isRecovery: boolean = false): Promise<void> {
  const startTime = Date.now();

  try {
    // ... código existente de execução ...

    // Create output record
    const output: CronJobOutput = {
      jobId: job.id,
      jobName: job.name,
      success: true,
      output: cleanedOutput,
      duration,
      timestamp: new Date().toISOString(),
      toolsUsed: result.toolCalls?.map((tc: any) => tc.toolName),
      tokens: result.tokensUsed,
      recovered: isRecovery,  // ← NOVO
      originalScheduledTime: isRecovery ? job.nextRun : undefined  // ← NOVO
    };

    // ... resto do código ...
  }
}

// MODIFICAR recoverMissedTasks() para passar flag

for (const job of missed) {
  console.log(`  - ${job.name} (scheduled: ${job.nextRun})`);
  await this.executeJob(job, true);  // ← Passa isRecovery=true
}
```

**1.3 — Atualizar output format**

Modificar `saveOutput()` em `cron-storage.ts` para incluir recovery status no Markdown:

```typescript
// MODIFICAR método saveOutput() para incluir recovery info

const markdownContent = output.recovered
  ? `# 🔄 Cron Job Output: ${output.jobName} (RECOVERED)

**Job ID:** ${output.jobId}  
**Status:** ${output.success ? '✅ Success' : '❌ Failed'} (RECOVERED)  
**Original Schedule:** ${output.originalScheduledTime}  
**Actual Execution:** ${output.timestamp}  
**Duration:** ${output.duration}ms

---

${output.success ? output.output : `**Error:** ${output.error}`}
`
  : `# Cron Job Output: ${output.jobName}

**Job ID:** ${output.jobId}  
**Status:** ${output.success ? '✅ Success' : '❌ Failed'}  
**Timestamp:** ${output.timestamp}  
**Duration:** ${output.duration}ms

---

${output.success ? output.output : `**Error:** ${output.error}`}
`;
```

#### Testes
- [ ] Criar job one-shot para daqui a 2min, matar servidor, esperar 5min, reiniciar → job deve executar
- [ ] Criar job recurring (a cada 5min), matar servidor por 15min, reiniciar → job deve executar 1x (não 3x)
- [ ] Verificar output com metadata de recovery

---

### 🔹 Melhoria 2: Retry Logic & Timeout Protection (4-6h)

#### Objetivo
Adicionar retry automático em falhas e timeout protection para evitar jobs travados.

#### Arquivos a Modificar
1. **src/services/cron/cron-types.ts**
2. **src/services/cron/cron-scheduler.ts**
3. **src/tools/cron-tool.ts**

#### Mudanças Detalhadas

**2.1 — Estender interface CronJob (`cron-types.ts`)**

```typescript
// ADICIONAR campos ao CronJob

export interface CronJob {
  // ... campos existentes ...
  
  /**
   * Maximum retry attempts on failure (default: 0)
   */
  maxRetries?: number;
  
  /**
   * Backoff time between retries in milliseconds (default: 60000 = 1min)
   */
  retryBackoffMs?: number;
  
  /**
   * Execution timeout in seconds (default: 300 = 5min)
   */
  timeoutSeconds?: number;
  
  /**
   * Current retry counter (internal)
   */
  retryCount?: number;
}
```

**2.2 — Implementar timeout e retry (`cron-scheduler.ts`)**

```typescript
// MODIFICAR executeJob() completamente

private async executeJob(job: CronJob, isRecovery: boolean = false): Promise<void> {
  const startTime = Date.now();
  const timeout = (job.timeoutSeconds || 300) * 1000;

  try {
    if (!this.agentController) {
      throw new Error('AgentController not initialized');
    }

    console.log(`[CronScheduler] Executing job "${job.name}" (${job.id})`);

    // ← NOVO: Execute with timeout protection
    const result = await Promise.race([
      this.agentController.processDirectMessage(job.prompt, job.userId),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Job execution timeout')), timeout)
      )
    ]);

    const duration = Date.now() - startTime;

    // Check for [SILENT] marker
    const isSilent = result.response.includes('[SILENT]');
    const cleanedOutput = result.response.replace(/\[SILENT\]/g, '').trim();

    // Create output record
    const output: CronJobOutput = {
      jobId: job.id,
      jobName: job.name,
      success: true,
      output: cleanedOutput,
      duration,
      timestamp: new Date().toISOString(),
      toolsUsed: result.toolCalls?.map((tc: any) => tc.toolName),
      tokens: result.tokensUsed,
      recovered: isRecovery,
      originalScheduledTime: isRecovery ? job.nextRun : undefined
    };

    // Save output
    this.storage.saveOutput(output);

    // Deliver output (unless silent)
    if (!isSilent) {
      await this.deliverOutput(job, output);
    }

    // ← NOVO: Reset retry counter on success
    if (job.retryCount && job.retryCount > 0) {
      await this.storage.updateJob(job.id, { retryCount: 0 });
    }

    // Update job state
    await this.updateJobAfterExecution(job, true);

    console.log(`[CronScheduler] Job "${job.name}" completed successfully (${duration}ms)`);

  } catch (error: any) {
    const duration = Date.now() - startTime;

    console.error(`[CronScheduler] Job "${job.name}" failed:`, error);

    // ← NOVO: Retry logic
    const currentRetries = job.retryCount || 0;
    const maxRetries = job.maxRetries || 0;

    if (currentRetries < maxRetries) {
      // Schedule retry
      const backoffMs = job.retryBackoffMs || 60000;
      const nextRetryTime = new Date(Date.now() + backoffMs);

      console.log(
        `[CronScheduler] 🔄 Scheduling retry ${currentRetries + 1}/${maxRetries} ` +
        `for job "${job.name}" at ${nextRetryTime.toISOString()}`
      );

      await this.storage.updateJob(job.id, {
        retryCount: currentRetries + 1,
        nextRun: nextRetryTime.toISOString()
      });

    } else {
      // Max retries reached - permanent failure
      console.error(
        `[CronScheduler] ❌ Job "${job.name}" failed permanently after ${maxRetries} retries`
      );

      // Save error output
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: false,
        output: '',
        error: maxRetries > 0 
          ? `Failed after ${maxRetries} retries: ${error.message}`
          : error.message,
        duration,
        timestamp: new Date().toISOString()
      };

      this.storage.saveOutput(output);

      // Deliver error notification
      if (!job.prompt.includes('[SILENT]')) {
        await this.deliverOutput(job, output);
      }

      // Reset retry counter
      await this.storage.updateJob(job.id, { retryCount: 0 });

      // Update next run (for recurring jobs)
      await this.updateJobAfterExecution(job, false);
    }
  }
}
```

**2.3 — Atualizar cron-tool.ts para aceitar retry configs**

```typescript
// MODIFICAR getDefinition() - adicionar novos parâmetros

public getDefinition(): ToolDefinition {
  return {
    name: this.name,
    description: this.description,
    parameters: {
      type: 'object',
      properties: {
        // ... props existentes ...
        
        maxRetries: {
          type: 'number',
          description: 'Maximum retry attempts on failure (default: 0)'
        },
        retryBackoffMs: {
          type: 'number',
          description: 'Time between retries in milliseconds (default: 60000)'
        },
        timeoutSeconds: {
          type: 'number',
          description: 'Execution timeout in seconds (default: 300)'
        }
      },
      required: ['action']
    }
  };
}

// MODIFICAR execute() - passar novos campos ao criar job

case 'create': {
  // ... validação existente ...
  
  const newJob: CronJob = {
    id: randomUUID(),
    name,
    prompt,
    schedule: parsedSchedule,
    deliver: (deliver as DeliveryTarget) || 'telegram',
    deliverTo: deliverTo || userId,
    status: 'active',
    nextRun: nextRun.toISOString(),
    createdAt: now,
    updatedAt: now,
    userId,
    maxRetries: args.maxRetries || 0,  // ← NOVO
    retryBackoffMs: args.retryBackoffMs || 60000,  // ← NOVO
    timeoutSeconds: args.timeoutSeconds || 300  // ← NOVO
  };
  
  // ... resto do código ...
}
```

#### Testes
- [ ] Job com timeout 10s que demora 30s → deve falhar por timeout
- [ ] Job que falha com maxRetries=3 → deve tentar 4x total (1 original + 3 retries)
- [ ] Job que succeed no retry 2 → retryCount deve resetar para 0
- [ ] Job recurring que falha permanentemente → próximo run deve ser agendado normalmente

---

### 🔹 Melhoria 3: Multi-Platform Delivery (8-12h)

#### Objetivo
Suportar entrega em WhatsApp, Email, Webhook e Discord além de Telegram.

#### Dependências Necessárias
```bash
npm install nodemailer @types/nodemailer
```
(chokidar será instalado na Melhoria 4)

#### Arquivos a Criar/Modificar
1. **src/services/cron/cron-types.ts** - estender DeliveryTarget
2. **src/services/cron/delivery/delivery-router.ts** - NOVO
3. **src/services/cron/delivery/telegram-delivery.ts** - NOVO (extrair código existente)
4. **src/services/cron/delivery/whatsapp-delivery.ts** - NOVO
5. **src/services/cron/delivery/email-delivery.ts** - NOVO
6. **src/services/cron/delivery/webhook-delivery.ts** - NOVO
7. **src/services/cron/delivery/discord-delivery.ts** - NOVO
8. **src/services/cron/cron-scheduler.ts** - modificar deliverOutput()
9. **src/tools/cron-tool.ts** - estender params

#### Mudanças Detalhadas

**3.1 — Estender tipos (`cron-types.ts`)**

```typescript
// MODIFICAR DeliveryTarget

export type DeliveryTarget = 'telegram' | 'whatsapp' | 'email' | 'webhook' | 'discord' | 'local' | 'none';

// ADICIONAR ao CronJob

export interface CronJob {
  // ... campos existentes ...
  
  /**
   * Delivery metadata (channel-specific configs)
   */
  deliveryMetadata?: {
    webhook?: {
      headers?: Record<string, string>;
      method?: 'POST' | 'GET';
    };
    email?: {
      subject?: string;
      cc?: string[];
    };
    whatsapp?: {
      groupJid?: string;
    };
  };
}
```

**3.2 — Criar Delivery Router (`delivery/delivery-router.ts`)**

```typescript
import type { Bot } from 'grammy';
import type { CronJob, CronJobOutput } from '../cron-types';
import { TelegramDelivery } from './telegram-delivery';
import { WhatsAppDelivery } from './whatsapp-delivery';
import { EmailDelivery } from './email-delivery';
import { WebhookDelivery } from './webhook-delivery';
import { DiscordDelivery } from './discord-delivery';

export class DeliveryRouter {
  private telegramDelivery: TelegramDelivery;
  private whatsappDelivery: WhatsAppDelivery;
  private emailDelivery: EmailDelivery;
  private webhookDelivery: WebhookDelivery;
  private discordDelivery: DiscordDelivery;

  constructor(telegramBot?: Bot) {
    this.telegramDelivery = new TelegramDelivery(telegramBot);
    this.whatsappDelivery = new WhatsAppDelivery();
    this.emailDelivery = new EmailDelivery();
    this.webhookDelivery = new WebhookDelivery();
    this.discordDelivery = new DiscordDelivery();
  }

  public async deliver(job: CronJob, output: CronJobOutput): Promise<void> {
    try {
      switch (job.deliver) {
        case 'telegram':
          await this.telegramDelivery.send(job, output);
          break;

        case 'whatsapp':
          await this.whatsappDelivery.send(job, output);
          break;

        case 'email':
          await this.emailDelivery.send(job, output);
          break;

        case 'webhook':
          await this.webhookDelivery.send(job, output);
          break;

        case 'discord':
          await this.discordDelivery.send(job, output);
          break;

        case 'local':
          console.log('[DeliveryRouter] Output saved to local file');
          break;

        case 'none':
          console.log('[DeliveryRouter] No delivery configured');
          break;

        default:
          console.warn(`[DeliveryRouter] Unknown delivery target: ${job.deliver}`);
      }
    } catch (error) {
      console.error(`[DeliveryRouter] Failed to deliver via ${job.deliver}:`, error);
      throw error;
    }
  }
}
```

**3.3 — Implementar cada delivery channel**

Devido ao tamanho, vou criar um arquivo separado com os delivery implementations.

[Continua no próximo bloco...]

---

### 🔹 Melhoria 4: Event Triggers - File Watch (8-12h)

[Implementação detalhada após aprovação]

---

### 🔹 Melhoria 5: Skill-Specific Hooks (6-8h)

[Implementação detalhada após aprovação]

---

## ✅ Non-Negotiables Compliance

- [x] Nunca quebrar o build
- [x] Todo PR terá testes
- [x] kebab-case para novos arquivos
- [x] Usar `npm run test:unit` e `npm run test:e2e`
- [x] TypeScript strict mode
- [x] Backward compatibility mantida

---

## 🧪 Test Strategy

### Unit Tests
- `tests/unit/cron/recovery.test.ts` - Missed task recovery
- `tests/unit/cron/retry.test.ts` - Retry logic
- `tests/unit/cron/delivery.test.ts` - Multi-platform delivery
- `tests/unit/cron/file-triggers.test.ts` - File watching
- `tests/unit/cron/skill-hooks.test.ts` - Skill hooks

### Integration Tests
- `tests/integration/cron-flow.test.ts` - End-to-end cron flow
- `tests/integration/delivery-channels.test.ts` - Todos os canais

### E2E Tests (Manual)
- [ ] Criar job com recovery enabled → matar servidor → reiniciar → validar
- [ ] Job com retry → simular falha → validar tentativas
- [ ] Delivery em todos os canais → validar recebimento
- [ ] File trigger → modificar arquivo → validar execução
- [ ] Skill com hook → ativar skill → validar job criado

---

## 📦 Deliverables

1. ✅ Código implementado conforme plan
2. ✅ Testes unitários (coverage > 80%)
3. ✅ Testes de integração funcionando
4. ✅ Documentação atualizada:
   - README.md com novos features
   - Exemplos de uso
   - Variáveis de ambiente necessárias
5. ✅ Migration guide (se necessário)
6. ✅ Changelog entry

---

## 🚦 Go/No-Go Checklist

Antes de marcar como completo:

- [ ] Build passa sem erros
- [ ] Todos os testes passam
- [ ] Linter OK (`npm run lint:fix`)
- [ ] Type checking OK
- [ ] Backward compatibility confirmada
- [ ] Feature flags implementadas (se aplicável)
- [ ] Documentação atualizada
- [ ] Code review aprovado

---

## 📅 Execution Timeline (Proposto)

**Dia 1 (8h):**
- ✅ Melhoria 1: Missed Task Recovery (4-6h)
- ✅ Início Melhoria 2: Retry Logic (2-4h)

**Dia 2 (8h):**
- ✅ Finalizar Melhoria 2: Retry Logic & Timeout
- ✅ Início Melhoria 3: Multi-Platform Delivery (4h)

**Dia 3 (8h):**
- ✅ Finalizar Melhoria 3: Multi-Platform Delivery
- ✅ Testes de integração delivery

**Dia 4 (8h):**
- ✅ Melhoria 4: Event Triggers - File Watch

**Dia 5 (8h):**
- ✅ Melhoria 5: Skill-Specific Hooks
- ✅ Testes completos

**Dia 6 (4h):**
- ✅ Code review
- ✅ Documentação
- ✅ Deploy

---

## 🎯 Success Criteria

**Melhoria 1 (Recovery):**
- [x] Jobs missed durante downtime são executados no startup
- [x] Output marcado como RECOVERED
- [x] One-shot jobs não duplicam
- [x] Recurring jobs executam apenas 1x

**Melhoria 2 (Retry/Timeout):**
- [x] Jobs com timeout funcionam corretamente
- [x] Retry funciona até maxRetries
- [x] RetryCount reseta após sucesso
- [x] Notificação apenas em falha permanente

**Melhoria 3 (Multi-Delivery):**
- [x] WhatsApp delivery funciona (via UazAPI)
- [x] Email delivery funciona (SMTP)
- [x] Webhook delivery funciona
- [x] Discord delivery funciona
- [x] Telegram continua funcionando

**Melhoria 4 (File Triggers):**
- [x] File watch detecta mudanças
- [x] Debounce funciona
- [x] Glob patterns suportados
- [x] Jobs executam automaticamente

**Melhoria 5 (Skill Hooks):**
- [x] Skills podem registrar hooks
- [x] onBoot executa no startup
- [x] onDeactivate remove jobs
- [x] createdBy tracking funciona

---

## 🛡️ Rollback Strategy

Se algo quebrar durante implementação:

1. **Git revert** do último commit funcional
2. Reverter para branch `main`
3. Analisar causa raiz
4. Fix e retry

**Feature flags** para rollback sem deploy:
- `CRON_RECOVERY_ENABLED` (default: true)
- `CRON_RETRY_ENABLED` (default: true)
- `CRON_FILE_TRIGGERS_ENABLED` (default: true)
- `CRON_SKILL_HOOKS_ENABLED` (default: true)

---

## 📞 Dependencies & Blockers

### External Dependencies
- ✅ UazAPI configured (WhatsApp)
- ⚠️ SMTP server credentials (Email)
- ✅ Discord webhook URLs (Discord)

### Internal Dependencies
- ✅ AgentController disponível
- ✅ Telegram Bot configurado
- ✅ CronStorage singleton

### Blockers Conhecidos
- ❌ Nenhum identificado

---

## 🔄 Next Steps (Phase 2)

Após Phase 1 completa e estável:
- Webhook Triggers (8-12h)
- Condition Triggers (8-12h)
- Jitter (3-4h)
- Tags/Groups (3-4h)
- Dashboard UI (8-12h)

---

**Status:** 🟡 Aguardando aprovação para iniciar execução

**Aprovador:** @user

**Comando para aprovar:** Digite "DE ACORDO" ou "APROVADO"

---

**Documento criado em:** 20/04/2026 às 15:32  
**Arquitetura:** DOE v1.0.0  
**Versão:** 1.0.0
