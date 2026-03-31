# 🔒 Documentação de Segurança - GueClaw

Este diretório contém toda a documentação relacionada à segurança do sistema GueClaw.

---

## 📚 Documentos Disponíveis

### 1. [VISAO-GERAL-SEGURANCA.md](./VISAO-GERAL-SEGURANCA.md) ⭐ **COMECE AQUI**
**Sumário executivo** da análise de segurança inicial.
- Score de segurança (antes: 3.5/10)
- Vulnerabilidades críticas identificadas
- Plano de ação prioritário
- Impacto financeiro de vazamento simulado

**Leia se:** Você quer entender rapidamente o estado da segurança.

---

### 2. [database-security-analysis.md](./database-security-analysis.md) 📊 **ANÁLISE TÉCNICA**
**Análise detalhada** de 7 páginas com todas as vulnerabilidades e recomendações.
- Análise por camada (Local, VPS, GitHub)
- Recomendações priorizadas com código pronto
- Checklist de validação completo
- Procedimentos de migração de chaves

**Leia se:** Você precisa implementar correções ou entender detalhes técnicos.

---

### 3. [SISTEMA-SEGURANCA-IMPLEMENTADO.md](./SISTEMA-SEGURANCA-IMPLEMENTADO.md) ✅ **STATUS ATUAL**
**Relatório de implementação** com todas as melhorias aplicadas.
- Score atualizado (depois: 8.5/10)
- Todas as 6 implementações documentadas
- Comandos aplicados em cada etapa
- Próximos passos recomendados

**Leia se:** Você quer saber o que já foi implementado e o que falta.

---

### 4. [COMANDOS-SEGURANCA.md](./COMANDOS-SEGURANCA.md) 🛠️ **GUIA RÁPIDO**
**Referência de comandos** para operações do dia a dia.
- SSH e acesso VPS
- Firewall (UFW)
- Backups (criar/restaurar)
- Criptografia
- Auditoria e monitoramento
- Resposta a incidentes

**Leia se:** Você precisa executar alguma operação de segurança agora.

---

## 🎯 Leitura Recomendada por Perfil

### Para Gestores / Product Owners
1. [VISAO-GERAL-SEGURANCA.md](./VISAO-GERAL-SEGURANCA.md) - Entender riscos e investimento necessário
2. [SISTEMA-SEGURANCA-IMPLEMENTADO.md](./SISTEMA-SEGURANCA-IMPLEMENTADO.md) - Verificar o que foi feito

### Para Desenvolvedores
1. [database-security-analysis.md](./database-security-analysis.md) - Entender arquitetura de segurança
2. [COMANDOS-SEGURANCA.md](./COMANDOS-SEGURANCA.md) - Referência diária

### Para DevOps / SysAdmins
1. [SISTEMA-SEGURANCA-IMPLEMENTADO.md](./SISTEMA-SEGURANCA-IMPLEMENTADO.md) - Ver configurações aplicadas
2. [COMANDOS-SEGURANCA.md](./COMANDOS-SEGURANCA.md) - Operações de manutenção

### Para Auditores de Segurança
1. [database-security-analysis.md](./database-security-analysis.md) - Vulnerabilidades e mitigações
2. [SISTEMA-SEGURANCA-IMPLEMENTADO.md](./SISTEMA-SEGURANCA-IMPLEMENTADO.md) - Evidências de implementação

---

## ⚡ Quick Start

**Acabei de pegar o projeto. O que preciso fazer AGORA?**

1. ✅ Verifique que o `.env` tem permissões restritivas:
   ```powershell
   (Get-Acl ".env").Access | Select-Object IdentityReference
   # Deve mostrar apenas: SISTEMA e seu usuário
   ```

2. ✅ Teste a conexão SSH com a VPS:
   ```bash
   ssh -i C:\Users\kyriu\.ssh\gueclaw_vps root@147.93.69.211 "whoami"
   # Deve retornar: root
   ```

3. ✅ Verifique que o firewall está ativo:
   ```bash
   ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211 "ufw status"
   # Deve mostrar: Status: active
   ```

4. ✅ **FAÇA BACKUP DA CHAVE DE CRIPTOGRAFIA:**
   - Abra o `.env`
   - Copie o valor de `DATABASE_ENCRYPTION_KEY`
   - Salve em um gerenciador de senhas (1Password, Bitwarden, etc.)
   - **Se perder esta chave, o banco de dados fica ILEGÍVEL!**

---

## 🚨 Em Caso de Emergência

**Se algo der errado:**

1. **Acesso SSH não funciona:**
   - Verifique que a chave privada está em `C:\Users\kyriu\.ssh\gueclaw_vps`
   - Se perdeu a chave: acesse VPS pelo painel do provedor e reconfigure

2. **Banco de dados corrompido:**
   - Restaure do último backup: `.\scripts\backup-database.ps1`
   - Veja [COMANDOS-SEGURANCA.md](./COMANDOS-SEGURANCA.md#restaurar-backup-windows)

3. **Suspeita de invasão:**
   - Siga [Resposta a Incidentes](./COMANDOS-SEGURANCA.md#-resposta-a-incidentes)
   - Isole servidor imediatamente
   - Faça backup forensics antes de qualquer ação

4. **Credenciais vazaram:**
   - **ROTACIONE TODAS** as credenciais (Telegram, Google, GitHub, etc.)
   - Veja checklist em [COMANDOS-SEGURANCA.md](./COMANDOS-SEGURANCA.md#se-suspeitar-que-env-vazou)

---

## 📅 Cronograma de Manutenção

| Período | Ação | Documento |
|---|---|---|
| **Diário** | Verificar backup automático executou | [COMANDOS](./COMANDOS-SEGURANCA.md#backups) |
| **Semanal** | Revisar logs do firewall | [COMANDOS](./COMANDOS-SEGURANCA.md#ver-logs-do-firewall) |
| **Mensal** | Testar restauração de backup | [COMANDOS](./COMANDOS-SEGURANCA.md#restaurar-backup-windows) |
| **6 meses** | Rotacionar chave SSH | [IMPLEMENTADO](./SISTEMA-SEGURANCA-IMPLEMENTADO.md#6-em-atualizado-concluído) |
| **12 meses** | Rotacionar DATABASE_ENCRYPTION_KEY | [IMPLEMENTADO](./SISTEMA-SEGURANCA-IMPLEMENTADO.md#3-em-criptografia-de-dados-sensíveis-concluído) |
| **Anual** | Auditoria de segurança completa | [ANÁLISE](./database-security-analysis.md) |

---

## 🔗 Links Externos Úteis

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CIS Benchmarks](https://www.cisecurity.org/cis-benchmarks)
- [LGPD - Lei Geral de Proteção de Dados](http://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Better SQLite3 Docs](https://github.com/WiseLibs/better-sqlite3/blob/master/docs/api.md)
- [UFW Essentials](https://www.digitalocean.com/community/tutorials/ufw-essentials-common-firewall-rules-and-commands)

---

## 📞 Contato

**Responsável pela Segurança:** Junior Moises  
**Email:** contato@kyrius.info  
**Última Atualização:** 31/03/2026

---

## 📝 Histórico de Revisões

| Data | Versão | Mudanças |
|---|---|---|
| 31/03/2026 | 1.0 | Implementação inicial do sistema de segurança |
| - | - | Próxima revisão prevista: 30/06/2026 |
