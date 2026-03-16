---
name: uazapi-groups
description: Lista e armazena todos os grupos do WhatsApp via UazAPI. Use esta skill quando o usuário quiser listar grupos do WhatsApp, sincronizar a lista de grupos, buscar o JID de um grupo, obter IDs de grupos, ou qualquer menção a "grupos do WhatsApp". Armazena os resultados em arquivo JSON para consulta futura.
---

# UazAPI — Grupos do WhatsApp

Skill para listar todos os grupos do WhatsApp conectado e armazenar a lista com nome e JID.

## 🔑 Configuração

```
Base URL: https://kyrius.uazapi.com   (variável UAIZAPI_BASE_URL)
Token:    ef81eb52-692d-4e31-b98e-c2c0d045013a  (variável UAIZAPI_TOKEN)
```

Use sempre os valores das variáveis de ambiente. Não hardcode.

---

## ⚠️ REGRAS ABSOLUTAS

1. **SEMPRE use a ferramenta `api_request`** para chamar a UazAPI. Nunca simule respostas.
2. Use o header `token: {UAIZAPI_TOKEN}`, não `Authorization`.
3. **SEMPRE salve o resultado em arquivo** após listar os grupos (veja seção "Armazenar").
4. Nunca invente JIDs ou nomes — use apenas os dados reais da resposta da API.

---

## 📋 Listar Grupos

**Endpoint:** `GET {UAIZAPI_BASE_URL}/group/list`

**Headers:**
```
Accept: application/json
token: {UAIZAPI_TOKEN}
```

**Exemplo de chamada via `api_request`:**
```json
{
  "method": "GET",
  "url": "https://kyrius.uazapi.com/group/list",
  "headers": {
    "Accept": "application/json",
    "token": "ef81eb52-692d-4e31-b98e-c2c0d045013a"
  }
}
```

**Exemplo de resposta esperada:**
```json
{
  "groups": [
    {
      "JID": "120363423366742688@g.us",
      "Name": "Nome do Grupo",
      "ParticipantCount": 42,
      "OwnerJID": "5511999999999@s.whatsapp.net",
      "GroupCreated": 1700000000
    }
  ]
}
```

> O campo `JID` é o identificador único do grupo (formato `XXXXXX@g.us`).
> O campo `Name` é o nome do grupo.
> A resposta tem nível raiz `{ "groups": [...] }` — itere em `response.groups`.

---

## 💾 Armazenar a Lista de Grupos

Após obter a lista, salve em `.agents/skills/uazapi-groups/data/groups.json` usando a ferramenta `file_operations`.

**Formato do arquivo a salvar:**
```json
{
  "updated_at": "2026-03-16T10:00:00.000Z",
  "total": 5,
  "groups": [
    {
      "name": "Nome do Grupo",
      "jid": "120363000000000001@g.us"
    }
  ]
}
```

**Passos:**
1. Receba a resposta da API (objeto com chave `groups`)
2. Extraia apenas `Name` (→ `name`) e `JID` (→ `jid`) de cada item em `response.groups`
3. Monte o JSON com `updated_at` (timestamp ISO atual), `total` (quantidade) e `groups`
4. Use `file_operations` com `action: "write"` para salvar em `.agents/skills/uazapi-groups/data/groups.json`

---

## 🔍 Consultar Grupos Salvos (Opcional)

Para ler a lista já salva sem chamar a API novamente:
- Use `file_operations` com `action: "read"` no caminho `.agents/skills/uazapi-groups/data/groups.json`

---

## 📤 Apresentar Resultado ao Usuário

Após listar e salvar, apresente ao usuário:
- Quantidade total de grupos encontrados
- Tabela ou lista com **nome** e **JID** de cada grupo
- Confirmação de que o arquivo foi salvo

**Exemplo de resposta formatada:**
```
✅ Encontrei 5 grupos no seu WhatsApp:

1. **Família Silva** — `120363001@g.us`
2. **Trabalho Equipe** — `120363002@g.us`
3. **Amigos Futebol** — `120363003@g.us`
...

💾 Lista salva em `.agents/skills/uazapi-groups/data/groups.json`
```

---

## 🛠️ Fluxo Completo

```
1. api_request → GET /group/list
2. Parsear resposta: extrair name (subject) + jid (id)
3. file_operations write → salvar groups.json
4. Responder ao usuário com a lista formatada
```
