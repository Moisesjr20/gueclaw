# GitHub Copilot / OpenAI Configuration Guide

Este guia explica como configurar o GitHub Copilot como LLM principal do GueClaw Agent.

## 📋 Opções de Configuração

Você tem **3 opções** para usar modelos GPT com o GueClaw:

---

### ✅ Opção 1: OpenAI API (Recomendado)

**Melhor para:** Quem tem uma chave de API da OpenAI diretamente

**Passos:**

1. Obtenha sua API Key em: https://platform.openai.com/api-keys

2. No arquivo `.env`, configure:

```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
DEFAULT_PROVIDER=github-copilot
```

**Modelos disponíveis:**
- `gpt-4o` - Mais recente e rápido (recomendado)
- `gpt-4-turbo` - Balanceado
- `gpt-4` - Versão original
- `gpt-3.5-turbo` - Mais barato

---

### 🔧 Opção 2: GitHub Models API

**Melhor para:** Quem tem assinatura do GitHub Copilot

**Passos:**

1. Gere um Personal Access Token no GitHub:
   - Acesse: https://github.com/settings/tokens
   - Crie um token com escopo `read:packages` e `repo`

2. No arquivo `.env`, configure:

```env
GITHUB_COPILOT_API_KEY=ghp_xxxxxxxxxxxxxxxxxxxxx
GITHUB_COPILOT_BASE_URL=https://models.github.com/v1
GITHUB_COPILOT_MODEL=gpt-4o
GITHUB_COPILOT_API_TYPE=github
DEFAULT_PROVIDER=github-copilot
```

**Nota:** GitHub Models pode ter limitações de uso gratuitas.

**Modelos disponíveis:**
- `gpt-4o`
- `gpt-4o-mini`
- `gpt-4`
- `o1-preview` (reasoning)
- `o1-mini`

---

### ☁️ Opção 3: Azure OpenAI

**Melhor para:** Empresas que usam Azure

**Passos:**

1. Crie um recurso Azure OpenAI no portal Azure

2. Obtenha sua chave e endpoint

3. No arquivo `.env`, configure:

```env
GITHUB_COPILOT_API_KEY=your_azure_key_here
GITHUB_COPILOT_BASE_URL=https://your-resource.openai.azure.com/openai/deployments/your-deployment-name
GITHUB_COPILOT_MODEL=gpt-4
GITHUB_COPILOT_API_TYPE=azure
DEFAULT_PROVIDER=github-copilot
```

---

## 🚀 Como Testar

Após configurar, teste o agente:

```bash
npm run dev
```

No Telegram, envie uma mensagem para o bot:

```
Olá! Você está usando qual modelo?
```

O bot deve responder confirmando que está usando o modelo configurado.

---

## 🔄 Alternando entre Provedores

Você pode manter múltiplos provedores configurados e alternar entre eles mudando `DEFAULT_PROVIDER`:

```env
# Use GitHub Copilot como padrão
DEFAULT_PROVIDER=github-copilot

# Ou use DeepSeek como fallback
# DEFAULT_PROVIDER=deepseek
```

**Provedores disponíveis:**
- `github-copilot` (também aceita: `copilot`, `openai`, `gpt`)
- `deepseek` (também aceita: `deepseek-fast`)
- `deepseek-reasoner` (também aceita: `reasoner`)

---

## 💰 Custos Estimados

### OpenAI API (Pay-as-you-go)
- **GPT-4o:** ~$2.50 / 1M tokens input, ~$10 / 1M tokens output
- **GPT-4 Turbo:** ~$10 / 1M tokens input, ~$30 / 1M tokens output
- **GPT-3.5 Turbo:** ~$0.50 / 1M tokens input, ~$1.50 / 1M tokens output

### GitHub Models
- Uso gratuito limitado para assinantes do GitHub Copilot
- Rate limits podem ser aplicados

### Azure OpenAI
- Preços variam por região e compromisso
- Consulte: https://azure.microsoft.com/pricing/details/cognitive-services/openai-service/

---

## 🛡️ Segurança

⚠️ **IMPORTANTE:** Nunca commite seu arquivo `.env` com chaves de API expostas!

O arquivo `.gitignore` já está configurado para ignorar `.env`, mas sempre verifique:

```bash
git status
```

Se `.env` aparecer, adicione ao `.gitignore`:

```bash
echo ".env" >> .gitignore
```

---

## 🔍 Troubleshooting

### Erro: "No LLM providers configured"
✅ Verifique se você configurou pelo menos uma das chaves de API no `.env`

### Erro: "Invalid API key"
✅ Verifique se a chave está correta e ativa
✅ Para GitHub: Certifique-se que o token tem os escopos necessários

### Erro: "Rate limit exceeded"
✅ Aguarde alguns minutos e tente novamente
✅ Considere atualizar seu plano na OpenAI

### Modelo não responde como esperado
✅ Experimente aumentar `MAX_ITERATIONS` no `.env`
✅ Ajuste a temperatura (padrão: 0.7) no código se necessário

---

## 📚 Recursos Adicionais

- [OpenAI API Documentation](https://platform.openai.com/docs)
- [GitHub Models Documentation](https://docs.github.com/en/copilot/using-github-copilot/using-github-copilot-code-suggestions-in-your-editor)
- [Azure OpenAI Documentation](https://learn.microsoft.com/azure/ai-services/openai/)

---

## 🎯 Próximos Passos

1. Escolha uma das opções acima
2. Configure suas chaves no arquivo `.env`
3. Execute `npm run dev` para testar
4. Ajuste o modelo conforme necessário

Se tiver dúvidas, consulte a documentação oficial de cada provedor.
