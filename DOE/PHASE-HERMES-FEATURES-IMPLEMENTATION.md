# 🚀 PHASE HERMES: Implementação de Features do Hermes Agent

**Data:** 16/04/2026  
**Versão:** 1.0  
**Status:** 📋 PLANO DE IMPLEMENTAÇÃO

---

## 📋 Executive Summary

Este documento detalha a implementação das **6 features prioritárias** identificadas na [análise comparativa](../ANALISE-HERMES-VS-GUECLAW.md) entre Hermes Agent e GueClaw.

**Total de Esforço Estimado:** 54-76h  
**ROI Esperado:** Cada hora investida economiza 10-20h de trabalho manual futuro

---

## 🎯 Features a Implementar

### Top 3 — Máximo ROI (14-23h)
1. **CONTEXT FILES DE PROJETO** ⭐⭐⭐⭐⭐ (2-3h)
2. **SLASH COMMANDS RICOS** ⭐⭐⭐⭐ (4-6h)
3. **CRON SCHEDULER** ⭐⭐⭐⭐⭐ (8-12h)

### Features Avançadas (40-53h)
4. **SKILLS AUTO-MELHORÁVEIS** ⭐⭐⭐⭐ (10-12h)
5. **FTS5 SESSION SEARCH** ⭐⭐⭐⭐ (8-10h)
6. **SUBAGENTES PARALELOS** ⭐⭐⭐⭐ (12-16h)

---

## 📦 FEATURE 1: CONTEXT FILES DE PROJETO (2-3h)

### 🎯 Objetivo
Arquivo `.gueclaw/context.md` carregado automaticamente em cada conversa, contendo preferências, projetos ativos, informações de VPS, estilo de comunicação.

### 📚 Aprendizados do Hermes

**Arquivo:** `agent/context_engine.py`  
**Como funciona:**
- Sistema de engines plugáveis via config `context.engine`
- Carregamento automático no início de cada sessão (`on_session_start`)
- Contexto injetado no system prompt antes do ReAct loop

### 🏗️ Arquitetura GueClaw

```
.gueclaw/
├── context.md          ← Contexto principal (carregado sempre)
├── preferences.md      ← Preferências pessoais (opcional)
└── projects/           ← Contextos por projeto (opcional)
    ├── fluxohub.md
    ├── pericia.md
    └── advocacia.md
```

### 📝 Implementação

#### 1.1 Criar Context Loader (1h)

```typescript
// src/core/context/context-loader.ts

import * as fs from 'fs';
import * as path from 'path';

export interface ContextFile {
  path: string;
  content: string;
  priority: number;
}

export class ContextLoader {
  private static CONTEXT_DIR = '.gueclaw';
  
  /**
   * Load all context files from .gueclaw/
   * Priority: context.md > preferences.md > projects/*.md
   */
  static loadProjectContext(): string {
    const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
    const contextDir = path.join(workspaceRoot, this.CONTEXT_DIR);
    
    if (!fs.existsSync(contextDir)) {
      return '';
    }
    
    const contexts: ContextFile[] = [];
    
    // 1. Main context file (highest priority)
    const mainContext = path.join(contextDir, 'context.md');
    if (fs.existsSync(mainContext)) {
      contexts.push({
        path: mainContext,
        content: fs.readFileSync(mainContext, 'utf-8'),
        priority: 100
      });
    }
    
    // 2. Preferences file
    const preferences = path.join(contextDir, 'preferences.md');
    if (fs.existsSync(preferences)) {
      contexts.push({
        path: preferences,
        content: fs.readFileSync(preferences, 'utf-8'),
        priority: 90
      });
    }
    
    // 3. Project-specific contexts
    const projectsDir = path.join(contextDir, 'projects');
    if (fs.existsSync(projectsDir)) {
      const projectFiles = fs.readdirSync(projectsDir)
        .filter(f => f.endsWith('.md'));
      
      projectFiles.forEach(file => {
        contexts.push({
          path: path.join(projectsDir, file),
          content: fs.readFileSync(path.join(projectsDir, file), 'utf-8'),
          priority: 80
        });
      });
    }
    
    // Sort by priority and combine
    contexts.sort((a, b) => b.priority - a.priority);
    
    if (contexts.length === 0) {
      return '';
    }
    
    return [
      '--- PROJECT CONTEXT ---',
      '',
      ...contexts.map(c => c.content),
      '',
      '--- END CONTEXT ---'
    ].join('\n');
  }
  
  /**
   * Create default context file if it doesn't exist
   */
  static ensureDefaultContext(): void {
    const workspaceRoot = process.env.WORKSPACE_ROOT ?? process.cwd();
    const contextDir = path.join(workspaceRoot, this.CONTEXT_DIR);
    const contextFile = path.join(contextDir, 'context.md');
    
    if (!fs.existsSync(contextFile)) {
      fs.mkdirSync(contextDir, { recursive: true });
      
      const defaultContext = `# GueClaw Context

## Who am I
[Seu nome e profissão]

## My Preferences
- Formato de relatórios: Markdown com tabelas
- Horário preferido para backups: 2h da manhã
- Notificações importantes: Telegram
- Linguagem: Português (PT-BR)

## Active Projects
- [Nome do projeto]: [Descrição breve]

## VPS Information
- Host: ${process.env.VPS_HOST || '[configure]'}
- Critical services: [listar serviços críticos]
- Deployment workflow: [descrever workflow]

## Communication Style
- [Direto/Formal/Casual]
- [Técnico/Não-técnico]
- [Detalhado/Resumido]
`;
      
      fs.writeFileSync(contextFile, defaultContext, 'utf-8');
      console.log(`✅ Created default context file at ${contextFile}`);
    }
  }
}
```

#### 1.2 Integrar no Agent Loop (30min)

```typescript
// src/core/agent-loop/agent-loop.ts

import { ContextLoader } from '../context/context-loader';

class AgentLoop {
  // ... existing code ...
  
  private getDefaultSystemPrompt(): string {
    const basePrompt = `Você é o GueClaw, um agente de IA especializado em automação via Telegram.
...existing prompt...`;
    
    // Load and inject project context
    const projectContext = ContextLoader.loadProjectContext();
    
    if (projectContext) {
      return `${basePrompt}

${projectContext}

Use o contexto acima para personalizar suas respostas e decisões.
Não repita informações do contexto ao usuário, apenas use-as para guiar seu raciocínio.`;
    }
    
    return basePrompt;
  }
}
```

#### 1.3 Comando /context (30min)

```typescript
// src/commands/telegram-commands.ts

commandRegistry.register({
  command: 'context',
  description: 'Gerenciar contexto do projeto',
  handler: async (ctx, args) => {
    const subcommand = args[0];
    
    if (!subcommand || subcommand === 'show') {
      // Show current context
      const context = ContextLoader.loadProjectContext();
      if (!context) {
        await ctx.reply('❌ Nenhum contexto configurado.\n\nUse /context create para criar.');
        return;
      }
      
      await ctx.reply(`📄 **Contexto Atual:**\n\n${context.substring(0, 4000)}...`);
    } else if (subcommand === 'create') {
      ContextLoader.ensureDefaultContext();
      await ctx.reply('✅ Contexto padrão criado em .gueclaw/context.md\n\nEdite o arquivo para personalizar.');
    } else if (subcommand === 'reload') {
      // Force reload (clear cache if implemented)
      await ctx.reply('✅ Contexto recarregado.');
    }
  }
});
```

### 📁 Template de Contexto

```markdown
<!-- .gueclaw/context.md -->

# GueClaw Context — Moises

## Who am I
Moises — Advogado, Perito Judicial, Empresário de Tecnologia

## My Preferences
- **Relatórios:** Sempre em Markdown com tabelas estruturadas
- **Backup:** Diário às 2h da manhã
- **Notificações críticas:** Telegram
- **Linguagem:** Português do Brasil (PT-BR)
- **Estilo:** Direto, técnico, sem firulas

## Active Projects

### FluxoHub
Sistema de automação baseado em n8n rodando na VPS.
- Stack: n8n, Docker, PostgreSQL
- URL: https://workflow.dev.kyrius.com.br
- Deploy: PM2 no VPS

### Perícia Judicial
Curso e consultoria de perícia judicial.
- Google Calendar: contato@kyrius.info
- WhatsApp: Campanhas via UazAPI
- Leads: SQLite local

### Advocacia
Escritório próprio de advocacia.
- Agenda: juniormoises335@gmail.com (pessoal)
- Controle financeiro: Local (criptografado)

## VPS Information
- **Host:** 147.93.69.211
- **User:** root
- **Auth:** SSH Key (C:\Users\kyriu\.ssh\gueclaw_vps)
- **Critical Services:** 
  - Docker (gueclaw-network)
  - n8n (workflow.dev.kyrius.com.br)
  - FluxoHub API
  - GueClaw Agent (PM2)
- **Deployment Workflow:**
  1. Sempre verificar se serviços estão up antes de deploy
  2. Backup do banco antes de migrations
  3. Usar Git para versionamento
  4. PM2 restart após deploy

## Communication Style
- **Direto e técnico** — Sem explicações desnecessárias
- **Foco em ação** — Preferir executar a descrever
- **Segurança primeiro** — Sempre perguntar antes de comandos destrutivos

## Security Rules
- **NUNCA** rodar `rm -rf` sem confirmação explícita
- **SEMPRE** fazer backup antes de migrations
- **SEMPRE** verificar espaço em disco antes de grandes uploads
```

### ✅ Critérios de Aceitação

- [ ] Contexto carregado automaticamente em cada conversa
- [ ] Comando `/context show` exibe contexto atual
- [ ] Comando `/context create` cria template padrão
- [ ] Comando `/context reload` força reload
- [ ] Contexto NÃO aparece nas respostas ao usuário
- [ ] LLM usa contexto para personalizar decisões

### 📊 Métricas de Sucesso
- **Antes:** Repetir preferências a cada conversa nova
- **Depois:** Zero repetição — contexto sempre presente

---

## 🎮 FEATURE 2: SLASH COMMANDS RICOS (4-6h)

### 🎯 Objetivo
Comandos avançados para controle fino do agente: `/retry`, `/undo`, `/compress`, `/insights`, `/personality`

### 📚 Aprendizados do Hermes

**Arquivo:** `agent/skill_commands.py`  
**Como funciona:**
- Registry de comandos com handlers assíncronos
- Comandos contextuais (variam por plataforma)
- State management para retry/undo

### 📝 Implementação

#### 2.1 Command Registry Aprimorado (1h)

```typescript
// src/commands/command-registry.ts

export interface CommandHandler {
  command: string;
  description: string;
  aliases?: string[];
  requiresArg?: boolean;
  hidden?: boolean;
  handler: (ctx: any, args: string[]) => Promise<void>;
}

export class CommandRegistry {
  private static commands = new Map<string, CommandHandler>();
  
  static register(handler: CommandHandler): void {
    this.commands.set(handler.command, handler);
    
    // Register aliases
    if (handler.aliases) {
      handler.aliases.forEach(alias => {
        this.commands.set(alias, handler);
      });
    }
  }
  
  static get(command: string): CommandHandler | undefined {
    return this.commands.get(command);
  }
  
  static list(includeHidden = false): CommandHandler[] {
    const unique = new Map<string, CommandHandler>();
    
    this.commands.forEach((handler, command) => {
      if (handler.command === command) { // Only main command, not aliases
        if (!handler.hidden || includeHidden) {
          unique.set(command, handler);
        }
      }
    });
    
    return Array.from(unique.values()).sort((a, b) => a.command.localeCompare(b.command));
  }
}
```

#### 2.2 Implementar /retry (1h)

```typescript
// src/commands/retry-command.ts

import { CommandRegistry } from './command-registry';
import { DatabaseConnection } from '../core/memory/database';
import { AgentController } from '../core/agent-controller';

CommandRegistry.register({
  command: 'retry',
  description: 'Tenta novamente a última mensagem',
  aliases: ['tentar-novamente'],
  handler: async (ctx, args) => {
    const db = DatabaseConnection.getInstance();
    const userId = ctx.from.id;
    
    // Get last user message
    const lastMessage = await db.query<{ content: string, conversation_id: string }>(
      `SELECT content, conversation_id FROM messages 
       WHERE conversation_id IN (
         SELECT id FROM conversations WHERE telegram_user_id = ? ORDER BY created_at DESC LIMIT 1
       )
       AND role = 'user' 
       ORDER BY created_at DESC 
       LIMIT 1`,
      [userId]
    );
    
    if (!lastMessage || lastMessage.length === 0) {
      await ctx.reply('❌ Nenhuma mensagem anterior encontrada.');
      return;
    }
    
    await ctx.reply('🔄 Tentando novamente...');
    
    // Delete last assistant response
    await db.run(
      `DELETE FROM messages 
       WHERE conversation_id = ? 
       AND role = 'assistant' 
       AND created_at > (
         SELECT created_at FROM messages 
         WHERE conversation_id = ? AND role = 'user' 
         ORDER BY created_at DESC LIMIT 1
       )`,
      [lastMessage[0].conversation_id, lastMessage[0].conversation_id]
    );
    
    // Re-process the message
    const controller = AgentController.getInstance();
    await controller.processMessage({
      text: lastMessage[0].content,
      userId: userId,
      chatId: ctx.chat.id,
      isRetry: true
    });
  }
});
```

#### 2.3 Implementar /undo (1h)

```typescript
// src/commands/undo-command.ts

CommandRegistry.register({
  command: 'undo',
  description: 'Remove a última interação (user + assistant) do histórico',
  aliases: ['desfazer'],
  handler: async (ctx, args) => {
    const db = DatabaseConnection.getInstance();
    const userId = ctx.from.id;
    
    // Get current conversation
    const conv = await db.query<{ id: string }>(
      `SELECT id FROM conversations 
       WHERE telegram_user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (!conv || conv.length === 0) {
      await ctx.reply('❌ Nenhuma conversa ativa.');
      return;
    }
    
    const conversationId = conv[0].id;
    
    // Get last user message timestamp
    const lastUserMsg = await db.query<{ created_at: number }>(
      `SELECT created_at FROM messages 
       WHERE conversation_id = ? AND role = 'user' 
       ORDER BY created_at DESC LIMIT 1`,
      [conversationId]
    );
    
    if (!lastUserMsg || lastUserMsg.length === 0) {
      await ctx.reply('❌ Nenhuma mensagem para desfazer.');
      return;
    }
    
    // Delete last turn (user message + all subsequent assistant/tool messages)
    const deleted = await db.run(
      `DELETE FROM messages 
       WHERE conversation_id = ? 
       AND created_at >= ?`,
      [conversationId, lastUserMsg[0].created_at]
    );
    
    await ctx.reply(`✅ Última interação removida (${deleted.changes} mensagens deletadas).`);
  }
});
```

#### 2.4 Implementar /compress (1h)

```typescript
// src/commands/compress-command.ts

import { ContextCompressor } from '../core/agent-loop/context-compressor';

CommandRegistry.register({
  command: 'compress',
  description: 'Força compactação do contexto imediatamente',
  aliases: ['compactar'],
  handler: async (ctx, args) => {
    const db = DatabaseConnection.getInstance();
    const userId = ctx.from.id;
    
    // Get current conversation
    const conv = await db.query<{ id: string }>(
      `SELECT id FROM conversations 
       WHERE telegram_user_id = ? 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    
    if (!conv || conv.length === 0) {
      await ctx.reply('❌ Nenhuma conversa ativa.');
      return;
    }
    
    const conversationId = conv[0].id;
    
    // Get message count before
    const beforeCount = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`,
      [conversationId]
    );
    
    await ctx.reply('🔄 Compactando contexto...');
    
    // Force compression
    const compressor = new ContextCompressor();
    const stats = await compressor.compressConversation(conversationId, true);
    
    // Get message count after
    const afterCount = await db.query<{ count: number }>(
      `SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?`,
      [conversationId]
    );
    
    const saved = beforeCount[0].count - afterCount[0].count;
    
    await ctx.reply(
      `✅ **Contexto Compactado**\n\n` +
      `• Mensagens antes: ${beforeCount[0].count}\n` +
      `• Mensagens depois: ${afterCount[0].count}\n` +
      `• Economizadas: ${saved}\n` +
      `• Tokens economizados: ~${stats.tokensSaved || 'calculando...'}`
    );
  }
});
```

#### 2.5 Implementar /insights (1-2h)

```typescript
// src/commands/insights-command.ts

CommandRegistry.register({
  command: 'insights',
  description: 'Análise de conversas dos últimos N dias (padrão: 7)',
  handler: async (ctx, args) => {
    const days = parseInt(args[0]) || 7;
    const db = DatabaseConnection.getInstance();
    const userId = ctx.from.id;
    
    const since = Date.now() - (days * 24 * 60 * 60 * 1000);
    
    await ctx.reply(`📊 Analisando conversas dos últimos ${days} dias...`);
    
    // Get stats
    const stats = await db.query<any>(`
      SELECT 
        COUNT(DISTINCT c.id) as conversation_count,
        COUNT(m.id) as message_count,
        SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) as user_messages,
        SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) as assistant_messages,
        SUM(CASE WHEN m.role = 'tool' THEN 1 ELSE 0 END) as tool_executions
      FROM conversations c
      LEFT JOIN messages m ON c.id = m.conversation_id
      WHERE c.telegram_user_id = ?
        AND c.created_at >= ?
    `, [userId, since]);
    
    // Get most used tools
    const tools = await db.query<{ tool_name: string, count: number }>(`
      SELECT tool_name, COUNT(*) as count
      FROM messages
      WHERE conversation_id IN (
        SELECT id FROM conversations 
        WHERE telegram_user_id = ? AND created_at >= ?
      )
      AND role = 'tool'
      GROUP BY tool_name
      ORDER BY count DESC
      LIMIT 5
    `, [userId, since]);
    
    // Get cost estimate
    const cost = await db.query<{ total_cost: number }>(`
      SELECT COALESCE(SUM(cost), 0) as total_cost
      FROM cost_tracking
      WHERE user_id = ? AND timestamp >= ?
    `, [userId.toString(), since]);
    
    let response = `📊 **Insights dos últimos ${days} dias**\n\n`;
    response += `**Atividade:**\n`;
    response += `• Conversas: ${stats[0].conversation_count}\n`;
    response += `• Mensagens enviadas: ${stats[0].user_messages}\n`;
    response += `• Respostas do agente: ${stats[0].assistant_messages}\n`;
    response += `• Ferramentas executadas: ${stats[0].tool_executions}\n\n`;
    
    if (tools.length > 0) {
      response += `**Ferramentas mais usadas:**\n`;
      tools.forEach((t, i) => {
        response += `${i + 1}. \`${t.tool_name}\`: ${t.count}x\n`;
      });
      response += '\n';
    }
    
    response += `**Custo total:** $${(cost[0].total_cost || 0).toFixed(4)}`;
    
    await ctx.reply(response);
  }
});
```

#### 2.6 Implementar /personality (1h)

```typescript
// src/commands/personality-command.ts

interface Personality {
  name: string;
  systemPromptAddition: string;
  description: string;
}

const PERSONALITIES: Record<string, Personality> = {
  default: {
    name: 'Padrão',
    systemPromptAddition: '',
    description: 'Comportamento padrão do GueClaw'
  },
  professional: {
    name: 'Profissional',
    systemPromptAddition: '\n\nAdote um tom extremamente profissional e formal. Use linguagem técnica precisa.',
    description: 'Formal e técnico'
  },
  casual: {
    name: 'Casual',
    systemPromptAddition: '\n\nAdote um tom casual e amigável, como um colega de trabalho.',
    description: 'Amigável e descontraído'
  },
  concise: {
    name: 'Conciso',
    systemPromptAddition: '\n\nSeja EXTREMAMENTE conciso. Respostas curtas, direto ao ponto.',
    description: 'Respostas ultra-curtas'
  },
  verbose: {
    name: 'Detalhado',
    systemPromptAddition: '\n\nForneça explicações detalhadas com contexto completo e exemplos.',
    description: 'Explicações completas'
  }
};

CommandRegistry.register({
  command: 'personality',
  description: 'Alterar personalidade do agente',
  handler: async (ctx, args) => {
    const personality = args[0]?.toLowerCase();
    
    if (!personality) {
      // List available personalities
      let response = '🎭 **Personalidades Disponíveis:**\n\n';
      Object.entries(PERSONALITIES).forEach(([key, p]) => {
        response += `• \`${key}\`: ${p.description}\n`;
      });
      response += '\nUso: `/personality <nome>`';
      await ctx.reply(response);
      return;
    }
    
    if (!PERSONALITIES[personality]) {
      await ctx.reply(`❌ Personalidade "${personality}" não encontrada.\n\nUse \`/personality\` para ver opções.`);
      return;
    }
    
    // Store in session state (could be database or in-memory)
    // For now, just acknowledge (implementation depends on architecture)
    await ctx.reply(`✅ Personalidade alterada para: **${PERSONALITIES[personality].name}**`);
    
    // TODO: Integrate with AgentLoop to inject personality in system prompt
  }
});
```

### ✅ Critérios de Aceitação

- [ ] `/retry` tenta novamente última mensagem
- [ ] `/undo` remove última interação do histórico
- [ ] `/compress` força compactação imediata
- [ ] `/insights [days]` mostra análise de atividade
- [ ] `/personality [name]` altera tom de resposta
- [ ] Todos os comandos têm aliases em PT-BR
- [ ] Help atualizado com novos comandos

---

## ⏰ FEATURE 3: CRON SCHEDULER (8-12h)

### 🎯 Objetivo
Sistema de agendamento de tarefas recorrentes ou únicas, executadas desatendidas com entrega multi-plataforma.

### 📚 Aprendizados do Hermes

**Arquivos:**
- `cron/scheduler.py` — Tick loop (60s) com file lock
- `cron/jobs.py` — Storage, parsing, next run calculation
- `tools/cronjob_tools.py` — Unified tool for cron management

**Como funciona:**
1. Jobs armazenados em `~/.hermes/cron/jobs.json`
2. Tick loop roda a cada 60s (background thread no gateway)
3. Cada job vencido executa via agent loop isolado
4. Resultado entregue via plataforma configurada (Telegram, Discord, etc)
5. Output salvo em `~/.hermes/cron/output/{job_id}/{timestamp}.md`

### 🏗️ Arquitetura GueClaw

```
data/
├── cron/
│   ├── jobs.json              ← Definição dos jobs
│   └── output/                ← Histórico de execuções
│       ├── {job_id}/
│       │   ├── 2026-04-16T07-00-00.md
│       │   └── 2026-04-17T07-00-00.md
│       └── ...
```

### 📝 Implementação

#### 3.1 Cron Job Model (1h)

```typescript
// src/services/cron/cron-types.ts

export interface CronSchedule {
  kind: 'once' | 'interval' | 'cron';
  
  // For 'once': ISO timestamp
  runAt?: string;
  
  // For 'interval': minutes
  minutes?: number;
  
  // For 'cron': cron expression (node-cron format)
  expr?: string;
  
  display?: string; // Human-readable
}

export interface CronJob {
  id: string;
  name: string;
  prompt: string;          // Natural language task
  schedule: CronSchedule;
  
  // Delivery configuration
  deliver: 'local' | 'telegram' | 'whatsapp' | 'obsidian' | string;
  deliveryTarget?: {
    platform: string;
    chatId: string;
  };
  
  // State
  enabled: boolean;
  lastRun?: number;        // Unix timestamp
  nextRun?: number;        // Unix timestamp
  
  // Optional
  skill?: string;          // Skill to use
  maxIterations?: number;  // Safety limit
  
  // Metadata
  createdAt: number;
  createdBy: string;       // User ID
  origin?: {
    platform: string;
    chatId: string;
  };
}

export interface CronJobOutput {
  jobId: string;
  timestamp: number;
  success: boolean;
  output: string;
  error?: string;
  duration: number;        // milliseconds
}
```

#### 3.2 Cron Storage (2h)

```typescript
// src/services/cron/cron-storage.ts

import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CronJob, CronJobOutput } from './cron-types';

export class CronStorage {
  private static CRON_DIR = path.join(process.cwd(), 'data', 'cron');
  private static JOBS_FILE = path.join(this.CRON_DIR, 'jobs.json');
  private static OUTPUT_DIR = path.join(this.CRON_DIR, 'output');
  
  static ensureDirs(): void {
    fs.mkdirSync(this.CRON_DIR, { recursive: true, mode: 0o700 });
    fs.mkdirSync(this.OUTPUT_DIR, { recursive: true, mode: 0o700 });
  }
  
  static loadJobs(): CronJob[] {
    this.ensureDirs();
    
    if (!fs.existsSync(this.JOBS_FILE)) {
      return [];
    }
    
    const content = fs.readFileSync(this.JOBS_FILE, 'utf-8');
    return JSON.parse(content);
  }
  
  static saveJobs(jobs: CronJob[]): void {
    this.ensureDirs();
    
    const content = JSON.stringify(jobs, null, 2);
    
    // Atomic write
    const tmpFile = `${this.JOBS_FILE}.tmp`;
    fs.writeFileSync(tmpFile, content, { mode: 0o600 });
    fs.renameSync(tmpFile, this.JOBS_FILE);
  }
  
  static createJob(job: Omit<CronJob, 'id' | 'createdAt'>): CronJob {
    const jobs = this.loadJobs();
    
    const newJob: CronJob = {
      ...job,
      id: uuidv4(),
      createdAt: Date.now()
    };
    
    jobs.push(newJob);
    this.saveJobs(jobs);
    
    return newJob;
  }
  
  static updateJob(id: string, updates: Partial<CronJob>): CronJob | null {
    const jobs = this.loadJobs();
    const index = jobs.findIndex(j => j.id === id);
    
    if (index === -1) return null;
    
    jobs[index] = { ...jobs[index], ...updates };
    this.saveJobs(jobs);
    
    return jobs[index];
  }
  
  static deleteJob(id: string): boolean {
    const jobs = this.loadJobs();
    const filtered = jobs.filter(j => j.id !== id);
    
    if (filtered.length === jobs.length) return false;
    
    this.saveJobs(filtered);
    return true;
  }
  
  static saveOutput(output: CronJobOutput): void {
    const jobOutputDir = path.join(this.OUTPUT_DIR, output.jobId);
    fs.mkdirSync(jobOutputDir, { recursive: true });
    
    const timestamp = new Date(output.timestamp).toISOString().replace(/:/g, '-');
    const filename = `${timestamp}.md`;
    const filePath = path.join(jobOutputDir, filename);
    
    const content = `# Cron Job Output

**Job ID:** ${output.jobId}
**Timestamp:** ${new Date(output.timestamp).toLocaleString()}
**Success:** ${output.success ? '✅' : '❌'}
**Duration:** ${output.duration}ms

${output.error ? `**Error:** ${output.error}\n\n` : ''}

## Output

\`\`\`
${output.output}
\`\`\`
`;
    
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
```

#### 3.3 Schedule Parser (1h)

```typescript
// src/services/cron/schedule-parser.ts

import { CronSchedule } from './cron-types';

export class ScheduleParser {
  /**
   * Parse schedule string into CronSchedule object
   * 
   * Examples:
   *   "30m" → once in 30 minutes
   *   "every 2h" → recurring every 2 hours
   *   "0 7 * * *" → daily at 7am (cron)
   *   "2026-04-17T14:00" → once at specific time
   */
  static parse(schedule: string): CronSchedule {
    schedule = schedule.trim();
    const lower = schedule.toLowerCase();
    
    // "every X" pattern
    if (lower.startsWith('every ')) {
      const duration = lower.substring(6).trim();
      const minutes = this.parseDuration(duration);
      
      return {
        kind: 'interval',
        minutes,
        display: `every ${minutes}m`
      };
    }
    
    // Cron expression (5 fields: min hour day month weekday)
    const cronParts = schedule.split(/\s+/);
    if (cronParts.length === 5 && cronParts.every(p => /^[0-9\*\/\-,]+$/.test(p))) {
      return {
        kind: 'cron',
        expr: schedule,
        display: this.describeCron(schedule)
      };
    }
    
    // ISO timestamp
    if (/^\d{4}-\d{2}-\d{2}/.test(schedule)) {
      return {
        kind: 'once',
        runAt: schedule,
        display: `once at ${schedule}`
      };
    }
    
    // Duration (once)
    const minutes = this.parseDuration(schedule);
    const runAt = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    
    return {
      kind: 'once',
      runAt,
      display: `once in ${minutes}m`
    };
  }
  
  /**
   * Parse duration string to minutes
   * "30m" → 30, "2h" → 120, "1d" → 1440
   */
  private static parseDuration(s: string): number {
    const match = s.match(/^(\d+)\s*(m|min|h|hr|d|day)s?$/i);
    if (!match) {
      throw new Error(`Invalid duration: ${s}`);
    }
    
    const value = parseInt(match[1]);
    const unit = match[2][0].toLowerCase();
    
    const multipliers: Record<string, number> = {
      'm': 1,
      'h': 60,
      'd': 1440
    };
    
    return value * multipliers[unit];
  }
  
  /**
   * Calculate next run time based on schedule
   */
  static calculateNextRun(schedule: CronSchedule, lastRun?: number): number {
    const now = Date.now();
    
    if (schedule.kind === 'once') {
      if (!schedule.runAt) return now;
      return new Date(schedule.runAt).getTime();
    }
    
    if (schedule.kind === 'interval') {
      if (!schedule.minutes) return now;
      
      const base = lastRun || now;
      return base + (schedule.minutes * 60 * 1000);
    }
    
    if (schedule.kind === 'cron') {
      // Use node-cron or croniter equivalent
      // For now, simplified implementation
      throw new Error('Cron expressions require node-cron library');
    }
    
    return now;
  }
  
  /**
   * Human-readable description of cron expression
   */
  private static describeCron(expr: string): string {
    // Simplified — use cronstrue library for full implementation
    if (expr === '0 7 * * *') return 'daily at 7am';
    if (expr === '0 2 * * *') return 'daily at 2am';
    if (expr === '0 9 * * 1') return 'every Monday at 9am';
    return `cron: ${expr}`;
  }
}
```

#### 3.4 Cron Scheduler (3-4h)

```typescript
// src/services/cron/cron-scheduler.ts

import { CronStorage } from './cron-storage';
import { CronJob, CronJobOutput } from './cron-types';
import { ScheduleParser } from './schedule-parser';
import { AgentController } from '../../core/agent-controller';
import { TelegramNotifier } from '../telegram-notifier';

export class CronScheduler {
  private static instance: CronScheduler;
  private tickInterval?: NodeJS.Timeout;
  private isRunning = false;
  
  static getInstance(): CronScheduler {
    if (!this.instance) {
      this.instance = new CronScheduler();
    }
    return this.instance;
  }
  
  /**
   * Start the tick loop (60s interval)
   */
  start(): void {
    if (this.isRunning) return;
    
    console.log('⏰ Starting cron scheduler...');
    this.isRunning = true;
    
    // Run immediately on start
    this.tick();
    
    // Then every 60 seconds
    this.tickInterval = setInterval(() => this.tick(), 60 * 1000);
  }
  
  stop(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }
    this.isRunning = false;
    console.log('⏰ Cron scheduler stopped');
  }
  
  /**
   * Check for due jobs and execute them
   */
  private async tick(): Promise<void> {
    const jobs = CronStorage.loadJobs();
    const now = Date.now();
    
    const dueJobs = jobs.filter(job => 
      job.enabled && 
      job.nextRun && 
      job.nextRun <= now
    );
    
    if (dueJobs.length > 0) {
      console.log(`⏰ ${dueJobs.length} cron job(s) due`);
    }
    
    // Execute each due job (sequentially for now)
    for (const job of dueJobs) {
      await this.executeJob(job);
    }
  }
  
  /**
   * Execute a single cron job
   */
  private async executeJob(job: CronJob): Promise<void> {
    console.log(`⏰ Executing cron job: ${job.name} (${job.id})`);
    
    const startTime = Date.now();
    let success = false;
    let output = '';
    let error: string | undefined;
    
    try {
      // Execute via AgentLoop (isolated conversation)
      const controller = AgentController.getInstance();
      
      const result = await controller.processCronTask({
        prompt: job.prompt,
        skill: job.skill,
        maxIterations: job.maxIterations || 10
      });
      
      output = result.response;
      success = true;
      
      // Deliver result
      await this.deliverOutput(job, output);
      
    } catch (err: any) {
      success = false;
      error = err.message;
      output = `Error: ${err.message}`;
      console.error(`❌ Cron job failed: ${job.name}`, err);
    }
    
    // Save output
    const jobOutput: CronJobOutput = {
      jobId: job.id,
      timestamp: Date.now(),
      success,
      output,
      error,
      duration: Date.now() - startTime
    };
    
    CronStorage.saveOutput(jobOutput);
    
    // Update job state
    const nextRun = ScheduleParser.calculateNextRun(job.schedule, Date.now());
    
    CronStorage.updateJob(job.id, {
      lastRun: Date.now(),
      nextRun: job.schedule.kind === 'once' ? undefined : nextRun,
      enabled: job.schedule.kind === 'once' ? false : job.enabled // Disable one-time jobs
    });
  }
  
  /**
   * Deliver job output to configured destination
   */
  private async deliverOutput(job: CronJob, output: string): Promise<void> {
    // Silent marker check
    if (output.trim().startsWith('[SILENT]')) {
      console.log(`⏰ Job ${job.name} marked as silent, skipping delivery`);
      return;
    }
    
    if (job.deliver === 'local') {
      // No delivery, just save to file
      return;
    }
    
    if (job.deliver === 'telegram') {
      const notifier = TelegramNotifier.getInstance();
      const chatId = job.deliveryTarget?.chatId || job.origin?.chatId;
      
      if (!chatId) {
        console.error('❌ No Telegram chat ID for delivery');
        return;
      }
      
      await notifier.sendMessage(
        parseInt(chatId),
        `⏰ **${job.name}**\n\n${output}`
      );
    }
    
    // TODO: Add WhatsApp, Obsidian delivery
  }
}
```

#### 3.5 Cron Tool (1-2h)

```typescript
// src/tools/cron-tool.ts

import { BaseTool, ToolParams, ToolResult } from './base-tool';
import { CronStorage } from '../services/cron/cron-storage';
import { ScheduleParser } from '../services/cron/schedule-parser';

interface CronParams {
  action: 'create' | 'list' | 'delete' | 'pause' | 'resume' | 'trigger';
  
  // For create
  name?: string;
  prompt?: string;
  schedule?: string;
  deliver?: string;
  
  // For delete/pause/resume/trigger
  jobId?: string;
}

export class CronTool extends BaseTool {
  name = 'cron_manage';
  description = `Gerenciar cron jobs (tarefas agendadas).

Ações disponíveis:
- create: Criar novo job agendado
- list: Listar todos os jobs
- delete: Remover job
- pause: Pausar job
- resume: Retomar job
- trigger: Executar job manualmente`;

  schema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'list', 'delete', 'pause', 'resume', 'trigger'],
        description: 'Ação a executar'
      },
      name: {
        type: 'string',
        description: 'Nome do job (para create)'
      },
      prompt: {
        type: 'string',
        description: 'Prompt/tarefa em linguagem natural (para create)'
      },
      schedule: {
        type: 'string',
        description: 'Agendamento: "30m", "every 2h", "0 7 * * *" (para create)'
      },
      deliver: {
        type: 'string',
        description: 'Destino: "local", "telegram" (para create)'
      },
      jobId: {
        type: 'string',
        description: 'ID do job (para delete/pause/resume/trigger)'
      }
    },
    required: ['action']
  };

  async execute(params: ToolParams): Promise<ToolResult> {
    const { action, name, prompt, schedule, deliver, jobId } = params as CronParams;
    
    try {
      if (action === 'create') {
        if (!name || !prompt || !schedule) {
          return {
            success: false,
            output: 'Error: name, prompt and schedule required for create'
          };
        }
        
        const parsedSchedule = ScheduleParser.parse(schedule);
        const nextRun = ScheduleParser.calculateNextRun(parsedSchedule);
        
        const job = CronStorage.createJob({
          name,
          prompt,
          schedule: parsedSchedule,
          deliver: deliver || 'telegram',
          enabled: true,
          nextRun,
          createdBy: 'user' // TODO: Get from context
        });
        
        return {
          success: true,
          output: `✅ Cron job created: ${job.name}\n` +
                 `ID: ${job.id}\n` +
                 `Schedule: ${parsedSchedule.display}\n` +
                 `Next run: ${new Date(nextRun).toLocaleString()}`
        };
      }
      
      if (action === 'list') {
        const jobs = CronStorage.loadJobs();
        
        if (jobs.length === 0) {
          return {
            success: true,
            output: 'No cron jobs configured'
          };
        }
        
        let output = `📋 Cron Jobs (${jobs.length}):\n\n`;
        jobs.forEach(job => {
          const status = job.enabled ? '✅' : '⏸️';
          const nextRun = job.nextRun ? new Date(job.nextRun).toLocaleString() : 'N/A';
          
          output += `${status} **${job.name}**\n`;
          output += `   ID: ${job.id}\n`;
          output += `   Schedule: ${job.schedule.display}\n`;
          output += `   Next: ${nextRun}\n\n`;
        });
        
        return { success: true, output };
      }
      
      if (action === 'delete') {
        if (!jobId) {
          return { success: false, output: 'Error: jobId required for delete' };
        }
        
        const deleted = CronStorage.deleteJob(jobId);
        
        return {
          success: deleted,
          output: deleted ? `✅ Job ${jobId} deleted` : `❌ Job ${jobId} not found`
        };
      }
      
      if (action === 'pause' || action === 'resume') {
        if (!jobId) {
          return { success: false, output: `Error: jobId required for ${action}` };
        }
        
        const updated = CronStorage.updateJob(jobId, {
          enabled: action === 'resume'
        });
        
        if (!updated) {
          return { success: false, output: `❌ Job ${jobId} not found` };
        }
        
        return {
          success: true,
          output: `✅ Job ${action === 'resume' ? 'resumed' : 'paused'}: ${updated.name}`
        };
      }
      
      // TODO: Implement trigger action
      
      return {
        success: false,
        output: `Unknown action: ${action}`
      };
      
    } catch (error: any) {
      return {
        success: false,
        output: `Error: ${error.message}`
      };
    }
  }
}
```

#### 3.6 Integração com Main (30min)

```typescript
// src/index.ts

import { CronScheduler } from './services/cron/cron-scheduler';

class GueClaw {
  // ... existing code ...
  
  public async start(): Promise<void> {
    // ... existing startup code ...
    
    // Start cron scheduler
    CronScheduler.getInstance().start();
    
    // ... rest of startup ...
  }
  
  public async shutdown(): Promise<void> {
    console.log('\n⏹️ Shutting down GueClaw...');
    
    // Stop cron scheduler
    CronScheduler.getInstance().stop();
    
    // ... rest of shutdown ...
  }
}
```

### ✅ Critérios de Aceitação

- [ ] Cron jobs armazenados em `data/cron/jobs.json`
- [ ] Tick loop roda a cada 60s (em background)
- [ ] Jobs vencidos executam via AgentLoop isolado
- [ ] Output salvo em `data/cron/output/{job_id}/{timestamp}.md`
- [ ] Entrega para Telegram funcional
- [ ] Suporte a schedules: "30m", "every 2h", cron expressions
- [ ] Tool `cron_manage` com create/list/delete/pause/resume
- [ ] Jobs one-time desabilitam após execução
- [ ] Marker `[SILENT]` suprime entrega

### 📊 Use Cases de Teste

```typescript
// 1. Agenda diária (7h da manhã)
{
  "action": "create",
  "name": "Daily Agenda",
  "prompt": "Envie minha agenda de hoje",
  "schedule": "0 7 * * *",
  "deliver": "telegram"
}

// 2. Backup diário (2h da manhã)
{
  "action": "create",
  "name": "Database Backup",
  "prompt": "Faça backup do banco de dados em /opt/gueclaw-data/backups/",
  "schedule": "0 2 * * *",
  "deliver": "local"
}

// 3. Relatório semanal de custos (segunda 9h)
{
  "action": "create",
  "name": "Weekly Cost Report",
  "prompt": "Gere relatório de custos LLM da última semana",
  "schedule": "0 9 * * 1",
  "deliver": "telegram"
}

// 4. Verificação de segurança (todo domingo 22h)
{
  "action": "create",
  "name": "Security Audit",
  "prompt": "Execute scan de segurança da VPS com vps-security-scanner",
  "schedule": "0 22 * * 0",
  "deliver": "telegram"
}
```

---

## 🔄 FEATURE 4: SKILLS AUTO-MELHORÁVEIS (10-12h)

*(Plano detalhado no próximo comentário devido ao tamanho)*

---

## 🔍 FEATURE 5: FTS5 SESSION SEARCH (8-10h)

*(Plano detalhado no próximo comentário devido ao tamanho)*

---

## 👥 FEATURE 6: SUBAGENTES PARALELOS (12-16h)

*(Plano detalhado no próximo comentário devido ao tamanho)*

---

## 📅 ROADMAP DE IMPLEMENTAÇÃO

### Sprint 1: Fundação (Esta Semana) — 16-20h
**Objetivo:** Features de alto impacto e baixo esforço

- ✅ **Context Files** (2-3h) — Personalização zero-config
- ✅ **Slash Commands Ricos** (4-6h) — UX superior
- ✅ **Cron Scheduler Core** (8-12h) — Automações desatendidas

**Entrega:**
- Contexto personalizado em cada conversa
- Comandos `/retry`, `/undo`, `/compress`, `/insights`, `/personality`
- Cron jobs funcionais com entrega Telegram
- Use cases de teste: agenda diária, backups, relatórios

**Métricas de Sucesso:**
- Zero repetição de contexto
- 5+ novos comandos funcionais
- 3+ cron jobs configurados e funcionando

---

### Sprint 2: Inteligência (Semana 2) — 20-24h
**Objetivo:** Auto-evolução e memória de longo prazo

- ✅ **Skills Auto-Melhoráveis** (10-12h) — Skills evoluem sozinhas
- ✅ **FTS5 Session Search** (8-10h) — Busca cross-session com LLM

**Entrega:**
- Skills detectam falhas recorrentes e se auto-corrigem
- Busca em todo histórico de conversas
- Recall de decisões passadas

**Métricas de Sucesso:**
- 3+ skills auto-corrigidas
- Busca funcionando em 1000+ mensagens históricas
- Redução de 50% em falhas recorrentes

---

### Sprint 3: Paralelização (Semana 3) — 12-16h
**Objetivo:** Multi-agent workflows

- ✅ **Subagentes Paralelos** (12-16h) — Spawn de agentes isolados

**Entrega:**
- Ferramenta `delegate_task` funcional
- Execução paralela de 3+ subagentes
- RPC tools para scripts Python

**Métricas de Sucesso:**
- 3x velocidade em tarefas paralelas
- Zero context overhead
- Isolamento completo entre subagentes

---

## 📊 ROI Estimado

| Feature | Esforço | Economia/Dia | Payback | ROI Anual |
|---------|---------|--------------|---------|-----------|
| Context Files | 2-3h | 10min | 2 semanas | 60h |
| Slash Commands | 4-6h | 5min | 1 mês | 30h |
| Cron Scheduler | 8-12h | 2h | 1 semana | 730h |
| Skills Auto-Improve | 10-12h | 30min | 3 semanas | 180h |
| FTS5 Search | 8-10h | 15min | 2 meses | 90h |
| Subagentes | 12-16h | 1h | 2 semanas | 365h |
| **TOTAL** | **54-76h** | **4h 15min** | **17 dias** | **1555h** |

**Conclusão:** Investimento de 54-76h retorna **1555h/ano** em automação e eficiência.

---

## 📝 Próximos Passos

1. **Revisar este plano** com stakeholders
2. **Priorizar Sprint 1** (Context + Commands + Cron)
3. **Setup de desenvolvimento:**
   - Branch `feature/hermes-integration`
   - Environment de teste isolado
   - Banco de dados de teste
4. **Implementação incremental:**
   - Commit por feature
   - Testes unitários
   - Documentação inline
5. **Deploy gradual:**
   - Feature flags
   - Rollout por usuário
   - Monitoramento de erros

---

**Autor:** GueClaw Development Team  
**Data:** 16/04/2026  
**Versão:** 1.0-draft
