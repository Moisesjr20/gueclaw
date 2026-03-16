# Debug API — Guia de Uso

API local que roda dentro do VPS na porta `3742` (apenas `127.0.0.1` — nunca exposta externamente).
Permite simular mensagens, inspecionar traces de execução, ver logs e analisar conversas **sem precisar enviar mensagens pelo Telegram**.

---

## Pré-requisitos

- Node.js instalado na sua máquina local
- Python 3 com `paramiko` instalado (`pip install paramiko`)
- Arquivo `.env` com `VPS_PASSWORD` preenchido
- Bot rodando no VPS (`pm2 status gueclaw-agent` → `online`)

---

## Passo 1 — Abrir o túnel SSH

O túnel encaminha a porta `3742` do VPS para `localhost:3742` na sua máquina.
**Mantenha este terminal aberto** enquanto usar a API.

```bash
node scripts/debug-api.js tunnel
```

Saída esperada:
```
🔗 SSH tunnel open
✅ Tunnel active — API available at http://127.0.0.1:3742
```

Atalho npm:
```bash
npm run debug:tunnel
```

---

## Passo 2 — Comandos disponíveis

> Abra um **segundo terminal** para rodar os comandos abaixo (mantendo o túnel aberto).

---

### `simulate` — Simular uma mensagem

Injeta uma mensagem como se fosse enviada pelo Telegram.
Retorna: skill roteada, resposta, duração, número de iterações e trace completo.

```bash
node scripts/debug-api.js simulate "Liste os grupos do WhatsApp"
node scripts/debug-api.js simulate "Qual é o status do Docker?" --user meuUsuario
```

Atalho npm:
```bash
npm run debug:simulate "Liste os grupos do WhatsApp"
```

**Exemplo de saída:**
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

---

### `logs` — Ver logs do PM2

```bash
node scripts/debug-api.js logs         # últimas 50 linhas
node scripts/debug-api.js logs 200     # últimas 200 linhas
```

Atalho npm:
```bash
npm run debug:logs
```

---

### `conversations` — Listar conversas

```bash
node scripts/debug-api.js conversations              # todas (até 20)
node scripts/debug-api.js conversations debug-cli    # filtrar por userId
```

Atalho npm:
```bash
npm run debug:conversations
npm run debug:conversations debug-cli
```

---

### `trace` — Ver trace de uma conversa

Mostra cada iteração, cada tool call, argumentos e resultado de uma conversa específica.

```bash
node scripts/debug-api.js trace abc123-uuid-aqui
```

---

### `messages` — Ver mensagens de uma conversa

```bash
node scripts/debug-api.js messages abc123-uuid-aqui
```

---

### `stats` — Estatísticas de execução

```bash
node scripts/debug-api.js stats
```

Atalho npm:
```bash
npm run debug:stats
```

**Exemplo de saída:**
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

## Endpoints da API (acesso direto via curl ou Postman)

Com o túnel aberto, você pode acessar diretamente:

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/health` | Verificar se API está online |
| GET | `/api/conversations` | Listar conversas (`?userId=&limit=`) |
| GET | `/api/conversations/:id/messages` | Mensagens de uma conversa |
| GET | `/api/conversations/:id/trace` | Trace de execução |
| GET | `/api/logs/tail?lines=50` | Tail dos logs PM2 |
| GET | `/api/skills` | Skills carregadas |
| GET | `/api/stats` | Estatísticas |
| POST | `/api/simulate` | Simular mensagem |
| DELETE | `/api/conversations/:id` | Deletar conversa |

**Exemplo com curl:**
```bash
# Health check
curl http://127.0.0.1:3742/api/health

# Simular mensagem
curl -X POST http://127.0.0.1:3742/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"userId": "teste", "input": "Liste os grupos do WhatsApp"}'

# Listar conversas
curl "http://127.0.0.1:3742/api/conversations?limit=10"
```

---

## Estrutura do Trace

Cada entrada no trace representa uma iteração do Agent Loop:

```json
{
  "id": "uuid",
  "conversationId": "uuid-da-conversa",
  "iteration": 1,
  "toolName": "vps_execute_command",       // null se for só thought
  "toolArgs": "{\"command\": \"curl...\"}",
  "toolResult": "[{\"Name\":\"Familia\"...}]",
  "thought": "Vou usar vps_execute_command para...",
  "finishReason": "tool_success",          // stop | tool_success | tool_error | tool_calls
  "createdAt": 1742139600
}
```

---

## Desabilitar a Debug API no VPS

Caso queira desligar a API (ex: em produção), adicione ao `.env` do VPS:

```env
DISABLE_DEBUG_API=true
```

E reinicie: `pm2 restart gueclaw-agent`

---

## Fluxo típico de debug (protocolo DOE)

```
1. Abrir túnel:       npm run debug:tunnel
2. Simular mensagem:  npm run debug:simulate "sua mensagem"
3. Analisar trace:    node scripts/debug-api.js trace <conversationId>
4. Ver logs se erro:  npm run debug:logs
5. Comparar stats:    npm run debug:stats
```
