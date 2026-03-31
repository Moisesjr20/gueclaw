# 🔒 Relatório de Segurança do Banco de Dados - GueClaw
**Data:** 31 de Março de 2026

---

## ✅ BOAS NOTÍCIAS

### GitHub está Seguro
- ✅ `.env` **NUNCA foi commitado** ao repositório
- ✅ `*.db` **NUNCA foi commitado** ao repositório  
- ✅ `.gitignore` está configurado corretamente
- ✅ Nenhuma credencial exposta publicamente

---

## ⚠️ VULNERABILIDADES CRÍTICAS ENCONTRADAS

### 🔴 Nível CRÍTICO (Ação Imediata Necessária)

#### 1. Credenciais em Texto Plano
**Local:** `D:\Clientes de BI\projeto GueguelClaw\.env`

**Credenciais Expostas:**
- 🔑 Telegram Bot Token
- 🔑 VPS Root Password (!!!)
- 🔑 Google OAuth Client Secrets (2 contas)
- 🔑 Google Refresh Tokens (2 contas)
- 🔑 GitHub Personal Access Tokens (2 tokens)
- 🔑 UazAPI Token
- 🔑 n8n API Key
- 🔑 Gemini API Key
- 🔑 DeepSeek API Key

**Total:** 15+ credenciais em texto plano acessíveis localmente

#### 2. Banco de Dados Sem Criptografia
**Local:** `./data/gueclaw.db` (local) e `/opt/gueclaw-agent/data/gueclaw.db` (VPS)

**Dados Sensíveis Armazenados:**
- 💬 Histórico completo de conversas do Telegram
- 👤 IDs de usuários (Telegram user_id)
- 🔧 Comandos executados na VPS (podem conter senhas temporárias)
- 📅 Eventos do Google Calendar (compromissos privados)
- 📞 Números de WhatsApp e conteúdo de mensagens
- 🔐 Argumentos de ferramentas (podem incluir tokens/senhas)

**Risco:** Se alguém copiar o arquivo `.db`, lê tudo em texto plano com SQLite Browser

#### 3. VPS Acessível via Senha SSH
**Host:** `root@147.93.69.211`

**Problemas:**
- ❌ Autenticação via senha em vez de chave SSH
- ❌ Senha armazenada no `.env` local
- ❌ Acesso root direto (deveria ser usuário limitado + sudo)

**Risco:** Brute force attacks, e se `.env` vazar = acesso root total à VPS

#### 4. Permissões Excessivas no `.env` (Windows)
**Permissões Atuais:**
- ✅ SISTEMA (OK - necessário)
- ✅ Administradores (OK)
- ⚠️ **Usuários Autenticados = Leitura/Modificação** (PROBLEMA)
- ⚠️ **BUILTIN\\Usuários = Leitura** (PROBLEMA)

**Risco:** Qualquer usuário logado no Windows pode ler suas credenciais

---

### 🟡 Nível ALTO (Implementar em 1-2 Semanas)

#### 5. Sem Backup Criptografado
- ❌ Nenhum script de backup no repositório
- ❌ Sem estratégia de disaster recovery
- ❌ Se a VPS cair ou for hackeada = perda total de dados

#### 6. Firewall Desconhecido na VPS
- ❓ Não sabemos se `ufw` está habilitado
- ❓ Portas podem estar abertas desnecessariamente
- ❓ Sem proteção contra port scanning

---

### 🟢 Nível MÉDIO (Boas Práticas)

#### 7. Dados Não Segregados
- ℹ️ Conversas pessoais misturadas com dados de trabalho
- ℹ️ Futuro módulo financeiro usará mesmo banco sem isolamento extra

---

## 📊 Score de Segurança Geral

```
┌─────────────────────────────────────────┐
│  Segurança Atual: 3.5 / 10 (BAIXA)     │
│                                         │
│  ■■■□□□□□□□                             │
│                                         │
│  Principais Riscos:                     │
│  • Credenciais não protegidas           │
│  • Banco de dados legível em plaintext  │
│  • Acesso VPS via senha                 │
└─────────────────────────────────────────┘
```

---

## 🎯 PLANO DE AÇÃO PRIORITÁRIO

### Esta Semana (Ganho: +3.5 pontos)

1. **[2h] Migrar SSH de Senha para Chave** 
   - Gerar par de chaves Ed25519
   - Copiar chave pública para VPS
   - Desabilitar autenticação por senha no `sshd_config`
   - Remover `VPS_PASSWORD` do `.env`

2. **[3h] Implementar Criptografia do Banco SQLite**
   - Instalar SQLCipher
   - Gerar chave de 256-bit
   - Migrar banco existente para versão criptografada
   - Atualizar `database.ts` para usar `PRAGMA key`

3. **[15min] Restringir Permissões do `.env`**
   - PowerShell: remover acesso de "Usuários" e "Usuários Autenticados"
   - Manter apenas SISTEMA + conta do desenvolvedor

4. **[1h] Configurar Backup Automatizado**
   - Script que roda diariamente via cron
   - Backup criptografado com GPG
   - Retenção de 30 dias

### Este Mês (Ganho: +2 pontos)

5. **[30min] Habilitar Firewall na VPS**
   - `ufw enable` com regras restritivas
   - Permitir apenas SSH (22), HTTP (80), HTTPS (443)

6. **[2h] Auditoria de Credenciais**
   - Trocar todas as senhas/tokens se houver suspeita de vazamento
   - Configurar rotação trimestral

### Próximo Trimestre (Ganho: +1 ponto)

7. **[1 semana] Migrar para Secrets Manager**
   - Hashicorp Vault ou AWS Secrets Manager
   - `.env` passa a ter apenas `VAULT_ADDR` e `VAULT_TOKEN`

---

## 💰 Impacto de um Vazamento (Simulação)

**Cenário:** Atacante obtém acesso ao `.env` + banco `.db`

| O que ele pode fazer | Tempo | Impacto |
|---|---|---|
| Ler todo histórico de conversas | 1 min | CRÍTICO - Dados pessoais expostos (LGPD) |
| Acessar VPS como root | 1 min | CRÍTICO - Controle total dos servidores |
| Enviar mensagens como seu bot no Telegram | 2 min | ALTO - Phishing, spam, fraude |
| Acessar Google Calendar (2 contas) | 2 min | ALTO - Roubo de agenda, espionagem |
| Criar/deletar eventos, compromissos | 3 min | ALTO - Sabotagem |
| Enviar mensagens via WhatsApp (UazAPI) | 3 min | ALTO - Spam, golpes em seu nome |
| Executar workflows do n8n | 5 min | MÉDIO - Depende dos workflows |
| Apagar banco de dados | 10 seg | CRÍTICO - Perda total de dados |

**Custo Estimado de Recuperação:** R$ 50.000 - R$ 200.000  
(Forensics, notificação LGPD, multas, reputação, refazer integrações)

---

## ✅ O QUE FAZER AGORA?

### Opção 1: Implementação Guiada (Recomendado)
Posso gerar scripts prontos para cada correção e guiá-lo passo a passo. Começamos?

### Opção 2: Relatório + Checklist
Forneço um checklist detalhado e você implementa no seu ritmo.

### Opção 3: Adiar
Aceita o risco atual e implementa depois (NÃO RECOMENDADO para módulo financeiro).

---

**Qual opção você prefere?**

Quero implementar as correções de segurança agora ou precisa de mais detalhes antes?
