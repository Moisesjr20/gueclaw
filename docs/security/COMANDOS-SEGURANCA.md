# 🛠️ Guia Rápido de Comandos de Segurança

Referência rápida para operações de segurança do GueClaw.

---

## 🔑 SSH e Acesso VPS

### Conectar à VPS
```bash
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211
```

### Testar conexão SSH
```bash
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211 "whoami"
```

### Verificar configuração SSH na VPS
```bash
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211 "grep -E '^(PasswordAuthentication|PubkeyAuthentication)' /etc/ssh/sshd_config"
```

### Regenerar chaves SSH (se comprometidas)
```powershell
# Windows
Remove-Item "C:\Users\kyriu\.ssh\gueclaw_vps*" -Force
ssh-keygen -t ed25519 -f "C:\Users\kyriu\.ssh\gueclaw_vps" -C "gueclaw-vps-$(Get-Date -Format 'yyyy-MM')" -N ""
python scripts\setup-ssh-key-vps.py
python scripts\disable-ssh-password.py
```

---

## 🔥 Firewall (UFW)

### Verificar status
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw status verbose"
```

### Listar regras numeradas
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw status numbered"
```

### Adicionar nova porta
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw allow 8080/tcp comment 'Dashboard'"
```

### Remover regra
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw delete allow 8080/tcp"
```

### Ver logs do firewall
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "tail -n 50 /var/log/ufw.log"
```

### Reconfigurar firewall
```bash
python scripts\setup-firewall-vps.py
```

---

## 📦 Backups

### Criar backup manual (Windows)
```powershell
.\scripts\backup-database.ps1
```

### Criar backup manual (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "/opt/gueclaw-agent/scripts/backup-database.sh"
```

### Listar backups locais
```powershell
Get-ChildItem backups\*.db.aes | Sort-Object LastWriteTime -Descending | Select-Object Name, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}, LastWriteTime | Format-Table -AutoSize
```

### Listar backups na VPS
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ls -lh /opt/backups/gueclaw/"
```

### Restaurar backup (Windows)
```powershell
# Descriptografar
$encFile = "backups\gueclaw_20260331_120000.db.aes"
$encrypted = [System.IO.File]::ReadAllBytes($encFile)
$keyHex = (Get-Content .env | Select-String 'DATABASE_ENCRYPTION_KEY=').ToString().Split('=')[1]
$keyBytes = [System.Convert]::FromHexString($keyHex)

$nonce = $encrypted[0..11]
$tag = $encrypted[12..27]
$ciphertext = $encrypted[28..($encrypted.Length-1)]
$plaintext = New-Object byte[] $ciphertext.Length

$aes = [System.Security.Cryptography.AesGcm]::new($keyBytes)
$aes.Decrypt($nonce, $ciphertext, $tag, $plaintext)
[System.IO.File]::WriteAllBytes("data\gueclaw_restored.db", $plaintext)

Write-Host "✅ Backup restaurado em data\gueclaw_restored.db"
```

### Restaurar backup (Linux)
```bash
# Na VPS
export DATABASE_ENCRYPTION_KEY=$(grep DATABASE_ENCRYPTION_KEY /opt/gueclaw-agent/.env | cut -d= -f2)
gpg --decrypt --batch --passphrase "$DATABASE_ENCRYPTION_KEY" \
    -o /opt/gueclaw-agent/data/gueclaw_restored.db \
    /opt/backups/gueclaw/gueclaw_20260331_120000.db.gpg
```

### Agendar backup automático (Windows - Task Scheduler)
```powershell
$action = New-ScheduledTaskAction `
    -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"D:\Clientes de BI\projeto GueguelClaw\scripts\backup-database.ps1`""

$trigger = New-ScheduledTaskTrigger -Daily -At 3:00AM

Register-ScheduledTask `
    -TaskName "GueClaw-Database-Backup" `
    -Action $action `
    -Trigger $trigger `
    -Description "Backup criptografado diário do banco GueClaw" `
    -RunLevel Highest

# Verificar
Get-ScheduledTask -TaskName "GueClaw-Database-Backup"
```

### Agendar backup automático (Linux - cron)
```bash
# Na VPS
crontab -e
# Adicionar:
0 3 * * * /opt/gueclaw-agent/scripts/backup-database.sh >> /var/log/gueclaw-backup.log 2>&1

# Verificar cron
crontab -l

# Ver logs do backup
tail -f /var/log/gueclaw-backup.log
```

---

## 🔐 Criptografia

### Gerar nova chave de criptografia
```bash
node scripts\generate-db-encryption-key.js
```

### Testar criptografia de campo
```bash
node -e "
const db = require('./src/core/memory/database');
const encrypted = db.DatabaseConnection.encryptField('teste secreto');
console.log('Encrypted:', encrypted.toString('base64'));
const decrypted = db.DatabaseConnection.decryptField(encrypted);
console.log('Decrypted:', decrypted);
"
```

### Rotacionar chave de criptografia (CUIDADO!)
```powershell
# 1. Fazer backup completo de TUDO
.\scripts\backup-database.ps1

# 2. Gerar nova chave
node scripts\generate-db-encryption-key.js
# Anotar a nova chave

# 3. Exportar banco com chave antiga
# ... criar script de migração ...

# 4. Importar banco com chave nova

# 5. Atualizar .env com nova chave

# ⚠️ PROCESSO COMPLEXO - documentar passo a passo antes de executar
```

---

## 🗄️ Banco de Dados

### Verificar integridade do banco
```powershell
sqlite3 data\gueclaw.db "PRAGMA integrity_check;"
```

### Ver tamanho do banco
```powershell
Get-Item data\gueclaw.db | Select-Object Name, @{N='Size(MB)';E={[math]::Round($_.Length/1MB,2)}}
```

### Executar query no banco (COM CUIDADO!)
```powershell
sqlite3 data\gueclaw.db "SELECT COUNT(*) FROM messages;"
```

### Vacuum (otimizar banco)
```powershell
sqlite3 data\gueclaw.db "VACUUM;"
```

---

## 🛡️ Permissões do .env

### Verificar permissões atuais
```powershell
(Get-Acl ".env").Access | Select-Object IdentityReference, FileSystemRights, AccessControlType | Format-Table -AutoSize
```

### Reaplicar permissões restritivas
```powershell
$acl = Get-Acl ".env"
$acl.SetAccessRuleProtection($true, $false)
$acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }

$systemRule = New-Object System.Security.AccessControl.FileSystemAccessRule("NT AUTHORITY\SYSTEM", "FullControl", "Allow")
$acl.SetAccessRule($systemRule)

$userRule = New-Object System.Security.AccessControl.FileSystemAccessRule($env:USERNAME, "FullControl", "Allow")
$acl.SetAccessRule($userRule)

Set-Acl -Path ".env" -AclObject $acl

Write-Host "✅ Permissões atualizadas"
(Get-Acl ".env").Access | Select-Object IdentityReference, FileSystemRights | Format-Table
```

---

## 🔍 Auditoria e Verificação

### Verificar se .env foi commitado no Git
```bash
git log --all --full-history -- .env
# Se retornar algo = PROBLEMA! Rotacionar todas as credenciais
```

### Verificar se *.db foi commitado
```bash
git log --all --full-history -- "*.db"
```

### Listar arquivos Git ignorados
```bash
git check-ignore -v .env data/*.db
```

### Verificar build
```bash
npm run build
```

### Testar conexão com todos os serviços
```powershell
# SSH VPS
ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211 "echo 'SSH OK'"

# Firewall ativo
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw status | grep -q active && echo 'Firewall OK' || echo 'FIREWALL OFF!'"

# Permissões .env
(Get-Acl ".env").Access | Where-Object { $_.IdentityReference -notmatch 'SYSTEM|kyriu' } | Measure-Object | Select-Object -ExpandProperty Count
# Se retornar 0 = OK, se > 0 = PROBLEMA
```

---

## 📊 Monitoramento

### Ver uso de disco (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "df -h"
```

### Ver processos do GueClaw (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "pm2 list"
```

### Ver logs do GueClaw (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "pm2 logs gueclaw-agent --lines 50"
```

### Ver últimas conexões SSH (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "last -n 20"
```

### Ver tentativas de login falhadas (VPS)
```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "grep 'Failed password' /var/log/auth.log | tail -n 20"
```

---

## 🚨 Resposta a Incidentes

### Se suspeitar que .env vazou

1. **Rotacionar TODAS as credenciais imediatamente:**
   - Telegram Bot Token (via @BotFather)
   - Google OAuth Secrets (Google Cloud Console)
   - GitHub PAT (github.com/settings/tokens)
   - UazAPI Token (portal UazAPI)
   - n8n API Key (n8n Settings)
   - VPS Password (provedor VPS)
   - DATABASE_ENCRYPTION_KEY (gerar nova e migrar banco)

2. **Verificar acessos:**
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "last -n 100"
   ```

3. **Fazer backup imediato:**
   ```bash
   .\scripts\backup-database.ps1
   ```

4. **Revisar logs:**
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "pm2 logs gueclaw-agent --lines 1000 > /tmp/audit.log"
   ```

### Se suspeitar de invasão na VPS

1. **Isolar servidor:**
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw default deny outgoing"
   ```

2. **Fazer snapshot/backup:**
   (via painel do provedor VPS)

3. **Analisar processos suspeitos:**
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ps aux | grep -vE 'root|systemd|sshd|pm2|node'"
   ```

4. **Verificar conexões ativas:**
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "netstat -tulpn | grep ESTABLISHED"
   ```

---

## 📖 Referências Rápidas

- **Docs de Segurança:** `docs/security/`
- **Análise Completa:** `docs/security/database-security-analysis.md`
- **Sistema Implementado:** `docs/security/SISTEMA-SEGURANCA-IMPLEMENTADO.md`
- **Visão Geral:** `docs/security/VISAO-GERAL-SEGURANCA.md`

---

**Última atualização:** 31/03/2026
