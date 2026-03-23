# ADR-0001: Usar SQLite como banco de dados local

- **Status:** Aceito
- **Data:** 2026-02-01
- **Decidido por:** Moises (arquiteto do projeto)

## Contexto

O GueClaw precisa de persistência para memória conversacional, histórico de leads e cache de dados de skills. O projeto roda em uma VPS com recursos limitados (1-2 vCPU, 2GB RAM). A equipe é pequena (1 dev) e simplicidade operacional é prioritária.

## Opções Avaliadas

1. **SQLite local** — banco de arquivo embutido, sem daemon, sem configuração
   - Prós: zero configuração, backup simples (copiar arquivo), muito rápido para leituras, sem custo
   - Contras: sem acesso remoto nativo, não escala para múltiplos escritores concorrentes

2. **PostgreSQL em Docker** — banco relacional completo via container
   - Prós: SQL completo, acesso remoto, escala bem
   - Contras: overhead de Docker, requer backup separado, complexidade operacional para projeto de 1 dev

3. **Supabase (cloud)** — PostgreSQL gerenciado na nuvem
   - Prós: backup automático, dashboard web, acesso remoto
   - Contras: custo (~$25/mês no plano Pro), latência de rede em cada query, dependência de serviço externo

## Decisão

**Escolhemos: SQLite local** porque o GueClaw é um projeto pessoal de uso single-user, operado por um único processo PM2. A workload é quase 100% de leitura/escrita sequencial (memória conversacional), sem concorrência real. Simplicidade e confiabilidade operacional superam a escala neste contexto.

## Consequências

### Positivas
- Zero configuração de infra — funciona direto no `npm start`
- Backup trivial: `cp data/*.db backup/`
- `better-sqlite3` é síncrono, simplifica o código (sem async/await no DB)

### Negativas / Trade-offs aceitos
- Se houver necessidade de acesso remoto ao banco no futuro, será necessário migrar
- Limite prático de ~100GB e ~1 escritor por vez (aceitável para o escopo atual)

### Ações necessárias
- [x] Usar `better-sqlite3` em vez de `sqlite3` (síncrono, mais rápido)
- [x] Criar migrations em `data/` e documentar schema
- [ ] Implementar rotina de backup automático para VPS
