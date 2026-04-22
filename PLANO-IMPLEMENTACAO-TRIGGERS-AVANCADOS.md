# 🚀 Plano de Implementação: Triggers Avançados GueClaw

**Baseado em:** [ANALISE-SISTEMAS-TRIGGERS-AUTOMACAO.md](./ANALISE-SISTEMAS-TRIGGERS-AUTOMACAO.md)  
**Data:** 20 de Abril de 2026  
**Status:** 📋 Planejamento

---

## 🎯 Objetivo

Implementar **5 melhorias prioritárias** no sistema de Cron do GueClaw, inspiradas nos pontos fortes do Hermes-Agent e DVACE Kairos.

**Total Estimado:** 28-42 horas  
**ROI Esperado:** Alto (expande casos de uso em 300%+)

---

## 📦 Phase 1: Foundation (Prioridade Alta)

### ✅ **Task 1: Missed Task Recovery** (4-6h)

**Objetivo:** Recuperar jobs perdidos durante downtime  
**Inspiração:** Hermes-Agent + DVACE  
**Arquivos Modificados:**
- `src/services/cron/cron-scheduler.ts`
- `src/services/cron/cron-types.ts`
- `src/services/cron/cron-storage.ts`

#### Checklist de Implementação

```typescript
// ✅ Step 1: Adicionar campos de recovery ao CronJobOutput
export interface CronJobOutput {
  // ... existente
  recovered?: boolean;
  originalScheduledTime?: string;
  recoveryWindowMs?: number;
}

// ✅ Step 2: Implementar método recoverMissedTasks()
export class CronScheduler {
  public async recoverMissedTasks(): Promise<void> {
    const jobs = this.storage.loadJobs();
    const now = new Date();
    const maxRecoveryWindowMs = 24 * 60 * 60 * 1000; // 24h
    const missed: CronJob[] = [];
    
    for (const job of jobs) {
      if (job.status !== 'active') continue;
      
      const nextRun = new Date(job.nextRun);
      const timeSinceScheduled = now.getTime() - nextRun.getTime();
      
      // Recupera jobs das últimas 24h
      if (timeSinceScheduled > 0 && timeSinceScheduled < maxRecoveryWindowMs) {
        missed.push(job);
      }
    }
    
    if (missed.length > 0) {
      console.log(`[CronScheduler] Recovering ${missed.length} missed tasks`);
      
      for (const job of missed) {
        await this.executeJob(job, {
          recovered: true,
          originalScheduledTime: job.nextRun,
          recoveryWindowMs: now.getTime() - new Date(job.nextRun).getTime()
        });
      }
    }
  }
}

// ✅ Step 3: Chamar no start()
public start(): void {
  if (this.isRunning) return;
  
  this.storage.ensureDirs();
  this.isRunning = true;
  
  // Recupera missed tasks
  this.recoverMissedTasks().catch(err => {
    console.error('[CronScheduler] Recovery failed:', err);
  });
  
  this.tick();
  this.tickInterval = setInterval(() => this.tick(), 60000);
}

// ✅ Step 4: Modificar executeJob() para aceitar metadata
private async executeJob(
  job: CronJob,
  metadata?: { recovered?: boolean; originalScheduledTime?: string; recoveryWindowMs?: number }
): Promise<void> {
  // ... código existente
  
  const output: CronJobOutput = {
    jobId: job.id,
    jobName: job.name,
    success: true,
    output: cleanedOutput,
    duration,
    timestamp: new Date().toISOString(),
    toolsUsed: result.toolCalls?.map((tc: any) => tc.toolName),
    tokens: result.tokensUsed,
    ...metadata  // ← Adiciona metadata de recovery
  };
  
  // ... resto do código
}

// ✅ Step 5: Atualizar deliverOutput() para indicar recovery
private async deliverOutput(job: CronJob, output: CronJobOutput): Promise<void> {
  if (job.deliver === 'telegram') {
    let message = output.success
      ? `🤖 **Cron Job: ${job.name}**\n\n${output.output}`
      : `❌ **Cron Job Failed: ${job.name}**\n\n${output.error}`;
    
    // ← NOVO: Adiciona badge de recovery
    if (output.recovered) {
      const recoveryHours = Math.round((output.recoveryWindowMs || 0) / (60 * 60 * 1000));
      message = `🔄 **RECOVERED** (${recoveryHours}h late)\n\n` + message;
      message += `\n\n⏰ _Originally scheduled: ${new Date(output.originalScheduledTime!).toLocaleString()}_`;
    }
    
    // ... envia mensagem
  }
}
```

#### Testes

```typescript
// tests/cron/missed-recovery.test.ts

describe('CronScheduler - Missed Task Recovery', () => {
  it('should recover jobs missed in last 24h', async () => {
    const scheduler = CronScheduler.getInstance();
    const storage = CronStorage.getInstance();
    
    // Cria job com nextRun no passado (2h atrás)
    const job = await storage.createJob({
      name: 'Test Recovery',
      prompt: 'Hello world',
      schedule: { kind: 'cron', expr: '0 10 * * *' },
      nextRun: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      userId: '123'
    });
    
    // Inicia scheduler (deve recuperar)
    await scheduler.recoverMissedTasks();
    
    // Verifica output
    const outputs = storage.getJobOutputs(job.id);
    expect(outputs).toHaveLength(1);
    expect(outputs[0].recovered).toBe(true);
    expect(outputs[0].recoveryWindowMs).toBeGreaterThan(2 * 60 * 60 * 1000 - 1000);
  });
  
  it('should NOT recover jobs older than 24h', async () => {
    const storage = CronStorage.getInstance();
    
    // Cria job com nextRun 48h atrás
    await storage.createJob({
      name: 'Old Job',
      prompt: 'Test',
      schedule: { kind: 'once', runAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() },
      nextRun: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      userId: '123'
    });
    
    const scheduler = CronScheduler.getInstance();
    await scheduler.recoverMissedTasks();
    
    // Não deve ter executado
    const allOutputs = storage.getAllOutputs();
    expect(allOutputs).toHaveLength(0);
  });
});
```

---

### ✅ **Task 2: Retry Logic & Timeout Protection** (4-6h)

**Objetivo:** Adicionar resiliência com retries e timeout  
**Inspiração:** Best practices de production systems  
**Arquivos Modificados:**
- `src/services/cron/cron-types.ts`
- `src/services/cron/cron-scheduler.ts`

#### Checklist de Implementação

```typescript
// ✅ Step 1: Adicionar campos ao CronJob
export interface CronJob {
  // ... existente
  maxRetries?: number;        // Default: 0
  retryBackoffMs?: number;    // Default: 60000 (1min)
  timeoutSeconds?: number;    // Default: 300 (5min)
  retryCount?: number;        // Contador interno
}

// ✅ Step 2: Wrapper de timeout
private async executeWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  jobName: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(
        () => reject(new Error(`Job "${jobName}" timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    )
  ]);
}

// ✅ Step 3: Lógica de retry
private async executeJobWithRetry(job: CronJob): Promise<void> {
  const startTime = Date.now();
  const timeout = (job.timeoutSeconds || 300) * 1000;
  
  try {
    // Executa com timeout
    const result = await this.executeWithTimeout(
      this.agentController!.processDirectMessage(job.prompt, job.userId),
      timeout,
      job.name
    );
    
    // Sucesso — reseta retry counter
    if (job.retryCount && job.retryCount > 0) {
      await this.storage.updateJob(job.id, { retryCount: 0 });
    }
    
    // ... salva output normal
    
  } catch (error: any) {
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
      
      // Salva output de retry scheduled
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: false,
        output: '',
        error: `Retry ${currentRetries + 1}/${maxRetries} scheduled: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        retryScheduled: true,
        nextRetryAt: nextRetryTime.toISOString()
      };
      
      this.storage.saveOutput(output);
      
    } else {
      // Max retries atingido — falha permanente
      console.error(`[CronScheduler] Job "${job.name}" failed permanently after ${maxRetries} retries`);
      
      const output: CronJobOutput = {
        jobId: job.id,
        jobName: job.name,
        success: false,
        output: '',
        error: `Failed after ${maxRetries} retries: ${error.message}`,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        permanentFailure: true
      };
      
      this.storage.saveOutput(output);
      
      // Notifica falha permanente
      if (job.deliver === 'telegram' && job.userId) {
        await this.telegramBot!.api.sendMessage(
          job.userId,
          `❌ **Permanent Failure**\n\n` +
          `**Job:** ${job.name}\n` +
          `**Retries:** ${maxRetries}\n` +
          `**Error:** ${error.message}\n\n` +
          `_The job will continue to run on its next scheduled time._`,
          { parse_mode: 'Markdown' }
        );
      }
      
      // Reseta retry counter para próxima execução
      await this.storage.updateJob(job.id, { retryCount: 0 });
      
      // Atualiza nextRun para próxima execução scheduled
      await this.updateJobAfterExecution(job, false);
    }
  }
}

// ✅ Step 4: Modificar tick() para usar executeJobWithRetry()
private async tick(): Promise<void> {
  // ... código existente
  
  for (const job of jobs) {
    if (job.status !== 'active') continue;
    
    if (job.nextRun && new Date(job.nextRun) <= now) {
      console.log(`[CronScheduler] Job "${job.name}" is due - executing`);
      await this.executeJobWithRetry(job);  // ← Usa novo método
    }
  }
}
```

#### Testes

```typescript
// tests/cron/retry-timeout.test.ts

describe('CronScheduler - Retry & Timeout', () => {
  it('should timeout long-running jobs', async () => {
    const scheduler = CronScheduler.getInstance();
    const storage = CronStorage.getInstance();
    
    // Mock agentController que demora 10s
    scheduler.agentController = {
      processDirectMessage: jest.fn().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ response: 'done' }), 10000))
      )
    } as any;
    
    const job = await storage.createJob({
      name: 'Slow Job',
      prompt: 'Do something slow',
      schedule: { kind: 'once', runAt: new Date().toISOString() },
      timeoutSeconds: 2,  // ← 2s timeout
      status: 'active',
      userId: '123'
    });
    
    await scheduler.executeJobWithRetry(job);
    
    const outputs = storage.getJobOutputs(job.id);
    expect(outputs[0].success).toBe(false);
    expect(outputs[0].error).toContain('timeout');
  });
  
  it('should retry failed jobs', async () => {
    const scheduler = CronScheduler.getInstance();
    const storage = CronStorage.getInstance();
    
    // Mock que falha
    scheduler.agentController = {
      processDirectMessage: jest.fn().mockRejectedValue(new Error('Network error'))
    } as any;
    
    const job = await storage.createJob({
      name: 'Flaky Job',
      prompt: 'Do something',
      schedule: { kind: 'interval', minutes: 60 },
      maxRetries: 3,
      retryBackoffMs: 5000,  // 5s entre retries
      status: 'active',
      userId: '123',
      nextRun: new Date().toISOString()
    });
    
    // Primeira execução (falha)
    await scheduler.executeJobWithRetry(job);
    
    const updatedJob = storage.getJob(job.id)!;
    expect(updatedJob.retryCount).toBe(1);
    expect(new Date(updatedJob.nextRun).getTime()).toBeGreaterThan(Date.now() + 4000);
    
    const outputs = storage.getJobOutputs(job.id);
    expect(outputs[0].retryScheduled).toBe(true);
  });
  
  it('should notify on permanent failure', async () => {
    const scheduler = CronScheduler.getInstance();
    const storage = CronStorage.getInstance();
    const mockSendMessage = jest.fn();
    
    scheduler.telegramBot = { api: { sendMessage: mockSendMessage } } as any;
    scheduler.agentController = {
      processDirectMessage: jest.fn().mockRejectedValue(new Error('Always fails'))
    } as any;
    
    const job = await storage.createJob({
      name: 'Always Fails',
      prompt: 'Test',
      schedule: { kind: 'interval', minutes: 60 },
      maxRetries: 2,
      deliver: 'telegram',
      status: 'active',
      userId: '123',
      nextRun: new Date().toISOString()
    });
    
    // 1ª tentativa (retry 1)
    await scheduler.executeJobWithRetry(job);
    expect(storage.getJob(job.id)!.retryCount).toBe(1);
    
    // 2ª tentativa (retry 2)
    await scheduler.tick();
    expect(storage.getJob(job.id)!.retryCount).toBe(2);
    
    // 3ª tentativa (falha permanente)
    await scheduler.tick();
    expect(storage.getJob(job.id)!.retryCount).toBe(0);  // Resetado
    
    // Verifica notificação
    expect(mockSendMessage).toHaveBeenCalledWith(
      '123',
      expect.stringContaining('Permanent Failure'),
      expect.any(Object)
    );
    
    const outputs = storage.getJobOutputs(job.id);
    const lastOutput = outputs[outputs.length - 1];
    expect(lastOutput.permanentFailure).toBe(true);
  });
});
```

---

### ✅ **Task 3: Multi-Platform Delivery** (8-12h)

**Objetivo:** Expandir delivery para WhatsApp, Email, Webhook, Discord  
**Inspiração:** Hermes-Agent  
**Arquivos Criados/Modificados:**
- `src/services/cron/delivery/` (nova pasta)
  - `delivery-router.ts`
  - `whatsapp-delivery.ts`
  - `email-delivery.ts`
  - `webhook-delivery.ts`
  - `discord-delivery.ts`
- `src/services/cron/cron-types.ts`
- `src/services/cron/cron-scheduler.ts`

#### Estrutura de Arquivos

```
src/services/cron/delivery/
├── delivery-router.ts       # Roteador central
├── base-delivery.ts         # Interface base
├── telegram-delivery.ts     # Existente (migrado)
├── whatsapp-delivery.ts     # NOVO
├── email-delivery.ts        # NOVO
├── webhook-delivery.ts      # NOVO
└── discord-delivery.ts      # NOVO
```

#### Checklist de Implementação

```typescript
// ✅ Step 1: Base interface
// src/services/cron/delivery/base-delivery.ts

export interface DeliveryResult {
  success: boolean;
  error?: string;
  deliveredAt?: Date;
  metadata?: Record<string, any>;
}

export interface DeliveryChannel {
  name: string;
  
  /**
   * Envia output de um job
   */
  deliver(
    job: CronJob,
    output: CronJobOutput,
    config: DeliveryConfig
  ): Promise<DeliveryResult>;
  
  /**
   * Valida configuração do canal
   */
  validate(config: DeliveryConfig): Promise<boolean>;
}

export interface DeliveryConfig {
  target: string;  // Chat ID, email, webhook URL, etc
  metadata?: Record<string, any>;
}

// ✅ Step 2: Telegram delivery (migrar existente)
// src/services/cron/delivery/telegram-delivery.ts

import type { Bot } from 'grammy';

export class TelegramDelivery implements DeliveryChannel {
  name = 'telegram';
  
  constructor(private bot: Bot) {}
  
  async deliver(
    job: CronJob,
    output: CronJobOutput,
    config: DeliveryConfig
  ): Promise<DeliveryResult> {
    try {
      const chatId = config.target || job.userId;
      
      if (!chatId) {
        return {
          success: false,
          error: 'No Telegram chat ID specified'
        };
      }
      
      const message = output.success
        ? `🤖 **Cron Job: ${job.name}**\n\n${output.output}\n\n_Executed in ${output.duration}ms_`
        : `❌ **Cron Job Failed: ${job.name}**\n\n${output.error}\n\n_Execution time: ${output.duration}ms_`;
      
      await this.bot.api.sendMessage(chatId, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
      
      return { success: true, deliveredAt: new Date() };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async validate(config: DeliveryConfig): Promise<boolean> {
    try {
      await this.bot.api.getChat(config.target);
      return true;
    } catch {
      return false;
    }
  }
}

// ✅ Step 3: WhatsApp delivery
// src/services/cron/delivery/whatsapp-delivery.ts

import axios from 'axios';

export class WhatsAppDelivery implements DeliveryChannel {
  name = 'whatsapp';
  
  private baseUrl: string;
  private token: string;
  
  constructor() {
    this.baseUrl = process.env.UAIZAPI_BASE_URL || '';
    this.token = process.env.UAIZAPI_TOKEN || '';
  }
  
  async deliver(
    job: CronJob,
    output: CronJobOutput,
    config: DeliveryConfig
  ): Promise<DeliveryResult> {
    try {
      const jid = config.target;  // WhatsApp JID (phone@c.us ou groupId@g.us)
      
      const message = output.success
        ? `🤖 *Cron Job: ${job.name}*\n\n${output.output}\n\n_Executed in ${output.duration}ms_`
        : `❌ *Cron Job Failed: ${job.name}*\n\n${output.error}`;
      
      const response = await axios.post(
        `${this.baseUrl}/message/text`,
        {
          chatId: jid,
          text: message
        },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      if (response.data.success) {
        return {
          success: true,
          deliveredAt: new Date(),
          metadata: { messageId: response.data.id }
        };
      } else {
        return {
          success: false,
          error: response.data.error || 'WhatsApp delivery failed'
        };
      }
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async validate(config: DeliveryConfig): Promise<boolean> {
    try {
      // Verifica se o chat existe via UazAPI
      const response = await axios.post(
        `${this.baseUrl}/chat/check`,
        { chatId: config.target },
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data.exists === true;
    } catch {
      return false;
    }
  }
}

// ✅ Step 4: Email delivery
// src/services/cron/delivery/email-delivery.ts

import nodemailer from 'nodemailer';

export class EmailDelivery implements DeliveryChannel {
  name = 'email';
  
  private transporter: nodemailer.Transporter;
  
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
  
  async deliver(
    job: CronJob,
    output: CronJobOutput,
    config: DeliveryConfig
  ): Promise<DeliveryResult> {
    try {
      const email = config.target;
      const subject = config.metadata?.subject || `Cron Job: ${job.name}`;
      const cc = config.metadata?.cc as string[] | undefined;
      
      const html = `
        <h2>${output.success ? '✅' : '❌'} Cron Job: ${job.name}</h2>
        
        <p><strong>Status:</strong> ${output.success ? 'Success' : 'Failed'}</p>
        <p><strong>Executed at:</strong> ${new Date(output.timestamp).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${output.duration}ms</p>
        
        ${output.success ? `
          <h3>Output:</h3>
          <pre>${output.output}</pre>
          
          ${output.toolsUsed ? `
            <p><strong>Tools used:</strong> ${output.toolsUsed.join(', ')}</p>
          ` : ''}
          
          ${output.tokens ? `
            <p><strong>Tokens:</strong> ${output.tokens}</p>
          ` : ''}
        ` : `
          <h3>Error:</h3>
          <pre>${output.error}</pre>
        `}
        
        <hr>
        <p><small>GueClaw Agent - Cron Scheduler</small></p>
      `;
      
      const info = await this.transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        cc: cc,
        subject: subject,
        html: html
      });
      
      return {
        success: true,
        deliveredAt: new Date(),
        metadata: { messageId: info.messageId }
      };
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async validate(config: DeliveryConfig): Promise<boolean> {
    // Validação simples de formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(config.target);
  }
}

// ✅ Step 5: Webhook delivery
// src/services/cron/delivery/webhook-delivery.ts

import axios from 'axios';

export class WebhookDelivery implements DeliveryChannel {
  name = 'webhook';
  
  async deliver(
    job: CronJob,
    output: CronJobOutput,
    config: DeliveryConfig
  ): Promise<DeliveryResult> {
    try {
      const url = config.target;
      const method = config.metadata?.method || 'POST';
      const headers = config.metadata?.headers || {};
      
      const payload = {
        event: 'cron_job_completed',
        job: {
          id: job.id,
          name: job.name,
          prompt: job.prompt
        },
        output: {
          success: output.success,
          output: output.output,
          error: output.error,
          duration: output.duration,
          timestamp: output.timestamp,
          toolsUsed: output.toolsUsed,
          tokens: output.tokens
        },
        metadata: {
          recovered: output.recovered,
          permanentFailure: output.permanentFailure
        }
      };
      
      const response = await axios({
        method: method as any,
        url: url,
        data: payload,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'GueClaw-Cron/2.0',
          ...headers
        },
        timeout: 10000  // 10s timeout
      });
      
      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          deliveredAt: new Date(),
          metadata: { statusCode: response.status, responseData: response.data }
        };
      } else {
        return {
          success: false,
          error: `Webhook returned status ${response.status}`
        };
      }
      
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  async validate(config: DeliveryConfig): Promise<boolean> {
    try {
      const url = new URL(config.target);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
}

// ✅ Step 6: Delivery Router
// src/services/cron/delivery/delivery-router.ts

export class DeliveryRouter {
  private channels = new Map<string, DeliveryChannel>();
  
  public registerChannel(channel: DeliveryChannel): void {
    this.channels.set(channel.name, channel);
    console.log(`[DeliveryRouter] Registered channel: ${channel.name}`);
  }
  
  public async deliver(
    job: CronJob,
    output: CronJobOutput
  ): Promise<DeliveryResult> {
    const channelName = job.deliver as string;
    
    if (channelName === 'local' || channelName === 'none') {
      return { success: true, deliveredAt: new Date() };
    }
    
    const channel = this.channels.get(channelName);
    
    if (!channel) {
      return {
        success: false,
        error: `Delivery channel "${channelName}" not registered`
      };
    }
    
    const config: DeliveryConfig = {
      target: job.deliverTo || job.userId || '',
      metadata: job.deliveryMetadata
    };
    
    console.log(`[DeliveryRouter] Delivering job "${job.name}" via ${channelName}`);
    
    const result = await channel.deliver(job, output, config);
    
    if (!result.success) {
      console.error(
        `[DeliveryRouter] Delivery failed for job "${job.name}" via ${channelName}: ${result.error}`
      );
    }
    
    return result;
  }
}

// ✅ Step 7: Integrar no CronScheduler
// src/services/cron/cron-scheduler.ts

import { DeliveryRouter } from './delivery/delivery-router';
import { TelegramDelivery } from './delivery/telegram-delivery';
import { WhatsAppDelivery } from './delivery/whatsapp-delivery';
import { EmailDelivery } from './delivery/email-delivery';
import { WebhookDelivery } from './delivery/webhook-delivery';

export class CronScheduler {
  private deliveryRouter: DeliveryRouter;
  
  private constructor() {
    this.storage = CronStorage.getInstance();
    this.deliveryRouter = new DeliveryRouter();
  }
  
  public initialize(agentController: AgentController, telegramBot: Bot): void {
    this.agentController = agentController;
    this.telegramBot = telegramBot;
    
    // Registra canais de delivery
    this.deliveryRouter.registerChannel(new TelegramDelivery(telegramBot));
    this.deliveryRouter.registerChannel(new WhatsAppDelivery());
    this.deliveryRouter.registerChannel(new EmailDelivery());
    this.deliveryRouter.registerChannel(new WebhookDelivery());
    
    console.log('[CronScheduler] Initialized with dependencies + delivery channels');
  }
  
  private async deliverOutput(job: CronJob, output: CronJobOutput): Promise<void> {
    const result = await this.deliveryRouter.deliver(job, output);
    
    if (!result.success) {
      console.error(`[CronScheduler] Delivery failed: ${result.error}`);
    }
  }
}
```

#### Configuração .env

```bash
# ===== Multi-Platform Delivery =====

# WhatsApp (via UazAPI) — já configurado
UAIZAPI_TOKEN=35202253-f44f-41d9-b0d8-4db9cf3e51e4
UAIZAPI_BASE_URL=https://kyrius.uazapi.com

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=gueclaw@example.com
SMTP_PASSWORD=your_app_password
SMTP_FROM="GueClaw Agent <gueclaw@example.com>"

# Discord (opcional — via webhook)
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Webhook default headers (opcional)
WEBHOOK_DEFAULT_AUTH=Bearer token_abc123
```

---

### ✅ **Task 4: Event Triggers - File Watch** (8-12h)

**Objetivo:** Permitir triggers baseados em modificação de arquivos  
**Inspiração:** DVACE Kairos + DevOps best practices  
**Arquivos Criados/Modificados:**
- `src/services/cron/triggers/` (nova pasta)
  - `file-trigger.ts`
  - `trigger-manager.ts`
- `src/services/cron/cron-types.ts`
- `src/services/cron/cron-scheduler.ts`

#### Checklist de Implementação

```typescript
// ✅ Step 1: Definir tipos de trigger
// src/services/cron/cron-types.ts

export type TriggerType = 'time' | 'file';  // Webhook + Condition em fase 2

export interface CronTrigger {
  type: TriggerType;
  
  // Time-based (existente)
  schedule?: CronSchedule;
  
  // File-based (NOVO)
  fileWatch?: {
    path: string | string[];  // Caminho ou glob pattern
    event: 'created' | 'modified' | 'deleted' | 'all';
    debounceMs?: number;  // Default: 5000ms
    ignoreInitial?: boolean;  // Default: true
  };
}

export interface CronJob {
  // ... campos existentes
  trigger: CronTrigger;  // ← MUDANÇA: schedule vira trigger
}

// ✅ Step 2: File Trigger Manager
// src/services/cron/triggers/file-trigger.ts

import chokidar from 'chokidar';

export interface FileWatchConfig {
  jobId: string;
  path: string | string[];
  event: 'created' | 'modified' | 'deleted' | 'all';
  debounceMs: number;
  ignoreInitial: boolean;
}

export class FileTriggerManager {
  private watchers = new Map<string, chokidar.FSWatcher>();
  private debounceTimers = new Map<string, NodeJS.Timeout>();
  
  /**
   * Registra file watcher para um job
   */
  public registerFileWatch(
    config: FileWatchConfig,
    onTrigger: (eventType: string, filePath: string) => void
  ): void {
    console.log(`[FileTrigger] Registering watch for job ${config.jobId}: ${config.path}`);
    
    const watcher = chokidar.watch(config.path, {
      ignoreInitial: config.ignoreInitial,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });
    
    // Handler com debounce
    const handleEvent = (eventType: string, filePath: string) => {
      const debounceKey = `${config.jobId}-${eventType}-${filePath}`;
      
      // Limpa timer anterior
      const existingTimer = this.debounceTimers.get(debounceKey);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }
      
      // Agenda nova execução com debounce
      const timer = setTimeout(() => {
        console.log(
          `[FileTrigger] Job ${config.jobId} triggered by ${eventType} on ${filePath}`
        );
        onTrigger(eventType, filePath);
        this.debounceTimers.delete(debounceKey);
      }, config.debounceMs);
      
      this.debounceTimers.set(debounceKey, timer);
    };
    
    // Registra eventos
    if (config.event === 'all' || config.event === 'created') {
      watcher.on('add', (path) => handleEvent('created', path));
    }
    
    if (config.event === 'all' || config.event === 'modified') {
      watcher.on('change', (path) => handleEvent('modified', path));
    }
    
    if (config.event === 'all' || config.event === 'deleted') {
      watcher.on('unlink', (path) => handleEvent('deleted', path));
    }
    
    // Error handling
    watcher.on('error', (error) => {
      console.error(`[FileTrigger] Watcher error for job ${config.jobId}:`, error);
    });
    
    this.watchers.set(config.jobId, watcher);
  }
  
  /**
   * Remove file watcher de um job
   */
  public unregisterFileWatch(jobId: string): void {
    const watcher = this.watchers.get(jobId);
    
    if (watcher) {
      console.log(`[FileTrigger] Unregistering watch for job ${jobId}`);
      watcher.close();
      this.watchers.delete(jobId);
    }
    
    // Limpa debounce timers
    for (const [key, timer] of this.debounceTimers.entries()) {
      if (key.startsWith(`${jobId}-`)) {
        clearTimeout(timer);
        this.debounceTimers.delete(key);
      }
    }
  }
  
  /**
   * Limpa todos os watchers
   */
  public cleanup(): void {
    console.log('[FileTrigger] Cleaning up all watchers');
    
    for (const [jobId, watcher] of this.watchers.entries()) {
      watcher.close();
    }
    
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    
    this.watchers.clear();
    this.debounceTimers.clear();
  }
}

// ✅ Step 3: Integrar no CronScheduler
// src/services/cron/cron-scheduler.ts

import { FileTriggerManager } from './triggers/file-trigger';

export class CronScheduler {
  private fileTriggerManager: FileTriggerManager;
  
  private constructor() {
    this.storage = CronStorage.getInstance();
    this.deliveryRouter = new DeliveryRouter();
    this.fileTriggerManager = new FileTriggerManager();
  }
  
  public start(): void {
    if (this.isRunning) return;
    
    this.storage.ensureDirs();
    this.isRunning = true;
    
    // Recupera missed tasks
    this.recoverMissedTasks().catch(err => {
      console.error('[CronScheduler] Recovery failed:', err);
    });
    
    // Registra file watchers
    this.registerFileWatchers();
    
    // Inicia tick loop (apenas para time-based jobs)
    this.tick();
    this.tickInterval = setInterval(() => this.tick(), 60000);
    
    console.log('[CronScheduler] Started (time + file triggers)');
  }
  
  public stop(): void {
    if (!this.isRunning) return;
    
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
    
    // Limpa file watchers
    this.fileTriggerManager.cleanup();
    
    this.isRunning = false;
    console.log('[CronScheduler] Stopped');
  }
  
  /**
   * Registra file watchers para jobs com trigger type 'file'
   */
  private registerFileWatchers(): void {
    const jobs = this.storage.loadJobs();
    
    for (const job of jobs) {
      if (job.status !== 'active') continue;
      
      if (job.trigger?.type === 'file' && job.trigger.fileWatch) {
        const config: FileWatchConfig = {
          jobId: job.id,
          path: job.trigger.fileWatch.path,
          event: job.trigger.fileWatch.event,
          debounceMs: job.trigger.fileWatch.debounceMs || 5000,
          ignoreInitial: job.trigger.fileWatch.ignoreInitial !== false
        };
        
        this.fileTriggerManager.registerFileWatch(
          config,
          (eventType, filePath) => {
            this.handleFileTrigger(job, eventType, filePath);
          }
        );
      }
    }
  }
  
  /**
   * Executa job quando file trigger dispara
   */
  private async handleFileTrigger(
    job: CronJob,
    eventType: string,
    filePath: string
  ): Promise<void> {
    console.log(
      `[CronScheduler] File trigger: job="${job.name}" event="${eventType}" file="${filePath}"`
    );
    
    // Adiciona contexto do file trigger ao prompt
    const contextualizedPrompt = 
      `[FILE TRIGGER: ${eventType} - ${filePath}]\n\n${job.prompt}`;
    
    // Executa job (reutiliza lógica existente)
    const modifiedJob = { ...job, prompt: contextualizedPrompt };
    await this.executeJobWithRetry(modifiedJob);
  }
  
  /**
   * Atualiza file watchers quando jobs são criados/atualizados/deletados
   */
  public onJobCreated(job: CronJob): void {
    if (job.trigger?.type === 'file' && job.trigger.fileWatch && job.status === 'active') {
      const config: FileWatchConfig = {
        jobId: job.id,
        path: job.trigger.fileWatch.path,
        event: job.trigger.fileWatch.event,
        debounceMs: job.trigger.fileWatch.debounceMs || 5000,
        ignoreInitial: job.trigger.fileWatch.ignoreInitial !== false
      };
      
      this.fileTriggerManager.registerFileWatch(
        config,
        (eventType, filePath) => {
          this.handleFileTrigger(job, eventType, filePath);
        }
      );
    }
  }
  
  public onJobUpdated(job: CronJob): void {
    // Remove watcher anterior
    this.fileTriggerManager.unregisterFileWatch(job.id);
    
    // Registra novamente se ainda for file trigger + active
    this.onJobCreated(job);
  }
  
  public onJobDeleted(jobId: string): void {
    this.fileTriggerManager.unregisterFileWatch(jobId);
  }
}

// ✅ Step 4: Atualizar CronStorage para notificar scheduler
// src/services/cron/cron-storage.ts

export class CronStorage {
  private scheduler?: CronScheduler;  // ← NOVO
  
  public setScheduler(scheduler: CronScheduler): void {
    this.scheduler = scheduler;
  }
  
  public async createJob(data: Partial<CronJob>): Promise<CronJob> {
    // ... código existente
    
    // Notifica scheduler
    this.scheduler?.onJobCreated(job);
    
    return job;
  }
  
  public async updateJob(jobId: string, updates: Partial<CronJob>): Promise<void> {
    // ... código existente
    
    // Notifica scheduler
    const updatedJob = this.getJob(jobId);
    if (updatedJob) {
      this.scheduler?.onJobUpdated(updatedJob);
    }
  }
  
  public async deleteJob(jobId: string): Promise<void> {
    // ... código existente
    
    // Notifica scheduler
    this.scheduler?.onJobDeleted(jobId);
  }
}

// ✅ Step 5: Conectar storage e scheduler
// src/services/cron/cron-scheduler.ts

public initialize(agentController: AgentController, telegramBot: Bot): void {
  this.agentController = agentController;
  this.telegramBot = telegramBot;
  
  // Registra delivery channels
  this.deliveryRouter.registerChannel(new TelegramDelivery(telegramBot));
  this.deliveryRouter.registerChannel(new WhatsAppDelivery());
  this.deliveryRouter.registerChannel(new EmailDelivery());
  this.deliveryRouter.registerChannel(new WebhookDelivery());
  
  // ← NOVO: Conecta storage ao scheduler
  this.storage.setScheduler(this);
  
  console.log('[CronScheduler] Initialized with dependencies + delivery channels');
}
```

#### Exemplos de Uso

```typescript
// 1. Backup automático quando arquivo de config muda
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
  "prompt": "Execute backup completo das configurações",
  "deliver": "telegram"
}

// 2. Processar novos arquivos em pasta
{
  "action": "create",
  "name": "Process New Files",
  "trigger": {
    "type": "file",
    "fileWatch": {
      "path": "/opt/inbox/*.pdf",
      "event": "created"
    }
  },
  "prompt": "Leia o arquivo PDF recém-criado, extraia o texto e salve um resumo",
  "deliver": "local"
}

// 3. Alerta quando log de erro aparece
{
  "action": "create",
  "name": "Error Log Monitor",
  "trigger": {
    "type": "file",
    "fileWatch": {
      "path": "/var/log/gueclaw-agent/errors.log",
      "event": "modified",
      "debounceMs": 30000  // 30s debounce (evitar flood)
    }
  },
  "prompt": "Leia as últimas 50 linhas do log de erros e gere um relatório de problemas",
  "deliver": "telegram"
}
```

---

### ✅ **Task 5: Skill-Specific Hooks** (6-8h)

**Objetivo:** Skills podem auto-registrar automações no boot  
**Inspiração:** Plugin systems + lifecycle hooks  
**Arquivos Criados/Modificados:**
- `src/types/skill.ts`
- `src/core/skill-manager.ts` (se existir)
- `.agents/skills/*/hooks.ts` (novos arquivos de exemplo)

#### Checklist de Implementação

```typescript
// ✅ Step 1: Definir interfaces de hooks
// src/types/skill.ts

export interface SkillHookContext {
  skillName: string;
  cronScheduler: CronScheduler;
  cronStorage: CronStorage;
  config: Record<string, any>;  // Skill config do .env ou config.json
  logger: (message: string) => void;
}

export interface SkillHooks {
  /**
   * Executado quando a skill é ativada/instalada
   * Pode registrar cron jobs automaticamente
   */
  onActivate?: (context: SkillHookContext) => Promise<void>;
  
  /**
   * Executado quando a skill é desativada/desinstalada
   * Deve remover cron jobs criados
   */
  onDeactivate?: (context: SkillHookContext) => Promise<void>;
  
  /**
   * Executado no boot do agente (se skill está ativa)
   * Usado para auto-configuração
   */
  onBoot?: (context: SkillHookContext) => Promise<void>;
  
  /**
   * Executado antes do agente desligar
   * Cleanup de recursos
   */
  onShutdown?: (context: SkillHookContext) => Promise<void>;
}

export interface SkillDefinition {
  // ... campos existentes
  hooks?: SkillHooks;
}

// ✅ Step 2: Skill Hook Manager
// src/core/skill-hook-manager.ts

export class SkillHookManager {
  private static instance: SkillHookManager;
  private registeredSkills = new Map<string, SkillDefinition>();
  
  public static getInstance(): SkillHookManager {
    if (!SkillHookManager.instance) {
      SkillHookManager.instance = new SkillHookManager();
    }
    return SkillHookManager.instance;
  }
  
  /**
   * Registra skill e executa onBoot hook
   */
  public async registerSkill(
    skillName: string,
    definition: SkillDefinition,
    cronScheduler: CronScheduler
  ): Promise<void> {
    this.registeredSkills.set(skillName, definition);
    
    if (definition.hooks?.onBoot) {
      const context = this.createContext(skillName, definition, cronScheduler);
      
      try {
        await definition.hooks.onBoot(context);
        console.log(`[SkillHooks] onBoot executed for skill: ${skillName}`);
      } catch (error) {
        console.error(`[SkillHooks] onBoot failed for skill ${skillName}:`, error);
      }
    }
  }
  
  /**
   * Executa onActivate hook
   */
  public async activateSkill(
    skillName: string,
    cronScheduler: CronScheduler
  ): Promise<void> {
    const definition = this.registeredSkills.get(skillName);
    
    if (!definition || !definition.hooks?.onActivate) return;
    
    const context = this.createContext(skillName, definition, cronScheduler);
    
    try {
      await definition.hooks.onActivate(context);
      console.log(`[SkillHooks] onActivate executed for skill: ${skillName}`);
    } catch (error) {
      console.error(`[SkillHooks] onActivate failed for skill ${skillName}:`, error);
    }
  }
  
  /**
   * Executa onDeactivate hook
   */
  public async deactivateSkill(
    skillName: string,
    cronScheduler: CronScheduler
  ): Promise<void> {
    const definition = this.registeredSkills.get(skillName);
    
    if (!definition || !definition.hooks?.onDeactivate) return;
    
    const context = this.createContext(skillName, definition, cronScheduler);
    
    try {
      await definition.hooks.onDeactivate(context);
      console.log(`[SkillHooks] onDeactivate executed for skill: ${skillName}`);
    } catch (error) {
      console.error(`[SkillHooks] onDeactivate failed for skill ${skillName}:`, error);
    }
  }
  
  /**
   * Executa onShutdown em todas as skills ativas
   */
  public async shutdownAll(cronScheduler: CronScheduler): Promise<void> {
    console.log('[SkillHooks] Running shutdown hooks...');
    
    const promises: Promise<void>[] = [];
    
    for (const [skillName, definition] of this.registeredSkills.entries()) {
      if (definition.hooks?.onShutdown) {
        const context = this.createContext(skillName, definition, cronScheduler);
        promises.push(
          definition.hooks.onShutdown(context).catch(err => {
            console.error(`[SkillHooks] onShutdown failed for ${skillName}:`, err);
          })
        );
      }
    }
    
    await Promise.all(promises);
    console.log('[SkillHooks] Shutdown hooks completed');
  }
  
  private createContext(
    skillName: string,
    definition: SkillDefinition,
    cronScheduler: CronScheduler
  ): SkillHookContext {
    return {
      skillName,
      cronScheduler,
      cronStorage: CronStorage.getInstance(),
      config: this.loadSkillConfig(skillName),
      logger: (message: string) => {
        console.log(`[Skill:${skillName}] ${message}`);
      }
    };
  }
  
  private loadSkillConfig(skillName: string): Record<string, any> {
    // Load from .env or config file
    // Exemplo: SKILL_VPS_SECURITY_ENABLED=true → { enabled: true }
    const prefix = `SKILL_${skillName.toUpperCase().replace(/-/g, '_')}_`;
    const config: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix)) {
        const configKey = key.slice(prefix.length).toLowerCase();
        config[configKey] = value;
      }
    }
    
    return config;
  }
}

// ✅ Step 3: Exemplo de skill com hooks
// .agents/skills/vps-security-scanner/hooks.ts

import type { SkillHooks, SkillHookContext } from '../../../src/types/skill';

export const hooks: SkillHooks = {
  async onBoot(context: SkillHookContext) {
    context.logger('Checking for auto-registered security scan job...');
    
    const jobs = context.cronStorage.loadJobs();
    const hasSecurityJob = jobs.some(
      job => job.name === 'Weekly Security Scan' && job.createdBy === context.skillName
    );
    
    if (!hasSecurityJob) {
      context.logger('Auto-registering weekly security scan job');
      
      await context.cronStorage.createJob({
        name: 'Weekly Security Scan',
        prompt: 'Execute full security audit using vps-security-scanner skill',
        trigger: {
          type: 'time',
          schedule: { kind: 'cron', expr: '0 22 * * 0' }  // Domingo 22h
        },
        deliver: 'telegram',
        userId: process.env.TELEGRAM_ALLOWED_USER_IDS?.split(',')[0] || '',
        status: 'active',
        createdBy: context.skillName,
        tags: ['security', 'auto-registered'],
        permanent: true
      });
      
      context.logger('✅ Weekly security scan job created');
    } else {
      context.logger('Security scan job already exists');
    }
  },
  
  async onDeactivate(context: SkillHookContext) {
    context.logger('Removing auto-registered jobs...');
    
    const jobs = context.cronStorage.loadJobs();
    const skillJobs = jobs.filter(job => job.createdBy === context.skillName);
    
    for (const job of skillJobs) {
      context.logger(`Removing job: ${job.name}`);
      await context.cronStorage.deleteJob(job.id);
    }
    
    context.logger(`✅ Removed ${skillJobs.length} job(s)`);
  }
};

// ✅ Step 4: Exemplo de skill simples (google-calendar-daily)
// .agents/skills/google-calendar-daily/hooks.ts

import type { SkillHooks, SkillHookContext } from '../../../src/types/skill';

export const hooks: SkillHooks = {
  async onBoot(context: SkillHookContext) {
    const jobs = context.cronStorage.loadJobs();
    const hasJob = jobs.some(job => job.createdBy === context.skillName);
    
    if (!hasJob) {
      context.logger('Auto-registering daily calendar summary');
      
      await context.cronStorage.createJob({
        name: 'Daily Calendar Summary',
        prompt: 'List my Google Calendar events for today and summarize',
        trigger: {
          type: 'time',
          schedule: { kind: 'cron', expr: '0 7 * * *' }  // 7h AM
        },
        deliver: 'telegram',
        userId: process.env.TELEGRAM_USER_CHAT_ID || '',
        createdBy: context.skillName,
        tags: ['calendar', 'auto-registered'],
        permanent: true
      });
    }
  },
  
  async onDeactivate(context: SkillHookContext) {
    const jobs = context.cronStorage.loadJobs();
    const calendarJobs = jobs.filter(job => job.createdBy === context.skillName);
    
    for (const job of calendarJobs) {
      await context.cronStorage.deleteJob(job.id);
    }
    
    context.logger(`Removed ${calendarJobs.length} calendar job(s)`);
  }
};

// ✅ Step 5: Integrar no boot do GueClaw
// src/index.ts (ou main.ts)

import { SkillHookManager } from './core/skill-hook-manager';
import { CronScheduler } from './services/cron/cron-scheduler';

// ... boot sequence

async function bootstrap() {
  // Inicializa scheduler
  const cronScheduler = CronScheduler.getInstance();
  cronScheduler.initialize(agentController, telegramBot);
  cronScheduler.start();
  
  // Carrega e registra skills
  const skillHookManager = SkillHookManager.getInstance();
  
  const skills = loadAllSkills();  // Sua lógica de carregamento
  
  for (const [name, definition] of skills) {
    await skillHookManager.registerSkill(name, definition, cronScheduler);
  }
  
  console.log('✅ All skills registered with hooks');
  
  // Cleanup ao desligar
  process.on('SIGINT', async () => {
    console.log('\n[Shutdown] Running cleanup...');
    await skillHookManager.shutdownAll(cronScheduler);
    cronScheduler.stop();
    process.exit(0);
  });
}

bootstrap();
```

---

## 📋 Checklist Geral de Implementação

### Phase 1: Foundation

- [ ] **Task 1: Missed Task Recovery** (4-6h)
  - [ ] Adicionar campos `recovered`, `originalScheduledTime`, `recoveryWindowMs` ao `CronJobOutput`
  - [ ] Implementar método `recoverMissedTasks()` no `CronScheduler`
  - [ ] Chamar `recoverMissedTasks()` no `start()`
  - [ ] Modificar `deliverOutput()` para indicar recovery
  - [ ] Escrever testes unitários
  - [ ] Testar em produção com jobs reais

- [ ] **Task 2: Retry Logic & Timeout** (4-6h)
  - [ ] Adicionar campos `maxRetries`, `retryBackoffMs`, `timeoutSeconds`, `retryCount` ao `CronJob`
  - [ ] Implementar `executeWithTimeout()`
  - [ ] Implementar `executeJobWithRetry()` com lógica de backoff
  - [ ] Modificar `tick()` para usar `executeJobWithRetry()`
  - [ ] Notificação de permanent failure via Telegram
  - [ ] Escrever testes unitários (timeout, retry, permanent failure)
  - [ ] Testar com jobs flaky em produção

- [ ] **Task 3: Multi-Platform Delivery** (8-12h)
  - [ ] Criar estrutura `src/services/cron/delivery/`
  - [ ] Implementar `base-delivery.ts` (interface)
  - [ ] Migrar `TelegramDelivery` para novo formato
  - [ ] Implementar `WhatsAppDelivery` (via UazAPI)
  - [ ] Implementar `EmailDelivery` (via nodemailer)
  - [ ] Implementar `WebhookDelivery` (via axios)
  - [ ] Implementar `DeliveryRouter`
  - [ ] Integrar no `CronScheduler.initialize()`
  - [ ] Atualizar `.env` com configs de SMTP
  - [ ] Escrever testes para cada canal
  - [ ] Testar delivery WhatsApp em grupo real
  - [ ] Testar delivery Email
  - [ ] Testar delivery Webhook (usar n8n ou webhook.site)

- [ ] **Task 4: Event Triggers - File Watch** (8-12h)
  - [ ] Atualizar `CronTrigger` com suporte a `file`
  - [ ] Implementar `FileTriggerManager` com chokidar
  - [ ] Implementar `registerFileWatchers()` no `CronScheduler`
  - [ ] Implementar `handleFileTrigger()`
  - [ ] Implementar `onJobCreated`, `onJobUpdated`, `onJobDeleted` no scheduler
  - [ ] Conectar `CronStorage` ao scheduler (notificações)
  - [ ] Escrever testes (create file, modify file, delete file)
  - [ ] Testar com glob patterns (`*.json`, `**/*.log`)
  - [ ] Testar debounce (múltiplas modificações rápidas)
  - [ ] Testar em produção (monitorar pasta `/opt/inbox/`)

- [ ] **Task 5: Skill-Specific Hooks** (6-8h)
  - [ ] Definir `SkillHooks` e `SkillHookContext` em `src/types/skill.ts`
  - [ ] Implementar `SkillHookManager`
  - [ ] Integrar no boot do GueClaw
  - [ ] Criar `hooks.ts` para `vps-security-scanner`
  - [ ] Criar `hooks.ts` para `google-calendar-daily`
  - [ ] Testar `onBoot` (auto-register jobs)
  - [ ] Testar `onDeactivate` (remove jobs)
  - [ ] Testar `onShutdown` (cleanup)
  - [ ] Documentar padrão de hooks para novas skills

---

## 🧪 Plano de Testes

### Testes Unitários

```bash
npm run test:cron
```

**Arquivos:**
- `tests/cron/missed-recovery.test.ts`
- `tests/cron/retry-timeout.test.ts`
- `tests/cron/delivery-multi-platform.test.ts`
- `tests/cron/file-trigger.test.ts`
- `tests/cron/skill-hooks.test.ts`

### Testes de Integração

1. **Recovery:** Criar job → desligar agente → aguardar next executado até o passado → religar → verificar recovery
2. **Retry:** Criar job com API mock que falha 2x → verificar retries → verificar sucesso na 3ª tentativa
3. **Timeout:** Criar job com sleep 10min → timeout 1min → verificar erro de timeout
4. **WhatsApp Delivery:** Criar job com delivery WhatsApp → executar → verificar mensagem no grupo
5. **Email Delivery:** Criar job com delivery Email → verificar recebimento
6. **File Trigger:** Criar job → modificar arquivo monitorado → verificar execução
7. **Skill Hooks:** Ativar skill com hooks → verificar job auto-criado → desativar → verificar remoção

---

## 📊 Métricas de Sucesso

### KPIs

- ✅ **Recovery Rate:** % de missed tasks recuperados com sucesso (meta: >95%)
- ✅ **Retry Success Rate:** % de jobs que passam após retry (meta: >70%)
- ✅ **Delivery Success Rate:** % de deliveries bem-sucedidos por canal (meta: >98%)
- ✅ **File Trigger Latency:** Tempo entre modificação e execução (meta: <10s)
- ✅ **Skill Hook Coverage:** % de skills com hooks implementados (meta: >50% das skills core)

---

## 🚀 Rollout

### Semana 1-2: Implementação
- Tasks 1-5
- Testes unitários
- Code review

### Semana 3: Testes
- Testes de integração
- Beta testing com jobs não-críticos
- Ajustes de bugs

### Semana 4: Deploy Gradual
- Deploy em produção
- Monitoramento de métricas
- Feedback de usuários

---

## 📚 Documentação

### Atualizar

- [x] `ANALISE-SISTEMAS-TRIGGERS-AUTOMACAO.md` (este documento)
- [ ] `docs/cron-scheduler.md` (adicionar seções de recovery, retry, multi-platform, file triggers, skill hooks)
- [ ] `README.md` (mencionar novas features)
- [ ] `.agents/skills/*/SKILL.md` (adicionar exemplos de hooks)
- [ ] `CHANGELOG.md` (versão 2.1.0 - Triggers Avançados)

---

## 🎯 Conclusão

Este plano de implementação cobre **5 melhorias prioritárias** identificadas na análise comparativa dos sistemas de triggers/automação.

**Próximos Passos:**

1. ✅ Aprovar plano
2. ✅ Criar branch `feature/advanced-triggers`
3. ✅ Implementar Task 1 (Missed Recovery)
4. ✅ PR + Review
5. ✅ Merge → Implementar Task 2 → ...
6. ✅ Deploy em produção
7. ✅ Monitorar métricas
8. ✅ Iterar com feedback

**Estimativa Total:** 28-42 horas  
**ROI Esperado:** Alto (300%+ em casos de uso)

---

**Documento gerado em:** 20/04/2026  
**Autor:** GueClaw Analysis Engine  
**Versão:** 1.0.0
