# 🤖 GueClaw Agent - VPS Edition

**GueClaw** é um agente de IA pessoal projetado para operar completamente em uma VPS, com controle total do ambiente via Telegram. Alimentado por múltiplos LLMs (GitHub Copilot/OpenAI, DeepSeek, etc.), ele gerencia Docker, executa comandos, processa arquivos multimodais e pode criar suas próprias skills.

---

## ✨ Características Principais

### 🧠 **Multi-LLM Support**
- **GitHub Copilot / OpenAI**: GPT-4o, GPT-4 Turbo para tarefas gerais (recomendado)
- **DeepSeek Fast**: Raciocínio rápido para tarefas gerais alternativo
- **DeepSeek Reasoner**: Raciocínio estendido para programação e tarefas complexas
- Seleção flexível de provedor via configuração

### 🛠️ **Controle Total da VPS**
- Execução de comandos shell com acesso total
- Gerenciamento completo de Docker (containers, images, compose)
- Operações de arquivo (ler, escrever, criar, deletar)
- Requisições HTTP para integração com APIs externas

### 📚 **Sistema de Skills Modular**
- Hot-reload de skills sem reiniciar o agente
- Skill de **self-improvement**: o agente pode criar suas próprias skills
- Sistema de roteamento inteligente para escolher a skill apropriada

### 🎛️ **Multimodal Input/Output**
- ✅ **Input**: PDF, CSV, imagens, áudio/voz, texto
- ✅ **Output**: Texto (chunked), arquivos Markdown, imagens, áudio
- Processamento automático de anexos do Telegram

### 💾 **Memória Persistente**
- SQLite local com suporte a WAL (Write-Ahead Logging)
- Histórico de conversas com janela de contexto configurável
- Cleanup automático de conversas antigas

### � **Context Files** (Novo!)
- Sistema de contexto pessoal injetado automaticamente em cada conversa
- Elimina a necessidade de repetir informações sobre você, preferências e projetos
- Arquivos `.gueclaw/context.md` e `.gueclaw/projects/*.md` carregados silenciosamente
- Gerenciamento via comando `/context [show|create|reload]`
- Suporte a múltiplos projetos com contextos específicos
### 👥 **Subagentes Paralelos** (Novo!)
- Sistema de delegação de tarefas para execução paralela
- Contexto isolado: cada subagente tem seu próprio histórico
- Restricted toolsets: ferramentas bloqueadas para segurança (delegate, clarify, memory_write, etc)
- Timeout e error isolation: falha em uma tarefa não afeta outras
- Max concurrent: 3-5 tarefas simultâneas com queue FIFO
- Performance: ~3x mais rápido que execução sequencial
- Use cases: análise de múltiplos arquivos, operações independentes, paralelização de builds/testes
### �🔒 **Segurança**
- Whitelist estrita baseada em IDs do Telegram
- Variáveis de ambiente para credenciais VPS
- Logs detalhados de todas as operações

---

## 📋 Pré-requisitos

### VPS Requirements
- **OS**: Ubuntu 20.04+ / Debian 11+ (recomendado)
- **RAM**: Mínimo 2GB (recomendado 4GB+)
- **Disk**: 10GB+ livres
- **Node.js**: v20.0.0+
- **Docker**: Instalado e rodando (opcional mas recomendado)

### Serviços Externos
- **Telegram Bot Token**: Crie um bot via [@BotFather](https://t.me/BotFather)
- **LLM API Key**: Escolha uma das opções:
  - **OpenAI API**: [platform.openai.com](https://platform.openai.com) (recomendado)
  - **GitHub Models**: Token GitHub com Copilot subscription
  - **DeepSeek API**: [platform.deepseek.com](https://platform.deepseek.com)

> 💡 **Configurar GitHub Copilot?** Veja o guia detalhado em [GITHUB-COPILOT-SETUP.md](GITHUB-COPILOT-SETUP.md)

---

## 🚀 Instalação

### 1. Clone o Repositório

```bash
cd /opt  # ou diretório de sua escolha
git clone https://github.com/seu-usuario/gueclaw-agent.git
cd gueclaw-agent
```

### 2. Instale Dependências

```bash
# Certifique-se de que o Node.js 20+ está instalado
node --version

# Instale as dependências
npm install
```

### 3. Configure Variáveis de Ambiente

```bash
cp .env.example .env
nano .env  # ou use vim/editor de sua preferência
```

Preencha as variáveis essenciais:

```env
# Telegram
TELEGRAM_BOT_TOKEN=123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321

# LLM Provider (escolha uma das opções)
# Opção 1: GitHub Copilot / OpenAI (recomendado)
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o
DEFAULT_PROVIDER=github-copilot

# Opção 2: DeepSeek (alternativo)
# DEEPSEEK_API_KEY=sk-xxxxxxxxxxxxx
# DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
# DEEPSEEK_MODEL_FAST=deepseek-chat
# DEEPSEEK_MODEL_REASONING=deepseek-reasoner
# DEFAULT_PROVIDER=deepseek

# Agent Configuration
MAX_ITERATIONS=5
MEMORY_WINDOW_SIZE=10

# VPS Configuration (para o agente acessar a própria VPS)
VPS_HOST=localhost
VPS_PORT=22
VPS_USER=root
VPS_SSH_KEY_PATH=/root/.ssh/id_rsa
```

### 4. Crie Diretórios Necessários

```bash
mkdir -p data tmp logs .agents/skills
```

### 5. Compile o TypeScript

```bash
npm run build
```

### 6. Teste a Instalação

```bash
npm run dev
```

Você deve ver:

```
✅ Environment variables validated
✅ Database connected at ./data/gueclaw.db
📊 Database schema initialized
✅ DeepSeek providers initialized (fast + reasoner)
🔧 Registered tools...
✅ Registered 4 tools
📚 Loading skills...
✅ Loaded 2 skills

╔══════════════════════════════════════════════════╗
║        🤖 GueClaw Agent - VPS Edition           ║
║        Powered by DeepSeek & Telegram           ║
╚══════════════════════════════════════════════════╝

🚀 Starting GueClaw Agent...
📡 Telegram polling started
✅ Bot is running! Send a message to get started.
```

---

## 🎯 Uso

### Comandos do Bot

No Telegram, use os seguintes comandos:

- `/start` - Mensagem de boas-vindas
- `/help` - Mostrar ajuda
- `/stats` - Ver estatísticas do agente (skills carregadas)
- `/reload` - Recarregar skills (hot-reload)
- `/context [show|create|reload]` - Gerenciar arquivos de contexto pessoal
- `/cost [today|week|month]` - Ver custos de uso do LLM
- `/tasks` - Listar tarefas ativas

### Exemplos de Uso

#### 1. **Gerenciamento do Sistema**

```
📱 Você: Mostre o uso de disco da VPS

🤖 GueClaw: [Executa: df -h]
Filesystem      Size  Used Avail Use% Mounted on
/dev/vda1        80G   45G   32G  59% /
...
```

#### 2. **Docker Management**

```
📱 Você: Liste todos os containers Docker

🤖 GueClaw: [Executa: docker ps -a]
CONTAINER ID   IMAGE          STATUS         NAMES
abc123...      nginx:latest   Up 2 days      web-server
def456...      postgres:14    Up 5 days      database
```

#### 3. **Criação de Skills**

```
📱 Você: Crie uma skill para fazer backup do PostgreSQL

🤖 GueClaw: [Usa skill: self-improvement]
✅ Skill 'postgres-backup' criada com sucesso!

Localização: .agents/skills/postgres-backup/SKILL.md

Para usar: "Faça um backup do banco de dados postgres"
```

#### 4. **Processamento de Arquivos**

```
📱 Você: [Envia um PDF]
         Resuma este documento

🤖 GueClaw: [Processa o PDF]
Aqui está um resumo do documento:
- Contém 15 páginas sobre...
- Principais tópicos: ...
```

#### 5. **APIs Externas**

```
📱 Você: Faça uma requisição GET para https://api.github.com/repos/torvalds/linux

🤖 GueClaw: [Executa: api_request]
{
  "name": "linux",
  "full_name": "torvalds/linux",
  "stargazers_count": 150000,
  ...
}
```

---
## 📁 Context Files

O GueClaw agora suporta **Context Files** — arquivos de contexto pessoal que são automaticamente injetados em cada conversa, eliminando a necessidade de repetir informações sobre você, seus projetos e preferências.

### Como Funciona

1. **Crie o contexto inicial:**
   ```bash
   # No Telegram
   /context create
   ```

2. **Edite o arquivo `.gueclaw/context.md`** com suas informações:
   ```markdown
   # GueClaw Context File
   
   ## 👤 Who Am I
   - **Nome:** Moisés
   - **Fuso Horário:** America/Sao_Paulo
   - **Idioma Preferido:** pt-BR
   
   ## ⚙️ My Preferences
   - Sempre gerar testes para código novo
   - Usar TypeScript strict mode
   - Seguir Clean Architecture
   
   ## 🚀 Active Projects
   ### GueClaw Agent
   - Tech Stack: Node.js, TypeScript, Telegram Bot API
   - Status: Production
   ```

3. **O contexto é carregado automaticamente** na próxima conversa!

### Comandos Disponíveis

- `/context show` - Ver arquivos de contexto carregados
- `/context create` - Criar template de contexto padrão
- `/context reload` - Forçar recarregamento do cache

### Estrutura de Arquivos

```
.gueclaw/
├── context.md          # Contexto principal (sempre carregado)
├── preferences.md      # Preferências opcionais
├── projects/           # Contextos específicos por projeto
│   ├── project-a.md
│   └── project-b.md
└── README.md          # Documentação
```

### Priorização

Os arquivos são carregados nesta ordem:
1. `.gueclaw/context.md` (principal)
2. `.gueclaw/preferences.md` (se existir)
3. `.gueclaw/projects/*.md` (todos os arquivos)

### Segurança

⚠️ **IMPORTANTE:** 
- A pasta `.gueclaw/` está no `.gitignore` por padrão
- **NUNCA** commite estes arquivos (contêm dados pessoais)
- Não inclua secrets — use variáveis de ambiente

---

## ⏰ Cron Scheduler

O GueClaw agora suporta **agendamento de tarefas automatizadas** que executam prompts em horários específicos, intervalos regulares ou datas únicas.

### Características

- ✅ **4 Formatos de Schedule:** Intervalos simples (`30m`, `2h`), cron expressions (`0 7 * * *`), ISO timestamps, execuções únicas
- ✅ **Execução via AgentLoop:** Jobs têm acesso a todas as ferramentas e contexto
- ✅ **3 Modos de Entrega:** Telegram, arquivo local, ou silencioso
- ✅ **Gerenciamento Completo:** Criar, listar, pausar, retomar, deletar, executar manualmente
- ✅ **Histórico de Execuções:** Saída, duração, tokens usados, ferramentas chamadas

### Comandos Disponíveis

```bash
# Listar todos os jobs
/cron list

# Ver status do scheduler
/cron status

# Deletar um job
/cron delete <job-id>

# Pausar/retomar um job
/cron pause <job-id>
/cron resume <job-id>

# Executar manualmente
/cron trigger <job-id>

# Ajuda
/cron help
```

### Exemplos de Uso

#### 1. Agenda Diária (Via LLM)

```
📱 Você: Crie um job chamado 'Agenda Diária' que todo dia às 7h me envie um resumo dos eventos do Google Calendar

🤖 GueClaw: [Usa cron_manager tool]
✅ Job criado com sucesso!

📋 Agenda Diária
⏰ Schedule: 0 7 * * * (At 7:00 AM every day)
📤 Delivery: telegram
🆔 ID: abc-123-def

Próxima execução: amanhã às 7:00
```

#### 2. Backup Diário

```
📱 Você: Crie um job de backup diário às 2h que execute o backup do banco de dados, mas não me envie mensagem

🤖 GueClaw: ✅ Job de backup criado!
O backup será executado às 2h silenciosamente.
Output será salvo em data/cron/output/
```

#### 3. Relatório Semanal

```
📱 Você: Toda segunda às 9h me envie um relatório com estatísticas dos últimos 7 dias

🤖 GueClaw: ✅ Job 'Relatório Semanal' criado!
Próxima execução: segunda-feira 09:00
```

### Formatos de Schedule

| Formato | Exemplo | Descrição |
|---------|---------|-----------|
| **Intervalo** | `30m`, `2h`, `1d` | A cada X minutos/horas/dias |
| **Cron** | `0 7 * * *` | Todo dia às 7h |
| **ISO** | `2026-04-17T14:00` | Execução única no horário especificado |
| **Once** | `once 30m` | Daqui a 30 minutos (desabilita após executar) |

### Documentação Completa

Para documentação detalhada sobre API, troubleshooting e exemplos avançados, consulte:

📚 **[docs/cron-scheduler.md](docs/cron-scheduler.md)**

---
## �️ Arquitetura DVACE

**GueClaw** implementa a arquitetura **DVACE** (inspired by Claude Desktop's `dvace` codebase), garantindo execução real de ferramentas e rastreamento preciso de tarefas.

### 🎯 Problema Resolvido

**Antes (Falso-Positivo):**
```
❌ LLM: "Vou fazer X, Y e Z"
   → Mas não chama ferramentas
   → Sistema marca sucesso SEM execução real
```

**Depois (DVACE):**
```
✅ Query Loop: finish_reason='tool_calls'
   → BLOQUEIA resposta até executar tools
   → Valida tool_executions > 0
   → Marca sucesso APENAS com evidência real
```

### 🧩 Componentes Principais

#### 1. **Command System** 
Sistema de comandos estruturados que separa execução imediata de prompts para o LLM.

- **LocalCommand**: Execução direta sem LLM (ex: `/status`, `/version`)
- **PromptCommand**: Instrui o LLM com ferramentas específicas (ex: `/review`, `/commit`)
- **AllowedTools Patterns**: Restringe ferramentas por comando
  - Exact match: `FileRead`, `Bash`
  - Wildcards: `Bash(git *)`, `FileWrite(*)`
  - Negation: `!Bash(rm *)`, `!SSHExec(*)`

**Exemplo:**
```typescript
// PromptCommand com restrições de segurança
{
  name: '/review',
  allowedTools: ['FileRead(*)', 'grep_search', '!SSHExec(*)'],
  systemPrompt: 'Faça code review sem alterar nada'
}
```

#### 2. **Query Loop com Estados Validados**

ReAct Pattern com **validação de estados terminais**:

```
START → THINKING → TOOL_USE → THINKING → SUCCESS
         ↓                ↓
      MAX_ITER         ERROR
```

**Regras Críticas:**
- ✅ `finish_reason='tool_calls'` → CONTINUA loop (executa tools)
- ✅ `finish_reason='stop'` → TERMINA loop
- ❌ NUNCA termina em estado `TOOL_USE` sem executar

#### 3. **Tool Orchestration**

Execução inteligente de ferramentas:

- **Concurrent**: Read-only tools executam em paralelo (FileRead, grep_search)
- **Serial**: Write tools executam sequencialmente (FileWrite, Bash, SSHExec)
- **Zero Skipping**: `executions.length === toolCalls.length` (SEMPRE)

**Benefícios:**
- ⚡ 3x mais rápido em leitura de múltiplos arquivos
- 🔒 Seguro para operações de escrita (sem race conditions)

#### 4. **Task Tracking com Estados Terminais**

Sistema de rastreamento multi-fase com **estados imutáveis**:

```typescript
interface Task {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';
  phases: Phase[];
}

interface Phase {
  id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'killed';
  tool_executions: number;  // ← VALIDAÇÃO CRÍTICA
  type: 'planning' | 'execution' | 'validation';
}
```

**Regras de Validação:**
- ✅ Phase com `tool_executions > 0` → Pode marcar `completed`
- ❌ Phase com `tool_executions = 0` → BLOQUEIA `completed`
- ✅ Planning phases → Podem completar sem tools
- 🔒 Estados terminais (`completed`/`failed`/`killed`) → **IMUTÁVEIS**

#### 5. **Tool Permissions**

Controle granular de ferramentas por comando:

```typescript
// /review permite apenas leitura e análise
allowedTools: [
  'FileRead(*)',
  'grep_search',
  'semantic_search',
  '!FileWrite(*)',   // Negação: bloqueia escrita
  '!Bash(*)',        // Negação: bloqueia bash
  '!SSHExec(*)'      // Negação: bloqueia SSH
]

// /commit permite apenas git
allowedTools: [
  'Bash(git *)',     // Apenas comandos git
  '!Bash(rm *)',     // Bloqueia comandos destrutivos
  '!Bash(sudo *)'
]
```

#### 6. **In-Memory State Manager**

Substituiu SQLite por **estado em memória** (performance + simplicidade):

```typescript
class StateManager {
  private state: {
    tasks: Map<string, Task>;
    sessions: Map<string, ConversationSession>;
    counters: { taskCount: number };
  }
  
  // Task CRUD
  setTask(task: Task): void
  getTask(id: string): Task | undefined
  updateTask(id: string, updates: Partial<Task>): void
  
  // Test isolation
  reset(): void  // Limpa state para testes
}
```

**Vantagens:**
- ⚡ 10x mais rápido (sem I/O de disco)
- 🧪 Testes isolados (resetStateForTests())
- 🐛 Zero bugs de database (UPDATE, transactions)

### 📊 Cobertura de Testes

**121+ testes DVACE validando a arquitetura:**

- Phase 1: Command System (16 testes)
- Phase 2: Query Loop Validation (15 testes)
- Phase 3: Tool Orchestration (39 testes)
- Phase 4: Task System (14 testes)
- Phase 5: Tool Permissions (27 testes)
- Phase 6: False-Positive Prevention (10 testes)

**Teste Crítico (False-Positive Prevention):**
```typescript
test('NUNCA reporta sucesso sem execução real', async () => {
  // LLM promete "fazer X, Y, Z" mas não chama tools
  const result = await agentLoop.run('FASE 1: X, FASE 2: Y, FASE 3: Z');
  
  const task = taskTracker.getTask(taskId);
  
  // VALIDAÇÕES:
  expect(task.status).not.toBe('completed');  // Não marca sucesso
  expect(task.phases[0].tool_executions).toBe(0);  // Sem execuções
  expect(result).not.toContain('✅');  // Sem confirmação falsa
});
```

### 🔍 Documentação Técnica

Para detalhes completos da implementação:

- [CHECKLIST-DVACE-REFACTOR.md](CHECKLIST-DVACE-REFACTOR.md) - Checklist completo das 7 fases
- [DVACE-SOLUTION-ANALYSIS.md](DVACE-SOLUTION-ANALYSIS.md) - Análise do problema original
- [docs/architecture/command-system.md](docs/architecture/command-system.md) - Command System detalhado

---

## �🏗️ Estrutura do Projeto

```
gueclaw-agent/
├── .agents/
│   └── skills/               # Skills modulares
│       ├── self-improvement/ # Skill para criar skills
│       └── vps-manager/      # Gerenciamento VPS/Docker
├── data/
│   └── gueclaw.db           # SQLite database
├── logs/                     # Logs do sistema
├── tmp/                      # Arquivos temporários
├── src/
│   ├── core/
│   │   ├── agent-loop/       # ReAct Pattern
│   │   ├── memory/           # SQLite repositories
│   │   ├── providers/        # LLM providers (DeepSeek)
│   │   ├── skills/           # Sistema de skills
│   │   └── agent-controller.ts
│   ├── handlers/
│   │   ├── telegram-input-handler.ts
│   │   └── telegram-output-handler.ts
│   ├── tools/
│   │   ├── base-tool.ts
│   │   ├── tool-registry.ts
│   │   ├── vps-command-tool.ts
│   │   ├── docker-tool.ts
│   │   ├── file-operations-tool.ts
│   │   └── api-request-tool.ts
│   ├── types/
│   │   └── index.ts
│   └── index.ts             # Entry point
├── .env                      # Environment variables
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🔧 Desenvolvimento

### Adicionar Nova Tool

1. Crie arquivo em `src/tools/`:

```typescript
import { BaseTool } from './base-tool';
import { ToolDefinition } from '../core/providers/base-provider';
import { ToolResult } from '../types';

export class MyCustomTool extends BaseTool {
  public readonly name = 'my_custom_tool';
  public readonly description = 'Description of what it does';

  public getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      parameters: {
        type: 'object',
        properties: {
          param1: {
            type: 'string',
            description: 'Parameter description',
          },
        },
        required: ['param1'],
      },
    };
  }

  public async execute(args: Record<string, any>): Promise<ToolResult> {
    try {
      this.validate(args, ['param1']);
      // Implement logic here
      return this.success('Operation completed');
    } catch (error: any) {
      return this.error(error.message);
    }
  }
}
```

2. Registre em `src/index.ts`:

```typescript
import { MyCustomTool } from './tools/my-custom-tool';

ToolRegistry.registerAll([
  // ...existing tools
  new MyCustomTool(),
]);
```

### Criar Nova Skill

Use o próprio agente:

```
📱 Você: Crie uma skill para [descrição da funcionalidade]
```

Ou manualmente:

1. Crie pasta: `.agents/skills/minha-skill/`
2. Crie `SKILL.md` com frontmatter YAML
3. Use `/reload` para carregar

---

## 🚦 Rodando em Produção

### 1. Usando PM2 (Recomendado)

```bash
# Instale PM2
npm install -g pm2

# Inicie o agente
pm2 start dist/index.js --name gueclaw-agent

# Configure para iniciar no boot
pm2 startup
pm2 save

# Monitorar
pm2 monit

# Logs
pm2 logs gueclaw-agent

# Restart
pm2 restart gueclaw-agent
```

### 2. Como Systemd Service

Crie `/etc/systemd/system/gueclaw.service`:

```ini
[Unit]
Description=GueClaw AI Agent
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/gueclaw-agent
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable gueclaw
sudo systemctl start gueclaw
sudo systemctl status gueclaw

# Logs
journalctl -u gueclaw -f
```

---

## 📊 Monitoramento

### Logs

```bash
# Ver logs em tempo real (PM2)
pm2 logs gueclaw-agent --lines 100

# Ver logs do systemd
journalctl -u gueclaw -f -n 100

# Logs do aplicativo
tail -f logs/gueclaw.log
```

### Estatísticas

Use `/stats` no Telegram para ver:
- Skills carregadas
- Descrição de cada skill

---

## 🔒 Segurança

### Whitelist de Usuários

Apenas usuários em `TELEGRAM_ALLOWED_USER_IDS` podem usar o bot:

```env
TELEGRAM_ALLOWED_USER_IDS=123456789,987654321
```

Para descobrir seu Telegram ID:
1. Envie mensagem para [@userinfobot](https://t.me/userinfobot)
2. Adicione o ID no `.env`
3. Reinicie o agente

### Autenticação do Dashboard ✨ NOVO

O dashboard requer senha para acesso (substituiu a restrição de IP):

```env
# Senha em base64 para acessar o dashboard
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

**Senha padrão:** `GueClaw2026@Secure`

**Como trocar a senha:**
```bash
# Gerar novo hash
node scripts/generate-password-hash.js "MinhaSenhaForte@123"

# Copiar o hash para .env e Vercel
# Redeploy: cd dashboard && vercel --prod
```

**Vantagens sobre IP whitelist:**
- ✅ Acesso de qualquer lugar (celular, trabalho, viagem)
- ✅ Funciona com IP dinâmico e CGNAT
- ✅ Mais seguro com senha forte
- ✅ Auditável (logs de acesso)

> 📖 **Guia completo:** [docs/security/AUTH-MIGRATION.md](docs/security/AUTH-MIGRATION.md)

### Varredura de Segurança Diária ✨ NOVO

Análise automática da VPS todos os dias às 6h da manhã:

**O que é verificado:**
- ✅ Portas abertas e inesperadas
- ✅ Tentativas de invasão (failed logins)
- ✅ Status dos containers Docker
- ✅ Uso de CPU, memória e disco
- ✅ Atualizações de segurança pendentes
- ✅ Status da API GueClaw

**Instalação:**
```powershell
# Windows PowerShell
npm run security:install:test

# Ou manual
.\scripts\install-security-audit.ps1 -TestNow
```

Relatórios são enviados automaticamente via Telegram.

> 📖 **Guia de instalação:** [docs/security/QUICKSTART-SECURITY.md](docs/security/QUICKSTART-SECURITY.md)

### Credenciais VPS

Configure SSH key ao invés de senha:

```bash
# Gere chave SSH (se não tiver)
ssh-keygen -t rsa -b 4096

# Adicione ao .env
VPS_SSH_KEY_PATH=/root/.ssh/id_rsa
```

### Rate Limiting

O handler de output implementa rate limiting automático para evitar bloqueios do Telegram.

---

## ❓ Troubleshooting

### Bot não responde

1. Verifique se está rodando:
   ```bash
   pm2 status gueclaw-agent
   # ou
   systemctl status gueclaw
   ```

2. Verifique logs:
   ```bash
   pm2 logs gueclaw-agent
   ```

3. Verifique variáveis de ambiente:
   ```bash
   cat .env | grep TELEGRAM
   ```

### Erro de API DeepSeek

```
❌ DeepSeek API error: Unauthorized
```

**Solução**: Verifique se `DEEPSEEK_API_KEY` está correto e possui créditos.

### Erro de permissão

```
❌ Error: EACCES: permission denied
```

**Solução**: Execute como root ou adicione sudo nos comandos sensíveis.

### Database locked

```
❌ Error: database is locked
```

**Solução**: Certifique-se de que `ENABLE_WAL=true` no `.env`.

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para adicionar features:

1. Fork o projeto
2. Crie uma branch: `git checkout -b feature/nova-feature`
3. Commit: `git commit -am 'Add: nova feature'`
4. Push: `git push origin feature/nova-feature`
5. Abra um Pull Request

---

## 📝 Licença

MIT License - veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- **DeepSeek** - LLM Provider
- **Grammy** - Telegram Bot Framework
- **better-sqlite3** - SQLite wrapper
- Comunidade Open Source

---

## 📧 Suporte

- 🐛 **Issues**: [GitHub Issues](https://github.com/seu-usuario/gueclaw-agent/issues)
- 💬 **Discussões**: [GitHub Discussions](https://github.com/seu-usuario/gueclaw-agent/discussions)

---

**Desenvolvido com ❤️ para automação VPS inteligente**
