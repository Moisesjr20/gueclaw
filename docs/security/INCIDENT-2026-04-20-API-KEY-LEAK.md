# Relatório de Incidente de Segurança - Vazamento de API Key

**Data do Incidente**: 2026-04-20  
**Severidade**: 🔴 CRÍTICA  
**Status**: ✅ MITIGADO

---

## 📋 Resumo Executivo

Foi detectado vazamento de credenciais sensíveis em arquivo `.env.example` público no repositório GitHub, expondo chave de API da aplicação e endereço IP da VPS de produção.

## 🔍 Detalhes do Vazamento

### Dados Expostos

**Arquivo**: `dashboard/.env.example`  
**Repositório**: https://github.com/Moisesjr20/gueclaw (público)

```env
GUECLAW_API_KEY=gc_dash_21965591_9af67ab57a794db2
GUECLAW_API_URL=http://147.93.69.211:3742
```

### Histórico da Exposição

- **Primeiro commit**: 63c2ad6 (2026-03-31 16:22:15)
- **Período exposto**: ~20 dias
- **Commits afetados**: 4 (63c2ad6, 4e3cfa4, 2fb289e, 4b37994)

### Impacto Potencial

- ✅ **Baixo**: Arquivo `.env` real não foi commitado
- ✅ **Baixo**: Variáveis do Vercel estavam criptografadas
- 🔴 **Alto**: API key funcional exposta publicamente
- 🔴 **Alto**: IP da VPS de produção divulgado
- ⚠️ **Médio**: Possível acesso não autorizado à API durante 20 dias

---

## ✅ Ações Corretivas Tomadas

### 1. Revogação Imediata de Credenciais

- [x] API key antiga revogada no Vercel: `gc_dash_21965591_9af67ab57a794db2`
- [x] Nova chave gerada: `gc_dash_64102541_3451b5f679bb490d`
- [x] Nova chave configurada no Vercel (ambiente Production)

### 2. Limpeza do Repositório

- [x] Arquivo `dashboard/.env.example` sanitizado
- [x] Valores reais substituídos por placeholders:
  - `GUECLAW_API_KEY=gc_dash_XXXXXXXX_XXXXXXXXXXXXXXXX`
  - `GUECLAW_API_URL=http://your-vps-ip:3742`

### 3. Atualização na VPS

Script criado: [`scripts/update-vps-api-key.sh`](../scripts/update-vps-api-key.sh)

**Próximos passos manuais**:
```bash
# Executar na VPS via SSH:
ssh root@147.93.69.211
cd /root/gueclaw
nano .env  # Atualizar DASHBOARD_API_KEY=gc_dash_64102541_3451b5f679bb490d
pm2 restart gueclaw
```

### 4. Monitoramento

**Verificar logs de acesso não autorizado**:
```bash
ssh root@147.93.69.211
cd /root/gueclaw
tail -n 100 /root/.pm2/logs/gueclaw-agent-out.log | grep "401\|403\|Unauthorized"
```

---

## 🔒 Recomendações de Segurança Futura

### Imediatas

1. **Nunca commitar valores reais em `.env.example`**
   - Usar sempre placeholders genéricos
   - Documentar formato esperado sem revelar dados

2. **Implementar pre-commit hooks**
   ```bash
   # Adicionar ao .git/hooks/pre-commit
   if git diff --cached | grep -E "gc_dash_[0-9]+_[a-f0-9]+"; then
     echo "⛔ Detectada API key real em .env.example!"
     exit 1
   fi
   ```

3. **Rotação periódica de chaves**
   - Estabelecer política de rotação trimestral
   - Automatizar com scripts

### Arquitetura

4. **Considerar GitHub Actions Secrets**
   - Mover todas as credenciais para Secrets do repositório
   - Nunca expor em arquivos versionados

5. **Implementar rate limiting na API**
   - Prevenir abuso mesmo com chave vazada
   - Alertas automáticos de uso anômalo

6. **IP Whitelisting**
   - Restringir acesso da API apenas a IPs conhecidos
   - Implementar na VPS via firewall/nginx

### Monitoramento

7. **Alertas de segurança**
   - Configurar notificações de falhas de autenticação
   - Monitorar uso da API em tempo real

8. **Auditoria regular**
   - Revisar repositório público mensalmente
   - Escanear com ferramentas automatizadas (TruffleHog, GitGuardian)

---

## 📊 Timeline Completa

| Timestamp | Evento |
|-----------|--------|
| 2026-03-31 16:22 | Chave vazada no commit 63c2ad6 |
| 2026-04-20 | Vazamento detectado |
| 2026-04-20 | Chave antiga revogada no Vercel |
| 2026-04-20 | Nova chave gerada e configurada |
| 2026-04-20 | `.env.example` sanitizado |
| 2026-04-20 | Script de atualização VPS criado |
| 2026-04-20 | `DASHBOARD_API_KEY` adicionada ao `/opt/gueclaw-agent/.env` |
| 2026-04-20 | Serviço `gueclaw-agent` reiniciado com `--update-env` |
| 2026-04-20 | ✅ **Validação bem-sucedida**: Chave antiga retorna 401, nova retorna 200 |
| 2026-04-20 | 🔒 **Incidente RESOLVIDO**: Sistema seguro novamente |

---

## ✅ Checklist de Validação

- [x] Nova API key gerada
- [x] Chave antiga removida do Vercel
- [x] Nova chave adicionada ao Vercel (Production)
- [x] `.env.example` limpo de dados sensíveis
- [x] ✅ **COMPLETO**: Chave atualizada na VPS (`/opt/gueclaw-agent/.env`)
- [x] ✅ **COMPLETO**: Serviço PM2 reiniciado com `--update-env`
- [x] ✅ **VALIDADO**: Chave antiga rejeitada (401 Unauthorized)
- [x] ✅ **VALIDADO**: Chave nova funcionando (200 OK)
- [ ] **PENDENTE**: Verificar logs de acesso suspeito (últimos 20 dias)
- [ ] **PENDENTE**: Implementar pre-commit hooks
- [ ] **PENDENTE**: Configurar monitoramento de segurança

---

## 🔗 Referências

- [Vercel Environment Variables Best Practices](https://vercel.com/docs/concepts/projects/environment-variables)
- [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)

---

**Responsável**: GueClaw AI Agent  
**Aprovação necessária**: ✅ Pendente revisão humana  
**Próxima auditoria**: 2026-05-20
