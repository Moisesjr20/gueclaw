# ADR-0003: Migração da Campanha WhatsApp de CSV para SQLite

- **Status:** Aprovado
- **Data:** 2026-03-23
- **Decidido por:** Moises + GueClaw Agent

## Contexto

A skill `whatsapp-leads-sender` foi originalmente construída usando CSV como fonte de dados (`leads.csv`). Após a campanha ganhar maturidade e os scripts Python serem refatorados, o banco SQLite (`leads.db`) foi designado como a nova fonte da verdade — mas a migração dos dados nunca foi executada.

Isso causou:
- `leads.db` existia com schema correto, mas 0 registros
- `send_campaign.py` buscava leads no SQLite → retornava `None` → `sys.exit(0)` → worker contabilizava como envio bem-sucedido
- Slots [9h, 12h, 15h] sendo marcados como disparados sem nada ser enviado (desde 2026-03-21)

## Opções Avaliadas

1. **Manter CSV como fonte de dados**
   - Prós: sem migração necessária
   - Contras: CSV não suporta atualizações atômicas, sem índices, race condition com múltiplos processos, deduplicação manual

2. **Migrar para SQLite (implementar a migração pendente)**
   - Prós: deduplicação por `UNIQUE(whatsapp_number)`, `has_whatsapp` por lead, `skip`, `sent_at` com timestamps, queries indexadas, sem race condition
   - Contras: migração one-time necessária

3. **Usar banco externo (PostgreSQL / Supabase)**
   - Prós: acesso multi-host
   - Contras: dependência externa, custo, over-engineering para volume de ~1000 leads

## Decisão

**Escolhemos: Opção 2 — SQLite como fonte definitiva.**

A migração foi executada em 2026-03-23 via `tmp/migrate_and_fix.py`:
- 992 linhas do CSV importadas → 967 leads únicos (deduplicados por `whatsapp_number`)
- 11 números já enviados marcados com `sent_at` retroativo
- CSV original preservado como backup (não deletado)

## Schema do SQLite

```sql
CREATE TABLE leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT,
    street          TEXT,
    city            TEXT,
    website         TEXT,
    phone           TEXT,
    whatsapp_number TEXT UNIQUE NOT NULL,
    has_whatsapp    INTEGER DEFAULT NULL,  -- NULL=não verificado, 1=sim, 0=não
    sent_at         TEXT DEFAULT NULL,     -- ISO datetime, NULL=não enviado
    skip            INTEGER DEFAULT 0,    -- 1=ignorar este lead
    created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);
```

**Fila de envio:** `WHERE has_whatsapp = 1 AND sent_at IS NULL AND skip = 0 ORDER BY id`

## Consequências

### Positivas
- Deduplicação garantida a nível de banco (constraint UNIQUE)
- Controle granular de estado por lead (sent_at, skip, has_whatsapp)
- Histórico de envios preservado com timestamp
- Queries rápidas com índices em `has_whatsapp` e `sent_at`

### Negativas / Trade-offs aceitos
- CSV deixou de ser fonte: qualquer novo lead deve ser importado via script
- Sem UI de gestão (gerencia-se via SQL ou scripts Python)

### Ações necessárias
- [x] Executar migração dos 992 leads do CSV
- [x] Marcar 11 leads já enviados
- [x] Corrigir `send_campaign.py`: `sys.exit(0)` → `sys.exit(2)` quando sem leads
- [x] Corrigir `worker.py`: tratar exit code 2 separadamente de erro de envio
