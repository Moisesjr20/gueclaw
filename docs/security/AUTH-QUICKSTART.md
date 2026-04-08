# 🔐 Guia Rápido - Autenticação do Dashboard

## ✅ O que mudou?

**ANTES:** Restrição por IP whitelist  
**AGORA:** Autenticação por senha global

**Por quê?**
- ✅ Acesso de qualquer lugar (celular, WiFi público, viagem)
- ✅ Funciona com IP dinâmico (não precisa atualizar sempre)
- ✅ Não afetado por CGNAT
- ✅ Mais fácil de gerenciar

---

## 🚀 Como usar

### 1️⃣ **Senha Padrão**

**Senha:** `GueClaw2026@Secure`

Já está configurada no `.env` e `dashboard/.env.local`

### 2️⃣ **Login Local (Desenvolvimento)**

```bash
cd dashboard
npm run dev
```

Acesse: http://localhost:3000  
Digite a senha: `GueClaw2026@Secure`

### 3️⃣ **Deploy no Vercel (Produção)**

#### Passo 1: Configurar variável de ambiente

```bash
cd dashboard

# Via CLI
vercel env add DASHBOARD_PASSWORD_HASH production
# Cole: R3VlQ2xhdzIwMjZAU2VjdXJl

# OU via interface web:
# https://vercel.com/seu-usuario/gueclaw-dashboard/settings/environment-variables
# Adicione: DASHBOARD_PASSWORD_HASH = R3VlQ2xhdzIwMjZAU2VjdXJl
```

#### Passo 2: Deploy

```bash
vercel --prod
```

#### Passo 3: Teste

Acesse seu dashboard e faça login com: `GueClaw2026@Secure`

---

## 🔑 Trocar a Senha

### Gerar novo hash:

```bash
# Gera hash da sua senha personalizada
node scripts/generate-password-hash.js "MinhaSenhaForte@2026"
```

**Saída:**
```
✅ Hash gerado com sucesso!

📝 Senha original: MinhaSenhaForte@2026
🔒 Hash (base64): TWluaGFTZW5oYUZvcnRlQDIwMjY=

📋 Copie o hash e configure no .env:
DASHBOARD_PASSWORD_HASH=TWluaGFTZW5oYUZvcnRlQDIwMjY=
```

### Atualizar:

1. **Local:** Edite `.env` e `dashboard/.env.local`
2. **Vercel:** 
   ```bash
   vercel env rm DASHBOARD_PASSWORD_HASH production --yes
   vercel env add DASHBOARD_PASSWORD_HASH production
   # Cole o novo hash
   ```
3. **Redeploy:** `vercel --prod`

---

## 🔒 Dicas de Senha Forte

✅ **Boas senhas:**
- `GueClaw@Sec2026!#Admin`
- `Fl@xHub$2026$ecure`
- `D@shb0ard!2026#VPS`

❌ **Evite:**
- Senhas curtas (< 12 caracteres)
- Apenas letras ou números
- Palavras comuns (admin, password, 123456)
- Dados pessoais (nome, data de nascimento)

**Gerador online:** https://bitwarden.com/password-generator/

---

## 🆘 Troubleshooting

### ❌ Problema: "Senha incorreta" mas está certa

**Solução:**
```bash
# Regenere o hash
node scripts/generate-password-hash.js "GueClaw2026@Secure"

# Compare com o .env
cat .env | grep DASHBOARD_PASSWORD_HASH
```

### ❌ Problema: Redirecionamento infinito

**Soluções:**
1. Limpe cookies do navegador (Ctrl+Shift+Del)
2. Verifique se `DASHBOARD_PASSWORD_HASH` está no `.env`
3. Reinicie o servidor: `npm run dev`

### ❌ Problema: Esqueci a senha

**Solução:**
```bash
# Gere um novo hash com senha nova
node scripts/generate-password-hash.js "NovaSenha@2026"

# Atualize o .env
# Reinicie: npm run dev
```

### ❌ Problema: Cookie não persiste

**Solução:**
1. Verifique se está usando HTTPS em produção
2. Navegação anônima/privada pode bloquear cookies
3. Extensões de privacidade podem interferir

---

## 📊 Comparação: IP vs Senha

| Aspecto | IP Whitelist | Senha Global |
|---------|-------------|--------------|
| **Acesso móvel** | ❌ | ✅ |
| **IP dinâmico** | ❌ | ✅ |
| **CGNAT** | ❌ | ✅ |
| **Manutenção** | Alta | Baixa |
| **Segurança** | Moderada | Alta (com senha forte) |
| **Auditável** | Limitado | Sim |

---

## 📚 Mais Informações

- **Documentação completa:** [AUTH-MIGRATION.md](AUTH-MIGRATION.md)
- **Análise de segurança:** [SECURITY-ANALYSIS.md](SECURITY-ANALYSIS.md)
- **Varredura VPS:** [QUICKSTART-SECURITY.md](QUICKSTART-SECURITY.md)

---

## ✅ Próximos Passos

1. **Teste local:** Acesse http://localhost:3000 e faça login
2. **Deploy Vercel:** Configure a variável de ambiente
3. **Troque a senha:** Use uma senha personalizada forte
4. **Ative MFA (futuro):** Em breve teremos 2FA com TOTP

---

**🎉 Pronto! Seu dashboard agora está protegido por senha.**
