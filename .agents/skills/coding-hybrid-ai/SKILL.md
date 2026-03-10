---
name: coding-hybrid-ai
description: Geração de código híbrida usando DeepSeek V3/R1 + Kimi (Moonshot). Use para tarefas complexas de codificação onde é necessário analisar grandes codebases, filtrar contexto relevante com Kimi, gerar código otimizado com DeepSeek, e validar o resultado. Ideal para refactoring, novas features em projetos grandes, ou otimização de performance.
---

# Coding Hybrid AI - DeepSeek + Kimi

Skill para geração de código usando um fluxo híbrido de duas IAs: **Kimi (filtra contexto)** + **DeepSeek (gera código)**.

## Como Funciona o Fluxo

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│  User Query +   │────▶│  FASE 1: Kimi    │────▶│ FASE 2: DeepSeek│────▶│ FASE 3: Kimi     │
│  Codebase       │     │  (Filtro)        │     │ (Geração)       │     │ (Validação)      │
│  (grande)       │     │                  │     │                 │     │                  │
└─────────────────┘     │ • Analisa código │     │ • Recebe resumo │     │ • Valida imports │
                        │ • Identifica     │     │ • Gera código   │     │ • Valida vars    │
                        │   arquivos afet  │     │   otimizado     │     │ • Gera output    │
                        │ • Gera resumo    │     │                 │     │   final          │
                        │   (max 4000tk)   │     │                 │     │                  │
                        └──────────────────┘     └─────────────────┘     └──────────────────┘
```

## Quando Usar Esta Skill

Use quando:
1. Precisar gerar código em projetos grandes (muitos arquivos)
2. O contexto excede o limite de tokens de uma única IA
3. Quiser código otimizado para performance (DeepSeek é excelente nisso)
4. Precisar de análise profunda de dependências antes de codar
5. Fazer refactoring em múltiplos arquivos
6. Adicionar features que afetam várias partes do sistema

## NÃO Use Quando

- Projetos pequenos (< 10 arquivos)
- Alterações em arquivo único isolado

## Tarefas Simples - Use Apenas Kimi

Para tarefas simples que não exigem o fluxo híbrido completo, use **apenas a Kimi** diretamente:

**Quando usar apenas Kimi:**
- Análise de código único ou poucos arquivos
- Explicação de conceitos
- Debugging simples
- Geração de código em contexto pequeno (< 10 arquivos)
- Tarefas onde o contexto cabe em uma única chamada

**Comando rápido via execute_python:**
Utilize a ferramenta `execute_python` com os seguintes argumentos:
```json
{
  "scriptName": "coding-hybrid-ai/kimi_filter.py",
  "args": [
    "--query", "Explique esta função e sugira melhorias",
    "--context-dir", "./src/single-file.py",
    "--output", "./analysis.md"
  ]
}
```

**Vantagem:** Mais rápido e econômico (apenas 1 API ao invés de 3)

## Requisitos

```bash
pip install aiohttp
```

## Variáveis de Ambiente

```bash
DEEPSEEK_API_KEY=sk-...
KIMI_API_KEY=sk-...
```

## APIs Utilizadas

### Kimi (Moonshot)
- Modelo: `moonshot-v1-128k` (para análise de grande contexto)
- Endpoint: `https://api.moonshot.cn/v1/chat/completions`
- Documentação: Ver `references/kimi-api.md`

### DeepSeek
- Modelo: `deepseek-coder` ou `deepseek-chat`
- Endpoint: `https://api.deepseek.com/v1/chat/completions`
- Documentação: Ver `references/deepseek-api.md`

## Executores Disponíveis (Framework DOE)

Todos os scripts residem em `execution/coding-hybrid-ai/`. O Agente **DEVE** acioná-los usando a Tool `execute_python`.

### 1. Fluxo Completo
**scriptName:** `coding-hybrid-ai/hybrid_coding.py`

**Argumentos:**
- `--query`: A solicitação (ex: "Refatore X")
- `--context-dir`: Diretório base do contexto (ex: "./src")
- `--output`: Destino do markdown (ex: "./result.md")

### 2. Apenas Fase 1 (Kimi Filter)
**scriptName:** `coding-hybrid-ai/kimi_filter.py`

**Argumentos:**
Mesmo formato de paths, ideal para focar numa extração de metadados sem acionar DeepSeek.

### 3. Apenas Fase 2 (DeepSeek Generate)
**scriptName:** `coding-hybrid-ai/deepseek_generate.py`

**Argumentos:**
Recebe o `--context-file` com o markdown já sumariado pela Kimi, ex: `./context_summary.md`.

## Fluxo de Trabalho Detalhado

### FASE 1: Kimi - O Filtro de Contexto

**Objetivo:** Reduzir codebase grande para resumo técnico (max 4000 tokens)

**Prompt do Kimi:**
```
Você é um arquiteto de software sênior. Analise o seguinte codebase e identifique
quais arquivos, classes e funções são diretamente afetados por esta solicitação:

SOLICITAÇÃO DO USUÁRIO: {user_query}

CODEBASE COMPLETO:
{codebase_context}

Gere um "Resumo Técnico de Contexto" com:
1. Lista dos arquivos que precisam ser modificados
2. Interfaces/classes relevantes e seus métodos
3. Dependências críticas
4. Estrutura de dados envolvida
5. Possíveis impactos em outras partes do sistema

IMPORTANTE: Máximo 4000 tokens. Seja conciso mas completo.
```

**Output esperado:**
```markdown
## Resumo Técnico de Contexto

### Arquivos Afetados
- src/auth/jwt_handler.py (modificar)
- src/auth/middleware.py (novo)
- src/config/settings.py (adicionar config)

### Classes/Interfaces Relevantes
- class JWTHandler: método generate_token(), validate_token()
- class AuthMiddleware: novo

### Dependências
- PyJWT (nova dependência)
- src/models/user.py (usado para claims)

### Estrutura de Dados
- JWTClaims: {user_id, email, exp, iat}
```

### FASE 2: DeepSeek - A Geração de Código

**Objetivo:** Gerar código otimizado baseado no resumo filtrado

**Prompt do DeepSeek:**
```
Você é um engenheiro de software especialista em performance. Gere o código
final baseado no contexto técnico fornecido + a solicitação original.

SOLICITAÇÃO ORIGINAL: {user_query}

CONTEXTO TÉCNICO (filtrado pelo arquiteto):
{context_summary}

REQUISITOS:
1. Gere APENAS o código final, pronto para uso
2. Foque em performance e lógica pura
3. Inclua imports necessários
4. Adicione comentários explicativos apenas onde necessário
5. Siga as convenções do projeto existente

FORMATO DE SAÍDA:
```python
# arquivo: src/caminho/arquivo.py
<código aqui>
```
```

**Output esperado:**
```markdown
## Código Gerado

### src/auth/jwt_handler.py
```python
import jwt
from datetime import datetime, timedelta
from typing import Dict, Optional

class JWTHandler:
    def __init__(self, secret: str, algorithm: str = "HS256"):
        self.secret = secret
        self.algorithm = algorithm
    
    def generate_token(self, user_id: str, email: str) -> str:
        payload = {
            "user_id": user_id,
            "email": email,
            "exp": datetime.utcnow() + timedelta(hours=24),
            "iat": datetime.utcnow()
        }
        return jwt.encode(payload, self.secret, algorithm=self.algorithm)
```

### src/auth/middleware.py
```python
# código do middleware...
```
```

### FASE 3: Kimi - Validação Final

**Objetivo:** Garantir que imports e nomes batem com o projeto original

**Prompt do Kimi:**
```
Valide o código gerado contra o contexto original do projeto.

CÓDIGO GERADO:
{deepseek_output}

CONTEXTO ORIGINAL DO PROJETO:
{original_context}

VERIFIQUE:
1. Todas as importações existem no projeto?
2. Nomes de classes/funções estão consistentes?
3. Paths de arquivos estão corretos?
4. Não há conflitos de nomenclatura?

Se encontrar inconsistências, corrija-as.
Gere o output final em Markdown limpo.
```

## Tratamento de Erros

### Fallback - Kimi Falhou
Se a Fase 1 (Kimi) falhar ou timeout:
1. Tente enviar contexto reduzido (apenas arquivos mais relevantes)
2. Se ainda falhar, envie user_query direto ao DeepSeek com aviso:
   ```
   ⚠️ Contexto completo não pôde ser filtrado. 
   Código gerado pode não considerar todas as dependências.
   ```

### Fallback - DeepSeek Falhou
Se a Fase 2 falhar:
1. Tente com modelo alternativo (deepseek-chat ao invés de deepseek-coder)
2. Se persistir, retorne erro com sugestão de simplificar a query

### Retry Logic
- Kimi: 3 tentativas com backoff exponencial
- DeepSeek: 2 tentativas
- Timeout: 60s para Kimi (análise), 30s para DeepSeek (geração)

## Configurações

### Limite de Tokens
| Fase | Modelo | Max Tokens | Temperature |
|------|--------|------------|-------------|
| 1 (Filtro) | kimi-128k | 4000 | 0.3 |
| 2 (Geração) | deepseek-coder | 8000 | 0.2 |
| 3 (Validação) | kimi-128k | 4000 | 0.1 |

### Rate Limits
- Kimi: 60 RPM (requests por minuto)
- DeepSeek: 30 RPM

A skill gerencia automaticamente com rate limiting interno.

## Exemplos de Uso

### Exemplo 1: Refactoring
```json
{
  "scriptName": "coding-hybrid-ai/hybrid_coding.py",
  "args": [
    "--query", "Migre de callbacks para async/await em todo o módulo de database",
    "--context-dir", "./src/database",
    "--output", "./refactor_plan.md"
  ]
}
```

### Exemplo 2: Nova Feature
```json
{
  "scriptName": "coding-hybrid-ai/hybrid_coding.py",
  "args": [
    "--query", "Adicione sistema de cache Redis com TTL configurável",
    "--context-dir", "./src",
    "--include", "*.py",
    "--exclude", "*test*,*__pycache__*",
    "--output", "./cache_implementation.md"
  ]
}
```

### Exemplo 3: Otimização
```json
{
  "scriptName": "coding-hybrid-ai/hybrid_coding.py",
  "args": [
    "--query", "Otimize a query de relatório mensal que está lenta",
    "--context-dir", "./src/reports",
    "--focus-on-performance",
    "--output", "./optimized_query.md"
  ]
}
```

## Referências

- `references/kimi-api.md` - Documentação da API Moonshot
- `references/deepseek-api.md` - Documentação da API DeepSeek
- `references/examples.md` - Exemplos reais de uso
