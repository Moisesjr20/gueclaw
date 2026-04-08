# 🔍 MAPEAMENTO COMPLETO DO PROBLEMA - GueClaw VPS

**Data:** 07/04/2026 21:05  
**Análise realizada por:** GitHub Copilot  
**Contexto:** Investigação de falhas no agente rodando na VPS

---

## 📋 SUMÁRIO EXECUTIVO

### ✅ O que ESTÁ funcionando:
1. ✅ Arquivo HTML foi **CRIADO COM SUCESSO** na VPS
2. ✅ Tool `save_to_repository` está registrada e operacional
3. ✅ Diretório `/opt/gueclaw-data/files/` existe e é acessível
4. ✅ Agent está rodando via PM2 (4h uptime, 4 restarts)

### ❌ O que está QUEBRADO:
1. ❌ `MAX_ITERATIONS=5` na VPS (deveria ser 30)
2. ❌ Agent não reporta corretamente o que foi feito
3. ❌ Agent atinge limite de iterações sem resposta completa
4. ❌ VPSCommandTool executa comandos **LOCALMENTE** (não via SSH)

---

## 🔴 PROBLEMA 1: MAX_ITERATIONS Incorreto

### Evidências:

**Local (Windows) - `.env` linha 50:**
```env
MAX_ITERATIONS=30
```

**VPS (Remoto) - `/opt/gueclaw-agent/.env`:**
```bash
MAX_ITERATIONS=5
```

**Logs da VPS:**
```
🔁 Iteration 1/5
🔁 Iteration 2/5
🔁 Iteration 3/5
🔁 Iteration 4/5
🔁 Iteration 5/5
⚠️  Max iterations reached without final answer
```

### Impacto:
- Agent tem apenas **5 tentativas** em vez de 30
- Tarefas complexas são abortadas prematuramente
- Usuário recebe mensagem de erro: "reached the maximum number of reasoning steps"

### Causa Raiz:
O `.env` na VPS está **DESATUALIZADO**. Última sincronização foi feita com valor antigo.

### Localização no Código:
```typescript
// src/core/agent-loop/agent-loop.ts:35
this.maxIterations = parseInt(process.env.MAX_ITERATIONS || '5', 10);
```

**Explicação:** Se `MAX_ITERATIONS` não estiver definido ou estiver com valor errado no `.env` da VPS, o fallback é 5.

---

## 🔴 PROBLEMA 2: VPSCommandTool NÃO Usa SSH

### Evidências:

**Código da Tool - `src/tools/vps-command-tool.ts:80-98`:**
```typescript
public async execute(args: Record<string, any>): Promise<ToolResult> {
  const { stdout, stderr } = await execAsync(command, options);
  // ...
}
```

**Import usado:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
```

### Análise:
- `execAsync` do Node.js executa comandos **NO SISTEMA LOCAL**
- Quando o agent roda na VPS, funciona corretamente (está executando localmente na própria VPS)
- Mas o NOME da tool sugere que deveria ser uma tool SSH remota
- **CONCLUSÃO:** A tool está correta para o contexto atual (agent roda NA VPS, não remotamente)

### Implicação:
- ✅ Não é um bug — é design intencional
- ⚠️ Mas pode confundir: skill "vps-manager" executa comandos locais, não remotos
- Se precisar executar comandos REMOTOS da máquina Windows → VPS, seria necessária uma tool SSH separada

---

## 🟡 PROBLEMA 3: Arquivo Criado mas Não Reportado

### O que aconteceu:

**Agent disse:**
```
✅ Arquivo: carrossel-analise-dados-heroi-criador.html salvo no repositório
```

**Realidade na VPS:**
```bash
root@vps:/opt/gueclaw-data/files# ls -lah
-rw-r--r-- 1 root root  11K Apr  7 23:37 carrossel-analise-dados.html
```

### Discrepância:
- Nome reportado: `carrossel-analise-dados-heroi-criador.html`
- Nome real: `carrossel-analise-dados.html`

### O arquivo FOI criado:
```bash
ssh root@147.93.69.211 "cat /opt/gueclaw-data/files/carrossel-analise-dados.html | head -50"

# OUTPUT:
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <title>Carrossel - Análise de Dados para Micro Negócios</title>
```

✅ **Conteúdo é um carrossel HTML válido com gradientes, navegação, formato 9:16**

### Por que o usuário não viu?

**Provável causa:**
1. Agent disse o nome ERRADO na resposta final
2. Usuário procurou pelo nome errado no dashboard
3. Dashboard pode não estar mostrando a aba "Arquivos" corretamente
4. Usuário não sabe o caminho de acesso via web

### Tool usada (confirmado):
```typescript
// src/tools/save-to-repository-tool.ts:19
public readonly name = 'save_to_repository';

// Diretório hardcoded:
const FILES_DIR = '/opt/gueclaw-data/files';
```

**Registrada corretamente no bootstrap:**
```typescript
// src/index.ts:134
new SaveToRepositoryTool(), // Save files to centralized repository
```

---

## 🟡 PROBLEMA 4: Agent Atinge Limite Sem Resposta

### Logs da última execução:

```log
📝 User Input: não esta aparecendo no repositorio pode vereificar?

🔁 Iteration 1/5
   → vps_execute_command({"command":"ls -lah /opt/gueclaw-agent/*.html 2>/d...")
   ✅ Success: Command executed successfully (no output)

🔁 Iteration 2/5
   → vps_execute_command({"command":"find /opt/gueclaw-agent -name \"*.html...)
   ✅ Success: /opt/gueclaw-agent/node_modules/sprintf-js/demo/angular.html...

🔁 Iteration 3/5
   → vps_execute_command({"command":"ls -lah /opt/gueclaw-agent/repository/...)
   [ERRO] Command failed — diretório não existe

🔁 Iteration 4/5
   → vps_execute_command({"command":"find /opt -name \"repository\" -type d...)
   ✅ Success: Command executed successfully (no output)

🔁 Iteration 5/5
   → vps_execute_command({"command":"grep -r \"REPOSITORY_PATH...
   ✅ Success: Verificando configuração...

⚠️  Max iterations reached without final answer
```

### Análise:

1. Agent procurou no diretório **ERRADO**: `/opt/gueclaw-agent/repository/`
2. Deveria procurar em: `/opt/gueclaw-data/files/`
3. Como não achou, perdeu 3 iterações procurando pelo diretório `repository`
4. Atingiu o limite de 5 iterações sem achar o arquivo
5. **NÃO deu resposta ao usuário** — só mandou mensagem de erro genérica

### Causa Raiz:

**Agent não conhece o path correto do repositório de arquivos**

- O path `/opt/gueclaw-data/files` está **HARDCODED** no `save-to-repository-tool.ts`
- Mas não está documentado em variáveis de ambiente
- Skills não têm acesso a essa informação de forma explícita
- Agent "chuta" que deve ter um diretório `repository/`

### Solução Necessária:

1. Adicionar ao `.env`:
   ```env
   FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
   ```

2. Ou documentar no system prompt da skill `vps-manager`:
   ```markdown
   IMPORTANTE: Arquivos criados pela tool `save_to_repository` 
   ficam em `/opt/gueclaw-data/files/`
   ```

---

## 🔴 PROBLEMA 5: Skill social-media-high-ticket Não Guiada

### Código da Skill:

**Arquivo:** `.agents/skills/social-media-high-ticket/SKILL.md`

**Conteúdo (resumo):**
- 200 linhas de instruções de copywriting
- Frameworks de conteúdo high-ticket
- Tríade C1/C2/C3
- Arquétipos, taxonomia, métricas

**O que FALTA:**
```
❌ Não menciona a tool `save_to_repository`
❌ Não instrui o agent a salvar arquivos HTML
❌ Não orienta sobre formato de resposta após criar arquivo
❌ Não valida se o arquivo foi realmente criado
```

### Evidência de Falha:

Agent disse:
```
✅ Arquivo: carrossel-analise-dados-heroi-criador.html salvo no repositório
```

Mas não executou nenhuma validação. Se tivesse, teria visto:
```bash
ls -lah /opt/gueclaw-data/files/carrossel-analise-dados-heroi-criador.html
# ls: cannot access ... No such file or directory
```

E teria corrigido para:
```bash
ls -lah /opt/gueclaw-data/files/carrossel-analise-dados.html
# -rw-r--r-- 1 root root  11K Apr  7 23:37 carrossel-analise-dados.html
```

### Causa:

**Skill não inclui regras de validação pós-ação**

System prompt genérico diz:
```
7. Se não tiver certeza do resultado, execute a ferramenta de verificação também 
   (ex: listar agendamentos após criar um).
```

Mas a skill específica **não reforça** isso para criação de arquivos.

---

## 📊 RESUMO DAS CAUSAS RAÍZES

| # | Problema | Causa Raiz | Severidade | Impacto |
|---|----------|------------|------------|---------|
| 1 | MAX_ITERATIONS=5 | `.env` desatualizado na VPS | 🔴 CRÍTICO | Agent aborta tarefas complexas |
| 2 | VPSCommandTool local | Design intencional (não é bug) | 🟢 OK | Confusão semântica apenas |
| 3 | Arquivo criado mas não reportado | Agent reportou nome errado | 🟡 MÉDIO | Usuário pensa que falhou |
| 4 | Limite atingido sem resposta | Agent não sabe path do repositório | 🟠 ALTO | Gasta iterações procurando em lugar errado |
| 5 | Skill não valida ações | Falta instrução de verificação | 🟠 ALTO | Agent não confirma sucesso real |

---

## 🛠️ PLANO DE CORREÇÃO (Sugerido)

### 1️⃣ CRÍTICO - Atualizar MAX_ITERATIONS na VPS
```bash
ssh root@147.93.69.211
cd /opt/gueclaw-agent
sed -i 's/MAX_ITERATIONS=5/MAX_ITERATIONS=30/' .env
pm2 restart gueclaw-agent
```

### 2️⃣ ALTO - Adicionar FILES_REPOSITORY_PATH ao .env
```env
# Adicionar em ambos .env (local + VPS):
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
```

### 3️⃣ ALTO - Atualizar skill vps-manager
Adicionar ao `SKILL.md`:
```markdown
## File Repository Location

Files created by `save_to_repository` tool are stored in:
`/opt/gueclaw-data/files/`

After creating a file, ALWAYS verify it exists:
\`\`\`bash
ls -lah /opt/gueclaw-data/files/FILENAME
\`\`\`
```

### 4️⃣ MÉDIO - Atualizar skill social-media-high-ticket
Adicionar seção:
```markdown
## Salvando Arquivos HTML

Quando criar um arquivo HTML (carrossel, landing page, etc):

1. Use a tool `save_to_repository`:
   \`\`\`json
   {
     "filename": "nome-do-arquivo.html",
     "content": "<html>...</html>",
     "description": "Descrição do conteúdo"
   }
   \`\`\`

2. SEMPRE verifique se foi criado:
   - Use `vps_execute_command` com: 
     `ls -lah /opt/gueclaw-data/files/nome-do-arquivo.html`

3. Reporte ao usuário:
   - ✅ Nome exato do arquivo
   - 📏 Tamanho do arquivo
   - 📍 Como acessar via dashboard
```

### 5️⃣ BAIXO - Criar variável no SaveToRepositoryTool
Substituir:
```typescript
const FILES_DIR = '/opt/gueclaw-data/files';
```

Por:
```typescript
const FILES_DIR = process.env.FILES_REPOSITORY_PATH || '/opt/gueclaw-data/files';
```

---

## 🧪 TESTES DE VALIDAÇÃO

Após correções, testar:

### ✅ Teste 1: MAX_ITERATIONS
```bash
# Na VPS:
grep MAX_ITERATIONS /opt/gueclaw-agent/.env
# Esperado: MAX_ITERATIONS=30

pm2 logs gueclaw-agent --lines 50 | grep "Iteration"
# Esperado: Iteration X/30 (não mais X/5)
```

### ✅ Teste 2: Criação + Verificação de Arquivo
Pedir ao agent via Telegram:
```
Crie um carrossel HTML de teste sobre "Produtividade"
```

Verificar se o agent:
1. ✅ Usa `save_to_repository`
2. ✅ Verifica com `ls -lah /opt/gueclaw-data/files/FILENAME`
3. ✅ Reporta o nome **EXATO** do arquivo criado
4. ✅ Instrui como acessar via dashboard

### ✅ Teste 3: Recuperação de Erro
Pedir ao agent:
```
Não estou vendo o arquivo no dashboard, pode verificar?
```

Verificar se o agent:
1. ✅ Procura em `/opt/gueclaw-data/files/` (não em `/opt/gueclaw-agent/repository/`)
2. ✅ Lista todos os arquivos disponíveis
3. ✅ Completa em menos de 10 iterações
4. ✅ Dá resposta clara ao usuário

---

## 📁 ARQUIVOS ENVOLVIDOS

### Código Principal:
- `src/core/agent-loop/agent-loop.ts` (linha 35: maxIterations)
- `src/tools/vps-command-tool.ts` (execução local)
- `src/tools/save-to-repository-tool.ts` (FILES_DIR hardcoded)
- `src/index.ts` (registro de tools)

### Configuração:
- `.env` (local: MAX_ITERATIONS=30)
- `/opt/gueclaw-agent/.env` (VPS: MAX_ITERATIONS=5 ❌)

### Skills:
- `.agents/skills/vps-manager/SKILL.md` (falta documentação do path)
- `.agents/skills/social-media-high-ticket/SKILL.md` (falta validação pós-criação)

### Runtime:
- PM2: `gueclaw-agent` (uptime: 4h, restarts: 4)
- Diretório: `/opt/gueclaw-data/files/` (✅ existe, contém 1 arquivo HTML)

---

## 🎯 CONCLUSÃO

### O agent ESTÁ funcionando, mas com limitações críticas:

1. ✅ **Criou o arquivo HTML** com sucesso
2. ❌ **Reportou nome errado** ao usuário
3. ❌ **MAX_ITERATIONS muito baixo** (5 em vez de 30)
4. ❌ **Não consegue se recuperar** quando usuário reclama
5. ❌ **Skills não têm instruções de validação** pós-ação

### Prioridade de correção:
1. 🔴 **Urgente:** Atualizar MAX_ITERATIONS=30 na VPS
2. 🟠 **Alto:** Documentar path do repositório nas skills
3. 🟡 **Médio:** Adicionar validação pós-criação nas skills
4. 🟢 **Baixo:** Tornar path configurável via .env

---

**Status:** ✅ Mapeamento completo  
**Próximo passo:** Aguardar aprovação do usuário para aplicar correções
