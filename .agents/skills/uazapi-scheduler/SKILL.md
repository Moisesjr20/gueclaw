---
name: uazapi-scheduler
description: Agendamento de mensagens via WhatsApp (UazAPI Scheduler). Use quando o usuário quiser programar, agendar, listar ou cancelar o envio de uma mensagem para o futuro.
summary: Agendamento de mensagens via WhatsApp (UazAPI Scheduler). Use quando o usuário quiser programar, agendar, listar ou cancelar o envio de uma mensagem para o futuro.
---

# Skill: UazAPI Scheduler

## Propósito
Permite o agendamento de mensagens de WhatsApp para serem enviadas no futuro utilizando a UazAPI.

## ⚠️ REGRAS ABSOLUTAS — LEIA ANTES DE QUALQUER AÇÃO

1. **NUNCA invente IDs, status ou resultados.** Todos os dados devem vir da saída real da ferramenta `vps_execute_command`.
2. **SEMPRE use a ferramenta `vps_execute_command`** para executar os comandos abaixo. Não simule, não escreva texto inventado como `[Tool Result - ...]`.
3. **SEMPRE execute a verificação** após criar/cancelar um agendamento (passo de confirmação obrigatório).
4. O ID real é gerado pelo script e aparece na linha `✅ Agendado com sucesso! ID: XXXXXXXX` do output real.

## Caminho dos Scripts na VPS

**Caminho absoluto:** `/root/gueclaw/.agents/skills/uazapi-scheduler/scripts/`

## Passo a Passo Para Agendar

### Passo 1 — Criar o agendamento
Use a ferramenta `vps_execute_command` com este comando **exatamente**:

```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/schedule.py "NUMERO" "DATA_HORA_ISO" "MENSAGEM"
```

**Regras:**
- `NUMERO`: Apenas dígitos, formato DDI+DDD+NUMERO. Ex: `5511999999999`
- `DATA_HORA_ISO`: Formato ISO-8601 com fuso de São Paulo. Ex: `2026-03-15T14:30:00-03:00`
- `MENSAGEM`: Texto entre aspas duplas. Se contiver aspas, use variável de ambiente.

**Exemplo:**
```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/schedule.py "5511999999999" "2026-03-15T14:30:00-03:00" "Lembrete: Reunião às 15h!"
```

### Passo 2 — Confirmar que foi salvo (OBRIGATÓRIO)
Após criar, SEMPRE execute a verificação com `vps_execute_command`:

```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/manage.py list pending
```

O ID real aparece no output do Passo 1. O Passo 2 confirma que está na fila.

## Listar Agendamentos

Use `vps_execute_command`:
```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/manage.py list
```

Ou só pendentes:
```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/manage.py list pending
```

## Cancelar um Agendamento

Use `vps_execute_command`:
```
python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/manage.py cancel <ID_REAL>
```

## O Worker (Motor de Envio)

O worker verifica a fila a cada minuto e dispara as mensagens no horário. Inicie com `vps_execute_command`:

```
nohup python3 /root/gueclaw/.agents/skills/uazapi-scheduler/scripts/worker.py > /root/gueclaw/.agents/skills/uazapi-scheduler/data/worker.log 2>&1 &
```

Verifique se está rodando:
```
ps aux | grep worker.py
```

*Sempre inicie o worker antes de confirmar um agendamento ao usuário.*

## Dados salvos em
`/root/gueclaw/.agents/skills/uazapi-scheduler/data/queue.json`