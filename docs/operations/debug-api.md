# Debug API — Referência Completa

API local na porta `3742` (apenas `127.0.0.1` — **nunca exposta externamente**).
Permite simular mensagens, inspecionar traces, ver logs e estatísticas sem enviar mensagens pelo Telegram.

> Fonte original: `DOE/debug-api.md` | Código: `src/api/`

---

## Pré-requisitos

- Node.js instalado localmente
- Python 3 + `paramiko` (`pip install paramiko`) para túnel SSH
- `.env` com `VPS_HOST`, `VPS_USER`, `VPS_PASSWORD` preenchidos
- Bot rodando no VPS (`pm2 status gueclaw` → `online`)

---

## Passo 1 — Abrir o túnel SSH

```bash
# Encaminha VPS:3742 para localhost:3742
node scripts/debug-api.js tunnel
# ou
npm run debug:tunnel
```

Saída esperada:
```
🔗 SSH tunnel open
✅ Tunnel active — API available at http://127.0.0.1:3742
```

**Mantenha este terminal aberto** enquanto usar a API.

---

## Passo 2 — Comandos (segundo terminal)

### `simulate` — Simular uma mensagem

```bash
node scripts/debug-api.js simulate "Liste os grupos do WhatsApp"
node scripts/debug-api.js simulate "Qual o status do Docker?" --user meuUsuario
npm run debug:simulate "Liste os grupos do WhatsApp"
```

Saída:
```
📤 Simulating: "Liste os grupos do WhatsApp" (user: debug-cli)

🎯 Skill roteada: uazapi-groups
⏱️  Duration: 3420ms
🔁 Iterations: 2

📝 Response:
✅ RESULTADO: Encontrei 45 grupos...

🔍 Trace:
  [iter 1] 💭 thought
    thought: Vou usar vps_execute_command para buscar os grupos...
    finish: tool_calls
  [iter 1] 🔧 vps_execute_command
    args: {"command": "curl -s ..."}
    result: [{"Name":"Familia","JID":"..."},...]
    finish: tool_success
  [iter 2] 💭 thought
    finish: stop

💾 Conversation ID: abc123-...
```

### `logs` — Logs do PM2

```bash
node scripts/debug-api.js logs          # últimas 50 linhas
node scripts/debug-api.js logs 200      # últimas 200 linhas
npm run debug:logs
```

### `conversations` — Listar conversas

```bash
node scripts/debug-api.js conversations              # todas (até 20)
node scripts/debug-api.js conversations debug-cli    # filtrar por userId
npm run debug:conversations
npm run debug:conversations debug-cli
```

### `trace` — Trace de uma conversa

```bash
node scripts/debug-api.js trace <conversationId>
```

### `messages` — Mensagens de uma conversa

```bash
node scripts/debug-api.js messages <conversationId>
```

### `stats` — Estatísticas de skills

```bash
node scripts/debug-api.js stats
npm run debug:stats
```

Saída:
```json
{
  "skills": [
    { "skill_name": "uazapi-groups", "total": 12, "successes": 11, "avg_ms": 2800 },
    { "skill_name": "vps-manager", "total": 8, "successes": 8, "avg_ms": 1200 }
  ],
  "traces": {
    "traced_conversations": 20,
    "total_traces": 87,
    "tool_call_rate": 0.62
  }
}
```

---

## Endpoints REST (acesso direto)

Com o túnel aberto, use curl ou Postman em `http://127.0.0.1:3742`:

| Método | Endpoint | Descrição |
|---|---|---|
| GET | `/api/health` | Verificar se API está online |
| GET | `/api/conversations` | Listar conversas (`?userId=&limit=`) |
| GET | `/api/conversations/:id/messages` | Mensagens de uma conversa |
| GET | `/api/conversations/:id/trace` | Trace completo de execução |
| GET | `/api/logs/tail?lines=50` | Últimas N linhas de log PM2 |
| GET | `/api/skills` | Skills carregadas no runtime |
| GET | `/api/stats` | Estatísticas de performance |
| POST | `/api/simulate` | Simular mensagem Telegram |
| DELETE | `/api/conversations/:id` | Deletar conversa |

```bash
# Exemplos de curl
curl http://127.0.0.1:3742/api/health
curl "http://127.0.0.1:3742/api/conversations?limit=10"
curl -X POST http://127.0.0.1:3742/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"userId": "debug-cli", "input": "liste os grupos"}'
```

---

## Estrutura de um Trace

Cada objeto representa uma iteração do Agent Loop (Thought-Action-Observation):

```json
{
  "id": "uuid",
  "conversationId": "uuid-da-conversa",
  "iteration": 1,
  "toolName": "vps_execute_command",
  "toolArgs": "{\"command\": \"curl ...\"}",
  "toolResult": "[{\"Name\":\"Familia\",\"JID\":\"...\"}]",
  "thought": "Vou usar vps_execute_command para buscar os grupos...",
  "tokensUsed": 312,
  "finishReason": "tool_success",
  "createdAt": 1742139600
}
```

`finishReason` possíveis: `stop` | `tool_calls` | `tool_success` | `tool_error`

---

## Desabilitar a Debug API

```env
# .env do VPS
DISABLE_DEBUG_API=true
```

Reiniciar: `pm2 restart gueclaw`

---

## Protocolo de Debug DOE

```
1. Abrir túnel:       npm run debug:tunnel
2. Simular mensagem:  npm run debug:simulate "sua mensagem"
3. Ver skill roteada: 🎯 Skill roteada: <nome>
4. Analisar trace:    node scripts/debug-api.js trace <conversationId>
5. Ver logs se erro:  npm run debug:logs
6. Comparar stats:    npm run debug:stats
```

---

## Segurança

- A API escuta **somente** em `127.0.0.1:3742` — nunca em `0.0.0.0`
- Acesso só é possível via túnel SSH autenticado
- Nginx **não** faz proxy para `:3742` — é localhost-only por design
- Não há autenticação adicional (o SSH é o controle de acesso)
