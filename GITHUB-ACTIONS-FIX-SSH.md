# 🔐 Correção GitHub Actions - Atualização de SSH Key

## ❌ Problemas Identificados

**TODAS as 25 últimas execuções do GitHub Actions falharam** (desde 31/mar), impedindo deploy automático na VPS.

### Causas Raiz (2 problemas encontrados):

1. **Autenticação SSH:** Secret `VPS_SSH_PRIVATE_KEY` estava desatualizado/corrompido
2. **Path incorreto:** Workflow tentava acessar `/opt/gueclaw-agent` mas código estava em `/root/gueclaw`

## ✅ Solução

Ambos os problemas foram **corrigidos automaticamente via SSH**:

### 1. Nova Chave SSH Criada ✅

Uma **nova chave SSH dedicada** foi criada na VPS (`github_actions_2026`) e adicionada ao `authorized_keys`.

### 2. Symlink Criado ✅

Criado link simbólico `/opt/gueclaw-agent` → `/root/gueclaw` para que o workflow acesse o path correto.

```bash
lrwxrwxrwx  1 root root   13 Apr  4 18:25 /opt/gueclaw-agent -> /root/gueclaw
```

**Status:** ✅ PM2 + API testados e funcionando corretamente com o novo symlink.

### 📋 Passo a Passo

1. **Acesse o GitHub:**
   ```
   https://github.com/Moisesjr20/gueclaw/settings/secrets/actions
   ```

2. **Edite o secret `VPS_SSH_PRIVATE_KEY`:**
   - Clique em **Update** ao lado de `VPS_SSH_PRIVATE_KEY`
   - **Cole EXATAMENTE a chave privada abaixo** (incluindo BEGIN/END):

```
-----BEGIN OPENSSH PRIVATE KEY-----
b3BlbnNzaC1rZXktdjEAAAAABG5vbmUAAAAEbm9uZQAAAAAAAAABAAAAMwAAAAtzc2gtZW
QyNTUxOQAAACDCLTIceJ7ID/sji8/AqND1Y3vw/Yk10IoBBXGaSlh4rgAAAKAaNspxGjbK
cQAAAAtzc2gtZWQyNTUxOQAAACDCLTIceJ7ID/sji8/AqND1Y3vw/Yk10IoBBXGaSlh4rg
AAAEBC9GBRN6wTq7sbbebDK/rYNFJ7hadTlpkfV2eDw05XlcItMhx4nsgP+yOLz8Co0PVj
e/D9iTXQigEFcZpKWHiuAAAAFmdpdGh1Yi1hY3Rpb25zQGd1ZWNsYXcBAgMEBQYH
-----END OPENSSH PRIVATE KEY-----
```

3. **Salve o secret**

4. **Teste o workflow:**
   - Vá em: https://github.com/Moisesjr20/gueclaw/actions/workflows/deploy.yml
   - Clique em **Run workflow** (dropdown à direita)
   - Clique no botão verde **Run workflow**

5. **Verifique o resultado:**
   - Aguarde ~2-3 minutos
   - O workflow deve completar com ✅ (não mais ❌)
   - Você verá os 3 steps: Write .env → Run update.sh → Smoke test

## 📊 Resultado Esperado

### Antes da correção:
- ❌ Runs #20-44: **TODAS FALHARAM** (100% failure rate)
- ⏱️ Tempo: 8-39s (falha logo no SSH)
- 📅 Início: 31/mar 12:25 PM
- 🚫 VPS ficou **5 commits desatualizada** (779f876 vs 9e4f9de)

### Após atualizar o secret:
- ✅ Deploy automático em cada `git push origin main`
- ✅ VPS sempre sincronizada com o repositório
- ✅ Zero necessidade de SSH manual
- ⏱️ Tempo esperado: ~2-3 minutos (tempo normal de build)
- 📝 Steps visíveis no log: Write .env → Run update.sh → Smoke test

### Teste manual do workflow:
1. Vá em: https://github.com/Moisesjr20/gueclaw/actions/workflows/deploy.yml
2. Clique em **Run workflow** (dropdown à direita)
3. Clique no botão verde **Run workflow**
4. Aguarde ~2-3 minutos
5. Deve aparecer: ✅ **#45** (primeira execução bem-sucedida!)

## 🔒 Segurança

- **Tipo:** ed25519 (algoritmo moderno, mais seguro que RSA)
- **Localização na VPS:** `/root/.ssh/github_actions_2026`
- **Chave pública no authorized_keys:** ✅ Já adicionada automaticamente
- **Fingerprint:** `SHA256:Pzsx94LM7KBNrRQvDbpDVT/AodQl1yXqF8tN1QG/UGI`

## ℹ️ Informação Adicional

**Por que o erro aconteceu?**

O `authorized_keys` foi modificado em 31/mar às 11:33, possivelmente removendo ou alterando a chave que o GitHub Actions estava usando. Isso causou falha de autenticação em TODAS as execuções subsequentes.

---

**Após configurar, confirme aqui se funcionou!** 🎯

---

## 🎯 TL;DR (Resumo Executivo)

**O que estava errado:**
- GitHub Actions: 25 execuções consecutivas falhando desde 31/mar
- Causa: SSH key inválida + path incorreto no workflow

**O que foi corrigido na VPS:**
- ✅ Nova chave SSH criada: `/root/.ssh/github_actions_2026`
- ✅ Symlink criado: `/opt/gueclaw-agent` → `/root/gueclaw`
- ✅ VPS atualizada manualmente: 779f876 → 9e4f9de (+5.722 linhas, 26 arquivos)

**O que VOCÊ precisa fazer:**
1. Acessar: https://github.com/Moisesjr20/gueclaw/settings/secrets/actions
2. Editar secret `VPS_SSH_PRIVATE_KEY` com a chave privada acima
3. Salvar
4. Testar: Run workflow manual em https://github.com/Moisesjr20/gueclaw/actions/workflows/deploy.yml

**Tempo estimado:** 2 minutos

**Resultado esperado:** ✅ Deploy #45 funciona (primeiro após 25 falhas)
