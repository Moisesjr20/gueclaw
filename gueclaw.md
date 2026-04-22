# GueClaw Agent - Documentação do Projeto

> VPS Personal AI Agent with Telegram Interface  
> Versão: 2.0.0 | Arquitetura: DVACE

---

## 🎯 Visão Geral

O **GueClaw** é um agente de IA pessoal projetado para operar em VPS (Virtual Private Server), oferecendo controle total do ambiente via interface Telegram. Implementa a arquitetura **DVACE** (Data Validation and Control Engine), inspirada no Claude Code da Anthropic.

### Principais Características

- **Multi-LLM Support**: GitHub Copilot/OpenAI, DeepSeek Fast/Reasoner
- **Controle VPS**: Shell, Docker, arquivos, APIs HTTP
- **Interface Telegram**: Whitelist de usuários, processamento multimodal
- **Skills Modulares**: Hot-reload, auto-aperfeiçoamento
- **Memória Persistente**: SQLite com WAL + context files
- **Cron Scheduler**: Agendamento de tarefas recorrentes
- **Subagentes Paralelos**: Delegação de tarefas isoladas e execução paralela
- **Error Recovery System**: Recuperação inteligente de tarefas interrompidas com botões inline no Telegram
- **Cost Tracking**: Monitoramento de tokens e custos LLM

---

## 🏗️ Arquitetura DVACE

O GueClaw implementa uma arquitetura própria chamada **DVACE** que separa explicitamente três tipos de ação:

### 1. LocalCommand

Executa **imediatamente** sem passar pelo LLM.

```typescript
export const version: LocalCommand = {
  type: 'local',
  name: 'version',
  description: 'Show version',
  run: async () => ({ success: true, message: 'v2.0.0' })
};
```

**Uso**: `/start`, `/help`, `/version`, `/status`, `/tasks`, `/clear`

**Características**:
- ❌ Sem chamada LLM
- ✅ Resposta < 500ms
- ✅ Determinístico

### 2. PromptCommand

Envia instrução ao LLM **com ferramentas restritas**.

```typescript
export const review: PromptCommand = {
  type: 'prompt',
  name: 'review',
  description: 'AI code review',
  allowedTools: ['Bash(git *)', 'FileRead(*)', 'FileEdit(*)'],
  async getPrompt(args, context) {
    return 'Review staged changes and suggest improvements.';
  }
};
```

**Uso**: `/review`, `/commit`, `/deploy`

**Características**:
- ✅ Invoca agent loop com LLM
- 🔒 Permissões de ferramentas via `allowedTools`
- 🎯 Suporta wildcards: `Bash(git *)`, `FileRead(*)`

### 3. ToolCommand

Wrapper direto para ferramentas executáveis.

```typescript
export const dockerStatus: ToolCommand = {
  type: 'tool',
  name: 'docker_status',
  description: 'Get Docker container status',
  toolName: 'DockerCommand',
  execute: async (input, context) => {
    // Direct tool execution
  }
};
```

---

## 📁 Estrutura de Diretórios

```
D:\Clientes de BI\projeto GueguelClaw\
├── src/                          # Código fonte TypeScript
│   ├── core/                     # Núcleo do sistema
│   │   ├── agent-loop/           # Agent Loop (ReAct pattern)
│   │   │   ├── agent-loop.ts     # Implementação principal
│   │   │   ├── tool-orchestrator.ts
│   │   │   └── tool-use-validator.ts
│   │   ├── command-registry.ts   # Registro de comandos DVACE
│   │   ├── memory/               # Persistência (SQLite)
│   │   │   ├── database.ts
│   │   │   ├── conversation-repository.ts
│   │   │   └── message-repository.ts
│   │   ├── providers/            # LLM Providers
│   │   │   ├── base-provider.ts
│   │   │   ├── github-copilot-provider.ts
│   │   │   ├── deepseek-provider.ts
│   │   │   └── provider-factory.ts
│   │   └── skills/               # Sistema de skills
│   │       ├── skill-loader.ts
│   │       ├── skill-router.ts
│   │       └── skill-executor.ts
│   ├── tools/                    # Ferramentas disponíveis
│   │   ├── tool-registry.ts      # Registro de ferramentas
│   │   ├── base-tool.ts          # Classe base
│   │   ├── docker-tool.ts        # Gerenciamento Docker
│   │   ├── vps-command-tool.ts   # Comandos shell/VPS
│   │   ├── file-operations-tool.ts # Leitura/escrita arquivos
│   │   ├── glob-tool.ts          # Busca de arquivos
│   │   ├── grep-tool.ts          # Busca em conteúdo
│   │   ├── api-request-tool.ts   # Requisições HTTP
│   │   ├── memory-write-tool.ts  # Persistência memória
│   │   └── skill-tool/           # Ferramentas de skill
│   ├── handlers/                 # Handlers de I/O
│   │   ├── telegram-input-handler.ts
│   │   ├── telegram-output-handler.ts
│   │   ├── command-handler.ts
│   │   └── command-executor.ts
│   ├── commands/                 # Comandos Telegram
│   │   └── telegram-commands.ts
│   ├── services/                 # Serviços diversos
│   │   ├── cost-tracker/         # Rastreamento de custos
│   │   ├── mcp/                  # Model Context Protocol
│   │   ├── context-compressor/   # Compressão de contexto
│   │   ├── memory-extractor/     # Extração de memórias
│   │   └── error-recovery-manager.ts # Gerenciamento de recuperação de erros
│   ├── scripts/                  # Scripts utilitários
│   │   └── error-log-mapper.ts   # Análise de logs de erro
│   ├── types/                    # Definições de tipos
│   │   ├── command-types.ts      # Tipos DVACE
│   │   ├── agent-state.ts        # Estado do agente
│   │   ├── query-state.ts        # Estado da query
│   │   └── errors.ts             # Custom error classes
│   └── index.ts                  # Entry point
├── .agents/                      # Skills modulares
│   ├── skills/                   # Skills disponíveis
│   ├── agents/                   # Configuração de agentes
│   └── mcp/                      # MCP servers
├── dashboard/                    # Dashboard web (Vercel)
├── data/                         # SQLite e dados
│   ├── recovery/                 # Tarefas interrompidas (Error Recovery)
│   │   └── interrupted-tasks.json
│   ├── memory/                   # Memórias extraídas
│   └── *.db                      # Bancos SQLite
├── logs/                         # Logs do sistema
├── scripts/                      # Scripts utilitários
├── tests/                        # Testes Jest
├── docs/                         # Documentação
├── config/                       # Configurações
└── backups/                      # Backups
```

---

## 🔄 Fluxo do Agent Loop (ReAct Pattern)

O Agent Loop implementa o padrão **ReAct** (Reasoning and Acting):

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   User Input    │────▶│  Parse Command  │────▶│  Command Type?  │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              │                           │                           │
                              ▼                           ▼                           ▼
                       ┌────────────┐              ┌────────────┐               ┌────────────┐
                       │   Local    │              │   Prompt   │               │    Tool    │
                       │  Command   │              │  Command   │               │  Command   │
                       └─────┬──────┘              └─────┬──────┘               └─────┬──────┘
                             │                           │                            │
                             ▼                           ▼                            ▼
                    ┌──────────────┐           ┌──────────────────┐           ┌──────────────┐
                    │ Execute      │           │ Start Agent Loop │           │ Execute Tool │
                    │ Immediately  │           └────────┬─────────┘           │ Directly     │
                    └──────────────┘                    │                       └──────────────┘
                                                        ▼
                                              ┌──────────────────┐
                                              │  LLM Provider    │
                                              └────────┬─────────┘
                                                       │
                        ┌──────────────────────────────┼──────────────────────────────┐
                        │                              │                              │
                        ▼                              ▼                              ▼
                 ┌────────────┐                ┌────────────┐                  ┌────────────┐
                 │   Reply    │                │ Tool Call  │                  │   Error    │
                 │   Text     │                │  Request   │                  │   State    │
                 └────────────┘                └─────┬──────┘                  └────────────┘
                                                     │
                                                     ▼
                                              ┌────────────┐
                                              │  Validate  │
                                              │  Permission│
                                              └─────┬──────┘
                                                    │
                        ┌───────────────────────────┼───────────────────────────┐
                        │                           │                           │
                        ▼                           ▼                           ▼
                 ┌────────────┐               ┌────────────┐              ┌────────────┐
                 │  Execute   │               │   Block    │              │   Error    │
                 │   Tool     │               │   Tool     │              │  (Recovery)│
                 └─────┬──────┘               └────────────┘              └─────┬──────┘
                       │                                                        │
                       ▼                                                        │
                ┌────────────┐                                                   │
                │  Success?  │◄──────────────────────────────────────────────────┘
                └─────┬──────┘
                      │
         ┌────────────┼────────────┐
         │            │            │
         ▼            ▼            ▼
    ┌────────┐   ┌────────┐   ┌────────┐
    │ Return │   │ Return │   │ Retry  │
    │ Result │   │ Error  │   │/Loop   │
    │ to LLM │   │ to LLM │   │ Detect │
    └────────┘   └────────┘   └────────┘
```

### Estados do Agent Loop

```typescript
interface AgentLoopState {
  turnCount: number;
  lastTransition: string;
  transitionHistory: string[];
  recoveryAttempts: Map<string, number>;
  hasAttemptedCompaction: boolean;
  hasAttemptedTokenReduction: boolean;
  consecutiveErrors: number;
  totalToolExecutions: number;
  totalToolDuration: number;
  startTime: number;
  lastUpdateTime: number;
}
```

### Transições de Estado

- `INIT` - Inicialização
- `ITERATION_START` - Início de iteração
- `LLM_THINKING` - LLM processando
- `TOOL_EXECUTION` - Executando ferramenta
- `TOOL_SUCCESS` - Ferramenta executada com sucesso
- `TOOL_FAILURE` - Falha na execução
- `LOOP_DETECTED` - Loop detectado
- `RECOVERY_ATTEMPT` - Tentativa de recuperação
- `TRUNCATION_DETECTED` - Resposta truncada
- `MAX_ITERATIONS_REACHED` - Máximo de iterações
- `SUCCESS` - Concluído com sucesso
- `ERROR` - Erro final

---

## 🛠️ Ferramentas Disponíveis

| Ferramenta | Descrição | Categoria |
|------------|-----------|-----------|
| `Bash` | Executa comandos shell | VPS |
| `DockerCommand` | Gerencia containers/images | VPS |
| `FileRead` | Lê arquivos | Filesystem |
| `FileEdit` | Edita arquivos | Filesystem |
| `Glob` | Busca arquivos por padrão | Filesystem |
| `Grep` | Busca em conteúdo de arquivos | Filesystem |
| `APIRequest` | Requisições HTTP | Network |
| `MemoryWrite` | Persiste informações na memória | Memory |
| `AnalyzeImage` | Analisa imagens | Multimodal |
| `AudioTool` | Processa áudio/voz | Multimodal |
| `NotebookLM` | RAG completo com Google NotebookLM | RAG |
| `SkillTool` | Executa skills modulares | Skills |
| `MCPTool` | Interage com MCP servers | Integration |

### Permissões de Ferramentas

O sistema suporta padrões de permissão no `allowedTools`:

```typescript
// Todas as ferramentas
allowedTools: ['*']

// Todas as leituras de arquivo
allowedTools: ['FileRead(*)']

// Apenas comandos git
allowedTools: ['Bash(git *)']

// Múltiplas permissões
allowedTools: ['Bash(git *)', 'FileRead(*)', 'DockerCommand']

// Com negação
allowedTools: ['FileRead(*)', '!FileRead(*.env)']
```

---

## 🧠 Sistema de Memória

### Camadas de Memória

1. **Memória de Conversação** (SQLite)
   - Histórico de mensagens
   - Janela de contexto configurável
   - Cleanup automático

2. **Memória Persistente** (Context Files)
   - `.gueclaw/context.md` - Contexto pessoal
   - `.gueclaw/projects/*.md` - Contextos de projeto
   - Carregado automaticamente em cada conversa

3. **Memória Extrairada** (Memórias automáticas)
   - Fatos extraídos automaticamente das conversas
   - Indexado para busca rápida

### Comandos de Memória

```
/context show       # Mostra contexto atual
/context create     # Cria novo contexto
/context reload     # Recarrega contexto
```

---

## ⏰ Cron Scheduler

Sistema de agendamento de tarefas recorrentes:

```typescript
// Registrar uma tarefa cron
scheduler.register({
  name: 'daily-backup',
  schedule: '0 2 * * *',  // 2 AM todo dia
  task: async () => {
    // Executa backup
  }
});
```

**Formato Cron**: `minuto hora dia-mês mês dia-semana`

---

## 📚 RAG com NotebookLM

O GueClaw integra o **Google NotebookLM** via `notebooklm-py` para RAG (Retrieval Augmented Generation) completo, permitindo adicionar documentos e fazer perguntas contextualizadas.

### Instalação

```bash
# 1. Instalar o pacote Python
pip install notebooklm-py

# 2. Fazer login na conta Google (apenas primeira vez)
notebooklm login

# 3. Verificar instalação
python scripts/install-notebooklm.py check
```

### Ações Disponíveis

| Ação | Descrição | Parâmetros |
|------|-----------|------------|
| `login` | Verifica/faz login no NotebookLM | - |
| `list_sources` | Lista todas as fontes disponíveis | - |
| `add_source` | Adiciona documento (PDF, TXT, MD, DOCX) | `file_path`, `title` (opcional) |
| `delete_source` | Remove uma fonte | `source_id` |
| `generate_audio` | Gera podcast/áudio do documento | `source_id` |
| `chat` | Chat RAG com citações do documento | `source_id`, `message` |

### Exemplos de Uso

**Adicionar um documento:**
```
User: Adicione o arquivo ./documentos/relatorio.pdf ao NotebookLM

Agent: [NotebookLM.add_source]
✅ Fonte 'relatorio.pdf' adicionada
ID: abc-123-xyz
```

**Chat RAG:**
```
User: Pergunte ao NotebookLM sobre abc-123-xyz: "Quais são as conclusões principais?"

Agent: [NotebookLM.chat]
🤖 De acordo com o relatório (página 15), as principais conclusões são:
1. Aumento de 25% na receita trimestral
2. Expansão para 3 novos mercados
3. Redução de custos operacionais em 15%
```

**Gerar Podcast:**
```
User: Gere um podcast do documento abc-123-xyz

Agent: [NotebookLM.generate_audio]
🎧 Podcast gerado com sucesso!
URL: https://notebooklm.google.com/.../audio
```

**Listar Fontes:**
```
User: Liste minhas fontes no NotebookLM

Agent: [NotebookLM.list_sources]
📚 3 fontes encontradas:
- relatorio.pdf (ID: abc-123)
- artigo.txt (ID: def-456)
- manual.md (ID: ghi-789)
```

### Fluxo de Trabalho Completo

```
1. Adicionar documento
   → NotebookLM.add_source(file_path="./doc.pdf")
   → Retorna source_id: "abc-123"

2. Fazer perguntas (RAG)
   → NotebookLM.chat(source_id="abc-123", message="...")
   → Retorna resposta com citações

3. Gerar conteúdo
   → NotebookLM.generate_audio(source_id="abc-123")
   → Retorna URL do podcast

4. Limpar (opcional)
   → NotebookLM.delete_source(source_id="abc-123")
   → Remove a fonte
```

### Notas Importantes

- **Formatos suportados**: PDF, TXT, MD, HTML, DOCX
- **Autenticação**: Login é feito uma vez via CLI e salvo localmente
- **Persistência**: As fontes persistem na conta Google
- **Limites**: Consulte os limites do NotebookLM no plano Google

**Ver detalhes completos em:** `docs/notebooklm-integration.md`

---

## � Subagentes Paralelos

O GueClaw implementa um sistema avançado de **subagentes isolados** que permite executar múltiplas tarefas em paralelo com contexto independente.

### Arquitetura

```typescript
// Delegar tarefas para subagentes isolados
const result = await delegate_task({
  tasks: [
    { description: 'Analyze file A', context: { file: 'src/a.ts' } },
    { description: 'Analyze file B', context: { file: 'src/b.ts' } },
    { description: 'Analyze file C', context: { file: 'src/c.ts' } }
  ],
  maxConcurrent: 3  // Máximo 3 tarefas simultâneas
});
```

### Características

- **Contexto Isolado**: Cada subagente tem seu próprio histórico de mensagens (não compartilha com o pai)
- **Task ID Único**: UUID v4 para isolamento total
- **Timeout Handling**: Limite de tempo configurável por tarefa (Promise.race)
- **Error Isolation**: Falha em uma tarefa não afeta as outras
- **Restricted Toolsets**: Ferramentas bloqueadas para segurança:
  - `delegate_task` (previne recursão infinita)
  - `clarify` (previne interação com usuário)
  - `MemoryWrite` (previne escrita em memória compartilhada)
  - `send_message` (previne side effects)
  - `CronTool` (previne criação de cron jobs)
  - `execute_code` (segurança)
- **Metadata Tracking**: Registro de toolCalls, iterations, executionTime
- **MAX_ITERATIONS**: Subagentes têm limite de 15 iterações (vs 30 do pai)

### Modos de Execução

**1. Single Task (Sequential)**
```typescript
delegate_task({
  tasks: [{ description: 'Analyze code', context: {...} }]
});
// Executa uma tarefa de cada vez com heartbeat
```

**2. Batch Mode (Parallel)**
```typescript
delegate_task({
  tasks: [
    { description: 'Task 1' },
    { description: 'Task 2' },
    { description: 'Task 3' }
  ],
  maxConcurrent: 3
});
// Executa até 3 tarefas simultaneamente (queue FIFO)
```

### Quando Usar

✅ **Use subagentes para:**
- Analisar múltiplos arquivos simultaneamente
- Executar tarefas independentes que não compartilham estado
- Paralelizar operações longas (builds, testes, análises)
- Isolar operações que podem falhar sem afetar o fluxo principal

❌ **Não use para:**
- Tarefas que requerem interação com o usuário
- Operações que modificam estado compartilhado
- Tarefas que precisam do contexto completo da conversa
- Operações que já são rápidas (< 2s)

### Performance

- **Parallel Speedup**: 3 tasks paralelas = ~3x mais rápido que sequencial
- **Queue Management**: FIFO com active pool (Promise.race para first-complete)
- **Memory Efficiency**: Contexto isolado reduz uso de memória por subagente

### Exemplo Completo

```typescript
// Analisar 5 arquivos em paralelo (3 concurrent)
User: Analise os arquivos A, B, C, D, E em paralelo

Agent: [delegate_task]
🔷 Delegating 5 tasks | Max concurrent: 3

Task 1 (A): ✅ Complete (3.2s, 5 tools, 8 iterations)
Task 2 (B): ✅ Complete (2.8s, 4 tools, 6 iterations)
Task 3 (C): ❌ Error: Timeout (15s)
Task 4 (D): ✅ Complete (4.1s, 6 tools, 9 iterations)
Task 5 (E): ✅ Complete (3.5s, 5 tools, 7 iterations)

📊 Summary:
- Total time: 7.3s (vs ~18s sequential)
- Success: 4/5 tasks
- Failed: 1 task (timeout)
- Average iterations: 7.5
```

**Ver arquitetura completa em:** `docs/subagents.md`

---

## �💰 Cost Tracking

Monitoramento de custos LLM em tempo real:

- Rastreamento por conversa
- Estimativas de tokens
- Alertas de custo
- Relatórios detalhados

---

## 🔒 Segurança

### Autenticação

- **Whitelist Telegram**: Apenas IDs autorizados
- **Variáveis de ambiente**: Credenciais em `.env`
- **Scan de secrets**: `npm run secrets:scan`

### Auditoria

- Logs detalhados de operações
- Registro de todas as chamadas de ferramentas
- Trace de execução

### Comandos de Segurança

```bash
npm run secrets:scan       # Scan de secrets no código
npm run security:audit       # Auditoria de segurança VPS
npm run security:test        # Testes de segurança
```

---

## 🧪 Testes

```bash
# Executar todos os testes
npm test

# Testes unitários
npm run test:unit

# Testes E2E
npm run test:e2e

# Watch mode
npm run test:watch

# Validação completa (lint + build + test)
npm run validate
```

---

## � Error Recovery System

Sistema inteligente de recuperação de erros que permite ao usuário retomar tarefas interrompidas diretamente no Telegram.

### Visão Geral

Quando o agente atinge limites operacionais ou encontra erros inesperados, o sistema de recuperação:
1. **Salva o contexto completo** da tarefa interrompida
2. **Apresenta botões inline** no Telegram ([Continue] [Cancelar])
3. **Permite retomar** a tarefa exatamente de onde parou
4. **Limita tentativas** (máximo 3 retries em 24 horas)
5. **Limpa automaticamente** tarefas expiradas

### Tipos de Erro Recuperáveis

| Tipo | Descrição | Quando Ocorre |
|------|-----------|---------------|
| `MAX_ITERATIONS` | Limite de 10 iterações atingido | Tarefas muito complexas |
| `UNEXPECTED_ERROR` | Erro genérico inesperado | Exceções não tratadas |
| `TOOL_ERROR` | Falha na execução de ferramenta | Timeout, permissão negada, etc |

### Arquitetura

```typescript
interface InterruptedTask {
  taskId: string;              // UUID único
  userId: string;              // ID Telegram
  chatId: number;              // Chat Telegram
  conversationId: string;      // ID da conversa
  errorType: ErrorType;        // Tipo do erro
  errorMessage: string;        // Mensagem descritiva
  conversationHistory: any[];  // Histórico completo
  attemptedAction?: string;    // Última ação tentada
  retryCount: number;          // Contador de tentativas
  maxRetries: number;          // Limite (padrão: 3)
  createdAt: number;           // Timestamp criação
  expiresAt: number;           // Timestamp expiração (24h)
  metadata?: Record<string, any>; // Dados extras
}
```

### Componentes

#### 1. ErrorRecoveryManager

Gerenciador singleton que controla todo o ciclo de vida das tarefas interrompidas.

**Responsabilidades:**
- Salvar estado de tarefas interrompidas
- Validar possibilidade de retry
- Restaurar contexto completo
- Limpar tarefas expiradas

**Métodos:**
```typescript
class ErrorRecoveryManager {
  saveInterruptedTask(task: Omit<InterruptedTask, 'taskId' | 'retryCount' | 'createdAt' | 'expiresAt'>): string
  getTask(taskId: string): InterruptedTask | undefined
  canRetry(taskId: string): boolean
  restoreTask(taskId: string): InterruptedTask
  cancelTask(taskId: string): void
  cleanupExpiredTasks(): number
  getStats(): RecoveryStats
}
```

#### 2. Custom Error Classes

Erros especializados que carregam contexto completo:

```typescript
// Base class
class RecoverableError extends Error {
  conversationHistory: any[];
  errorType: ErrorType;
  attemptedAction?: string;
}

// Erro de limite de iterações
class MaxIterationsError extends RecoverableError {
  constructor(maxIterations: number, attemptedTools: string[], history: any[])
}
```

#### 3. Telegram Handler Integration

Interface inline no Telegram para controle do usuário:

```typescript
// Em telegram-output-handler.ts
async sendRecoverableError(
  ctx: any,
  error: RecoverableError,
  taskId: string,
  errorType: ErrorType,
  attemptedAction?: string
): Promise<void>
```

**Interface do Telegram:**
```
⚠️ Erro Recuperável: MAX_ITERATIONS

🔄 Limite de 10 iterações atingido.

Última ação: Análise de logs
Tentativas restantes: 3/3

Você pode continuar de onde parou:

[Continue ▶️] [Cancelar ❌]
```

#### 4. Callback Query Handler

Sistema de callbacks para botões inline:

```typescript
// Em index.ts
bot.on('callback_query:data', async (ctx) => {
  const data = ctx.callbackQuery.data;
  
  if (data.startsWith('continue_')) {
    await handleContinueTask(ctx, taskId);
  } else if (data.startsWith('cancel_')) {
    await handleCancelTask(ctx, taskId);
  }
});
```

### Fluxo de Recuperação

```
┌─────────────────┐
│  Tarefa Normal  │
└────────┬────────┘
         │
         ▼
  ┌──────────────┐
  │ Erro Ocorre  │
  └──────┬───────┘
         │
         ▼
┌────────────────────┐
│ ErrorRecoveryMgr   │
│ .saveInterrupted() │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Telegram Handler   │
│ .sendRecoverable() │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ Usuário vê botões  │
│ [Continue][Cancel] │
└────────┬───────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────────┐ ┌─────────┐
│Continue │ │ Cancel  │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│ Restore │ │ Delete  │
│ Context │ │  Task   │
└────┬────┘ └────┬────┘
     │           │
     ▼           ▼
┌─────────┐ ┌─────────┐
│  Retry  │ │  Done   │
│  Task   │ │         │
└─────────┘ └─────────┘
```

### Persistência

**Arquivo**: `data/recovery/interrupted-tasks.json`

```json
{
  "tasks": [
    {
      "taskId": "abc-123-xyz",
      "userId": "123456789",
      "chatId": 123456789,
      "conversationId": "conv_abc",
      "errorType": "MAX_ITERATIONS",
      "errorMessage": "Limite de 10 iterações atingido",
      "conversationHistory": [...],
      "attemptedAction": "Análise de logs",
      "retryCount": 1,
      "maxRetries": 3,
      "createdAt": 1713820800000,
      "expiresAt": 1713907200000,
      "metadata": {
        "errorStack": "..."
      }
    }
  ]
}
```

### Limites e Regras

- **Max Retries**: 3 tentativas por tarefa
- **Expiration**: 24 horas (86400000ms)
- **Cleanup**: Automático a cada 1 hora
- **Storage**: JSON file-based (sincronizado)

### Comandos de Diagnóstico

```bash
# Mapear erros nos logs
npm run errors:map

# Limpar tarefas expiradas manualmente
npm run errors:cleanup

# Exemplo de saída do errors:map
📊 Error Log Analysis Report
Generated: 2026-04-22T18:30:00.000Z

🔍 Analyzed Files: 5 log files

📈 Error Summary:
- MAX_ITERATIONS: 3 occurrences
- JSON_PARSE_ERROR: 2 occurrences
- FILE_NOT_FOUND: 1 occurrence

🚨 Critical Errors (severity: high):
- [MAX_ITERATIONS] agent-loop.ts:217 (3x)
  → Limite de iterações atingido
  
⚠️ Warnings (severity: medium):
- [JSON_PARSE_ERROR] memory-extractor.ts:45 (2x)
  → Erro ao parsear JSON do LLM
```

### Melhorias Recentes (v2.0.0)

#### MemoryExtractor - Parsing Robusto
**Problema**: LLM retornava JSON com markdown (` ```json ... ``` `).

**Solução**:
```typescript
// Antes: Falhava com markdown
JSON.parse(response)

// Depois: Remove markdown automaticamente
const cleanJson = response
  .replace(/```(?:json)?\s*/g, '')
  .replace(/```\s*$/g, '')
  .trim();
```

#### AgentController - Callback Query Fix
**Problema**: Processamento duplicado no catch causava erro com `callback_query`.

**Solução**:
```typescript
// Antes: Reprocessava mensagem (ERRO!)
const input = await this.inputHandler.processMessage(ctx);

// Depois: Extrai diretamente do contexto
const userId = ctx.from?.id.toString();
const chatId = ctx.chat?.id;
```

### Integração com Agent Loop

O Agent Loop agora lança exceções recuperáveis em vez de retornar strings de erro:

```typescript
// Antes (agent-loop.ts)
return `⚠️ Max iterations (${maxIterations}) reached`;

// Depois
throw new MaxIterationsError(
  maxIterations,
  attemptedTools,
  conversationHistory
);
```

Essas exceções são capturadas no `AgentController`:

```typescript
try {
  response = await this.agentLoop.start(...);
} catch (error) {
  if (error instanceof MaxIterationsError) {
    // Salvar e enviar botão de recovery
  } else if (error instanceof RecoverableError) {
    // Salvar e enviar botão genérico
  } else {
    // Erro não recuperável
  }
}
```

### Exemplo de Uso

**Cenário**: Tarefa complexa atinge 10 iterações

```
User: Analise todos os logs, containers Docker, 
      processos, uso de memória e gere relatório completo

Agent: [Executando...]
       🔄 Iteration 1/10...
       🔄 Iteration 2/10...
       ...
       🔄 Iteration 10/10...
       
       ⚠️ Erro Recuperável: MAX_ITERATIONS
       
       🔄 Limite de 10 iterações atingido.
       
       Última ação: Gerando relatório consolidado
       Tentativas restantes: 3/3
       
       Você pode continuar de onde parou:
       
       [Continue ▶️] [Cancelar ❌]

User: [Clica em Continue ▶️]

Agent: ✅ Retomando tarefa...
       🔄 Contexto restaurado (10 mensagens)
       
       [Continua execução...]
       🔄 Iteration 11/10 (retry 1)...
       ✅ Relatório completo gerado!
```

**Ver documentação completa em:** 
- `docs/error-recovery-system.md`
- `ERROR-RECOVERY-IMPLEMENTATION.md`

---

## �🚀 Desenvolvimento

### Scripts Úteis

```bash
# Desenvolvimento com hot-reload
npm run dev

# Build para produção
npm run build

# Lint e fix
npm run lint
npm run lint:fix

# Iniciar produção
npm start
```

### Debug API

O GueClaw expõe uma API de debug em `http://localhost:3001`:

- `GET /health` - Status do agente
- `GET /stats` - Estatísticas de uso
- `GET /conversations` - Lista de conversas
- `POST /simulate` - Simular mensagem

---

## 📋 Convenções de Código

### TypeScript

- **Strict mode**: Habilitado
- **Tipagem explícita**: Sempre tipar retornos
- **Interfaces**: Usar `interface` para objetos públicos
- **Types**: Usar `type` para unions/aliases

### Nomenclatura

```typescript
// Classes: PascalCase
class AgentLoop { }
class CommandRegistry { }

// Interfaces: PascalCase com prefixo I (opcional)
interface ILLMProvider { }
interface CommandContext { }

// Tipos: PascalCase
type Command = LocalCommand | PromptCommand | ToolCommand;

// Funções: camelCase
async function executeCommand(): Promise<void> { }

// Constantes: UPPER_SNAKE_CASE (quando globais)
const MAX_ITERATIONS = 25;

// Variáveis: camelCase
const toolRegistry = new ToolRegistry();
```

### Estrutura de Arquivos

```typescript
// 1. Imports externos
import { Grammy } from 'grammy';

// 2. Imports internos (absolutos)
import { ToolRegistry } from '../../tools/tool-registry';

// 3. Imports relativos
import { Utils } from './utils';

// 4. Declarações
const DEBUG = process.env.DEBUG === 'true';

// 5. Interfaces/Types
interface Config { }

// 6. Implementação
export class Service { }
```

### Comentários

```typescript
// ❌ Evitar: comentários óbvios
const x = 1; // Define x como 1

// ✅ Preferir: explicar o PORQUÊ
// Retry logic needed because provider sometimes returns truncated responses
const maxRetries = 3;

// ✅ Documentar APIs públicas
/**
 * Execute the agent loop with the given input
 * @param input - User input text
 * @param options - Execution options
 * @returns Final response from the agent
 */
async function runAgentLoop(input: string, options?: LoopOptions): Promise<string> { }
```

---

## 📚 Recursos Adicionais

### Documentação Externa

- `README.md` - Documentação principal
- `QUICKSTART.md` - Guia rápido de instalação
- `CHECKLIST-DVACE-REFACTOR.md` - Progresso da refatoração DVACE
- `DVACE-SOLUTION-ANALYSIS.md` - Análise técnica da arquitetura
- `docs/cron-scheduler.md` - Documentação do scheduler

### Especificações

- `specs/agent-loop.md` - Especificação do Agent Loop
- `specs/telegram-input.md` - Handler de input Telegram
- `specs/telegram-output.md` - Handler de output Telegram
- `specs/memory.md` - Sistema de memória
- `specs/architecture.md` - Arquitetura geral

---

## 🐛 Troubleshooting

### Problemas Comuns

**Erro: "Provider not found"**
- Verifique `PROVIDER` no `.env`
- Opções válidas: `github-copilot`, `deepseek`, `deepseek-reasoner`

**Erro: "Telegram bot not responding"**
- Verifique `TELEGRAM_BOT_TOKEN`
- Certifique-se de que o bot foi iniciado com `/start`

**Erro: "Database locked"**
- SQLite em modo WAL pode ter locks
- Verifique processos concorrentes em `data/`

**Erro: "Tool execution failed"**
- Verifique permissões do usuário
- Consulte logs em `logs/`

### Logs

Logs são armazenados em `logs/` com rotação automática:
- `combined.log` - Todos os logs
- `error.log` - Apenas erros

---

## 📝 Changelog

### v2.0.0 (Abril 2026)

- ✅ Arquitetura DVACE implementada
- ✅ Sistema de comandos estruturados (Local/Prompt/Tool)
- ✅ Agent Loop refatorado com estado explícito
- ✅ Skills com hot-reload
- ✅ Cron scheduler
- ✅ Cost tracking
- ✅ MCP integration
- ✅ **Error Recovery System**: Sistema inteligente de recuperação de tarefas
  - ErrorRecoveryManager com persistência JSON
  - Custom error classes (RecoverableError, MaxIterationsError)
  - Botões inline no Telegram ([Continue] [Cancelar])
  - Limite de 3 retries por tarefa em 24 horas
  - Script de análise de logs (npm run errors:map)
- ✅ **MemoryExtractor**: Parsing robusto de JSON com markdown
- ✅ **AgentController**: Fix em callback_query para evitar processamento duplicado

---

## 🤝 Contribuição

Veja `CONTRIBUTING.md` para guidelines de contribuição.

---

## 📄 Licença

MIT License - veja `LICENSE` para detalhes.

---

> **Nota**: Esta documentação é mantida atualizada com o estado atual do projeto. Para informações sobre funcionalidades específicas, consulte os arquivos em `docs/` e `specs/`.
