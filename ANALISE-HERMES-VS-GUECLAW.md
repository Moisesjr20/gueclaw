# 🔍 Análise Comparativa: Hermes Agent vs GueClaw

**Data:** 16/04/2026  
**Objetivo:** Identificar melhorias que podemos implementar no GueClaw inspiradas no Hermes Agent

---

## 📊 Executive Summary

O **Hermes Agent** (Nous Research) é um projeto maduro com **93.4k stars**, **463 contribuidores** e releases frequentes (v0.10.0 lançada hoje). É um agente com "closed learning loop" — ele evolui continuamente através de memória curada, criação autônoma de skills e auto-melhorias.

### Principais Diferenciais do Hermes:

1. ✅ **Closed Learning Loop** — Cria e melhora skills autonomamente
2. ✅ **Cron Scheduler Integrado** — Automações desatendidas com entrega multi-plataforma
3. ✅ **Subagentes Paralelos** — Spawn de agentes isolados + RPC tools
4. ✅ **Terminal Backends Múltiplos** — Local, Docker, SSH, Modal (serverless), Daytona
5. ✅ **Context Files de Projeto** — Contexto automático que molda cada conversa
6. ✅ **Honcho User Modeling** — Modelagem dialética profunda do usuário
7. ✅ **FTS5 Session Search** — Busca cross-session com sumarização LLM
8. ✅ **TUI Avançado** — Edição multilinha, autocomplete, interrupt-and-redirect

---

## 🎯 Melhorias Priorizadas para GueClaw

### 🔥 PRIORIDADE 1 — MÁXIMO IMPACTO (Implementar AGORA)

#### 1.1 **CRON SCHEDULER COM ENTREGA MULTI-PLATAFORMA** ⭐⭐⭐⭐⭐

**O que o Hermes tem:**
```bash
hermes cron schedule "Send daily report to Telegram at 7am"
hermes cron schedule "Backup database every night at 2am"
hermes cron schedule "Weekly audit every Monday at 9am"
```

**Por que implementar:**
- **ROI IMEDIATO:** Automações desatendidas = tempo economizado diariamente
- **Use Cases no GueClaw:**
  - Resumo diário da agenda (já existe manual em google-calendar-daily)
  - Backup automático de banco de dados
  - Relatórios semanais de custo LLM
  - Verificação de segurança VPS semanal
  - Sincronização Obsidian vault a cada 6h

**Implementação:**
```typescript
// src/services/cron-scheduler.ts
interface CronTask {
  id: string;
  schedule: string; // cron expression
  prompt: string;   // natural language task
  delivery: 'telegram' | 'whatsapp' | 'obsidian' | 'email';
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

class CronScheduler {
  async schedulleTask(task: CronTask): Promise<void> {
    // Parse cron expression
    // Store in database
    // Register with node-cron
  }
  
  async executeCronTask(task: CronTask): Promise<void> {
    // Run via AgentLoop (como qualquer query normal)
    // Deliver result to specified platform
    // Update lastRun timestamp
  }
}
```

**Skills que se beneficiam:**
- ✅ google-calendar-daily → Automatizar agenda 7h sem código
- ✅ vps-security-scanner → Scan semanal automático
- ✅ obsidian-notes → Sync programado
- ✅ controle-financeiro → Relatórios mensais

**Esforço:** 8-12h  
**Retorno:** Automações que rodam sozinhas para sempre

---

#### 1.2 **CONTEXT FILES DE PROJETO** ⭐⭐⭐⭐⭐

**O que o Hermes tem:**
- Arquivo `.hermes/context.md` que é injetado automaticamente em cada conversa
- O agente "sabe" sobre o projeto sem você repetir contexto

**Como funciona:**
```markdown
<!-- .gueclaw/context.md -->
# GueClaw Context

## Who am I
Moises — advogado, perito judicial, empresário.

## My Preferences
- Relatórios sempre em Markdown com tabelas
- Backup diário às 2h da manhã
- Notificações importantes via Telegram
- Agenda profissional: contato@kyrius.info

## Active Projects
- FluxoHub: Sistema de automação n8n
- Perícia Judicial: Curso + consultoria
- Advocacia: Escritório próprio

## VPS Info
- Host: 147.93.69.211
- Services: Docker, n8n, FluxoHub, GueClaw
- Critical: Sempre verificar se serviços estão up antes de deploy
```

**Benefícios:**
- 🎯 **Respostas personalizadas** sem repetir contexto
- 🎯 **Decisões inteligentes** baseadas em preferências
- 🎯 **Menos tokens** (contexto carregado 1x, não a cada msg)

**Implementação:**
```typescript
// src/core/context-loader.ts
class ContextLoader {
  static loadProjectContext(): string {
    const contextPath = path.join(process.env.WORKSPACE_ROOT, '.gueclaw/context.md');
    if (fs.existsSync(contextPath)) {
      return fs.readFileSync(contextPath, 'utf-8');
    }
    return '';
  }
}

// Em agent-loop.ts
const systemPrompt = `
${this.getDefaultSystemPrompt()}

--- PROJECT CONTEXT ---
${ContextLoader.loadProjectContext()}
`;
```

**Esforço:** 2-3h  
**Retorno:** Personalização profunda + menos repetição

---

#### 1.3 **SLASH COMMANDS RICOS (UX)** ⭐⭐⭐⭐

**O que o Hermes tem:**
| Comando | Ação |
|---------|------|
| `/retry` | Tenta novamente a última resposta |
| `/undo` | Desfaz última mensagem (remove do histórico) |
| `/compress` | Força compactação de contexto |
| `/insights [--days N]` | Análise de conversas dos últimos N dias |
| `/personality [name]` | Muda persona (profissional, casual, técnico) |
| `/usage` | Mostra uso de tokens e custos |

**O que o GueClaw tem:**
| Comando | Ação |
|---------|------|
| `/start` | Welcome message |
| `/help` | Lista comandos |
| `/stats` | Estatísticas |
| `/reload` | Reload skills |
| `/cost [today\|week\|month]` | Custos LLM |
| `/tasks` | Lista tasks |

**Comandos a adicionar:**
```typescript
// src/commands/telegram-commands.ts

// Retry last message (useful when LLM fails)
commandRegistry.register({
  command: 'retry',
  handler: async (ctx) => {
    const lastMessage = await db.getLastUserMessage(ctx.from.id);
    await agentController.processMessage({
      text: lastMessage.text,
      userId: ctx.from.id,
      isRetry: true
    });
  }
});

// Undo last turn
commandRegistry.register({
  command: 'undo',
  handler: async (ctx) => {
    await db.removeLastTurn(ctx.from.id); // Remove user msg + bot response
    await ctx.reply('✅ Última mensagem removida do histórico');
  }
});

// Force context compression
commandRegistry.register({
  command: 'compress',
  handler: async (ctx) => {
    const stats = await contextCompressor.compressNow(ctx.from.id);
    await ctx.reply(`✅ Contexto comprimido:\n• ${stats.before} msgs → ${stats.after} msgs\n• ${stats.tokensSaved} tokens economizados`);
  }
});

// Conversation insights
commandRegistry.register({
  command: 'insights',
  handler: async (ctx, args) => {
    const days = parseInt(args[0]) || 7;
    const insights = await memoryAnalyzer.getInsights(ctx.from.id, days);
    await ctx.reply(`📊 **Insights dos últimos ${days} dias:**\n\n${insights}`);
  }
});

// Switch personality
commandRegistry.register({
  command: 'personality',
  handler: async (ctx, args) => {
    const personality = args[0] || 'default';
    await personalityManager.setPersonality(ctx.from.id, personality);
    await ctx.reply(`🎭 Personalidade alterada para: ${personality}`);
  }
});
```

**Esforço:** 4-6h  
**Retorno:** UX muito melhor, controle fino sobre o agente

---

### 🚀 PRIORIDADE 2 — ALTO IMPACTO (Implementar PRÓXIMA SPRINT)

#### 2.1 **SKILLS AUTO-MELHORÁVEIS** ⭐⭐⭐⭐

**O que o Hermes faz:**
- Durante o uso, se uma skill falha 2x seguidas, o agente automaticamente:
  1. Analisa o erro
  2. Propõe uma correção
  3. Atualiza a skill
  4. Registra a melhoria no changelog

**Como implementar:**
```typescript
// src/core/skills/skill-improver.ts
class SkillImprover {
  async trackSkillExecution(skillName: string, success: boolean, error?: string) {
    const failures = this.getRecentFailures(skillName);
    
    if (failures.length >= 2) {
      // Trigger auto-improvement
      const improvement = await this.analyzeFailuresAndPropose(skillName, failures);
      
      if (improvement.confidence > 0.8) {
        await this.applyImprovement(skillName, improvement);
        await this.logImprovement(skillName, improvement);
      }
    }
  }
  
  private async analyzeFailuresAndPropose(skillName: string, failures: SkillError[]) {
    const prompt = `
Você é um expert em melhorar skills de agentes de IA.

Skill: ${skillName}
Falhas recentes:
${failures.map(f => `- ${f.error}\n  Context: ${f.context}`).join('\n')}

Analise os erros e proponha uma correção para o SKILL.md que previna essas falhas.

Retorne JSON:
{
  "root_cause": "...",
  "proposed_fix": "...",
  "confidence": 0.0-1.0,
  "changes": [
    { "section": "...", "old": "...", "new": "..." }
  ]
}
`;
    
    const response = await llm.generate(prompt);
    return JSON.parse(response);
  }
}
```

**Benefícios:**
- ✅ Skills ficam mais robustas automaticamente
- ✅ Menos falhas recorrentes
- ✅ O agente aprende com os próprios erros

**Esforço:** 10-12h  
**Retorno:** Evolução contínua do agente

---

#### 2.2 **SUBAGENTES PARALELOS (RPC TOOLS)** ⭐⭐⭐⭐

**O que o Hermes tem:**
```python
# user_script.py (roda via tool exec_script)
from hermes_rpc import HermesClient

client = HermesClient()

# Spawn 3 subagents em paralelo
tasks = [
  client.spawn_agent("Analyze logs from last 24h"),
  client.spawn_agent("Check VPS security vulnerabilities"),
  client.spawn_agent("Generate cost report for April")
]

# Wait for all to complete
results = await asyncio.gather(*tasks)

# Combine results
final_report = combine_reports(results)
```

**Benefícios:**
- ✅ **Workstreams paralelas** (3x mais rápido)
- ✅ **Zero custo de contexto** (cada subagent tem contexto limpo)
- ✅ **Isolamento** (erros em um subagent não afetam outros)

**Como implementar no GueClaw:**
```typescript
// src/tools/spawn-subagent-tool.ts
class SpawnSubagentTool extends BaseTool {
  async execute(params: { task: string; timeout?: number }) {
    const subagentId = uuidv4();
    
    // Create isolated agent instance
    const subagent = new IsolatedAgent({
      id: subagentId,
      parentId: this.currentConversationId,
      task: params.task
    });
    
    // Run in background
    const promise = subagent.run();
    
    // Return handle
    return {
      subagentId,
      status: 'running',
      promise // For awaiting later
    };
  }
}

// src/core/isolated-agent.ts
class IsolatedAgent {
  async run() {
    // Fresh context (no parent conversation history)
    const loop = new AgentLoop({
      conversationId: this.id,
      initialMessage: this.task,
      parentId: this.parentId
    });
    
    return await loop.execute();
  }
}
```

**Use Cases:**
- Análise de múltiplos logs simultaneamente
- Scraping de várias páginas em paralelo
- Processamento batch de documentos
- Multi-agent RAG (cada agent analisa um chunk)

**Esforço:** 12-16h  
**Retorno:** Paralelização real + zero context overhead

---

#### 2.3 **HONCHO USER MODELING** ⭐⭐⭐⭐

**O que é Honcho:**
- Sistema de modelagem de usuário que constrói um "perfil profundo"
- Extrai preferências, padrões, comportamentos, valores, estilo
- Usa dialética (tese → antítese → síntese) para refinar o modelo

**Como implementar:**
```typescript
// src/core/memory/user-modeler.ts
interface UserModel {
  userId: string;
  
  // Dialético: múltiplas perspectivas
  perspectives: {
    preferences: KeyValuePair[];      // "Prefere Markdown com tabelas"
    patterns: Pattern[];              // "Sempre pergunta sobre segurança antes de deploy"
    communication_style: string;      // "Direto, técnico, sem firulas"
    values: string[];                 // ["segurança", "eficiência", "automação"]
    goals: Goal[];                    // "Automatizar máximo de tarefas manuais"
  };
  
  // Confidence tracking
  confidences: Map<string, number>;  // 0.0-1.0 para cada fact
  
  // Evolution tracking
  revisions: Revision[];             // Histórico de refinamentos
}

class UserModeler {
  async updateModel(userId: string, newInsight: Insight) {
    const currentModel = await this.getModel(userId);
    
    // Dialectic synthesis
    const synthesis = await this.synthesize(currentModel, newInsight);
    
    // Update model with synthesis
    await this.applyS synthesis(userId, synthesis);
  }
  
  private async synthesize(current: UserModel, new: Insight): Promise<Synthesis> {
    const prompt = `
Você é um expert em modelagem de usuário.

Modelo atual: ${JSON.stringify(current.perspectives)}
Nova observação: ${new.observation}

Use dialética (tese → antítese → síntese) para refinar o modelo:
1. Qual é a tese (modelo atual)?
2. Qual é a antítese (nova observação contradiz ou complementa)?
3. Qual é a síntese (como integrar de forma coerente)?

Retorne JSON com o modelo refinado.
`;
    
    return await llm.generate(prompt);
  }
}
```

**Benefícios:**
- ✅ Personalização profunda sem repetir contexto
- ✅ O agente "te conhece" melhor a cada interação
- ✅ Respostas alinhadas com valores/estilo do usuário

**Esforço:** 14-18h  
**Retorno:** Agente verdadeiramente personalizado

---

#### 2.4 **FTS5 SESSION SEARCH COM SUMARIZAÇÃO LLM** ⭐⭐⭐⭐

**O que o Hermes tem:**
```bash
> /search "como configurar Docker swarm"
```

Busca em TODAS as conversas passadas, acha relevantes, sumariza com LLM:

```
📚 Encontrei 3 conversas relevantes:

1. **12/03/2026 - Docker Swarm Setup** (confidence: 0.92)
   "Você configurou Docker Swarm com 3 nodes. Usou docker swarm init 
    no manager, depois docker swarm join nos workers..."
   
2. **05/02/2026 - Container Orchestration** (confidence: 0.78)
   "Discutimos Kubernetes vs Swarm. Você optou por Swarm pela simplicidade..."

Quer que eu recupere o contexto completo de alguma dessas conversas?
```

**Implementação:**
```typescript
// src/core/memory/session-searcher.ts
class SessionSearcher {
  async searchAcrossSessions(query: string, userId: string): Promise<SearchResult[]> {
    // 1. FTS5 search in SQLite
    const matches = await db.query(`
      SELECT 
        conversation_id, 
        snippet(messages_fts, -1, '<mark>', '</mark>', '...', 30) as snippet,
        rank
      FROM messages_fts
      WHERE messages_fts MATCH ?
        AND user_id = ?
      ORDER BY rank
      LIMIT 10
    `, [query, userId]);
    
    // 2. For each match, get conversation context
    const contexts = await Promise.all(
      matches.map(m => this.getConversationContext(m.conversation_id))
    );
    
    // 3. Summarize with LLM
    const summaries = await llm.generate(`
      Query: "${query}"
      
      Conversas encontradas:
      ${contexts.map((c, i) => `${i+1}. ${c.date} - ${c.messages}`).join('\n\n')}
      
      Crie um resumo de 2-3 linhas para cada conversa, focando em:
      - O que foi resolvido
      - Decisões tomadas
      - Comandos/configurações importantes
    `);
    
    return summaries;
  }
}
```

**Benefícios:**
- ✅ **Recall de longo prazo** — "Como fiz aquilo 3 meses atrás?"
- ✅ **Redescoberta de conhecimento** — Evita repetir trabalho
- ✅ **Cross-session learning** — Conexões entre conversas

**Esforço:** 8-10h  
**Retorno:** Memória de elefante

---

### 📈 PRIORIDADE 3 — MÉDIO IMPACTO (Backlog)

#### 3.1 **TERMINAL BACKENDS MÚLTIPLOS** ⭐⭐⭐

**O que o Hermes tem:**
- **Local:** Executa no shell local
- **Docker:** Executa dentro de container
- **SSH:** Executa em servidor remoto (GueClaw já tem)
- **Modal:** Serverless — ambiente hiberna quando ocioso, wakes on demand
- **Daytona:** Dev environment as code
- **Singularity:** HPC containers

**Benefício do Modal/Daytona:**
- **$0 quando ocioso** — Paga só quando processa
- **Escala automática** — Se precisar de GPU, provisiona
- **Persistência** — Estado preservado entre invocações

**GueClaw atual:**
- Apenas SSH para VPS

**Implementação:**
```typescript
// src/tools/backends/terminal-backend.ts
interface TerminalBackend {
  exec(command: string): Promise<string>;
  upload(localPath: string, remotePath: string): Promise<void>;
  download(remotePath: string, localPath: string): Promise<void>;
}

class SSHBackend implements TerminalBackend { /* já existe */ }
class DockerBackend implements TerminalBackend { /* novo */ }
class LocalBackend implements TerminalBackend { /* novo */ }
class ModalBackend implements TerminalBackend { /* novo - serverless */ }
```

**Esforço:** 10-14h (por backend)  
**Retorno:** Flexibilidade + cost optimization

---

#### 3.2 **TUI AVANÇADO (Terminal UI)** ⭐⭐

**O que o Hermes tem:**
- Edição multilinha com Ctrl+Enter
- Autocomplete de comandos (Tab)
- Histórico navegável (↑↓)
- Interrupt-and-redirect (Ctrl+C não mata, apenas interrompe)
- Streaming de tool output (vê em tempo real)

**GueClaw atual:**
- Telegram only (sem CLI interativo)

**Vale implementar?**
- **Não prioritário** — Telegram já é excelente interface
- **Talvez futuro** — Se quiser controle local sem internet

**Esforço:** 20-30h  
**Retorno:** Baixo (Telegram já resolve)

---

## ✅ Pontos Onde GueClaw Está Melhor ou Igual

| Feature | Hermes | GueClaw | Vencedor |
|---------|--------|---------|----------|
| **MCP Integration** | ✅ Sim | ✅ 115+ tools | 🟰 Empate |
| **Telegram** | ✅ Via Gateway | ✅ Nativo | 🟰 Empate |
| **WhatsApp** | ✅ Via Gateway | ✅ UazAPI Nativo | 🏆 **GueClaw** |
| **Google Calendar** | ❌ Não mencionado | ✅ Integração completa | 🏆 **GueClaw** |
| **Obsidian Notes** | ❌ Não mencionado | ✅ Sync via GitHub | 🏆 **GueClaw** |
| **Cost Tracking** | ❓ Básico | ✅ Phase 2.3 completa | 🏆 **GueClaw** |
| **Advanced Memory** | ✅ FTS5 + Honcho | ✅ Phase 3.2 (extraction) | 🟰 Empate |
| **DVACE Architecture** | ❌ Não tem | ✅ Completa | 🏆 **GueClaw** |
| **Leads Campaign** | ❌ Não tem | ✅ whatsapp-leads-sender | 🏆 **GueClaw** |
| **Cron Scheduler** | ✅ Integrado | ❌ Manual (skills isoladas) | 🏆 **Hermes** |
| **Subagentes Paralelos** | ✅ RPC Tools | ❌ Não tem | 🏆 **Hermes** |
| **Skills Auto-Improve** | ✅ Durante uso | ⚠️ Manual (self-improvement) | 🏆 **Hermes** |
| **Context Files** | ✅ Automático | ❌ Não tem | 🏆 **Hermes** |
| **FTS5 Search** | ✅ Cross-session | ⚠️ Básico | 🏆 **Hermes** |

---

## 🎯 Plano de Implementação Recomendado

### Sprint 1 (Esta Semana) — 16-20h
1. ✅ **Context Files de Projeto** (2-3h) → Personalização imediata
2. ✅ **Slash Commands Ricos** (4-6h) → UX muito melhor
3. ✅ **Cron Scheduler** (8-12h) → Automações desatendidas

**Entrega:** GueClaw com contexto personalizado + comandos ricos + automações

---

### Sprint 2 (Semana seguinte) — 20-24h
4. ✅ **Skills Auto-Melhoráveis** (10-12h) → Evolução contínua
5. ✅ **FTS5 Session Search** (8-10h) → Recall de longo prazo

**Entrega:** GueClaw que aprende e lembra de tudo

---

### Sprint 3 (Backlog — quando tiver tempo) — 12-16h
6. ✅ **Subagentes Paralelos** (12-16h) → Paralelização real

**Entrega:** GueClaw com multi-agent workflows

---

### Sprint 4 (Futuro — baixa prioridade)
7. ⚠️ **Honcho User Modeling** (14-18h) — Já temos memory extraction
8. ⚠️ **Terminal Backends** (10-14h cada) — SSH já resolve
9. ⚠️ **TUI Avançado** (20-30h) — Telegram já resolve

---

## 📝 Conclusão

### GueClaw tem pontos fortes únicos:
- ✅ **WhatsApp nativo** (UazAPI)
- ✅ **Google Calendar integration**
- ✅ **Obsidian sync**
- ✅ **Cost tracking robusto**
- ✅ **DVACE architecture**
- ✅ **Leads campaign system**

### Hermes tem features que valem muito implementar:
1. **Cron Scheduler** → ROI IMEDIATO
2. **Context Files** → Personalização sem repetição
3. **Slash Commands Ricos** → UX superior
4. **Skills Auto-Improve** → Evolução contínua
5. **FTS5 Search** → Memória de longo prazo
6. **Subagentes Paralelos** → Paralelização real

### Recomendação Final:

**Implementar Sprints 1 e 2** (40-44h total) trará:
- Automações desatendidas (economiza horas/dia)
- UX muito melhor (comandos ricos)
- Personalização profunda (context files)
- Evolução contínua (auto-improve)
- Recall total (FTS5 search)

**ROI estimado:** Cada hora investida economiza 10-20h de trabalho manual futuro.

---

**Próximo Passo Sugerido:**  
Começar com **Context Files** (2-3h) — é a feature de menor esforço com impacto visível imediato. Depois Cron Scheduler.

