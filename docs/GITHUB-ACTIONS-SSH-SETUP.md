# Configurar SSH Key no GitHub Actions

## 🔴 PROBLEMA IDENTIFICADO

O workflow `.github/workflows/deploy.yml` estava configurado para usar autenticação por **senha** (`VPS_PASSWORD`), mas desabilitamos a autenticação por senha na VPS por questões de segurança.

**Erro recebido:**
```
Error: can't connect without a private SSH key or password
```

## ✅ SOLUÇÃO IMPLEMENTADA

O workflow foi atualizado para usar **autenticação por chave SSH** (mais seguro).

### Mudanças no Código

Todos os 3 steps do workflow foram atualizados de:
```yaml
password: ${{ secrets.VPS_PASSWORD }}
```

Para:
```yaml
key: ${{ secrets.VPS_SSH_PRIVATE_KEY }}
```

---

## 📝 PASSO A PASSO: Adicionar Secret no GitHub

### 1. Copiar a Chave Privada SSH

A chave privada está em: `C:\Users\kyriu\.ssh\gueclaw_vps`

Abra o arquivo e copie TODO o conteúdo (incluindo as linhas BEGIN e END):

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACAYdLP1ZHLPRZ+TJIIKUvM2vdjhlHjxtEdUVj8c6AT3kQAAAJj7yddE+8nX
RAAAAAtzc2gtZWQyNTUxOQAAACAYdLP1ZHLPRZ+TJIIKUvM2vdjhlHjxtEdUVj8c6AT3kQ
AAAEA/HzVlLM03X4d7YJAPVtJeTO4FnCOHQV/27AAnokQzJhh0s/Vkcs9Fn5MkggpS8za9
2OGUePG0R1RWPxzoBPeRAAAAEGd1ZWNsYXctdnBzLTIwMjYBAgMEBQ==
-----END OPENSSH PRIVATE KEY-----
```

### 2. Acessar Settings do Repositório GitHub

1. Vá em: https://github.com/Moisesjr20/gueclaw
2. Clique em **Settings** (configurações)
3. No menu lateral esquerdo, clique em **Secrets and variables** → **Actions**

### 3. Adicionar o Secret

1. Clique em **New repository secret**
2. Preencha:
   - **Name:** `VPS_SSH_PRIVATE_KEY`
   - **Value:** Cole o conteúdo completo da chave privada (com BEGIN e END)
3. Clique em **Add secret**

### 4. Verificar Outros Secrets Necessários

Certifique-se de que os seguintes secrets também existem no GitHub:

#### Obrigatórios:
- ✅ `VPS_SSH_PRIVATE_KEY` (recém-criado)
- ✅ `TELEGRAM_BOT_TOKEN`
- ✅ `TELEGRAM_ALLOWED_USER_IDS`
- ✅ `TELEGRAM_USER_CHAT_ID`

#### Opcionais (mas recomendados):
- `DEEPSEEK_API_KEY`
- `GEMINI_API_KEY`
- `UAIZAPI_TOKEN`
- `GOOGLE_PERSONAL_CLIENT_ID`
- `GOOGLE_PERSONAL_CLIENT_SECRET`
- `GOOGLE_PERSONAL_REFRESH_TOKEN`
- `GOOGLE_PERSONAL_CALENDAR_ID`
- `GOOGLE_WORK_CLIENT_ID`
- `GOOGLE_WORK_CLIENT_SECRET`
- `GOOGLE_WORK_REFRESH_TOKEN`
- `GOOGLE_WORK_CALENDAR_ID`
- `OBSIDIAN_VAULT_REPO`
- `OBSIDIAN_GITHUB_TOKEN`
- `GITHUB_CLASSIC`
- `N8N_API_URL`
- `N8N_API_KEY`

### 5. Testar o Deploy

Após adicionar o secret, você pode testar de duas formas:

#### Opção A: Push para main (automático)
```bash
git add .
git commit -m "test: verificar deploy"
git push origin main
```

#### Opção B: Disparo manual
1. Vá em **Actions** no GitHub
2. Selecione o workflow **Deploy GueClaw → VPS**
3. Clique em **Run workflow** → **Run workflow**

### 6. Verificar Resultado

Após iniciar, acompanhe em:
- https://github.com/Moisesjr20/gueclaw/actions

Se tudo estiver correto, você verá:
- ✅ Write .env on VPS
- ✅ Run update.sh on VPS
- ✅ Smoke test — PM2 status

---

## 🔐 Segurança

### ⚠️ IMPORTANTE:
- **NUNCA** commite a chave privada no repositório
- A chave privada só deve existir:
  1. Local: `C:\Users\kyriu\.ssh\gueclaw_vps`
  2. VPS: `/root/.ssh/authorized_keys` (chave pública)
  3. GitHub Secrets: (chave privada criptografada)

### Secret VPS_PASSWORD pode ser deletado

Como não usamos mais autenticação por senha, o secret `VPS_PASSWORD` pode ser removido do GitHub (opcional, mas recomendado para evitar confusão).

---

## 🎯 Resultado Esperado

Após configurar o secret, o GitHub Actions será capaz de:

1. **Conectar na VPS via SSH** (seguro, sem senha)
2. **Atualizar o arquivo .env** com todos os secrets
3. **Fazer git pull + build + restart** do bot
4. **Validar** que o bot está online

O deploy será **100% automático** a cada push na branch `main`! 🚀

---

## 📊 Status

- ✅ Workflow atualizado para usar SSH key
- ⏳ Aguardando: Adicionar secret `VPS_SSH_PRIVATE_KEY` no GitHub
- ⏳ Próximo passo: Testar deploy

---

**Criado em:** 31/03/2026  
**Autor:** GueClaw System
