# 🚀 Guia Rápido - Ativação das Medidas de Segurança

Este é um guia passo a passo para ativar as duas medidas de segurança implementadas.

---

## ✅ Checklist de Instalação

### 1️⃣ Restrição de IP no Dashboard

- [x] Middleware criado: `dashboard/src/middleware.ts`
- [x] IP adicionado ao `.env`: `ALLOWED_IPS=181.191.169.255`
- [x] IP adicionado ao `dashboard/.env.local`
- [ ] **AÇÃO NECESSÁRIA:** Configurar no Vercel

#### 🎯 Como Configurar no Vercel

```bash
# Opção 1: Via CLI
cd dashboard
vercel env add ALLOWED_IPS production
# Cole: 181.191.169.255

# Opção 2: Via Interface Web
# 1. Acesse: https://vercel.com/seu-usuario/gueclaw-dashboard/settings/environment-variables
# 2. Adicione: ALLOWED_IPS = 181.191.169.255
# 3. Aplique em: Production

# Redeploy
vercel --prod
```

✅ **Teste:** Acesse o dashboard - deve funcionar normalmente  
❌ **Teste bloqueio:** Use VPN/proxy com outro IP - deve retornar 403

---

### 2️⃣ Varredura de Segurança Diária

- [x] Script criado: `scripts/security-audit-vps.py`
- [x] Instalador criado: `scripts/install-security-audit.ps1`
- [x] Cron installer criado: `scripts/install-security-audit-cron.sh`
- [ ] **AÇÃO NECESSÁRIA:** Instalar dependências Python na VPS
- [ ] **AÇÃO NECESSÁRIA:** Configurar cron job na VPS

#### 🎯 Como Instalar

**Opção A: Instalação Automática (Recomendada)**

```powershell
# No PowerShell do Windows, na pasta do projeto:
cd "d:\Clientes de BI\projeto GueguelClaw"

# Testar configurações primeiro
npm run security:test

# Instalar e testar imediatamente
npm run security:install:test

# OU apenas instalar (sem teste)
npm run security:install
```

**Opção B: Instalação Manual**

```bash
# 1. Conectar à VPS
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211

# 2. Instalar dependências Python
pip3 install paramiko requests

# 3. Sair da VPS
exit

# 4. Do Windows, executar instalador
.\scripts\install-security-audit.ps1 -TestNow
```

---

## 🧪 Como Testar

### Dashboard - Teste de Bloqueio de IP

```bash
# 1. Acesse normalmente (deve funcionar)
https://seu-dashboard.vercel.app

# 2. Teste com outro IP (use VPN ou proxy)
# curl https://seu-dashboard.vercel.app
# Deve retornar 403 Forbidden
```

### Security Audit - Teste Manual

```powershell
# Teste local (verifica configurações)
npm run security:test

# Teste completo (executa na VPS)
npm run security:audit

# Ou via SSH direto
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"
```

**O que esperar:**
- ✅ Relatório completo no terminal
- ✅ Mensagem no Telegram com análise de segurança
- ✅ Sem erros de conexão ou permissão

---

## 📅 Próximas Execuções Automáticas

Após a instalação, o script rodará automaticamente:

**Horário:** 6h da manhã (todos os dias)  
**Notificação:** Telegram  
**Logs:** `/var/log/gueclaw-security-audit.log` na VPS

### Ver Próximas Execuções

```bash
# Ver cron job instalado
ssh root@147.93.69.211 "crontab -l | grep security-audit"

# Deve mostrar:
# 0 6 * * * cd /opt/gueclaw-agent && /usr/bin/python3 /opt/gueclaw-agent/scripts/security-audit-vps.py >> /var/log/gueclaw-security-audit.log 2>&1
```

---

## 📊 Monitoramento

### Ver Logs Históricos

```bash
# Últimas execuções
ssh root@147.93.69.211 "tail -100 /var/log/gueclaw-security-audit.log"

# Baixar para análise local
scp -i ~/.ssh/gueclaw_vps root@147.93.69.211:/var/log/gueclaw-security-audit.log ./security-logs.txt
```

### Verificar Status da VPS

```bash
# Executar scan imediato
npm run security:audit

# Ou usar o instalador com teste
npm run security:install:test
```

---

## ⚠️ Troubleshooting

### Problema: "Module not found: paramiko"

**Solução:**
```bash
ssh root@147.93.69.211 "pip3 install paramiko requests"
```

### Problema: "Permission denied (publickey)"

**Solução:**
```bash
# Verificar se a chave existe
Test-Path ~/.ssh/gueclaw_vps

# Se não existir, criar nova chave
ssh-keygen -t rsa -b 4096 -f ~/.ssh/gueclaw_vps

# Copiar para VPS
ssh-copy-id -i ~/.ssh/gueclaw_vps root@147.93.69.211
```

### Problema: Dashboard não bloqueia outros IPs

**Solução:**
1. Verifique se `ALLOWED_IPS` está configurado no Vercel
2. Redeploy: `cd dashboard && vercel --prod`
3. Limpe cache do navegador
4. Teste com curl ou outro navegador

### Problema: Não recebo notificação no Telegram

**Solução:**
1. Verifique `TELEGRAM_BOT_TOKEN` no `.env`
2. Verifique `TELEGRAM_ALLOWED_USER_IDS` no `.env`
3. Teste manualmente: `npm run security:audit`
4. Veja logs: `ssh root@147.93.69.211 "tail -50 /var/log/gueclaw-security-audit.log"`

---

## 📚 Comandos Úteis

```powershell
# Testar configurações
npm run security:test

# Executar auditoria imediata
npm run security:audit

# Instalar cron job (sem teste)
npm run security:install

# Instalar cron job E testar
npm run security:install:test
```

```bash
# Ver logs na VPS
ssh root@147.93.69.211 "tail -100 /var/log/gueclaw-security-audit.log"

# Ver cron jobs
ssh root@147.93.69.211 "crontab -l"

# Remover cron job (desinstalar)
ssh root@147.93.69.211 "crontab -l | grep -v security-audit | crontab -"
```

---

## ✅ Status da Instalação

Após seguir todos os passos, você deve ter:

- ✅ Dashboard protegido por IP whitelist
- ✅ Varredura de segurança agendada para 6h da manhã
- ✅ Notificações no Telegram funcionando
- ✅ Logs sendo salvos em `/var/log/gueclaw-security-audit.log`

**Próximo passo:** Aguarde o primeiro relatório às 6h da manhã ou execute `npm run security:audit` para testar!

---

## 📖 Documentação Completa

Para informações detalhadas, consulte: [docs/security/SECURITY-MEASURES.md](SECURITY-MEASURES.md)
