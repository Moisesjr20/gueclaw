# 🎯 PRÓXIMO PASSO: Skills de Receita (Phase 1.2)

**Data:** 01/04/2026  
**Branch Atual:** `feature/grep-glob-tools`  
**Último Deploy:** ✅ Cost Tracker (Commit `b4d9c4d`)  
**Infraestrutura Completa:** GrepTool + GlobTool + Cost Tracker ✅

---

## 📊 STATUS ATUAL

✅ **Infraestrutura de Ferramentas Completa:**
- ✅ GrepTool - Busca em código (ripgrep)
- ✅ GlobTool - Listagem de arquivos (glob patterns)
- ✅ Cost Tracker - Monitoramento de custos LLM

✅ **Sistema de Skills:**
- ✅ SkillTool - Auto-discovery de 23+ skills
- ✅ ForkedExecutor - Execução isolada
- ✅ 234/234 testes passando

🎯 **Próximo Milestone:** Implementar Skills que **GERAM RECEITA DIRETA**

---

## 🚀 PHASE 1.2: REVENUE-GENERATING SKILLS

**Objetivo:** Criar skills que **VENDEM MAIS RÁPIDO** e **ENTREGAM MAIS PROJETOS**  
**Esforço Estimado:** 8-12 horas (2-3 dias)  
**ROI:** 🔥🔥🔥🔥🔥 **ALTÍSSIMO** - Gera receita direta

### Estratégia

As 3 skills abaixo usam **GrepTool + GlobTool** para analisar projetos e gerar valor imediato:

1. **proposal-generator** → Acelera vendas
2. **code-reviewer** → Entrega projetos com qualidade
3. **documentation-generator** → Reduz tempo de onboarding

---

## 1️⃣ PROPOSAL-GENERATOR SKILL

**Prioridade:** 🔥🔥🔥🔥🔥 CRÍTICA  
**Esforço:** 3-4h  
**ROI:** Gera propostas comerciais em **5 minutos** (vs 2-3 horas manual)

### 📋 Funcionalidade

```
/skill proposal-generator

INPUT:
- Cliente: "Empresa ABC Ltda"
- Projeto: "Sistema de controle financeiro"
- Prazo: "45 dias"
- Budget: R$ 15.000

OUTPUT:
📄 Proposta Comercial Completa:
- Resumo executivo
- Escopo detalhado
- Cronograma de entregas
- Investimento e condições
- Cases de sucesso
- Termos e condições
```

### 🛠️ Implementação

**Arquivo:** `.agents/skills/proposal-generator/SKILL.md`

```markdown
# Proposal Generator Skill

Gera propostas comerciais completas e profissionais.

## Quando Usar

- "Crie uma proposta para [cliente] sobre [projeto]"
- "Gere proposta de R$ [valor] para [serviço]"
- "Montar proposta de [prazo] dias para [escopo]"

## Fluxo de Trabalho

1. Coletar informações do cliente via perguntas
2. Analisar projetos similares no portfolio (GrepTool)
3. Calcular estimativas de esforço
4. Gerar proposta formatada em Markdown/PDF
5. Salvar em `proposals/[cliente]-[data].md`

## Template de Proposta

```markdown
# PROPOSTA COMERCIAL - [CLIENTE]

## 1. RESUMO EXECUTIVO
[Visão geral do projeto]

## 2. ESCOPO DO PROJETO
### 2.1 Objetivos
- [Objetivo 1]
- [Objetivo 2]

### 2.2 Entregas
- [Entrega 1] - Prazo: [X dias]
- [Entrega 2] - Prazo: [Y dias]

## 3. CRONOGRAMA
| Fase | Atividades | Prazo |
|------|-----------|-------|
| 1    | [Atividades fase 1] | [X dias] |
| 2    | [Atividades fase 2] | [Y dias] |

## 4. INVESTIMENTO
**Valor Total:** R$ [VALOR]
**Condições:** [Parcelas/Forma de pagamento]

## 5. DIFERENCIAIS
- [Diferencial 1]
- [Diferencial 2]

## 6. CASES DE SUCESSO
- [Case 1]
- [Case 2]

## 7. VALIDADE
Esta proposta é válida por 15 dias.

---
[Nome da Empresa] | [Contato] | [Website]
```

## Dependências

- GrepTool (buscar cases similares)
- FileSystem (salvar proposta)
- LLM provider (gerar conteúdo)

## Variáveis de Ambiente

```
COMPANY_NAME=Kyrius Soluções
COMPANY_CONTACT=contato@kyrius.info
COMPANY_WEBSITE=https://kyrius.com.br
PROPOSALS_DIR=./docs/proposals
```
```

### 💰 ROI Esperado

**Antes (Manual):**
- Tempo: 2-3 horas por proposta
- Custo: R$ 150-300 (hora de trabalho)
- Variação: Alta (qualidade inconsistente)

**Depois (Automatizado):**
- Tempo: 5 minutos
- Custo: ~$0.02 (LLM tokens)
- Variação: Baixa (template padronizado)

**Ganho:** 
- ⏱️ **95% menos tempo**
- 💰 **99% menos custo**
- 📈 **Mais propostas → Mais vendas**

---

## 2️⃣ CODE-REVIEWER SKILL

**Prioridade:** 🔥🔥🔥🔥 ALTA  
**Esforço:** 3-4h  
**ROI:** Identifica bugs/vulnerabilidades **antes do deploy**

### 📋 Funcionalidade

```
/skill code-reviewer

INPUT:
- Path: "src/"
- Focus: "security, performance, best-practices"
- Output: "./reports/code-review-2026-04-01.md"

OUTPUT:
📊 Relatório de Code Review:
- 🔴 Critical: 2 issues
- 🟡 Warning: 8 issues  
- 🟢 Info: 15 suggestions
- ✅ Score: 7.5/10

Detalhes:
- SQL Injection vulnerability em user-controller.ts:45
- Memory leak potencial em websocket-handler.ts:128
- Performance issue em data-processor.ts:89
```

### 🛠️ Implementação

**Arquivo:** `.agents/skills/code-reviewer/SKILL.md`

```markdown
# Code Reviewer Skill

Analisa código-fonte e identifica problemas de qualidade, segurança e performance.

## Quando Usar

- "Revise o código em src/"
- "Analise segurança do arquivo [path]"
- "Faça code review do PR #123"

## Fluxo de Trabalho

1. **Descoberta** - GlobTool lista arquivos (*.ts, *.js, *.py)
2. **Análise** - GrepTool busca patterns suspeitos:
   - SQL injection: `query.*\+.*req\.body`
   - XSS: `innerHTML.*req\.query`
   - Hardcoded secrets: `password.*=.*"`, `api_key.*=.*"`
   - Memory leaks: `setInterval` sem clear, event listeners órfãos
3. **Classificação** - Severidade: critical, warning, info
4. **Relatório** - Markdown estruturado

## Detecção de Problemas

### 🔴 Critical (Bloqueadores)
- SQL Injection
- XSS vulnerabilities
- Hardcoded credentials
- Path traversal
- Command injection

### 🟡 Warning (Importantes)
- Memory leaks
- N+1 queries
- Blocking I/O em loops
- Falta de validação de input
- Código duplicado extenso

### 🟢 Info (Melhorias)
- Código não usado
- Falta de tipos TypeScript
- Comentários TODO antigos
- Código formatado incorretamente
- Falta de testes

## Template de Relatório

```markdown
# 📊 CODE REVIEW REPORT

**Data:** [Data]  
**Projeto:** [Nome]  
**Arquivos Analisados:** [N]  
**Score:** [X]/10

---

## 🔴 CRITICAL ISSUES (Bloqueadores)

### 1. SQL Injection Vulnerability
**File:** `src/controllers/user-controller.ts:45`
**Severity:** 🔴 CRITICAL

```typescript
// ❌ VULNERÁVEL
const query = `SELECT * FROM users WHERE id = ${req.params.id}`;

// ✅ CORRETO
const query = `SELECT * FROM users WHERE id = ?`;
db.query(query, [req.params.id]);
```

**Impacto:** Atacante pode executar SQL arbitrário
**Recomendação:** Use prepared statements

---

## 🟡 WARNINGS (Importantes)

### 2. Memory Leak Potencial
**File:** `src/services/websocket-handler.ts:128`
**Severity:** 🟡 WARNING

```typescript
// ❌ PROBLEMA
setInterval(() => {
  checkConnection();
}, 5000);

// ✅ CORRETO
const intervalId = setInterval(() => {
  checkConnection();
}, 5000);

// Limpar no destroy/disconnect
clearInterval(intervalId);
```

**Impacto:** Memória crescente com o tempo
**Recomendação:** Sempre limpar timers/listeners

---

## 🟢 INFO (Melhorias)

### 3. Código Duplicado
**Files:** 
- `src/utils/validators.ts:12-24`
- `src/utils/helpers.ts:45-57`

**Recomendação:** Extrair função compartilhada

---

## 📈 MÉTRICAS

| Métrica | Valor |
|---------|-------|
| Linhas de código | 12,345 |
| Arquivos analisados | 156 |
| Issues críticos | 2 |
| Warnings | 8 |
| Sugestões | 15 |
| Cobertura de testes | 67% |

## ✅ PRÓXIMOS PASSOS

1. 🔴 Corrigir SQL injection em user-controller.ts
2. 🟡 Resolver memory leak em websocket-handler.ts
3. 🟢 Refatorar código duplicado em validators/helpers
4. 📝 Aumentar cobertura de testes para 80%
```

## Dependências

- GlobTool (listar arquivos)
- GrepTool (buscar patterns)
- FileSystem (ler código)
- LLM (análise contextual)

## Configuração

```
CODE_REVIEW_MIN_SCORE=7.0
CODE_REVIEW_OUTPUT_DIR=./reports
CODE_REVIEW_SEVERITY_CRITICAL=["sql_injection", "xss", "secrets"]
CODE_REVIEW_SEVERITY_WARNING=["memory_leak", "n_plus_1", "blocking_io"]
```
```

### 💰 ROI Esperado

**Antes (Manual):**
- Tempo: 4-6 horas por projeto
- Custo: R$ 400-800
- Bugs: Detectados em produção (custam 10x+ mais)

**Depois (Automatizado):**
- Tempo: 5 minutos
- Custo: ~$0.05 (LLM)
- Bugs: Detectados antes do deploy

**Ganho:**
- ⏱️ **95% menos tempo**
- 🐛 **10x menos bugs em produção**
- 💰 **Economiza R$ 5.000-10.000 por bug crítico evitado**

---

## 3️⃣ DOCUMENTATION-GENERATOR SKILL

**Prioridade:** 🔥🔥🔥🔥 ALTA  
**Esforço:** 2-3h  
**ROI:** Reduz tempo de onboarding de **2 semanas → 2 dias**

### 📋 Funcionalidade

```
/skill documentation-generator

INPUT:
- Project: "./src"
- Type: "README | API | Architecture"
- Language: "pt-BR"

OUTPUT:
📚 Documentação Completa:
- README.md com quickstart
- docs/API.md com endpoints
- docs/ARCHITECTURE.md com diagramas
- docs/SETUP.md com instruções
```

### 🛠️ Implementação

**Arquivo:** `.agents/skills/documentation-generator/SKILL.md`

```markdown
# Documentation Generator Skill

Gera documentação técnica completa analisando o código-fonte.

## Quando Usar

- "Gere README para src/"
- "Documente a API REST do projeto"
- "Crie documentação de arquitetura"

## Fluxo de Trabalho

1. **Análise de Estrutura** - GlobTool mapeia diretórios
2. **Extração de Metadados** - GrepTool busca:
   - Package.json (nome, versão, deps)
   - Rotas/endpoints (express.get, @Get, etc)
   - Classes/funções públicas
   - Variáveis de ambiente (.env)
3. **Geração** - Cria documentos Markdown
4. **Validação** - Verifica completude

## Templates

### README.md
```markdown
# [Project Name]

[Descrição extraída do package.json]

## 🚀 Quick Start

```bash
# Instalar dependências
npm install

# Configurar ambiente
cp .env.example .env

# Rodar projeto
npm run dev
```

## 📁 Estrutura

```
src/
├── controllers/   # Controladores REST
├── services/      # Lógica de negócio
├── models/        # Modelos de dados
└── utils/         # Utilitários
```

## 🔧 Configuração

Variáveis de ambiente necessárias:

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| DATABASE_URL | URL do banco | postgresql://... |
| API_KEY | Chave da API | abc123... |

## 📚 Documentação

- [API Reference](docs/API.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Setup Guide](docs/SETUP.md)

## 🧪 Testes

```bash
npm test
```

## 📝 Licença

[License] - Ver [LICENSE](LICENSE)
```

### API.md
```markdown
# API Reference

## Authentication

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response:**
```json
{
  "token": "eyJhbGc...",
  "user": { "id": 1, "email": "..." }
}
```

## Endpoints

### Users

#### GET /api/users
Lista todos os usuários.

**Query Parameters:**
- `limit` (number) - Máximo de resultados (default: 10)
- `offset` (number) - Offset para paginação

**Response:**
```json
{
  "users": [...],
  "total": 42
}
```

[Auto-gerado analisando rotas no código]
```

## Dependências

- GlobTool (estrutura de pastas)
- GrepTool (buscar patterns, rotas, endpoints)
- FileSystem (ler package.json, .env.example)
- LLM (gerar descrições contextuais)
```

### 💰 ROI Esperado

**Antes (Manual):**
- Tempo: 8-16 horas por projeto
- Custo: R$ 800-1.600
- Atualização: Raramente (docs desatualizados)

**Depois (Automatizado):**
- Tempo: 5 minutos
- Custo: ~$0.03 (LLM)
- Atualização: Sempre que rodar (docs sempre atualizados)

**Ganho:**
- ⏱️ **98% menos tempo**
- 📚 **Docs sempre atualizados**
- 🚀 **Onboarding 10x mais rápido**

---

## 📦 PLANO DE IMPLEMENTAÇÃO

### Fase 1: Proposal Generator (3-4h)
1. Criar `.agents/skills/proposal-generator/SKILL.md`
2. Implementar template de proposta
3. Integrar com GrepTool (buscar cases)
4. Testar: "Crie proposta para Cliente X"
5. Deploy

### Fase 2: Code Reviewer (3-4h)
1. Criar `.agents/skills/code-reviewer/SKILL.md`
2. Criar patterns de detecção (SQL injection, XSS, etc)
3. Integrar GrepTool + GlobTool
4. Testar em projeto real
5. Deploy

### Fase 3: Documentation Generator (2-3h)
1. Criar `.agents/skills/documentation-generator/SKILL.md`
2. Implementar templates (README, API, Architecture)
3. Integrar GrepTool + GlobTool
4. Testar geração de docs
5. Deploy

### Total: 8-11 horas (2-3 dias)

---

## 🎯 MÉTRICAS DE SUCESSO

Após implementação, espera-se:

| Métrica | Meta |
|---------|------|
| Propostas geradas/semana | 5-10 |
| Tempo médio de proposta | < 10 min |
| Code reviews/semana | 3-5 |
| Bugs críticos detectados | +80% |
| Docs gerados/projeto | 1 completo |
| Tempo de onboarding | -70% |

---

## 🚀 PRÓXIMOS PASSOS

1. **Branch:** Criar `feature/revenue-skills`
2. **Implementar:** proposal-generator (prioridade #1)
3. **Testar:** Gerar proposta real
4. **Implementar:** code-reviewer (prioridade #2)
5. **Testar:** Analisar código GueClaw
6. **Implementar:** documentation-generator (prioridade #3)
7. **Testar:** Gerar docs do GueClaw
8. **Deploy:** Feature branch para VPS
9. **Validar:** Usar skills em projetos reais
10. **Merge:** Para main após 48h estável

---

## 💡 DICAS DE IMPLEMENTAÇÃO

### Usar GrepTool + GlobTool

Todas as 3 skills devem usar as ferramentas implementadas:

```typescript
// Listar arquivos TypeScript
const files = await globTool.execute({
  pattern: '**/*.ts',
  path: './src'
});

// Buscar endpoints REST
const endpoints = await grepTool.execute({
  pattern: 'app\.(get|post|put|delete)',
  path: './src',
  isRegex: true
});

// Buscar SQL queries
const sqlQueries = await grepTool.execute({
  pattern: 'SELECT .* FROM',
  path: './src',
  isRegex: true
});
```

### Tracking de Custos

Como Cost Tracker está implementado, todas as chamadas LLM serão automaticamente tracked:

```typescript
// Copilot (FREE) - preferir para geração de docs
const response = await copilotProvider.generateCompletion(...);

// Verificar custo acumulado
const costs = costTracker.getTodayCosts(userId);
console.log(`Custo hoje: ${formatCost(costs.totalCostUSD)}`);
```

### Formato de Saída

Todas as skills devem retornar resultado estruturado:

```typescript
return {
  success: true,
  skill: 'proposal-generator',
  output: {
    file: './proposals/cliente-abc-2026-04-01.md',
    content: '# PROPOSTA COMERCIAL...',
    metadata: {
      client: 'Cliente ABC',
      value: 'R$ 15.000',
      deadline: '45 dias'
    }
  }
};
```

---

**Pronto para começar?** 🚀

Execute: `git checkout -b feature/revenue-skills`
