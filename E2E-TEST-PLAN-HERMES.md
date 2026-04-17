# 🧪 Plano de Testes E2E - Features Hermes (v2.0.0)

**Data:** 17/04/2026  
**Branch:** main (commit: 54c533a)  
**Objetivo:** Validar funcionamento das 6 features Hermes no Telegram em produção

---

## ✅ Checklist de Testes

### 1️⃣ Feature 1.1: Context Files System

**Comandos a Testar:**

```
/context show
```
**Resultado Esperado:**
- ✅ Retorna lista de arquivos de contexto carregados
- ✅ Mostra caminho e tamanho de cada arquivo
- ✅ Se vazio, indica "Nenhum arquivo de contexto carregado"

```
/context reload
```
**Resultado Esperado:**
- ✅ Recarrega arquivos da pasta `.context/` (se existir)
- ✅ Confirma quantidade de arquivos recarregados
- ✅ Atualiza cache de contexto

```
/context add <path>
```
**Exemplo:** `/context add README.md`

**Resultado Esperado:**
- ✅ Adiciona arquivo ao contexto ativo
- ✅ Confirma adição bem-sucedida
- ✅ Arquivo disponível para próximas queries

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

### 2️⃣ Feature 1.2: Slash Commands Framework

**Comandos a Testar:**

```
/help
```
**Resultado Esperado:**
- ✅ Lista TODOS os comandos disponíveis (incluindo novos)
- ✅ Mostra comandos de Context, Cron, Search, Improve, etc.
- ✅ Descrições claras de cada comando

```
/version
```
**Resultado Esperado:**
- ✅ Retorna versão 2.0.0
- ✅ Mostra features Hermes implementadas

```
/status
```
**Resultado Esperado:**
- ✅ Mostra status do agente (online/offline)
- ✅ Uptime do processo
- ✅ Memória utilizada

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

### 3️⃣ Feature 1.3: Cron Scheduler Automation

**Comandos a Testar:**

```
/cron list
```
**Resultado Esperado:**
- ✅ Lista jobs agendados (ou "Nenhum job agendado")
- ✅ Mostra ID, schedule, descrição de cada job
- ✅ Indica próxima execução

```
/cron add "0 9 * * *" "Enviar relatório diário"
```
**Resultado Esperado:**
- ✅ Cria job com cron expression válida
- ✅ Retorna ID do job criado
- ✅ Confirma schedule parseado corretamente

```
/cron remove <id>
```
**Exemplo:** `/cron remove 1`

**Resultado Esperado:**
- ✅ Remove job da lista
- ✅ Confirma remoção
- ✅ Job não aparece mais em /cron list

```
/cron run <id>
```
**Resultado Esperado:**
- ✅ Executa job manualmente
- ✅ Mostra resultado da execução
- ✅ Não afeta schedule original

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

### 4️⃣ Feature 2.1: Auto-Improve Skills System

**Comandos a Testar:**

```
/improve <skill_name>
```
**Exemplo:** `/improve nextjs`

**Resultado Esperado:**
- ✅ Analisa falhas recentes da skill
- ✅ Sugere melhorias baseadas em erros
- ✅ Mostra diff proposto (antes/depois)
- ✅ Solicita confirmação para aplicar

**Cenário de Teste Completo:**

1. **Forçar erro em skill:**
   ```
   "Use a skill nextjs para fazer algo impossível"
   ```
   (para gerar falha e popular skill-execution-tracker)

2. **Executar improve:**
   ```
   /improve nextjs
   ```

3. **Validar sugestões:**
   - ✅ Identifica erro específico
   - ✅ Propõe correção relevante
   - ✅ Mostra código modificado

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

### 5️⃣ Feature 2.2: FTS5 Session Search Engine

**Comandos a Testar:**

```
/search <query>
```
**Exemplo:** `/search deploy VPS`

**Resultado Esperado:**
- ✅ Busca em histórico de conversas (FTS5)
- ✅ Retorna top 5 conversações relevantes
- ✅ Mostra snippets com contexto
- ✅ Calcula relevância % para cada resultado
- ✅ Ordena por relevância (maior primeiro)

**Cenário de Teste Completo:**

1. **Ter histórico prévio:**
   Enviar algumas mensagens com palavras-chave distintas:
   ```
   "Faça deploy no VPS 147.93.69.211"
   "Configure nginx no servidor"
   "Restart do pm2 no ambiente de produção"
   ```

2. **Executar buscas:**
   ```
   /search deploy
   → Deve retornar mensagem com "deploy no VPS"
   
   /search nginx servidor
   → Deve retornar mensagem com "Configure nginx"
   
   /search restart pm2
   → Deve retornar mensagem com "Restart do pm2"
   ```

3. **Validar ranking:**
   - ✅ Resultados mais relevantes primeiro
   - ✅ Snippets destacam matches
   - ✅ Metadata correta (data, user, conversationId)

**Aliases a Testar:**
- `/buscar <query>` (português)
- `/find <query>` (inglês)

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

### 6️⃣ Feature 3.1: Isolated Parallel Subagents

**Prompts a Testar:**

```
"Analise 3 arquivos em paralelo: README.md, package.json, e gueclaw.md. 
Para cada um, resuma o conteúdo em 2 linhas."
```

**Resultado Esperado:**
- ✅ Cria 3 subagentes isolados
- ✅ Executa leitura dos 3 arquivos EM PARALELO
- ✅ Retorna resumo consolidado
- ✅ Performance: tempo total < soma individual (prova de paralelização)
- ✅ Metadata mostra 3 executions, 3 tasks completadas

```
"Execute esses comandos independentes:
1. Liste arquivos em src/
2. Conte linhas de código em src/core/
3. Verifique status do git"
```

**Resultado Esperado:**
- ✅ Delega 3 tasks para subagentes paralelos
- ✅ Cada subagente usa apenas tools permitidas (sem delegate_task recursivo)
- ✅ Consolida resultados em relatório final
- ✅ Execução em ~speedup 2-3x vs serial

**Validações de Segurança:**

```
"Delegue task que tenta usar send_message no Telegram"
```
**Resultado Esperado:**
- ✅ Subagente BLOQUEADO de usar send_message
- ✅ Retorna erro de permission denied
- ✅ Não envia mensagem fantasma

**Status:** ⬜ Não Testado | ✅ Passou | ❌ Falhou

---

## 📊 Matriz de Cobertura

| Feature | Comando Principal | Casos de Teste | Status |
|---------|-------------------|----------------|--------|
| Context Files | /context | 3 testes | ⬜ |
| Slash Commands | /help, /version, /status | 3 testes | ⬜ |
| Cron Scheduler | /cron | 4 testes | ⬜ |
| Auto-Improve | /improve | 1 cenário completo | ⬜ |
| FTS5 Search | /search | 3 queries + aliases | ⬜ |
| Subagentes | Prompt natural | 3 cenários | ⬜ |

---

## 🔍 Testes de Integração Cross-Feature

### Teste 1: Context + Search
```
1. /context add README.md
2. "Resuma o README"
3. /search README
   → Deve encontrar conversa anterior
```

### Teste 2: Cron + Auto-Improve
```
1. /cron add "0 12 * * *" "Melhorar skill nextjs"
2. /cron run 1
   → Deve executar /improve automaticamente
```

### Teste 3: Subagentes + Context
```
1. /context add gueclaw.md
2. "Usando o contexto, crie 3 análises paralelas:
   - Resumo de features
   - Análise de skills
   - Checklist de melhorias"
   → Subagentes devem ter acesso ao contexto compartilhado
```

---

## 🐛 Testes de Regressão (Não Quebrar Features Antigas)

### Comandos Legacy (Devem Continuar Funcionando)

```
/start
→ ✅ Mensagem de boas-vindas

/clear
→ ✅ Limpa histórico de conversação

/tasks
→ ✅ Lista tasks ativas (se houver)

/cost
→ ✅ Mostra custo acumulado de API calls
```

### Conversação Livre (Sem Comandos)
```
"Oi GueClaw, como você está?"
→ ✅ Responde naturalmente (modo conversação)

"Crie um arquivo teste.txt"
→ ✅ Executa FileWrite tool normalmente
```

---

## 📝 Registro de Testes

### Sessão de Testes: __/__/2026

**Testador:** _________________

| Feature | Status | Observações |
|---------|--------|-------------|
| 1.1 Context Files | ⬜ | |
| 1.2 Slash Commands | ⬜ | |
| 1.3 Cron Scheduler | ⬜ | |
| 2.1 Auto-Improve | ⬜ | |
| 2.2 FTS5 Search | ⬜ | |
| 3.1 Subagentes | ⬜ | |

**Bugs Encontrados:**
- [ ] Bug 1: _______________________________________
- [ ] Bug 2: _______________________________________
- [ ] Bug 3: _______________________________________

**Tempo Total de Testes:** _____ minutos

**Conclusão Final:**
- ✅ APROVADO - Todas features funcionando
- ⚠️ APROVADO COM RESSALVAS - Bugs menores encontrados
- ❌ REPROVADO - Bugs críticos bloqueiam uso

---

## 🚀 Como Executar Este Plano

### 1. Preparação

```bash
# Garantir que VPS está rodando versão correta
ssh kyrius@147.93.69.211
pm2 status
# Verificar: gueclaw-agent ONLINE com v2.0.0
```

### 2. Abrir Telegram

- Buscar bot: @GueClaw_bot (ou seu bot)
- Verificar status: `/status` deve retornar online

### 3. Executar Testes Sequencialmente

Siga a ordem 1.1 → 1.2 → 1.3 → 2.1 → 2.2 → 3.1

Para cada teste:
1. ✅ Copiar comando exato do plano
2. ✅ Enviar no Telegram
3. ✅ Comparar resultado com "Esperado"
4. ✅ Marcar ✅ Passou ou ❌ Falhou
5. ✅ Anotar bugs se houver

### 4. Testes de Performance (Subagentes)

```bash
# Usar bot timer externo ou timestamp manual
Início: __:__:__
"Analise 3 arquivos em paralelo..."
Fim: __:__:__
Duração: _____ segundos

→ Deve ser < 10 segundos (prova de paralelização)
```

### 5. Relatório Final

Após completar todos os testes, preencher:
- Total de features testadas: 6/6
- Total de testes executados: ~20
- Taxa de sucesso: ___%
- Bugs críticos: ___
- Bugs menores: ___

---

## 📞 Em Caso de Falhas

### Feature Não Funciona
1. Verificar logs no VPS:
   ```bash
   ssh kyrius@147.93.69.211
   pm2 logs gueclaw-agent --lines 50
   ```

2. Verificar banco SQLite:
   ```bash
   cd /home/kyrius/gueclaw
   sqlite3 database/gueclaw.db
   .tables
   ```

3. Verificar build:
   ```bash
   npm run build
   # Se erros, corrigir e redeployar
   ```

### Comando Não Reconhecido
- Verificar se comando foi registrado em `src/commands/telegram-commands.ts`
- Executar `/help` para ver lista completa
- Restart do bot: `pm2 restart gueclaw-agent`

### Performance Ruim
- Verificar memória: `pm2 status` (não deve exceder 200mb)
- Verificar CPU: `htop` no VPS
- Checar logs de timeout: `pm2 logs --err`

---

## 🎯 Critérios de Aceitação

Para considerar Hermes Integration **APROVADO em E2E:**

✅ **MUST-HAVE:**
- [ ] 6/6 features funcionam sem erros críticos
- [ ] 0 crashes do bot durante testes
- [ ] Todos os comandos reconhecidos pelo /help
- [ ] Subagentes executam em paralelo (prova de speedup)
- [ ] Search retorna resultados relevantes (FTS5)

✅ **SHOULD-HAVE:**
- [ ] Performance de subagentes < 10s para 3 tasks
- [ ] Cron jobs executam no horário agendado
- [ ] Auto-improve sugere correções relevantes
- [ ] Context files carregam sem erros

✅ **NICE-TO-HAVE:**
- [ ] Mensagens de erro user-friendly
- [ ] Loading indicators em operações longas
- [ ] Confirmação visual de comandos executados

---

**Versão do Plano:** 1.0  
**Última Atualização:** 17/04/2026  
**Responsável:** GueClaw Team
