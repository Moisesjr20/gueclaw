# 🔍 DIAGNÓSTICO DE ERROS - GueClaw (22/04/2026)

**Data:** 22/04/2026 15:45  
**Solicitação do Usuário:** "Liste todos os containers, analise logs de cada um, verifique uso de recursos, gere relatório completo com gráficos"  
**Resultado:** Falha múltipla com erro "An unexpected error occurred"

---

## 📊 RESUMO EXECUTIVO

O GueClaw está apresentando falhas recorrentes ao tentar executar tarefas complexas que envolvem múltiplas chamadas de ferramentas (docker, análise de logs, geração de relatórios). Os sintomas correspondem exatamente aos descritos no documento `ANALISE-PROBLEMAS-TELEGRAM-14-04-2026.md`.

### ⚠️ PROBLEMAS IDENTIFICADOS

1. **Agent executa MAX_ITERATIONS (30) sem chamar nenhuma ferramenta** ❌ CRÍTICO
2. **Respostas vazias ou arquivos corrompidos** ❌ HIGH  
3. **Raciocínio excessivo sem execução** ❌ HIGH
4. **Mensagens de erro genéricas sem diagnóstico** ❌ MEDIUM

---

## 🔴 ANÁLISE DETALHADA

### PROBLEMA 1: Agent "Pensa" 30 Vezes SEM EXECUTAR NADA

#### Comportamento Observado
```
[15:15] kyrius: Liste todos os containers, analise logs...
[15:19] bot: ❌ Erro Recuperável: An unexpected error occurred.
[15:39] kyrius: continue
[15:42] bot: I encountered too many errors...
```

#### O Que Está Acontecendo
O agent está gastando todas as 30 iterações disponíveis **sem executar nenhuma ferramenta**:

```
Iteration 1: LLM: [pensando sobre a solicitação...]
Iteration 2: LLM: [analisando como proceder...]
Iteration 3: LLM: [planejando as ações...]
...
Iteration 30: LLM: [ainda pensando...]
ERROR: Max iterations reached ❌
```

**Comportamento Correto Esperado:**
```
Iteration 1: User: "Liste containers..."
Iteration 2: LLM: [tool_call: docker_manage action=list_containers]
Iteration 3: Tool Result: [lista de containers]
Iteration 4: LLM: [tool_call: docker_manage action=logs containerName=...]
Iteration 5: Tool Result: [logs do container]
Iteration 6-N: [continua com outras ferramentas]
Final: LLM apresenta relatório completo
```

#### Causa Raiz (Identificada no Documento de Análise)

**A) System Prompt induz análise em vez de ação**  
O formato estruturado atual pode estar fazendo o LLM **descrever** o que vai fazer em vez de **executar** as ferramentas:

```typescript
// Formato que induz análise excessiva:
📥 SOLICITAÇÃO: [Descrição breve do que foi pedido]
🔍 ANÁLISE: [O que você entendeu e como abordou]
⚡ EXECUÇÃO: [Quais ferramentas/ações foram executadas]
```

O LLM tenta preencher "ANÁLISE" antes de ir para "EXECUÇÃO", gerando texto livre ao invés de function calls.

**B) LLM não está gerando tool_calls**  
O provider pode estar retornando `finishReason: "stop"` (texto livre) ao invés de `finishReason: "tool_calls"` (chamada de ferramenta).

**C) Problema de parsing de tool_calls**  
O LLM pode estar gerando tool calls, mas o código não está detectando corretamente.

---

### PROBLEMA 2: Logs de Análise

#### Status dos Logs
**✅ JÁ IMPLEMENTADO:** Código de debug detalhado (linhas 138-155 de `agent-loop.ts`)

```typescript
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('🔍 LLM RESPONSE DEBUG:');
console.log(`   Provider: ${this.provider.constructor.name}`);
console.log(`   Provider Supports Tool Calls: ${this.provider.supportsToolCalls}`);
console.log(`   Tools Available: ${tools.length}`);
console.log(`   Finish Reason: ${response.finishReason}`);
console.log(`   Has Tool Calls: ${!!response.toolCalls && response.toolCalls.length > 0}`);
console.log(`   Tool Calls Count: ${response.toolCalls?.length || 0}`);
```

**❓ PRÓXIMO PASSO:** Precisamos ver os logs reais do VPS para identificar qual o `finishReason` que está sendo retornado.

---

## 🔧 CORREÇÕES JÁ IMPLEMENTADAS

### ✅ Debug Logging (Implementado)
- Local: `src/core/agent-loop/agent-loop.ts` linhas 138-155
- Logs detalhados de cada response do LLM
- Tracking de tool calls, finish reason, content length

### ✅ Error Recovery System (Implementado)
- Sistema de retry com Continue button
- Salva contexto de tarefas interrompidas
- Permite retomar após MAX_ITERATIONS

---

## 🚨 CORREÇÕES PENDENTES (DO DOCUMENTO DE ANÁLISE)

### PENDENTE 1: System Prompt ACTION-FIRST

**Status:** ⏳ NÃO IMPLEMENTADO  
**Prioridade:** 🔴 CRÍTICA  
**Arquivo:** `src/core/agent-loop/agent-loop.ts` linha ~667

#### Correção Proposta no Documento:

```typescript
private getDefaultSystemPrompt(): string {
  return `
Você é GueClaw, um agente de automação VPS.

🚨 REGRA CRÍTICA: EXECUTE FERRAMENTAS IMEDIATAMENTE
Quando o usuário pedir uma ação, você DEVE:
1. Chamar a ferramenta apropriada via function calling (NÃO descreva, EXECUTE)
2. Aguardar o resultado
3. Apresentar o resultado ao usuário

❌ PROIBIDO:
- "Vou executar o comando..." (EXECUTE AGORA, não anuncie)
- "Preciso verificar..." (VERIFIQUE COM A FERRAMENTA)
- Explicar sem executar
- Gerar texto sem chamar ferramenta

✅ SEMPRE USE FERRAMENTAS:
- "Liste containers" → CALL docker_manage(action=list_containers)
- "Me envie os logs" → CALL vps_execute_command(tail -n 50 logs/*)
- "Reinicie o GueClaw" → CALL vps_execute_command(pm2 restart gueclaw)
- "Status do servidor" → CALL vps_execute_command(df -h && free -h)

NUNCA responda sem chamar pelo menos 1 ferramenta para ações que exigem verificação.
`;
}
```

### PENDENTE 2: Correção de Arquivos Markdown Vazios

**Status:** ⏳ NÃO IMPLEMENTADO  
**Prioridade:** 🟡 HIGH  
**Arquivo:** `src/handlers/telegram-output-handler.ts` linha ~170

#### Problema:
Arquivos `.md` gerados estão vazios ou corrompidos quando enviados ao Telegram.

#### Correção Proposta:
```typescript
public static async sendAsMarkdownFile(
  ctx: Context,
  content: string,
  fileName: string = 'response.md'
): Promise<void> {
  try {
    const tempDir = process.env.TEMP_DIR || './tmp';
    
    // 1. Garantir que diretório existe
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    const filePath = path.join(tempDir, `${Date.now()}_${fileName}`);

    // 2. Escrever arquivo com encoding explícito
    fs.writeFileSync(filePath, content, { encoding: 'utf8', flag: 'w' });
    
    // 3. Verificar que arquivo foi criado
    if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
      throw new Error(`Arquivo não criado corretamente: ${filePath}`);
    }
    
    console.log(`✅ Arquivo criado: ${filePath} (${fs.statSync(filePath).size} bytes)`);

    // 4. Enviar arquivo
    await this.sendFile(ctx, filePath, 'Here\'s the complete response:', true);

  } catch (error: any) {
    console.error('❌ Error sending markdown file:', error);
    await ctx.reply('❌ Error creating file. Sending as text instead...');
    await this.sendText(ctx, content);
  }
}
```

---

## 📋 PLANO DE AÇÃO IMEDIATO

### FASE 1: DIAGNÓSTICO (AGORA - 30 min)

#### Passo 1: Verificar Logs do VPS
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
pm2 logs gueclaw --lines 200 | grep "🔍 LLM RESPONSE DEBUG" -A 10
```

**O que procurar nos logs:**
- `Finish Reason: stop` ❌ (LLM gerando texto livre)
- `Finish Reason: tool_calls` ✅ (LLM gerando function calls)
- `Has Tool Calls: false` ❌ (Não detectou tools)
- `Has Tool Calls: true` ✅ (Detectou tools)
- `Tool Calls Count: 0` ❌ (Nenhuma tool chamada)
- `Tool Calls Count: > 0` ✅ (Tools sendo chamadas)

#### Passo 2: Testar Comando Simples
No Telegram, envie:
```
Liste os containers docker
```

Capture a saída completa dos logs do VPS.

#### Passo 3: Analisar Padrão
Compare os logs:
- ✅ Se `finishReason = "tool_calls"` e `toolCallsCount > 0`: **Problema de parsing resolvido**
- ❌ Se `finishReason = "stop"` e `toolCallsCount = 0`: **Problema de System Prompt** (precisa implementar SOLUÇÃO 1)

---

### FASE 2: CORREÇÃO CRÍTICA (Após diagnóstico)

#### Se o problema for System Prompt (mais provável):

1. **Implementar System Prompt ACTION-FIRST**
   ```bash
   # Editar arquivo
   code src/core/agent-loop/agent-loop.ts
   # Localizar método getDefaultSystemPrompt() (linha ~667)
   # Substituir pelo prompt proposto na PENDENTE 1
   ```

2. **Deploy**
   ```bash
   git add src/core/agent-loop/agent-loop.ts
   git commit -m "fix: implement ACTION-FIRST system prompt to force tool execution"
   git push origin main
   
   # Na VPS
   ssh root@147.93.69.211
   cd /opt/gueclaw-agent
   git pull origin main
   pm2 restart gueclaw
   ```

3. **Testar**
   No Telegram:
   ```
   Liste os containers docker
   ```
   
   **Resultado Esperado:**
   ```
   ✅ CONTAINER ID   NAME              STATUS          IMAGE
   abc123def456   gueclaw-agent     Up 2 days       node:20-alpine
   def789ghi012   postgres          Up 5 days       postgres:15
   ```

---

## 📊 LOGS ATUAIS PARA ANÁLISE

### Log de Execução Tool (tool-execution.log)
**Última falha registrada:** Timestamp `1776078049021`

```json
{
  "eventId": "4d28a5cf-4dfa-4f59-ae03-0ec40fc4ddd2",
  "timestamp": 1776078049021,
  "type": "TOOL_ERROR",
  "toolName": "FileRead",
  "queryChainId": "a2d84d5c-12ab-4ef8-a4b1-be192d65e0c6",
  "error": "Tool \"FileRead\" not found in registry"
}
```

**⚠️ OBSERVAÇÃO IMPORTANTE:**  
Os logs mostram muitos erros de `Tool "X" not found in registry`. Isso pode indicar um problema adicional no **Tool Registry** que precisa ser investigado.

#### Possível Problema Adicional: Tool Registry
```typescript
// Verificar se todas as tools estão sendo registradas corretamente
// Local: src/core/tool-registry.ts

// Tools que deveriam estar disponíveis:
- docker_manage ✅
- vps_execute_command ✅
- read_file ✅
- write_file ✅
- http_request ✅
- analyze_image ✅
```

---

## 🎯 CHECKLIST DE RESOLUÇÃO

### Diagnóstico
- [ ] 1.1 - Acessar VPS e capturar logs DEBUG do agent-loop
- [ ] 1.2 - Identificar `finishReason` retornado pelo LLM
- [ ] 1.3 - Verificar se tool_calls estão sendo geradas
- [ ] 1.4 - Confirmar Tool Registry está completo

### Correção Crítica (se finishReason = "stop")
- [ ] 2.1 - Implementar System Prompt ACTION-FIRST
- [ ] 2.2 - Deploy na VPS
- [ ] 2.3 - Testar comando simples
- [ ] 2.4 - Validar que tool_calls são geradas

### Correção Arquivos Markdown
- [ ] 3.1 - Implementar verificação de arquivo criado
- [ ] 3.2 - Adicionar encoding explícito
- [ ] 3.3 - Testar envio de resposta longa

### Validação Final
- [ ] 4.1 - Testar comando complexo original: "Liste containers, analise logs, gere relatório"
- [ ] 4.2 - Confirmar < 10 iterações para execução
- [ ] 4.3 - Verificar relatório é gerado e enviado corretamente
- [ ] 4.4 - Atualizar documentação com resolução

---

## 📈 MÉTRICAS

### Antes (22/04/2026)
- ❌ Taxa de Falha: ~100% (3 tentativas falharam)
- ❌ Iterações gastas: 30/30 (sem executar tools)
- ❌ Tool Calls executadas: 0
- ❌ Tempo até falha: ~4 minutos (por tentativa)

### Meta Após Correção
- ✅ Taxa de Sucesso: > 95%
- ✅ Iterações usadas: < 10 para tarefas complexas
- ✅ Tool Calls executadas: > 0 sempre
- ✅ Tempo de resposta: < 30 segundos

---

## 💡 PRÓXIMOS PASSOS RECOMENDADOS

### IMEDIATO (Hoje)
1. Capturar logs do VPS conforme Passo 1
2. Analisar `finishReason` nos logs
3. Implementar System Prompt ACTION-FIRST se necessário
4. Testar e validar correção

### CURTO PRAZO (Esta Semana)
1. Implementar correção de arquivos markdown vazios
2. Verificar Tool Registry está completo
3. Adicionar mais logs de diagnóstico se necessário
4. Criar testes automatizados para cenários de falha

### MÉDIO PRAZO (Próxima Semana)
1. Implementar modo Express para comandos simples
2. Criar mapeamento de comandos comuns → tools diretas
3. Adicionar telemetria de tempo de execução
4. Dashboard de métricas do agent

---

## 📚 DOCUMENTAÇÃO RELACIONADA

- `ANALISE-PROBLEMAS-TELEGRAM-14-04-2026.md` - Análise completa dos problemas
- `docs/error-recovery-system.md` - Sistema de recuperação de erros
- `PLANO-IMPLEMENTACAO-TRIGGERS.md` - Sistema de triggers (pode ajudar com ações automáticas)

---

**Relatório gerado em:** 22/04/2026 15:45  
**Próxima ação:** Capturar logs do VPS e implementar System Prompt ACTION-FIRST  
**Status:** 🟡 AGUARDANDO DIAGNÓSTICO DE LOGS
