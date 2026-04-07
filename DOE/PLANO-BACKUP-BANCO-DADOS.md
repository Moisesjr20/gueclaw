# 🛡️ PLANO DE BACKUP E ISOLAMENTO DO BANCO DE DADOS

**Criado:** 07/04/2026  
**Status:** 🟡 EM IMPLEMENTAÇÃO  
**Prioridade:** 🔥 CRÍTICA

---

## 📋 ÍNDICE

1. [Análise do Problema Atual](#problema)
2. [Bancos de Dados Identificados](#bancos)
3. [Estratégia de Backup (3-2-1)](#estrategia)
4. [Implementação Técnica](#implementacao)
5. [Plano de Recuperação de Desastres](#recuperacao)
6. [Checklist de Implementação](#checklist)

---

<a name="problema"></a>
## 🚨 1. ANÁLISE DO PROBLEMA ATUAL

### O que Aconteceu?
Durante a correção de diretórios duplicados (`/root/gueclaw/` vs `/opt/gueclaw-agent/`), **perdemos os dados da campanha de leads** do WhatsApp.

### Causa Raiz
```
❌ Bancos de dados armazenados DENTRO do diretório da aplicação
❌ Sem backup automático configurado
❌ Sem separação entre código e dados
❌ Recriação do diretório = perda de dados
```

### Impacto
- ❌ **0 leads** na campanha (eram ~500 escritórios de advocacia)
- ❌ **Histórico de verificação** de WhatsApp perdido
- ❌ **Estatísticas de envio** perdidas
- ⚠️ **Risco:** Próxima atualização pode causar nova perda

---

<a name="bancos"></a>
## 💾 2. BANCOS DE DADOS IDENTIFICADOS

### 2.1 Banco Principal (`gueclaw.db`)

**Localização:** `/opt/gueclaw-agent/data/gueclaw.db`  
**Tamanho:** 132 KB  
**Conteúdo:**
- Conversas (histórico completo)
- Mensagens (entrada/saída)
- Memórias extraídas automaticamente
- Metadados de skills
- Traces de execução

**Criticidade:** 🔥🔥🔥 ALTA

---

### 2.2 Banco de Leads WhatsApp (`leads.db`)

**Localização:** `/opt/gueclaw-agent/.agents/skills/whatsapp-leads-sender/data/leads.db`  
**Tamanho:** 24 KB  
**Conteúdo:**
- Leads importados (nome, telefone, email, cidade, estado)
- Status de verificação WhatsApp
- Histórico de envios
- Timestamps de cada ação

**Criticidade:** 🔥🔥 MÉDIA-ALTA

---

### 2.3 Banco Financeiro (`financas.db`) - CRIPTOGRAFADO

**Localização:** `/opt/gueclaw-agent/.agents/skills/controle-financeiro/data/financas.db`  
**Tamanho:** ~20 KB (estimado)  
**Conteúdo:**
- Transações financeiras pessoais
- Saldos por centro de custo
- Dados sensíveis criptografados com SQLCipher

**Criticidade:** 🔥🔥🔥 ALTA (DADOS SENSÍVEIS)

---

<a name="estrategia"></a>
## 📐 3. ESTRATÉGIA DE BACKUP (REGRA 3-2-1)

### Regra 3-2-1 de Backup
```
3 cópias dos dados (original + 2 backups)
2 mídias diferentes (disco local + externo/nuvem)
1 cópia offsite (fora do servidor)
```

### Aplicação no GueClaw

#### **Camada 1: Volume Docker Persistente** 🐳
```bash
# Separar dados do código usando Docker Volume
/opt/gueclaw-data/           # Volume persistente (SOBREVIVE a rm -rf)
├── databases/
│   ├── gueclaw.db           # Banco principal
│   ├── leads.db             # Leads WhatsApp
│   └── financas.db          # Financeiro (criptografado)
├── backups/                 # Backups locais (últimos 7 dias)
│   ├── daily/
│   └── hourly/
└── exports/                 # Exports manuais
```

#### **Camada 2: Backup Local Automatizado** 💾
```bash
# Cron job a cada 6 horas
/opt/backups/gueclaw/
├── hourly/
│   ├── gueclaw_2026-04-07_06h.db.gz
│   ├── gueclaw_2026-04-07_12h.db.gz
│   └── gueclaw_2026-04-07_18h.db.gz   # Mantém últimas 24h
├── daily/
│   ├── gueclaw_2026-04-01.db.gz
│   ├── gueclaw_2026-04-02.db.gz
│   └── ...                              # Mantém últimos 30 dias
└── monthly/
    ├── gueclaw_2026-03.db.gz           # Mantém últimos 12 meses
    └── gueclaw_2026-04.db.gz
```

#### **Camada 3: Backup Remoto (GitHub LFS)** ☁️
```bash
# Git LFS no repositório privado
gueclaw-backups/              # Repo privado separado
├── databases/
│   ├── gueclaw_latest.db.gpg
│   └── leads_latest.db.gpg
└── snapshots/
    ├── 2026-04-01_snapshot.tar.gz.gpg
    └── 2026-04-07_snapshot.tar.gz.gpg
```

**Criptografia:** GPG com chave pública/privada  
**Frequência:** 1x por dia (3h da manhã)  
**Retenção:** Indefinida (repositório privado)

---

<a name="implementacao"></a>
## 🛠️ 4. IMPLEMENTAÇÃO TÉCNICA

### Fase 1: Separação Imediata (30 min) 🚀 AGORA

#### 1.1 Criar Volume de Dados
```bash
# Na VPS
mkdir -p /opt/gueclaw-data/databases
mkdir -p /opt/gueclaw-data/backups/{hourly,daily,monthly}
mkdir -p /opt/backups/gueclaw/{hourly,daily,monthly}

# Mover bancos existentes
mv /opt/gueclaw-agent/data/*.db /opt/gueclaw-data/databases/
mv /opt/gueclaw-agent/.agents/skills/whatsapp-leads-sender/data/*.db /opt/gueclaw-data/databases/

# Criar symlinks
ln -s /opt/gueclaw-data/databases/gueclaw.db /opt/gueclaw-agent/data/gueclaw.db
ln -s /opt/gueclaw-data/databases/leads.db /opt/gueclaw-agent/.agents/skills/whatsapp-leads-sender/data/leads.db

# Permissões
chown -R root:root /opt/gueclaw-data
chmod 700 /opt/gueclaw-data/databases
chmod 600 /opt/gueclaw-data/databases/*.db
```

#### 1.2 Atualizar .env
```bash
# Adicionar ao .env (local e VPS)
DATABASE_PATH=/opt/gueclaw-data/databases/gueclaw.db
BACKUP_DIR=/opt/gueclaw-data/backups
EXTERNAL_BACKUP_DIR=/opt/backups/gueclaw
```

---

### Fase 2: Backup Automático Local (1h)

#### 2.1 Script de Backup Inteligente
```bash
# /opt/gueclaw-agent/scripts/backup-databases.sh
#!/bin/bash

set -e

DATA_DIR="/opt/gueclaw-data/databases"
BACKUP_DIR="/opt/gueclaw-data/backups"
EXTERNAL_DIR="/opt/backups/gueclaw"
TIMESTAMP=$(date '+%Y-%m-%d_%Hh')
DATE=$(date '+%Y-%m-%d')
MONTH=$(date '+%Y-%m')

# Função de backup
backup_db() {
    local DB_NAME=$1
    local DB_PATH="${DATA_DIR}/${DB_NAME}.db"
    
    if [ ! -f "$DB_PATH" ]; then
        echo "⚠️  Database not found: $DB_PATH"
        return 1
    fi
    
    # Hourly backup (comprimido)
    echo "📦 Backing up $DB_NAME (hourly)..."
    sqlite3 "$DB_PATH" ".backup /tmp/${DB_NAME}_temp.db"
    gzip -c "/tmp/${DB_NAME}_temp.db" > "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz"
    rm "/tmp/${DB_NAME}_temp.db"
    
    # Daily backup (apenas 1x por dia às 3h)
    if [ "$(date '+%H')" = "03" ]; then
        echo "📅 Creating daily backup for $DB_NAME..."
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${BACKUP_DIR}/daily/${DB_NAME}_${DATE}.db.gz"
        cp "${BACKUP_DIR}/hourly/${DB_NAME}_${TIMESTAMP}.db.gz" \
           "${EXTERNAL_DIR}/daily/${DB_NAME}_${DATE}.db.gz"
    fi
    
    # Monthly backup (dia 1 de cada mês)
    if [ "$(date '+%d')" = "01" ] && [ "$(date '+%H')" = "03" ]; then
        echo "📆 Creating monthly backup for $DB_NAME..."
        cp "${BACKUP_DIR}/daily/${DB_NAME}_${DATE}.db.gz" \
           "${BACKUP_DIR}/monthly/${DB_NAME}_${MONTH}.db.gz"
        cp "${BACKUP_DIR}/daily/${DB_NAME}_${DATE}.db.gz" \
           "${EXTERNAL_DIR}/monthly/${DB_NAME}_${MONTH}.db.gz"
    fi
}

# Backup de cada banco
backup_db "gueclaw"
backup_db "leads"
backup_db "financas"

# Limpeza de backups antigos
echo "🧹 Cleaning old backups..."
# Hourly: mantém últimas 24h (4 backups = 1 dia)
find "${BACKUP_DIR}/hourly" -name "*.db.gz" -mtime +1 -delete
# Daily: mantém últimos 30 dias
find "${BACKUP_DIR}/daily" -name "*.db.gz" -mtime +30 -delete
find "${EXTERNAL_DIR}/daily" -name "*.db.gz" -mtime +30 -delete
# Monthly: mantém últimos 12 meses
find "${BACKUP_DIR}/monthly" -name "*.db.gz" -mtime +365 -delete
find "${EXTERNAL_DIR}/monthly" -name "*.db.gz" -mtime +365 -delete

echo "✅ Backup completed: $(date)"
```

#### 2.2 Configurar Cron
```bash
# Crontab -e
# Backup a cada 6 horas
0 */6 * * * /opt/gueclaw-agent/scripts/backup-databases.sh >> /opt/gueclaw-agent/logs/backup.log 2>&1

# Verificação de integridade diária (4h da manhã)
0 4 * * * /opt/gueclaw-agent/scripts/verify-backups.sh >> /opt/gueclaw-agent/logs/backup-verify.log 2>&1
```

---

### Fase 3: Backup Remoto Criptografado (2h)

#### 3.1 Criar Repositório Privado
```bash
# GitHub: criar repo privado "gueclaw-backups"
git clone git@github.com:Moisesjr20/gueclaw-backups.git /opt/gueclaw-backups
cd /opt/gueclaw-backups
git lfs install
git lfs track "*.db.gpg"
git lfs track "*.tar.gz.gpg"
git add .gitattributes
git commit -m "Initialize LFS"
```

#### 3.2 Script de Backup Remoto
```bash
# /opt/gueclaw-agent/scripts/backup-remote.sh
#!/bin/bash

set -e

DATA_DIR="/opt/gueclaw-data/databases"
REMOTE_REPO="/opt/gueclaw-backups"
DATE=$(date '+%Y-%m-%d')
GPG_RECIPIENT="contato@kyrius.info"  # Sua chave GPG

cd "$REMOTE_REPO"

# Backup individual dos DBs
for DB in gueclaw leads financas; do
    DB_PATH="${DATA_DIR}/${DB}.db"
    
    if [ -f "$DB_PATH" ]; then
        echo "🔐 Encrypting and backing up ${DB}.db..."
        gpg --encrypt --recipient "$GPG_RECIPIENT" \
            --output "databases/${DB}_latest.db.gpg" \
            "$DB_PATH"
    fi
done

# Snapshot completo (1x por semana)
if [ "$(date '+%u')" = "1" ]; then  # Segunda-feira
    echo "📸 Creating weekly snapshot..."
    tar -czf "/tmp/snapshot_${DATE}.tar.gz" "$DATA_DIR"
    gpg --encrypt --recipient "$GPG_RECIPIENT" \
        --output "snapshots/${DATE}_snapshot.tar.gz.gpg" \
        "/tmp/snapshot_${DATE}.tar.gz"
    rm "/tmp/snapshot_${DATE}.tar.gz"
fi

# Commit e push
git add .
git commit -m "Backup automático ${DATE}" || true
git push origin main

echo "✅ Remote backup completed: $(date)"
```

#### 3.3 Cron para Backup Remoto
```bash
# Crontab: 3h da manhã todos os dias
0 3 * * * /opt/gueclaw-agent/scripts/backup-remote.sh >> /opt/gueclaw-agent/logs/backup-remote.log 2>&1
```

---

### Fase 4: Verificação de Integridade

#### 4.1 Script de Verificação
```bash
# /opt/gueclaw-agent/scripts/verify-backups.sh
#!/bin/bash

BACKUP_DIR="/opt/gueclaw-data/backups"
EXTERNAL_DIR="/opt/backups/gueclaw"

echo "🔍 Verificando integridade dos backups..."

check_backup() {
    local BACKUP_FILE=$1
    
    if [ ! -f "$BACKUP_FILE" ]; then
        echo "❌ Backup not found: $BACKUP_FILE"
        return 1
    fi
    
    # Descompactar e verificar
    gunzip -t "$BACKUP_FILE" 2>/dev/null
    if [ $? -eq 0 ]; then
        echo "✅ OK: $(basename $BACKUP_FILE)"
        return 0
    else
        echo "❌ CORRUPTED: $(basename $BACKUP_FILE)"
        return 1
    fi
}

# Verificar últimos backups hourly
LATEST_HOURLY=$(ls -t "${BACKUP_DIR}/hourly/"*.db.gz 2>/dev/null | head -1)
check_backup "$LATEST_HOURLY"

# Verificar último backup daily
LATEST_DAILY=$(ls -t "${BACKUP_DIR}/daily/"*.db.gz 2>/dev/null | head -1)
check_backup "$LATEST_DAILY"

# Enviar notificação via Telegram em caso de falha
# (implementar integração)

echo "✅ Verification completed: $(date)"
```

---

<a name="recuperacao"></a>
## 🚑 5. PLANO DE RECUPERAÇÃO DE DESASTRES

### Cenário 1: Perda de 1 Banco (Ex: leads.db)
```bash
# 1. Identificar último backup válido
ls -lh /opt/gueclaw-data/backups/hourly/leads_*.db.gz | tail -5

# 2. Restaurar
gunzip -c /opt/gueclaw-data/backups/hourly/leads_2026-04-07_12h.db.gz > /tmp/leads_restored.db

# 3. Validar integridade
sqlite3 /tmp/leads_restored.db "PRAGMA integrity_check;"

# 4. Substituir
pm2 stop gueclaw-agent
cp /tmp/leads_restored.db /opt/gueclaw-data/databases/leads.db
pm2 start gueclaw-agent

# 5. Verificar
python3 .agents/skills/whatsapp-leads-sender/scripts/send_campaign.py --status
```

**Tempo estimado:** 5 minutos  
**Perda de dados:** Últimas 6 horas (no pior caso)

---

### Cenário 2: Perda Total da VPS
```bash
# Em nova VPS:

# 1. Instalar dependências
apt-get update && apt-get install -y git nodejs npm sqlite3 python3 gpg

# 2. Clonar repositório principal
git clone https://github.com/Moisesjr20/gueclaw.git /opt/gueclaw-agent

# 3. Clonar backups criptografados
git clone git@github.com:Moisesjr20/gueclaw-backups.git /opt/gueclaw-backups

# 4. Restaurar último snapshot
cd /opt/gueclaw-backups/snapshots
LATEST=$(ls -t *.tar.gz.gpg | head -1)
gpg --decrypt "$LATEST" | tar -xzf - -C /opt/

# OU restaurar bancos individuais
cd /opt/gueclaw-backups/databases
gpg --decrypt gueclaw_latest.db.gpg > /opt/gueclaw-data/databases/gueclaw.db
gpg --decrypt leads_latest.db.gpg > /opt/gueclaw-data/databases/leads.db
gpg --decrypt financas_latest.db.gpg > /opt/gueclaw-data/databases/financas.db

# 5. Configurar e iniciar
cd /opt/gueclaw-agent
npm install
npm run build
# Copiar .env (do backup seguro)
pm2 start dist/index.js --name gueclaw-agent
```

**Tempo estimado:** 30-60 minutos  
**Perda de dados:** Últimas 24 horas (no pior caso)

---

### Cenário 3: Corrupção de Banco de Dados
```bash
# 1. Detectar corrupção
sqlite3 /opt/gueclaw-data/databases/gueclaw.db "PRAGMA integrity_check;"

# 2. Tentar recuperação automática SQLite
sqlite3 /opt/gueclaw-data/databases/gueclaw.db ".recover" > /tmp/recovered.sql
sqlite3 /tmp/gueclaw_recovered.db < /tmp/recovered.sql

# 3. Se falhar, restaurar de backup
# Seguir Cenário 1

# 4. Exportar dados recuperáveis antes
sqlite3 /opt/gueclaw-data/databases/gueclaw.db ".dump" > /tmp/dump_attempt.sql
```

---

<a name="checklist"></a>
## ✅ 6. CHECKLIST DE IMPLEMENTAÇÃO

### Fase 1: Separação de Dados (CRÍTICO - HOJE)
- [ ] Criar `/opt/gueclaw-data/` com estrutura de pastas
- [ ] Mover bancos existentes para novo diretório
- [ ] Criar symlinks para compatibilidade
- [ ] Atualizar `.env` com novos paths
- [ ] Testar aplicação (enviar mensagem no Telegram)
- [ ] Commit e push das mudanças no código
- [ ] Atualizar `README.md` com nova estrutura

### Fase 2: Backup Local (PRIORIDADE ALTA - HOJE)
- [ ] Criar script `backup-databases.sh`
- [ ] Criar script `verify-backups.sh`
- [ ] Configurar cron jobs (6h em 6h + verificação diária)
- [ ] Executar backup manual para testar
- [ ] Verificar integridade dos backups criados
- [ ] Documentar processo no README

### Fase 3: Backup Remoto (PRIORIDADE MÉDIA - ESTA SEMANA)
- [ ] Criar repositório privado `gueclaw-backups` no GitHub
- [ ] Configurar Git LFS
- [ ] Gerar chave GPG (se não existir)
- [ ] Criar script `backup-remote.sh`
- [ ] Configurar cron job (3h da manhã)
- [ ] Executar backup remoto manual para testar
- [ ] Verificar arquivos criptografados no GitHub

### Fase 4: Testes e Validação (ESTA SEMANA)
- [ ] Simular perda de banco (cenário 1)
- [ ] Praticar restauração de backup
- [ ] Documentar tempo de recuperação (RTO)
- [ ] Calcular perda máxima de dados (RPO)
- [ ] Criar runbook de recuperação de desastres
- [ ] Treinar recuperação manual

### Fase 5: Monitoramento (PRÓXIMA SEMANA)
- [ ] Integrar notificações via Telegram em caso de falha
- [ ] Dashboard de status de backups
- [ ] Alertas de espaço em disco
- [ ] Métricas de crescimento dos bancos
- [ ] Relatório semanal de backups

---

## 📊 MÉTRICAS DE SUCESSO

### RPO (Recovery Point Objective)
- **Meta:** Máximo 6 horas de perda de dados
- **Atual:** ✅ Backup a cada 6h

### RTO (Recovery Time Objective)
- **Meta:** Restauração em < 15 minutos
- **Atual:** 🟡 A ser testado

### Disponibilidade
- **Meta:** 99.9% uptime
- **Atual:** 🟡 A ser medido

---

## 🎯 PRÓXIMOS PASSOS IMEDIATOS

1. **AGORA (30 min):** Implementar Fase 1 (separação de dados)
2. **HOJE (1h):** Implementar Fase 2 (backup local automático)
3. **HOJE (30 min):** Restaurar leads.db de algum backup existente OU re-importar CSV
4. **ESTA SEMANA:** Implementar Fase 3 (backup remoto)
5. **ESTA SEMANA:** Testes de recuperação

---

## 📝 NOTAS IMPORTANTES

### Sobre Criptografia
- ✅ `financas.db` já é criptografado com SQLCipher (senha no `.env`)
- ✅ Backups remotos serão criptografados com GPG
- ⚠️ Backups locais NÃO são criptografados (mesma máquina)

### Sobre GitHub LFS
- Limite: 1 GB/mês grátis, depois $5/50GB
- Nossos bancos: ~200KB total
- **1 ano de backups diários:** ~73 MB (bem abaixo do limite)

### Sobre Espaço em Disco
- **Disponível:** 66 GB
- **Usado por backups (estimativa):**
  - Hourly (24h): 4 × 200KB × 3 = ~2.4 MB
  - Daily (30d): 30 × 200KB × 3 = ~18 MB
  - Monthly (12m): 12 × 200KB × 3 = ~7.2 MB
  - **Total:** ~30 MB (0.05% do espaço disponível)

---

**Documento criado por:** GueClaw • GitHub Copilot  
**Última atualização:** 07/04/2026 14:45 BRT
