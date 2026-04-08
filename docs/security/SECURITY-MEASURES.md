# 🔒 Medidas de Segurança GueClaw

Este documento descreve as medidas de segurança implementadas para proteger o GueClaw Agent e sua infraestrutura.

## 📋 Índice

1. [Restrição de IP no Dashboard](#restrição-de-ip-no-dashboard)
2. [Varredura de Segurança Diária VPS](#varredura-de-segurança-diária-vps)
3. [Como Instalar](#como-instalar)
4. [Manutenção](#manutenção)

---

## 1️⃣ Restrição de IP no Dashboard

### 🎯 Objetivo
Apenas computadores com IPs autorizados podem acessar o dashboard do GueClaw.

### 🔧 Implementação
Um middleware Next.js (`dashboard/src/middleware.ts`) verifica todos os acessos e bloqueia IPs não autorizados com status **403 Forbidden**.

### ⚙️ Configuração

**Arquivo:** `.env` e `dashboard/.env.local`

```env
# IP Whitelist (separado por vírgulas)
ALLOWED_IPS=181.191.169.255

# Suporte para wildcards
ALLOWED_IPS=181.191.169.*          # Permite toda a faixa 181.191.169.0-255
ALLOWED_IPS=181.191.169.255,192.168.1.100  # Múltiplos IPs
```

### 📝 Como Adicionar Novos IPs

1. Descubra seu IP: https://ifconfig.me ou https://meuip.com.br
2. Edite `.env` e `dashboard/.env.local`
3. Adicione o IP em `ALLOWED_IPS` (separado por vírgula)
4. No Vercel, configure a variável de ambiente `ALLOWED_IPS`
5. Faça redeploy do dashboard

### 🧪 Como Testar

```bash
# Acesse o dashboard do seu navegador
# Deve funcionar normalmente

# Para testar bloqueio (use um proxy/VPN com outro IP)
curl https://seu-dashboard.vercel.app
# Deve retornar 403 Forbidden
```

### 🚨 O que acontece quando bloqueado?

```json
{
  "error": "Access Denied",
  "message": "🔒 Acesso não autorizado. Este dashboard está protegido por IP whitelist.",
  "blocked_ip": "123.45.67.89",
  "timestamp": "2026-04-08T10:30:00.000Z"
}
```

---

## 2️⃣ Varredura de Segurança Diária VPS

### 🎯 Objetivo
Monitorar automaticamente a segurança da VPS todos os dias e receber relatórios via Telegram.

### 🔍 O que é verificado?

#### ✅ Análises Realizadas

1. **Portas Abertas**
   - Compara com portas esperadas (22, 80, 443, 3742, 8080)
   - Alerta sobre portas inesperadas

2. **Tentativas de Invasão**
   - Analisa logs de autenticação (`/var/log/auth.log`)
   - Conta tentativas de login falhadas
   - Verifica IPs banidos pelo fail2ban

3. **Containers Docker**
   - Lista todos os containers
   - Alerta sobre containers parados ou mortos

4. **Uso de Recursos**
   - CPU: alerta se > 90%, aviso se > 70%
   - Memória: alerta se > 90%, aviso se > 75%
   - Disco: alerta se > 90%, aviso se > 80%

5. **Atualizações de Segurança**
   - Verifica updates pendentes do sistema
   - Recomenda `apt-get upgrade` se houver

6. **Status do GueClaw**
   - Verifica se o processo está rodando
   - Testa se a API responde em `/health`

### 📊 Exemplo de Relatório

```
🔒 RELATÓRIO DE SEGURANÇA VPS
📅 08/04/2026 06:00:15
🖥️ VPS: 147.93.69.211

⚠️ ALERTAS CRÍTICOS:
  • ⚠️ 42 tentativas de login falhadas detectadas
  • ⚠️ Container gueclaw-agent parado (Exited 1)

⚡ AVISOS:
  • CPU em 78.5% de uso
  • 3 atualizações de segurança pendentes

ℹ️ INFORMAÇÕES:
  • Portas abertas: 5 (22, 80, 443, 3742, 8080)
  • Containers ativos: 2/3
  • Memória: 45.2% de uso (1800MB/4000MB)
  • Disco: 62% de uso
  • API GueClaw respondendo normalmente

🟡 Status: VERIFICAR
```

### ⏰ Agendamento

**Horário:** Todos os dias às **6h da manhã** (horário da VPS)  
**Notificação:** Telegram (usuário configurado em `TELEGRAM_ALLOWED_USER_IDS`)

---

## 3️⃣ Como Instalar

### 📦 Pré-requisitos

1. ✅ SSH configurado com chave privada (`~/.ssh/gueclaw_vps`)
2. ✅ Python 3 instalado na VPS
3. ✅ Dependências Python: `paramiko`, `requests`

### 🚀 Instalação Automática (Recomendado)

Execute no PowerShell do Windows:

```powershell
# Navegar até a pasta do projeto
cd "d:\Clientes de BI\projeto GueguelClaw"

# Instalar e testar imediatamente
.\scripts\install-security-audit.ps1 -TestNow

# Ou apenas instalar (sem teste)
.\scripts\install-security-audit.ps1
```

O script irá:
1. Copiar os arquivos para a VPS
2. Configurar o cron job
3. (Opcional) Executar um teste imediato

### 🔧 Instalação Manual

Se preferir fazer manualmente:

```bash
# 1. Copiar scripts para VPS
scp -i ~/.ssh/gueclaw_vps scripts/security-audit-vps.py root@147.93.69.211:/opt/gueclaw-agent/scripts/
scp -i ~/.ssh/gueclaw_vps scripts/install-security-audit-cron.sh root@147.93.69.211:/opt/gueclaw-agent/scripts/

# 2. Conectar à VPS
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211

# 3. Instalar dependências Python (se necessário)
pip3 install paramiko requests

# 4. Instalar cron job
bash /opt/gueclaw-agent/scripts/install-security-audit-cron.sh

# 5. Testar execução
cd /opt/gueclaw-agent
python3 scripts/security-audit-vps.py
```

### ✅ Verificar Instalação

```bash
# Verificar se o cron job foi criado
ssh root@147.93.69.211 "crontab -l | grep security-audit"

# Deve mostrar:
# 0 6 * * * cd /opt/gueclaw-agent && /usr/bin/python3 /opt/gueclaw-agent/scripts/security-audit-vps.py >> /var/log/gueclaw-security-audit.log 2>&1
```

---

## 4️⃣ Manutenção

### 📊 Ver Logs de Execuções Passadas

```bash
# Últimas 100 linhas
ssh root@147.93.69.211 "tail -100 /var/log/gueclaw-security-audit.log"

# Ver em tempo real (durante execução)
ssh root@147.93.69.211 "tail -f /var/log/gueclaw-security-audit.log"

# Baixar log completo
scp -i ~/.ssh/gueclaw_vps root@147.93.69.211:/var/log/gueclaw-security-audit.log ./security-audit-log.txt
```

### 🧪 Testar Manualmente

```bash
# Da sua máquina Windows (PowerShell)
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"

# Ou conectar e executar
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211
cd /opt/gueclaw-agent
python3 scripts/security-audit-vps.py
```

### ⏰ Modificar Horário do Cron

```bash
# Editar crontab
ssh root@147.93.69.211 "crontab -e"

# Trocar horário (ex: 8h da manhã)
# 0 6 * * *  →  0 8 * * *
```

**Formatos de cron:**
- `0 6 * * *` - 6h da manhã, todos os dias
- `0 */6 * * *` - A cada 6 horas
- `0 6,18 * * *` - 6h e 18h todos os dias
- `0 6 * * 1-5` - 6h da manhã, segunda a sexta

### 🔄 Atualizar Scripts

Sempre que modificar `security-audit-vps.py`:

```powershell
# Reenviar para VPS
scp -i ~/.ssh/gueclaw_vps scripts/security-audit-vps.py root@147.93.69.211:/opt/gueclaw-agent/scripts/

# Testar nova versão
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "cd /opt/gueclaw-agent && python3 scripts/security-audit-vps.py"
```

### ❌ Remover Cron Job (Desinstalar)

```bash
ssh root@147.93.69.211 "crontab -l | grep -v security-audit-vps.py | crontab -"
```

---

## 🆘 Troubleshooting

### Problema: Não recebo relatório no Telegram

**Solução:**
1. Verifique se `TELEGRAM_BOT_TOKEN` e `TELEGRAM_ALLOWED_USER_IDS` estão corretos no `.env` da VPS
2. Teste manualmente: `python3 scripts/security-audit-vps.py`
3. Veja os logs: `tail -50 /var/log/gueclaw-security-audit.log`

### Problema: Cron não executa

**Solução:**
1. Verifique se o cron foi criado: `crontab -l`
2. Veja logs do cron: `grep CRON /var/log/syslog`
3. Teste o script manualmente primeiro
4. Verifique permissões: `chmod +x /opt/gueclaw-agent/scripts/security-audit-vps.py`

### Problema: Dashboard bloqueia meu acesso

**Solução:**
1. Descubra seu IP atual: https://ifconfig.me
2. Verifique se está em `ALLOWED_IPS` no `.env.local` e no Vercel
3. Se mudou de rede, adicione o novo IP
4. Redeploy do dashboard no Vercel

### Problema: Erro de conexão SSH

**Solução:**
1. Verifique se a chave SSH existe: `Test-Path ~/.ssh/gueclaw_vps`
2. Teste conexão manual: `ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211`
3. Verifique permissões da chave: `chmod 600 ~/.ssh/gueclaw_vps` (Linux/Mac)

---

## 📚 Arquivos Relacionados

| Arquivo | Descrição |
|---------|-----------|
| `dashboard/src/middleware.ts` | Middleware de verificação de IP |
| `scripts/security-audit-vps.py` | Script Python de auditoria de segurança |
| `scripts/install-security-audit.ps1` | Instalador PowerShell (Windows) |
| `scripts/install-security-audit-cron.sh` | Instalador Bash (VPS) |
| `.env` | Configurações principais (ALLOWED_IPS) |
| `dashboard/.env.local` | Configurações do dashboard (ALLOWED_IPS) |

---

## 🔐 Boas Práticas

1. ✅ **Nunca commite IPs reais** no Git (use `.env` que já está no `.gitignore`)
2. ✅ **Revise logs semanalmente** para identificar padrões de ataque
3. ✅ **Mantenha o sistema atualizado** quando o relatório indicar updates pendentes
4. ✅ **Use wildcards com cuidado** (ex: `192.168.*.*` é muito permissivo)
5. ✅ **Monitore alertas críticos** imediatamente no Telegram

---

## 📞 Suporte

Para dúvidas ou problemas:
1. Veja os logs: `tail -f /var/log/gueclaw-security-audit.log`
2. Execute teste manual: `python3 scripts/security-audit-vps.py`
3. Verifique este documento para troubleshooting

---

**✅ Configuração concluída!**  
Seu GueClaw agora está protegido com restrição de IP e monitoramento diário de segurança.
