# 🔐 Como Configurar Secrets no GitHub (Interface Web)

## ⚠️ Problema Atual

O GitHub Actions está falhando porque falta configurar o secret `VPS_SSH_PRIVATE_KEY`.

**Link direto para configurar:** https://github.com/Moisesjr20/gueclaw/settings/secrets/actions

---

## 🚀 Solução Rápida (5 minutos)

### Passo 1: Copiar a Chave SSH

Execute no seu terminal local:

```powershell
Get-Content "C:\Users\kyriu\.ssh\gueclaw_vps" | Set-Clipboard
```

Isso copia a chave SSH para o clipboard.

---

### Passo 2: Adicionar Secret no GitHub

1. **Acesse:** https://github.com/Moisesjr20/gueclaw/settings/secrets/actions
2. **Clique:** "New repository secret"
3. **Preencha:**
   - **Name:** `VPS_SSH_PRIVATE_KEY`
   - **Secret:** Cole o conteúdo (Ctrl+V)
4. **Clique:** "Add secret"

✅ **Pronto!** Esse é o único secret OBRIGATÓRIO para o deploy funcionar.

---

### Passo 3: Adicionar Secret do Dashboard (Recomendado)

Repita o processo para:

**Name:** `DASHBOARD_API_KEY`  
**Secret:** `gc_dash_21965591_9af67ab57a794db2`

**Name:** `DATABASE_ENCRYPTION_KEY`  
**Secret:** `ef558e880cfe5ad35af8a571d62625b7639163d01b3ac8e39c1b3669d4d1f5ed`

---

## 🧪 Testar o Deploy

Após configurar os secrets, faça um push vazio para testar:

```bash
git commit --allow-empty -m "test: trigger GitHub Actions"
git push origin main
```

Acompanhe em: https://github.com/Moisesjr20/gueclaw/actions

---

## 📚 Secrets Opcionais

<details>
<summary>Clique para ver lista completa (configure apenas se usar)</summary>

Esses são necessários apenas se você usar as funcionalidades específicas:

### Telegram (já deve estar configurado)
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_USER_IDS`
- `TELEGRAM_USER_CHAT_ID`

### WhatsApp (UazAPI)
- `UAIZAPI_TOKEN`

### LLMs Fallback
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`

### Google Calendar
- `GOOGLE_PERSONAL_CLIENT_ID`
- `GOOGLE_PERSONAL_CLIENT_SECRET`
- `GOOGLE_PERSONAL_REDIRECT_URI`
- `GOOGLE_PERSONAL_REFRESH_TOKEN`
- `GOOGLE_PERSONAL_CALENDAR_ID`
- `GOOGLE_WORK_CLIENT_ID`
- `GOOGLE_WORK_CLIENT_SECRET`
- `GOOGLE_WORK_REDIRECT_URI`
- `GOOGLE_WORK_REFRESH_TOKEN`
- `GOOGLE_WORK_CALENDAR_ID`

### Obsidian Notes
- `OBSIDIAN_VAULT_REPO`
- `OBSIDIAN_GITHUB_TOKEN`
- `GITHUB_CLASSIC`

### n8n Workflows
- `N8N_API_URL`
- `N8N_API_KEY`

</details>

---

## 🔧 Correção Aplicada no Workflow

O arquivo `.github/workflows/deploy.yml` foi atualizado para incluir os novos secrets:
- ✅ `DASHBOARD_API_KEY`
- ✅ `DATABASE_ENCRYPTION_KEY`

Esses secrets agora serão escritos no `.env` da VPS durante o deploy.
