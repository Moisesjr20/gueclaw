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

## Campanha WhatsApp (whatsapp-leads-sender)

### Status da campanha
```bash
cd /opt/gueclaw-agent/.agents/skills/whatsapp-leads-sender
python3 scripts/send_campaign.py --status
```

Mostra: total de leads, pendentes, já enviados, fila atual, slots do dia.

### Worker state (controle de slots diários)
```bash
cat data/worker_state.json
# { "date": "2026-03-23", "sent_count": 1, "sent_slots": [9] }
```

### Parar a campanha hoje
```bash
# Força todos os slots do dia como "já disparados"
python3 -c "
import json, datetime
f = 'data/worker_state.json'
s = json.load(open(f))
s['date'] = datetime.date.today().isoformat()
s['sent_slots'] = [9, 12, 15, 18]
json.dump(s, open(f,'w'), indent=2)
print('Campanha pausada para hoje.')
"
```

### Retomar campanha
```bash
# Zera os slots do dia para que todos disparem normalmente
python3 -c "
import json, datetime
f = 'data/worker_state.json'
s = json.load(open(f)) if __import__('os').path.exists(f) else {}
s['date'] = datetime.date.today().isoformat()
s['sent_count'] = 0
s['sent_slots'] = []
json.dump(s, open(f,'w'), indent=2)
print('Campanha retomada.')
"
pm2 restart whatsapp-worker
```

### Marcar lead como já enviado manualmente
```bash
python3 -c "
import sqlite3, datetime
conn = sqlite3.connect('data/leads.db')
conn.execute(\"UPDATE leads SET sent_at=? WHERE whatsapp_number=?\",
             (datetime.datetime.now().isoformat(timespec='seconds'), '55XXXXXXXXXXX'))
conn.commit()
print('Marcado. Rows:', conn.total_changes)
conn.close()
"
```

### Schedule de disparo
| Slot | Horário (Brasília) | Dias |
|------|--------------------|------|
| 9h   | 08:56 – 09:04      | Seg–Sex |
| 12h  | 11:56 – 12:04      | Seg–Sex |
| 15h  | 14:56 – 15:04      | Seg–Sex |
| 18h  | 17:56 – 18:04      | Seg–Sex |

### Diagnóstico: "Nenhum lead pendente" com leads no DB
```bash
# Verificar se has_whatsapp está preenchido
python3 -c "
import sqlite3
c = sqlite3.connect('data/leads.db')
r = c.execute('SELECT has_whatsapp, COUNT(*) FROM leads GROUP BY has_whatsapp').fetchall()
print(r)  # (None, X) = não verificado, (1, X) = tem WA, (0, X) = não tem WA
c.close()
"
# Se todos forem NULL ou 0 → set has_whatsapp=1 nos que têm número válido
python3 -c "
import sqlite3
c = sqlite3.connect('data/leads.db')
c.execute(\"UPDATE leads SET has_whatsapp=1 WHERE has_whatsapp IS NULL AND whatsapp_number != ''\")
c.commit()
print('Updated:', c.total_changes)
c.close()
"
```

---

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
