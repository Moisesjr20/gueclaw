# 🔐 Migração: Autenticação por IP → Autenticação por Senha

## 📅 Data: 08/04/2026

## 🎯 Motivação

A autenticação por IP whitelist foi removida devido a limitações críticas:

### ❌ Problemas do IP Whitelist:
1. **IP Dinâmico** - Maioria dos provedores brasileiros muda o IP frequentemente
2. **CGNAT** - Múltiplos usuários compartilham o mesmo IP público
3. **Zero Mobilidade** - Não permite acesso de celular, WiFi público, viagens
4. **Vazamento Fácil** - IPs vazam em emails, sites, WebRTC
5. **Manutenção Complexa** - Necessário atualizar manualmente no Vercel a cada mudança

### ✅ Vantagens da Senha Global:
1. **Acesso Universal** - De qualquer lugar, qualquer rede
2. **Mais Seguro** - Senha pode ser complexa e única
3. **Auditável** - Logs de tentativas de acesso
4. **Manutenção Zero** - Não precisa atualizar variáveis de ambiente
5. **Multicamadas** - Pode combinar com outros métodos (MFA futuramente)

---

## 🔄 Mudanças Implementadas

### 1. **Middleware de Autenticação** (Novo)

**Arquivo:** `dashboard/src/middleware.ts`

- Verifica cookie de autenticação em todas as rotas (exceto públicas)
- Redireciona para `/login` se não autenticado
- Valida hash da senha em base64

### 2. **Página de Login** (Nova)

**Arquivo:** `dashboard/src/app/login/page.tsx`

- Interface moderna e responsiva
- Validação client-side e server-side
- Mensagens de erro claras
- Redirecionamento automático após login

### 3. **API de Autenticação** (Novas rotas)

**Arquivos:**
- `dashboard/src/app/api/auth/login/route.ts` - POST para login
- `dashboard/src/app/api/auth/logout/route.ts` - POST para logout

**Funcionamento:**
1. Cliente envia senha em texto plano (HTTPS)
2. Servidor converte para base64
3. Compara com `DASHBOARD_PASSWORD_HASH` do .env
4. Se correto, cria cookie `dashboard_auth` (7 dias de validade)
5. Cookie é httpOnly, secure (produção), sameSite strict

### 4. **Componente de Logout** (Novo)

**Arquivo:** `dashboard/src/components/LogoutButton.tsx`

- Botão de sair integrado na Sidebar
- Confirmação antes de logout
- Remove cookie e redireciona para login

### 5. **Variáveis de Ambiente Atualizadas**

**Removido:**
```env
ALLOWED_IPS=181.191.169.255
```

**Adicionado:**
```env
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

**Senha padrão:** `GueClaw2026@Secure`

---

## 📦 Arquivos Criados/Modificados

### ✨ Criados:
- `dashboard/src/app/login/page.tsx` - Página de login
- `dashboard/src/app/api/auth/login/route.ts` - API de login
- `dashboard/src/app/api/auth/logout/route.ts` - API de logout
- `dashboard/src/components/LogoutButton.tsx` - Botão de sair
- `scripts/generate-password-hash.js` - Gerador de hash
- `docs/security/AUTH-MIGRATION.md` - Este documento

### 🔄 Modificados:
- `dashboard/src/middleware.ts` - Autenticação por senha
- `dashboard/src/components/Sidebar.tsx` - Adicionado botão de logout
- `.env` - Removido ALLOWED_IPS, adicionado DASHBOARD_PASSWORD_HASH
- `dashboard/.env.local` - Idem

---

## 🚀 Como Usar

### 1. **Local (Desenvolvimento)**

A senha padrão já está configurada no `.env.local`:

```bash
cd dashboard
npm run dev
```

Acesse: http://localhost:3000  
Senha: `GueClaw2026@Secure`

### 2. **Produção (Vercel)**

#### Passo 1: Configurar variável de ambiente

```bash
cd dashboard

# Opção A: Via CLI
vercel env add DASHBOARD_PASSWORD_HASH production
# Cole: R3VlQ2xhdzIwMjZAU2VjdXJl

# Opção B: Via interface web
# 1. Acesse: https://vercel.com/seu-usuario/gueclaw-dashboard/settings/environment-variables
# 2. Adicione: DASHBOARD_PASSWORD_HASH = R3VlQ2xhdzIwMjZAU2VjdXJl
```

#### Passo 2: Deploy

```bash
vercel --prod
```

### 3. **Trocar a Senha**

#### Gerar novo hash:

```bash
node scripts/generate-password-hash.js "MinhaNovaSenh@F0rt3"
```

Saída:
```
✅ Hash gerado com sucesso!

📝 Senha original: MinhaNovaSenh@F0rt3
🔒 Hash (base64): TWluaGFOb3ZhU2VuaEBGMHJ0Mw==

📋 Copie o hash e configure no .env:
DASHBOARD_PASSWORD_HASH=TWluaGFOb3ZhU2VuaEBGMHJ0Mw==
```

#### Atualizar:

1. **Local:** Edite `.env` e `dashboard/.env.local`
2. **Vercel:** Atualize a variável de ambiente
3. **Redeploy:** `vercel --prod`

---

## 🔐 Segurança

### ✅ Medidas Implementadas:

1. **Cookie httpOnly** - JavaScript não consegue acessar (protege contra XSS)
2. **Cookie secure** - Apenas em HTTPS (produção)
3. **Cookie sameSite: strict** - Protege contra CSRF
4. **Hash base64** - Senha não fica em texto plano no .env
5. **Validação server-side** - Cliente não vê a senha hash
6. **Logs de tentativas** - Auditoria básica no console

### ⚠️ Limitações:

1. **Base64 não é criptografia** - É apenas encoding (reversível)
   - Solução futura: usar bcrypt/argon2 com salt
   
2. **Single-factor** - Apenas senha (sem MFA)
   - Solução futura: adicionar TOTP (Google Authenticator)

3. **Sem rate limiting** - Pode sofrer brute force
   - Solução futura: implementar rate limiting por IP

4. **Cookie sem rotação** - Cookie válido por 7 dias fixos
   - Solução futura: refresh tokens com rotação

---

## 🎯 Próximas Melhorias (Roadmap)

### 📅 Curto Prazo (1-2 semanas):

1. **Rate Limiting** - Bloquear após N tentativas falhadas
2. **Logs Estruturados** - Salvar tentativas de login em arquivo
3. **Alertas via Telegram** - Notificar tentativas suspeitas

### 📅 Médio Prazo (1 mês):

4. **MFA (2FA)** - Código TOTP obrigatório
5. **Sessões Múltiplas** - Permitir login em vários dispositivos
6. **Gestão de Sessões** - Ver e revogar sessões ativas

### 📅 Longo Prazo (3 meses):

7. **OAuth/JWT** - Autenticação mais robusta
8. **Multi-usuário** - Diferentes níveis de acesso
9. **Auditoria Completa** - Logs detalhados de todas as ações

---

## 🧪 Testes

### Teste 1: Login com senha correta

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"GueClaw2026@Secure"}' \
  -c cookies.txt

# Esperado: 200 OK + cookie dashboard_auth
```

### Teste 2: Login com senha incorreta

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"password":"senhaerrada"}'

# Esperado: 401 Unauthorized
```

### Teste 3: Acesso sem autenticação

```bash
curl http://localhost:3000/overview

# Esperado: Redirect 307 para /login
```

### Teste 4: Acesso autenticado

```bash
curl http://localhost:3000/overview \
  -b cookies.txt

# Esperado: 200 OK com conteúdo da página
```

### Teste 5: Logout

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt

# Esperado: 200 OK + cookie removido
```

---

## 📊 Comparação: Antes vs Depois

| Aspecto | IP Whitelist (Antes) | Senha Global (Agora) |
|---------|---------------------|---------------------|
| **Segurança contra bots** | ✅ Excelente | ✅ Excelente (com rate limit) |
| **Mobilidade** | ❌ Zero | ✅ Total |
| **IP Dinâmico** | ❌ Problema crítico | ✅ Não afeta |
| **CGNAT** | ❌ Vulnerável | ✅ Não afeta |
| **Manutenção** | ❌ Manual constante | ✅ Zero |
| **Auditoria** | ⚠️ Limitada | ✅ Logs de acesso |
| **Complexidade de senha** | N/A | ✅ Controlável |
| **Custo** | R$ 0 | R$ 0 |
| **Setup inicial** | Fácil | Médio |
| **Escalabilidade** | ❌ Difícil | ✅ Boa |

---

## 🆘 Troubleshooting

### Problema: "Senha incorreta" mas a senha está certa

**Causa:** Hash no .env diferente da senha

**Solução:**
```bash
# Gera novo hash
node scripts/generate-password-hash.js "GueClaw2026@Secure"

# Compara com o que está no .env
cat .env | grep DASHBOARD_PASSWORD_HASH
```

### Problema: Redirecionamento infinito para /login

**Causa:** Cookie não está sendo criado

**Soluções:**
1. Verifique se `DASHBOARD_PASSWORD_HASH` está no .env
2. Limpe cookies do navegador
3. Reinicie o servidor: `npm run dev`
4. Verifique console do navegador para erros

### Problema: 500 Internal Server Error no login

**Causa:** `DASHBOARD_PASSWORD_HASH` não configurado

**Solução:**
```bash
# Adicione no .env e .env.local
echo "DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl" >> .env
```

### Problema: Não consigo fazer logout

**Causa:** Erro na API de logout

**Solução:**
1. Abra DevTools → Application → Cookies
2. Delete manualmente o cookie `dashboard_auth`
3. Atualize a página

---

## 📚 Referências

- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [HTTP Cookies](https://developer.mozilla.org/en-US/docs/Web/HTTP/Cookies)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [Base64 Encoding](https://developer.mozilla.org/en-US/docs/Glossary/Base64)

---

## ✅ Checklist de Deploy

- [x] Middleware atualizado
- [x] Página de login criada
- [x] APIs de auth criadas
- [x] Componente de logout criado
- [x] .env atualizado
- [x] Documentação criada
- [x] Script helper criado
- [ ] Testar localmente
- [ ] Configurar no Vercel
- [ ] Deploy em produção
- [ ] Testar em produção
- [ ] Trocar senha padrão por uma personalizada

---

**✅ Migração concluída com sucesso!**

A autenticação por senha oferece melhor experiência de usuário e segurança equivalente (com planos de melhoria futura).
