# ADR-0002: Estratégia de sync de skills via meu-vault-obsidian

- **Status:** Aceito
- **Data:** 2026-03-23
- **Decidido por:** Moises + GueClaw Agent

## Contexto

O projeto GueClaw tem skills (`.agents/skills/`) que precisam ser compartilhadas com outros projetos futuros. O repositório `myskills.git` foi apontado como remote mas nunca existiu no GitHub. As skills no `meu-vault-obsidian` estavam divergindo das skills locais (7 skills no vault não existiam no projet).

## Opções Avaliadas

1. **Git Submodule** — `.agents/skills` vira submodule apontando para um repo dedicado
   - Prós: controle de versão exato (pin de commit), workflow nativo do Git
   - Contras: complexidade de `git submodule update --init`, erros comuns para usuários não familiarizados

2. **Script de sync bidirecional** — scripts `sync-skills.sh` para pull/push manual
   - Prós: simples, sem complexidade de submodule, funciona sem conhecimento avançado de Git
   - Contras: requer disciplina para executar; não é automático sem CI

3. **GitHub Actions + repository_dispatch** — vault notifica projetos consumidores via webhook
   - Prós: totalmente automático, bidirecionalmente notificado
   - Contras: requer setup de Personal Access Token (PAT) em secrets

## Decisão

**Escolhemos: combinação de (2) + (3)** — scripts para uso manual/VPS + GitHub Actions para automação.

O `meu-vault-obsidian` é a **fonte da verdade**. Skills vivem em `GueClaw/skills/myskills/`. O `gueclaw` sincroniza via scripts ou automaticamente via `repository_dispatch`.

## Consequências

### Positivas
- Skills criadas em qualquer projeto chegam ao vault e de lá para todos os outros
- A VPS pode rodar `bash scripts/sync-skills.sh pull` a qualquer momento
- O GitHub Actions automatiza o ciclo quando configurado

### Negativas / Trade-offs aceitos
- O ciclo automático completo requer configuração de PAT (etapa manual pendente)
- Conflitos de merge devem ser resolvidos manualmente

### Ações necessárias
- [x] Remover `.git` quebrado de `.agents/skills`
- [x] Criar `scripts/sync-skills.ps1` e `sync-skills.sh`
- [x] Criar `.github/workflows/sync-skills-from-vault.yml`
- [ ] Adicionar `notify-consumers.yml` no `meu-vault-obsidian`
- [ ] Criar secret `GUECLAW_TOKEN` em `meu-vault-obsidian > Settings > Secrets`
