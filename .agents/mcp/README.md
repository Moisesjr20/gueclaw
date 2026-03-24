# MCP Servers — GueClaw Agent

Inventário dos MCP Servers disponíveis para os agentes e skills do GueClaw.

## O que é MCP

Model Context Protocol (MCP) é o padrão que permite ao Copilot/agente invocar tools externas em tempo real — sistemas de arquivos, bancos de dados, APIs, etc. — sem depender de código hardcoded nas skills.

## Estrutura

```
mcp/
  servers/        ← um arquivo .md por server (config + env vars)
  tools/          ← catálogo de tools expostas por cada server
  _template.md    ← template para registrar um novo server
  README.md       ← este arquivo
```

## Servers Ativos

| Server | Pacote | Descrição | Status |
|--------|--------|-----------|--------|
| `n8n-mcp-docs` | `n8n-mcp` | Documentação de 1.084 nodes n8n + 2.709 templates | ✅ Ativo |
| `n8n-mcp-full` | `n8n-mcp` | + gerenciamento de workflows (requer instância n8n) | 💤 Comentado |
| `playwright` | `@playwright/mcp` | Browser automation via accessibility tree (MS oficial) | ✅ Ativo |
| `playwright-ea` | `@executeautomation/playwright-mcp-server` | Browser automation + screenshots + device emulation | ✅ Ativo |
| `memory` | `@modelcontextprotocol/server-memory` | Knowledge graph persistente entre sessões | ✅ Ativo |
| `filesystem` | `@modelcontextprotocol/server-filesystem` | Acesso avançado a arquivos no workspace | ✅ Ativo |
| `github` | `@modelcontextprotocol/server-github` | Gerenciar repos, issues, PRs, branches (token GITHUB_CLASSIC) | ✅ Ativo |
| `brave-search` | `@modelcontextprotocol/server-brave-search` | Busca web via Brave API (requer BRAVE_API_KEY) | 💤 Comentado |
| `tavily` | `tavily-mcp` | Busca web semântica com fontes (requer TAVILY_API_KEY) | 💤 Comentado |
| `postgres` | `@modelcontextprotocol/server-postgres` | Conexão direta com PostgreSQL (requer DATABASE_URL) | 💤 Comentado |
| `gmail` | `gmail-mcp-server` | Ler/enviar emails via OAuth Google (usa GOOGLE_WORK_*) | 💤 Comentado |
| ~~inspector~~ | ~~inspector-apm/mcp-server~~ | ~~APM para PHP~~ | ⛔ Arquivado |

## Importante: MCPs do VS Code ≠ Bot do Telegram

Os servidores MCP configurados aqui são para o **VS Code Copilot** (rodam localmente via stdio).
O **GueClaw bot no VPS** tem um sistema de tools próprio em `src/tools/` e **não tem cliente MCP**.
Para o bot usar MCPs, seria necessário integrar o `@modelcontextprotocol/sdk` no `src/`.

## Como adicionar um server

1. Copie `_template.md` para `servers/<nome-do-server>.md`
2. Preencha os campos: comando, args, env vars necessárias
3. Documente as tools em `tools/<nome-do-server>.md`
4. Adicione a linha na tabela acima
5. Cole o bloco JSON no `.vscode/mcp.json` (ou `settings.json`)

## Referência rápida — bloco de configuração

```json
// .vscode/mcp.json
{
  "servers": {
    "nome-do-server": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-nome"],
      "env": {
        "VAR": "${env:VAR}"
      }
    }
  }
}
```

> **Segurança:** Nunca coloque credenciais diretamente nos arquivos deste diretório. Use sempre referências de variáveis de ambiente (`${env:VAR}`) que apontam para o `.env`.
