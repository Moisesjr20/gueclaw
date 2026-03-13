---
summary: "Agendamento de mensagens via WhatsApp (UazAPI Scheduler). Use quando o usuário quiser programar, agendar, listar ou cancelar o envio de uma mensagem para o futuro."
---

# Skill: UazAPI Scheduler

## Propósito
Permite o agendamento de mensagens de WhatsApp para serem enviadas no futuro utilizando a UazAPI.

## Variáveis de Ambiente Necessárias

Configure no arquivo `.env`:

```env
UAIZAPI_TOKEN=seu_token_aqui
```

## Comandos Disponíveis

Os scripts estão localizados em: `.agents/skills/uazapi-scheduler/scripts/`

### 1. Agendar uma Mensagem
Para agendar uma mensagem, você deve usar o script `schedule.py`.

```bash
python3 .agents/skills/uazapi-scheduler/scripts/schedule.py "<NUMERO>" "<DATA_HORA_ISO>" "<MENSAGEM>"
```

**Regras:**
- `NUMERO`: Apenas números, formato DDI+DDD+NUMERO. Ex: `5511999999999`.
- `DATA_HORA_ISO`: OBRIGATORIAMENTE no formato ISO-8601 de São Paulo. Ex: `2026-03-15T14:30:00-03:00`. (Sempre calcule a data correta baseada no momento atual).
- `MENSAGEM`: O texto da mensagem a ser enviada.

**Exemplo:**
```bash
python3 .agents/skills/uazapi-scheduler/scripts/schedule.py "5511999999999" "2026-03-15T14:30:00-03:00" "Lembrete: Reunião às 15h!"
```

### 2. Listar Agendamentos
Para ver o que está na fila (pendente, enviado, cancelado):

```bash
# Lista todas as mensagens
python3 .agents/skills/uazapi-scheduler/scripts/manage.py list

# Lista apenas as pendentes
python3 .agents/skills/uazapi-scheduler/scripts/manage.py list pending
```

### 3. Cancelar um Agendamento
Se o usuário desistir do envio e a mensagem ainda estiver com status `pending`:

```bash
python3 .agents/skills/uazapi-scheduler/scripts/manage.py cancel <ID_DA_TAREFA>
```

---

## O Motor do Scheduler (Worker)
O sistema depende de um worker que roda em background verificando o arquivo JSON a cada minuto. 
Para garantir que ele está rodando e vai disparar as mensagens no momento certo, você deve inicializá-lo.

**Iniciar o worker:**
```bash
python3 .agents/skills/uazapi-scheduler/scripts/worker.py
```

**Ou executar apenas uma vez (útil para cron):**
```bash
python3 .agents/skills/uazapi-scheduler/scripts/worker.py --once
```

*Observação: Antes de confirmar um agendamento para o usuário, certifique-se de que o worker está rodando.*

## Diretrizes de Uso
1. Se o usuário falar "mande uma mensagem para X amanhã às Y", calcule a data em ISO baseada na data atual e chame o `schedule.py`.
2. Após agendar, informe o ID ao usuário para que ele possa cancelar se precisar.
3. Os dados são salvos em: `.agents/skills/uazapi-scheduler/data/queue.json`