# Checklist de Melhorias — GueguelClaw v2.x

Baseado na análise do OpenClaw (`comparação.md`).

---

## v2.1 — Fundação (NO_REPLY · Identidade · Comandos · Streaming) ✅ CONCLUÍDO

### 1. Mecanismo NO_REPLY ✅
- [x] Definir constante `NO_REPLY = "NO_REPLY"` em `src/types/index.ts`
- [x] No `agent-loop.ts`: quando `content === "NO_REPLY"`, não adicionar mensagem ao histórico
- [x] `agent-controller.ts`: skip `addAssistantMessage` e `sendResponse` se response === NO_REPLY
- [x] No system prompt do `agent-loop.ts`: instruir o LLM a retornar `NO_REPLY` quando já respondeu via ferramenta

### 2. Workspace de Identidade (SOUL.md / USER.md) ✅
- [x] Criar `.agents/SOUL.md` — personalidade, tom, nome, propósito do agente
- [x] Criar `.agents/USER.md` — informações sobre o dono/usuário principal
- [x] Criar utilitário `src/utils/identity-loader.ts` para ler e concatenar os arquivos de identidade
- [x] No `agent-loop.ts`: `IdentityLoader.prepend()` injeta identidade no system prompt

### 3. Comandos Slash (/limpar, /status, /ajuda) ✅
- [x] Criar `src/handlers/command-handler.ts` para centralizar lógica dos comandos
- [x] No `agent-controller.ts`: detectar `/` e rotear para `CommandHandler.handle()`
- [x] Implementar `/limpar` — limpa histórico da conversa
- [x] Implementar `/status` — provider, histórico, uptime, versão
- [x] Implementar `/ajuda` — lista de comandos

### 4. Streaming Básico ✅
- [x] Implementar `generateStreamingCompletion()` no `deepseek-provider.ts`
- [x] No `telegram-output-handler.ts`: método `sendTypewriter()` — revela a resposta progressivamente via edição de mensagem
- [x] No `agent-controller.ts`: usar `sendTypewriter()` quando `STREAMING_ENABLED=true`
- [x] Variável de env `STREAMING_ENABLED=true/false` para ligar/desligar

---

## v2.2 — Memória e Skills Inteligentes ✅ CONCLUÍDO

### 5. Compactação de Contexto ✅
- [x] Definir limite `CONTEXT_COMPACT_THRESHOLD` (env, padrão 30 mensagens)
- [x] `message-repository.ts`: `getOldMessages(conversationId, windowSize)` — candidatos à compactação
- [x] `message-repository.ts`: `deleteByIds(ids[])` — remoção cirúrgica
- [x] `memory-manager.ts`: `countMessages()`, `getOldMessages()`, `deleteMessages()`, `addCompactSummary()` 
- [x] `agent-controller.ts`: `compactIfNeeded()` — resume via LLM, salva em disco, substitui no DB

### 6. Memória Persistente (MEMORY.md + log diário) ✅
- [x] Criar `src/core/memory/persistent-memory.ts`:
  - `read(userId)` — carrega MEMORY.md + log do dia para injeção no system prompt
  - `loadLastCompact(userId)` — carrega resumo de compactação mais recente
  - `appendLog(userId, entry)` — adiciona entrada ao log diário
  - `curate(userId, fact)` — adiciona fact à MEMORY.md permanente
  - `saveCompact(userId, summary)` — salva resumo de compactação em disco
- [x] `agent-controller.ts`: `buildEnrichment(userId)` — injeta USER_ID + memória + skill manifest no system prompt
- [x] `agent-loop.ts`: novo parâmetro `enrichment?` no constructor — prepende ao system prompt
- [x] Criar ferramenta `src/tools/memory-write-tool.ts` (tool `memory_write` — type: permanent|log)

### 7. Skills Sob Demanda (Lazy Loading) ✅
- [x] `skill-loader.ts`: `loadManifest()` retorna `{name, description, dirName}[]` (sem conteúdo)
- [x] `agent-controller.ts`: manifesto leve injetado no enrichment do system prompt
- [x] Criar ferramenta `src/tools/read-skill-tool.ts` (tool `read_skill` — carrega skill por dirName)
- [x] `skill-executor.ts`: aceita `extraContext?` (enrichment passado pelo AgentController)
- [x] Registrar `MemoryWriteTool` e `ReadSkillTool` em `src/index.ts`

---

## v2.3 — Recursos Avançados ✅ CONCLUÍDO

### 8. Heartbeat Proativo ✅
- [x] Criar `src/services/heartbeat.ts` com scheduler (`setInterval`)
- [x] Configurar via env: `HEARTBEAT_INTERVAL_MINUTES=60`, `HEARTBEAT_ENABLED=true/false`
- [x] Suporte a 4 tipos de monitor: `docker` | `systemd` | `http` | `process`
- [x] Persistência de monitores em `data/heartbeat/monitors.json`
- [x] Enviar alerta ao Telegram via `TelegramNotifier` quando anomalia detectada
- [x] Check imediato 30s após boot, depois em intervalo configurável
- [x] Integrado ao `start()` e `shutdown()` em `src/index.ts`
- [x] Comandos `/monitorar add | remove | list | check` em `command-handler.ts`

### 9. Suporte a Imagens ✅
- [x] `telegram-input-handler.ts`: imagem baixada e path fornecido ao contexto
- [x] `agent-controller.ts`: instrui LLM a chamar `analyze_image` com o caminho da foto
- [x] Criar `src/tools/analyze-image-tool.ts`:
  - Tool `analyze_image(imagePath, prompt?)`
  - Chama OpenAI vision API (GPT-4o) com base64 inline
  - Env: `VISION_ENABLED`, `VISION_MODEL`, `OPENAI_BASE_URL`
  - Proteção contra path traversal
- [x] Registrar `AnalyzeImageTool` em `src/index.ts`

### 10. Suporte a Áudio ✅
- [x] `telegram-input-handler.ts`: auto-transcrição ao receber voz/áudio
  - Quando `AUDIO_TRANSCRIPTION_ENABLED != false`: chama `AudioTool.transcribeFile()`
  - Transcrição salva em `attachment.metadata.transcription`
- [x] `agent-controller.ts`: usa transcrição disponível ou instrui LLM a chamar `transcribe_audio`
- [x] Criar `src/tools/audio-tool.ts`:
  - Tool `transcribe_audio(audioPath, language?)` via Whisper API
  - Helper estático `AudioTool.transcribeFile()` para uso interno
  - Env: `AUDIO_TRANSCRIPTION_ENABLED`, `WHISPER_API_KEY`, `WHISPER_BASE_URL`, `WHISPER_MODEL`, `WHISPER_LANGUAGE`
  - Proteção contra path traversal
- [x] Registrar `AudioTool` em `src/index.ts`

---

## Ordem de Execução Recomendada

```
1  → NO_REPLY                (30 min) — maior impacto imediato, evita spam
2  → SOUL.md + USER.md       (1h)     — define identidade do agente
3  → /limpar + /status       (1h)     — comandos essenciais de operação
4  → Skills sob demanda      (2h)     — economia significativa de tokens
5  → Streaming               (2h)     — UX muito melhor
6  → Compactação de contexto (3h)     — sessões longas sem perda
7  → MEMORY.md               (2h)     — memória persistente entre sessões
8  → Heartbeat               (2h)     — monitoramento proativo
9  → Imagens                 (2h)     — input/output visual
10 → Áudio                   (2h)     — input de voz
```

---

## Arquivos que serão criados/modificados

| Arquivo | Ação | Fase |
|---|---|---|
| `src/types/index.ts` | Adicionar `NO_REPLY` | v2.1 |
| `src/core/agent-loop/agent-loop.ts` | NO_REPLY + identidade + streaming | v2.1/v2.2 |
| `src/handlers/telegram-output-handler.ts` | Filtro NO_REPLY + streaming | v2.1 |
| `src/handlers/telegram-input-handler.ts` | Detectar comandos slash | v2.1 |
| `src/handlers/command-handler.ts` | **NOVO** — lógica dos comandos | v2.1 |
| `src/utils/identity-loader.ts` | **NOVO** — carrega SOUL/USER/AGENTS | v2.1 |
| `.agents/SOUL.md` | **NOVO** — personalidade | v2.1 |
| `.agents/USER.md` | **NOVO** — perfil do usuário | v2.1 |
| `src/core/providers/github-copilot-provider.ts` | Streaming | v2.1 |
| `src/core/providers/deepseek-provider.ts` | Streaming | v2.1 |
| `src/core/memory/memory-manager.ts` | Compactação | v2.2 |
| `src/core/memory/persistent-memory.ts` | **NOVO** — MEMORY.md + log diário | v2.2 |
| `src/core/skills/skill-loader.ts` | Modo manifesto leve | v2.2 |
| `src/core/skills/skill-router.ts` | Adaptar para manifesto | v2.2 |
| `src/services/heartbeat.ts` | **NOVO** — monitor proativo | v2.3 |
| `src/tools/audio-tool.ts` | **NOVO** — transcrição | v2.3 |
