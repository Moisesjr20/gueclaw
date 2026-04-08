# 🚀 Deploy - Autenticação por Senha no Dashboard

## 📦 O que foi alterado

### ✅ Arquivos Novos:
- `dashboard/src/middleware.ts` - Autenticação por senha
- `dashboard/src/app/login/page.tsx` - Página de login
- `dashboard/src/app/api/auth/login/route.ts` - API de login
- `dashboard/src/app/api/auth/logout/route.ts` - API de logout
- `dashboard/src/components/LogoutButton.tsx` - Botão de logout
- `scripts/generate-password-hash.js` - Gerador de hash
- `docs/security/*` - Documentação completa

### 🔄 Arquivos Modificados:
- `dashboard/src/components/Sidebar.tsx` - Adicionado botão de logout
- `.env` - Removido ALLOWED_IPS, adicionado DASHBOARD_PASSWORD_HASH
- `dashboard/.env.local` - Idem
- `package.json` - Adicionado script `password:generate`
- `README.md` - Atualizado documentação de segurança

---

## 🔧 PASSO 1: Commit e Push para GitHub

```bash
# Navegar até a pasta do projeto
cd "d:\Clientes de BI\projeto GueguelClaw"

# Adicionar todos os arquivos novos/modificados
git add .

# Commit com mensagem descritiva
git commit -m "feat(security): Migrar autenticação de IP whitelist para senha global

- Remove restrição de IP (problemas com IP dinâmico e CGNAT)
- Implementa autenticação por senha em base64
- Adiciona página de login moderna
- Implementa APIs de login/logout
- Adiciona botão de logout na Sidebar
- Cria gerador de hash de senha
- Atualiza documentação de segurança
- Mantém varredura de segurança diária VPS

BREAKING CHANGE: ALLOWED_IPS removido, usar DASHBOARD_PASSWORD_HASH
Senha padrão: GueClaw2026@Secure"

# Push para GitHub
git push origin main
```

---

## 🖥️ PASSO 2: Deploy na VPS

### 2.1 Conectar à VPS

```bash
# Windows PowerShell
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211
```

### 2.2 Atualizar código do GueClaw (se necessário)

```bash
# Na VPS
cd /opt/gueclaw-agent

# Pull das alterações
git pull origin main

# Reinstalar dependências (se houver mudanças)
npm install

# Rebuild (se necessário)
npm run build

# Reiniciar serviço
pm2 restart gueclaw-agent
# OU
systemctl restart gueclaw
```

### 2.3 Atualizar .env na VPS

#### Opção A: Editar com nano (RECOMENDADO)

```bash
# Abrir .env com nano
nano /opt/gueclaw-agent/.env
```

**Dentro do nano:**

1. **Navegar até a seção de Security** (use setas ou Ctrl+W para buscar)

2. **Remover estas linhas** (se existirem):
   ```env
   # ===== Security Configuration =====
   ALLOWED_IPS=181.191.169.255
   ```

3. **Adicionar estas linhas** (após `FILES_REPOSITORY_PATH`):
   ```env
   # ===== Dashboard Security =====
   # Senha para acessar o dashboard (armazenada em base64)
   # Para gerar novo hash: node -e "console.log(Buffer.from('SUA_SENHA').toString('base64'))"
   # Senha padrão: GueClaw2026@Secure
   DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
   ```

4. **Salvar e sair:**
   - Pressione: `Ctrl + O` (salvar)
   - Pressione: `Enter` (confirmar nome do arquivo)
   - Pressione: `Ctrl + X` (sair)

#### Opção B: Adicionar via echo (Alternativa rápida)

```bash
# Adicionar ao final do .env
echo "" >> /opt/gueclaw-agent/.env
echo "# ===== Dashboard Security =====" >> /opt/gueclaw-agent/.env
echo "# Senha para acessar o dashboard (armazenada em base64)" >> /opt/gueclaw-agent/.env
echo "# Para gerar novo hash: node -e \"console.log(Buffer.from('SUA_SENHA').toString('base64'))\"" >> /opt/gueclaw-agent/.env
echo "# Senha padrão: GueClaw2026@Secure" >> /opt/gueclaw-agent/.env
echo "DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl" >> /opt/gueclaw-agent/.env
```

#### Opção C: Substituir usando sed

```bash
# Remove ALLOWED_IPS (se existir)
sed -i '/^ALLOWED_IPS=/d' /opt/gueclaw-agent/.env

# Adiciona DASHBOARD_PASSWORD_HASH
sed -i '/^FILES_REPOSITORY_PATH=/a\\n# ===== Dashboard Security =====\n# Senha para acessar o dashboard (armazenada em base64)\n# Senha padrão: GueClaw2026@Secure\nDASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl' /opt/gueclaw-agent/.env
```

### 2.4 Verificar se foi adicionado corretamente

```bash
# Ver as últimas linhas do .env
tail -20 /opt/gueclaw-agent/.env

# OU buscar especificamente
grep DASHBOARD_PASSWORD_HASH /opt/gueclaw-agent/.env
```

**Deve mostrar:**
```
DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl
```

---

## 🌐 PASSO 3: Deploy do Dashboard no Vercel

### 3.1 Atualizar código

```bash
# Windows PowerShell (na sua máquina)
cd "d:\Clientes de BI\projeto GueguelClaw\dashboard"
```

### 3.2 Configurar variável de ambiente no Vercel

#### Opção A: Via CLI (Recomendado)

```bash
# Login no Vercel (se necessário)
vercel login

# Adicionar variável de ambiente
vercel env add DASHBOARD_PASSWORD_HASH production
# Quando pedir o valor, cole: R3VlQ2xhdzIwMjZAU2VjdXJl
```

#### Opção B: Via Interface Web

1. Acesse: https://vercel.com/seu-usuario/gueclaw-dashboard/settings/environment-variables
2. Clique em **"Add New"**
3. **Key:** `DASHBOARD_PASSWORD_HASH`
4. **Value:** `R3VlQ2xhdzIwMjZAU2VjdXJl`
5. **Environments:** Marque **Production**
6. Clique em **"Save"**

### 3.3 Deploy

```bash
# Deploy em produção
vercel --prod
```

Aguarde o deploy finalizar. Você verá uma URL como:
```
✅ Production: https://gueclaw-dashboard.vercel.app
```

### 3.4 Testar

Acesse o dashboard e faça login com:
- **Senha:** `GueClaw2026@Secure`

---

## 🔐 PASSO 4: Trocar a Senha Padrão (IMPORTANTE!)

### 4.1 Gerar nova senha

```bash
# Na sua máquina Windows
cd "d:\Clientes de BI\projeto GueguelClaw"

# Gerar hash com SUA senha
npm run password:generate "MinhaSenhaFortePersonalizada@2026"
```

**Copie o hash que aparecer!**

### 4.2 Atualizar na VPS

```bash
# Conectar à VPS
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211

# Editar .env
nano /opt/gueclaw-agent/.env

# Encontrar linha DASHBOARD_PASSWORD_HASH
# Trocar o valor pelo novo hash
# Salvar: Ctrl+O, Enter, Ctrl+X
```

### 4.3 Atualizar no Vercel

```bash
# Na sua máquina
cd dashboard

# Remover variável antiga
vercel env rm DASHBOARD_PASSWORD_HASH production --yes

# Adicionar nova
vercel env add DASHBOARD_PASSWORD_HASH production
# Cole o novo hash

# Redeploy
vercel --prod
```

---

## 📋 Atalhos de Comandos Nano

Enquanto edita o `.env` com nano:

| Comando | Ação |
|---------|------|
| `Ctrl + W` | Buscar texto |
| `Ctrl + K` | Recortar linha |
| `Ctrl + U` | Colar |
| `Ctrl + 6` | Marcar início de seleção |
| `Alt + 6` | Copiar seleção |
| `Ctrl + O` | Salvar (Write Out) |
| `Enter` | Confirmar nome do arquivo |
| `Ctrl + X` | Sair |
| `Ctrl + G` | Ajuda |
| `Alt + \` | Ir para início do arquivo |
| `Alt + /` | Ir para fim do arquivo |

---

## 🧪 PASSO 5: Testes

### Test 1: Dashboard Local

```bash
cd dashboard
npm run dev
```

Acesse: http://localhost:3000  
Senha: `GueClaw2026@Secure` (ou a que você definiu)

### Test 2: Dashboard Produção

Acesse: https://seu-dashboard.vercel.app  
Senha: Sua senha configurada

### Test 3: Varredura de Segurança VPS

```bash
# Executar manualmente
npm run security:audit

# OU via SSH
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211 "cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"
```

Deve enviar relatório no Telegram.

---

## ⚠️ Troubleshooting

### Problema: "DASHBOARD_PASSWORD_HASH não configurado"

**Solução:**
```bash
# Na VPS
echo "DASHBOARD_PASSWORD_HASH=R3VlQ2xhdzIwMjZAU2VjdXJl" >> /opt/gueclaw-agent/.env
```

### Problema: nano não abre ou dá erro

**Solução:**
```bash
# Instalar nano (se não tiver)
apt update
apt install nano

# OU usar vi
vi /opt/gueclaw-agent/.env
# Pressione 'i' para inserir
# Pressione 'Esc' depois ':wq' para salvar e sair
```

### Problema: Git push falhou

**Solução:**
```bash
# Ver status
git status

# Se houver conflitos
git pull --rebase origin main
# Resolver conflitos manualmente
git add .
git rebase --continue
git push origin main
```

### Problema: Vercel deploy falhou

**Solução:**
```bash
# Ver logs
vercel logs

# Tentar novamente
vercel --prod --force
```

---

## 📝 Checklist Final

- [ ] Commit feito no Git
- [ ] Push para GitHub realizado
- [ ] .env atualizado na VPS (DASHBOARD_PASSWORD_HASH adicionado)
- [ ] DASHBOARD_PASSWORD_HASH configurado no Vercel
- [ ] Deploy do dashboard realizado (vercel --prod)
- [ ] Teste de login no dashboard funcionando
- [ ] Senha padrão trocada por uma personalizada
- [ ] Varredura de segurança VPS testada

---

## 🎉 Próximos Passos

1. **Monitore os relatórios de segurança** (chegam às 6h da manhã no Telegram)
2. **Considere adicionar MFA/2FA** (implementação futura)
3. **Revise os logs de acesso** periodicamente
4. **Mantenha a senha segura** (use gerenciador de senhas)

---

**✅ Deploy concluído com sucesso!**
