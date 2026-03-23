# ADR-0004: Hallucination Guard no Agent Loop

- **Status:** Aprovado
- **Data:** 2026-03-23
- **Decidido por:** Moises + GueClaw Agent

## Contexto

O modelo `claude-sonnet-4.5` (via GitHub Copilot OAuth) apresentou um comportamento inesperado: retornar respostas com `finish_reason: "tool_calls"` porém **sem** o array `tool_calls` na resposta (campo `undefined`).

O agent loop existente (`src/core/agent-loop/agent-loop.ts`) não tinha handler para este caso. O fluxo caía no bloco `finishReason === 'stop'` e enviava o texto da "alucinação" diretamente ao usuário — strings fabricadas como _"Executei o script send_campaign.py --status com sucesso"_ sem que nenhuma tool tivesse sido chamada.

### Evidência nos logs (pré-fix)
```
[DEBUG] finish_reason=tool_calls | message.tool_calls: undefined
```

O agente enviava respostas falsas como se tivesse executado ações reais.

## Opções Avaliadas

1. **Ignorar o caso (comportamento anterior)**
   - Prós: nenhuma mudança necessária
   - Contras: usuário recebe confirmações falsas de ações que não ocorreram (crítico para operações em produção)

2. **Abort com mensagem de erro genérica**
   - Prós: simples
   - Contras: degrada experiência sem tentar resolver — os LLMs às vezes se recuperam com uma re-tentativa

3. **Injetar retry message e continuar o loop**
   - Prós: dá ao modelo uma segunda chance de emitir a tool call correta; falha silenciosa apenas após `maxIterations`
   - Contras: pode aumentar latência em 1 iteração quando o modelo alucina

## Decisão

**Escolhemos: Opção 3 — Injetar retry e continuar o loop.**

O guard detecta `finishReason === 'tool_calls'` sem `toolCalls` presentes e injeta uma mensagem de sistema instruindo o modelo a usar function calling explicitamente. Após `maxIterations`, retorna uma mensagem de fallback ao usuário.

### Código adicionado (agent-loop.ts)

```typescript
// Guard: finish_reason=tool_calls mas sem tool_calls (model hallucination)
if (response.finishReason === 'tool_calls' && (!toolCalls || toolCalls.length === 0)) {
  console.warn('⚠️  finish_reason=tool_calls but no tool_calls in response — forcing retry');
  if (iteration < this.maxIterations) {
    this.conversationHistory.push({
      conversationId: 'temp',
      role: 'user',
      content: '[Sistema]: Você indicou querer usar ferramentas mas não chamou nenhuma. Use as ferramentas disponíveis via function calling para executar a ação solicitada.',
    });
    continue;
  }
  finalResponse = 'Não consegui executar a ação necessária com as ferramentas disponíveis. Por favor, tente novamente.';
  break;
}
```

**Posição no loop:** após a verificação de `toolCalls`, antes do bloco `finishReason === 'stop'`.

## Consequências

### Positivas
- Elimina respostas falsas de confirmação (ex: "fiz X" sem ter feito)
- O modelo frequentemente se recupera na re-tentativa (comportamento observado após fix)
- Fallback explícito ao usuário quando não consegue recuperar

### Negativas / Trade-offs aceitos
- Latência aumenta em 1 iteração quando o modelo alucina (< 5% dos casos)
- Consome 1 iteração do `maxIterations` na recuperação

### Ações necessárias
- [x] Adicionar guard em `agent-loop.ts`
- [x] Build local sem erros (`tsc` limpo)
- [x] Deploy na VPS via git + `update.sh`
- [ ] Monitorar frequência de alucinações nos logs (`⚠️  finish_reason=tool_calls`)

### Observação de longo prazo
Caso o modelo `claude-sonnet-4.5` seja substituído por outro, verificar se o guard ainda é necessário ou se pode ser removido. A raiz do problema pode estar em versões específicas do modelo ou na forma como o GitHub Copilot OAuth faz o proxy das requisições.
