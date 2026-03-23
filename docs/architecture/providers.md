# Guia de LLM Providers

Guia de decisão para escolher e configurar o provider LLM do GueClaw.

## Mapa de Providers Disponíveis

| Provider | Classe | Env vars necessárias | Modelo padrão |
|---|---|---|---|
| **GitHub Copilot OAuth** | `GitHubCopilotOAuthProvider` | `GITHUB_COPILOT_USE_OAUTH=true` | `claude-sonnet-4.5` |
| **GitHub Copilot API Key** | `GitHubCopilotProvider` | `GITHUB_COPILOT_API_KEY` ou `OPENAI_API_KEY` | `gpt-4o` |
| **DeepSeek Fast** | `DeepSeekProvider` | `DEEPSEEK_API_KEY` | `deepseek-chat` |
| **DeepSeek Reasoner** | `DeepSeekReasonerProvider` | `DEEPSEEK_API_KEY` | `deepseek-reasoner` |

## Comparativo

| Critério | Copilot OAuth | Copilot API Key | DeepSeek Fast | DeepSeek Reasoner |
|---|---|---|---|---|
| **Latência** | Média | Média | Baixa | Alta |
| **Custo** | Incluído no Copilot Pro | Por token | Por token (barato) | Por token |
| **Raciocínio** | Excelente (Claude) | Bom (GPT-4o) | Bom | Excelente |
| **Código** | Excelente | Excelente | Bom | Excelente |
| **Routing** | ⚠️ Caro para routing | OK | ✅ Ideal | ❌ Lento |
| **Configuração** | OAuth Device Flow | API Key simples | API Key simples | API Key simples |

## Quando usar cada um

### ✅ Recomendado: Copilot OAuth (`GITHUB_COPILOT_USE_OAUTH=true`)
- Você tem GitHub Copilot Pro ativo
- Quer o melhor modelo sem custo por token
- Modelo `claude-sonnet-4.5` para tarefas complexas

### GitHub Copilot API Key
- Alternativa ao OAuth quando querendo um endpoint OpenAI-compatível
- Pode apontar `GITHUB_COPILOT_BASE_URL` para Azure OpenAI ou GitHub Models API

### DeepSeek Fast — ideal para routing
- O `SkillRouter` usa `getFastProvider()` — se DeepSeek estiver configurado, ele é preferido para classificação
- Mais barato por chamada de routing (temperatura 0.1, max 100 tokens)
- Configure `DEEPSEEK_API_KEY` mesmo que use Copilot como provider principal

### DeepSeek Reasoner
- Para tarefas de programação/matemática que precisam de Chain of Thought longo
- Invocado explicitamente via `ProviderFactory.getProvider('deepseek-reasoner')`

## Prioridade de seleção automática

Quando `getProvider()` é chamado sem argumento, a ordem é:

```
1. github-copilot  (OAuth ou API Key — se configurado)
2. deepseek-fast   (se DEEPSEEK_API_KEY disponível)
3. primeiro provider disponível (qualquer)
```

## Configuração no `.env`

```bash
# ── Opção A: Copilot OAuth (recomendado) ──────────────────────────
GITHUB_COPILOT_USE_OAUTH=true
GITHUB_COPILOT_MODEL=claude-sonnet-4.5   # opcional, este é o padrão

# ── Opção B: Copilot via API Key ──────────────────────────────────
GITHUB_COPILOT_API_KEY=ghp_...
GITHUB_COPILOT_BASE_URL=https://api.githubcopilot.com/chat/completions
GITHUB_COPILOT_MODEL=gpt-4o
GITHUB_COPILOT_API_TYPE=github          # openai | github | azure

# ── DeepSeek (complementar para routing rápido) ───────────────────
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_MODEL_FAST=deepseek-chat
DEEPSEEK_MODEL_REASONING=deepseek-reasoner
```

## Autenticação Copilot OAuth (Device Code Flow)

Se `GITHUB_COPILOT_USE_OAUTH=true` e o token não existir ou expirar:

```bash
# Local
npm run copilot:auth

# VPS
cd /opt/gueclaw-agent
node scripts/auth-copilot-remote.js
# Ou via Telegram: o bot envia o código de dispositivo automaticamente
```

O token é salvo em `./data/github-token.json` e renovado automaticamente.

## Fallback em produção

Se um provider falhar em runtime:
- `getProvider('nome-que-nao-existe')` → avisa no console e retorna o primeiro disponível
- `SkillRouter` com erro de provider → retorna `null` (chat geral), nunca quebra
- Não há cadeia de retry automático — se precisar, configure via `ENABLE_RETRY_ON_FAILURE` (feature pendente)

## ADR relacionado

→ [ADR-0003 a criar] `Escolha do provider LLM principal` — quando a decisão for formalizada
