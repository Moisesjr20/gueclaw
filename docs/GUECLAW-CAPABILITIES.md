# GueClaw — O que o agente pode fazer

> Guia completo de capacidades com exemplos práticos.
> Versão atual: **v2.3** — todas as fases implementadas e compilando.

---

## Como usar

Basta mandar mensagem no Telegram. O agente entende linguagem natural, decide sozinho qual ferramenta ou skill usar, executa e reporta o resultado real. Nada é simulado.

---

## Comandos de controle

| Comando | O que faz |
|---|---|
| `/limpar` | Apaga o histórico da conversa (começa do zero) |
| `/status` | Mostra provider ativo, mensagens em memória, uptime e versão |
| `/ajuda` | Lista todos os comandos disponíveis |
| `/monitorar list` | Lista monitores de serviço configurados |
| `/monitorar add docker nginx "Nginx Container"` | Adiciona monitor de container Docker |
| `/monitorar add systemd nginx "Nginx Service"` | Adiciona monitor de serviço systemd |
| `/monitorar add http https://meuprojeto.com "Site"` | Adiciona monitor HTTP |
| `/monitorar add process "node dist/index" "Bot Node"` | Adiciona monitor de processo |
| `/monitorar remove docker-nginx` | Remove um monitor pelo ID |
| `/monitorar check` | Executa todos os checks agora, sem esperar o intervalo |

---

## 1. Comandos VPS (shell)

O agente executa qualquer comando bash no servidor e retorna o output real.

**Exemplos práticos:**

```
df -h no servidor
```
```
quanta RAM está sendo usada agora?
```
```
lista os processos que mais consomem CPU
```
```
qual o IP público do servidor?
```
```
mostra o log do nginx dos últimos 5 minutos
```
```
instala o pacote htop
```
```
reinicia o serviço nginx
```
```
cria o usuário deploy com acesso somente à pasta /var/www
```

---

## 2. Docker

Gerencia containers, imagens, redes e volumes com Docker.

**Exemplos práticos:**

```
lista todos os containers em execução
```
```
para o container "minha-api"
```
```
inicia o container "redis"
```
```
reinicia todos os containers que estão com status "exited"
```
```
mostra os logs do container "gueclaw-bot" dos últimos 100 linhas
```
```
executa bash dentro do container "postgres" e mostra os bancos
```
```
puxa a imagem nginx:alpine
```
```
faz docker compose up -d na pasta /opt/meu-projeto
```
```
remove todos os containers parados e imagens não utilizadas
```
```
inspeciona as configurações de rede do container "backend"
```

---

## 3. Arquivos e diretórios

Lê, escreve, cria, lista e deleta arquivos no servidor.

**Exemplos práticos:**

```
lê o arquivo /etc/nginx/nginx.conf
```
```
mostra o conteúdo de /var/log/syslog as últimas 50 linhas
```
```
cria o arquivo /opt/meu-projeto/.env com o conteúdo: DATABASE_URL=postgres://...
```
```
adiciona a linha "export PATH=$PATH:/usr/local/bin" no /etc/profile
```
```
lista o que tem dentro de /opt/gueclaw-agent/data
```
```
cria a pasta /var/backups/configs
```
```
verifica se o arquivo /opt/app/config.json existe
```
```
deleta todos os arquivos .log dentro de /tmp com mais de 7 dias
```

---

## 4. Requisições HTTP / APIs externas

Faz chamadas GET, POST, PUT, DELETE, PATCH para qualquer API.

**Exemplos práticos:**

```
faz um GET em https://api.github.com/repos/gueclaw/agent e me mostra as informações
```
```
verifica se a API em https://minha-api.com/health está respondendo
```
```
envia um POST para https://hooks.slack.com/... com a mensagem "Deploy concluído"
```
```
faz um PUT em https://api.exemplo.com/users/42 com o body {"active": false}
```
```
checa o status HTTP do meu site https://meuprojeto.com
```

---

## 5. WhatsApp — UazAPI

Envia mensagens de WhatsApp para qualquer número usando a instância UazAPI configurada.

**Exemplos práticos:**

```
manda uma mensagem de WhatsApp para 5511999999999 dizendo "Deploy concluído com sucesso"
```
```
envia para o número 5521988888888: "Alerta: servidor com 95% de disco"
```
```
manda uma imagem /opt/graficos/relatorio.png para 5511977777777 com a legenda "Relatório de hoje"
```
```
envia um documento /tmp/relatorio.pdf para 5511966666666
```
```
verifica se a instância WhatsApp está conectada
```

---

## 6. Agendamento de mensagens WhatsApp

Agenda mensagens de WhatsApp para serem enviadas no futuro.

**Exemplos práticos:**

```
agenda uma mensagem para 5511999999999 amanhã às 9h: "Bom dia! Lembrete: reunião às 10h"
```
```
programa para enviar hoje às 18h para 5521988888888: "Fim de expediente — todos os serviços OK"
```
```
lista todos os agendamentos pendentes
```
```
cancela o agendamento de ID a1b2c3d4
```
```
agenda para toda segunda às 8h para 5511977777777: "Relatório semanal gerado"
```

---

## 7. Análise de imagens (visão computacional)

Receba uma foto no chat — o agente analisa e descreve o conteúdo.

**Como usar:** basta enviar uma foto diretamente no Telegram. O agente chamará automaticamente `analyze_image`.

**Exemplos práticos:**

```
[envia print de erro do terminal]
→ agente lê a mensagem de erro e sugere solução
```
```
[envia foto de um gráfico de monitoramento]
→ agente descreve métricas, picos e anomalias visíveis
```
```
[envia print de uma configuração nginx]
→ agente lê o conteúdo e identifica problemas
```
```
[envia foto de um diagrama de arquitetura]
→ agente descreve os componentes e fluxos
```

Você também pode pedir explicitamente com contexto:
```
analisa essa imagem e me diz se o gráfico de CPU está normal
```

---

## 8. Transcrição de áudio (Whisper)

Envie uma mensagem de voz ou arquivo de áudio — o agente transcreve automaticamente e processa como texto.

**Como usar:** basta enviar um áudio ou gravar mensagem de voz no Telegram. A transcrição acontece antes de chegar ao LLM.

**Exemplos práticos:**

```
[grava mensagem de voz: "reinicia o container nginx e me manda o status"]
→ agente transcreve e executa o comando
```
```
[envia arquivo .mp3 com instruções]
→ agente transcreve e segue as instruções
```

Também pode pedir manualmente:
```
transcreve o áudio /tmp/reuniao.ogg
```

---

## 9. Memória persistente entre sessões

O agente lembra de fatos importantes sobre você e seu ambiente, mesmo após reiniciar.

**Onde fica:** `data/memory/{userId}/MEMORY.md` (permanente) e `data/memory/{userId}/YYYY-MM-DD.md` (log diário)

**Exemplos práticos:**

```
lembra que meu projeto principal fica em /opt/gueclaw-agent
```
```
salva que o banco de dados de produção é postgres://prod-server:5432/mydb
```
```
anota que prefiro respostas curtas e diretas
```
```
registra que o servidor de staging é o IP 192.168.1.50
```

O agente também anota ações importantes automaticamente no log do dia.

---

## 10. Compactação automática de contexto

Quando a conversa passa de 30 mensagens (configurável via `CONTEXT_COMPACT_THRESHOLD`), o agente resume automaticamente as mensagens antigas via LLM, salva o resumo em disco e mantém a conversa fluindo sem perder contexto relevante.

Você não precisa fazer nada — acontece transparentemente.

---

## 11. Heartbeat — Monitoramento proativo

O agente monitora serviços automaticamente e te avisa no Telegram quando algo cai.

**Intervalo padrão:** 60 minutos (configurável via `HEARTBEAT_INTERVAL_MINUTES`)

**Tipos de monitor suportados:**

| Tipo | Verifica | Exemplo de alvo |
|---|---|---|
| `docker` | Container está `running` | `nginx`, `postgres`, `gueclaw-bot` |
| `systemd` | Serviço está `active` | `nginx`, `postgresql`, `docker` |
| `http` | Resposta HTTP 2xx/3xx | `https://meusite.com/health` |
| `process` | Processo existe (pgrep) | `node dist/index` |

**Exemplos práticos:**

```
/monitorar add docker gueclaw-bot "Bot GueClaw"
/monitorar add docker postgres "PostgreSQL"
/monitorar add http https://meusite.com/health "Site Produção"
/monitorar add systemd nginx "Nginx"
```

Quando um serviço cair, você recebe automaticamente:
> ⚠️ Heartbeat — Anomalias Detectadas
> ❌ Bot GueClaw (docker:gueclaw-bot) — status: exited

---

## 12. Skills — Módulos de conhecimento especializado

O agente carrega automaticamente as skills instaladas e usa a certa para cada tipo de tarefa.

### Skills instaladas:

| Skill | Diretório | Para que serve |
|---|---|---|
| **vps-manager** | `vps-manager` | Administração geral do VPS |
| **uazapi-whatsapp** | `uazapi-whatsapp` | Envio de mensagens WhatsApp via UazAPI |
| **uazapi-scheduler** | `uazapi-scheduler` | Agendamento de mensagens WhatsApp |
| **self-improvement** | `self-improvement` | Criar e modificar as próprias skills |
| **skill-creator** | `skill-creator` | Criar skills novas com evals e iteração |

O agente pode carregar as instruções completas de qualquer skill sob demanda com a ferramenta `read_skill`.

---

## 13. Criar e melhorar skills

O agente pode criar novas skills para si mesmo e melhorar as existentes.

**Exemplos práticos:**

```
cria uma skill para gerenciar bancos de dados PostgreSQL
```
```
cria uma skill para fazer deploy automático via git pull
```
```
melhora a skill vps-manager adicionando suporte a backups automáticos
```
```
cria uma skill para monitorar preços de ações via API
```
```
atualiza a skill uazapi-whatsapp com suporte a envio de stickers
```

---

## 14. Raciocínio e análise geral

Para tarefas que não envolvem ferramentas, o agente raciocina e responde diretamente.

**Exemplos práticos:**

```
explica o que significa esse erro: "ECONNREFUSED 127.0.0.1:5432"
```
```
qual a diferença entre docker stop e docker kill?
```
```
revisa esse arquivo de configuração nginx e me diz se tem algo errado
[cola o conteúdo]
```
```
gera um script bash para fazer backup diário do postgres e enviar para S3
```
```
qual a melhor estratégia para fazer zero-downtime deploy com Docker?
```

---

## 15. Processamento de arquivos anexados

Envie arquivos diretamente no Telegram para análise.

| Tipo | O que acontece |
|---|---|
| **PDF** | Extrai texto completo e analisa o conteúdo |
| **CSV** | Faz parse e analisa os dados como JSON |
| **Texto (.txt, .log, .conf, .yml, ...)** | Lê e analisa o conteúdo |
| **Imagem (.jpg, .png, .gif, .webp)** | Analisa visualmente com GPT-4o |
| **Áudio / Voz (.ogg, .mp3, .wav, ...)** | Transcreve com Whisper e processa o texto |

**Exemplos práticos:**

```
[envia nginx.conf]
→ "analisa esse arquivo e me diz se tem algum problema de segurança"
```
```
[envia relatorio.pdf]
→ "resume os pontos principais desse relatório"
```
```
[envia dados.csv]
→ "quais são os 5 maiores valores da coluna 'vendas'?"
```

---

## Variáveis de ambiente relevantes

| Variável | Padrão | Descrição |
|---|---|---|
| `MEMORY_WINDOW_SIZE` | `10` | Mensagens mantidas no contexto ativo |
| `CONTEXT_COMPACT_THRESHOLD` | `30` | Mensagens antes de compactar |
| `MAX_ITERATIONS` | `5` | Iterações máximas do loop ReAct |
| `STREAMING_ENABLED` | `false` | Efeito typewriter nas respostas |
| `HEARTBEAT_ENABLED` | `true` | Liga/desliga monitor automático |
| `HEARTBEAT_INTERVAL_MINUTES` | `60` | Intervalo entre checks de saúde |
| `VISION_ENABLED` | `true` | Liga/desliga análise de imagens |
| `VISION_MODEL` | `gpt-4o` | Modelo de visão |
| `AUDIO_TRANSCRIPTION_ENABLED` | `true` | Liga/desliga transcrição Whisper |
| `WHISPER_MODEL` | `whisper-1` | Modelo de transcrição |
| `WHISPER_LANGUAGE` | `pt` | Idioma padrão de transcrição |

---

## Arquitetura resumida

```
Telegram ──► InputHandler ──► AgentController
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
               SkillRouter    CompactIfNeeded   BuildEnrichment
                    │           (>=30 msgs)     (memória + skills)
                    │
          ┌─────────┴──────────┐
          │                    │
      SkillExecutor         AgentLoop (ReAct)
          │                    │
          └────────┬───────────┘
                   │
            ToolRegistry (8 tools)
            ├── vps_execute_command
            ├── docker_manage
            ├── file_operations
            ├── api_request
            ├── memory_write
            ├── read_skill
            ├── analyze_image
            └── transcribe_audio
```

---

*Última atualização: v2.3 — Março 2026*
