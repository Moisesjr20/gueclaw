---
name: advocacia-ce-scraper
description: Buscar e-mails de escritórios de advocacia no Ceará usando Apify (Google Maps) e scraping de websites. Use para prospecção comercial de serviços jurídicos, marketing para advogados, ou criação de listas de contatos do setor jurídico no estado do Ceará.
---

# Advocacia CE Scraper

Skill para busca automatizada de escritórios de advocacia no Ceará, Brasil.

## 🎯 Objetivo

Buscar emails de contato de escritórios de advocacia no Ceará usando:
1. **Google Maps** (via Apify) - para encontrar escritórios
2. **Scraping de websites** - para extrair emails
3. **Validação** - para limpar e verificar dados

## 🛠️ Requisitos

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install
```

## 🔑 Variáveis de Ambiente

```bash
export APIFY_API_KEY="apify_api_..."
export SUPABASE_URL="https://...supabase.co"
export SUPABASE_SERVICE_KEY="eyJ..."
```

## 📋 Como Usar

### 1. Buscar no Google Maps (Fase 1)

```bash
./venv/bin/python scripts/busca_apify.py \
  --cidade "Fortaleza" \
  --quantidade 100 \
  --output resultados_fase1.json
```

### 2. Extrair Emails dos Websites (Fase 2)

```bash
./venv/bin/python scripts/scrape_websites.py \
  --input resultados_fase1.json \
  --output resultados_fase2.json
```

### 3. Validar e Limpar (Fase 3)

```bash
./venv/bin/python scripts/valida_emails.py \
  --input resultados_fase2.json \
  --output escritorios_ce_final.csv
```

### 4. Pipeline Completo

```bash
./venv/bin/python scripts/pipeline_completo.py \
  --cidade "Fortaleza" \
  --quantidade 100 \
  --output final
```

## 📊 Estrutura dos Dados

### Entrada (Google Maps)
```json
{
  "nome": "Silva & Advogados Associados",
  "endereco": "Av. Dom Luís, 500, Fortaleza, CE",
  "telefone": "(85) 99999-9999",
  "website": "https://silvaadvogados.com.br",
  "email_maps": null,
  "google_maps_url": "..."
}
```

### Saída Final
```json
{
  "nome": "Silva & Advogados Associados",
  "endereco": "Av. Dom Luís, 500, Fortaleza, CE",
  "telefone": "(85) 99999-9999",
  "website": "https://silvaadvogados.com.br",
  "email": "contato@silvaadvogados.com.br",
  "email_valido": true,
  "fonte": "website",
  "data_coleta": "2026-03-08"
}
```

## 🗄️ Banco de Dados

Ver `database/schema.sql` para criar tabelas no Supabase.

## ⚖️ Considerações Legais

- ✅ Dados públicos do Google Maps
- ✅ Emails de contato comercial
- ❌ Não enviar spam
- ❌ Respeitar LGPD

## 💰 Custos

- Apify: ~$0.01-0.02 por resultado
- 1000 escritórios: ~$10-20

## 📁 Arquivos

- `config/apify_config.json` - Configuração do actor
- `scripts/busca_apify.py` - Busca no Google Maps
- `scripts/scrape_websites.py` - Scraping de sites
- `scripts/valida_emails.py` - Validação
- `database/schema.sql` - Schema do banco

## 🚀 Execução Rápida

```bash
# 1. Configurar
export APIFY_API_KEY="sua_chave"

# 2. Buscar 100 escritórios em Fortaleza
./venv/bin/python scripts/busca_apify.py -c "Fortaleza" -q 100

# 3. Extrair emails
./venv/bin/python scripts/scrape_websites.py

# 4. Exportar CSV
./venv/bin/python scripts/valida_emails.py --export-csv
```

## 📝 Notas

- Rate limiting: 1 req/2 segundos para websites
- Timeout: 10s por website
- Retry: 3 tentativas
- User-Agent rotativo

## 🔧 Troubleshooting

**Erro "Apify API rate limit":**
- Aguarde 60 segundos
- Ou use conta paga

**Website bloqueia scraping:**
- Verifique robots.txt
- Aumente delay entre requisições
- Use proxy (configurável)

**Email não encontrado:**
- Nem todo site lista email público
- Tente buscar página de contato

## 📞 Suporte

Para dúvidas sobre o plano completo, ver:
`/data/.openclaw/workspace/directives/plano_busca_advocacia_ce.md`
