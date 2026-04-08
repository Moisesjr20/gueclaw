# 📁 Atualização: Sistema de Repositório de Arquivos

**Data:** 07/04/2026 21:20  
**Status:** ✅ Implementado

---

## 🎯 Objetivo

Garantir que o agente GueClaw **SEMPRE saiba onde salvar arquivos** que o usuário precisa acessar e que **TODOS os arquivos sejam automaticamente salvos no repositório**.

---

## 📝 Alterações Implementadas

### 1️⃣ Variável de Ambiente (Local + VPS)

**Arquivo:** `.env` e `.env.example`

```env
# ===== File Repository =====
# Directory where user-accessible files are stored (HTML, JSON, CSV, etc)
# Files saved with save_to_repository tool go here
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
```

**Ação necessária na VPS:**
```bash
# No arquivo /opt/gueclaw-agent/.env, adicionar:
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
```

### 2️⃣ Código TypeScript Atualizado

**Arquivo:** `src/tools/save-to-repository-tool.ts`

**Antes:**
```typescript
const FILES_DIR = '/opt/gueclaw-data/files';
```

**Depois:**
```typescript
const FILES_DIR = process.env.FILES_REPOSITORY_PATH || '/opt/gueclaw-data/files';
```

✅ **Benefício:** Path configurável via variável de ambiente

### 3️⃣ Skills Atualizadas com Instruções de Repositório

#### 📌 vps-manager/SKILL.md

Adicionado:
- Seção "🗂️ File Repository (IMPORTANTE)"
- Instruções explícitas sobre quando usar `save_to_repository`
- Lista de tipos de arquivo que devem ir para o repositório
- Path completo: `/opt/gueclaw-data/files/`
- Exemplos de comandos de verificação

#### 📌 social-media-high-ticket/SKILL.md

Adicionado:
- Seção "🗂️ Salvando Arquivos HTML (OBRIGATÓRIO)"
- 4 passos obrigatórios:
  1. Salvar com `save_to_repository`
  2. SEMPRE verificar se foi criado
  3. Reportar com informações EXATAS ao usuário
  4. Documentar path do repositório
- Regras de nomenclatura
- Template de resposta ao usuário
- Exemplos práticos

#### 📌 frontend-design/SKILL.md

Adicionado:
- Seção "🗂️ Salvando Código HTML (OBRIGATÓRIO)"
- Instruções para salvar interfaces/páginas completas
- Formato de resposta ao usuário
- Path do repositório

#### 📌 proposal-generator/SKILL.md

Adicionado:
- Passo 4 no pipeline: "SALVAR proposta no repositório"
- Passo 5: "VERIFICAR arquivo foi criado"

---

## 🔄 Workflow Novo do Agente

### Antes (Problemático):
```
1. Criar arquivo HTML
2. Dizer "arquivo salvo" ❌ (sem verificar)
3. Usuário não encontra
4. Agente procura em lugar errado
5. Atinge limite de iterações
```

### Agora (Correto):
```
1. Criar arquivo HTML
2. Usar save_to_repository com nome correto
3. VERIFICAR com: ls -lah /opt/gueclaw-data/files/arquivo.html
4. Confirmar tamanho e existência
5. Reportar ao usuário:
   - Nome EXATO do arquivo
   - Tamanho em KB/MB
   - Como acessar (Dashboard → Arquivos)
```

---

## 📊 Tipos de Arquivo por Skill

| Skill | Tipos de Arquivo | Deve Salvar no Repo? |
|-------|-----------------|---------------------|
| social-media-high-ticket | HTML (carrosséis, landing pages) | ✅ SIM |
| frontend-design | HTML/CSS/JS (interfaces completas) | ✅ SIM |
| proposal-generator | MD/HTML (propostas comerciais) | ✅ SIM |
| documentation-generator | MD (documentação) | ⚠️ Opcional (geralmente é codebase) |
| obsidian-notes | MD (notas pessoais) | ❌ NÃO (vai para Obsidian Vault) |
| vps-manager | Qualquer arquivo de usuário | ✅ SIM (se não for config interna) |

---

## 🧪 Como Testar

### Teste 1: Criar Carrossel via Telegram

```
Usuário: Crie um carrossel sobre "Produtividade IA"
```

**Esperado:**
1. ✅ Agent usa `save_to_repository`
2. ✅ Agent verifica com `ls -lah /opt/gueclaw-data/files/carrossel-*.html`
3. ✅ Agent reporta nome exato e tamanho
4. ✅ Usuário consegue baixar via Dashboard

### Teste 2: Listar Arquivos do Repositório

```
Usuário: Lista todos os arquivos disponíveis para download
```

**Esperado:**
1. ✅ Agent executa: `ls -lah /opt/gueclaw-data/files/`
2. ✅ Mostra lista formatada com nome, tamanho, data
3. ✅ Completa em < 5 iterações (não 30)

### Teste 3: Verificar Path Correto

```
Usuário: Onde ficam salvos os arquivos que você cria?
```

**Esperado:**
```
Os arquivos criados ficam em:
📍 /opt/gueclaw-data/files/

Você pode acessá-los via:
🌐 Dashboard Web → Aba "Arquivos"
```

---

## 🚀 Deploy na VPS

### Passo 1: Atualizar .env

```bash
ssh -i "C:\Users\kyriu\.ssh\gueclaw_vps" -p 22 root@147.93.69.211
nano /opt/gueclaw-agent/.env
```

Adicionar no final:
```env
# ===== File Repository =====
FILES_REPOSITORY_PATH=/opt/gueclaw-data/files
```

### Passo 2: Fazer git pull das skills atualizadas

```bash
cd /opt/gueclaw-agent
git pull origin main
```

### Passo 3: Rebuild (se necessário)

```bash
npm run build
```

### Passo 4: Reiniciar PM2

```bash
pm2 restart gueclaw-agent
```

### Passo 5: Verificar logs

```bash
pm2 logs gueclaw-agent --lines 30
```

**Confirmar que aparece:**
```
✅ Registered 13 tools
🔧 Registered tool: save_to_repository
```

---

## 📋 Checklist de Verificação

- [x] ✅ Variável `FILES_REPOSITORY_PATH` adicionada ao `.env` local
- [x] ✅ Variável `FILES_REPOSITORY_PATH` adicionada ao `.env.example`
- [x] ✅ Código `save-to-repository-tool.ts` usa variável de ambiente
- [x] ✅ Skill `vps-manager` documentada com path do repositório
- [x] ✅ Skill `social-media-high-ticket` com instruções obrigatórias
- [x] ✅ Skill `frontend-design` com instruções de salvamento
- [x] ✅ Skill `proposal-generator` com passo de verificação
- [ ] ⏳ `.env` na VPS atualizado com `FILES_REPOSITORY_PATH`
- [ ] ⏳ Git pull na VPS para atualizar skills
- [ ] ⏳ PM2 reiniciado na VPS
- [ ] ⏳ Teste via Telegram validado

---

## 🎯 Resultado Esperado

Após deploy completo:

1. ✅ MAX_ITERATIONS=30 (resolvido anteriormente)
2. ✅ Agent sabe path correto: `/opt/gueclaw-data/files/`
3. ✅ Agent SEMPRE verifica se arquivo foi criado
4. ✅ Agent reporta nome exato ao usuário
5. ✅ Usuário consegue baixar arquivos via Dashboard
6. ✅ Não há mais "reached maximum reasoning steps"

---

**Documentado por:** GitHub Copilot  
**Próximo passo:** Deploy na VPS conforme instruções acima
