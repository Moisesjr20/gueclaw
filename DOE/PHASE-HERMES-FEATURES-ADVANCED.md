# 🚀 PHASE HERMES: Features Avançadas (Parte 2)

**Continuação de:** [PHASE-HERMES-FEATURES-IMPLEMENTATION.md](./PHASE-HERMES-FEATURES-IMPLEMENTATION.md)

---

## 🔄 FEATURE 4: SKILLS AUTO-MELHORÁVEIS (10-12h)

### 🎯 Objetivo
Skills detectam falhas recorrentes e se auto-corrigem, evoluindo automaticamente durante o uso.

### 📚 Aprendizados do Hermes

**Como funciona:**
1. **Tracking de Execuções:** Cada execução de skill é registrada (sucesso/falha)
2. **Detecção de Padrões:** Se uma skill falha 2x+ seguidas no mesmo contexto
3. **Análise Automática:** LLM analisa os erros e propõe correção
4. **Auto-Aplicação:** Se confiança > 0.8, aplica correção automaticamente
5. **Changelog:** Registra melhoria para auditoria

### 🏗️ Arquitetura GueClaw

```
.agents/skills/
├── google-calendar-events/
│   ├── SKILL.md
│   └── .changelog.md          ← Auto-gerado (histórico de melhorias)
└── ...

data/
└── skill-execution-log.db      ← SQLite tracking
```

### 📝 Implementação

#### 4.1 Skill Execution Tracker (2h)

```typescript
// src/core/skills/skill-execution-tracker.ts

import { DatabaseConnection } from '../memory/database';

export interface SkillExecution {
  id: string;
  skillName: string;
  success: boolean;
  errorMessage?: string;
  errorType?: string;        // 'api_error', 'validation_error', 'runtime_error'
  context: string;            // JSON: { params, userPrompt, ... }
  timestamp: number;
  userId: string;
}

export class SkillExecutionTracker {
  private static TABLE_NAME = 'skill_executions';
  
  /**
   * Initialize tracking table
   */
  static initialize(): void {
    const db = DatabaseConnection.getInstance();
    
    db.run(`
      CREATE TABLE IF NOT EXISTS ${this.TABLE_NAME} (
        id TEXT PRIMARY KEY,
        skill_name TEXT NOT NULL,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        error_type TEXT,
        context TEXT,
        timestamp INTEGER NOT NULL,
        user_id TEXT NOT NULL,
        
        INDEX idx_skill_timestamp ON ${this.TABLE_NAME}(skill_name, timestamp DESC),
        INDEX idx_skill_success ON ${this.TABLE_NAME}(skill_name, success, timestamp DESC)
      )
    `);
  }
  
  /**
   * Track a skill execution
   */
  static async track(execution: Omit<SkillExecution, 'id' | 'timestamp'>): Promise<void> {
    const db = DatabaseConnection.getInstance();
    
    const record: SkillExecution = {
      id: `exec_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      timestamp: Date.now(),
      ...execution
    };
    
    await db.run(
      `INSERT INTO ${this.TABLE_NAME} 
       (id, skill_name, success, error_message, error_type, context, timestamp, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.id,
        record.skillName,
        record.success ? 1 : 0,
        record.errorMessage,
        record.errorType,
        record.context,
        record.timestamp,
        record.userId
      ]
    );
  }
  
  /**
   * Get recent failures for a skill (last 24h)
   */
  static async getRecentFailures(skillName: string, hours = 24): Promise<SkillExecution[]> {
    const db = DatabaseConnection.getInstance();
    const since = Date.now() - (hours * 60 * 60 * 1000);
    
    const rows = await db.query<any>(
      `SELECT * FROM ${this.TABLE_NAME}
       WHERE skill_name = ?
         AND success = 0
         AND timestamp >= ?
       ORDER BY timestamp DESC
       LIMIT 10`,
      [skillName, since]
    );
    
    return rows.map(r => ({
      id: r.id,
      skillName: r.skill_name,
      success: r.success === 1,
      errorMessage: r.error_message,
      errorType: r.error_type,
      context: r.context,
      timestamp: r.timestamp,
      userId: r.user_id
    }));
  }
  
  /**
   * Get failure pattern (same error multiple times)
   */
  static async detectFailurePattern(skillName: string): Promise<{
    hasPattern: boolean;
    errorMessage?: string;
    occurrences?: number;
    contexts?: string[];
  }> {
    const failures = await this.getRecentFailures(skillName, 72); // 3 days
    
    if (failures.length < 2) {
      return { hasPattern: false };
    }
    
    // Group by error message (normalized)
    const errorGroups = new Map<string, SkillExecution[]>();
    
    failures.forEach(f => {
      const normalized = this.normalizeError(f.errorMessage || '');
      const group = errorGroups.get(normalized) || [];
      group.push(f);
      errorGroups.set(normalized, group);
    });
    
    // Find largest group
    let maxGroup: SkillExecution[] = [];
    let maxError = '';
    
    errorGroups.forEach((group, error) => {
      if (group.length > maxGroup.length) {
        maxGroup = group;
        maxError = error;
      }
    });
    
    if (maxGroup.length >= 2) {
      return {
        hasPattern: true,
        errorMessage: maxGroup[0].errorMessage,
        occurrences: maxGroup.length,
        contexts: maxGroup.map(f => f.context)
      };
    }
    
    return { hasPattern: false };
  }
  
  /**
   * Normalize error message for pattern matching
   */
  private static normalizeError(error: string): string {
    // Remove timestamps, IDs, dynamic values
    return error
      .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/g, 'TIMESTAMP')
      .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, 'UUID')
      .replace(/\b\d+\b/g, 'NUM')
      .toLowerCase()
      .trim();
  }
}
```

#### 4.2 Skill Improver (4-5h)

```typescript
// src/core/skills/skill-improver.ts

import * as fs from 'fs';
import * as path from 'path';
import { SkillExecutionTracker } from './skill-execution-tracker';
import { ProviderFactory } from '../providers/provider-factory';
import { SkillLoader } from './skill-loader';

export interface SkillImprovement {
  skillName: string;
  rootCause: string;
  proposedFix: string;
  confidence: number;
  changes: Array<{
    section: string;
    oldText: string;
    newText: string;
  }>;
  timestamp: number;
}

export class SkillImprover {
  private static CHANGELOG_FILENAME = '.changelog.md';
  
  /**
   * Check if skill needs improvement and apply if confidence is high
   */
  static async checkAndImprove(skillName: string): Promise<SkillImprovement | null> {
    // 1. Detect failure pattern
    const pattern = await SkillExecutionTracker.detectFailurePattern(skillName);
    
    if (!pattern.hasPattern || !pattern.errorMessage) {
      return null;
    }
    
    console.log(`🔍 Detected failure pattern in skill: ${skillName}`);
    console.log(`   Error: ${pattern.errorMessage}`);
    console.log(`   Occurrences: ${pattern.occurrences}`);
    
    // 2. Analyze and propose fix
    const improvement = await this.analyzeAndPropose(skillName, pattern);
    
    if (!improvement) {
      console.log(`❌ Could not generate improvement for ${skillName}`);
      return null;
    }
    
    console.log(`💡 Proposed improvement for ${skillName}`);
    console.log(`   Confidence: ${improvement.confidence}`);
    console.log(`   Root cause: ${improvement.rootCause}`);
    
    // 3. Auto-apply if confidence is high
    if (improvement.confidence >= 0.8) {
      await this.applyImprovement(improvement);
      console.log(`✅ Auto-applied improvement to ${skillName}`);
      return improvement;
    } else {
      console.log(`⚠️ Confidence too low (${improvement.confidence}), skipping auto-apply`);
      // TODO: Queue for manual review
      return improvement;
    }
  }
  
  /**
   * Analyze failures and propose fix using LLM
   */
  private static async analyzeAndPropose(
    skillName: string,
    pattern: { errorMessage?: string; contexts?: string[] }
  ): Promise<SkillImprovement | null> {
    const skillPath = SkillLoader.getSkillPath(skillName);
    if (!skillPath) return null;
    
    const skillContent = fs.readFileSync(path.join(skillPath, 'SKILL.md'), 'utf-8');
    
    const prompt = `Você é um expert em melhorar skills de agentes de IA.

**Skill:** ${skillName}

**Conteúdo do SKILL.md:**
\`\`\`markdown
${skillContent}
\`\`\`

**Erro recorrente:**
${pattern.errorMessage}

**Contextos onde ocorreu:**
${pattern.contexts?.slice(0, 3).map((c, i) => `${i + 1}. ${c}`).join('\n')}

**Sua tarefa:**
1. Identifique a causa raiz do erro
2. Proponha uma correção específica para o SKILL.md
3. Indique seções específicas a modificar

**Retorne JSON:**
{
  "root_cause": "Explicação da causa raiz",
  "proposed_fix": "Descrição da correção",
  "confidence": 0.0-1.0,
  "changes": [
    {
      "section": "Nome da seção (ex: System Prompt, Tool Mapping, Examples)",
      "old_text": "Texto exato a substituir (máx 500 chars)",
      "new_text": "Novo texto"
    }
  ]
}

**Regras:**
- Confiança alta (>0.8) apenas se tiver certeza da correção
- Mudanças devem ser cirúrgicas (não reescrever skill inteira)
- old_text deve ser substring exata do SKILL.md`;

    try {
      const provider = ProviderFactory.getProvider();
      const response = await provider.generateCompletion({
        model: 'github-copilot', // Use main model
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1, // Low temperature for consistency
        max_tokens: 2000
      });
      
      // Extract JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        console.error('❌ LLM response did not contain valid JSON');
        return null;
      }
      
      const parsed = JSON.parse(jsonMatch[0]);
      
      return {
        skillName,
        rootCause: parsed.root_cause,
        proposedFix: parsed.proposed_fix,
        confidence: parsed.confidence,
        changes: parsed.changes,
        timestamp: Date.now()
      };
      
    } catch (error: any) {
      console.error(`❌ Error analyzing skill ${skillName}:`, error.message);
      return null;
    }
  }
  
  /**
   * Apply improvement to skill file
   */
  private static async applyImprovement(improvement: SkillImprovement): Promise<void> {
    const skillPath = SkillLoader.getSkillPath(improvement.skillName);
    if (!skillPath) throw new Error(`Skill path not found: ${improvement.skillName}`);
    
    const skillFile = path.join(skillPath, 'SKILL.md');
    let content = fs.readFileSync(skillFile, 'utf-8');
    
    // Apply each change
    improvement.changes.forEach((change, index) => {
      if (content.includes(change.oldText)) {
        content = content.replace(change.oldText, change.newText);
        console.log(`✅ Applied change ${index + 1}/${improvement.changes.length} to ${change.section}`);
      } else {
        console.warn(`⚠️ Could not find old_text in ${change.section}, skipping`);
      }
    });
    
    // Write updated skill
    fs.writeFileSync(skillFile, content, 'utf-8');
    
    // Update changelog
    this.appendChangelog(skillPath, improvement);
    
    // Reload skill
    SkillLoader.reloadSkill(improvement.skillName);
  }
  
  /**
   * Append improvement to changelog
   */
  private static appendChangelog(skillPath: string, improvement: SkillImprovement): void {
    const changelogPath = path.join(skillPath, this.CHANGELOG_FILENAME);
    
    const entry = `
## ${new Date().toISOString().split('T')[0]} - Auto-Improvement

**Root Cause:** ${improvement.rootCause}

**Fix Applied:** ${improvement.proposedFix}

**Confidence:** ${improvement.confidence}

**Changes:**
${improvement.changes.map((c, i) => `${i + 1}. **${c.section}:** ${c.newText.substring(0, 100)}...`).join('\n')}

---
`;
    
    if (fs.existsSync(changelogPath)) {
      const existing = fs.readFileSync(changelogPath, 'utf-8');
      fs.writeFileSync(changelogPath, entry + existing, 'utf-8');
    } else {
      fs.writeFileSync(changelogPath, `# Skill Changelog\n\n${entry}`, 'utf-8');
    }
  }
}
```

#### 4.3 Hook into Skill Executor (1h)

```typescript
// src/core/skills/skill-executor.ts

import { SkillExecutionTracker } from './skill-execution-tracker';
import { SkillImprover } from './skill-improver';

export class SkillExecutor {
  // ... existing code ...
  
  async executeSkill(skillName: string, params: any): Promise<any> {
    const startTime = Date.now();
    let success = false;
    let error: Error | undefined;
    
    try {
      // Existing execution logic
      const result = await this.doExecuteSkill(skillName, params);
      success = true;
      
      // Track successful execution
      await SkillExecutionTracker.track({
        skillName,
        success: true,
        context: JSON.stringify({ params }),
        userId: params.userId || 'system'
      });
      
      return result;
      
    } catch (err: any) {
      success = false;
      error = err;
      
      // Track failed execution
      await SkillExecutionTracker.track({
        skillName,
        success: false,
        errorMessage: err.message,
        errorType: this.classifyError(err),
        context: JSON.stringify({ params, stack: err.stack }),
        userId: params.userId || 'system'
      });
      
      // Trigger improvement check (async, don't block)
      this.checkForImprovementAsync(skillName);
      
      throw err;
    }
  }
  
  /**
   * Check for improvement opportunity (async, non-blocking)
   */
  private async checkForImprovementAsync(skillName: string): Promise<void> {
    // Run in background, don't block main execution
    setImmediate(async () => {
      try {
        await SkillImprover.checkAndImprove(skillName);
      } catch (err: any) {
        console.error(`Error checking improvement for ${skillName}:`, err.message);
      }
    });
  }
  
  /**
   * Classify error type
   */
  private classifyError(error: Error): string {
    if (error.message.includes('API')) return 'api_error';
    if (error.message.includes('validation')) return 'validation_error';
    if (error.message.includes('timeout')) return 'timeout_error';
    return 'runtime_error';
  }
}
```

#### 4.4 Manual Improvement Command (1h)

```typescript
// src/commands/improve-skill-command.ts

import { SkillImprover } from '../core/skills/skill-improver';

CommandRegistry.register({
  command: 'improve',
  description: 'Analisa e melhora uma skill manualmente',
  handler: async (ctx, args) => {
    const skillName = args[0];
    
    if (!skillName) {
      await ctx.reply('❌ Uso: /improve <skill-name>');
      return;
    }
    
    await ctx.reply(`🔍 Analisando skill: ${skillName}...`);
    
    const improvement = await SkillImprover.checkAndImprove(skillName);
    
    if (!improvement) {
      await ctx.reply(`✅ Nenhuma melhoria necessária para ${skillName}`);
      return;
    }
    
    let response = `💡 **Melhoria Proposta para ${skillName}**\n\n`;
    response += `**Causa Raiz:** ${improvement.rootCause}\n\n`;
    response += `**Correção:** ${improvement.proposedFix}\n\n`;
    response += `**Confiança:** ${improvement.confidence}\n\n`;
    
    if (improvement.confidence >= 0.8) {
      response += `✅ Melhoria aplicada automaticamente!`;
    } else {
      response += `⚠️ Confiança baixa — melhoria NÃO aplicada automaticamente.\n`;
      response += `Use /improve-force ${skillName} para forçar.`;
    }
    
    await ctx.reply(response);
  }
});
```

### ✅ Critérios de Aceitação

- [ ] Tracking de execuções em SQLite
- [ ] Detecção de padrões de falha (2+ ocorrências)
- [ ] Análise automática via LLM
- [ ] Auto-aplicação se confiança > 0.8
- [ ] Changelog automático (.changelog.md)
- [ ] Comando `/improve <skill>` para forçar análise
- [ ] Reload automático de skill após melhoria
- [ ] Notificação no Telegram sobre melhorias aplicadas

### 📊 Exemplo de Melhoria

**Cenário:** Skill `google-calendar-events` falhando com "Invalid time format"

**Tracking detecta:**
- 3 falhas em 24h
- Erro: "Invalid time format: '14h'"
- Contexto: Usuário usa "14h" em vez de "14:00"

**LLM analisa e propõe:**
```json
{
  "root_cause": "Skill não normaliza input de horário brasileiro (14h → 14:00)",
  "proposed_fix": "Adicionar regex para converter '14h' para '14:00' antes de validar",
  "confidence": 0.92,
  "changes": [
    {
      "section": "Time Parsing Logic",
      "old_text": "const timeRegex = /^\\d{2}:\\d{2}$/;",
      "new_text": "const timeRegex = /^\\d{2}(:|h)\\d{2}$/;\ntime = time.replace('h', ':');"
    }
  ]
}
```

**Sistema aplica automaticamente** (confidence > 0.8)

**Resultado:** Próxima vez que usuário digitar "14h", skill funciona!

---

## 🔍 FEATURE 5: FTS5 SESSION SEARCH (8-10h)

### 🎯 Objetivo
Busca semântica em TODAS as conversas passadas usando FTS5 (SQLite Full-Text Search) + sumarização LLM.

### 📚 Aprendizados do Hermes

**Arquivo:** `tools/session_search_tool.py`

**Como funciona:**
1. **FTS5 Index:** SQLite FTS5 indexa todas as mensagens
2. **Search:** Query retorna matches ranqueados por relevância
3. **Grouping:** Agrupa matches por sessão
4. **Truncate:** Pega contexto ao redor do match (~100k chars)
5. **Summarize:** LLM sumariza cada sessão encontrada
6. **Return:** Resumos estruturados com metadata

### 🏗️ Arquitetura GueClaw

```sql
-- Existing messages table
CREATE TABLE messages (...);

-- New FTS5 virtual table
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  conversation_id UNINDEXED,
  role UNINDEXED,
  timestamp UNINDEXED,
  content='messages',
  content_rowid='id'
);

-- Triggers to keep FTS5 in sync
CREATE TRIGGER messages_ai AFTER INSERT ON messages ...
CREATE TRIGGER messages_ad AFTER DELETE ON messages ...
CREATE TRIGGER messages_au AFTER UPDATE ON messages ...
```

### 📝 Implementação

#### 5.1 FTS5 Schema Migration (1h)

```typescript
// src/core/memory/migrations/002-fts5-search.ts

import { DatabaseConnection } from '../database';

export async function migrateFTS5(): Promise<void> {
  const db = DatabaseConnection.getInstance();
  
  console.log('🔍 Creating FTS5 index for messages...');
  
  // 1. Create FTS5 virtual table
  await db.run(`
    CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
      content,
      conversation_id UNINDEXED,
      role UNINDEXED,
      timestamp UNINDEXED,
      content='messages',
      content_rowid='id'
    )
  `);
  
  // 2. Populate with existing messages
  await db.run(`
    INSERT INTO messages_fts (rowid, content, conversation_id, role, timestamp)
    SELECT id, content, conversation_id, role, created_at
    FROM messages
    WHERE content IS NOT NULL AND content != ''
  `);
  
  // 3. Create triggers to keep in sync
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
      INSERT INTO messages_fts (rowid, content, conversation_id, role, timestamp)
      VALUES (new.id, new.content, new.conversation_id, new.role, new.created_at);
    END
  `);
  
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
      DELETE FROM messages_fts WHERE rowid = old.id;
    END
  `);
  
  await db.run(`
    CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
      UPDATE messages_fts
      SET content = new.content,
          conversation_id = new.conversation_id,
          role = new.role,
          timestamp = new.created_at
      WHERE rowid = new.id;
    END
  `);
  
  console.log('✅ FTS5 index created and populated');
}
```

#### 5.2 Session Searcher (4-5h)

```typescript
// src/core/memory/session-searcher.ts

import { DatabaseConnection } from './database';
import { ProviderFactory } from '../providers/provider-factory';

export interface SearchMatch {
  conversationId: string;
  messageId: number;
  snippet: string;
  rank: number;
  timestamp: number;
}

export interface SessionSummary {
  conversationId: string;
  date: string;
  title: string;
  summary: string;
  relevance: number;
  messageCount: number;
}

export class SessionSearcher {
  /**
   * Search across all sessions with FTS5
   */
  static async searchSessions(
    query: string,
    userId: string,
    options: {
      maxSessions?: number;
      maxSessionChars?: number;
      summarize?: boolean;
    } = {}
  ): Promise<SessionSummary[]> {
    const maxSessions = options.maxSessions || 5;
    const maxSessionChars = options.maxSessionChars || 100000;
    const summarize = options.summarize !== false;
    
    // 1. FTS5 search
    const matches = await this.searchFTS5(query, userId);
    
    if (matches.length === 0) {
      return [];
    }
    
    // 2. Group by conversation
    const sessionMatches = this.groupBySession(matches);
    
    // 3. Take top N sessions
    const topSessions = sessionMatches.slice(0, maxSessions);
    
    // 4. Load conversation context
    const sessions = await Promise.all(
      topSessions.map(sm => this.loadSessionContext(sm, query, maxSessionChars))
    );
    
    // 5. Summarize with LLM (if enabled)
    if (summarize) {
      return await this.summarizeSessions(sessions, query);
    }
    
    return sessions.map(s => ({
      conversationId: s.conversationId,
      date: new Date(s.timestamp).toLocaleDateString(),
      title: s.title || 'Untitled',
      summary: s.snippet,
      relevance: s.rank,
      messageCount: s.messageCount
    }));
  }
  
  /**
   * FTS5 full-text search
   */
  private static async searchFTS5(query: string, userId: string): Promise<SearchMatch[]> {
    const db = DatabaseConnection.getInstance();
    
    // Prepare FTS5 query (handle phrases, etc)
    const ftsQuery = this.prepareFTSQuery(query);
    
    const rows = await db.query<any>(`
      SELECT 
        mft.rowid as message_id,
        mft.conversation_id,
        mft.role,
        mft.timestamp,
        snippet(messages_fts, -1, '<mark>', '</mark>', '...', 30) as snippet,
        rank as relevance
      FROM messages_fts mft
      JOIN conversations c ON mft.conversation_id = c.id
      WHERE messages_fts MATCH ?
        AND c.telegram_user_id = ?
      ORDER BY rank
      LIMIT 50
    `, [ftsQuery, userId]);
    
    return rows.map(r => ({
      conversationId: r.conversation_id,
      messageId: r.message_id,
      snippet: r.snippet,
      rank: Math.abs(r.relevance), // FTS5 rank is negative
      timestamp: r.timestamp
    }));
  }
  
  /**
   * Prepare FTS5 query (handle special chars, phrases)
   */
  private static prepareFTSQuery(query: string): string {
    // Escape special FTS5 chars: " * ( ) < > :
    let escaped = query.replace(/[\"*()<>:]/g, ' ');
    
    // Convert multiple spaces to single
    escaped = escaped.replace(/\s+/g, ' ').trim();
    
    // If multiple words, treat as phrase search
    if (escaped.split(' ').length > 1) {
      return `"${escaped}"`;
    }
    
    return escaped;
  }
  
  /**
   * Group matches by session and rank sessions
   */
  private static groupBySession(matches: SearchMatch[]): Array<{
    conversationId: string;
    matches: SearchMatch[];
    avgRank: number;
    latestTimestamp: number;
  }> {
    const grouped = new Map<string, SearchMatch[]>();
    
    matches.forEach(m => {
      const existing = grouped.get(m.conversationId) || [];
      existing.push(m);
      grouped.set(m.conversationId, existing);
    });
    
    const sessions = Array.from(grouped.entries()).map(([convId, matches]) => ({
      conversationId: convId,
      matches,
      avgRank: matches.reduce((sum, m) => sum + m.rank, 0) / matches.length,
      latestTimestamp: Math.max(...matches.map(m => m.timestamp))
    }));
    
    // Sort by relevance (lower rank = better)
    return sessions.sort((a, b) => a.avgRank - b.avgRank);
  }
  
  /**
   * Load full conversation context for a session
   */
  private static async loadSessionContext(
    session: { conversationId: string; matches: SearchMatch[]; avgRank: number },
    query: string,
    maxChars: number
  ): Promise<any> {
    const db = DatabaseConnection.getInstance();
    
    // Get all messages in conversation
    const messages = await db.query<any>(`
      SELECT id, role, content, tool_name, created_at
      FROM messages
      WHERE conversation_id = ?
      ORDER BY created_at ASC
    `, [session.conversationId]);
    
    // Get conversation metadata
    const [conv] = await db.query<any>(`
      SELECT created_at, title FROM conversations WHERE id = ?
    `, [session.conversationId]);
    
    // Format conversation
    const formatted = this.formatConversation(messages);
    
    // Truncate around matches
    const truncated = this.truncateAroundMatches(formatted, query, maxChars);
    
    return {
      conversationId: session.conversationId,
      timestamp: conv.created_at,
      title: conv.title,
      messageCount: messages.length,
      rank: session.avgRank,
      content: truncated,
      snippet: session.matches[0].snippet
    };
  }
  
  /**
   * Format messages into readable transcript
   */
  private static formatConversation(messages: any[]): string {
    return messages.map(m => {
      const role = m.role.toUpperCase();
      const content = m.content || '';
      
      if (m.role === 'tool') {
        const truncated = content.length > 500 
          ? content.substring(0, 250) + '\n...[truncated]...\n' + content.substring(content.length - 250)
          : content;
        return `[TOOL:${m.tool_name}]: ${truncated}`;
      }
      
      return `[${role}]: ${content}`;
    }).join('\n\n');
  }
  
  /**
   * Truncate conversation around query matches
   */
  private static truncateAroundMatches(
    fullText: string,
    query: string,
    maxChars: number
  ): string {
    if (fullText.length <= maxChars) {
      return fullText;
    }
    
    // Find all positions where query appears (case-insensitive)
    const positions: number[] = [];
    const lowerText = fullText.toLowerCase();
    const lowerQuery = query.toLowerCase();
    
    let pos = lowerText.indexOf(lowerQuery);
    while (pos !== -1) {
      positions.push(pos);
      pos = lowerText.indexOf(lowerQuery, pos + 1);
    }
    
    if (positions.length === 0) {
      // No exact match, take from start
      return fullText.substring(0, maxChars) + '\n\n...[truncated]...';
    }
    
    // Find window that covers most positions
    const windowStart = this.findBestWindow(positions, fullText.length, maxChars);
    const windowEnd = Math.min(windowStart + maxChars, fullText.length);
    
    let result = fullText.substring(windowStart, windowEnd);
    
    if (windowStart > 0) {
      result = '...[earlier conversation]...\n\n' + result;
    }
    
    if (windowEnd < fullText.length) {
      result += '\n\n...[later conversation]...';
    }
    
    return result;
  }
  
  /**
   * Find window start that covers most match positions
   */
  private static findBestWindow(positions: number[], textLength: number, windowSize: number): number {
    let bestStart = 0;
    let maxCovered = 0;
    
    // Try each position as window start
    for (const pos of positions) {
      const start = Math.max(0, pos - Math.floor(windowSize / 2));
      const end = start + windowSize;
      
      const covered = positions.filter(p => p >= start && p < end).length;
      
      if (covered > maxCovered) {
        maxCovered = covered;
        bestStart = start;
      }
    }
    
    return bestStart;
  }
  
  /**
   * Summarize sessions with LLM
   */
  private static async summarizeSessions(
    sessions: any[],
    query: string
  ): Promise<SessionSummary[]> {
    const provider = ProviderFactory.getProvider();
    
    const summaries = await Promise.all(
      sessions.map(async session => {
        const prompt = `Você é um expert em sumarização de conversas.

**Query do usuário:** "${query}"

**Conversa encontrada (${new Date(session.timestamp).toLocaleDateString()}):**
\`\`\`
${session.content}
\`\`\`

**Sua tarefa:**
Crie um resumo de 2-3 linhas focado em:
- O que foi discutido/resolvido relacionado ao query
- Decisões tomadas
- Comandos/configurações importantes
- Arquivos criados ou modificados

Seja CONCISO e RELEVANTE ao query.`;

        try {
          const response = await provider.generateCompletion({
            model: 'deepseek-chat', // Use cheap model for summaries
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.3,
            max_tokens: 200
          });
          
          return {
            conversationId: session.conversationId,
            date: new Date(session.timestamp).toLocaleDateString(),
            title: session.title || 'Untitled',
            summary: response.content,
            relevance: session.rank,
            messageCount: session.messageCount
          };
        } catch (error: any) {
          console.error('Error summarizing session:', error.message);
          
          return {
            conversationId: session.conversationId,
            date: new Date(session.timestamp).toLocaleDateString(),
            title: session.title || 'Untitled',
            summary: session.snippet,
            relevance: session.rank,
            messageCount: session.messageCount
          };
        }
      })
    );
    
    return summaries;
  }
}
```

#### 5.3 Search Tool (1h)

```typescript
// src/tools/session-search-tool.ts

import { BaseTool, ToolParams, ToolResult } from './base-tool';
import { SessionSearcher } from '../core/memory/session-searcher';

interface SearchParams {
  query: string;
  maxResults?: number;
}

export class SessionSearchTool extends BaseTool {
  name = 'search_conversations';
  description = `Busca em TODAS as conversas passadas usando busca semântica.

Use para recall de:
- "Como fiz X há 3 meses?"
- "Qual foi aquela decisão sobre Y?"
- "Onde configurei Z?"`;

  schema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'O que buscar (palavras-chave ou pergunta)'
      },
      maxResults: {
        type: 'number',
        description: 'Máximo de sessões a retornar (padrão: 5)'
      }
    },
    required: ['query']
  };

  async execute(params: ToolParams): Promise<ToolResult> {
    const { query, maxResults } = params as SearchParams;
    
    try {
      const results = await SessionSearcher.searchSessions(query, 'user', {
        maxSessions: maxResults || 5,
        summarize: true
      });
      
      if (results.length === 0) {
        return {
          success: true,
          output: `Nenhuma conversa encontrada para: "${query}"`
        };
      }
      
      let output = `🔍 **Encontrado ${results.length} conversa(s) relevante(s):**\n\n`;
      
      results.forEach((r, i) => {
        output += `**${i + 1}. ${r.date}** (${r.messageCount} mensagens)\n`;
        output += `${r.summary}\n\n`;
      });
      
      return {
        success: true,
        output,
        metadata: { results }
      };
      
    } catch (error: any) {
      return {
        success: false,
        output: `Error searching conversations: ${error.message}`
      };
    }
  }
}
```

#### 5.4 Search Command (1h)

```typescript
// src/commands/search-command.ts

import { SessionSearcher } from '../core/memory/session-searcher';

CommandRegistry.register({
  command: 'search',
  description: 'Buscar em todas as conversas passadas',
  handler: async (ctx, args) => {
    const query = args.join(' ');
    
    if (!query) {
      await ctx.reply('❌ Uso: /search <query>');
      return;
    }
    
    await ctx.reply(`🔍 Buscando: "${query}"...`);
    
    const results = await SessionSearcher.searchSessions(query, ctx.from.id.toString(), {
      maxSessions: 5,
      summarize: true
    });
    
    if (results.length === 0) {
      await ctx.reply(`Nenhuma conversa encontrada para: "${query}"`);
      return;
    }
    
    let response = `📚 **Encontrado ${results.length} conversa(s):**\n\n`;
    
    results.forEach((r, i) => {
      response += `**${i + 1}. ${r.date}** — ${r.title || 'Sem título'}\n`;
      response += `   *${r.summary.substring(0, 150)}...*\n\n`;
    });
    
    await ctx.reply(response);
  }
});
```

### ✅ Critérios de Aceitação

- [ ] FTS5 index criado e populado
- [ ] Triggers mantêm FTS5 sincronizado
- [ ] Busca funciona com palavras-chave e frases
- [ ] Resultados agrupados por sessão
- [ ] Sumarização via LLM funcional
- [ ] Tool `search_conversations` disponível
- [ ] Comando `/search <query>` funcional
- [ ] Performance: busca em 10k+ mensagens < 2s

---

## 👥 FEATURE 6: SUBAGENTES PARALELOS (12-16h)

*(Continua no próximo arquivo...)*

---

**Conclusão da Parte 2:** Features 4 e 5 implementadas fornecem auto-evolução e recall total. Feature 6 (Subagentes) será detalhada separadamente devido à complexidade.
