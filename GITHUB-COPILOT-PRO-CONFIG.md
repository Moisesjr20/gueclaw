# 🚀 Configuração GitHub Copilot Pro

Você tem **GitHub Copilot Pro**! Vamos conectar o GueClaw Agent diretamente à sua assinatura usando **OAuth Device Code Flow** (autenticação com código de 8 dígitos).

## 📋 Como Configurar (Método OAuth - Recomendado)

### Passo 1: Configure o .env

O arquivo `.env` já está configurado para usar OAuth:

```env
GITHUB_COPILOT_USE_OAUTH=true
GITHUB_COPILOT_MODEL=claude-sonnet-4.5
```

### Passo 2: Execute a Autenticação

Execute o comando:

```bash
npm run copilot:auth
```

Você verá algo assim:

```
╔══════════════════════════════════════════════════╗
║     🔐 GitHub Copilot Authentication            ║
╚══════════════════════════════════════════════════╝

📱 Acesse: https://github.com/login/device
🔑 Digite o código: ABCD-1234

⏳ Aguardando autenticação...
```

### Passo 3: Autentique no Navegador

1. **Abra a URL** mostrada no terminal: https://github.com/login/device
2. **Digite o código de 8 dígitos** (ex: `ABCD-1234`)
3. **Clique em "Authorize"**
4. **Aguarde a confirmação** no terminal

Quando bem-sucedido, verá:

```
✅ Autenticação bem-sucedida!
🔑 Token salvo em: data/github-token.json
✅ Token do Copilot obtido com sucesso!

╔══════════════════════════════════════════════════╗
║     ✅ Autenticação Concluída!                   ║
╚══════════════════════════════════════════════════╝
```

### Passo 4: Execute o Agente

Agora é só rodar:

```bash
npm run dev
```

Pronto! O GueClaw Agent está usando sua assinatura GitHub Copilot Pro com Claude Sonnet 4.5.

---

## 🎯 Modelos Disponíveis

Com GitHub Copilot Pro via OAuth, você tem acesso a:

- **`claude-sonnet-4.5`** ✅ (configurado) - Mais recente e poderoso
- `claude-3-5-sonnet` - Versão anterior
- `gpt-4o` - OpenAI mais recente
- `gpt-4-turbo` - Alternativa
- `o1-preview` - Para raciocínio complexo
- `claude-3-opus` - Modelo topo de linha
- `claude-3-haiku` - Rápido e eficiente

Para trocar o modelo, edite no `.env`:

```env
GITHUB_COPILOT_MODEL=gpt-4o  # ou outro modelo
```

---

## 🎯 Vantagens do OAuth

✅ **Sem API keys** - Autenticação segura via navegador  
✅ **Incluído no Copilot Pro** - Sem custos adicionais  
✅ **Acesso a todos modelos** - Claude, GPT-4o, O1, etc.  
✅ **Token persistente** - Salvo localmente, não expira facilmente  
✅ **Seguro** - Segue padrão OAuth 2.0 do GitHub  

---

## 🔍 Troubleshooting

### Erro: "GitHub Copilot não autenticado"
✅ Execute: `npm run copilot:auth`
✅ Siga as instruções no terminal

### Erro: "Token expirado"
✅ Delete o token: `rm data/github-token.json`
✅ Re-autentique: `npm run copilot:auth`

### Código não aparece ou expirou
✅ O código expira em ~15 minutos
✅ Execute `npm run copilot:auth` novamente para gerar novo código

### Erro na API do Copilot
✅ Verifique se sua assinatura Copilot Pro está ativa
✅ Acesse: https://github.com/settings/copilot

---

## 💡 Dicas

1. **Primeira vez**: O processo leva ~1 minuto
2. **Token salvo**: Fica em `data/github-token.json` (não commite!)
3. **Re-autenticação**: Só precisa se o token expirar
4. **Segurança**: O arquivo `.gitignore` já ignora `data/`

---

## 📚 Recursos Adicionais

- [GitHub Copilot Documentation](https://docs.github.com/copilot)
- [OAuth Device Flow](https://docs.github.com/developers/apps/building-oauth-apps/authorizing-oauth-apps#device-flow)
- [Available Models](https://github.com/marketplace/models)

---

## ✅ Checklist

- [x] GitHub Copilot Pro ativo
- [ ] Executou: `npm run copilot:auth`
- [ ] Autenticou no navegador
- [ ] Executou: `npm run dev`
- [ ] Testou o bot no Telegram

---

🎊 **Pronto!** Seu GueClaw Agent está conectado ao GitHub Copilot Pro via OAuth!
