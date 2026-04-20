# 🔑 Reautenticação Google Calendar - OAuth Client Deletado

## ❌ Problema
```
Error 401: deleted_client
The OAuth client was deleted.
```

As credenciais OAuth do Google Cloud Console foram deletadas. Precisamos criar novas.

---

## ✅ Solução: Criar Novas Credenciais OAuth

### 1️⃣ Acessar Google Cloud Console

1. Abra: https://console.cloud.google.com/
2. Faça login com **juniormoises335@gmail.com**
3. Selecione ou crie um projeto (ex: "GueClaw Calendar Integration")

### 2️⃣ Habilitar Google Calendar API

1. No menu lateral: **APIs & Services** → **Library**
2. Procure por: **Google Calendar API**
3. Clique em **ENABLE** (Ativar)

### 3️⃣ Criar OAuth 2.0 Credentials

1. No menu lateral: **APIs & Services** → **Credentials**
2. Clique em **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Se aparecer aviso sobre "OAuth consent screen":
   - Clique em **CONFIGURE CONSENT SCREEN**
   - Escolha **External** (uso externo)
   - Preencha:
     - **App name**: GueClaw Calendar Bot
     - **User support email**: juniormoises335@gmail.com
     - **Developer contact**: juniormoises335@gmail.com
   - Clique **SAVE AND CONTINUE**
   - Em **Scopes**, clique **ADD OR REMOVE SCOPES**:
     - Selecione: `https://www.googleapis.com/auth/calendar`
     - Selecione: `https://www.googleapis.com/auth/calendar.events`
   - Clique **SAVE AND CONTINUE**
   - Em **Test users**, adicione: **juniormoises335@gmail.com**
   - Clique **SAVE AND CONTINUE** → **BACK TO DASHBOARD**

4. Agora volte para **Credentials** e crie:
   - **Application type**: **Web application**
   - **Name**: GueClaw Personal Calendar
   - **Authorized redirect URIs**:
     - `http://localhost:3000/oauth/callback`
     - `http://localhost:8080/oauth/callback`
   - Clique **CREATE**

5. **Copie as credenciais**:
   - **Client ID**: `835900290757-xxxxx.apps.googleusercontent.com`
   - **Client secret**: `GOCSPX-xxxxxxxx`

### 4️⃣ Atualizar o .env

Abra o arquivo `.env` e atualize:

```env
# Pessoal (juniormoises335@gmail.com)
GOOGLE_PERSONAL_CLIENT_ID=COLE_AQUI_O_CLIENT_ID
GOOGLE_PERSONAL_CLIENT_SECRET=COLE_AQUI_O_CLIENT_SECRET
GOOGLE_PERSONAL_REDIRECT_URI=http://localhost:3000/oauth/callback
# Deixe o REFRESH_TOKEN vazio por enquanto (será gerado no próximo passo)
GOOGLE_PERSONAL_REFRESH_TOKEN=
GOOGLE_PERSONAL_CALENDAR_ID=146f387bf76f79cf488344d20b92a8c21927c1c38db0b01bdab8402e86e1de20@group.calendar.google.com
```

### 5️⃣ Gerar Novo Refresh Token

Execute no terminal:

```powershell
cd "d:\Clientes de BI\projeto GueguelClaw"
npm run build
node dist/tools/google-calendar-auth.js personal
```

Isso vai:
1. Abrir uma URL no navegador
2. Fazer login com **juniormoises335@gmail.com**
3. Autorizar o app (pode aparecer "Google hasn't verified this app" - clique **Continue**)
4. Copiar o código de autorização
5. Colar no terminal
6. ✅ Gerar o refresh token e atualizar automaticamente o `.env`

---

## 🔄 Se precisar fazer o mesmo para a conta profissional

Repita os passos acima, mas:
- Use **contato@kyrius.info** como Test User
- Crie outro OAuth Client chamado "GueClaw Work Calendar"
- Atualize as variáveis `GOOGLE_WORK_*` no `.env`
- Execute: `node dist/tools/google-calendar-auth.js work`

---

## ✅ Validação Final

Teste se está funcionando:

```powershell
# Listar calendários
node dist/tools/list-calendars.js personal

# Listar eventos de hoje
node dist/tools/test-calendar.js personal
```

Se listar os calendários e eventos, está tudo OK! 🎉
