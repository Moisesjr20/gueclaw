# Nginx — Configuração HTTPS + Webhook Telegram

> Configuração do Nginx no VPS para expor o webhook do Telegram.
> O Telegram exige HTTPS. O GueClaw usa webhook mode em produção (não polling).

---

## 1. Visão Geral

```
Internet (Telegram)
      │
      │  HTTPS :443
      ▼
   Nginx
      │
      │  HTTP localhost:3000
      ▼
  GueClaw (PM2)
  src/index.ts → webhook mode
```

O Nginx atua como reverse proxy:
- Termina TLS (certificado Let's Encrypt)
- Repassa `/webhook/<TOKEN>` para `localhost:3000`
- **Nunca** expõe a porta 3742 (Debug API) externamente

---

## 2. Pré-requisitos no VPS

```bash
# Instalar Nginx e Certbot
apt update
apt install nginx certbot python3-certbot-nginx -y

# Verificar se Nginx está rodando
systemctl status nginx
```

---

## 3. Configuração do Nginx

Criar arquivo `/etc/nginx/sites-available/gueclaw`:

```nginx
server {
    listen 80;
    server_name SEU-DOMINIO.com;

    # Redirecionar HTTP para HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name SEU-DOMINIO.com;

    # Certificados Let's Encrypt (gerados pelo certbot)
    ssl_certificate     /etc/letsencrypt/live/SEU-DOMINIO.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/SEU-DOMINIO.com/privkey.pem;

    # Segurança SSL (recomendações Mozilla Modern)
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;

    # Headers de segurança
    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options DENY;
    add_header X-XSS-Protection "1; mode=block";

    # Proxy para o GueClaw (webhook do Telegram)
    location /webhook/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto https;

        # Limitar acesso apenas a IPs do Telegram
        # Lista oficial: https://core.telegram.org/bots/webhooks#the-short-version
        allow 149.154.160.0/20;
        allow 91.108.4.0/22;
        deny all;
    }

    # Bloquear acesso a qualquer outra rota
    location / {
        return 404;
    }
}
```

Habilitar o site:
```bash
ln -s /etc/nginx/sites-available/gueclaw /etc/nginx/sites-enabled/
nginx -t          # testar configuração
systemctl reload nginx
```

---

## 4. Certificado SSL (Let's Encrypt)

```bash
# Gerar certificado para seu domínio
certbot --nginx -d SEU-DOMINIO.com

# Verificar renovação automática
certbot renew --dry-run

# O cron de renovação automática é criado pelo certbot:
# /etc/cron.d/certbot → "0 */12 * * * root certbot renew"
```

---

## 5. Configurar o GueClaw para Webhook Mode

No `.env` do VPS, alterar de polling para webhook:

```env
# Desabilitar polling
TELEGRAM_USE_POLLING=false

# URL pública do webhook (Nginx HTTPS)
TELEGRAM_WEBHOOK_URL=https://SEU-DOMINIO.com/webhook/<BOT_TOKEN>

# Porta onde o GueClaw escuta localmente (Nginx faz proxy para cá)
WEBHOOK_PORT=3000
```

Registrar o webhook no Telegram:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://SEU-DOMINIO.com/webhook/<BOT_TOKEN>"
```

Verificar se foi registrado:
```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

---

## 6. Alternativa: Polling Mode (sem Nginx)

Se não tiver domínio ou certificado, use polling mode. Mais simples, mesma funcionalidade:

```env
# .env no VPS
TELEGRAM_USE_POLLING=true
# (não precisa de TELEGRAM_WEBHOOK_URL nem WEBHOOK_PORT)
```

Polling funciona bem para bots pessoais com 1 usuário. O bot conecta ao Telegram e pergunta "tem mensagem nova?" a cada segundo. Desvantagem: latência ligeiramente maior (~1s).

> **Configuração atual do projeto:** polling mode ativo. Nginx existe no VPS mas não está configurado para o GueClaw.

---

## 7. Status Atual

| Item | Status |
|---|---|
| Nginx instalado no VPS | ✅ (para outros serviços) |
| Nginx configurado para GueClaw | ❌ Não configurado |
| Certificado SSL para domínio do GueClaw | ❌ Não gerado |
| Modo atual de operação | ✅ Polling (funcional) |

**Prioridade:** baixa. Polling mode atende perfeitamente ao caso de uso atual (bot pessoal, 1 usuário). Webhook mode só seria necessário se:
- O bot precisar responder em < 200ms (webhooks são mais rápidos)
- Tiver restrições no VPS que bloqueiem conexões de saída do bot
- For expor o bot para múltiplos usuários com alta frequência de mensagens

---

## 8. Firewall (UFW)

```bash
# Regras necessárias para webhook mode
ufw allow 80/tcp    # HTTP (redirect para HTTPS)
ufw allow 443/tcp   # HTTPS (Nginx)

# Regras de segurança gerais
ufw allow ssh       # Não fechar SSH!
ufw deny 3000/tcp   # Porta interna do GueClaw (nunca expor)
ufw deny 3742/tcp   # Debug API (nunca expor)
ufw enable
```
