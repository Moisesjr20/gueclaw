# Diretiva: Sub-Agentes DOE

**Status:** Ativo | **Versão:** 1.0 | **Atualizado:** 2026-03-11

## Objetivo

Permitir que o GueClaw crie e monitore **sub-agentes autônomos** para executar tarefas automatizadas de forma paralela, sem bloquear o fluxo principal de conversação.

---

## Quando Usar Sub-Agentes

Use sub-agentes para tarefas que:
- São **longas ou complexas** (> 5 segundos de execução esperada)
- Podem ser executadas **em background** sem precisar de resposta imediata
- Envolvem **múltiplos passos** que beneficiam de um loop ReAct isolado
- Precisam de **rastreamento histórico** para geração de relatórios

**NÃO use** sub-agentes para:
- Respostas rápidas e conversacionais
- Tarefas que precisam de resultado imediato
- Fluxos interativos que requerem input do usuário

---

## Tools Disponíveis

### `spawn_sub_agent`
Cria e dispara um sub-agente assíncrono.

**Inputs:**
- `name`: Nome descritivo (ex: `"Coleta de Dados"`, `"Monitor de Logs"`)
- `task`: Descrição completa da tarefa. Seja específico — o sub-agente usará isso como mensagem inicial.
- `system_prompt_override` (opcional): Instruções extras de comportamento

**Output:** `agent_id` para rastreamento

**Exemplo de uso:**
```
spawn_sub_agent(
  name="Análise de Vendas",
  task="Execute o script execution/analise_vendas.py e retorne um resumo dos resultados com os top 5 produtos"
)
```

---

### `get_sub_agent_status`
Consulta status de um sub-agente ou lista todos.

**Inputs:**
- `agent_id` (opcional): ID retornado por `spawn_sub_agent`

**Status possíveis:**
| Status | Significado |
|---|---|
| `pending` | Criado, aguardando início |
| `running` | Em execução ativa |
| `completed` | Concluído com sucesso |
| `failed` | Falhou — verificar campo `error` |

---

### `generate_sub_agent_report`
Gera relatório Markdown com histórico de execuções.

**Inputs:**
- `agent_id` (opcional): Filtrar por sub-agente
- `limit` (opcional): Número de runs. Padrão: 20

**Retorno:** Relatório com resumo executivo e tabela de runs.

---

## Fluxo Recomendado (DOE)

```
1. [Directive]    → Usuário solicita tarefa automatizada
2. [Orchestration] → GueClaw avalia se precisa de sub-agente
3. [Orchestration] → Chama spawn_sub_agent com tarefa bem definida
4. [Orchestration] → Informa usuário: "Sub-agente criado! ID: <id>"
5. [Execution]    → Sub-agente roda em background (AgentLoop isolado)
6. [Orchestration] → Quando usuário perguntar: get_sub_agent_status
7. [Reporting]    → Quando usuário pedir resumo: generate_sub_agent_report
```

---

## Edge Cases e Limitações

- **Timeout implícito:** O sub-agente herda `MAX_ITERATIONS` do `.env` (padrão: 5). Tarefas muito longas podem não concluir.
- **Sem SSH:** Sub-agentes não têm acesso à tool SSH por segurança — apenas shell local e Python.
- **Assíncrono real:** O spawn retorna imediatamente. O resultado só estará disponível após a execução.
- **Re-execução:** Não há re-try automático. Para re-executar, crie um novo sub-agente com `spawn_sub_agent`.
- **Limite de runs:** SQLite sem partition — para alta frequência, considere arquivar runs antigos.

---

## Aprendizados (Self-Annealing)

> *Atualize esta seção quando descobrir novos edge cases.*

- [2026-03-11] Sistema criado. Monitorar comportamento de sub-agentes com tarefas longas.
