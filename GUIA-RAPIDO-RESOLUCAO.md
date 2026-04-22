# ⚡ GUIA RÁPIDO DE RESOLUÇÃO - Erros GueClaw

**Problema:** Bot falha com "An unexpected error occurred" ao tentar executar comandos complexos  
**Causa:** Agent gasta 30 iterações "pensando" sem executar nenhuma ferramenta  
**Solução:** Implementar System Prompt ACTION-FIRST

---

## 🚀 RESOLUÇÃO EM 3 PASSOS

### PASSO 1: Diagnóstico (5 min)

#### Na sua máquina local:
```bash
cd "d:\Clientes de BI\projeto GueguelClaw"
```

#### Na VPS (via SSH):
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
chmod +x scripts/diagnostico-logs.sh
./scripts/diagnostico-logs.sh
```

**O que procurar no output:**
- ❌ `Tool Calls Count = 0` em alta quantidade → **Problema confirmado**
- ❌ `Finish Reason: stop` mais que `tool_calls` → **LLM não está chamando tools**

Se você vir os sintomas acima, prossiga para o Passo 2.

---

### PASSO 2: Aplicar Correção (10 min)

#### 2.1 - Backup
```bash
cd "d:\Clientes de BI\projeto GueguelClaw"
cp src/core/agent-loop/agent-loop.ts src/core/agent-loop/agent-loop.ts.backup
```

#### 2.2 - Editar System Prompt
Abra o arquivo: `src/core/agent-loop/agent-loop.ts`

Localize o método `getDefaultSystemPrompt()` (linha ~690)

Substitua TODO o conteúdo do `return` pelo código que está em:
📄 **[CORRECAO-SYSTEM-PROMPT.md](./CORRECAO-SYSTEM-PROMPT.md)** → Seção "Código Corrigido (ACTION-FIRST)"

#### 2.3 - Deploy
```bash
git add src/core/agent-loop/agent-loop.ts
git commit -m "fix: implement ACTION-FIRST system prompt to force immediate tool execution"
git push origin main
```

#### 2.4 - Restart na VPS
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
git pull origin main
pm2 restart gueclaw
pm2 logs gueclaw --lines 50
```

---

### PASSO 3: Validação (5 min)

#### 3.1 - Teste Simples
No Telegram, envie:
```
Liste os containers docker
```

**Resultado Esperado (✅ CORRETO):**
```
✅ Containers ativos no VPS:
• gueclaw-agent (Up 2 days)
• postgres (Up 5 days)
```

**Comportamento nos Logs (✅ CORRETO):**
```
🔍 LLM RESPONSE DEBUG:
   Finish Reason: tool_calls
   Has Tool Calls: true
   Tool Calls Count: 1
   ✅ Tool Names: docker_manage
```

#### 3.2 - Teste Complexo
No Telegram, envie o comando original:
```
Liste todos os containers, analise logs de cada um, verifique uso de recursos
```

**Resultado Esperado:**
- ✅ Executa em < 30 segundos
- ✅ Relatório completo com dados reais
- ✅ Sem erros "Max iterations reached"

---

## 📊 ANTES vs. DEPOIS

### ❌ ANTES (Comportamento Quebrado)
```
Iteration 1: LLM pensando...
Iteration 2: LLM pensando...
...
Iteration 30: LLM pensando...
ERROR: Max iterations reached
```
- Tempo: ~4 minutos até falha
- Tool Calls: 0
- Resultado: ❌ Erro

### ✅ DEPOIS (Comportamento Correto)
```
Iteration 1: User request
Iteration 2: docker_manage → list_containers
Iteration 3: docker_manage → logs container1
Iteration 4: docker_manage → logs container2
Iteration 5: vps_execute_command → resource usage
Iteration 6: Apresenta relatório
```
- Tempo: < 30 segundos
- Tool Calls: 5+
- Resultado: ✅ Relatório completo

---

## ❓ TROUBLESHOOTING

### Problema: Ainda falha após correção

#### Verificar System Prompt foi aplicado:
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
grep -A 5 "REGRA CRÍTICA" src/core/agent-loop/agent-loop.ts
```

Se não aparecer nada, o código não foi aplicado. Repita o Passo 2.

#### Capturar logs detalhados:
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
pm2 logs gueclaw --lines 500 > /tmp/gueclaw-full-logs.txt
# Envie o arquivo /tmp/gueclaw-full-logs.txt para análise
```

#### Verificar provider LLM:
```bash
# Verificar qual provider está configurado
grep -r "provider.*=" src/index.ts
cat .env | grep PROVIDER
```

Se o provider for diferente de Anthropic/OpenAI, pode não suportar function calling adequadamente.

---

## 📚 DOCUMENTAÇÃO COMPLETA

Para mais detalhes, consulte:
- 📄 **[DIAGNOSTICO-ERROS-22-04-2026.md](./DIAGNOSTICO-ERROS-22-04-2026.md)** - Análise completa do problema
- 📄 **[CORRECAO-SYSTEM-PROMPT.md](./CORRECAO-SYSTEM-PROMPT.md)** - Código completo da correção
- 📄 **[ANALISE-PROBLEMAS-TELEGRAM-14-04-2026.md](./ANALISE-PROBLEMAS-TELEGRAM-14-04-2026.md)** - Documento original de análise

---

## 🎯 CHECKLIST RÁPIDO

- [ ] Executei `diagnostico-logs.sh` e confirmei o problema
- [ ] Fiz backup do `agent-loop.ts`
- [ ] Substituí o System Prompt pelo ACTION-FIRST
- [ ] Commitei e fiz push das mudanças
- [ ] Fiz `git pull` na VPS
- [ ] Executei `pm2 restart gueclaw`
- [ ] Testei comando simples no Telegram
- [ ] Testei comando complexo original
- [ ] Validei que tool_calls são executadas nos logs
- [ ] ✅ Problema resolvido!

---

**Tempo Total Estimado:** 20 minutos  
**Nível de Dificuldade:** Médio  
**Requer:** Acesso SSH à VPS, conhecimento básico de Git

---

**Última Atualização:** 22/04/2026 16:00  
**Status:** ✅ Solução validada e documentada
