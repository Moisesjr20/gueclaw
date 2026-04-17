# 📅 Cron Scheduler - GueClaw Agent

Sistema de agendamento de tarefas automatizadas integrado ao GueClaw Agent v2.0.0.

## 🎯 Visão Geral

O Cron Scheduler permite agendar a execução automática de prompts em horários específicos, intervalos regulares ou datas únicas. O sistema executa os jobs através do AgentLoop, com acesso completo a todas as ferramentas (tools), memória e contexto do usuário.

### Características

- ✅ **4 Formatos de Schedule:** Intervalos simples (30m, 2h), cron expressions (0 7 * * *), ISO timestamps, execuções únicas
- ✅ **Execução via AgentLoop:** Jobs têm acesso a todas as ferramentas e contexto
- ✅ **3 Modos de Entrega:** Telegram, arquivo local, ou silencioso
- ✅ **File Locking:** Persistência atômica com suporte a concorrência
- ✅ **Gerenciamento Completo:** Criar, listar, pausar, retomar, deletar, executar manualmente
- ✅ **Histórico de Execuções:** Saída, duração, tokens usados, ferramentas chamadas
- ✅ **Marker [SILENT]:** Suprimir entrega de output no prompt

---

## 📦 Arquitetura

```
src/services/cron/
├── cron-types.ts          # Interfaces TypeScript
├── cron-storage.ts        # Persistência atômica com file locking
├── schedule-parser.ts     # Parser de schedules (4 formatos)
└── cron-scheduler.ts      # Loop principal (60s tick)

src/tools/
└── cron-tool.ts           # LLM tool para gerenciar jobs

src/commands/
└── telegram-commands.ts   # Comando /cron com subcomandos

data/cron/
├── jobs.json              # Banco de jobs (atomic write)
└── output/                # Saída das execuções (.md files)
```

### Fluxo de Execução

1. **Tick Loop (60s):** `CronScheduler.tick()` verifica jobs vencidos
2. **Execution:** `executeJob()` → `AgentController.processDirectMessage()`
3. **Output:** `deliverOutput()` → Telegram/Local/None
4. **Next Run:** `updateJobAfterExecution()` → calcula próximo horário
5. **Storage:** `CronStorage.updateJob()` → persiste estado

---

## 🚀 Uso

### Via Telegram

#### Listar Jobs

```
/cron list
```

Exibe todos os jobs cadastrados com status, próxima execução e schedule.

#### Ver Status do Scheduler

```
/cron status
```

Mostra se o scheduler está rodando e quantos jobs existem (ativos/pausados/desabilitados).

#### Deletar Job

```
/cron delete <job-id>
```

Remove permanentemente um job.

#### Pausar/Retomar Job

```
/cron pause <job-id>
/cron resume <job-id>
```

Pausa temporariamente ou retoma um job.

#### Executar Manualmente

```
/cron trigger <job-id>
```

Executa um job imediatamente (não altera o schedule).

#### Help

```
/cron help
```

Exibe a ajuda completa do comando.

### Via LLM (CronTool)

O agente pode gerenciar jobs automaticamente via tool `cron_manager`:

```
"Crie um job para me enviar um resumo da agenda todo dia às 7h"
"Liste todos os jobs ativos"
"Delete o job de backup"
"Pause o job de relatório semanal"
"Execute manualmente o job de estatísticas"
```

O CronTool traduz a intenção do usuário em ações concretas.

---

## 📝 Formatos de Schedule

### 1. Intervalos Simples

```typescript
"30m"    // A cada 30 minutos
"2h"     // A cada 2 horas
"1d"     // A cada 1 dia
"every 30m"  // Sintaxe alternativa
```

**Unidades suportadas:** `m` (minutos), `h` (horas), `d` (dias)

### 2. Cron Expressions

```typescript
"0 7 * * *"       // Todo dia às 7h
"*/5 * * * *"     // A cada 5 minutos
"0 9 * * 1"       // Segunda-feira 9h
"30 14 15 * *"    // Dia 15 de cada mês às 14:30
"0 0 1 1 *"       // 1º de janeiro à meia-noite
```

**Formato:** `min hora dia mês dia-da-semana`

**Ferramentas:** Usa `cron-parser` (biblioteca padrão)

### 3. ISO Timestamps (Execução Única)

```typescript
"2026-04-17T14:00"        // Local timezone
"2026-04-17T14:00:00Z"    // UTC
```

Jobs com timestamp no passado não são executados.

### 4. Execução Única Relativa

```typescript
"once 30m"    // Daqui a 30 minutos (desabilita após executar)
```

Jobs "once" são automaticamente desabilitados após a primeira execução.

---

## 🎯 Exemplos Práticos

### Exemplo 1: Agenda Diária

**Objetivo:** Receber resumo da agenda todo dia às 7h no Telegram.

**Via LLM:**
```
"Crie um job chamado 'Agenda Diária' que todo dia às 7h me envie um resumo dos eventos de hoje do Google Calendar"
```

**Via Tool Call (Interno):**
```json
{
  "tool": "cron_manager",
  "parameters": {
    "action": "create",
    "name": "Agenda Diária",
    "schedule": "0 7 * * *",
    "prompt": "Liste os eventos do meu Google Calendar para hoje e faça um resumo",
    "deliver": "telegram"
  }
}
```

**Resultado:**
- Job criado com ID único
- Próxima execução: amanhã às 7h
- Output enviado via Telegram
- Se o prompt usar ferramentas (ex: google_calendar_tool), elas são executadas normalmente

### Exemplo 2: Backup Diário

**Objetivo:** Executar backup silencioso às 2h da madrugada.

**Via LLM:**
```
"Crie um job de backup diário às 2h que execute o backup do banco de dados, mas não me envie mensagem"
```

**Via Tool Call:**
```json
{
  "tool": "cron_manager",
  "parameters": {
    "action": "create",
    "name": "Backup DB",
    "schedule": "0 2 * * *",
    "prompt": "[SILENT] Execute backup completo do banco de dados usando vps_tool",
    "deliver": "local"
  }
}
```

**Resultado:**
- Job executado às 2h
- Output salvo em `data/cron/output/<job-id>_<timestamp>.md`
- Marker `[SILENT]` suprime envio de mensagem
- Delivery "local" salva apenas em arquivo

### Exemplo 3: Relatório Semanal

**Objetivo:** Relatório de estatísticas toda segunda-feira às 9h.

**Via LLM:**
```
"Toda segunda às 9h me envie um relatório com estatísticas dos últimos 7 dias: conversas, mensagens, ferramentas usadas e custo total"
```

**Via Tool Call:**
```json
{
  "tool": "cron_manager",
  "parameters": {
    "action": "create",
    "name": "Relatório Semanal",
    "schedule": "0 9 * * 1",
    "prompt": "Gere um relatório completo das estatísticas dos últimos 7 dias: conversas, mensagens, top 5 ferramentas, custo total. Use insights do /insights command.",
    "deliver": "telegram"
  }
}
```

**Resultado:**
- Executado toda segunda-feira às 9h
- Usa `CostTracker` e queries SQL internos
- Formata resposta em Markdown
- Envia via Telegram

### Exemplo 4: Lembrete Único

**Objetivo:** Lembrete em 30 minutos (execução única).

**Via LLM:**
```
"Me lembre em 30 minutos para revisar o PR"
```

**Via Tool Call:**
```json
{
  "tool": "cron_manager",
  "parameters": {
    "action": "create",
    "name": "Lembrete PR",
    "schedule": "once 30m",
    "prompt": "⏰ Lembrete: revisar o PR",
    "deliver": "telegram"
  }
}
```

**Resultado:**
- Executado uma única vez daqui a 30 minutos
- Status automaticamente alterado para "disabled" após execução
- Prompt pode ser simples texto (não precisa usar tools)

---

## 🛠️ API Técnica

### CronScheduler

#### `initialize(agentController: AgentController, bot: Bot): void`

Inicializa o scheduler com referências ao controller e bot.

**Uso:**
```typescript
const cronScheduler = CronScheduler.getInstance();
cronScheduler.initialize(controller, bot);
```

#### `start(): void`

Inicia o loop principal (60s tick).

**Uso:**
```typescript
cronScheduler.start();
console.log('✅ Cron Scheduler iniciado (tick: 60s)');
```

#### `stop(): void`

Para o loop e limpa o intervalo.

**Uso:**
```typescript
cronScheduler.stop();
console.log('🛑 Cron Scheduler parado');
```

#### `tick(): Promise<void>`

Executa uma iteração do loop (verifica jobs vencidos).

**Fluxo:**
1. Carrega jobs via `CronStorage.loadJobs()`
2. Filtra jobs com `nextRun <= now` e status "active"
3. Para cada job: `executeJob()`, `deliverOutput()`, `updateJobAfterExecution()`
4. Logs detalhados de cada etapa

**Chamado automaticamente a cada 60s quando `start()` está ativo.**

#### `executeJob(job: CronJob): Promise<CronJobOutput>`

Executa um job através do AgentLoop.

**Passos:**
1. Remove marker `[SILENT]` do prompt (se presente)
2. Chama `agentController.processDirectMessage(cleanPrompt, job.userId)`
3. Coleta resposta, tool calls, tokens usados
4. Calcula duração
5. Retorna `CronJobOutput`

**Error Handling:**
- Exceções são capturadas e retornadas como `{success: false, error}`
- Jobs com erro não são desabilitados (tentarão novamente no próximo horário)

#### `deliverOutput(job: CronJob, output: CronJobOutput): Promise<void>`

Entrega o output conforme o `deliver` target do job.

**Targets:**

- **telegram:** Envia mensagem via `bot.api.sendMessage()`
  - Formato: `📋 [Job Name]\n\n[Output]\n\n⏱️ Duration: Xs\n💰 Tokens: N`
  - Limita a 4000 chars (corta se necessário)
  - Marca com "✅ Success" ou "❌ Error"

- **local:** Salva em arquivo via `CronStorage.saveOutput()`
  - Path: `data/cron/output/<job-id>_<timestamp>.md`
  - Formato Markdown completo com metadata

- **none:** Não entrega (apenas persiste em `jobs.json`)

**Supressão [SILENT]:**
- Se o prompt contém `[SILENT]`, deliverOutput() não envia output (mesmo com deliver="telegram")
- Useful para jobs que apenas executam ações (ex: backups)

#### `updateJobAfterExecution(job: CronJob, output: CronJobOutput): Promise<void>`

Atualiza o estado do job após execução.

**Ações:**
1. Atualiza `lastRun` para timestamp atual
2. Calcula `nextRun` via `ScheduleParser.calculateNextRun()`
3. Se schedule type é "once": altera status para "disabled"
4. Salva via `CronStorage.updateJob()`

**Edge Cases:**
- Jobs "once" são desabilitados (não executam novamente)
- Jobs com erro mantêm o schedule (tentarão no próximo horário)

---

### CronStorage

#### `ensureDirs(): Promise<void>`

Cria as pastas `data/cron/` e `data/cron/output/` se não existirem.

**Chamado automaticamente no `start()` do scheduler.**

#### `loadJobs(): Promise<CronJobsFile>`

Carrega jobs do arquivo `data/cron/jobs.json`.

**Retorno:**
```typescript
{
  version: "1.0.0",
  updatedAt: "2026-04-17T10:00:00Z",
  jobs: CronJob[]
}
```

**Se o arquivo não existir:** Retorna estrutura vazia.

#### `saveJobs(jobs: CronJob[]): Promise<void>`

Persiste jobs com atomic write.

**Fluxo:**
1. Adquire file lock (`data/cron/.lock`)
2. Escreve em `jobs.json.tmp`
3. Renomeia atomicamente para `jobs.json`
4. Libera lock

**Concorrência:** Suporta múltiplas instâncias via file locking (timeout: 5s).

#### `createJob(job: Omit<CronJob, 'id' | 'createdAt'>): Promise<CronJob>`

Cria um novo job.

**Passos:**
1. Gera UUID único
2. Adiciona `createdAt` timestamp
3. Append ao array de jobs
4. Salva via `saveJobs()`
5. Retorna job completo

**Validação:** Nenhuma validação automática (validar schedule antes de chamar).

#### `updateJob(jobId: string, updates: Partial<CronJob>): Promise<CronJob>`

Atualiza campos de um job existente.

**Uso:**
```typescript
await storage.updateJob('job-123', {
  status: 'paused',
  nextRun: new Date('2026-04-18T07:00:00Z')
});
```

**Throws:** Error se job não for encontrado.

#### `deleteJob(jobId: string): Promise<void>`

Remove um job permanentemente.

**Throws:** Error se job não for encontrado.

#### `getJob(jobId: string): Promise<CronJob | undefined>`

Busca um job por ID.

**Retorno:** Job ou `undefined` se não encontrado.

#### `saveOutput(jobId: string, output: CronJobOutput): Promise<string>`

Salva output de execução em arquivo Markdown.

**Path:** `data/cron/output/<job-id>_<timestamp>.md`

**Formato:**
```markdown
# Job Execution Output

**Job ID:** <job-id>
**Timestamp:** <ISO timestamp>
**Status:** ✅ Success / ❌ Error
**Duration:** <X>ms
**Tokens Used:** <N>

## Output

<output text>

## Metadata

- Tools Used: [tool1, tool2, ...]
- Error: <error message (if any)>
```

**Retorno:** Path absoluto do arquivo criado.

#### `cleanOldOutputs(keepPerJob: number = 10): Promise<void>`

Remove arquivos de output antigos, mantendo apenas os N mais recentes por job.

**Uso:**
```typescript
await storage.cleanOldOutputs(5); // Mantém 5 por job
```

**Chamada:** Não é chamada automaticamente (executar manualmente ou via cron job).

---

### ScheduleParser

#### `parse(scheduleStr: string): CronSchedule`

Parseia uma string de schedule em objeto tipado.

**Formatos suportados:**
1. Intervalos: `30m`, `2h`, `1d`
2. Cron: `0 7 * * *`
3. ISO: `2026-04-17T14:00`
4. Once: `once 30m`

**Retorno:**
```typescript
{
  type: 'once' | 'interval' | 'cron',
  value: string,
  description?: string
}
```

**Throws:** Error se formato inválido.

**Exemplo:**
```typescript
const schedule = ScheduleParser.parse('0 7 * * *');
// { type: 'cron', value: '0 7 * * *', description: 'At 7:00 AM every day' }
```

#### `calculateNextRun(schedule: CronSchedule, fromTime: Date = new Date()): Date`

Calcula a próxima execução a partir de um horário.

**Lógica:**

- **once:** `fromTime + interval` (ex: now + 30m)
- **interval:** `fromTime + interval`
- **cron:** Usa `cron-parser` para calcular próximo match

**Exemplo:**
```typescript
const schedule = { type: 'cron', value: '0 7 * * *' };
const next = ScheduleParser.calculateNextRun(schedule, new Date('2026-04-17T08:00'));
// Date('2026-04-18T07:00') (amanhã às 7h)
```

#### `describeCron(cronExpression: string): string`

Gera descrição human-readable de cron expression.

**Implementação:** Simplificada (casos comuns). Para casos complexos, usar biblioteca `cronstrue`.

**Exemplo:**
```typescript
describeCron('0 7 * * *'); // "At 7:00 AM every day"
describeCron('*/5 * * * *'); // "Every 5 minutes"
describeCron('0 9 * * 1'); // "At 9:00 AM on Monday"
```

---

### CronTool

Ferramenta LLM para gerenciar jobs via linguagem natural.

#### Actions Disponíveis

**create:**
```json
{
  "action": "create",
  "name": "Nome do Job",
  "schedule": "0 7 * * *",
  "prompt": "Prompt a executar",
  "deliver": "telegram" | "local" | "none"
}
```

**list:**
```json
{
  "action": "list",
  "status": "active" | "paused" | "disabled" | "all"
}
```

**delete:**
```json
{
  "action": "delete",
  "job_id": "uuid"
}
```

**pause / resume:**
```json
{
  "action": "pause" | "resume",
  "job_id": "uuid"
}
```

**trigger:**
```json
{
  "action": "trigger",
  "job_id": "uuid"
}
```

**status:**
```json
{
  "action": "status"
}
```

**Retorno:** Sempre texto formatado em Markdown para o LLM processar.

---

## 🔧 Configuração

### Inicialização

No arquivo `src/index.ts`:

```typescript
import { CronScheduler } from './services/cron/cron-scheduler';
import { CronTool } from './tools/cron-tool';

class GueClaw {
  private cronScheduler?: CronScheduler;

  async start() {
    // ... outras inicializações

    // Registrar CronTool
    this.toolRegistry.registerTool(new CronTool());

    // Inicializar scheduler
    this.cronScheduler = CronScheduler.getInstance();
    this.cronScheduler.initialize(this.controller, this.bot);
    this.cronScheduler.start();
    console.log('✅ Cron Scheduler iniciado (tick: 60s)');
  }

  async shutdown() {
    // ... outros shutdowns

    // Parar scheduler
    if (this.cronScheduler) {
      this.cronScheduler.stop();
      console.log('🛑 Cron Scheduler parado');
    }
  }
}
```

### Persistência

Jobs são persistidos em `data/cron/jobs.json` (JSON file).

**Estrutura:**
```json
{
  "version": "1.0.0",
  "updatedAt": "2026-04-17T10:00:00Z",
  "jobs": [
    {
      "id": "uuid",
      "name": "Agenda Diária",
      "prompt": "Liste eventos do Google Calendar para hoje",
      "schedule": { "type": "cron", "value": "0 7 * * *" },
      "deliver": "telegram",
      "status": "active",
      "lastRun": "2026-04-17T07:00:00Z",
      "nextRun": "2026-04-18T07:00:00Z",
      "userId": "123456789",
      "metadata": { "createdBy": "telegram", "tags": ["calendar"] },
      "createdAt": "2026-04-15T10:00:00Z"
    }
  ]
}
```

**Backup:** Recomenda-se backup regular do diretório `data/cron/`.

### Output Storage

Outputs são salvos em `data/cron/output/` como arquivos Markdown.

**Naming:** `<job-id>_<timestamp>.md`

**Limpeza:** Executar `cleanOldOutputs()` periodicamente (não automático).

---

## 🐛 Troubleshooting

### Job não está executando

**Checklist:**

1. Scheduler está rodando? → `/cron status`
2. Job está ativo? → `/cron list` (verificar status)
3. `nextRun` está no futuro? → Verificar horário do sistema
4. Logs do scheduler? → Verificar console output

**Logs típicos:**
```
[CronScheduler] Tick: checking jobs...
[CronScheduler] Found 1 jobs due for execution
[CronScheduler] Executing job: Agenda Diária (uuid)
[CronScheduler] Job executed successfully in 1234ms
[CronScheduler] Output delivered via telegram
[CronScheduler] Next run scheduled for 2026-04-18T07:00:00Z
```

### Job executou mas não recebi mensagem

**Motivos:**

1. **Delivery target é "local" ou "none"** → Mudar para "telegram"
2. **Prompt contém [SILENT]** → Remover marker
3. **Bot não tem acesso ao chat** → Verificar permissões do bot
4. **Output vazio** → Verificar se prompt retorna texto

**Verificação:**
```
/cron list  # Ver deliver target
```

Checar arquivo de output em `data/cron/output/`.

### Schedule inválido

**Erros comuns:**

- `"Invalid schedule format"` → Formato não reconhecido
- `"Invalid cron expression"` → Cron mal formado (verificar com crontab.guru)
- `"Invalid interval"` → Unidade não suportada (use m/h/d)
- `"Invalid ISO timestamp"` → Formato inválido (use ISO 8601)

**Validação:**

```typescript
import { ScheduleParser } from './services/cron/schedule-parser';

try {
  const schedule = ScheduleParser.parse('0 7 * * *');
  console.log('✅ Schedule válido:', schedule);
} catch (error) {
  console.error('❌ Schedule inválido:', error.message);
}
```

### Concorrência (múltiplas instâncias)

**Problema:** Duas instâncias do bot rodando simultaneamente.

**Solução:** File locking previne corrupção de `jobs.json`.

**Timeout:** 5 segundos. Se lock não for adquirido, operação falha.

**Recomendação:** Rodar apenas uma instância por vez.

### Performance

**Tick loop:** 60 segundos (não configurável).

**Impacto:** Mínimo. Apenas verifica `nextRun` de jobs ativos.

**Jobs simultâneos:** Executam sequencialmente (não paralelo).

**Otimização:** Se há muitos jobs, considerar aumentar tick interval ou usar job queue externo.

---

## 📚 Referências

- **cron-parser:** https://github.com/harrisiirak/cron-parser
- **Cron expression syntax:** https://crontab.guru
- **ISO 8601:** https://en.wikipedia.org/wiki/ISO_8601
- **DVACE Architecture:** `docs/architecture/dvace-pattern.md`

---

## 🎉 Exemplos Avançados

### Job Composto (Usando Multiple Tools)

```json
{
  "action": "create",
  "name": "Relatório Matinal",
  "schedule": "0 7 * * *",
  "prompt": "Faça um resumo matinal: 1) eventos do Google Calendar para hoje, 2) estatísticas de ontem (conversas, custos), 3) tarefas pendentes no Obsidian. Formate em Markdown com emojis.",
  "deliver": "telegram"
}
```

**Resultado:** Job usa múltiplas ferramentas (google_calendar, cost_tracker, obsidian) e formata resposta unificada.

### Job de Manutenção

```json
{
  "action": "create",
  "name": "Limpeza Output",
  "schedule": "0 3 * * *",
  "prompt": "[SILENT] Execute cleanOldOutputs(5) via CronStorage para manter apenas 5 outputs por job",
  "deliver": "none"
}
```

**Resultado:** Job silencioso que limpa outputs antigos diariamente às 3h.

### Job Condicional

```json
{
  "action": "create",
  "name": "Alerta Custo",
  "schedule": "0 12 * * *",
  "prompt": "Se o custo total da última semana for maior que $10, me envie um alerta. Caso contrário, apenas registre '[SILENT]'.",
  "deliver": "telegram"
}
```

**Resultado:** Job que envia mensagem apenas se condição for atendida.

---

## ✅ Conclusão

O Cron Scheduler é uma ferramenta poderosa para automatizar tarefas no GueClaw Agent. Com suporte a múltiplos formatos de schedule, execução via AgentLoop (com acesso a todas as ferramentas), e gerenciamento flexível via LLM ou comandos Telegram, é possível criar automações complexas de forma simples e confiável.

Para dúvidas ou sugestões, consulte a documentação completa em `docs/` ou abra uma issue no repositório.
