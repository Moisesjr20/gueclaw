# Deploy do Dashboard GueClaw no Vercel

## Pré-requisitos
- Conta no Vercel (pode usar GitHub para login)
- Vercel CLI instalado: `npm install -g vercel`

## Opção 1: Deploy via CLI (Recomendado)

### 1. Fazer login no Vercel
```bash
cd dashboard
vercel login
```

### 2. Fazer primeiro deploy (vincula o projeto)
```bash
vercel
```

O CLI vai perguntar:
- **Set up and deploy?** → Y
- **Which scope?** → Escolha sua conta/equipe
- **Link to existing project?** → N
- **What's your project's name?** → gueclaw-dashboard (ou o nome que preferir)
- **In which directory is your code located?** → ./

### 3. Configurar variáveis de ambiente
```bash
vercel env add GUECLAW_API_URL production
# Cole: http://147.93.69.211:3742

vercel env add GUECLAW_API_KEY production
# Cole: gc_dash_21965591_9af67ab57a794db2

vercel env add NEXT_PUBLIC_FINANCIAL_PASSWORD production
# Cole: sua_senha_forte_aqui
```

### 4. Deploy em produção
```bash
vercel --prod
```

---

## Opção 2: Deploy via Interface Web

### 1. Criar novo projeto no Vercel
- Acesse https://vercel.com/new
- Importe o repositório GitHub do GueClaw
- Configure o **Root Directory** como `dashboard`

### 2. Configurar Build Settings
Vercel detecta automaticamente Next.js, mas confirme:
- **Framework Preset:** Next.js
- **Build Command:** `npm run build`
- **Output Directory:** `.next` (padrão Next.js)
- **Install Command:** `npm install`

### 3. Configurar Environment Variables
Adicione estas variáveis em **Project Settings > Environment Variables**:

| Name | Value | Environment |
|------|-------|-------------|
| `GUECLAW_API_URL` | `http://147.93.69.211:3742` | Production, Preview |
| `GUECLAW_API_KEY` | `gc_dash_21965591_9af67ab57a794db2` | Production, Preview |
| `NEXT_PUBLIC_FINANCIAL_PASSWORD` | `sua_senha_forte_aqui` | Production, Preview |

⚠️ **IMPORTANTE:** Configure uma senha forte para proteger a aba Financeiro!

### 4. Fazer Deploy
Clique em **Deploy**

---

## Após o Deploy

1. Vercel vai gerar uma URL: `https://gueclaw-dashboard.vercel.app` (ou similar)
2. Acesse a URL e navegue para `/financeiro`
3. Configure o domínio customizado se desejar (ex: `dashboard.kyrius.info`)

## Atualizações Futuras

### Via Git (Automático)
- Push para `main` → Deploy automático de produção
- Push para outras branches → Preview deployment

### Via CLI (Manual)
```bash
cd dashboard
vercel --prod
```

---

## Troubleshooting

### Erro 503 Service Unavailable
- Verifique se a VPS está acessível: 
  ```bash
  curl -H "x-api-key: gc_dash_21965591_9af67ab57a794db2" http://147.93.69.211:3742/api/health
  ```
- Confirme que o firewall permite conexões da Vercel no port 3742

### Dashboard mostra R$ 0,00
- Verifique se o endpoint está incluindo transações não realizadas
- Teste o endpoint: `GET /api/financial/balance?userId=8227546813&onlyRealized=false`

### Build falha no Vercel
- Verifique versão do Node.js em `package.json` (engines)
- Revise logs do build no dashboard do Vercel

---

## Links Úteis
- Vercel Dashboard: https://vercel.com/dashboard
- Vercel CLI Docs: https://vercel.com/docs/cli
- Next.js on Vercel: https://vercel.com/docs/frameworks/nextjs
