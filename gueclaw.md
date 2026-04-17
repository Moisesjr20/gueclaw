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
│   │   └── memory-extractor/     # Extração de memórias
│   ├── types/                    # Definições de tipos
│   │   ├── command-types.ts      # Tipos DVACE
│   │   ├── agent-state.ts        # Estado do agente
│   │   └── query-state.ts        # Estado da query
│   └── index.ts                  # Entry point
├── .agents/                      # Skills modulares
│   ├── skills/                   # Skills disponíveis
│   ├── agents/                   # Configuração de agentes
│   └── mcp/                      # MCP servers
├── dashboard/                    # Dashboard web (Vercel)
├── data/                         # SQLite e dados
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

## 💰 Cost Tracking

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

## 🚀 Desenvolvimento

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

---

## 🤝 Contribuição

Veja `CONTRIBUTING.md` para guidelines de contribuição.

---

## 📄 Licença

MIT License - veja `LICENSE` para detalhes.

---

> **Nota**: Esta documentação é mantida atualizada com o estado atual do projeto. Para informações sobre funcionalidades específicas, consulte os arquivos em `docs/` e `specs/`.
