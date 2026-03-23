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
