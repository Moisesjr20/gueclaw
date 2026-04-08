# 🔧 Configuração de Variáveis de Ambiente no Vercel

## ⚠️ IMPORTANTE: 3 Variáveis Obrigatórias

O dashboard precisa de **3 variáveis de ambiente** configuradas no Vercel para funcionar:

### 1. `DASHBOARD_PASSWORD_HASH`
**Descrição:** Senha para acessar o dashboard (em base64)  
**Valor:** `R3VlQ2xhdzIwMjZAU2VjdXJl`  
**Senha original:** `GueClaw2026@Secure`

### 2. `GUECLAW_API_URL`
**Descrição:** URL da API do GueClaw na VPS  
**Valor:** `http://147.93.69.211:3742`

### 3. `GUECLAW_API_KEY`
**Descrição:** Chave de autenticação da API  
**Valor:** `gc_dash_21965591_9af67ab57a794db2`

---

## 📋 Passo a Passo (Interface Web)

### 1. Acessar Configurações
```
https://vercel.com/kyrius-projects/gueclaw-ezbslh8o7/settings/environment-variables
```

### 2. Para Cada Variável:

1. **Click em "Add New"** (canto superior direito)

2. **Preencha:**
   - **Key:** (nome da variável)
   - **Value:** (valor da variável)
   - **Environments:** Marque **TODAS**:
     - ✅ Production
     - ✅ Preview
     - ✅ Development

3. **Click em "Save"**

### 3. Repetir para as 3 variáveis:

```env
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
GUECLAW_API_URL=http://147.93.69.211:3742
GUECLAW_API_KEY=gc_dash_21965591_9af67ab57a794db2
```

### 4. Redeploy

Após adicionar as 3 variáveis:

1. Menu superior → **Deployments**
2. No último deployment → **⋮ (3 pontinhos)** → **Redeploy**
3. Confirme **"Redeploy"**

---

## 🖥️ Passo a Passo (CLI)

```bash
cd dashboard

# Adicionar variáveis
vercel env add DASHBOARD_PASSWORD_HASH production
# Cole: R3VlQ2xhdzIwMjZAU2VjdXJl

vercel env add GUECLAW_API_URL production
# Cole: http://147.93.69.211:3742

vercel env add GUECLAW_API_KEY production
# Cole: gc_dash_21965591_9af67ab57a794db2

# Repetir para preview
vercel env add DASHBOARD_PASSWORD_HASH preview
vercel env add GUECLAW_API_URL preview
vercel env add GUECLAW_API_KEY preview

# Deploy
vercel --prod
```

---

## ✅ Verificar Configuração

Após redeploy, acesse:
```
https://gueclaw-ezbslh8o7-kyrius-projects.vercel.app/api/debug/env
```

**Esperado:**
```json
{
  "dashboard_password_configured": true,
  "hash_length": 32
}
```

---

## 🔐 Trocar Senha Padrão (Recomendado)

### 1. Gerar novo hash:
```bash
npm run password:generate "SuaNovaSenhaSegura@2026"
```

### 2. Copiar o hash gerado

### 3. Atualizar no Vercel:
1. Vá em Environment Variables
2. Click em **DASHBOARD_PASSWORD_HASH**
3. Click em **Edit**
4. Cole o novo hash
5. Click em **Save**
6. Redeploy

### 4. Atualizar na VPS:
```bash
ssh root@147.93.69.211
nano /opt/gueclaw-agent/.env
# Atualizar DASHBOARD_PASSWORD_HASH
pm2 restart gueclaw
```

---

## 🐛 Troubleshooting

### Erro 502 ao enviar mensagem no chat

**Causa:** Variáveis `GUECLAW_API_URL` ou `GUECLAW_API_KEY` não configuradas

**Solução:** Configure as 3 variáveis acima e faça redeploy

### Erro "DASHBOARD_PASSWORD_HASH não encontrado"

**Causa:** Variável `DASHBOARD_PASSWORD_HASH` não configurada

**Solução:** Adicione a variável e faça redeploy

### Senha não passa no login

**Causa:** 
1. Variável não configurada no Vercel
2. Hash incorreto
3. Senha digitada errada

**Solução:**
1. Verificar se `DASHBOARD_PASSWORD_HASH` existe no Vercel
2. Verificar se o valor é `R3VlQ2xhdzIwMjZAU2VjdXJl`
3. Testar senha: `GueClaw2026@Secure` (case-sensitive)

---

## 📞 Suporte

Se ainda houver problemas:

1. **Verificar logs do Vercel:**
   - Deployments → Último deployment → "View Function Logs"

2. **Testar API diretamente:**
   ```bash
   curl http://147.93.69.211:3742/api/health
   ```

3. **Verificar variáveis:**
   ```
   https://gueclaw-ezbslh8o7-kyrius-projects.vercel.app/api/debug/env
   ```
