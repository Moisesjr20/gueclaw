# 📦 Mayan EDMS Deployment Guide

## Visão Geral

Mayan EDMS é o sistema de gestão documental empresarial para o GueClaw Agent, com:
- OCR automático (Tesseract)
- Busca full-text
- Versionamento de documentos
- API REST completa
- Classificação e tagging

## Arquitetura

```
┌─────────────────────────────────────────────┐
│              Traefik (Reverse Proxy)        │
│         SSL: docs.kyrius.com.br             │
└─────────────────┬───────────────────────────┘
                  │
    ┌─────────────▼──────────────┐
    │    Mayan EDMS Frontend     │
    │         (Nginx)            │
    └─────────────┬──────────────┘
                  │
    ┌─────────────▼──────────────┐
    │    Mayan EDMS Backend      │
    │      (Gunicorn + 2W)       │
    └─────┬─────┬──────┬─────────┘
          │     │      │
    ┌─────▼─┐ ┌▼────┐ ┌▼────────┐
    │Redis  │ │Rabbit│ │Postgres │
    │Cache  │ │  MQ │ │ +pgvector│
    └───────┘ └─────┘ └─────────┘
```

## Pré-requisitos

- VPS: 147.93.69.211
- Docker 25.0.3+
- Docker Compose v2.27+
- RAM mínima: 4GB (recomendado 8GB)
- Disco: 20GB livres

## Deploy

### 1. Preparar VPS

```bash
# SSH na VPS
ssh -i ~/.ssh/gueclaw_vps root@147.93.69.211

# Criar diretórios
sudo mkdir -p /opt/mayan-edms/{postgres,redis,media,config,rabbitmq}
sudo mkdir -p /var/log/mayan
sudo chown -R 1000:1000 /opt/mayan-edms
```

### 2. Copiar Arquivos

```bash
# Do seu computador local
scp -i ~/.ssh/gueclaw_vps \
    deploy/mayan-edms/docker-compose.yml \
    root@147.93.69.211:/opt/mayan-edms/

scp -i ~/.ssh/gueclaw_vps \
    deploy/mayan-edms/settings.py \
    root@147.93.69.211:/opt/mayan-edms/config/
```

### 3. Gerar Credenciais

```bash
# Executar script de deploy (gera senhas aleatórias)
cd deploy/mayan-edms
chmod +x deploy.sh
./deploy.sh
```

O script vai:
- Gerar senhas seguras para DB, RabbitMQ, SECRET_KEY
- Salvar credenciais em `.env.mayan`
- Fazer deploy automático na VPS

### 4. Configurar DNS

Aponte o DNS para a VPS:

```
docs.kyrius.com.br  A  147.93.69.211
```

### 5. Aguardar SSL

O Traefik vai automaticamente:
- Detectar o novo container
- Solicitar certificado Let's Encrypt
- Configurar HTTPS

Tempo estimado: 2-5 minutos

### 6. Acessar Interface

```
URL: https://docs.kyrius.com.br
Username: admin
Password: <veja em .env.mayan>
```

### 7. Gerar API Token

1. Login no Mayan EDMS
2. Vá em **Admin** > **API** > **Tokens**
3. Clique em **Create**
4. Selecione usuário `admin`
5. Copie o token gerado

### 8. Atualizar .env do GueClaw

```bash
# Adicionar ao .env
MAYAN_API_URL=https://docs.kyrius.com.br/api
MAYAN_API_TOKEN=<seu_token_aqui>
MAYAN_ADMIN_USER=admin
MAYAN_ADMIN_PASSWORD=<sua_senha_aqui>
```

## Testes

### Testar Conexão API

```bash
curl -H "Authorization: Token <seu_token>" \
     https://docs.kyrius.com.br/api/
```

### Upload de Teste

```bash
curl -X POST \
  -H "Authorization: Token <seu_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@test.pdf" \
  -F "description=Test document" \
  https://docs.kyrius.com.br/api/documents/
```

### Health Check

```bash
# Script automático
./deploy/mayan-edms/health-check.sh

# Manual
docker-compose -f /opt/mayan-edms/docker-compose.yml ps
```

## Troubleshooting

### Mayan não inicia

```bash
# Ver logs
docker-compose logs mayan

# Verificar dependências
docker-compose ps
# Todos devem estar "Up"
```

### OCR não funciona

```bash
# Verificar container tesseract
docker-compose logs tesseract

# Verificar linguagem
docker-compose exec tesseract tesseract --list-langs
```

### SSL não funciona

```bash
# Ver logs do Traefik
docker-compose logs traefik | grep -i "docs.kyrius"

# Forçar renew
docker-compose restart traefik
```

### Banco de dados não conecta

```bash
# Testar conexão
docker-compose exec postgres pg_isready -U mayan -d mayan

# Ver logs do postgres
docker-compose logs postgres
```

## Backup

### Backup Diário

```bash
# Database
docker-compose exec postgres pg_dump -U mayan mayan > /backup/mayan-db-$(date +%F).sql

# Media files
tar -czf /backup/mayan-media-$(date +%F).tar.gz /opt/mayan-edms/media
```

### Restaurar Backup

```bash
# Database
docker-compose exec -T postgres psql -U mayan mayan < backup.sql

# Media
tar -xzf backup.tar.gz -C /
```

## Monitoramento

### Logs

```bash
# Tempo real
docker-compose logs -f mayan

# Últimas 100 linhas
docker-compose logs --tail=100 mayan
```

### Métricas

```bash
# Uso de recursos
docker stats mayan-edms

# Espaço em disco
df -h /opt/mayan-edms
```

## Segurança

### Firewall

```bash
# Liberar apenas portas necessárias
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (redirects HTTPS)
ufw allow 443/tcp   # HTTPS
```

### Atualizações

```bash
# Atualizar Mayan EDMS
docker-compose pull
docker-compose up -d
```

### Rotação de Logs

```bash
# /etc/logrotate.d/mayan
/var/log/mayan/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
}
```

## Variáveis de Ambiente

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `MAYAN_DB_PASSWORD` | Senha do PostgreSQL | Auto-gerada |
| `MAYAN_RABBITMQ_PASSWORD` | Senha do RabbitMQ | Auto-gerada |
| `MAYAN_SECRET_KEY` | Django secret key | Auto-gerada |
| `MAYAN_ADMIN_USER` | Usuário admin | `admin` |
| `MAYAN_ADMIN_PASSWORD` | Senha admin | Auto-gerada |
| `MAYAN_ALLOWED_HOSTS` | Hosts permitidos | `docs.kyrius.com.br,147.93.69.211` |

## Recursos

- [Documentação Oficial](https://docs.mayan-edms.com)
- [API Reference](https://docs.mayan-edms.com/api.html)
- [GitHub](https://github.com/mayan-edms/mayan-edms)

## Suporte

Em caso de problemas:
1. Verifique os logs: `docker-compose logs -f`
2. Execute health check: `./health-check.sh`
3. Consulte a documentação oficial

---

**Última atualização:** 25/04/2026  
**Versão:** 1.0
