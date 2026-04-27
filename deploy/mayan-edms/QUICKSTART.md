# 🚀 Script de Deploy Rápido - Mayan EDMS

## Executar Deploy Automático

### Passo 1: Preparar SSH

```bash
# Verificar se a chave SSH existe
ls -la ~/.ssh/gueclaw_vps

# Se não existir, criar ou atualizar o caminho
export SSH_KEY="caminho/para/sua/chave"
```

### Passo 2: Executar Script de Deploy

```bash
cd "D:\Clientes de BI\projeto GueguelClaw\deploy\mayan-edms"

# Tornar executável (Linux/Mac)
chmod +x deploy.sh health-check.sh

# Executar deploy
./deploy.sh
```

### Passo 3: Aguardar Inicialização

O deploy vai:
1. ✅ Gerar senhas seguras automaticamente
2. ✅ Copiar arquivos para VPS via SSH
3. ✅ Criar diretórios na VPS
4. ✅ Baixar imagens Docker
5. ✅ Subir containers
6. ✅ Aguardar inicialização (60s)

**Tempo total:** ~5-8 minutos

### Passo 4: Acessar Interface

```
URL: https://docs.kyrius.com.br
Username: admin
Password: (veja em .env.mayan)
```

### Passo 5: Gerar API Token

1. Login no Mayan EDMS
2. Admin > API > Tokens
3. Create > Select user: admin
4. Copiar token

### Passo 6: Atualizar .env do GueClaw

```bash
# Adicionar ao .env principal
MAYAN_API_URL=https://docs.kyrius.com.br/api
MAYAN_API_TOKEN=<token_copiado>
MAYAN_ADMIN_USER=admin
MAYAN_ADMIN_PASSWORD=<senha_admin>
```

### Passo 7: Testar Integração

```bash
# Testar conexão
curl -H "Authorization: Token <seu_token>" \
     https://docs.kyrius.com.br/api/

# Ou usar health check
./health-check.sh
```

---

## Comandos Úteis

### Ver Status dos Containers

```bash
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211
docker-compose -f /opt/mayan-edms/docker-compose.yml ps
```

### Ver Logs

```bash
# Tempo real
docker-compose -f /opt/mayan-edms/docker-compose.yml logs -f mayan

# Últimas 50 linhas
docker-compose -f /opt/mayan-edms/docker-compose.yml logs --tail=50 mayan
```

### Reiniciar Mayan

```bash
docker-compose -f /opt/mayan-edms/docker-compose.yml restart mayan
```

### Parar Mayan

```bash
docker-compose -f /opt/mayan-edms/docker-compose.yml stop
```

### Subir Mayan

```bash
docker-compose -f /opt/mayan-edms/docker-compose.yml start
```

### Backup

```bash
# Database
docker-compose exec postgres pg_dump -U mayan mayan > backup-$(date +%F).sql

# Media
tar -czf media-backup-$(date +%F).tar.gz /opt/mayan-edms/media
```

---

## Troubleshooting

### Erro: "Cannot connect to Docker daemon"

```bash
# Reiniciar Docker na VPS
sudo systemctl restart docker
```

### Erro: "Connection refused"

```bash
# Verificar se containers estão rodando
docker-compose ps

# Verificar rede
docker network inspect gueclaw-network
```

### SSL não funciona

```bash
# Ver logs do Traefik
docker-compose logs traefik | grep -i "docs.kyrius"

# Aguardar 2-5 minutos para certificado Let's Encrypt
```

### Mayan não responde

```bash
# Verificar saúde dos serviços
docker-compose exec postgres pg_isready -U mayan -d mayan
docker-compose exec redis redis-cli ping
docker-compose exec rabbitmq rabbitmq-diagnostics -q ping
curl http://localhost:8000/api/
```

---

## Próximos Passos Após Deploy

1. ✅ Deploy Mayan EDMS ← **VOCÊ ESTÁ AQUI**
2. ⬜ Configurar DNS `docs.kyrius.com.br`
3. ⬜ Gerar API Token
4. ⬜ Atualizar .env do GueClaw
5. ⬜ Testar integração com Ollama Cloud
6. ⬜ Testar tools de documento
7. ⬜ Rodar testes de integração

---

**Dúvidas?** Consulte `README.md` ou a documentação oficial em https://docs.mayan-edms.com
