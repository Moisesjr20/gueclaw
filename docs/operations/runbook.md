# Runbook — GueClaw em Produção

Guia operacional para manter o GueClaw funcionando. Endereçado a qualquer pessoa (ou agente) que precise operar o sistema.

---

## Acesso à VPS

```bash
ssh root@<VPS_IP>
cd /opt/gueclaw-agent
```

## Comandos do Dia a Dia

| Tarefa | Comando |
|---|---|
| Ver status do bot | `pm2 status` |
| Ver logs em tempo real | `pm2 logs gueclaw` |
| Reiniciar o bot | `pm2 restart gueclaw` |
| Parar o bot | `pm2 stop gueclaw` |
| Ver últimas 200 linhas de log | `pm2 logs gueclaw --lines 200` |
| Verificar erros recentes | `pm2 logs gueclaw --err --lines 50` |

## Deploy de Atualização

```bash
cd /opt/gueclaw-agent
git pull origin main
npm install          # se package.json mudou
npm run build        # compila TypeScript
pm2 restart gueclaw
pm2 logs gueclaw --lines 20  # verificar se subiu sem erro
```

## Sync de Skills (receber novas skills do vault)

```bash
cd /opt/gueclaw-agent
bash scripts/sync-skills.sh pull
git add .agents/
git commit -m "chore: sync skills from vault $(date '+%Y-%m-%d')"
pm2 restart gueclaw
```

## Variáveis de Ambiente

Todas em `/opt/gueclaw-agent/.env`. Nunca commitar este arquivo.

| Variável | Descrição |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Token do bot Telegram |
| `OPENAI_API_KEY` | Chave OpenAI (se usar GPT) |
| `ANTHROPIC_API_KEY` | Chave Anthropic (se usar Claude) |
| `GITHUB_TOKEN` | PAT para sync com vault Obsidian |
| `UAIZAPI_TOKEN` | Token UazAPI (WhatsApp) |
| `UAIZAPI_BASE_URL` | URL da instância UazAPI |
| `GOOGLE_CLIENT_ID` | OAuth Google Calendar |
| `GOOGLE_CLIENT_SECRET` | OAuth Google Calendar |

## Diagnóstico de Problemas

### Bot não responde no Telegram
```bash
pm2 status          # está rodando?
pm2 logs gueclaw --lines 50  # há erros?
curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo
# Verificar se webhook está configurado corretamente
```

### Skill não encontrada / erro de roteamento
```bash
ls .agents/skills/          # skill existe?
cat .agents/skills/<skill>/SKILL.md  # conteúdo correto?
pm2 restart gueclaw         # recarregar skills
```

### Erro de autenticação Google Calendar
```bash
# Reautenticar (rodar localmente, subir token para VPS)
python3 scripts/generate-google-token.py
scp token.json root@<VPS_IP>:/opt/gueclaw-agent/
```

### WhatsApp desconectado (UazAPI)
```bash
# Verificar status da instância
curl -H "Authorization: Bearer $UAIZAPI_TOKEN" $UAIZAPI_BASE_URL/instance/status
# Se desconectado, reescanear QR Code via painel UazAPI
```

## Registrar Operações

Toda operação manual deve ser registrada:
```bash
logvps "descrição do que foi feito e por quê"
# Ver definição do alias em: docs/operations/vps-history.md
```
