# Plano de Melhorias — GueClaw inspirado no OpenClaw

> Baseado na análise do repositório https://github.com/openclaw/openclaw  
> Data: Março 2026  
> Estado atual: GueClaw v2.0.0 rodando em VPS (PM2 @ /opt/gueclaw-agent)

---

## Resumo Executivo

O OpenClaw é um sistema de assistente pessoal com arquitetura muito mais madura que o GueClaw atual. A principal diferença não está nos recursos individuais, mas nos **mecanismos de confiabilidade** que o OpenClaw possui e o GueClaw não:

1. O LLM nunca "confirma" ações que não aconteceram
2. O contexto não cresce infinitamente
3. A memória persiste entre sessões de forma estruturada
4. Skills são carregadas sob demanda, não em massa
5. Respostas duplicadas são impossíveis por design

---

## Gap Analysis — O que temos vs o que o OpenClaw tem

| Área | GueClaw Atual | OpenClaw |
|------|--------------|---------|
| Token NO_REPLY | ❌ Não existe | ✅ Filtra respostas silenciosas |
| Memória persistente | ❌ SQLite (só histórico) | ✅ MEMORY.md + memory/YYYY-MM-DD.md |
| Compactação de contexto | ❌ Não existe | ✅ Auto-compaction + /compact |
| Workspace de identidade | ❌ Não existe | ✅ SOUL.md + USER.md + AGENTS.md |
| Skills sob demanda | ❌ Todas carregadas em massa | ✅ LLM escolhe e lê SKILL.md |
| Sistema de heartbeat | ❌ Não existe | ✅ HEARTBEAT.md + cron proativo |
| Streaming de resposta | ❌ Só resposta final | ✅ Preview + block streaming |
| Comando /reset /status | ❌ Não existe | ✅ Comandos de controle de sessão |
| Rate limiting de ferramentas | ❌ Não existe | ✅ Retry + cooldown |
| Suporte a imagens/voz | ❌ TODO pendente | ✅ Via nodes + Whisper + ElevenLabs |

---

## PRIORIDADE 1 — Crítico (impacto direto na qualidade das respostas)

### 1.1 Sistema NO_REPLY / Silent Token

**Problema atual:** O bot às vezes responde "vou fazer X" e também executa X, gerando resposta duplicada. Ou quando usa uma ferramenta que já manda a resposta, ainda escreve texto extra.

**Como o OpenClaw resolve:**
- `SILENT_REPLY_TOKEN = "NO_REPLY"` definido em `tokens.ts`
- O system prompt instrui: *"Se você usou a ferramenta `message` para entregar a resposta, responda APENAS: NO_REPLY"*
- A camada de output filtra qualquer resposta que seja exatamente `NO_REPLY` antes de enviar ao Telegram

**O que implementar no GueClaw:**
1. Adicionar filtro em `telegram-output-handler.ts` — se `response === 'NO_REPLY'`, não envia nada
2. Adicionar no system prompt de `agent-loop.ts` e `skill-executor.ts`: 
   > "Quando você não tiver nada a dizer, responda APENAS: NO_REPLY — nunca misture com uma resposta real"
3. Adicionar regra: "Se você executou uma ação via ferramenta e o resultado já é a resposta completa, responda: NO_REPLY"

**Arquivos:** `src/core/agent-loop/agent-loop.ts`, `src/handlers/telegram-output-handler.ts`, `src/core/skills/skill-executor.ts`

---

### 1.2 Workspace de Identidade do Agente (SOUL.md + USER.md)

**Problema atual:** O agente não tem personalidade nem contexto sobre o usuário. Cada sessão começa do zero sem identidade persistente.

**Como o OpenClaw resolve:**
- `SOUL.md` — define identidade, tom, limites do agente. Lido a cada sessão.
- `USER.md` — descreve quem é o dono, preferências, contexto. Lido a cada sessão.
- `AGENTS.md` — regras de comportamento (como agir em grupos, quando falar, etc.)
- Esses arquivos são injetados automaticamente no system prompt como "Project Context"

**O que implementar no GueClaw:**

Criar o diretório workspace do agente:
```
.agents/workspace/
├── SOUL.md       ← Personalidade do GueClaw
├── USER.md       ← Quem é o Moisés, suas preferências
├── AGENTS.md     ← Regras de comportamento
└── MEMORY.md     ← Memória de longo prazo (começa vazio)
```

Modificar `agent-loop.ts` e `skill-executor.ts` para ler e injetar esses arquivos no system prompt.

**Exemplo de SOUL.md:**
```markdown
# GueClaw Identity

Você é GueClaw, assistente pessoal do Moisés.
Tom: direto, técnico, em português.
Nunca diga "vou fazer X" sem fazer. Mostre resultados reais.
Você gerencia uma VPS em 147.93.69.211.
```

**Arquivos:** `src/core/agent-loop/agent-loop.ts`, novo `.agents/workspace/`

---

### 1.3 Compactação de Contexto (Memory Window)

**Problema atual:** O `MEMORY_WINDOW_SIZE=10` simplesmente descarta mensagens antigas sem guardar nada. Conversas longas perdem contexto por completo.

**Como o OpenClaw resolve:**
- Quando a sessão fica grande, compacta o histórico antigo em um **resumo salvo em disco** (JSONL)
- O resumo é preservado nas próximas sessões
- `/compact` permite forçar compactação manualmente

**O que implementar no GueClaw:**

Fase simples (v2.1):
1. Antes de descartar mensagens antigas (quando ultrapassa o window), fazer uma chamada ao LLM pedindo um resumo do que foi descartado
2. Salvar esse resumo em `.agents/workspace/memory/YYYY-MM-DD.md`
3. Injetar o resumo no system prompt das próximas sessões

Fase avançada (v2.2): Implementar `/compactar` como comando do Telegram

**Arquivos:** `src/core/memory/memory-manager.ts`

---

## PRIORIDADE 2 — Alta (impacto significativo na experiência)

### 2.1 Sistema de Memória Persistente (MEMORY.md)

**Problema atual:** A memória atual é só histórico de conversa em SQLite. Quando a janela vence, tudo é perdido. O agente nunca "aprende" nada sobre o usuário.

**Como o OpenClaw resolve:**
```
memory/
├── MEMORY.md           ← Memória curada de longo prazo
├── 2026-03-13.md       ← Log do dia de hoje  
├── 2026-03-12.md       ← Log de ontem
└── heartbeat-state.json ← Estado do último heartbeat
```

**O que implementar no GueClaw:**

1. Criar ferramenta `memory_write` — LLM pode escrever em `.agents/workspace/memory/YYYY-MM-DD.md`
2. Criar ferramenta `memory_read` — LLM pode ler arquivos de memória
3. Adicionar ao system prompt: *"Ao final de conversas importantes, grave memórias relevantes no arquivo de hoje"*
4. Injetar automaticamente o conteúdo de hoje + ontem + MEMORY.md no início de cada sessão

**Ferramentas novas:** `src/tools/memory-tool.ts`

---

### 2.2 Skills Carregadas Sob Demanda

**Problema atual:** Todas as skills são listadas no prompt de roteamento e depois a skill escolhida tem seu SKILL.md inteiro injetado. Com muitas skills, isso desperdiça tokens e confunde o LLM.

**Como o OpenClaw resolve:**
```
## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with `read`, then follow it.
- If none clearly apply: do not read any SKILL.md.
```

O LLM usa a ferramenta `read` para carregar o SKILL.md **durante a execução**, não antes.

**O que implementar no GueClaw:**

1. Mudar `skill-loader.ts` para expor apenas `name`, `description` e `path` (não o conteúdo)
2. Remover a injeção do SKILL.md no system prompt do `skill-executor.ts`
3. Adicionar ao system prompt a lista `<available_skills>` com instructions para o LLM ler via `file_operations`
4. Eliminar o `SkillRouter` separado — o próprio agente decide qual skill usar ao ver as descrições

**Benefício:** Reduz uso de tokens em ~60% para requests que não usam skill.

**Arquivos:** `src/core/skills/skill-loader.ts`, `src/core/skills/skill-executor.ts`, `src/core/skills/skill-router.ts`

---

### 2.3 Comandos de Controle via Telegram

**Problema atual:** Não há forma de controlar o agente via командos do Telegram. Para resetar, precisa ir ao VPS.

**Como o OpenClaw resolve:** `/new`, `/reset`, `/compact`, `/status`, `/stop`

**O que implementar no GueClaw:**

| Comando | Ação |
|---------|------|
| `/limpar` | Reseta o histórico da conversa |
| `/status` | Mostra modelo ativo, histórico, skills carregadas |
| `/skills` | Lista skills disponíveis |
| `/compactar` | Força compactação do contexto |
| `/ajuda` | Lista todos os comandos |

**Arquivos:** `src/handlers/telegram-input-handler.ts`, `src/core/agent-controller.ts`

---

### 2.4 Streaming de Resposta no Telegram

**Problema atual:** O usuário espera o processo inteiro antes de ver qualquer resposta. Para tarefas longas (ex: deploy), o Telegram fica em silêncio por minutos.

**Como o OpenClaw resolve — Block Streaming:**
- Envia um "preview" que vai sendo editado com o conteúdo gerado
- `editMessageText` substitui a mensagem anterior com o texto atualizado

**O que implementar no GueClaw:**

Fase simples (v2.1):
1. Enviar mensagem inicial "⏳ Executando..."
2. Ao completar, editar essa mensagem com a resposta final

Fase avançada (v2.2): Editar a mensagem a cada 2s com o texto parcial gerado até então

**Arquivos:** `src/handlers/telegram-output-handler.ts`

---

## PRIORIDADE 3 — Média (melhorias de qualidade de vida)

### 3.1 Comportamento "Tool Call Style"

**Problema atual:** O LLM frequentemente narra cada passo ("Vou executar o comando... Agora vou verificar...") mesmo em ações simples.

**Como o OpenClaw resolve:**
```
## Tool Call Style
Padrão: não narre chamadas de ferramentas rotineiras de baixo risco (apenas execute a ferramenta).
Narre apenas quando ajuda: trabalho em múltiplos passos, problemas complexos/desafiadores, ações sensíveis.
```

**O que implementar:** Adicionar essa seção ao system prompt. Já parcialmente feito — precisa de refinamento.

---

### 3.2 Limite de Ferramenta por Iteração + Feedback de Erro

**Problema atual:** Quando uma ferramenta falha em mutação (ex: arquivo não criado), o bot pode confirmar sucesso mesmo sem verificar.

**Como o OpenClaw resolve:**
```ts
// Always surface mutating tool failures so we do not silently confirm 
// actions that did not happen.
if (warningPolicy.showWarning) {
  replyItems.push({ text: `⚠️ ${toolSummary} falhou: ${error}`, isError: true });
}
```

**O que implementar:**
1. Em `agent-loop.ts`, ao detectar erro de ferramenta, forçar o LLM a reportar o erro na resposta final
2. Nunca deixar o agente confirmar uma ação mutante (criar, deletar, enviar) sem verificar o resultado da ferramenta

---

### 3.3 Sistema de Heartbeat / Proatividade

**Problema atual:** O agente só age quando recebe mensagem. Não há execução proativa.

**Como o OpenClaw resolve:**
- `HEARTBEAT.md` define tarefas periódicas
- Cron envia heartbeat ao agente
- Se não há nada a fazer, responde `HEARTBEAT_OK` (filtrado, não chega ao usuário)
- Se há algo urgente, envia mensagem proativa

**O que implementar no GueClaw (simples):**
1. `HEARTBEAT.md` em `.agents/workspace/`
2. Cron job na VPS (ou `setInterval`) que envia mensagem interna ao agente a cada X minutos
3. O agente verifica filas de tarefas, cheça se worker está rodando, etc.
4. Respostas `HEARTBEAT_OK` são filtradas antes de ir ao Telegram

**Arquivos:** novo `src/services/heartbeat-service.ts`

---

### 3.4 Resposta de Erro para Ferramenta Mutante

**Problema atual:** Se `vps_execute_command` falha em criar um agendamento, o bot pode ainda assim dizer "agendado com sucesso".

**O que implementar:** Regra no system prompt + verificação explícita no `agent-loop.ts`:
- Se a última ferramenta executada foi mutante E retornou erro → forçar uma resposta de erro, nunca de sucesso
- Adicionar ao prompt: "Para ações irreversíveis, sempre verifique o resultado da ferramenta antes de confirmar"

---

## PRIORIDADE 4 — Baixa / Futura (features avançadas)

### 4.1 Análise de Imagens
- OpenClaw: `image` tool via Gemini/OpenAI Vision
- GueClaw: TODO pendente em `agent-controller.ts`
- **Implementação:** Integrar Gemini Vision API para processar imagens enviadas no Telegram

### 4.2 Transcrição de Áudio (Whisper)
- OpenClaw: Whisper via skill ou node
- GueClaw: TODO pendente em `agent-controller.ts`  
- **Implementação:** Groq Whisper API (gratuito) para transcrever áudios do Telegram

### 4.3 Múltiplos Agentes / Sub-Agentes
- OpenClaw: `sessions_spawn`, `sessions_send`, ACP protocol
- GueClaw: Arquitetura não suporta ainda
- **Implementação:** Fora do escopo v2.x, considerar para v3.0

### 4.4 Vector Memory Search
- OpenClaw: BM25 + vectors + MMR + temporal decay
- GueClaw: Sem indexação semântica
- **Implementação:** SQLite com extensão `sqlite-vec` para embeddings locais via Gemini API (temos a key)

---

## Ordem de Implementação Recomendada

```
v2.1 (curto prazo — 1-2 sessões de trabalho):
├── 1.1 Token NO_REPLY
├── 1.2 Workspace SOUL.md + USER.md
├── 2.3 Comandos /limpar /status
└── 2.4 Streaming simples (editar mensagem)

v2.2 (médio prazo):
├── 1.3 Compactação básica de contexto
├── 2.1 Sistema MEMORY.md
├── 2.2 Skills sob demanda
└── 3.1 Tool Call Style refinado

v2.3 (longo prazo):
├── 3.3 Sistema de heartbeat
├── 4.1 Análise de imagens
└── 4.2 Transcrição de áudio
```

---

## Impacto Esperado

| Melhoria | Impacto na Qualidade | Impacto no Custo de Tokens |
|----------|---------------------|---------------------------|
| NO_REPLY | Elimina respostas duplicadas | Neutro |
| SOUL.md + USER.md | +30% consistência de personalidade | +5% (arquivo pequeno) |
| Compactação | Sessões longas funcionam | -40% em sessões longas |
| Skills sob demanda | +20% eficiência de roteamento | -60% para requests simples |
| Comandos Telegram | Usuabilidade melhor | Neutro |
| Streaming | Feedback visual em tempo real | Neutro |

---

## Referências

- [OpenClaw Agent Loop](https://docs.openclaw.ai/concepts/agent-loop)
- [OpenClaw System Prompt Source](https://github.com/openclaw/openclaw/blob/main/src/agents/system-prompt.ts)
- [OpenClaw tokens.ts (NO_REPLY)](https://github.com/openclaw/openclaw/blob/main/src/auto-reply/tokens.ts)
- [OpenClaw payloads.ts (filtro de resposta)](https://github.com/openclaw/openclaw/blob/main/src/agents/pi-embedded-runner/run/payloads.ts)
- [OpenClaw Memory](https://docs.openclaw.ai/concepts/memory)
- [OpenClaw Compaction](https://docs.openclaw.ai/concepts/compaction)
- [OpenClaw AGENTS.md Template](https://docs.openclaw.ai/reference/templates/AGENTS)
