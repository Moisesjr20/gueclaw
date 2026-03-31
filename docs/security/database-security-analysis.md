# Análise de Segurança do Banco de Dados - GueClaw

**Data da Análise:** 31 de Março de 2026  
**Status:** ⚠️ URGENTE - Vulnerabilidades Críticas Encontradas

---

## 1. Resumo Executivo

### 🔴 Vulnerabilidades Críticas

1. **Credenciais em Texto Plano no `.env`**
   - VPS_PASSWORD exposta diretamente
   - Tokens de API sem criptografia
   - Google Client Secrets em texto plano
   - GitHub PAT e tokens expostos

2. **Ausência de Criptografia do Banco de Dados**
   - SQLite armazenado sem criptografia (`./data/gueclaw.db`)
   - Dados sensíveis em texto plano (conversas, traces, user_id)
   - Sem backup criptografado

3. **Controle de Acesso Insuficiente**
   - VPS acessível via senha SSH (recomendado: chave SSH)
   - Banco de dados acessível localmente sem autenticação
   - Sem rate limiting no acesso ao banco

4. **Exposição no GitHub**
   - ✅ `.env` está no `.gitignore` (BOM)
   - ✅ `*.db` e `*.sqlite` estão no `.gitignore` (BOM)
   - ❌ `.env` ATUAL contém credenciais válidas (se commitado por engano = desastre)

---

## 2. Análise por Camada

### 2.1 Local (Desenvolvimento)

| Item | Status | Descrição |
|------|--------|-----------|
| Arquivo `.env` | 🔴 CRITICO | Contém 15+ credenciais em texto plano |
| Banco SQLite | 🟡 ALERTA | Armazenado sem criptografia em `./data/gueclaw.db` |
| Permissões de arquivo | 🟡 ALERTA | Depende das permissões do SO (Windows = mais permissivo) |
| Backup local | ⚪ N/A | Sem estratégia de backup documentada |
| .gitignore | 🟢 OK | `.env` e `*.db` estão ignorados |

**Riscos:**
- Quem tem acesso físico/RDP ao Windows tem acesso total ao `.env` e ao banco
- Malware local pode exfiltrar credenciais e dados do banco
- `.env` pode ser commitado por engano (acontece frequentemente)

---

### 2.2 VPS (Produção - 147.93.69.211)

| Item | Status | Descrição |
|------|--------|-----------|
| Autenticação SSH | 🟡 ALERTA | Usa senha em vez de chave SSH |
| Firewall | ❓ DESCONHECIDO | Precisa verificar (`ufw status`) |
| Banco SQLite na VPS | 🟡 ALERTA | Provavelmente em `/opt/gueclaw-agent/data/gueclaw.db` sem criptografia |
| Permissões do banco | ❓ DESCONHECIDO | Precisa verificar (`ls -la /opt/gueclaw-agent/data/`) |
| Backup | ❓ DESCONHECIDO | Não há script de backup no repositório |
| Isolamento | 🟡 ALERTA | Container Docker fornece algum isolamento, mas root ainda acessa tudo |
| Logs | 🟡 ALERTA | PM2 logs podem conter dados sensíveis |

**Riscos:**
- Senha VPS no `.env` local = se vazar, atacante tem acesso root total
- Banco na VPS sem criptografia = se VPS for comprometida, dados legíveis imediatamente
- Sem backup = perda catastrófica possível

---

### 2.3 GitHub (https://github.com/...)

| Item | Status | Descrição |
|------|--------|-----------|
| `.env` commitado? | 🟢 PROVAVELMENTE NÃO | `.gitignore` bloqueia |
| `*.db` commitado? | 🟢 NÃO | `.gitignore` bloqueia |
| Histórico do Git | 🟡 ALERTA | Se `.env` foi commitado antes do `.gitignore`, ainda está no histórico |
| Secrets do GitHub Actions | ⚪ N/A | Não há workflows usando secrets ainda |

**Ação Necessária:**
```bash
# Verificar se .env ou *.db já foram commitados alguma vez
git log --all --full-history -- .env
git log --all --full-history -- "*.db"
```

Se houver resultados = **URGENTE: reescrever histórico ou rotacionar todas as credentials**

---

## 3. Dados Sensíveis no Banco

Analisando o schema em `docs/architecture/db-schema.md`:

### Tabela `conversations`
- `user_id` (ID Telegram) = identificador pessoal
- `provider` = qual LLM foi usado
- Timestamps = rastreamento de atividade

### Tabela `messages`
- `content` = **TODO O HISTÓRICO DE CONVERSAS**
  - Pode incluir informações financeiras
  - Dados pessoais (CPF, RG, endereço se mencionados)
  - Senhas se usuário pediu para "salvar" algo
  - Informações de terceiros (clientes, leads)

### Tabela `execution_traces`
- `tool_args` = argumentos passados para ferramentas
  - Pode incluir senhas, tokens temporários
  - Paths de arquivos sensíveis
  - Comandos SSH executados
- `tool_result` = resultados de APIs externas
  - Dados de Google Calendar (compromissos privados)
  - Dados de WhatsApp (números, mensagens)
  - Resposta de n8n workflows

**Conclusão:** O banco contém dados ALTAMENTE SENSÍVEIS que, se vazados:
1. Violam a LGPD (dados pessoais sem proteção adequada)
2. Comprometem segredos de negócios
3. Expõem credenciais de terceiros (Google, n8n, UazAPI, etc.)

---

## 4. Recomendações de Segurança (Prioridade)

### 🔴 URGENTE (Implementar em 24-48h)

#### 4.1 Migrar de Senha SSH para Chave SSH
```bash
# Local (Windows)
ssh-keygen -t ed25519 -f C:\Users\kyriu\.ssh\gueclaw_vps -N ""
ssh-copy-id -i C:\Users\kyriu\.ssh\gueclaw_vps.pub root@147.93.69.211

# Atualizar .env
VPS_SSH_KEY_PATH=C:\Users\kyriu\.ssh\gueclaw_vps
# VPS_PASSWORD=...  (remover)

# Na VPS (após confirmar que chave funciona)
sudo nano /etc/ssh/sshd_config
# Definir: PasswordAuthentication no
sudo systemctl restart sshd
```

#### 4.2 Criptografar o Banco SQLite
Usar **SQLCipher** (substituto drop-in do SQLite com criptografia AES-256):

```bash
npm install better-sqlite3 @types/better-sqlite3 sqlcipher

# Gerar chave de criptografia (256-bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Atualizar `.env`:**
```env
DATABASE_ENCRYPTION_KEY=<256-bit hex key gerado acima>
```

**Modificar `src/core/memory/database.ts`:**
```typescript
import Database from 'better-sqlite3';
import * as crypto from 'crypto';

// Após criar conexão
const encryptionKey = process.env.DATABASE_ENCRYPTION_KEY;
if (encryptionKey) {
  db.pragma(`key = '${encryptionKey}'`);
}
```

**Nota:** Migrar banco existente:
```bash
# Exportar banco atual
sqlite3 data/gueclaw.db .dump > backup.sql

# Criar novo banco criptografado e importar
sqlcipher data/gueclaw_encrypted.db
> PRAGMA key = '<chave>';
> .read backup.sql
> .quit

# Substituir
mv data/gueclaw.db data/gueclaw_inseguro.bak
mv data/gueclaw_encrypted.db data/gueclaw.db
```

#### 4.3 Proteger `.env` com Permissões Restritivas

**Windows (via PowerShell como admin):**
```powershell
# Remover herança e garantir que só o usuário atual tem acesso
$acl = Get-Acl "D:\Clientes de BI\projeto GueguelClaw\.env"
$acl.SetAccessRuleProtection($true, $false)
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    $env:USERNAME, "FullControl", "Allow"
)
$acl.SetAccessRule($rule)
Set-Acl "D:\Clientes de BI\projeto GueguelClaw\.env" $acl
```

**VPS (Linux):**
```bash
chmod 600 /opt/gueclaw-agent/.env
chown gueclaw:gueclaw /opt/gueclaw-agent/.env  # se houver usuário dedicado
```

#### 4.4 Varrer Histórico do Git

```bash
# Verificar se .env foi commitado
git log --all --full-history -- .env

# Se sim, ROTACIONAR TODAS AS CREDENTIALS:
# - Telegram Bot Token (via @BotFather)
# - Google OAuth Secrets (via Google Cloud Console)
# - GitHub PAT (via github.com/settings/tokens)
# - UazAPI Token (via portal UazAPI)
# - n8n API Key (via n8n Settings)
# - VPS Password (via Hetzner/provedor de VPS)

# E reescrever histórico (CUIDADO - quebra clones existentes):
git filter-branch --index-filter "git rm -rf --cached --ignore-unmatch .env" HEAD
git push origin --force --all
```

---

### 🟡 IMPORTANTE (Implementar em 1-2 semanas)

#### 4.5 Implementar Backup Criptografado Automático

**Script `scripts/backup-database.sh`:**
```bash
#!/bin/bash
BACKUP_DIR="/opt/backups/gueclaw"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DB_PATH="/opt/gueclaw-agent/data/gueclaw.db"
BACKUP_FILE="$BACKUP_DIR/gueclaw_$TIMESTAMP.db.gpg"

mkdir -p $BACKUP_DIR

# Backup criptografado com GPG
sqlite3 $DB_PATH ".backup /tmp/gueclaw_backup.db"
gpg --symmetric --cipher-algo AES256 --batch --yes \
    --passphrase "$DATABASE_BACKUP_PASSPHRASE" \
    -o $BACKUP_FILE /tmp/gueclaw_backup.db
rm /tmp/gueclaw_backup.db

# Manter apenas últimos 30 dias
find $BACKUP_DIR -name "gueclaw_*.db.gpg" -mtime +30 -delete

echo "✅ Backup criado: $BACKUP_FILE"
```

**Crontab (VPS):**
```bash
# Backup diário às 3h da manhã
0 3 * * * /opt/gueclaw-agent/scripts/backup-database.sh >> /var/log/gueclaw-backup.log 2>&1
```

#### 4.6 Habilitar Firewall na VPS

```bash
# Instalar e configurar UFW
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (se necessário)
sudo ufw allow 443/tcp   # HTTPS (se necessário)
sudo ufw enable
sudo ufw status verbose
```

#### 4.7 Segregar Dados Financeiros em Tabela Separada

Criar nova tabela `financial_transactions` com criptografia de campo adicional:

```sql
CREATE TABLE financial_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_encrypted BLOB NOT NULL,  -- valor criptografado com AES-GCM
  category TEXT,
  transaction_date INTEGER NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  FOREIGN KEY (user_id) REFERENCES conversations(user_id)
);
```

**Criptografia de campo (AES-GCM):**
```typescript
import * as crypto from 'crypto';

function encryptField(plaintext: string, key: Buffer): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]);
}

function decryptField(ciphertext: Buffer, key: Buffer): string {
  const iv = ciphertext.subarray(0, 12);
  const authTag = ciphertext.subarray(12, 28);
  const encrypted = ciphertext.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

---

### 🟢 BOM TER (Implementar em 1-2 meses)

#### 4.8 Secrets Manager (Hashicorp Vault ou AWS Secrets Manager)

Em vez de `.env`, buscar secrets de um cofre centralizado:

```typescript
// src/config/secrets.ts
import axios from 'axios';

export async function getSecret(name: string): Promise<string> {
  const vault_url = process.env.VAULT_ADDR || 'http://localhost:8200';
  const vault_token = process.env.VAULT_TOKEN;
  
  const response = await axios.get(
    `${vault_url}/v1/secret/data/gueclaw/${name}`,
    { headers: { 'X-Vault-Token': vault_token } }
  );
  
  return response.data.data.data.value;
}

// Uso
const telegramToken = await getSecret('telegram-bot-token');
```

#### 4.9 Auditoria e Alertas

- Criar tabela `audit_log` para registrar acessos sensíveis
- Configurar alertas no Telegram quando:
  - `.env` é modificado
  - Banco de dados é acessado de IP desconhecido
  - Mais de 100 registros são lidos em uma query (possível exfiltração)

#### 4.10 LGPD Compliance

- Implementar `DELETE CASCADE` para "direito ao esquecimento"
- Adicionar campo `retention_policy` (ex: dados de conversa expiram em 90 dias)
- Cron job para limpeza automática:

```sql
-- Deletar conversas com mais de 90 dias
DELETE FROM conversations 
WHERE updated_at < strftime('%s', 'now', '-90 days');
```

---

## 5. Checklist de Validação

- [ ] Verificar se `.env` está no histórico do Git (`git log --all -- .env`)
- [ ] Migrar SSH de senha para chave
- [ ] Criptografar banco SQLite com SQLCipher
- [ ] Configurar permissões 600 no `.env` (local e VPS)
- [ ] Implementar backup criptografado automático
- [ ] Habilitar firewall na VPS
- [ ] Rotacionar todas as credenciais se `.env` vazou
- [ ] Criar tabela `financial_transactions` com criptografia de campo
- [ ] Documentar key rotation policy (trocar chaves a cada 90 dias)
- [ ] Testar restauração de backup

---

## 6. Impacto Estimado por Vulnerabilidade

| Vulnerabilidade | Probabilidade | Impacto | Risco Total | Prioridade |
|-----------------|---------------|---------|-------------|------------|
| `.env` exposto no Git | Baixa (se .gitignore correto) | Crítico | 🔴 ALTO | URGENTE |
| Banco sem criptografia | Média (se VPS comprometida) | Crítico | 🔴 ALTO | URGENTE |
| SSH via senha | Média (brute force) | Crítico | 🔴 ALTO | URGENTE |
| Sem backup | Baixa (mas possível) | Alto | 🟡 MÉDIO | IMPORTANTE |
| Sem firewall | Média (port scan) | Alto | 🟡 MÉDIO | IMPORTANTE |
| Dados não segregados | Baixa | Médio | 🟢 BAIXO | BOM TER |

---

## 7. Próximos Passos

1. **Agora (0-24h):**
   - Verificar histórico Git para `.env`
   - Gerar chave SSH e testar conexão

2. **Esta Semana:**
   - Implementar SQLCipher
   - Configurar backup automático
   - Habilitar firewall

3. **Este Mês:**
   - Criar skill de controle financeiro COM criptografia de campo
   - Documentar disaster recovery plan
   - Revisar logs para detectar acessos suspeitos

---

**Revisado por:** GitHub Copilot (Claude Sonnet 4.5)  
**Próxima Revisão:** 30 de Abril de 2026
