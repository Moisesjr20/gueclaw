# API Reference - DeepSeek

## Base URL
```
https://api.deepseek.com/v1
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
  "model": "deepseek-coder",
  "messages": [
    {"role": "system", "content": "Você é um programador experiente."},
    {"role": "user", "content": "Escreva uma função de fibonacci."}
  ],
  "temperature": 0.2,
  "max_tokens": 2000
}
```

**Models Disponíveis:**
- `deepseek-coder` - Especializado em código (recomendado)
- `deepseek-chat` - Modelo geral de chat

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
- 30 RPM (requests por minuto)
- Sem limite por hora explícito

## Exemplo Python (aiohttp)
```python
async with aiohttp.ClientSession() as session:
    headers = {"Authorization": f"Bearer {api_key}"}
    payload = {
        "model": "deepseek-coder",
        "messages": [{"role": "user", "content": "Write a Python function"}],
        "max_tokens": 2000
    }
    async with session.post(url, headers=headers, json=payload) as resp:
        data = await resp.json()
        print(data["choices"][0]["message"]["content"])
```

## Preços (aproximados)
- deepseek-coder: ~$0.0003 / 1K tokens (input)
- deepseek-coder: ~$0.0006 / 1K tokens (output)

## Vantagens do DeepSeek Coder
- Especializado em código
- Excelente em algoritmos e estruturas de dados
- Bom em otimização de performance
- Suporta múltiplas linguagens

## Documentação Oficial
https://platform.deepseek.com/api-docs
