# API Reference - Moonshot (Kimi)

## Base URL
```
https://api.moonshot.cn/v1
```

## Autenticação
Header: `Authorization: Bearer <API_KEY>`

## Endpoints

### Chat Completions
```
POST /chat/completions
```

**Request Body:**
```json
{
  "model": "moonshot-v1-128k",
  "messages": [
    {"role": "system", "content": "Você é um assistente útil."},
    {"role": "user", "content": "Olá!"}
  ],
  "temperature": 0.3,
  "max_tokens": 4000
}
```

**Models Disponíveis:**
- `moonshot-v1-8k` - Contexto 8K tokens
- `moonshot-v1-32k` - Contexto 32K tokens
- `moonshot-v1-128k` - Contexto 128K tokens (recomendado para análise de codebase)

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| model | string | ID do modelo |
| messages | array | Lista de mensagens |
| temperature | float | 0-2 (criatividade) |
| max_tokens | integer | Máximo de tokens na resposta |
| top_p | float | 0-1 (nucleus sampling) |
| stream | boolean | Stream de resposta |

**Rate Limits:**
- 60 RPM (requests por minuto)
- 1000 RPH (requests por hora)

## Exemplo Python (aiohttp)
```python
async with aiohttp.ClientSession() as session:
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "moonshot-v1-128k",
        "messages": [{"role": "user", "content": "Hello"}],
        "max_tokens": 1000
    }
    async with session.post(url, headers=headers, json=payload) as resp:
        data = await resp.json()
        print(data["choices"][0]["message"]["content"])
```

## Preços (aproximados)
- Input: ~$0.003 / 1K tokens
- Output: ~$0.006 / 1K tokens

## Documentação Oficial
https://platform.moonshot.cn/docs
