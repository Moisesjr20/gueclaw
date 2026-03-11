# Referências e Alternativas

## 🗺️ Fontes de Dados Alternativas

### 1. OAB-CE (Ordem dos Advogados do Brasil)
- **URL:** https://www.oabce.org.br/
- **Pros:** Dados oficiais, completos
- **Cons:** Não possui API pública, scraping complexo
- **Nota:** Requer cadastro para acesso ao diretório completo

### 2. Google Places API (direto)
- **URL:** https://developers.google.com/maps/documentation/places/web-service/overview
- **Pros:** Oficial, dados confiáveis
- **Cons:** $5 por 1000 requisições (caro)
- **Nota:** Alternativa paga ao Apify

### 3. SerpAPI
- **URL:** https://serpapi.com/
- **Pros:** Fácil de usar, múltiplas engines
- **Cons:** $50-100/mês
- **Nota:** Boa alternativa se Apify não funcionar

### 4. Diretório Jurídico Online
- **Sites:** MundoJuridico, JusBrasil, etc.
- **Pros:** Informações detalhadas
- **Cons:** Nem sempre têm emails públicos

---

## ⚖️ Aspectos Legais

### LGPD (Lei Geral de Proteção de Dados)
**O que é permitido:**
- ✅ Coleta de dados públicos (Google Maps, sites públicos)
- ✅ Uso para prospecção comercial legítima
- ✅ Armazenamento com segurança adequada

**O que é proibido:**
- ❌ Uso para spam em massa
- ❌ Venda de dados para terceiros
- ❌ Dados pessoais não relacionados ao negócio

### Melhores Práticas
1. **Opt-out:** Incluir opção de remoção em emails
2. **Finalidade:** Usar apenas para contato comercial relevante
3. **Segurança:** Criptografar dados em repouso
4. **Retenção:** Definir prazo de retenção (ex: 2 anos)

---

## 🔧 Troubleshooting

### Erro: "Apify rate limit"
**Solução:**
- Aguardar 60 segundos
- Ou usar conta paga (mais quotas)

### Erro: "Website bloqueia scraping"
**Soluções:**
1. Aumentar delay entre requisições (DELAY = 5s)
2. Rotacionar User-Agents
3. Usar proxy (configurar em scrape_websites.py)

### Erro: "Email não encontrado"
**Motivos comuns:**
- Site não lista email público
- Email está em imagem (não texto)
- Email protegido por JavaScript

**Alternativas:**
- Buscar no LinkedIn
- Tentar formato padrão: contato@dominio.com.br

### Erro: "Timeout no website"
**Solução:**
- Aumentar TIMEOUT para 20s
- Verificar se site está online
- Pular e continuar com próximo

---

## 💡 Dicas de Otimização

### 1. Buscas por Cidade
Cidades principais do Ceará (por população):
1. Fortaleza (~2.7M hab) - Maior concentração
2. Caucaia (~360k hab)
3. Juazeiro do Norte (~280k hab)
4. Maracanaú (~240k hab)
5. Sobral (~210k hab)

### 2. Termos de Busca Efetivos
```
escritório de advocacia [cidade]
advogado [cidade]
advoacia [cidade]
cartório [cidade]  # Pode encontrar advogados associados
```

### 3. Horário Ideal para Scraping
- **Evitar:** 9h-18h (horário comercial, sites mais lentos)
- **Ideal:** 20h-8h (menor tráfego, menos bloqueios)

### 4. Validar Emails Antes de Enviar
Ferramentas:
- ZeroBounce
- NeverBounce
- Hunter.io (verificação)

---

## 📊 Benchmarks de Performance

### Apify (Google Maps)
- **100 resultados:** ~2-3 minutos, ~$1-2
- **1000 resultados:** ~15-20 minutos, ~$10-15
- **Taxa de sucesso:** 95%+

### Scraping de Websites
- **100 sites:** ~10-15 minutos (com delay)
- **Taxa de emails encontrados:** 40-60%
- **Taxa de emails válidos:** 70-80%

### Pipeline Completo
- **100 escritórios:** ~15-20 minutos
- **1000 escritórios:** ~2-3 horas

---

## 🚀 Próximos Passos Sugeridos

### Melhorias Futuras
1. **Enriquecimento de dados:**
   - Buscar CNPJ (via API ReceitaWS)
   - Buscar LinkedIn dos sócios
   - Verificar se site está no ar

2. **Automação:**
   - Agendamento semanal/mensal
   - Alertas de novos escritórios
   - Dashboard de análise

3. **Integrações:**
   - Enviar para CRM (Pipedrive, HubSpot)
   - Campanhas de email (Mailchimp)
   - Planilhas Google Sheets

---

## 📞 Contato e Suporte

Para dúvidas sobre:
- **Apify:** https://apify.com/contact
- **Google Maps API:** https://developers.google.com/maps/support
- **LGPD:** https://www.gov.br/lgpd/pt-br

---

## 📝 Licença e Uso

Este projeto é para uso próprio e deve respeitar:
- Termos de Serviço do Google Maps
- LGPD (Lei 13.709/2018)
- Código de Ética da OAB

**Responsabilidade:** O usuário é responsável pelo uso adequado dos dados coletados.
