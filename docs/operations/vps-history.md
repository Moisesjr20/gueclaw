# Histórico de Operações na VPS

Registro de todas as operações realizadas na VPS: deploys, configurações, correções e incidentes.

> **Adicionar entrada:** execute no servidor ou use o agente com "registra no histórico da VPS que fiz X"
>
> ```bash
> # Alias — adicione ao .bashrc da VPS
> logvps() {
>   FILE="/opt/gueclaw-agent/docs/operations/vps-history.md"
>   DATE=$(date '+%Y-%m-%d %H:%M')
>   printf "\n## [%s] — Manual\n**Operador:** %s\n**Ação:** %s\n\n---\n" \
>     "$DATE" "$(whoami)" "$1" >> "$FILE"
>   echo "Registrado em $FILE"
> }
> ```

---

## [2026-03-23 16:30] — Fix + Deploy

**Operador:** GueClaw Agent + Moises  
**Motivação:** Resolver conflito git na VPS após uploads SFTP diretos da sessão anterior e garantir que código da `main` seja a fonte da verdade

### Problema identificado
`update.sh` falhou no `git pull` com conflito: a VPS tinha versões dos arquivos enviadas via SFTP (sem commit), bloqueando o merge.

### Ações executadas
```bash
# Local (Windows)
git add src/core/agent-loop/agent-loop.ts \
        .agents/skills/whatsapp-leads-sender/scripts/send_campaign.py \
        .agents/skills/whatsapp-leads-sender/scripts/worker.py
git commit -m "fix: agent-loop hallucination guard + worker exit-code fixes"
git push origin main  # → commit 2a99f74

# VPS (via paramiko)
cd /opt/gueclaw-agent
git checkout -- .          # descarta mudanças locais da VPS (SFTP)
git pull origin main       # fast-forward para 2a99f74
npm run build              # tsc limpo, sem erros
pm2 restart gueclaw-agent
pm2 restart whatsapp-worker
```

### Resultado
- `gueclaw-agent`: online (82mb), 7 restarts históricos
- `whatsapp-worker`: online (12mb), start limpo
- 18 skills carregadas com sucesso
- Token Copilot obtido no startup ✅
- DB: 967 leads | 11 enviados | 956 pendentes
- `worker_state.json`: `{ date: "2026-03-23", sent_count: 0, sent_slots: [9,12,15] }`
- Slot 18h de hoje programado para disparar normalmente

### Rollback
```bash
# Na VPS: reverter para commit anterior
git revert 2a99f74
npm run build
pm2 restart gueclaw-agent
```

---

## [2026-03-23 08:00] — Fix: Bugs críticos no worker de campanha + migração de leads

**Operador:** GueClaw Agent + Moises  
**Motivação:** Campanha WhatsApp paralisada desde 2026-03-21. Worker marcava slots como enviados sem mandar nada.

### Problemas identificados
1. `leads.db` estava vazia (0 registros) — migração CSV→SQLite nunca executada
2. `send_campaign.py`: `sys.exit(0)` quando sem leads → worker contava como envio bem-sucedido
3. `worker.py`: sem tratamento para `exit code 2` (diferente de sucesso ou erro de envio)

### Ações executadas
```bash
# Local: criado script tmp/migrate_and_fix.py
# Importou 992 linhas do CSV → 967 leads únicos (por whatsapp_number)
# Marcou 11 números já enviados com sent_at retroativo
# Corrigiu worker_state.json: { sent_count: 0, sent_slots: [9,12,15] }

# VPS: enviados via SFTP
# send_campaign.py: sys.exit(0) → sys.exit(2) (sem leads)
# worker.py: fire_one_message() retorna True/False/None
#            check_and_fire() trata None = sem leads (marca slot sem contar envio)
pm2 restart whatsapp-worker
```

### Resultado
- 967 leads importados, 11 marcados como já enviados, 956 na fila
- Worker discrimina: mensagem enviada vs erro vs sem leads
- Campanha retomada para o slot 18h do mesmo dia

### Rollback
```bash
# Reverter send_campaign.py: trocar sys.exit(2) de volta para sys.exit(0)
# Reverter worker.py: remover handling de None no check_and_fire()
```

---

## [2026-03-23 00:00] — Deploy

**Operador:** GueClaw Agent + Moises
**Motivação:** Sync completo de skills com meu-vault-obsidian e correção do .git quebrado

### Ações executadas
```bash
# Local (Windows)
Remove-Item -Recurse -Force ".agents\skills\.git"
powershell -File scripts/sync-skills.ps1 pull
git add .agents/ .github/ scripts/sync-skills.*
git commit -m "feat(skills): sync completo com meu-vault-obsidian + scripts bidirecional"
git push origin main

# VPS (próximo deploy)
cd /opt/gueclaw-agent
git pull origin main
pm2 restart gueclaw
```

### Resultado
- 7 novas skills incorporadas: doe, frontend-design, liquidacao-sentenca, matematica-financeira, rag-curriculos, skill-security-analyzer, subagent-creator
- Agents do vault sincronizados em `.agents/agents/`
- Scripts `sync-skills.sh` e `sync-skills.ps1` criados para uso futuro
- GitHub Actions criado para auto-sync quando vault for atualizado

### Rollback
```bash
# Se necessário reverter
git revert 239b8b1
git push origin main
# Na VPS: git pull && pm2 restart gueclaw
```

---

<!-- Adicione novas entradas ACIMA desta linha, mais recente primeiro -->
