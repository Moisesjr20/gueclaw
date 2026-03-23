# Arquitetura — Nível 1: Contexto (C4)

Visão de alto nível do sistema GueClaw e como ele se relaciona com o mundo externo.

## Diagrama C4 — Contexto

```mermaid
graph TB
    USER["👤 Moises (Usuário)\nTelegram / WhatsApp"]

    subgraph SISTEMA["Sistema GueClaw"]
        BOT["🤖 GueClaw Bot\nTelegram Bot em Node.js/TS\nrodando na VPS via PM2"]
    end

    TELEGRAM["📱 Telegram\nAPI de mensagens"]
    LLM["🧠 LLM Provider\nClaude / GPT-4o / Copilot"]
    CALENDAR["📅 Google Calendar API\nAgenda pessoal + profissional"]
    WHATSAPP["💬 UazAPI\nGateway WhatsApp Business"]
    VAULT["📔 meu-vault-obsidian\nGitHub — skills + notas"]
    OBSIDIAN["🗒️ Obsidian App\nVault local sincronizado"]

    USER -->|"envia mensagem"| TELEGRAM
    TELEGRAM -->|"webhook HTTPS"| BOT
    BOT -->|"raciocínio + decisão"| LLM
    BOT -->|"lê/cria eventos"| CALENDAR
    BOT -->|"envia mensagens"| WHATSAPP
    BOT -->|"git pull/push skills"| VAULT
    VAULT -->|"sync automático"| OBSIDIAN
    LLM -->|"resposta estruturada"| BOT
    BOT -->|"resposta"| TELEGRAM
    TELEGRAM -->|"exibe mensagem"| USER
```

## Descrição dos Atores e Sistemas

### Usuário (Moises)
- Interage exclusivamente via **Telegram** (texto e comandos)
- Pode também ser acionado via WhatsApp quando o bot dispara mensagens

### GueClaw Bot (sistema principal)
- Recebe mensagens via webhook Telegram
- Classifica a intenção e invoca a skill correta
- Delega raciocínio ao LLM provider configurado
- Executa ações nos sistemas externos via skills

### Sistemas externos

| Sistema | Papel | Protocolo |
|---|---|---|
| Telegram API | Canal de entrada/saída do usuário | HTTPS Webhook |
| LLM Provider | Raciocínio, classificação, geração | HTTPS REST |
| Google Calendar | Leitura e criação de eventos | OAuth2 + REST |
| UazAPI (WhatsApp) | Envio de mensagens e campanhas | HTTPS REST |
| meu-vault-obsidian | Repositório central de skills e notas | Git SSH/HTTPS |

## Próximo nível
→ [Arquitetura — Containers (C4)](c4-containers.md)
