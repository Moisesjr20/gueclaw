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

### 🔒 **Segurança**
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

## 🏗️ Estrutura do Projeto

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
